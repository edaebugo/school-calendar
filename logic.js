// 학생·학부모용 학사일정 화면의 순수 로직(화면 없음). 브라우저와 시험이 같이 쓴다. 이 화면은 아무것도 저장하지 않는다.
export const REQUEST_TIMEOUT_MS = 10000;
const DOW = '일월화수목금토';
export const dowName = (d) => DOW[new Date(`${d}T00:00:00Z`).getUTCDay()];
const addDays = (d, n) => { const t = new Date(`${d}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const pad = (n) => String(n).padStart(2, '0');

/** 링크의 # 뒤 글자 → {url, key, token}. 서버 주소는 https(시험용으로 localhost만 http)여야 하고, 열쇠 모양이 틀리면 null. */
export function parseLink(hash) {
  const p = new URLSearchParams(String(hash ?? '').replace(/^#/, ''));
  const url = p.get('u') ?? '', key = p.get('k') ?? '', token = p.get('t') ?? '';
  let origin;
  try { const u = new URL(url); if (u.username || u.password || u.search || u.hash || u.pathname !== '/') return null; if (!(u.protocol === 'https:' || (u.protocol === 'http:' && /^(localhost|127\.0\.0\.1)$/.test(u.hostname)))) return null; origin = u.origin; } catch { return null; }
  if (!/^[A-Za-z0-9._-]{10,500}$/.test(key) || !/^[0-9a-f]{64}$/.test(token)) return null;
  return { url: origin, key, token };
}
/** PostgREST 호출 모양. 새 형식의 공개 키는 JWT가 아니므로 apikey 머리글에만 넣는다. */
export function buildRequest(cfg) {
  return { url: `${cfg.url}/rest/v1/rpc/calendar_public_view`, init: { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: cfg.key, 'Content-Profile': 'api', 'Accept-Profile': 'api' }, body: JSON.stringify({ p_token: cfg.token }), redirect: 'error', cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' } };
}
/** 서버 응답 → 화면 자료. 모양이 이상하면 null. */
export function readView(v) {
  if (!v || typeof v !== 'object' || !Number.isInteger(v.schoolYear) || !Array.isArray(v.months) || !Array.isArray(v.items)) return null;
  const items = v.items.filter((x) => x && Number.isInteger(x.m) && x.m >= 1 && x.m <= 12 && /^\d{4}-\d{2}-\d{2}$/.test(x.startsOn) && /^\d{4}-\d{2}-\d{2}$/.test(x.endsOn) && typeof x.title === 'string' && x.title).map((x) => ({ m: x.m, startsOn: x.startsOn, endsOn: x.endsOn, title: x.title, kind: x.kind === 'holiday' || x.kind === 'no_class' ? 'off' : 'event', grades: Array.isArray(x.grades) ? x.grades.filter((g) => g >= 1 && g <= 3) : [] }));
  return { year: v.schoolYear, months: v.months.filter((m) => Number.isInteger(m) && m >= 1 && m <= 12), items, notice: '', confirmedAt: v.confirmedAt ?? null };
}
/** 확정된 달을 학년도 순서(3월~다음 해 2월)로 'YYYY-MM' 목록으로 */
export function monthList(year, months) {
  return [...new Set(months)].sort((a, b) => ((a + 9) % 12) - ((b + 9) % 12)).map((m) => `${m >= 3 ? year : year + 1}-${pad(m)}`);
}
/** 그 달 확정본에서 온 일정만(교무가 달마다 따로 확정하므로 달마다 내용이 다를 수 있다) */
export const inMonth = (items, ym) => items.filter((x) => x.m === Number(ym.slice(5, 7)));
/** 학년 보기(0=전체, 1~3): 학년 표시가 없거나 세 학년 모두면 모든 학년, 아니면 그 학년이 들어 있을 때 */
export const forGrade = (item, grade) => !grade || !item.grades.length || item.grades.length === 3 || item.grades.includes(grade);
export const filterItems = (items, grade) => items.filter((x) => forGrade(x, grade));
export const itemsOn = (items, d) => items.filter((x) => x.startsOn <= d && d <= x.endsOn);
const daysIn = (ym) => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate();
/** 달력 칸(일~토, 앞뒤 빈 칸 포함): [{d, inMonth}] */
export function monthCells(ym) {
  const first = `${ym}-01`, pre = new Date(`${first}T00:00:00Z`).getUTCDay(), n = daysIn(ym), cells = [];
  for (let i = -pre; cells.length % 7 || i < n; i++) { const d = addDays(first, i); cells.push({ d, inMonth: d.startsWith(ym) }); }
  return cells;
}
/** 목록 보기: 그 달에 걸친 일정(여러 날은 한 번만), 시작일 순 */
export function monthItems(items, ym) {
  const a = `${ym}-01`, b = `${ym}-${pad(daysIn(ym))}`;
  return items.filter((x) => x.startsOn <= b && x.endsOn >= a).sort((x, y) => x.startsOn.localeCompare(y.startsOn) || x.title.localeCompare(y.title, 'ko'));
}
export const mdText = (d) => `${Number(d.slice(5, 7))}/${Number(d.slice(8))}(${dowName(d)})`;
export const rangeText = (a, b) => (a === b ? mdText(a) : `${mdText(a)} ~ ${mdText(b)}`);
export const gradeText = (g) => (!g.length || g.length === 3 ? '' : `${g.join('·')}학년`);
/** 오류 → 사용자에게 보여 줄 한 가지 문구(자세한 이유는 알리지 않는다) */
export function explain(err) {
  const m = String(err?.message ?? err ?? '');
  if (/CALENDAR_PUBLIC_NOT_FOUND/.test(m)) return '열 수 없는 링크예요. 학교에서 새 링크를 받아 주세요.';
  return '지금은 학사일정을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.';
}

/* ---- 앱 안 미리보기용: 서버(api.calendar_public_view)와 같은 규칙으로 일정 걸러내기 ----
   학사 내용 줄만: 교직원 전용·창체·요일 변경·숨김·진도 제외 표시·상태 이름만 있는 하루짜리 일정(공백·대소문자 무시)은 뺀다. */
const STATUS_TITLES = new Set(['휴업', '행사(neis제외)', '행사(neis포함)', '진도제외', '중간고사', '기말고사', '요일변경']);
export function isPublicEvent(e) {
  if (!e || e.hidden || e.staffOnly || e.category || (e.appliedWeekday != null && e.appliedWeekday !== '')) return false;
  if (e.dayStatus === 'progress_off') return false;
  const title = String(e.title ?? '').trim();
  if (!title) return false;
  if (STATUS_TITLES.has(title.replace(/\s+/g, '').toLowerCase()) && e.startsOn === e.endsOn) return false;
  return true;
}
/** 앱의 일정 목록 → 공개 화면 자료(readView가 읽는 모양). months: 보여 줄 달(숫자), 달마다 그 달에 걸친 일정을 'm'과 함께 담는다. */
export function previewView(events, year, months) {
  const items = [];
  const pub = events.filter(isPublicEvent);
  for (const m of months) {
    const ym = `${m >= 3 ? year : year + 1}-${pad(m)}`, a = `${ym}-01`, b = `${ym}-${pad(daysIn(ym))}`;
    for (const e of pub) if (e.startsOn <= b && e.endsOn >= a) items.push({ m, startsOn: e.startsOn, endsOn: e.endsOn, title: String(e.title).trim(), kind: e.kind, grades: e.grades || [] });
  }
  return { schoolYear: year, months: [...months], items, confirmedAt: null };
}

/* ---- 학사 계획(교직원용과 같은 구성: 날짜·요일·학사 내용) ---- */
/** 학기 구분: 3~7월 = 1학기(0), 그 밖 = 2학기(1) */
export const semOfMonth = (m) => (m >= 3 && m <= 7 ? 0 : 1);
export const semMonths = (ymList, sem) => ymList.filter((ym) => semOfMonth(Number(ym.slice(5, 7))) === sem);
/** 한 달의 날짜 줄: [{d, day, dow, we(주말), items:[...]}]. items는 그 달 확정본에서 온 일정(학년 보기 적용)이고 휴업·공휴일이 있으면 off=true */
export function planRows(items, ym) {
  const n = daysIn(ym), rows = [];
  for (let i = 1; i <= n; i++) {
    const d = `${ym}-${pad(i)}`, dow = new Date(`${d}T00:00:00Z`).getUTCDay(), its = itemsOn(items, d);
    rows.push({ d, day: i, dow, we: dow === 0 || dow === 6, off: its.some((x) => x.kind === 'off'), items: its });
  }
  return rows;
}
/** 학기 보기에서 한 줄에 놓을 달 수(화면 폭 px): 좁으면 1, 넓으면 최대 4 */
export const perRowFor = (w) => (w < 560 ? 1 : w < 820 ? 2 : w < 1100 ? 3 : 4);
export const chunk = (list, size) => { const out = []; for (let i = 0; i < list.length; i += Math.max(1, size)) out.push(list.slice(i, i + size)); return out; };

/* ---- 일정 검색(교직원용과 같은 구성: 검색어·지난 일정 숨기기·내 달력에 담기). 교직원에게만 필요한 것은 없다. ---- */
/** 달마다 따로 온 일정을 합쳐 같은 일정은 한 번만, 시작일 순으로 */
export function uniqueItems(items) {
  const seen = new Map();
  for (const x of items) { const k = [x.startsOn, x.endsOn, x.title, x.grades.join()].join('|'); if (!seen.has(k)) seen.set(k, x); }
  return [...seen.values()].sort((a, b) => a.startsOn.localeCompare(b.startsOn) || a.title.localeCompare(b.title, 'ko'));
}
/** 검색: 제목에 검색어(공백 무시)가 들어 있고, 학년 보기에 맞고, 지난 일정 숨기기면 끝난 일정은 뺀다. today는 'YYYY-MM-DD' */
export function searchItems(items, { q = '', grade = 0, hidePast = false, today = '' } = {}) {
  const t = String(q || '').toLowerCase().replace(/\s+/g, '');
  return uniqueItems(items).filter((x) => forGrade(x, grade) && (!t || x.title.toLowerCase().replace(/\s+/g, '').includes(t)) && (!hidePast || x.endsOn >= today));
}
const icsEsc = (v) => String(v).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const ymd = (d) => d.replace(/-/g, '');
/** RFC 5545 줄 접기: 한 줄은 75옥텟(UTF-8 바이트)까지, 넘으면 CRLF+공백으로 이어 쓴다(글자 중간을 자르지 않는다) */
export function foldIcs(line) {
  const enc = new TextEncoder(); if (enc.encode(line).length <= 75) return line;
  const out = []; let cur = '', bytes = 0, limit = 75;
  for (const ch of line) { const n = enc.encode(ch).length; if (bytes + n > limit) { out.push(cur); cur = ''; bytes = 0; limit = 74; } cur += ch; bytes += n; }
  out.push(cur); return out.join('\r\n ');
}
const hash36 = (s) => { let h = 5381; for (const c of s) h = ((h << 5) + h + c.codePointAt(0)) >>> 0; return h.toString(36); };
/** 달력 파일(.ics): 하루 종일 일정. UID는 날짜·제목으로 정해 검색 조건이 바뀌어도 같은 일정은 같은 값이다. now는 'YYYYMMDDTHHMMSSZ'(시험용으로 받는다) */
export function icsOf(list, { now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '') } = {}) {
  const out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//이대부속고등학교//학사일정//KO', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:이대부속고등학교 학사일정'], seen = new Map();
  for (const x of list) {
    const g = gradeText(x.grades), end = new Date(`${x.endsOn}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + 1);
    const key = `${x.startsOn}|${x.endsOn}|${x.title}|${x.grades.join()}`, n = seen.get(key) ?? 0; seen.set(key, n + 1);
    out.push('BEGIN:VEVENT', `UID:${ymd(x.startsOn)}-${hash36(key)}${n ? `-${n}` : ''}@school-calendar`, `DTSTAMP:${now}`, `DTSTART;VALUE=DATE:${ymd(x.startsOn)}`, `DTEND;VALUE=DATE:${ymd(end.toISOString().slice(0, 10))}`, `SUMMARY:${icsEsc(g ? `${x.title} (${g})` : x.title)}`, 'END:VEVENT');
  }
  out.push('END:VCALENDAR');
  return out.map(foldIcs).join('\r\n') + '\r\n';
}
