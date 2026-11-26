// 학생·학부모 학사일정 화면(공개 화면과 앱 안 미리보기가 같이 쓴다). 교직원용과 같은 구성: [학사 계획](월별·1학기·2학기)과 [달력]. 교직원만 보는 내용(교직원 일정·창체·상태·석식/방과후)은 없다.
// 문서 또는 shadowRoot 안에 그린다. 아무것도 저장하지 않는다.
import { inMonth, monthList, filterItems, itemsOn, monthCells, planRows, semMonths, perRowFor, chunk, rangeText, mdText, gradeText, searchItems, icsOf, itemKey, defaultPicked } from './logic.js';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const SKELETON = `<header class="top"><div><div class="school">이대부속고등학교</div><h1 data-id="title">학사일정</h1></div></header>
<main>
  <p data-id="notice" class="notice" hidden></p>
  <div data-id="state" class="state" role="status">불러오는 중이에요…</div>
  <section data-id="view" hidden>
    <div class="bar">
      <div class="chips" data-id="tabs" role="tablist" aria-label="화면"><button type="button" data-tab="plan" aria-pressed="true">학사 계획</button><button type="button" data-tab="cal" aria-pressed="false">달력</button><button type="button" data-tab="find" aria-pressed="false">일정 검색</button></div>
      <div class="chips" data-id="grades" role="group" aria-label="학년"></div>
    </div>
    <div class="bar" data-id="pbar"><div class="chips" data-id="pmodes" role="group" aria-label="학사 계획 보기"></div></div>
    <div class="nav" data-id="nav"><button data-id="prev" type="button" aria-label="이전 달">‹</button><select data-id="month" aria-label="달 고르기"></select><button data-id="next" type="button" aria-label="다음 달">›</button></div>
    <p data-id="banner" class="notice" hidden></p>
    <div data-id="body"></div>
    <p class="foot" data-id="foot"></p>
  </section>
</main>`;

/** root(문서의 컨테이너 또는 shadowRoot 안의 요소)에 화면을 만들고 제어 함수를 돌려준다. opts.monthNote(ym) → {label, banner}: 달 목록에 덧붙일 말과 그 달 위 안내(미리보기에서 확정 전 달 표시용). */
export function mountPublic(root, opts = {}) {
  root.innerHTML = SKELETON;
  const $ = (id) => root.querySelector(`[data-id="${id}"]`);
  const st = { view: null, months: [], ym: '', grade: 0, tab: 'plan', pmode: 'month', sel: '', fq: '', fpast: true, today: '', picked: new Map() };
  const note = (ym) => (opts.monthNote ? opts.monthNote(ym) || {} : {});
  const width = () => root.clientWidth || root.getBoundingClientRect().width || (typeof innerWidth === 'number' ? innerWidth : 400);
  function state(msg) { $('state').textContent = msg; $('state').hidden = !msg; $('view').hidden = Boolean(msg); }
  const itemHtml = (x) => `<span class="pi ${x.kind}">${esc(x.title)}${gradeText(x.grades) ? ` <small>(${esc(gradeText(x.grades))})</small>` : ''}</span>`;
  const dayCls = (r) => [r.we ? 'we' : '', r.off ? 'hol' : ''].filter(Boolean).join(' ');
  const dowCls = (r) => (r.dow === 0 || r.off ? 'r' : r.dow === 6 ? 'b' : '');
  const monthTitle = (ym) => `${ym.slice(0, 4)}년 ${Number(ym.slice(5))}월`;

  function planMonth(items) {
    const rows = planRows(items, st.ym);
    return `<h2 class="ph">${esc(monthTitle(st.ym))} 학사 계획</h2><div class="pwrap"><table class="plan"><colgroup><col style="width:3.6em"><col style="width:2.6em"><col></colgroup><thead><tr><th>날짜</th><th>요일</th><th>학사 내용</th></tr></thead><tbody>${rows.map((r) => `<tr class="${dayCls(r)}"><td class="${dowCls(r)}">${Number(st.ym.slice(5))}/${r.day}</td><td class="${dowCls(r)}">${'일월화수목금토'[r.dow]}</td><td class="t">${r.items.map(itemHtml).join('')}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function planSem(items) {
    const ms = semMonths(st.months, st.pmode === 'sem2' ? 1 : 0), per = perRowFor(width());
    if (!ms.length) return '<div class="empty">이 학기에는 공개된 달이 아직 없어요.</div>';
    const byMonth = Object.fromEntries(ms.map((ym) => [ym, planRows(filterItems(inMonth(st.view.items, ym), st.grade), ym)]));
    return `<h2 class="ph">${st.view.year}학년도 ${st.pmode === 'sem2' ? 2 : 1}학기 학사 계획</h2>` + chunk(ms, per).map((grp) => `<div class="pwrap"><table class="plan"><colgroup>${grp.map(() => '<col style="width:2.5em"><col style="width:2.1em"><col>').join('')}</colgroup><thead><tr>${grp.map((ym) => `<th colspan="3" class="mh">${Number(ym.slice(5))}월${note(ym).label ? ` <small>${esc(note(ym).label)}</small>` : ''}</th>`).join('')}</tr></thead><tbody>${
      Array.from({ length: Math.max(...grp.map((ym) => byMonth[ym].length)) }, (_, i) => `<tr>${grp.map((ym) => { const r = byMonth[ym][i]; return r ? `<td class="${dayCls(r)} ${dowCls(r)}">${r.day}</td><td class="${dayCls(r)} ${dowCls(r)}">${'일월화수목금토'[r.dow]}</td><td class="t ${dayCls(r)}">${r.items.map(itemHtml).join('')}</td>` : '<td></td><td></td><td></td>'; }).join('')}</tr>`).join('')}</tbody></table></div>`).join('');
  }
  function calendar(items) {
    const cells = monthCells(st.ym);
    return `<div class="cal">${'일월화수목금토'.split('').map((x) => `<div class="dh">${x}</div>`).join('')}${cells.map(({ d, inMonth: inM }) => {
      const its = inM ? itemsOn(items, d) : [];
      return `<div class="dc ${inM ? '' : 'out'} ${st.sel === d ? 'sel' : ''}" data-d="${d}"><span class="dn">${Number(d.slice(8))}</span>${its.slice(0, 3).map((x) => `<span class="ev ${x.kind}">${esc(x.title)}</span>`).join('')}${its.length > 3 ? `<span class="ev">+${its.length - 3}</span>` : ''}</div>`;
    }).join('')}</div>${st.sel ? detail(items) : '<p class="foot">날짜를 누르면 그날의 일정을 자세히 볼 수 있어요.</p>'}`;
  }
  function detail(items) {
    const its = itemsOn(items, st.sel);
    return `<div class="detail"><b>${esc(mdText(st.sel))}</b>${its.length ? its.map((x) => `<div>${esc(x.title)}${x.startsOn !== x.endsOn ? ` <span class="tag">${esc(rangeText(x.startsOn, x.endsOn))}</span>` : ''}${gradeText(x.grades) ? `<span class="tag">${esc(gradeText(x.grades))}</span>` : ''}</div>`).join('') : '<div class="foot">등록된 일정이 없어요.</div>'}</div>`;
  }
  const todayStr = () => st.today || (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`; })();
  const findList = () => searchItems(st.view.items, { q: st.fq, grade: st.grade, hidePast: st.fpast, today: todayStr() });
  const isPicked = (x) => (st.picked.has(itemKey(x)) ? st.picked.get(itemKey(x)) : defaultPicked(x));
  function findShell() {
    $('body').innerHTML = `<div class="find"><div class="ftools"><input type="search" data-id="fq" placeholder="검색어 입력 (예: 고사, 방학, 체육대회)" value="${esc(st.fq)}" aria-label="일정 검색"><label class="fck"><input type="checkbox" data-id="fpast" ${st.fpast ? 'checked' : ''}> 지난 일정 숨기기</label></div><div class="ftools"><button type="button" class="fbtn" data-id="fall">모두 선택</button><button type="button" class="fbtn" data-id="fnone">모두 해제</button><button type="button" class="fbtn fmain" data-id="fics">체크한 일정을 내 달력에 담기(.ics)</button></div><p class="foot">체크한 일정만 내 달력에 들어가요. 삼일절·추석 같은 공휴일은 휴대폰 달력에 이미 있어서 처음부터 빼 두었어요(필요하면 체크).</p><div data-id="fres"></div></div>`;
    findDraw();
  }
  function findDraw() {
    const list = findList(), by = {};
    list.forEach((x) => (by[x.startsOn.slice(0, 7)] ||= []).push(x));
    $('fres').innerHTML = list.length ? Object.keys(by).sort().map((k) => `<div class="fmh">${k.slice(0, 4)}년 ${Number(k.slice(5))}월</div><ul class="list">${by[k].map((x) => `<li class="${x.kind}"><label class="fi"><input type="checkbox" data-fp="${esc(itemKey(x))}" ${isPicked(x) ? 'checked' : ''}><span class="d">${esc(rangeText(x.startsOn, x.endsOn))}</span><span class="t">${esc(x.title)}${gradeText(x.grades) ? `<span class="tag">${esc(gradeText(x.grades))}</span>` : ''}</span></label></li>`).join('')}</ul>`).join('') : '<div class="empty">찾은 일정이 없어요.</div>';
    findCount();
  }
  function findCount() {
    const n = findList().filter(isPicked).length, btn = $('fics');
    if (btn) { btn.disabled = !n; btn.textContent = n ? `체크한 일정 ${n}개를 내 달력에 담기(.ics)` : '체크한 일정을 내 달력에 담기(.ics)'; }
  }
  function downloadIcs() {
    const list = findList().filter(isPicked); if (!list.length) return;
    const blob = new Blob([icsOf(list)], { type: 'text/calendar' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `${st.view.year}학년도 학사일정.ics`; (root.ownerDocument || document).body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function draw() {
    root.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tab === st.tab)));
    $('grades').innerHTML = [[0, '전체'], [1, '1학년'], [2, '2학년'], [3, '3학년']].map(([g, l]) => `<button type="button" data-g="${g}" aria-pressed="${st.grade === g}">${l}</button>`).join('');
    const isFind = st.tab === 'find', sem = st.tab === 'plan' && st.pmode !== 'month';
    $('pbar').hidden = st.tab !== 'plan';
    $('pmodes').innerHTML = [['month', '월별'], ['sem1', '1학기'], ['sem2', '2학기']].map(([k, l]) => `<button type="button" data-pm="${k}" aria-pressed="${st.pmode === k}">${l}</button>`).join('');
    $('nav').hidden = sem || isFind;
    $('month').innerHTML = st.months.map((m) => `<option value="${m}" ${m === st.ym ? 'selected' : ''}>${m.slice(0, 4)}년 ${Number(m.slice(5))}월${note(m).label ? ` · ${esc(note(m).label)}` : ''}</option>`).join('');
    const i = st.months.indexOf(st.ym); $('prev').disabled = i <= 0; $('next').disabled = i >= st.months.length - 1;
    const bn = sem || isFind ? '' : note(st.ym).banner; $('banner').hidden = !bn; $('banner').textContent = bn || '';
    if (isFind) { findShell(); return; }
    const items = filterItems(inMonth(st.view.items, st.ym), st.grade);
    $('body').innerHTML = st.tab === 'cal' ? calendar(items) : sem ? planSem() : planMonth(items);
  }
  root.addEventListener('click', (e) => {
    const g = e.target.closest('[data-g]'), t = e.target.closest('[data-tab]'), pm = e.target.closest('[data-pm]'), c = e.target.closest('.dc[data-d]'), nav = e.target.closest('[data-id="prev"],[data-id="next"]');
    if (e.target.closest('[data-id="fics"]')) { downloadIcs(); return; }
    if (e.target.closest('[data-id="fall"]') || e.target.closest('[data-id="fnone"]')) { const on = Boolean(e.target.closest('[data-id="fall"]')); findList().forEach((x) => st.picked.set(itemKey(x), on)); findDraw(); return; }
    if (g) { st.grade = Number(g.dataset.g); draw(); } else if (t) { st.tab = t.dataset.tab; draw(); } else if (pm) { st.pmode = pm.dataset.pm; draw(); }
    else if (c) { st.sel = st.sel === c.dataset.d ? '' : c.dataset.d; draw(); }
    else if (nav) { const k = st.months.indexOf(st.ym) + (nav.dataset.id === 'next' ? 1 : -1); if (st.months[k]) { st.ym = st.months[k]; st.sel = ''; draw(); } }
  });
  root.addEventListener('input', (e) => { if (e.target.matches && e.target.matches('[data-id="fq"]')) { st.fq = e.target.value; findDraw(); } });
  root.addEventListener('change', (e) => {
    if (e.target.matches && e.target.matches('[data-id="fpast"]')) { st.fpast = e.target.checked; findDraw(); }
    else if (e.target.matches && e.target.matches('[data-fp]')) { st.picked.set(e.target.dataset.fp, e.target.checked); findCount(); }
  });
  $('month').addEventListener('change', (e) => { st.ym = e.target.value; st.sel = ''; draw(); });
  if (typeof addEventListener === 'function') addEventListener('resize', () => { if (st.view && st.tab === 'plan' && st.pmode !== 'month') draw(); });
  return {
    state,
    /** v: readView 결과. */
    show(v, { emptyText, foot, today } = {}) {
      st.view = v; st.months = monthList(v.year, v.months); st.today = today ? `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}` : '';
      if (!st.months.length) { state(emptyText || '아직 공개된 학사일정이 없어요. 학교에서 확정하면 여기에 나타나요.'); return; }
      $('title').textContent = `${v.year}학년도 학사일정`;
      const now = today || new Date(), cur = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      st.ym = st.months.includes(st.ym) ? st.ym : st.months.includes(cur) ? cur : st.months[0];
      $('foot').textContent = foot || '';
      state(''); draw();
    },
    setNotice(t) { $('notice').textContent = t || ''; $('notice').hidden = !t; },
    /** 시험용: 지금 상태 */
    get state() { return st; }
  };
}
