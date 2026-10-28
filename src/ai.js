/* ===================== AI 대전 =====================
   규칙 엔진을 그대로 쓰고, 사람이 누르는 버튼·칸 클릭을 AI가 대신 누른다.
   판단은 기대값 휴리스틱: 카드는 명령할 수 있는 유닛의 가치 합, 이동은 도착 칸의 공격 기대값·지형·목표·위험,
   전투는 기대 명중과 전멸 가능성이 큰 순서. 방어 질문(방진·반격·후퇴 칸 등)도 AI가 고른다. */
const AI = (() => {
  let DELAY = 380;
  const hitP = (defCls, kind, noSaber) => (defCls === 'inf' ? 2 / 6 : 1 / 6) + (kind === 'melee' && !noSaber ? 1 / 6 : 0);
  const enemies = side => state.units.filter(u => u.side !== side);
  const nearestEnemy = (k, side) => enemies(side).reduce((m, e) => Math.min(m, dist(k, hexOf(e))), 99);
  // 한 번의 공격이 주는 기대 가치: 기대 명중(전멸이면 깃발 가치 추가) + 깃발 압박 - 근접 반격 위험
  function attackValue(att, k, kind) {
    const def = unitAt(k);
    if (!def) return kind === 'leader' ? 2.5 : 0;
    const d = diceFor(att, k, kind).n; if (!d) return 0;
    const eh = d * hitP(st(def).cls, kind, st(att).noSaber);
    let v = eh * 3 + d / 6 * 1.2;
    if (eh >= def.blocks * 0.75) v += 8;
    if (attLeader(def)) v += 0.8;
    if (kind === 'melee') { const bb = diceFor(def, hexOf(att), 'melee', {battleBack: true}).n * hitP(st(att).cls, 'melee', st(def).noSaber); v -= Math.max(0, bb - eh * 0.4) * 2.2; }
    return v;
  }
  function bestTarget(u) {
    let best = null;
    targetsFor(u).forEach((kind, k) => { const v = attackValue(u, k, kind); if (!best || v > best.v) best = {k, kind, v}; });
    return best;
  }
  // 우리 진영 목표 칸 (차지하면 깃발)
  function objHexes(side) { const s = new Set(); state.objs.forEach(o => { if (o.side === side && o.cond !== 'noEnemy') o.hexes.forEach(k => s.add(k)); }); return s; }
  // 병과별 지형 선호: 보병은 숲·마을·언덕에 기대고, 기병·포병은 숲·마을을 피한다
  const TERR_DEF = {inf: {forest: 1.6, town: 2.6, church: 2.8, hill: 1.1, fw: 1.8, redoubt: 2.2}, cav: {forest: -2.5, town: -3, church: -3, hill: .2, marsh: -1.5, frozen: -1.5}, art: {forest: -1.5, town: -1, hill: 1.4, fw: 2, redoubt: 2.4}};
  // 이 칸에 서 있을 때의 가치
  function hexValue(u, k, steps, objs) {
    const save = {r: u.r, c: u.c, moved: u.moved, nb: u.noBattleTerr};
    const [r, c] = P(k); u.r = r; u.c = c; u.moved = steps;
    const t = effT(k); u.noBattleTerr = steps > 0 && (isTown(t) || (t === 'forest' && !st(u).light && !st(u).cossack));
    const bt = bestTarget(u);
    const adj = adjEnemyUnits(u);
    const threat = adj.reduce((m, e) => m + diceFor(e, k, 'melee').n * hitP(st(u).cls, 'melee', st(e).noSaber), 0);
    const near = nearestEnemy(k, u.side);
    u.r = save.r; u.c = save.c; u.moved = save.moved; u.noBattleTerr = save.nb;
    const s = st(u); let v = 0;
    if (bt) v += bt.v;
    const tv = TERR_DEF[s.cls][t] || 0; v += tv > 0 ? tv * (near <= 3 ? 1 : .35) : tv;
    if (objs.has(k)) v += 7;
    v -= threat * (s.cls === 'art' ? 2.2 : 1.1) / Math.max(1, u.blocks);
    if (!bt) v -= near * (s.cls === 'art' ? .15 : .45);
    if (s.cls === 'art' && steps > 0 && s.foot) v -= 1.5;
    return v;
  }
  // 유닛이 이번 턴에 할 일이 있는 정도 (카드 고르기·명령 순서)
  function unitPriority(u) {
    const k = hexOf(u), near = nearestEnemy(k, u.side), s = st(u);
    let v = 1;
    if (near <= 1) v += 3; else if (near <= (s.rng || (s.cls === 'cav' ? 4 : 2))) v += 2.2; else if (near <= 4) v += 1;
    if (u.blocks < umax(u) && near <= 2) v -= .6;
    if (objHexes(u.side).size && [...objHexes(u.side)].some(o => dist(o, k) <= 2)) v += 1;
    return v;
  }
  // 카드 하나를 썼다고 가정하고 명령 가능한 유닛 가치의 합을 계산한다 (상태는 되돌린다)
  function cardScore(idx) {
    const snap = JSON.stringify(state); const side = state.active; const k = state.hands[side][idx];
    let score = 0;
    try {
      const muted = SFX.on; playCard(idx);
      const d = effDef();
      if (k === 'firststrike') score = -5;
      else if (d && d.k === 'shortsupply') score = .4;
      else if (d && d.k === 'rally') score = state.units.filter(u => u.side === side && u.blocks < umax(u)).reduce((m, u) => m + (umax(u) - u.blocks), 0) * .55;
      else {
        const us = state.units.filter(u => u.side === side).sort((a, b) => unitPriority(b) - unitPriority(a));
        let n = 0;
        for (const u of us) { if (d && d.k === 'elan') { score += unitPriority(u) * .35; if (++n >= cmdNow()) break; continue; }
          if (!tryOrder(u, false)) { setOrder(u, false, true); score += unitPriority(u); } }
        if (d && ['bayonet', 'cavcharge', 'bombard', 'coldsteel', 'firehold'].includes(d.k)) score *= 1.15;
        if (d && d.scout) score += .6;
      }
      void muted;
    } catch (e) { score = 0; }
    state = JSON.parse(snap);
    return score;
  }
  const sleep2 = ms => new Promise(r => setTimeout(r, ms));
  async function idle() { for (let i = 0; i < 4000 && ui.busy; i++) await sleep2(10); }
  async function doAct(fn) { ui.aiActing = true; try { await fn(); } finally { ui.aiActing = false; } await idle(); render(); await sleep2(DELAY); }

  async function playCardStep() {
    // cardScore가 상태를 통째로 되돌리므로 손패는 매번 state에서 다시 읽는다
    const n = state.hands[state.active].length;
    let best = 0, bv = -1e9;
    for (let i = 0; i < n; i++) { const v = cardScore(i); if (v > bv) { bv = v; best = i; } }
    log(`AI: 「${CARD_BY_KEY[state.hands[state.active][best]].n}」을(를) 고름`, 'sys');
    ui.cardSel = best; await doAct(() => onAction('play'));
  }
  async function orderStep() {
    const side = state.active, d = effDef();
    if (d && (d.k === 'elan' || d.k === 'rally') && !state.rolled) await doAct(() => onAction('carddice'));
    if (d && d.k === 'rally') {
      for (const u of state.units.filter(u => u.side === side && u.blocks < umax(u)).sort((a, b) => (b.blocks / umax(b)) - (a.blocks / umax(a)))) await doAct(() => boardClick(hexOf(u)));
    } else {
      for (const u of state.units.filter(u => u.side === side).sort((a, b) => unitPriority(b) - unitPriority(a))) {
        if (!u.ordered && !tryOrder(u, false)) await doAct(() => boardClick(hexOf(u)));
      }
    }
    await doAct(() => onAction('tomove'));
  }
  async function moveStep() {
    const side = state.active, objs = objHexes(side);
    // 적에게서 먼 유닛부터 움직여 길을 막지 않게 한다
    const us = state.units.filter(u => u.side === side && u.ordered && !u.moved).sort((a, b) => nearestEnemy(hexOf(b), side) - nearestEnemy(hexOf(a), side));
    for (const u of us) {
      if (!state.units.includes(u) || u.moved) continue;
      if (typeof canExit === 'function' && canExit(u) && exitGain(u)) { ui.sel = {type: 'u', id: u.id}; await doAct(() => onAction('exit')); continue; }
      const m = reachUnit(u, moveAllow(u));
      let bestK = null, bv = hexValue(u, hexOf(u), 0, objs) + .3;
      m.forEach((steps, k) => { const v = hexValue(u, k, steps, objs); if (v > bv) { bv = v; bestK = k; } });
      if (bestK) { ui.sel = {type: 'u', id: u.id}; await doAct(() => boardClick(bestK)); }
    }
    ui.sel = null;
    await doAct(() => onAction('tobattle'));
  }
  async function battleStep() {
    const side = state.active;
    for (let guard = 0; guard < 40 && !state.winner; guard++) {
      let best = null;
      state.units.filter(u => u.side === side).forEach(u => { const t = bestTarget(u); if (t && t.v > .2 && (!best || t.v > best.v)) best = {u, ...t}; });
      if (!best) break;
      ui.sel = {type: 'u', id: best.u.id};
      const before = best.u.battled;
      await doAct(() => boardClick(best.k));
      if (state.units.includes(best.u) && !best.u.battled && before === best.u.battled) best.u.battled = true; // 공격이 취소된 경우 다시 고르지 않게
    }
    ui.sel = null;
    if (!state.winner && state.phase === 'battle') await doAct(() => onAction('endturn'));
  }

  // 질문 답하기
  async function ask(o) {
    await sleep2(DELAY * .6);
    const t = o.title || '';
    const by = l => o.buttons.find(b => b.l.includes(l));
    let b = o.buttons.find(x => x.p) || o.buttons[0];
    if (t.includes('전투 선언')) { const tg = {}; (o.toggles || []).forEach(x => { tg[x.id] = true; }); log('AI: 공격 개시', 'sys'); return {v: 'go', toggles: tg}; }
    if (t.includes('정찰: 게릴라')) b = state.guer < 2 ? o.buttons[0] : o.buttons[1];
    if (t.includes('위치확보') || t.includes('돌파')) b = o.buttons[0];
    if (t.includes('어머니 러시아')) b = o.buttons[0];
    if (!b) b = o.buttons[0];
    log(`AI의 결정: ${t} → ${b.l}`, 'sys');
    return o.toggles ? {v: b.v, toggles: {}} : b.v;
  }
  async function pick(msg, cands, extra, who) {
    await sleep2(DELAY * .5);
    const side = who || state.active;
    const arr = [...cands]; if (!arr.length) return extra ? extra.value : null;
    const danger = k => nbrKeys(k).map(unitAt).filter(x => x && x.side !== side).length;
    const friends = k => nbrKeys(k).map(unitAt).filter(x => x && x.side === side).length;
    if (/후퇴/.test(msg)) return arr.sort((a, b) => (danger(a) - danger(b)) || (friends(b) - friends(a)))[0];
    if (/추가 근접공격/.test(msg)) { const sorted = arr.map(k => ({k, u: unitAt(k)})).sort((a, b) => (a.u ? a.u.blocks : 0) - (b.u ? b.u.blocks : 0)); return sorted[0].k; }
    if (/한 칸 더/.test(msg)) { const safe = arr.filter(k => danger(k) <= 1); return safe.length && extra ? extra.value : (arr.sort((a, b) => danger(a) - danger(b))[0]); }
    if (/블록을 1개 더할|코사크|보루/.test(msg)) return arr.sort((a, b) => nearestEnemy(a, side) - nearestEnemy(b, side))[0];
    if (/보급 부족/.test(msg) && /대상 유닛/.test(msg)) { const en = arr.filter(k => { const u = unitAt(k); return u && u.side !== side; }); return (en.length ? en : arr).sort((a, b) => nearestEnemy(b, other(side)) - nearestEnemy(a, other(side)))[0]; }
    if (/선제 공격/.test(msg)) return arr[0];
    return arr[0];
  }

  async function run() {
    if (ui.aiRunning || !aiTurn() || state.winner) return;
    ui.aiRunning = true; render();
    try {
      for (let guard = 0; guard < 200 && aiTurn() && !state.winner && !ui.newGame; guard++) {
        await idle();
        const ph = state.phase;
        if (ph === 'start') await doAct(() => onAction('reveal'));
        else if (ph === 'card') await playCardStep();
        else if (ph === 'order') await orderStep();
        else if (ph === 'move') await moveStep();
        else if (ph === 'battle') await battleStep();
        else if (ph === 'scout') { ui.cardSel = 0; await doAct(() => onAction('scoutkeep')); }
        else if (ph === 'end') { ui.cardSel = 0; await doAct(() => onAction('keep')); }
        else if (ph === 'pre') { const i = state.hands[state.active].findIndex(k => CARD_BY_KEY[k].pre); await doAct(() => onAction('card', {dataset: {i}})); }
      }
    } catch (e) { console.error(e); toast('AI 오류: ' + e.message); }
    finally { ui.aiRunning = false; ui.aiActing = false; undoStack.length = 0; save(); render(); }
  }
  return {run, ask, pick, cardScore, hexValue, attackValue, setDelay: ms => { DELAY = ms; }};
})();
