// 학생·학부모용 공개 학사일정. 링크의 # 뒤(서버 주소·공개 키·열쇠)로 읽기 전용 함수 하나만 부른다. 아무것도 저장하지 않는다.
import { parseLink, buildRequest, readView, explain, REQUEST_TIMEOUT_MS } from './logic.js';
import { mountPublic } from './render.js';
const ui = mountPublic(document.getElementById('app'));

async function load() {
  const cfg = parseLink(location.hash);
  if (!cfg) { ui.state('학교에서 받은 링크로 열어 주세요.'); return; }
  const req = buildRequest(cfg), ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), REQUEST_TIMEOUT_MS);
  let v;
  try {
    const res = await fetch(req.url, { ...req.init, signal: ctl.signal });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(JSON.stringify(body ?? {}));
    v = readView(body);
    if (!v) throw new Error('bad');
  } catch (e) { ui.state(explain(e)); return; } finally { clearTimeout(timer); }
  const at = v.confirmedAt ? new Date(v.confirmedAt) : null;
  ui.show(v, { foot: `교무에서 확정한 달만 보여요${at && !isNaN(at) ? ` · 마지막 확정 ${at.getFullYear()}. ${at.getMonth() + 1}. ${at.getDate()}.` : ''}` });
}
load();
