// 학생·학부모 학사일정 화면(공개 화면과 앱 안 미리보기가 같이 쓴다). 문서 또는 shadowRoot 안에 그린다. 아무것도 저장하지 않는다.
import { inMonth, monthList, filterItems, itemsOn, monthCells, monthItems, rangeText, mdText, gradeText } from './logic.js';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const SKELETON = `<header class="top"><div><div class="school">이대부속고등학교</div><h1 data-id="title">학사일정</h1></div></header>
<main>
  <p data-id="notice" class="notice" hidden></p>
  <div data-id="state" class="state" role="status">불러오는 중이에요…</div>
  <section data-id="view" hidden>
    <div class="bar">
      <div class="chips" data-id="grades" role="group" aria-label="학년"></div>
      <div class="chips" data-id="modes" role="group" aria-label="보기"><button type="button" data-mode="cal" aria-pressed="true">달력</button><button type="button" data-mode="list" aria-pressed="false">목록</button></div>
    </div>
    <div class="nav"><button data-id="prev" type="button" aria-label="이전 달">‹</button><select data-id="month" aria-label="달 고르기"></select><button data-id="next" type="button" aria-label="다음 달">›</button></div>
    <p data-id="banner" class="notice" hidden></p>
    <div data-id="body"></div>
    <p class="foot" data-id="foot"></p>
  </section>
</main>`;

/** root(문서의 컨테이너 또는 shadowRoot)에 화면을 만들고 제어 함수를 돌려준다. opts.monthNote(ym) → {label, banner}: 달 목록에 덧붙일 말과 그 달 위 안내(미리보기에서 확정 전 달 표시용). */
export function mountPublic(root, opts = {}) {
  root.innerHTML = SKELETON;
  const $ = (id) => root.querySelector(`[data-id="${id}"]`);
  const st = { view: null, months: [], ym: '', grade: 0, mode: 'cal', sel: '' };
  const note = (ym) => (opts.monthNote ? opts.monthNote(ym) || {} : {});
  function state(msg) { $('state').textContent = msg; $('state').hidden = !msg; $('view').hidden = Boolean(msg); }
  function detail(items) {
    const its = itemsOn(items, st.sel);
    return `<div class="detail"><b>${esc(mdText(st.sel))}</b>${its.length ? its.map((x) => `<div>${esc(x.title)}${x.startsOn !== x.endsOn ? ` <span class="tag">${esc(rangeText(x.startsOn, x.endsOn))}</span>` : ''}${gradeText(x.grades) ? `<span class="tag">${esc(gradeText(x.grades))}</span>` : ''}</div>`).join('') : '<div class="foot">등록된 일정이 없어요.</div>'}</div>`;
  }
  function draw() {
    $('grades').innerHTML = [[0, '전체'], [1, '1학년'], [2, '2학년'], [3, '3학년']].map(([g, l]) => `<button type="button" data-g="${g}" aria-pressed="${st.grade === g}">${l}</button>`).join('');
    root.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === st.mode)));
    $('month').innerHTML = st.months.map((m) => `<option value="${m}" ${m === st.ym ? 'selected' : ''}>${m.slice(0, 4)}년 ${Number(m.slice(5))}월${note(m).label ? ` · ${esc(note(m).label)}` : ''}</option>`).join('');
    const i = st.months.indexOf(st.ym); $('prev').disabled = i <= 0; $('next').disabled = i >= st.months.length - 1;
    const bn = note(st.ym).banner; $('banner').hidden = !bn; $('banner').textContent = bn || '';
    const items = filterItems(inMonth(st.view.items, st.ym), st.grade);
    if (st.mode === 'list') {
      const list = monthItems(items, st.ym);
      $('body').innerHTML = list.length ? `<ul class="list">${list.map((x) => `<li class="${x.kind}"><span class="d">${esc(rangeText(x.startsOn, x.endsOn))}</span><span class="t">${esc(x.title)}${gradeText(x.grades) ? `<span class="tag">${esc(gradeText(x.grades))}</span>` : ''}</span></li>`).join('')}</ul>` : '<div class="empty">이 달에는 등록된 일정이 없어요.</div>';
      return;
    }
    $('body').innerHTML = `<div class="cal">${'일월화수목금토'.split('').map((x) => `<div class="dh">${x}</div>`).join('')}${monthCells(st.ym).map(({ d, inMonth: inM }) => {
      const its = inM ? itemsOn(items, d) : [];
      return `<div class="dc ${inM ? '' : 'out'} ${st.sel === d ? 'sel' : ''}" data-d="${d}"><span class="dn">${Number(d.slice(8))}</span>${its.slice(0, 3).map((x) => `<span class="ev ${x.kind}">${esc(x.title)}</span>`).join('')}${its.length > 3 ? `<span class="ev">+${its.length - 3}</span>` : ''}</div>`;
    }).join('')}</div>${st.sel ? detail(items) : '<p class="foot">날짜를 누르면 그날의 일정을 자세히 볼 수 있어요.</p>'}`;
  }
  root.addEventListener('click', (e) => {
    const g = e.target.closest('[data-g]'), m = e.target.closest('[data-mode]'), c = e.target.closest('.dc[data-d]'), nav = e.target.closest('[data-id="prev"],[data-id="next"]');
    if (g) { st.grade = Number(g.dataset.g); draw(); } else if (m) { st.mode = m.dataset.mode; draw(); } else if (c) { st.sel = st.sel === c.dataset.d ? '' : c.dataset.d; draw(); }
    else if (nav) { const i = st.months.indexOf(st.ym) + (nav.dataset.id === 'next' ? 1 : -1); if (st.months[i]) { st.ym = st.months[i]; st.sel = ''; draw(); } }
  });
  $('month').addEventListener('change', (e) => { st.ym = e.target.value; st.sel = ''; draw(); });
  return {
    state,
    /** v: readView 결과. emptyText: 달이 하나도 없을 때 안내. */
    show(v, { emptyText, foot, today } = {}) {
      st.view = v; st.months = monthList(v.year, v.months);
      if (!st.months.length) { state(emptyText || '아직 공개된 학사일정이 없어요. 학교에서 확정하면 여기에 나타나요.'); return; }
      $('title').textContent = `${v.year}학년도 학사일정`;
      const now = today || new Date(), cur = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      st.ym = st.months.includes(st.ym) ? st.ym : st.months.includes(cur) ? cur : st.months[0];
      $('foot').textContent = foot || '';
      state(''); draw();
    },
    setNotice(t) { $('notice').textContent = t || ''; $('notice').hidden = !t; }
  };
}
