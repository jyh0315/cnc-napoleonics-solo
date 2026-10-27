/* ===================== RENDER: BOARD ===================== */
const NAT_COL = {F: '#26448c', B: '#b3302a', P: '#7a5231', A: '#8f6a2c'};
const CLS_COL = {inf: '#5b8fd8', cav: '#e2bd2f', art: '#d2443a'};
const SIDE_COL = {B: '#c4362c', F: '#2c56b0'};
const T_FILL = {clear: '#ebe4cd', forest: '#a8bd83', hill: '#c9c88b', rugged: '#b2a487', town: '#e4d9bb', river: '#4b7aa8', stream: '#79a5cd', brook: '#8db6da', bridge: '#79a5cd', fw: '#d4cba7', quarry: '#e7d6a3'};
const W = PADX * 2 + HW * 13, H = PADY * 2 + HS * 2 + 8 * 1.5 * HS;
function hexPts(cx, cy, s) { let p = ''; for (let i = 0; i < 6; i++) { const a = Math.PI / 180 * (60 * i - 30); p += `${(cx + s * Math.cos(a)).toFixed(1)},${(cy + s * Math.sin(a)).toFixed(1)} `; } return p; }
function starPts(cx, cy, R, r) { let p = ''; for (let i = 0; i < 10; i++) { const rad = i % 2 ? r : R, a = Math.PI / 5 * i - Math.PI / 2; p += `${(cx + rad * Math.cos(a)).toFixed(1)},${(cy + rad * Math.sin(a)).toFixed(1)} `; } return p; }
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const DEFS = `<defs>
 <g id="d-forest"><circle cx="-11" cy="-6" r="7" fill="#4d7a3c"/><circle cx="3" cy="-12" r="8" fill="#3e6a33"/><circle cx="13" cy="-2" r="7" fill="#567f40"/><circle cx="-4" cy="6" r="8" fill="#3a6230"/><circle cx="10" cy="11" r="6" fill="#4b7439"/><circle cx="-14" cy="9" r="5" fill="#5f8645"/><circle cx="3" cy="-12" r="3" fill="#68924c"/><circle cx="-4" cy="6" r="3" fill="#56803f"/></g>
 <g id="d-hill" fill="none" stroke="#8f8c4c" stroke-width="1.1" opacity=".75"><ellipse rx="22" ry="15"/><ellipse rx="14" ry="9" stroke="#7d7a40"/><ellipse rx="6" ry="4" stroke="#6e6b36"/></g>
 <g id="d-rugged"><polygon points="-16,6 -9,-8 -2,4" fill="#8b7d63"/><polygon points="-4,8 5,-12 14,8" fill="#7a6d55"/><polygon points="6,12 12,2 19,12" fill="#94876c"/><polygon points="-20,14 -14,4 -8,14" fill="#857760"/><circle cx="-6" cy="-14" r="1.6" fill="#6b604b"/><circle cx="17" cy="-8" r="1.4" fill="#6b604b"/><circle cx="0" cy="14" r="1.4" fill="#6b604b"/></g>
 <g id="d-town"><rect x="-15" y="-13" width="10" height="7" fill="#8e4f2d"/><rect x="2" y="-15" width="12" height="8" fill="#9a5a33"/><rect x="-17" y="2" width="9" height="9" fill="#7e4527"/><rect x="-3" y="-2" width="8" height="7" fill="#a5643a"/><rect x="7" y="4" width="10" height="8" fill="#8a4c2b"/><path d="M-22 -1 H22 M0 -20 V20" stroke="#cbbf9b" stroke-width="3"/></g>
 <g id="d-water" fill="none" stroke="#d9e8f4" stroke-width="1.4" opacity=".8"><path d="M-22 -6 q5 -4 10 0 t10 0 t10 0 t10 0"/><path d="M-20 6 q5 -4 10 0 t10 0 t10 0 t10 0"/></g>
 <g id="d-bridge"><rect x="-8" y="-24" width="16" height="48" fill="#6f5338"/><path d="M-8 -16 H8 M-8 -8 H8 M-8 0 H8 M-8 8 H8 M-8 16 H8" stroke="#4b3825" stroke-width="1.2"/></g>
 <g id="d-fw"><path d="M-27 10 L0 24 L27 10" fill="none" stroke="#6b4627" stroke-width="5" stroke-linejoin="round"/><path d="M-27 10 L0 24 L27 10" fill="none" stroke="#a87a4a" stroke-width="1.5" stroke-dasharray="3 3"/></g>
 <g id="d-quarry" fill="#b49655"><circle cx="-10" cy="-6" r="1.6"/><circle cx="4" cy="-10" r="1.4"/><circle cx="12" cy="2" r="1.8"/><circle cx="-4" cy="8" r="1.6"/><circle cx="-14" cy="6" r="1.2"/><circle cx="6" cy="12" r="1.4"/><path d="M-18 -2 q18 -14 36 0" fill="none" stroke="#a88a4c" stroke-width="2"/></g>
</defs>`;
function renderBoard() {
  const svg = document.getElementById('board'); if (!svg || !state) return;
  const d = effDef(); const act = state.active;
  const sel = ui.sel; const selU = sel && sel.type === 'u' ? unitById(sel.id) : null; const selL = sel && sel.type === 'l' ? leaderById(sel.id) : null;
  let moveSet = null, tgtMap = null;
  if (!ui.edit && !ui.picking && NET.myTurn && state.phase === 'move') { if (selU && selU.ordered && !selU.moved && selU.side === act) moveSet = reachUnit(selU, moveAllow(selU)); if (selL && selL.ordered && !selL.moved && selL.side === act) moveSet = reachLeader(selL, d && d.k === 'gm' ? 4 : 3); }
  if (!ui.edit && !ui.picking && NET.myTurn && state.phase === 'battle' && selU && selU.side === act) tgtMap = targetsFor(selU);
  let s = DEFS;
  s += `<rect x="0" y="0" width="${W}" height="${H}" rx="10" fill="#cdbf98"/>`;
  // bands
  const bandY = [6, H - PADY + 6];
  s += `<rect x="${PADX}" y="${bandY[0]}" width="${W - 2 * PADX}" height="${PADY - 12}" rx="6" fill="#efe6cc" opacity=".55"/>`;
  s += `<rect x="${PADX}" y="${bandY[1]}" width="${W - 2 * PADX}" height="${PADY - 12}" rx="6" fill="#efe6cc" opacity=".55"/>`;
  const x1 = PADX + HW * 4, x2 = PADX + HW * 9;
  const secLab = (y, side) => { const L = side === 'F' ? '좌측' : '우측', R = side === 'F' ? '우측' : '좌측'; const nm = side === 'B' ? '영국' : '프랑스';
    return `<text class="seclab" x="${(PADX + x1) / 2}" y="${y}">${nm} ${L}</text><text class="seclab" x="${(x1 + x2) / 2 - 70}" y="${y}">중앙</text><text class="seclab" x="${(x2 + W - PADX) / 2}" y="${y}">${nm} ${R}</text>`; };
  s += `<g class="band"><rect x="${(x1 + x2) / 2 - 40}" y="${bandY[0] + 2}" width="80" height="18" rx="9" fill="${SIDE_COL.B}"/><text x="${(x1 + x2) / 2}" y="${bandY[0] + 15}" class="bandname">BRITISH</text>${secLab(bandY[0] + 15, 'B')}</g>`;
  s += `<g class="band"><rect x="${(x1 + x2) / 2 - 40}" y="${bandY[1] + 2}" width="80" height="18" rx="9" fill="${SIDE_COL.F}"/><text x="${(x1 + x2) / 2}" y="${bandY[1] + 15}" class="bandname">FRENCH</text>${secLab(bandY[1] + 15, 'F')}</g>`;
  // 카드로 명령 가능한 구역 표시
  if (d && d.sec && ['order'].includes(state.phase)) {
    const allowed = Object.keys(state.cur.sec);
    const scr = {L: act === 'F' ? 'l' : 'r', R: act === 'F' ? 'r' : 'l', C: 'c'};
    const rng = {l: [PADX, x1], c: [x1, x2], r: [x2, W - PADX]};
    allowed.forEach(a => { const [a1, a2] = rng[scr[a]]; s += `<rect x="${a1}" y="${PADY}" width="${a2 - a1}" height="${H - 2 * PADY}" fill="#f2c14e" opacity=".13"/>`; });
  }
  // hexes
  let deco = '', names = '';
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < ncols(r); c++) {
    const k = K(r, c), [cx, cy] = ctr(r, c); const raw = rawT(k), t = effT(k);
    const fill = raw === 'bridge' ? T_FILL.bridge : (T_FILL[t] || T_FILL.clear);
    s += `<polygon class="hex t-${t}" data-k="${k}" points="${hexPts(cx, cy, HS - 0.6)}" fill="${fill}"/>`;
    const use = {forest: 'd-forest', hill: 'd-hill', rugged: 'd-rugged', town: 'd-town', quarry: 'd-quarry', fw: 'd-hill'}[raw];
    if (use) deco += `<use href="#${use}" x="${cx}" y="${cy}"/>`;
    if (raw === 'river' || raw === 'bridge') deco += `<use href="#d-water" x="${cx}" y="${cy}"/>`;
    if (raw === 'bridge') deco += `<use href="#d-bridge" x="${cx}" y="${cy}"/>`;
    if (raw === 'fw') deco += `<use href="#d-fw" x="${cx}" y="${cy}"/>`;
    if (state.names[k]) names += `<text class="pname" x="${cx}" y="${cy + HS - 9}">${esc(state.names[k])}</text>`;
  }
  s += `<g class="deco" pointer-events="none">${deco}</g>`;
  s += `<line x1="${x1}" y1="${PADY - 4}" x2="${x1}" y2="${H - PADY + 4}" class="secline"/><line x1="${x2}" y1="${PADY - 4}" x2="${x2}" y2="${H - PADY + 4}" class="secline"/>`;
  s += `<g pointer-events="none">${names}</g>`;
  // objectives
  state.objs.forEach((o, i) => o.hexes.forEach(k => { const [cx, cy] = ctr(...P(k)); const held = state.held[i];
    s += `<g pointer-events="none" transform="translate(${cx - 24},${cy - 30})"><path d="M0 0 V20" stroke="#3a2f1e" stroke-width="1.6"/><path d="M0 1 H17 L13 6 L17 11 H0 Z" fill="${SIDE_COL[o.side]}" stroke="#fff" stroke-width=".8" opacity="${held ? 1 : .75}"/>${held ? '<circle cx="20" cy="4" r="3.5" fill="#f2c14e" stroke="#3a2f1e" stroke-width=".8"/>' : ''}</g>`; }));
  // overlays
  const over = (k, cls) => { const [cx, cy] = ctr(...P(k)); return `<polygon class="ov ${cls}" data-k="${k}" points="${hexPts(cx, cy, HS - 3)}"/>`; };
  if (moveSet) moveSet.forEach((n, k) => s += over(k, 'ov-move'));
  if (tgtMap) tgtMap.forEach((kind, k) => s += over(k, kind === 'fire' ? 'ov-fire' : 'ov-melee'));
  if (!ui.edit && !ui.picking && !ui.busy && !state.winner && NET.myTurn) {
    if (state.phase === 'order' && !(d && (d.k === 'rally'))) state.units.forEach(u => { if (u.side === act && !u.ordered && !tryOrder(u, false)) s += over(hexOf(u), 'ov-elig'); });
    if (state.phase === 'order' && d && d.k === 'rally' && state.tokens) state.units.forEach(u => { if (u.side === act && u.blocks < st(u).max && state.tokens[st(u).cls] > 0) s += over(hexOf(u), 'ov-elig'); });
    if (state.phase === 'battle') state.units.forEach(u => { if (u.side === act && u !== selU && targetsFor(u).size) s += over(hexOf(u), 'ov-ready'); });
  }
  if (ui.picking) ui.picking.cands.forEach(k => s += over(k, 'ov-pick'));
  if (ui.edit && ui.editSel) s += over(ui.editSel, 'ov-sel');
  // units
  state.units.forEach(u => s += unitSvg(u, selU === u));
  state.leaders.forEach(l => { if (!unitAt(hexOf(l))) s += loneLeaderSvg(l, selL === l); });
  svg.setAttribute('viewBox', `0 0 ${W.toFixed(0)} ${H.toFixed(0)}`);
  svg.innerHTML = s;
}
function unitSvg(u, selected) {
  const [cx, cy] = ctr(u.r, u.c); const s = st(u); const ws = 44, hs = 30, x = -ws / 2, y = -hs / 2 + 2;
  let g = `<g class="unit${u.ordered ? ' ordered' : ''}${selected ? ' selected' : ''}" data-k="${hexOf(u)}" data-id="${u.id}" transform="translate(${cx},${cy})">`;
  if (u.square) g += `<rect x="${x - 4}" y="${y - 4}" width="${ws + 8}" height="${hs + 8}" rx="3" fill="none" stroke="#ffd84a" stroke-width="2.6" stroke-dasharray="4 2"/>`;
  g += `<rect x="${x}" y="${y}" width="${ws}" height="${hs}" rx="3" fill="${NAT_COL[u.nat]}" class="ubody"/>`;
  g += `<rect x="${x}" y="${y}" width="${ws}" height="5" rx="2" fill="${CLS_COL[s.cls]}"/>`;
  if (u.nat === 'A') g += `<path d="M${x + ws - 8} ${y + 5} L${x + ws} ${y + 5} L${x + ws} ${y + 13} Z" fill="#f0b23a"/>`;
  g += `<text class="uab" x="0" y="${y + 17}">${s.ab}</text>`;
  const pw = 5, gap = 2, tot = s.max * pw + (s.max - 1) * gap; let px = -tot / 2;
  for (let i = 0; i < s.max; i++) { g += `<rect x="${px}" y="${y + 21}" width="${pw}" height="${pw}" fill="${i < u.blocks ? '#fff' : 'none'}" stroke="#fff" stroke-width=".8"/>`; px += pw + gap; }
  if (u.square) g += `<text class="sqtag" x="${x + ws + 1}" y="${y - 3}">방진</text>`;
  if (u.side === state.active && u.ordered) {
    if (u.moved) g += `<circle cx="${x + ws - 2}" cy="${y + hs - 2}" r="5" fill="#f2c14e"/><text class="mk" x="${x + ws - 2}" y="${y + hs + 1}">${u.moved}</text>`;
    if (u.battled) g += `<circle cx="${x + 2}" cy="${y + hs - 2}" r="5" fill="#2a2a2a"/><text class="mk w" x="${x + 2}" y="${y + hs + 1}">✕</text>`;
  }
  if (u.ssTurn === state.turn) g += `<text class="sstag" x="0" y="${y - 4}">보급부족</text>`;
  const l = attLeader(u);
  if (l) g += `<polygon points="${starPts(x + 2, y + 1, 9, 4)}" fill="${SIDE_COL[l.side]}" stroke="${l.ordered ? '#f2c14e' : '#fff'}" stroke-width="${l.ordered ? 2.2 : 1.2}"/>`;
  return g + '</g>';
}
function loneLeaderSvg(l, selected) {
  const [cx, cy] = ctr(l.r, l.c);
  return `<g class="leader${l.ordered ? ' ordered' : ''}${selected ? ' selected' : ''}" data-k="${hexOf(l)}" data-id="${l.id}" transform="translate(${cx},${cy})"><polygon points="${starPts(0, -4, 14, 6)}" fill="${SIDE_COL[l.side]}" stroke="${l.ordered ? '#f2c14e' : '#fff'}" stroke-width="${l.ordered ? 2.6 : 1.5}"/><text class="lname" x="0" y="20">${esc(l.name)}</text></g>`;
}

/* ===================== RENDER: SIDE PANEL ===================== */
const PHASES = [['start', '준비'], ['pre', '선행 카드'], ['card', '카드'], ['order', '명령'], ['move', '이동'], ['battle', '전투'], ['end', '정리'], ['scout', '정찰']];
function cardHtml(k, opts = {}) {
  const d = CARD_BY_KEY[k];
  let diag = '';
  if (d.sec) diag = `<div class="cc-sec">${['L', 'C', 'R'].map(s => `<span class="${d.sec[s] ? 'on' : ''}">${SEC_KO[s]}<b>${d.sec[s] ? (d.sec[s] === 'cmd' ? '지휘' : d.sec[s]) : '–'}</b></span>`).join('')}</div>`;
  return `<button class="ccard ${d.sec ? 'sec' : 'tac'}${opts.sel ? ' sel' : ''}${opts.dis ? ' dis' : ''}${d.pre ? ' pre' : ''}" ${opts.attr || ''} ${opts.dis ? 'disabled' : ''}>
    <span class="cc-kind">${d.sec ? '구역 카드' : '전술 카드'}${d.lead ? ' · 리더' : ''}</span><span class="cc-name">${d.n}</span><span class="cc-en">${d.en}</span>${diag}<span class="cc-text">${d.t}</span></button>`;
}
function phaseHelp() {
  const p = state.phase, side = SIDE_KO[state.active];
  if (p === 'start') return state.mode === 'online' ? `${side} 차례. <b>손패 확인</b>을 누르면 시작한다.` : `${side} 차례가 시작됐다. 손패를 확인한다. (솔로: 상대 손패는 그 군의 차례가 올 때까지 보지 않는다)`;
  if (p === 'scout') return '정찰: 새로 받은 2장 중 손에 넣을 1장을 고르세요. 다른 1장은 버린다.';
  if (p === 'pre') return '손에 <b>선제 공격</b>이나 <b>보급 부족</b>이 있으면 지휘카드보다 먼저 사용해야 한다. 그 카드를 누르세요.';
  if (p === 'card') return '이번 턴에 쓸 지휘카드를 고른 뒤 <b>카드 사용</b>을 누르세요.' + (isDuo() ? ' 선제 공격은 상대 턴에 적이 근접공격할 때 쓰는 카드라 지금은 쓸 수 없다.' : '');
  if (p === 'order') {
    const d = effDef();
    let extra = '';
    if (d && d.k === 'elan') extra = state.tokens ? ' 기호에 맞는 유닛을 누르세요(깃발은 아무 유닛이나 리더).' : ' 먼저 주사위를 굴리세요.';
    if (d && d.k === 'rally') extra = state.tokens ? ' 블록을 잃은 유닛 중 기호에 맞는 병종을 누르면 1블록 회복하고 명령받는다.' : ' 먼저 주사위를 굴리세요.';
    if (d && d.k === 'leadership') extra = ' 리더를 누르면 함께 있는 유닛도 명령받는다.';
    return `명령할 아군 유닛을 지도에서 누르세요(다시 누르면 취소). 배속된 리더에게 따로 명령하려면 유닛을 선택한 뒤 아래 버튼을 쓰세요.${extra}`;
  }
  if (p === 'move') return '명령받은 유닛을 누르면 갈 수 있는 칸이 초록색으로 표시된다. 칸을 누르면 이동. 모든 이동이 끝나면 전투 단계로.';
  if (p === 'battle') return '명령받은 유닛을 누르면 공격할 수 있는 적이 표시된다. 빨간 테두리 = 근접전투, 파란 점선 = 원거리 사격.';
  if (p === 'end') return '손에 남길 카드 1장을 고르세요. 나머지는 버리고 새 카드를 받는다.';
  return '';
}
const whoTag = w => w ? `<span class="who side-${w}">${SIDE_KO[w]} 결정</span>` : '';
function renderSide() {
  const el = document.getElementById('side'); if (!el || !state) return;
  if (ui.edit) { el.innerHTML = editPanel(); return; }
  const side = state.active, h = state.hands[side], p = state.phase;
  let s = '';
  // 프롬프트
  if (ui.picking) s += `<div class="prompt pick" role="status">${isDuo() ? whoTag(ui.picking.who) : ''}<p>${ui.picking.msg}</p>${ui.picking.extra ? `<button class="btn" data-a="pickextra">${ui.picking.extra.label}</button>` : ''}</div>`;
  if (ui.prompt) {
    const pr = ui.prompt;
    s += `<div class="prompt" role="dialog" aria-label="${esc(pr.title)}">${isDuo() ? whoTag(pr.who) : ''}<h3>${pr.title}</h3><div class="pbody">${pr.body || ''}</div>`;
    if (pr.toggles && pr.toggles.length) s += `<div class="toggles">${pr.toggles.map(t => `<label class="tog"><input type="checkbox" id="tg-${t.id}" data-tg="${t.id}" ${t.on ? 'checked' : ''}> ${t.label}</label>`).join('')}</div>`;
    s += `<div class="pbtns">${pr.buttons.map((b, i) => `<button class="btn${b.p ? ' primary' : ''}" data-a="pbtn" data-i="${i}">${b.l}</button>`).join('')}</div></div>`;
  }
  if (ui.waiting) s += `<div class="prompt wait" role="status">${whoTag(ui.waiting.who)}<p>상대가 결정하는 중: <b>${esc(String(ui.waiting.title).replace(/<[^>]+>/g, ''))}</b></p><p class="note">상대 화면에 질문이 떠 있다. 연결이 끊겼다면 대신 정할 수 있다.</p><div class="pbtns"><button class="btn small" data-a="takeover">내가 대신 정하기</button></div></div>`;
  // 차례
  const idx = PHASES.findIndex(x => x[0] === p);
  const mine = NET.myTurn;
  s += `<section class="turn side-${side}"><div class="turn-top"><span class="tnum">${state.turn}턴</span><span class="tside">${SIDE_KO[side]} 차례${NET.on ? (mine ? ' <em class="mine">내 차례</em>' : ' <em class="theirs">상대 진행 중</em>') : ''}</span><span class="tcmd">${state.mode === 'online' ? '온라인' : isDuo() ? '2인' : '솔로'} · 지휘능력 ${cmdNow()}</span></div>
    <ol class="phases">${PHASES.filter(x => (x[0] !== 'pre' || p === 'pre') && (x[0] !== 'scout' || p === 'scout') && !(x[0] === 'end' && isDuo())).map(([k, n]) => { const i = PHASES.findIndex(y => y[0] === k); return `<li class="${k === p ? 'now' : i < idx ? 'done' : ''}">${n}</li>`; }).join('')}</ol>
    <p class="help">${mine ? phaseHelp() : `${SIDE_KO[side]}(상대)가 진행하고 있다. 상대의 이동과 전투가 이 화면에도 그대로 보인다. 내 유닛이 공격받으면 방진·반격·후퇴 같은 결정을 여기서 고른다.`}</p><div class="actions">${mine ? phaseButtons() : (state.winner ? phaseButtons() : '')}</div></section>`;
  // 현재 카드
  if (state.cur) {
    s += `<section class="block"><h3>사용 중인 카드</h3>${cardHtml(state.cur.k, {attr: 'tabindex="-1"'})}`;
    if (state.cur.k === 'counter') s += `<p class="note">역습 → ${state.cur.eff === 'none' ? '상대가 쓴 카드가 없음: 아무 유닛 1개' : CARD_BY_KEY[state.cur.eff].n + (CARD_BY_KEY[state.cur.eff].sec ? ' (좌우 반대)' : '')}</p>`;
    if (p === 'order' || p === 'move' || p === 'battle') s += `<p class="osum">${orderSummary()}${fallbackActive() ? ' · 명령할 병종이 없어 아무 유닛 1개' : ''}</p>`;
    s += `</section>`;
  }
  // 손패
  const vside = NET.on ? NET.me : side, vh = state.hands[vside];
  const showHand = NET.on ? true : p !== 'start';
  if (mine && p === 'scout' && state.scoutPick) s += `<section class="block"><h3>정찰: 1장 고르기</h3><div class="hand">${state.scoutPick.map((k, i) => cardHtml(k, {sel: ui.cardSel === i, attr: `data-a="scoutsel" data-i="${i}"`})).join('')}</div></section>`;
  s += `<section class="block"><h3>${NET.on ? '내 손패' : SIDE_KO[side] + ' 손패'} <small>${vh.length}장</small></h3>`;
  const onlyFS = vh.every(k => k === 'firststrike');
  if (!showHand) s += `<div class="facedown">${vh.map(() => '<span class="fd"></span>').join('')}</div>`;
  else s += `<div class="hand">${vh.map((k, i) => {
    const d = CARD_BY_KEY[k]; let dis = true, attr = `data-a="card" data-i="${i}"`;
    if (!mine || (NET.on && p === 'start')) dis = true;
    else if (p === 'pre') dis = !d.pre; else if (p === 'card' || p === 'end') dis = false;
    if (p === 'card' && isDuo() && k === 'firststrike' && !onlyFS) dis = true;
    return cardHtml(k, {sel: ui.cardSel === i && (p === 'card' || p === 'end'), dis, attr});
  }).join('')}</div>`;
  if (isDuo() && state.sqCards[vside].length) s += `<p class="note">방진표: ${showHand ? state.sqCards[vside].map(x => CARD_BY_KEY[x.k].n).join(', ') : state.sqCards[vside].length + '장'} (방진을 풀거나 전멸하면 손으로 돌아온다)</p>`;
  s += `<p class="note">${SIDE_KO[other(vside)]} 손패 ${state.hands[other(vside)].length}장 (비공개) · 덱 ${state.deck.length} · 버림 ${state.discard.length}</p></section>`;
  // 선택 정보
  s += selInfo();
  // 주사위
  if (ui.dice) {
    const dd = ui.dice;
    s += `<section class="block dice-block"><h3>주사위</h3><p class="dlabel">${esc(dd.label)}</p><div class="dice${dd.rolling ? ' rolling' : ''}">${dd.faces.length ? dd.faces.map(f => dieSvg(f)).join('') : '<span class="note">굴릴 주사위가 없다</span>'}</div>${dd.note ? `<p class="dnote">${dd.note}</p>` : ''}</section>`;
  }
  // 기록
  s += `<section class="block logblock"><h3>기록</h3><ol class="log">${state.log.slice(0, 60).map(e => `<li class="lg ${e.c}"><span class="lt">${e.t}</span>${esc(e.m)}</li>`).join('')}</ol></section>`;
  el.innerHTML = s;
}
function phaseButtons() {
  const p = state.phase; const d = effDef(); let b = '';
  if (state.winner) return `<button class="btn primary" data-a="newgame">새 게임</button>`;
  if (p === 'start') b += `<button class="btn primary" data-a="reveal">손패 확인</button>`;
  if (p === 'card') b += `<button class="btn primary" data-a="play" ${ui.cardSel == null ? 'disabled' : ''}>카드 사용</button>`;
  if (p === 'order') {
    if (d && (d.k === 'elan' || d.k === 'rally') && !state.rolled) b += `<button class="btn primary" data-a="carddice">주사위 ${cmdNow()}개 굴리기</button>`;
    b += `<button class="btn${d && (d.k === 'elan' || d.k === 'rally') && !state.rolled ? '' : ' primary'}" data-a="tomove">이동 단계로</button>`;
  }
  if (p === 'move') b += `<button class="btn primary" data-a="tobattle">전투 단계로</button><button class="btn ghost" data-a="backorder">명령 단계로</button>`;
  if (p === 'battle') b += `<button class="btn primary" data-a="endturn">턴 종료</button>`;
  if (p === 'end') b += `<button class="btn primary" data-a="keep" ${ui.cardSel == null ? 'disabled' : ''}>이 카드를 남기고 종료</button>`;
  if (p === 'scout') b += `<button class="btn primary" data-a="scoutkeep" ${ui.cardSel == null ? 'disabled' : ''}>이 카드를 손에 넣기</button>`;
  return b;
}
function dieSvg(f) {
  const bg = {inf: '#5b8fd8', cav: '#e2bd2f', art: '#d2443a', flag: '#1f1f1f', saber: '#1f1f1f'}[f];
  const icon = {
    inf: '<circle cx="14" cy="9" r="3" fill="#111"/><path d="M11 13 h6 l1 9 h-8z" fill="#111"/><path d="M19 6 L19 22" stroke="#111" stroke-width="1.5"/>',
    cav: '<path d="M6 20 q2 -8 9 -8 l4 -4 l2 2 l-2 3 q1 5 -2 7 l0 3 h-2 l0 -3 h-6 l-1 3 h-2z" fill="#111"/><circle cx="14" cy="8" r="2.4" fill="#111"/>',
    art: '<circle cx="10" cy="19" r="4" fill="none" stroke="#111" stroke-width="2"/><path d="M8 16 L22 8" stroke="#111" stroke-width="3.5" stroke-linecap="round"/>',
    flag: '<path d="M8 5 V23" stroke="#fff" stroke-width="1.8"/><path d="M9 6 H21 L18 10 L21 14 H9Z" fill="#fff"/>',
    saber: '<path d="M7 21 Q12 10 21 5" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M6 17 L11 22" stroke="#fff" stroke-width="2"/>'}[f];
  return `<span class="die" title="${FACE_KO[f]}"><svg viewBox="0 0 28 28" width="34" height="34"><rect x="1" y="1" width="26" height="26" rx="5" fill="${bg}"/>${icon}</svg><em>${FACE_KO[f]}</em></span>`;
}
function selInfo() {
  const sel = ui.sel; if (!sel) return '';
  const u = sel.type === 'u' ? unitById(sel.id) : null, l = sel.type === 'l' ? leaderById(sel.id) : (u ? attLeader(u) : null);
  if (!u && !l) return '';
  let s = `<section class="block selinfo"><h3>선택</h3>`;
  if (u) {
    const S = st(u), k = hexOf(u), t = effT(k);
    s += `<div class="ui-row"><span class="chip" style="background:${NAT_COL[u.nat]}">${unitName(u)}</span><span>${SIDE_KO[u.side]} · ${k} · ${TERRAIN[t] ? TERRAIN[t].ko : (t === 'stream' ? '개울' : t === 'brook' ? '개울(정지 없음)' : t)}</span></div>`;
    s += `<dl class="stats"><div><dt>블록</dt><dd>${u.blocks}/${S.max}</dd></div><div><dt>이동</dt><dd>${S.cls === 'inf' ? (S.mv2 ? '1칸+전투 / 2칸' : '1칸+전투') : S.cls === 'cav' ? S.mv + '칸+전투' : S.foot ? '1칸(전투 불가)' : '1칸+전투 / 2칸'}</dd></div>
      <div><dt>근접</dt><dd>${S.melee[S.max - u.blocks]}개</dd></div><div><dt>사거리</dt><dd>${S.rng ? S.rng + '칸' : '–'}</dd></div>${S.ign ? `<div><dt>깃발 무시</dt><dd>${S.ign}</dd></div>` : ''}${S.noSaber ? '<div><dt>칼</dt><dd>명중 아님</dd></div>' : ''}${S.retreat ? `<div><dt>후퇴</dt><dd>깃발당 ${S.retreat}칸</dd></div>` : ''}</dl>`;
    const st8 = [u.ordered ? '명령받음' : null, u.moved ? `${u.moved}칸 이동` : null, u.battled ? '전투함' : null, u.square ? '방진' : null, u.noBattleTerr ? '지형 때문에 전투 불가' : null].filter(Boolean);
    if (st8.length) s += `<p class="note">${st8.join(' · ')}</p>`;
    const btns = [];
    if (u.side === state.active && state.phase === 'order' && l && !l.moved) btns.push(`<button class="btn small" data-a="orderleader">${l.ordered ? '리더 명령 취소' : `리더 ${esc(l.name)}에게 명령`}</button>`);
    if (u.side === state.active && (state.phase === 'order' || state.phase === 'move') && u.square && u.ordered && !nbrKeys(k).some(n => { const e = unitAt(n); return e && e.side !== u.side && st(e).cls === 'cav'; })) btns.push(`<button class="btn small" data-a="unsquare">방진 해제</button>`);
    if (u.side === state.active && state.phase === 'move' && l && l.ordered && !l.moved) btns.push(`<button class="btn small" data-a="selleader">리더 ${esc(l.name)} 따로 이동</button>`);
    const sc = scen();
    if (sc.exitHex && u.side === 'B' && k === sc.exitHex && state.phase === 'move' && u.ordered && u.side === state.active && u.moved < moveAllow(u)) btns.push(`<button class="btn small" data-a="exit">다리로 퇴장 (+1 깃발)</button>`);
    if (btns.length) s += `<div class="sbtns">${btns.join('')}</div>`;
  }
  if (l && (!u)) s += `<div class="ui-row"><span class="chip" style="background:${SIDE_COL[l.side]}">리더</span><span>${esc(l.name)} · ${hexOf(l)}${l.ordered ? ' · 명령받음' : ''}</span></div><p class="note">리더는 3칸까지 이동. 혼자서는 전투할 수 없다.</p>`;
  else if (l) s += `<p class="note">배속 리더: ${esc(l.name)}${l.ordered ? ' (따로 명령받음)' : ''} · 깃발 1개 무시</p>`;
  return s + '</section>';
}
function editPanel() {
  const terrBtns = [['clear', '개활지'], ['forest', '숲'], ['hill', '언덕'], ['rugged', '요철 구릉'], ['town', '마을'], ['river', '강'], ['bridge', '다리'], ['fw', '보루'], ['quarry', '채석장']];
  const types = side => Object.keys(STATS).filter(t => side === 'F' ? t.startsWith('F-') : !t.startsWith('F-'));
  const eu = ui.editSel ? unitAt(ui.editSel) : null, el = ui.editSel ? leaderAt(ui.editSel) : null;
  let s = `<section class="block edit"><h3>편집 모드</h3><p class="help">시나리오 배치가 책과 다르면 여기서 고친다. 지형이나 유닛을 고른 뒤 칸을 누르세요. 아무것도 고르지 않았을 때는 유닛을 누르고 빈 칸을 눌러 옮긴다.</p>
   <h4>지형 칠하기</h4><div class="chips">${terrBtns.map(([k, n]) => `<button class="chipbtn${ui.paint === k ? ' on' : ''}" data-a="paint" data-v="${k}"><i style="background:${T_FILL[k === 'river' ? 'river' : k]}"></i>${n}</button>`).join('')}</div>
   <h4>유닛 놓기</h4><div class="addrow"><select id="add-type">${['B', 'F'].map(sd => `<optgroup label="${SIDE_KO[sd]}">${types(sd).map(t => `<option value="${t}" ${ui.add === t ? 'selected' : ''}>${NATION[t[0]].ko} ${STATS[t].ko}</option>`).join('')}</optgroup>`).join('')}</select><button class="btn small${ui.add ? ' primary' : ''}" data-a="addunit">${ui.add ? '놓는 중 (끄기)' : '놓기 켜기'}</button></div>
   <div class="addrow"><input id="add-lname" placeholder="리더 이름" value=""><select id="add-lside"><option value="B">영국군</option><option value="F">프랑스군</option></select><button class="btn small${ui.add === 'leader' ? ' primary' : ''}" data-a="addleader">${ui.add === 'leader' ? '놓는 중 (끄기)' : '리더 놓기'}</button></div>`;
  if (eu || el) {
    s += `<h4>선택한 칸 ${ui.editSel}</h4>`;
    if (eu) s += `<p>${unitLabel(eu)} · 블록 ${eu.blocks}/${st(eu).max}</p><div class="sbtns"><button class="btn small" data-a="eblk" data-v="-1">블록 −</button><button class="btn small" data-a="eblk" data-v="1">블록 +</button><button class="btn small" data-a="esq">${eu.square ? '방진 해제' : '방진'}</button><button class="btn small danger" data-a="edel">유닛 삭제</button></div>`;
    if (el) s += `<p>리더 ${esc(el.name)}</p><div class="sbtns"><button class="btn small danger" data-a="eldel">리더 삭제</button></div>`;
  }
  s += `<h4>승리깃발</h4><div class="sbtns">${['B', 'F'].map(sd => `<span class="vbedit">${SIDE_KO[sd]} ${state.vb[sd]} <button class="btn small" data-a="evb" data-s="${sd}" data-v="-1">−</button><button class="btn small" data-a="evb" data-s="${sd}" data-v="1">+</button></span>`).join('')}</div>
   <h4>이 시나리오 기본 배치</h4><p class="note">지금 지형과 유닛 배치를 이 브라우저에 저장해 두면 다음 새 게임부터 그대로 쓴다.</p><div class="sbtns"><button class="btn small" data-a="saveov">현재 배치를 기본값으로 저장</button>${loadOverrides()[state.scenId] ? '<button class="btn small" data-a="clearov">책 배치로 되돌리기</button>' : ''}</div>
   <div class="actions"><button class="btn primary" data-a="edit">편집 끝내기</button></div></section>`;
  return s;
}
function renderBar() {
  const el = document.getElementById('bar'); if (!el || !state) return;
  const sc = scen();
  const pips = side => { const n = bannerTotal(side), t = state.target; let s = ''; for (let i = 0; i < t; i++) s += `<i class="${i < state.vb[side] ? 'on' : i < n ? 'obj' : ''}"></i>`; return s; };
  el.innerHTML = `<div class="scn"><span class="scn-no">${sc.no}</span><div><b>${sc.name}</b><small><span class="mode">${state.mode === 'online' ? '온라인 2인' : '솔로'}</span> ${sc.date} · 승리깃발 ${state.target}개${state.overridden ? ' · 수정한 배치' : ''}</small></div></div>
   <div class="vbs"><div class="vb side-B"><span>영국군</span><span class="pips">${pips('B')}</span><b>${bannerTotal('B')}</b></div><div class="vb side-F"><span>프랑스군</span><span class="pips">${pips('F')}</span><b>${bannerTotal('F')}</b></div></div>
   ${NET.on ? `<div class="netbox side-${NET.me}"><span>방 <b class="code">${NET.room}</b></span><span>나: ${SIDE_KO[NET.me]}</span><span class="dot ${NET.opp ? 'ok' : ''}">${NET.opp ? '상대 접속 중' : '상대 기다리는 중'}</span><button class="btn small" data-a="copylink">초대 링크 복사</button><button class="btn small ghost" data-a="leave">방 나가기</button></div>` : ''}
   <div class="barbtns"><button class="btn ghost" data-a="undo" ${undoStack.length && !ui.busy && NET.myTurn ? '' : 'disabled'}>되돌리기</button>${NET.on ? '' : `<button class="btn ghost${ui.edit ? ' on' : ''}" data-a="edit">편집</button>`}<button class="btn ghost" data-a="newgame">새 게임</button><button class="btn ghost icon${SFX.on ? ' on' : ''}" data-a="sfx" aria-pressed="${SFX.on}" title="효과음">${SFX.on ? '소리 켬' : '소리 끔'}</button><button class="btn ghost icon${FX.on ? ' on' : ''}" data-a="anim" aria-pressed="${FX.on}" title="애니메이션">${FX.on ? '움직임 켬' : '움직임 끔'}</button></div>`;
}
function renderOverlay() {
  const el = document.getElementById('overlay'); if (!el) return;
  let s = '';
  if (ui.toast) s += `<div class="toast" role="status">${esc(ui.toast)}</div>`;
  if (state && state.winner && !ui.winSeen) s += `<div class="win"><div class="wincard side-${state.winner}"><p class="wk">승리</p><h2>${SIDE_KO[state.winner]}</h2><p>승리깃발 ${bannerTotal(state.winner)} / ${state.target}</p><div class="pbtns"><button class="btn primary" data-a="newgame">새 게임</button><button class="btn" data-a="winseen">지도 계속 보기</button></div></div></div>`;
  if (ui.newGame) s += newGameDialog();
  el.innerHTML = s;
}
function newGameDialog() {
  const m = ui.newMode || 'solo';
  const modes = [['solo', '솔로', 'Power of Three · 혼자 양쪽 지휘'], ['online', '온라인 2인', '각자 자기 기기에서 Firebase로 대전']];
  let s = `<div class="win"><div class="picker"><h2>새 게임</h2><div class="modesel" role="radiogroup" aria-label="모드">${modes.map(([v, n, d]) => `<button role="radio" aria-checked="${m === v}" data-a="newmode" data-v="${v}"><b>${n}</b><small>${d}</small></button>`).join('')}</div>`;
  const list = act => `<div class="plist">${SCENARIOS.map(x => `<button class="pitem" data-a="${act}" data-v="${x.id}" ${ui.netBusy ? 'disabled' : ''}><span class="pno">${x.no}</span><span><b>${x.name}</b><small>${x.date} · 승리깃발 ${x.vb} · 먼저: ${SIDE_KO[x.first]} · 카드 영국 ${x.B.cmd}·프랑스 ${x.F.cmd}</small></span></button>`).join('')}</div>`;
  if (m !== 'online') s += list('start');
  else if (!NET.available()) s += `<div class="callout"><p><b>온라인 대전은 Firebase 설정이 있어야 켜진다.</b></p><p>${location.protocol.startsWith('http') && !/claude/.test(location.host) ? '저장소의 <code>firebase-config.js</code>에 Firebase 웹 앱 설정을 넣고 다시 올려라. 방법은 README의 "온라인 대전 설정"에 있다.' : '이 미리보기 페이지는 외부 서버 연결이 막혀 있다. GitHub Pages에 올린 버전에서 <code>firebase-config.js</code>를 채우면 쓸 수 있다.'}</p></div>`;
  else {
    s += `${ui.netErr ? `<p class="neterr" role="alert">${esc(ui.netErr)}</p>` : ''}${ui.netBusy ? '<p class="note">연결 중…</p>' : ''}
      <h3 class="ph3">방 참가</h3><div class="addrow"><input id="join-code" placeholder="방 코드 5자리" maxlength="12" autocomplete="off" value="${esc(ui.joinCode || '')}"><button class="btn primary" data-a="join" ${ui.netBusy ? 'disabled' : ''}>참가</button></div>
      <h3 class="ph3">방 만들기</h3><div class="sidesel" role="radiogroup" aria-label="내 진영">${['B', 'F'].map(sd => `<button role="radio" class="side-${sd}" aria-checked="${(ui.mySide || 'B') === sd}" data-a="myside" data-v="${sd}">${SIDE_KO[sd]}</button>`).join('')}</div><p class="note">진영을 고른 뒤 시나리오를 누르면 방이 생기고 코드가 나온다. 상대에게 코드나 초대 링크를 보내면 된다.</p>${list('create')}`;
  }
  return s + `<button class="btn" data-a="closenew">닫기</button></div></div>`;
}
function render() {
  document.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === ui.tab ? 'true' : 'false'));
  document.querySelectorAll('.tabpane').forEach(p => p.hidden = p.id !== 'tab-' + ui.tab);
  renderBar(); renderBoard(); renderSide(); renderChat(); renderOverlay();
}
function renderChat() {
  const el = document.getElementById('chat'); if (!el) return;
  el.hidden = !NET.on; if (!NET.on) { el._n = -1; return; }
  if (!el.firstChild) el.innerHTML = `<h3>채팅</h3><ol class="chatlog" aria-live="polite"></ol><form class="addrow chatform"><input id="chat-in" maxlength="200" placeholder="상대에게 메시지" autocomplete="off" enterkeyhint="send"><button class="btn primary small" type="submit">보내기</button></form>`;
  const msgs = NET.chat; if (el._n === msgs.length) return; el._n = msgs.length;
  const ol = el.querySelector('.chatlog');
  const hm = t => { const d = new Date(t); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
  ol.innerHTML = msgs.map(m => `<li class="cm side-${m.side}${m.side === NET.me ? ' me' : ''}"><b>${m.side === NET.me ? '나' : SIDE_KO[m.side]}</b><span>${esc(m.text)}</span><time>${m.t ? hm(m.t) : ''}</time></li>`).join('') || '<li class="cm empty">아직 메시지가 없다. 인사를 건네 보자.</li>';
  ol.scrollTop = ol.scrollHeight;
}

/* ===================== INTERACTION ===================== */
function boardClick(k) {
  if (!state) return;
  if (ui.picking) { if (ui.picking.cands.has(k)) ui.picking.resolve(k); return; }
  if (ui.busy || ui.prompt) return;
  if (ui.edit) return editClick(k);
  const u = unitAt(k), l = leaderAt(k); const p = state.phase, side = state.active;
  const selU = ui.sel && ui.sel.type === 'u' ? unitById(ui.sel.id) : null; const selL = ui.sel && ui.sel.type === 'l' ? leaderById(ui.sel.id) : null;
  if (state.winner || !NET.myTurn) { ui.sel = u ? {type: 'u', id: u.id} : l ? {type: 'l', id: l.id} : null; return render(); }
  if (p === 'order') {
    const d = effDef();
    if (u && u.side === side && d && d.k === 'rally' && state.tokens) {
      const c = st(u).cls;
      if (u.blocks < st(u).max && state.tokens[c] > 0) return act(() => { u.blocks++; state.tokens[c]--; u.ordered = true; u.rallied = true; log(`재편: ${unitLabel(u)} 블록 1개 회복, 명령받음`); ui.sel = {type: 'u', id: u.id}; });
      ui.sel = {type: 'u', id: u.id}; toast(u.blocks >= st(u).max ? '블록을 잃지 않은 유닛이다.' : `${FACE_KO[c]} 기호가 남아 있지 않다.`); return;
    }
    let ent = u && u.side === side ? u : (!u && l && l.side === side ? l : null);
    if (ent && u && d && d.k === 'leadership' && attLeader(u)) ent = attLeader(u);
    if (ent) {
      const isL = !!ent.name;
      ui.sel = u ? {type: 'u', id: u.id} : {type: 'l', id: l.id};
      if (ent.ordered) return act(() => setOrder(ent, isL, false));
      const err = tryOrder(ent, isL); if (err) { toast(err); return render(); }
      SFX.play('order'); return act(() => setOrder(ent, isL, true));
    }
  }
  if (p === 'move') {
    if (selU && selU.side === side && selU.ordered && !selU.moved && !u && !(l && l.side !== side)) {
      const m = reachUnit(selU, moveAllow(selU)); if (m.has(k)) { const path = pathOf(m, k); return act(async () => { doMoveUnit(selU, k, m.get(k)); await animMove(selU, path); }); }
    }
    if (selL && selL.side === side && selL.ordered && !selL.moved) {
      const d = effDef(); const m = reachLeader(selL, d && d.k === 'gm' ? 4 : 3); if (m.has(k)) { const path = pathOf(m, k); return act(async () => { doMoveLeader(selL, k, m.get(k)); render(); const g = document.querySelector(`[data-id="${selL.id}"]`); if (g) await FX.move(selL.id, path, 'cav'); else SFX.play('step', 'cav'); }); }
    }
  }
  if (p === 'battle' && selU && selU.side === side) {
    const tg = targetsFor(selU);
    if (tg.has(k)) { const kind = tg.get(k); const att = selU; return act(async () => { const dec = await declare(att, k, kind); if (!dec) throw new CancelErr(); await combat(att, k, kind, {arts: dec.arts}); }); }
  }
  if (u) ui.sel = {type: 'u', id: u.id}; else if (l) ui.sel = {type: 'l', id: l.id}; else ui.sel = null;
  render();
}
class CancelErr extends Error {}
function editClick(k) {
  const u = unitAt(k), l = leaderAt(k);
  if (ui.paint) { pushUndo(); if (ui.paint === 'clear') delete state.terr[k]; else state.terr[k] = ui.paint; return render(); }
  if (ui.add === 'leader') {
    if (l) return toast('이미 리더가 있는 칸이다.');
    const name = (document.getElementById('add-lname') || {}).value || '리더'; const side = (document.getElementById('add-lside') || {}).value || 'B';
    pushUndo(); state.leaders.push({id: uid(), side, name: name.trim() || '리더', r: P(k)[0], c: P(k)[1], ordered: false, moved: 0}); ui.editSel = k; return render();
  }
  if (ui.add) { if (u) return toast('이미 유닛이 있는 칸이다.'); const t = ui.add; pushUndo(); state.units.push(mkUnit(t[0] === 'F' ? 'F' : 'B', t[0], t, ...P(k))); ui.editSel = k; return render(); }
  if (ui.editSel && ui.editSel !== k) {
    const su = unitAt(ui.editSel), sl = leaderAt(ui.editSel);
    if (su && !u) { pushUndo(); const [r, c] = P(k); const al = attLeader(su); su.r = r; su.c = c; if (al) { al.r = r; al.c = c; } ui.editSel = k; return render(); }
    if (!su && sl && !l) { pushUndo(); [sl.r, sl.c] = P(k); ui.editSel = k; return render(); }
  }
  ui.editSel = (u || l) ? k : null; render();
}
const FREE_ACTIONS = new Set(['pbtn', 'pickextra', 'sfx', 'anim', 'tab', 'newgame', 'closenew', 'newmode', 'winseen', 'takeover', 'copylink', 'leave', 'join', 'create', 'myside', 'start', 'goscen', 'goonline']);
async function onAction(a, el) {
  const side = state && state.active;
  if (NET.on && !NET.myTurn && !FREE_ACTIONS.has(a)) return;
  switch (a) {
    case 'pbtn': { const pr = ui.prompt; if (!pr) return; const b = pr.buttons[+el.dataset.i];
      if (pr.toggles) { const tg = {}; pr.toggles.forEach(t => { const c = document.getElementById('tg-' + t.id); tg[t.id] = c && c.checked; }); pr.resolve({v: b.v, toggles: tg}); } else pr.resolve(b.v); return; }
    case 'pickextra': if (ui.picking) ui.picking.resolve(ui.picking.extra.value); return;
    case 'undo': return undo();
    case 'edit': ui.edit = !ui.edit; ui.paint = null; ui.add = null; ui.editSel = null; ui.sel = null; return render();
    case 'newgame': ui.newGame = true; return render();
    case 'closenew': ui.newGame = false; return render();
    case 'winseen': ui.winSeen = true; return render();
    case 'newmode': ui.newMode = el.dataset.v; ui.netErr = null; return render();
    case 'myside': ui.mySide = el.dataset.v; return render();
    case 'takeover': if (ui.waiting) ui.waiting.takeover(); return;
    case 'copylink': { const t = NET.link(); try { await navigator.clipboard.writeText(t); toast('초대 링크를 복사했다.'); } catch (e) { toast('복사가 막혔다. 방 코드: ' + NET.room); } return; }
    case 'leave': NET.leave(); ui.newGame = true; ui.newMode = 'solo'; newGame(state.scenId, 'solo'); undoStack.length = 0; save(); return render();
    case 'create': case 'join': {
      if (ui.netBusy) return; ui.netBusy = true; ui.netErr = null; render();
      try {
        if (NET.on) NET.leave();
        if (a === 'create') await NET.create(el.dataset.v, ui.mySide || 'B');
        else { const c = (document.getElementById('join-code') || {}).value || ui.joinCode || ''; await NET.join(c); }
        ui.newGame = false; ui.winSeen = false; ui.sel = null; ui.dice = null; ui.cardSel = null; ui.edit = false; ui.tab = 'game'; save();
        toast(a === 'create' ? `방 ${NET.room}을(를) 만들었다. 초대 링크를 상대에게 보내라.` : `방 ${NET.room}에 ${SIDE_KO[NET.me]}으로 들어왔다.`);
      } catch (e) { ui.netErr = e.message; }
      ui.netBusy = false; return render();
    }
    case 'sfx': SFX.toggle(); return render();
    case 'anim': FX.toggle(); return render();
    case 'scoutsel': ui.cardSel = ui.cardSel === +el.dataset.i ? null : +el.dataset.i; return render();
    case 'scoutkeep': if (ui.cardSel == null) return; return act(() => { const i = ui.cardSel; ui.cardSel = null; chooseScout(i); });
    case 'start': if (NET.on) NET.leave(); ui.newGame = false; ui.winSeen = false; ui.sel = null; ui.dice = null; ui.cardSel = null; ui.edit = false; undoStack.length = 0; newGame(el.dataset.v, ui.newMode || 'solo'); ui.tab = 'game'; save(); window.scrollTo({top: 0}); return render();
    case 'reveal': return act(() => { revealHand(); ui.cardSel = null; });
    case 'card': {
      const i = +el.dataset.i, k = state.hands[side][i];
      if (state.phase === 'pre') { if (!CARD_BY_KEY[k].pre) return; return act(async () => { state.hands[side].splice(i, 1); state.discard.push(k); log(`${SIDE_KO[side]}: 「${CARD_BY_KEY[k].n}」 먼저 사용 (솔로 규칙)`, 'card'); if (k === 'firststrike') await playFirstStrike(); else await playShortSupply(); if (!state.hands[side].some(x => CARD_BY_KEY[x].pre)) state.phase = 'card'; }); }
      if (state.phase === 'card' || state.phase === 'end') { ui.cardSel = ui.cardSel === i ? null : i; return render(); }
      return;
    }
    case 'play': if (ui.cardSel == null) return; SFX.play('card'); return act(async () => {
      const k = state.hands[side][ui.cardSel]; playCard(ui.cardSel); ui.cardSel = null; ui.sel = null;
      if (isDuo() && k === 'shortsupply') { await playShortSupply(); state.phase = 'battle'; }
      if (isDuo() && k === 'firststrike') { log('선제 공격은 상대 턴에만 쓸 수 있어 효과 없이 버렸다.'); state.phase = 'battle'; }
    });
    case 'carddice': return act(rollCardDice);
    case 'tomove': return act(() => { state.phase = 'move'; ui.sel = null; log('이동 단계'); });
    case 'backorder': return act(() => { state.phase = 'order'; });
    case 'tobattle': return act(() => { state.phase = 'battle'; ui.sel = null; log('전투 단계'); });
    case 'endturn': ui.sel = null; if (isDuo()) return act(() => finishTurn()); if (state.hands[side].length <= 1) return act(() => finishTurn(state.hands[side].length ? 0 : null)); return act(() => { state.phase = 'end'; ui.cardSel = null; });
    case 'keep': if (ui.cardSel == null) return; return act(() => { const i = ui.cardSel; ui.cardSel = null; finishTurn(i); });
    case 'orderleader': { const u = unitById(ui.sel.id); const l = u && attLeader(u); if (!l) return; if (l.ordered) return act(() => setOrder(l, true, false)); const err = tryOrder(l, true); if (err) return toast(err); return act(() => setOrder(l, true, true)); }
    case 'selleader': { const u = unitById(ui.sel.id); const l = u && attLeader(u); if (l) { ui.sel = {type: 'l', id: l.id}; render(); } return; }
    case 'unsquare': { const u = unitById(ui.sel.id); return act(() => { releaseSquare(u); log(`${unitLabel(u)} 방진 해제`); }); }
    case 'exit': { const u = unitById(ui.sel.id); return act(() => { const l = attLeader(u); state.units = state.units.filter(x => x !== u); if (l) state.leaders = state.leaders.filter(x => x !== l); state.exited++; log(`${unitLabel(u)} 다리로 퇴장`); award('B', 1, '다리로 퇴장'); ui.sel = null; }); }
    case 'paint': ui.paint = ui.paint === el.dataset.v ? null : el.dataset.v; ui.add = null; return render();
    case 'addunit': { const v = document.getElementById('add-type').value; ui.add = ui.add && ui.add !== 'leader' ? null : v; ui.paint = null; return render(); }
    case 'addleader': ui.add = ui.add === 'leader' ? null : 'leader'; ui.paint = null; return render();
    case 'eblk': { const u = unitAt(ui.editSel); if (!u) return; pushUndo(); u.blocks = Math.max(1, Math.min(st(u).max, u.blocks + +el.dataset.v)); return render(); }
    case 'esq': { const u = unitAt(ui.editSel); if (!u) return; pushUndo(); u.square = !u.square; return render(); }
    case 'edel': { const u = unitAt(ui.editSel); if (!u) return; pushUndo(); state.units = state.units.filter(x => x !== u); return render(); }
    case 'eldel': { const l = leaderAt(ui.editSel); if (!l) return; pushUndo(); state.leaders = state.leaders.filter(x => x !== l); return render(); }
    case 'evb': pushUndo(); state.vb[el.dataset.s] = Math.max(0, state.vb[el.dataset.s] + +el.dataset.v); checkWin(); return render();
    case 'saveov': { const o = loadOverrides(); o[state.scenId] = {terr: state.terr, units: state.units.map(u => ({...u, ordered: false, moved: 0, battled: false})), leaders: state.leaders.map(l => ({...l, ordered: false, moved: 0}))}; saveOverrides(o); state.overridden = true; toast('이 브라우저에 기본 배치로 저장했다.'); return render(); }
    case 'clearov': { const o = loadOverrides(); delete o[state.scenId]; saveOverrides(o); toast('책 배치로 되돌렸다. 새 게임부터 적용된다.'); return render(); }
    case 'tab': ui.tab = el.dataset.tab; render(); window.scrollTo({top: 0}); return;
    case 'goonline': ui.tab = 'game'; ui.newGame = true; ui.newMode = 'online'; render(); window.scrollTo({top: 0}); return;
    case 'goscen': if (NET.on) NET.leave(); ui.tab = 'game'; ui.newGame = false; undoStack.length = 0; ui.sel = null; ui.dice = null; ui.winSeen = false; ui.newMode = el.dataset.m || 'solo'; newGame(el.dataset.v, ui.newMode); save(); render(); window.scrollTo({top: 0}); return;
  }
}
function init() {
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-a]'); if (a && !a.disabled) { e.preventDefault(); onAction(a.dataset.a, a); return; }
    const tb = e.target.closest('[data-tab]'); if (tb) { e.preventDefault(); ui.tab = tb.dataset.tab; render(); window.scrollTo({top: 0}); return; }
  });
  document.getElementById('board').addEventListener('click', e => { const h = e.target.closest('[data-k]'); if (h) boardClick(h.dataset.k); });
  document.addEventListener('change', e => { if (e.target.id === 'add-type' && ui.add && ui.add !== 'leader') { ui.add = e.target.value; render(); } });
  document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.target.closest('input, textarea')) { e.preventDefault(); undo(); } });
  document.addEventListener('submit', e => {
    if (!e.target.closest('.chatform')) return; e.preventDefault();
    const i = document.getElementById('chat-in'); const t = i.value.trim(); if (!t) return;
    i.value = ''; NET.say(t).catch(err => { i.value = t; toast('채팅을 보내지 못했다: ' + err.message); });
  });
  let saved = null; try { saved = JSON.parse(localStorage.getItem('cnc-solo-save') || 'null'); } catch (e) {}
  if (saved && saved.v === 1 && saved.mode !== 'duo' && SCENARIOS.find(s => s.id === saved.scenId)) { state = saved; state.mode = state.mode || 'solo'; state.sqCards = state.sqCards || {B: [], F: []}; state.fsRefill = state.fsRefill || []; } else newGame(saved && SCENARIOS.find(s => s.id === saved.scenId) ? saved.scenId : 'rolica1');
  ui.newMode = state.mode === 'online' ? 'online' : state.mode;
  document.addEventListener('input', e => { if (e.target.id === 'join-code') ui.joinCode = e.target.value; });
  renderScenarioList(); renderRefTables();
  render();
  const hm = (location.hash || '').match(/^#r-([A-Z0-9]{4,8})$/i);
  NET.resume().then(ok => {
    if (ok && (!hm || hm[1].toUpperCase() === NET.room)) { toast(`방 ${NET.room}에 다시 연결했다.`); return; }
    if (!ok && state.mode === 'online') { newGame(state.scenId, 'solo'); undoStack.length = 0; save(); render(); }
    if (hm) { ui.newGame = true; ui.newMode = 'online'; ui.joinCode = hm[1].toUpperCase(); render(); }
  });
}
function renderScenarioList() {
  const el = document.getElementById('scenlist'); if (!el) return;
  el.innerHTML = SCENARIOS.map(sc => `<article class="scard"><header><span class="pno">${sc.no}</span><div><h3>${sc.name}</h3><p class="sdate">${sc.date}</p></div></header>
   <p class="shist">${sc.hist}</p>
   <dl class="snotes"><div><dt>영국군</dt><dd>${sc.B.cmdr} · 지휘카드 ${sc.B.cmd}장${sc.first === 'B' ? ' · <b>먼저 이동</b>' : ''}</dd></div><div><dt>프랑스군</dt><dd>${sc.F.cmdr} · 지휘카드 ${sc.F.cmd}장${sc.first === 'F' ? ' · <b>먼저 이동</b>' : ''}</dd></div><div><dt>승리</dt><dd>승리깃발 ${sc.vb}개</dd></div></dl>
   <ul class="srules">${sc.rules.map(r => `<li>${r}</li>`).join('')}</ul>
   <div class="sbtns"><button class="btn primary" data-a="goscen" data-v="${sc.id}" data-m="solo">솔로로 시작</button><button class="btn" data-a="goonline">온라인 2인으로</button></div></article>`).join('');
}
function renderRefTables() {
  const el = document.getElementById('unittables');
  if (el) {
    const arr = a => a ? a.join(' · ') : '–';
    const mv = s => s.cls === 'inf' ? (s.mv2 ? '1+전투 / 2' : '1+전투') : s.cls === 'cav' ? `${s.mv}+전투` : s.foot ? '1(전투 불가)' : '1+전투 / 2';
    const etc = s => [s.ign ? `깃발 ${s.ign}개 무시` : '', s.noSaber ? '근접 칼 빗나감' : '', s.retreat ? `깃발당 ${s.retreat}칸 후퇴` : '', s.meleeVsInf ? '보병 상대 근접 +1' : '', s.light ? '숲에 들어가도 전투' : ''].filter(Boolean).join(', ');
    let h = '';
    [['F', '프랑스'], ['B', '영국'], ['P', '포르투갈 (카트르 브라·워털루의 동맹군 포함)']].forEach(([n, ko]) => {
      h += `<h4>${ko}</h4><div class="tw"><table><tr><th>유닛</th><th>블록</th><th>이동</th><th>사거리</th><th>사격(제자리)</th><th>사격(이동 후)</th><th>근접</th><th>기타</th></tr>`;
      Object.entries(STATS).filter(([k]) => k.startsWith(n + '-')).forEach(([k, s]) => {
        const fire = s.cls === 'inf' ? arr(s.fire) : s.cls === 'art' ? `거리 1~: ${arr(s.r2)} / 1블록 ${arr(s.r1)}` : '–';
        const fmv = s.cls === 'inf' ? arr(s.fireMv) : s.horse ? `1칸 이동: ${arr(s.m2)} / 1블록 불가` : '–';
        h += `<tr><td><b>${s.ko}</b></td><td>${s.max}</td><td>${mv(s)}</td><td>${s.rng || '–'}</td><td>${fire}</td><td>${fmv}</td><td>${arr(s.melee)}</td><td class="w">${etc(s)}</td></tr>`;
      });
      h += `</table></div>`;
    });
    h += `<p class="note">포병 사격의 "거리 1~"은 거리 1, 2, 3…의 주사위 수다. 거리 1(인접)은 근접전투 값과 같다.</p>`;
    el.innerHTML = h;
  }
  const ct = document.getElementById('cardtable');
  if (ct) ct.innerHTML = `<div class="tw"><table><tr><th>카드</th><th>매수</th><th>종류</th><th>내용</th></tr>${CARD_DEFS.map(d => `<tr><td><b>${d.n}</b><br><small>${d.en}</small></td><td>${d.cnt}</td><td>${d.sec ? '구역' : '전술'}</td><td class="w">${d.t}</td></tr>`).join('')}</table></div>`;
}
