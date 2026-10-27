/* ===================== GEOMETRY ===================== */
const ROWS = 9;
const ncols = r => (r % 2 ? 12 : 13);
const K = (r, c) => r + ',' + c;
const P = k => k.split(',').map(Number);
const onBoard = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < ncols(r);
function nbrs(r, c) {
  const d = r % 2 ? [[0,-1],[0,1],[-1,0],[-1,1],[1,0],[1,1]] : [[0,-1],[0,1],[-1,-1],[-1,0],[1,-1],[1,0]];
  return d.map(([a, b]) => [r + a, c + b]).filter(([a, b]) => onBoard(a, b));
}
const nbrKeys = k => { const [r, c] = P(k); return nbrs(r, c).map(([a, b]) => K(a, b)); };
function cube(r, c) { const x = c - (r - (r & 1)) / 2; return [x, -x - r, r]; }
function dist(a, b) { const [r1,c1] = P(a), [r2,c2] = P(b); const A = cube(r1,c1), B = cube(r2,c2);
  return Math.max(Math.abs(A[0]-B[0]), Math.abs(A[1]-B[1]), Math.abs(A[2]-B[2])); }
const HS = 36, HW = Math.sqrt(3) * HS, PADX = 12, PADY = 34;
function ctr(r, c) { return [PADX + HW * (c + 0.5 + (r & 1) * 0.5), PADY + HS + r * 1.5 * HS]; }
function pixToKey(px, py) {
  const x = px - PADX - HW / 2, y = py - PADY - HS;
  let q = (Math.sqrt(3) / 3 * x - y / 3) / HS, rr = (2 / 3 * y) / HS, s = -q - rr;
  let Q = Math.round(q), R = Math.round(rr), S2 = Math.round(s);
  const dq = Math.abs(Q - q), dr = Math.abs(R - rr), ds = Math.abs(S2 - s);
  if (dq > dr && dq > ds) Q = -R - S2; else if (dr > ds) R = -Q - S2;
  const c = Q + (R - (R & 1)) / 2;
  return onBoard(R, c) ? K(R, c) : null;
}
function screenSecs(r, c) { const x = 2 * c + (r & 1) + 1; const s = []; if (x <= 8) s.push('l'); if (x >= 8 && x <= 18) s.push('c'); if (x >= 18) s.push('r'); return s; }
// 영국군은 위쪽에 앉으므로 영국의 '좌측'은 화면 오른쪽
function sideSecs(side, k) { const [r, c] = P(k);
  return screenSecs(r, c).map(s => s === 'c' ? 'C' : (side === 'F' ? (s === 'l' ? 'L' : 'R') : (s === 'l' ? 'R' : 'L'))); }
const SEC_KO = {L:'좌측', C:'중앙', R:'우측'};

/* ===================== STATE HELPERS ===================== */
let state = null;
const other = s => (s === 'B' ? 'F' : 'B');
const hexOf = e => K(e.r, e.c);
const st = u => STATS[u.t];
const unitAt = k => state.units.find(u => hexOf(u) === k) || null;
const leaderAt = k => state.leaders.find(l => hexOf(l) === k) || null;
const unitById = id => state.units.find(u => u.id === id) || null;
const leaderById = id => state.leaders.find(l => l.id === id) || null;
function attLeader(u) { const l = leaderAt(hexOf(u)); return l && l.side === u.side ? l : null; }
function unitOfLeader(l) { const u = unitAt(hexOf(l)); return u && u.side === l.side ? u : null; }
function rawT(k) { return state.terr[k] || 'clear'; }
// 실제 효과 지형: 강은 시나리오 규칙에 따라 river(통과불가)/stream(정지)/brook(정지 없음)
function effT(k) { const t = rawT(k); if (t === 'river') return state.water === 'river' ? 'river' : (state.water === 'brook' ? 'brook' : 'stream'); return t; }
const isWater = t => t === 'stream' || t === 'brook';
function adjEnemyUnits(u) { return nbrKeys(hexOf(u)).map(unitAt).filter(x => x && x.side !== u.side); }
function adjEnemyLeadersAlone(u) { return nbrKeys(hexOf(u)).map(k => { const l = leaderAt(k); return l && l.side !== u.side && !unitAt(k) ? l : null; }).filter(Boolean); }
function rand6() { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % 6; }
const FACES = ['inf', 'inf', 'cav', 'art', 'flag', 'saber'];
const FACE_KO = {inf:'보병', cav:'기병', art:'포병', flag:'깃발', saber:'칼'};
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const b = new Uint32Array(1); crypto.getRandomValues(b); const j = b[0] % (i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function uid() { return Math.random().toString(36).slice(2, 9); }
function unitName(u) { return (u.nat === 'P' ? '포르투갈 ' : u.nat === 'A' ? '동맹 ' : '') + st(u).ko; }
function unitLabel(u) { return `${SIDE_KO[u.side].replace('군','')} ${unitName(u)}(${hexOf(u)})`; }

/* ===================== LOG ===================== */
function log(msg, cls) { state.log.unshift({t: state.turn, s: state.active, m: msg, c: cls || ''}); if (state.log.length > 250) state.log.length = 250; }

/* ===================== SETUP ===================== */
function parseUnits(str, side) {
  const out = []; const re = /([pa]?)([A-Z]+)(\d+),(\d+)/g; let m;
  while ((m = re.exec(str))) {
    const nat = side === 'F' ? 'F' : (m[1] === 'p' ? 'P' : m[1] === 'a' ? 'A' : 'B');
    const t = nat + '-' + m[2];
    if (!STATS[t]) { console.warn('unknown unit', t); continue; }
    out.push(mkUnit(side, nat, t, +m[3], +m[4]));
  }
  return out;
}
function mkUnit(side, nat, t, r, c) { return {id: uid(), side, nat, t, r, c, blocks: STATS[t].max, square: false, ordered: false, viaLeader: false, moved: 0, battled: false, noBattleTerr: false, lockMove: false, ssTurn: -1, bonusUsed: false}; }
function parseLeaders(str, side) {
  const out = []; const re = /([^@]+?)@(\d+),(\d+)/g; let m;
  while ((m = re.exec(str))) out.push({id: uid(), side, name: m[1].trim(), r: +m[2], c: +m[3], ordered: false, moved: 0});
  return out;
}
function loadOverrides() { try { return JSON.parse(localStorage.getItem('cnc-solo-overrides') || '{}'); } catch (e) { return {}; } }
function saveOverrides(o) { try { localStorage.setItem('cnc-solo-overrides', JSON.stringify(o)); } catch (e) {} }

function isDuo() { return state && (state.mode === 'duo' || state.mode === 'online'); }
function newGame(scenId, mode) {
  mode = mode || 'solo';
  const sc = SCENARIOS.find(s => s.id === scenId);
  const ov = loadOverrides()[scenId];
  let terr = {}, units, leaders;
  if (ov) { terr = JSON.parse(JSON.stringify(ov.terr)); units = JSON.parse(JSON.stringify(ov.units)); leaders = JSON.parse(JSON.stringify(ov.leaders)); }
  else {
    for (const [type, list] of Object.entries(sc.T)) list.split(/\s+/).filter(Boolean).forEach(k => terr[k] = type);
    units = [...parseUnits(sc.Bu, 'B'), ...parseUnits(sc.Fu, 'F')];
    leaders = [...parseLeaders(sc.BL, 'B'), ...parseLeaders(sc.FL, 'F')];
    (sc.squares || []).forEach(k => { const u = units.find(x => hexOf(x) === k); if (u) u.square = true; });
  }
  const deck = [];
  CARD_DEFS.forEach(d => { for (let i = 0; i < d.cnt; i++) deck.push(d.k); });
  shuffle(deck);
  state = {
    v: 1, scenId, water: sc.water, terr, names: Object.assign({}, sc.names), objs: sc.obj || [], held: {},
    units, leaders, vb: {B: 0, F: 0}, target: sc.vb, cmd: {B: sc.B.cmd, F: sc.F.cmd},
    deck, discard: [], hands: (mode === 'duo' || mode === 'online') ? {B: deck.splice(0, sc.B.cmd), F: deck.splice(0, sc.F.cmd)} : {B: deck.splice(0, 3), F: deck.splice(0, 3)},
    mode, sqCards: {B: [], F: []}, fsRefill: [], scoutPick: null,
    active: sc.first, turn: 1, phase: 'start', cur: null, lastEff: {B: null, F: null},
    scout: false, elanShuffle: false, tokens: null, rolled: false, garcia: 0, exited: 0,
    log: [], winner: null, overridden: !!ov,
  };
  if (mode !== 'solo') state.units.filter(u => u.square).forEach(u => takeSquareCard(u));
  log(`${sc.no}. ${sc.name} 시작 (${mode === 'online' ? '온라인 2인' : mode === 'duo' ? '2인' : '솔로'}). ${SIDE_KO[sc.first]} 먼저 진행.`, 'sys');
  beginTurn(sc.first);
}

/* ===================== OBJECTIVES / BANNERS ===================== */
function objOK(o) { return o.hexes.every(k => { const u = unitAt(k); return u && u.side === o.side; }); }
function refreshHeld() {
  for (const i of Object.keys(state.held)) { const o = state.objs[i]; if (!objOK(o)) { delete state.held[i]; log(`${SIDE_KO[o.side]}이 ${o.label}을(를) 잃어 승리깃발 ${o.vb}개가 사라졌다.`, 'warn'); } }
}
function bannerTotal(side) { let n = state.vb[side]; for (const i of Object.keys(state.held)) if (state.objs[i].side === side) n += state.objs[i].vb; return n; }
function award(side, n, why) {
  state.vb[side] += n; log(`${SIDE_KO[side]} 승리깃발 +${n} (${why})`, 'vb'); checkWin();
}
function checkWin() {
  if (state.winner) return;
  for (const s of ['B', 'F']) if (bannerTotal(s) >= state.target) { state.winner = s; if (typeof SFX !== 'undefined') SFX.play('win'); log(`${SIDE_KO[s]} 승리! 승리깃발 ${bannerTotal(s)}개`, 'win'); }
}

/* ===================== TURN FLOW ===================== */
function beginTurn(side) {
  state.active = side; state.phase = 'start'; state.cur = null; state.scout = false; state.tokens = null; state.rolled = false;
  state.units.forEach(u => { u.ordered = false; u.viaLeader = false; u.rallied = false; u.moved = 0; u.battled = false; u.noBattleTerr = false; u.lockMove = false; u.bonusUsed = false; });
  state.leaders.forEach(l => { l.ordered = false; l.moved = 0; });
  // 목표 칸 점유 확인 (그 군의 턴 시작 때만 획득)
  state.objs.forEach((o, i) => { if (o.side === side && !state.held[i] && objOK(o)) { state.held[i] = true; log(`${SIDE_KO[side]}이 ${o.label}을(를) 점유 → 승리깃발 ${o.vb}개`, 'vb'); } });
  checkWin();
}
function revealHand() {
  const h = state.hands[state.active];
  state.phase = !isDuo() && h.some(k => CARD_BY_KEY[k].pre) ? 'pre' : 'card';
  log(`${SIDE_KO[state.active]} 손패 확인 (${h.length}장)`);
}
function drawCards(side, n) {
  for (let i = 0; i < n; i++) {
    if (!state.deck.length) { state.deck = shuffle(state.discard); state.discard = []; log('덱이 떨어져 버린 카드를 섞었다.', 'sys'); }
    if (!state.deck.length) break;
    state.hands[side].push(state.deck.shift());
  }
}
function squaresOf(side) { return state.units.filter(u => u.side === side && u.square).length; }
function finishTurn(keepIdx) {
  if (isDuo()) return finishTurnDuo();
  const side = state.active, h = state.hands[side];
  let kept = [];
  if (h.length) { const ki = keepIdx == null ? 0 : keepIdx; kept = [h[ki]]; h.forEach((k, i) => { if (i !== ki) state.discard.push(k); }); }
  state.hands[side] = kept;
  if (state.cur) { state.discard.push(state.cur.k); state.lastEff[side] = state.cur.eff; }
  let n = 3 - kept.length;
  if (state.scout) n += 1;
  if (squaresOf(side) >= 2) n = Math.max(1, n - 1);
  drawCards(side, n);
  log(`${SIDE_KO[side]} 턴 종료: ${kept.length}장 보관, ${n}장 받음${state.scout ? ' (정찰)' : ''}${squaresOf(side) >= 2 ? ' (방진 2개 이상: 1장 덜 받음)' : ''}`);
  nextTurn();
}
function nextTurn() {
  const side = state.active;
  if (state.elanShuffle) { state.deck = shuffle([...state.deck, ...state.discard]); state.discard = []; state.elanShuffle = false; log('비약: 덱과 버린 카드를 모두 섞었다.', 'sys'); }
  state.turn++;
  beginTurn(other(side));
}
// 2인 규칙: 쓴 카드를 버리고 1장 받는다. 정찰은 2장을 보고 1장을 고른다. 선제 공격을 쓴 쪽이 먼저 1장 받는다.
function finishTurnDuo() {
  const side = state.active;
  if (state.cur) { state.discard.push(state.cur.k); state.lastEff[side] = state.cur.eff; state.cur = null; }
  for (const s of state.fsRefill) { drawCards(s, 1); log(`${SIDE_KO[s]} 선제 공격을 썼으므로 1장 받음`); }
  state.fsRefill = [];
  if (state.scout) {
    const before = state.hands[side].length; drawCards(side, 2);
    state.scoutPick = state.hands[side].splice(before);
    state.phase = 'scout'; log(`${SIDE_KO[side]} 정찰: 2장 중 1장을 고른다`);
    return;
  }
  drawCards(side, 1); log(`${SIDE_KO[side]} 턴 종료: 1장 받음`);
  nextTurn();
}
function chooseScout(i) {
  const side = state.active, pick = state.scoutPick || [];
  pick.forEach((k, j) => { if (j === i) state.hands[side].push(k); else state.discard.push(k); });
  state.scoutPick = null; log(`${SIDE_KO[side]} 정찰 카드 중 1장을 손에 넣었다`);
  nextTurn();
}
// 2인 규칙의 방진: 손패에서 무작위로 1장이 방진표로
function takeSquareCard(u) {
  const h = state.hands[u.side]; if (!h.length) return;
  const k = h.splice(Math.floor(Math.random() * h.length), 1)[0];
  state.sqCards[u.side].push({id: u.id, k});
}
function formSquare(u) {
  u.square = true;
  if (isDuo()) { takeSquareCard(u); log(`${unitLabel(u)} 방진 → 손패 1장이 방진표로 (지휘능력 감소)`, 'warn'); }
  else log(`${unitLabel(u)} 방진 형성`, 'warn');
}
function releaseSquare(u) {
  u.square = false;
  if (!isDuo()) return;
  const arr = state.sqCards[u.side]; const i = arr.findIndex(x => x.id === u.id);
  if (i >= 0) { state.hands[u.side].push(arr[i].k); arr.splice(i, 1); log(`방진표의 카드가 ${SIDE_KO[u.side]} 손으로 돌아왔다`); }
}
function canFormSquare(u) {
  if (st(u).cls !== 'inf' || u.square || TERRAIN[effT(hexOf(u))]?.noSq) return false;
  if (isDuo()) return state.sqCards[u.side].length < 4 && state.hands[u.side].length > 2;
  return squaresOf(u.side) < 4;
}
function cmdNow() {
  if (state.cur && state.cur.cmd != null) return state.cur.cmd;
  return isDuo() ? state.hands[state.active].length : state.cmd[state.active];
}

/* ===================== CARDS & ORDERS ===================== */
function swapLR(sec) { const o = {}; for (const [k, v] of Object.entries(sec)) o[k === 'L' ? 'R' : k === 'R' ? 'L' : k] = v; return o; }
function playCard(idx) {
  const side = state.active, h = state.hands[side];
  const cmd = isDuo() ? h.length : state.cmd[side];
  const k = h.splice(idx, 1)[0]; const d = CARD_BY_KEY[k];
  let eff = k, sec = d.sec || null;
  if (k === 'counter') {
    const o = state.lastEff[other(side)];
    if (o && o !== 'counter') { eff = o; const od = CARD_BY_KEY[o]; sec = od.sec ? swapLR(od.sec) : null; }
    else { eff = 'none'; sec = null; }
  }
  state.cur = {k, eff, sec, cmd};
  if (d.scout || (k === 'counter' && CARD_BY_KEY[eff] && CARD_BY_KEY[eff].scout)) state.scout = true;
  if (eff === 'elan') state.elanShuffle = true;
  state.phase = 'order';
  log(`${SIDE_KO[side]}: 「${d.n}」 사용${k === 'counter' ? ` → ${eff === 'none' ? '상대가 쓴 카드가 없어 아무 유닛 1개' : '「' + CARD_BY_KEY[eff].n + '」'}` : ''}`, 'card');
}
function effDef() { if (!state.cur) return null; return state.cur.eff === 'none' ? null : CARD_BY_KEY[state.cur.eff]; }
function capFor(n) { return n === 'cmd' ? cmdNow() : n; }
function isInf(u) { return st(u).cls === 'inf'; }
// 명령 버킷: 이 유닛/리더가 이 카드에서 어떤 '자리'를 쓸 수 있는가
function bucketsFor(ent, isL) {
  const d = effDef(); const side = state.active; if (ent.side !== side) return [];
  if (!d) return isL ? [] : ['any'];
  if (d.sec) { if (isL && !d.lead) return []; const sec = state.cur.sec; return sideSecs(side, hexOf(ent)).filter(s => sec[s]); }
  const k = d.k;
  if (k === 'elan') { if (!state.tokens) return []; return isL ? ['flag'] : [st(ent).cls, 'flag']; }
  if (k === 'rally') return [];
  if (k === 'leadership') return isL ? ['all'] : [];
  if (k === 'gm') return (!isL && ent.square) ? [] : ['all'];
  if (isL) return [];
  const s = st(ent);
  switch (k) {
    case 'bayonet': return s.cls === 'inf' ? ['all'] : [];
    case 'bombard': return s.cls === 'art' ? ['all'] : [];
    case 'cavcharge': return (s.cls === 'cav' || s.horse) ? ['all'] : [];
    case 'firehold': return ((s.cls === 'inf' || s.cls === 'art') && !adjEnemyUnits(ent).length) ? ['all'] : [];
    case 'forcemarch': return s.cls === 'inf' ? ['all'] : [];
    case 'coldsteel': return adjEnemyUnits(ent).length ? ['all'] : [];
  }
  return [];
}
function capsFor() {
  const d = effDef(); if (!d) return {any: 1};
  if (d.sec) { const o = {}; for (const [s, n] of Object.entries(state.cur.sec)) o[s] = capFor(n); return o; }
  if (d.k === 'elan') return state.tokens ? {...state.tokens} : {};
  if (['bayonet','bombard','cavcharge','firehold','gm'].includes(d.k)) return {all: 4};
  return {all: 999};
}
// 카드가 요구하는 병종이 아예 없으면 아무 유닛 1개
function fallbackActive() {
  const d = effDef(); if (!d || d.sec || ['elan','rally','counter'].includes(d.k)) return false;
  const side = state.active;
  const any = state.units.some(u => u.side === side && bucketsFor(u, false).length) || state.leaders.some(l => l.side === side && bucketsFor(l, true).length);
  return !any;
}
function orderedItems() {
  const side = state.active, out = [];
  state.units.forEach(u => { if (u.side === side && u.ordered && !u.viaLeader && !u.rallied) out.push(u); });
  state.leaders.forEach(l => { if (l.side === side && l.ordered) out.push(l); });
  return out;
}
function feasible(items, caps) {
  const c = {...caps}; const its = items.slice().sort((a, b) => a.length - b.length);
  const bt = i => { if (i === its.length) return true; for (const b of its[i]) { if ((c[b] || 0) > 0) { c[b]--; if (bt(i + 1)) return true; c[b]++; } } return false; };
  return bt(0);
}
function orderList() { const fb = fallbackActive(); return orderedItems().map(e => fb ? ['any'] : bucketsFor(e, !!e.name)); }
function tryOrder(ent, isL) {
  if (ent.side !== state.active) return '상대 유닛에는 명령할 수 없다.';
  const fb = fallbackActive();
  const b = fb ? ['any'] : bucketsFor(ent, isL);
  if (!b.length) {
    const d = effDef();
    if (isL && d && !d.lead && d.k !== 'leadership') return '이 카드로는 리더에게 따로 명령할 수 없다. (리더는 배속된 유닛과 함께 움직인다)';
    if (d && d.k === 'elan' && !state.tokens) return '먼저 비약 주사위를 굴려라.';
    if (d && d.k === 'rally') return '재편: 주사위를 굴린 뒤 블록을 잃은 유닛을 고른다.';
    return '이 카드로 명령할 수 없는 유닛이다.';
  }
  const caps = fb ? {any: 1} : capsFor();
  const items = orderList(); items.push(b);
  if (!feasible(items, caps)) return '명령 수를 넘는다.';
  const d = effDef();
  if (d && d.k === 'forcemarch' && !isL) {
    const infs = orderedItems().filter(e => !e.name).concat([ent]);
    const common = ['l','c','r'].filter(s => infs.every(u => screenSecs(u.r, u.c).includes(s)));
    if (!common.length) return '강행군은 한 구역의 보병에게만 명령한다.';
  }
  if (d && d.k === 'gm' && !isL && ent.square) return '대기동: 방진 보병은 명령할 수 없다.';
  return null;
}
function setOrder(ent, isL, on) {
  ent.ordered = on;
  const d = effDef();
  if (isL && d && d.k === 'leadership') { const u = unitOfLeader(ent); if (u) { u.ordered = on; u.viaLeader = on; } }
}
function orderSummary() {
  const d = effDef(); const fb = fallbackActive();
  const items = orderedItems();
  if (fb) return `아무 유닛 1개: ${items.length}/1`;
  if (!d) return `아무 유닛 1개: ${items.length}/1`;
  if (d.sec) {
    const caps = capsFor(); const parts = [];
    for (const s of ['L', 'C', 'R']) if (caps[s] != null) parts.push(`${SEC_KO[s]} ${caps[s]}`);
    return `명령 ${items.length}/${Object.values(caps).reduce((a, b) => a + b, 0)} · ${parts.join(' · ')}`;
  }
  if (d.k === 'elan') { if (!state.tokens) return `주사위 ${cmdNow()}개를 굴린다`; const t = state.tokens; return `명령 ${items.length} · 남은 자리 기준: 보병 ${t.inf} · 기병 ${t.cav} · 포병 ${t.art} · 깃발 ${t.flag}`; }
  if (d.k === 'rally') { if (!state.tokens) return `주사위 ${cmdNow()}개를 굴린다`; const t = state.tokens; return `남은 회복: 보병 ${t.inf} · 기병 ${t.cav} · 포병 ${t.art}`; }
  const cap = capsFor().all; return `명령 ${items.length}${cap < 900 ? '/' + cap : ''}`;
}

/* ===================== MOVEMENT ===================== */
function moveAllow(u) {
  const s = st(u), d = effDef(), k = d ? d.k : '';
  if (u.square || u.lockMove) return 0;
  if (k === 'firehold' || k === 'coldsteel') return 0;
  if (k === 'gm') return 4;
  if (k === 'bombard' && s.cls === 'art') return 3;
  if (k === 'bayonet' && s.cls === 'inf') return 2;
  if (k === 'forcemarch' && s.cls === 'inf') return 2;
  if (k === 'cavcharge' && s.cls === 'cav' && s.heavy) return 3;
  if (s.cls === 'inf') return s.mv2 ? 2 : 1;
  return s.mv;
}
function passable(k, u) {
  const t = effT(k);
  if (t === 'river' || t === 'rugged') return false;
  if (t === 'quarry' && u && st(u).cls === 'art') return false;
  return true;
}
const stopsIn = k => { const t = effT(k); return t === 'forest' || t === 'town' || t === 'fw' || t === 'stream' || t === 'quarry'; };
function pathOf(m, k) { const out = [k]; let c = k; while (m.prev.has(c)) { c = m.prev.get(c); out.unshift(c); } return out; }
function reachUnit(u, allow) {
  const start = hexOf(u), res = new Map(); res.prev = new Map(); const q = [[start, 0]]; const seen = new Set([start]);
  while (q.length) {
    const [k, d] = q.shift(); if (d >= allow) continue;
    for (const n of nbrKeys(k)) {
      if (seen.has(n)) continue; seen.add(n);
      if (!passable(n, u) || unitAt(n)) continue;
      const l = leaderAt(n);
      if (l && l.side !== u.side) continue;
      res.set(n, d + 1); res.prev.set(n, k);
      if (l || stopsIn(n)) continue; // 혼자 있는 아군 리더 칸 / 정지 지형
      q.push([n, d + 1]);
    }
  }
  return res;
}
function reachLeader(l, allow) {
  const start = hexOf(l), res = new Map(); res.prev = new Map(); const q = [[start, 0]]; const seen = new Set([start]);
  while (q.length) {
    const [k, d] = q.shift(); if (d >= allow) continue;
    for (const n of nbrKeys(k)) {
      if (seen.has(n)) continue; seen.add(n);
      if (!passable(n, null)) continue;
      const u = unitAt(n), ol = leaderAt(n);
      if ((u && u.side !== l.side) || (ol && ol.side !== l.side)) continue;
      res.prev.set(n, k);
      if (!ol) res.set(n, d + 1);
      if (stopsIn(n) && !ol) continue;
      q.push([n, d + 1]);
    }
  }
  return res;
}
function doMoveUnit(u, k, steps) {
  const from = hexOf(u); const l = attLeader(u); const d = effDef();
  const carry = l && (!l.ordered || (d && d.k === 'leadership' && u.viaLeader)) && !l.moved;
  u.r = P(k)[0]; u.c = P(k)[1]; u.moved = steps;
  if (carry) { l.r = u.r; l.c = u.c; }
  const t = effT(k);
  if (t === 'town' || (t === 'forest' && !st(u).light)) u.noBattleTerr = true;
  log(`${unitLabel(u)} ← ${from}에서 ${steps}칸 이동${carry ? ' (리더 동반)' : ''}${t === 'town' || t === 'forest' ? ` · ${TERRAIN[t].ko}에 들어가 정지` : ''}`);
}
function doMoveLeader(l, k, steps) {
  const from = hexOf(l); const oldU = unitOfLeader(l);
  if (oldU && oldU.viaLeader && !oldU.moved) { oldU.ordered = false; oldU.viaLeader = false; }
  l.r = P(k)[0]; l.c = P(k)[1]; l.moved = steps;
  const nu = unitOfLeader(l);
  if (nu) nu.lockMove = true;
  log(`리더 ${l.name}: ${from} → ${k}${nu ? ` (${unitName(nu)}에 배속)` : ''}`);
}

/* ===================== COMBAT MATH ===================== */
function canBattle(u) {
  if (u.ssTurn === state.turn) return false;
  if (!u.ordered || u.battled) return false;
  const s = st(u), d = effDef(), k = d ? d.k : '';
  if (k === 'gm') return false;
  if (u.noBattleTerr) return false;
  const m = u.moved;
  if (s.cls === 'inf') {
    if (m <= 1) return true;
    if (k === 'bayonet') return true;
    if (k === 'forcemarch') return !!(s.light || s.elite || s.guard || attLeader(u));
    return false;
  }
  if (s.cls === 'cav') return true;
  if (s.foot) return m === 0;
  if (s.horse) { if (k === 'bombard') return m === 0; if (m === 0) return true; if (m === 1) return u.blocks >= 2; return false; }
  return true;
}
function rangeOf(u) { const s = st(u); if (s.horse && u.moved > 0) return 3; return s.rng || 0; }
function losCheck(a, b, shooter) {
  const [ar, ac] = P(a), [br, bc] = P(b); const [x1, y1] = ctr(ar, ac), [x2, y2] = ctr(br, bc);
  const len = Math.hypot(x2 - x1, y2 - y1); const nx = -(y2 - y1) / len, ny = (x2 - x1) / len;
  const sh = shooter, shooterOnHill = rawT(a) === 'hill', targetOnHill = rawT(b) === 'hill';
  let over = false;
  const lineBlocked = eps => {
    const N = Math.ceil(len / 4); const hexes = new Set();
    for (let i = 1; i < N; i++) { const t = i / N; const k = pixToKey(x1 + (x2 - x1) * t + nx * eps, y1 + (y2 - y1) * t + ny * eps); if (k && k !== a && k !== b) hexes.add(k); }
    for (const k of hexes) {
      const u = unitAt(k), l = leaderAt(k), t = rawT(k);
      if (u || l) {
        const fr = (u ? u.side : l.side) === sh.side;
        if (fr && sh && st(sh).cls === 'art' && shooterOnHill && dist(a, k) === 1 && rawT(k) !== 'hill') { over = true; continue; }
        return true;
      }
      if (t === 'forest' || t === 'town' || t === 'rugged') return true;
      if (t === 'hill' && !(shooterOnHill && targetOnHill)) return true;
    }
    return false;
  };
  const blocked = lineBlocked(0.6) && lineBlocked(-0.6);
  return {ok: !blocked, over};
}
function terrMods(attCls, kind, aK, dK, attSide) {
  const tA = effT(aK), tD = effT(dK); const mods = []; const add = (v, l) => { if (v) mods.push([v, l]); };
  const [ar] = P(aK), [dr] = P(dK);
  const front = (sideOfDef) => sideOfDef === 'B' ? ar > dr : ar < dr;
  const defU = unitAt(dK);
  // 목표 칸 지형 (안으로)
  if (tD === 'forest') add(attCls === 'inf' ? -1 : attCls === 'cav' ? -2 : -1, '목표가 숲');
  if (tD === 'hill') { if (tA === 'hill') { if (attCls === 'inf' && kind === 'fire') add(-1, '언덕↔언덕 사격'); } else add(attCls === 'art' ? 0 : -1, '목표가 언덕'); }
  if (tD === 'town') add(attCls === 'inf' ? -2 : attCls === 'cav' ? -3 : -1, '목표가 마을');
  if (tD === 'fw' && defU && front(defU.side)) add(attCls === 'inf' ? -1 : attCls === 'cav' ? -2 : 0, '목표가 보루(정면)');
  if (isWater(tD) && kind === 'melee') add(-1, '목표가 개울');
  if (tD === 'quarry') add(attCls === 'inf' ? (kind === 'melee' ? -1 : 0) : attCls === 'cav' ? -2 : -1, '목표가 채석장');
  // 공격자 칸 지형 (밖으로)
  if (tA === 'forest') add(attCls === 'cav' ? -2 : attCls === 'art' ? -1 : 0, '숲에서 공격');
  if (tA === 'hill' && tD !== 'hill') add(attCls === 'cav' ? -1 : 0, '언덕에서 공격');
  if (tA === 'town') add(attCls === 'cav' ? -3 : attCls === 'art' ? -1 : 0, '마을에서 공격');
  if (tA === 'fw') add(attCls === 'cav' ? -2 : 0, '보루에서 공격');
  if (isWater(tA)) add(-1, '개울에서 공격');
  if (tA === 'quarry') add(attCls === 'inf' ? -1 : attCls === 'cav' ? -2 : 0, '채석장에서 공격');
  return mods;
}
// 공격 주사위 계산. ctx: {battleBack, vsSquareCav, firstStrike}
function diceFor(att, defK, kind, ctx = {}) {
  const s = st(att), idx = s.max - att.blocks; const parts = []; let n = 0;
  const aK = hexOf(att); const def = unitAt(defK);
  if (kind === 'melee') { n = s.melee[idx]; parts.push([n, `근접 기본 (블록 ${att.blocks})`]); }
  else {
    const rng = dist(aK, defK);
    if (s.cls === 'inf') { n = (att.moved > 0 ? s.fireMv : s.fire)[idx]; parts.push([n, `사격 기본 (블록 ${att.blocks}${att.moved > 0 ? ', 이동 후' : ''})`]); }
    else { const arr = (s.horse && att.moved > 0) ? (att.blocks >= 2 ? s.m2 : null) : (att.blocks >= 2 ? s.r2 : s.r1); n = arr && arr[rng - 1] || 0; parts.push([n, `포격 거리 ${rng} (블록 ${att.blocks}${att.moved > 0 ? ', 이동 후' : ''})`]); }
  }
  if (kind === 'melee' && s.meleeVsInf && def && st(def).cls === 'inf') { n += 1; parts.push([1, '프랑스 전열보병: 보병 상대 근접']); }
  const townInvolved = effT(aK) === 'town' || effT(defK) === 'town';
  const d = effDef();
  if (!ctx.battleBack && !ctx.firstStrike && att.side === state.active && att.ordered && d) {
    const k = d.k;
    if (k === 'cavcharge' && s.cls === 'cav') { const b = s.guard ? 2 : 1; if (townInvolved) parts.push([0, '기병 돌격 보너스 (마을이라 무효)']); else { n += b; parts.push([b, '기병 돌격']); } }
    if (k === 'bayonet' && s.cls === 'inf' && s.guard && kind === 'melee') { n += 1; parts.push([1, '총검 돌격 (근위)']); }
    if (k === 'bombard' && s.cls === 'art' && att.moved === 0) { const b = s.guard ? 3 : 2; n += b; parts.push([b, '포격']); }
    if (k === 'firehold' && kind === 'fire') { n += 1; parts.push([1, '사격 후 대기']); }
    if (k === 'coldsteel' && kind === 'melee') { n += 1; parts.push([1, '저들을 베어버리자']); }
    if (k === 'elan') { n += 1; parts.push([1, '비약']); }
    if (k === 'leadership' && att.viaLeader) { n += 1; parts.push([1, '지도력']); }
  }
  if (att.square || ctx.vsSquareCav) { if (n > 1) { parts.push([1 - n, att.square ? '방진: 최대 1개' : '방진 공격: 최대 1개']); n = 1; } }
  for (const [v, l] of terrMods(s.cls, kind, aK, defK, att.side)) { n += v; parts.push([v, l]); }
  if (n < 0) { parts.push([-n, '최소 0']); n = 0; }
  return {n, parts};
}
function flagIgnore(def, attK, kind) {
  let n = 0; const why = [];
  const dK = hexOf(def), s = st(def);
  if (attLeader(def)) { n++; why.push('리더 배속'); }
  if (!def.square) { const sup = nbrKeys(dK).filter(k => { const u = unitAt(k), l = leaderAt(k); return (u && u.side === def.side) || (l && l.side === def.side); }).length; if (sup >= 2) { n++; why.push(`아군 지원 ${sup}칸`); } }
  if (effT(dK) === 'fw' && s.cls !== 'cav' && attK) { const [ar] = P(attK), [dr] = P(dK); if (def.side === 'B' ? ar > dr : ar < dr) { n++; why.push('보루'); } }
  const sc = SCENARIOS.find(x => x.id === state.scenId);
  if (sc.almeida && def.side === 'B' && sc.almeida.includes(dK)) { n++; why.push('알메이다 요새'); }
  if (s.ign) { n += s.ign; why.push(`${s.ko} ${s.ign}`); }
  return {n, why};
}
function hitsFrom(faces, defCls, kind, noSaber, mode) {
  let hits = 0, flags = 0, sabers = 0;
  faces.forEach(f => {
    if (f === 'flag') flags++;
    if (f === 'saber') sabers++;
    if (mode === 'retire') { if (f === 'cav') hits++; return; }
    if (f === defCls) hits++;
    else if (f === 'saber' && kind === 'melee' && !noSaber) hits++;
  });
  return {hits, flags, sabers};
}
function targetsFor(u) {
  const res = new Map(); if (!canBattle(u)) return res;
  const d = effDef(), k = d ? d.k : ''; const s = st(u);
  const adj = adjEnemyUnits(u);
  const meleeOK = k !== 'firehold';
  const fireOK = k !== 'bayonet' && k !== 'coldsteel' && (s.cls === 'inf' || s.cls === 'art');
  if (adj.length) { if (meleeOK) adj.forEach(e => res.set(hexOf(e), 'melee')); }
  else if (fireOK) {
    const R = rangeOf(u);
    state.units.forEach(e => {
      if (e.side === u.side) return; const dd = dist(hexOf(u), hexOf(e));
      if (dd < 2 || dd > R) return;
      if (!losCheck(hexOf(u), hexOf(e), u).ok) return;
      if (s.cls === 'art') { const arr = (s.horse && u.moved > 0) ? (u.blocks >= 2 ? s.m2 : null) : (u.blocks >= 2 ? s.r2 : s.r1); if (!arr || !arr[dd - 1]) return; }
      res.set(hexOf(e), 'fire');
    });
  }
  if (meleeOK) adjEnemyLeadersAlone(u).forEach(l => res.set(hexOf(l), 'leader'));
  return res;
}
function comboArts(att, defK) {
  return state.units.filter(a => a.side === att.side && a !== att && st(a).cls === 'art' && a.ordered && !a.battled && canBattle(a)).map(a => {
    const aK = hexOf(a), dd = dist(aK, defK);
    if (dd === 1) return {a, kind: 'melee'};
    const R = rangeOf(a); if (dd > R) return null;
    const los = losCheck(aK, defK, a); if (!los.ok || los.over) return null;
    return {a, kind: 'fire'};
  }).filter(Boolean).map(o => ({...o, dice: diceFor(o.a, defK, o.kind)})).filter(o => o.dice.n > 0);
}
