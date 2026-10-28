/* ===================== ASYNC UI PRIMITIVES ===================== */
const ui = {sel: null, picking: null, prompt: null, busy: false, dice: null, edit: false, paint: null, add: null, cardSel: null, tab: 'game', toast: null, editSel: null};
const undoStack = [];
const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const scen = () => SCENARIOS.find(s => s.id === state.scenId);
function localAsk(o) { return new Promise(res => { ui.prompt = Object.assign({}, o, {resolve: v => { ui.prompt = null; res(v); render(); }}); render(); }); }
// AI 대전: AI 진영의 결정(그리고 AI 차례에 누구의 것도 아닌 질문)은 AI가 답한다
const aiAnswers = who => isAI() && (who ? who === state.aiSide : state.active === state.aiSide);
const humanTurn = () => NET.myTurn && !aiTurn();
function ask(o) { if (aiAnswers(o.who)) return AI.ask(o); return NET.remote(o.who) ? NET.ask('ask', o) : localAsk(o); }
function pickHex(msg, cands, extra, who) {
  if (aiAnswers(who)) return AI.pick(msg, cands, extra, who);
  if (NET.remote(who)) return NET.ask('pick', {msg, cands, extra: extra || null, who});
  return localPick(msg, cands, extra, who);
}
function localPick(msg, cands, extra, who) {
  return new Promise(res => { ui.picking = {msg, who: who || null, cands: new Set(cands), extra: extra || null, resolve: k => { ui.picking = null; res(k); render(); }}; render(); });
}
async function rollDice(n, label) {
  const faces = Array.from({length: Math.max(0, n)}, () => FACES[rand6()]);
  ui.dice = {label, faces, rolling: true, note: ''}; render(); SFX.raw('dice', n); NET.emit('dice', {label, faces});
  await sleep(reduceMotion ? 60 : 520);
  ui.dice.rolling = false; render();
  log(`🎲 ${label}: ${faces.length ? faces.map(f => FACE_KO[f]).join('·') : '주사위 0개'}`, 'dice');
  return faces;
}
function diceNote(t) { if (ui.dice) ui.dice.note = t; NET.emit('note', t); }
function toast(m) { ui.toast = m; render(); clearTimeout(toast._t); toast._t = setTimeout(() => { ui.toast = null; render(); }, 2600); }
function pushUndo() { undoStack.push(JSON.stringify(state)); if (undoStack.length > 80) undoStack.shift(); }
function undo() { if (ui.busy || ui.aiRunning || !undoStack.length || !humanTurn()) return; state = JSON.parse(undoStack.pop()); ui.busy = true; NET.push(); ui.busy = false; ui.sel = null; ui.cardSel = null; ui.dice = null; save(); render(); toast('한 단계 되돌렸다.'); }
async function act(fn, noUndo) {
  if (ui.busy) return; if (!noUndo) pushUndo(); ui.busy = true;
  try { await fn(); } catch (e) { if (e instanceof CancelErr) { undoStack.pop(); } else { console.error(e); toast('오류: ' + e.message); } }
  finally { ui.picking = null; ui.prompt = null; if (state) { refreshHeld(); checkWin(); } try { NET.push(); } catch (e) {} ui.busy = false; save(); render(); }
}
function save() { try { localStorage.setItem('cnc-solo-save', JSON.stringify(state)); } catch (e) {} }

/* ===================== COMBAT FLOW ===================== */
function backSteps(u, k) { const dir = u.side === 'B' ? -1 : 1; const [r, c] = P(k);
  return nbrs(r, c).filter(([nr]) => nr === r + dir).map(([a, b]) => K(a, b)).filter(nk => passable(nk, u) && !unitAt(nk) && !(leaderAt(nk) && leaderAt(nk).side !== u.side)); }
// 상태를 바꾼 뒤 지도를 다시 그리고 경로를 따라 움직임을 보여 준다
async function animMove(ent, keys) {
  if (!keys || keys.length < 2) return;
  render();
  const isUnit = !ent.name; const cls = isUnit ? st(ent).cls : 'cav';
  if (!isUnit && unitAt(hexOf(ent))) return;
  await FX.move(ent.id, keys, cls);
}
function canRetire(u) { return backSteps(u, hexOf(u)).some(k => backSteps(u, k).length > 0); }

async function takeHits(u, hits, bySide, chk) {
  if (hits <= 0) return {dead: false};
  const l = attLeader(u);
  await FX.hit(u.id, hexOf(u), Math.min(hits, u.blocks));
  u.blocks -= hits;
  if (u.blocks <= 0) { await FX.destroy(u.id, hexOf(u)); await eliminate(u, bySide, l, chk); return {dead: true}; }
  render();
  log(`${unitLabel(u)} 블록 ${hits}개 손실 → ${u.blocks}개 남음`, 'hit');
  if (l && !chk.checked) {
    chk.checked = true;
    const f = await rollDice(2, `리더 ${l.name} 피해 확인 (칼 2개면 전사)`);
    if (f.filter(x => x === 'saber').length === 2) killLeader(l, bySide); else log(`리더 ${l.name} 무사`);
  }
  return {dead: false};
}
function killLeader(l, bySide) { FX.float(hexOf(l), '리더 전사', '#fff', '#7a1d16'); SFX.play('die'); state.leaders = state.leaders.filter(x => x !== l); log(`리더 ${l.name} 전사`, 'warn');
  // 아우어슈테트: 프랑스가 프로이센 리더를 쓰러뜨리면 승리깃발 2개
  const lv = scen().leaderVb; award(bySide, lv && lv.side === bySide ? lv.vb : 1, `리더 ${l.name}`); }
async function eliminate(u, bySide, l, chk) {
  if (u.square) releaseSquare(u);
  state.units = state.units.filter(x => x !== u);
  log(`${unitLabel(u)} 전멸`, 'warn');
  let n = 1; const sc = scen();
  if (state.killed) state.killed[u.side][st(u).cls]++;
  if (sc.infBonus === u.side && st(u).cls === 'inf') { n = state.garcia === 0 ? 1 : 2; state.garcia++; }
  if (st(u).cossack) { n = 0; log('코사크는 전멸해도 승리깃발을 주지 않는다'); }
  // 크라스노이: 다부의 전열보병은 2개를 전멸시킬 때마다 깃발 1개
  if (u.tag === 'dav') { state.davKilled++; n = state.davKilled % 2 === 0 ? 1 : 0; if (!n) log('다부의 전열보병: 2개째를 전멸시켜야 깃발 1개'); }
  if (n) award(bySide, n, `${unitName(u)} 전멸`);
  // 바일렌: 프랑스 쪽 스위스군 2개가 전멸하면 남은 프랑스 스위스군도 이탈 (깃발 없음)
  if (sc.swissBailen && u.nat === 'W' && u.side === 'F' && ++state.swissGone === 2) {
    const rest = state.units.filter(x => x.nat === 'W' && x.side === 'F');
    rest.forEach(x => { const xl = attLeader(x); state.units = state.units.filter(y => y !== x); log(`${unitLabel(x)} 편을 바꿔 전장을 떠났다 (깃발 없음)`, 'warn'); if (xl) state.leaders = state.leaders.filter(y => y !== xl); });
  }
  if (l) {
    if (!chk.checked) {
      chk.checked = true;
      const f = await rollDice(1, `리더 ${l.name} 피해 확인 (칼이면 전사)`);
      if (f[0] === 'saber') { killLeader(l, bySide); refreshHeld(); return; }
      log(`리더 ${l.name} 무사`);
    }
    await leaderRetreat(l);
  }
  refreshHeld();
}
async function leaderRetreat(l) {
  if (!state.leaders.includes(l)) return;
  const dir = l.side === 'B' ? -1 : 1, base = l.side === 'B' ? 0 : 8;
  const walk = (passEnemy) => { const out = new Set(); let blocked = null;
    const go = (k, d) => { if (d === 3) return; const [r, c] = P(k);
      for (const [nr, nc] of nbrs(r, c)) { if (nr !== r + dir) continue; const nk = K(nr, nc); if (!passable(nk, null)) continue;
        const u = unitAt(nk), ol = leaderAt(nk); const enemy = (u && u.side !== l.side) || (ol && ol.side !== l.side);
        if (enemy) { if (!blocked && u) blocked = u; if (!passEnemy) continue; }
        if (!enemy && (!ol || ol === l)) out.add(nk);
        go(nk, d + 1); } };
    go(hexOf(l), 0); return {out, blocked}; };
  let {out, blocked} = walk(false);
  const rowsToBase = Math.abs(l.r - base);
  const extra = rowsToBase < 3 ? {label: '전장 밖으로 (깃발 없음)', value: 'off'} : null;
  if (!out.size && blocked && !extra) {
    const n = byB(st(blocked).melee, blocked.blocks);
    const f = await rollDice(n, `리더 ${l.name} 탈출: ${unitLabel(blocked)} 주사위`);
    if (f.includes('saber')) { killLeader(l, blocked.side); return; }
    out = walk(true).out;
  }
  if (!out.size && !extra) { log(`리더 ${l.name}이(가) 후퇴할 곳이 없어 제거됨`, 'warn'); killLeader(l, other(l.side)); return; }
  const k = await pickHex(`리더 ${l.name} 후퇴: 자기 쪽으로 1~3칸`, [...out], extra, l.side);
  if (k === 'off' || !k) { state.leaders = state.leaders.filter(x => x !== l); log(`리더 ${l.name} 전장 밖으로 후퇴 (상대 깃발 없음)`); return; }
  const from = hexOf(l); l.r = P(k)[0]; l.c = P(k)[1]; log(`리더 ${l.name} → ${k} 후퇴`);
  await animMove(l, [from, k]);
}
async function retreatUnit(u, steps, chk) {
  let moved = 0;
  for (let i = 0; i < steps; i++) {
    if (!state.units.includes(u)) return {retreated: moved > 0, dead: true};
    const cands = backSteps(u, hexOf(u));
    if (!cands.length) {
      const left = steps - i; log(`${unitLabel(u)} 후퇴할 칸이 없어 블록 ${left}개 손실`, 'warn');
      const res = await takeHits(u, left, other(u.side), chk); return {retreated: moved > 0, dead: res.dead};
    }
    const nk = cands.length === 1 ? cands[0] : await pickHex(`${unitLabel(u)} 후퇴 (${steps - i}칸 남음): 자기 쪽 칸을 고르세요`, cands, null, u.side);
    const l = attLeader(u); const [r, c] = P(nk); const from = hexOf(u);
    u.r = r; u.c = c; if (l) { l.r = r; l.c = c; }
    moved++;
    await animMove(u, [from, nk]);
    const ol = leaderAt(nk);
    if (ol && ol !== l && ol.side === u.side) { log(`${unitLabel(u)}이(가) 리더 ${ol.name}의 칸에서 후퇴를 멈춘다`); break; }
  }
  if (moved) log(`${unitLabel(u)} ${moved}칸 후퇴`);
  return {retreated: moved > 0, dead: false};
}
async function resolveFlags(u, flags, attK, kind, chk, bounce) {
  if (!flags || !state.units.includes(u)) return {retreated: false};
  const ign = bounce ? {n: 0, why: []} : flagIgnore(u, attK, kind);
  const use = Math.min(flags, ign.n); let rem = flags - use;
  if (use) log(`${unitLabel(u)} 깃발 ${use}개 무시 (${ign.why.join(', ')})`);
  // 프로이센 강철 같은 의지: 무시하지 못한 깃발을 카운터 1개당 1개 더 무시
  if (rem && !bounce && u.side === 'B' && state.iron > 0) {
    const mx = Math.min(rem, state.iron);
    const k = await ask({title: '강철 같은 의지?', who: u.side, body: `${unitLabel(u)}: 남은 깃발 ${rem}개. 강철 같은 의지 카운터(지금 ${state.iron}개)를 1개 쓸 때마다 깃발 1개를 무시한다. 쓴 카운터는 사라진다.`,
      buttons: Array.from({length: mx}, (_, i) => ({l: `${mx - i}개 사용`, v: mx - i, p: i === 0 ? 1 : 0})).concat([{l: '쓰지 않음', v: 0}])});
    if (k) { state.iron -= k; rem -= k; log(`${SIDE_KO[u.side]} 강철 같은 의지 ${k}개 사용 → 깃발 ${k}개 무시 (남은 카운터 ${state.iron}개)`, 'card'); }
  }
  if (bounce) log(`추방 깃발 ${flags}개: 기병은 무시할 수 없다`);
  if (!rem) { if (use) FX.float(hexOf(u), '깃발 무시', '#f2e6b8', '#3a2f10'); return {retreated: false}; }
  FX.float(hexOf(u), `깃발 ${rem}`, '#fff', '#222'); SFX.play('flag');
  if (u.square) { log(`${unitLabel(u)} 방진은 후퇴할 수 없다 → 블록 ${rem}개 손실`, 'warn'); const res = await takeHits(u, rem, other(u.side), chk); return {retreated: false, dead: res.dead}; }
  const per = bounce ? 1 : (st(u).retreat || 1);
  // 프로이센 전열보병: 첫 깃발은 1칸, 다음 깃발마다 2칸
  return await retreatUnit(u, per === 'k' ? 1 + (rem - 1) * 2 : rem * per, chk);
}
async function declare(att, defK, kind) {
  const isL = kind === 'leader';
  const main = diceFor(att, defK, isL ? 'melee' : kind);
  const arts = (kind === 'melee' && !isL) ? comboArts(att, defK) : [];
  const def = unitAt(defK);
  const body = `<div class="dec"><div class="dec-row"><b>${unitLabel(att)}</b> → <b>${isL ? '리더 ' + leaderAt(defK).name : unitLabel(def)}</b> · ${kind === 'fire' ? '원거리 사격' : '근접전투'}</div>
    <ul class="parts">${main.parts.map(([v, l]) => `<li><span>${l}</span><span class="pv ${v < 0 ? 'neg' : ''}">${v > 0 && main.parts[0][1] !== l ? '+' : ''}${v}</span></li>`).join('')}</ul>
    <div class="dec-total">주사위 <b>${main.n}</b>개${isL ? ' · 칼이 하나라도 나오면 리더 전사' : ` · 명중 기호: ${FACE_KO[st(def).cls]}${kind === 'melee' && !st(att).noSaber ? ' + 칼' : ''}`}</div></div>`;
  const toggles = arts.map(o => ({id: o.a.id, label: `연합전투: ${unitLabel(o.a)} +${o.dice.n}`, on: false}));
  const v = await ask({title: '전투 선언', body, toggles, buttons: [{l: '주사위 굴리기', v: 'go', p: 1}, {l: '취소', v: null}]});
  if (!v || v.v !== 'go') return null;
  return {arts: arts.filter(o => v.toggles[o.a.id])};
}
async function combat(att, defK, kind, opts) {
  opts = opts || {}; const aStart = hexOf(att), aS = st(att);
  if (kind === 'leader') return leaderAttack(att, defK, opts);
  const def = unitAt(defK); if (!def) return; const dS = st(def);
  const arts = opts.arts || [];
  att.battled = true;
  // 1. 방진
  if (kind === 'melee' && aS.cls === 'cav' && dS.cls === 'inf' && canFormSquare(def)) {
    const v = await ask({title: '방진을 짤까?', body: `${unitLabel(def)}이(가) 기병의 근접공격을 받는다.<br><small>방진은 기병보다 먼저 주사위 1개를 굴리고, 깃발이 나오면 기병을 1칸 밀어낸다(무시 불가). 방진은 이동할 수 없고 주사위가 최대 1개다. ${isDuo() ? '2인 규칙: 손패에서 무작위로 1장이 방진표로 가서 지휘능력이 준다. 방진을 풀거나 전멸하면 돌아온다.' : '솔로: 군당 최대 4개, 2개 이상이면 턴 종료 때 카드를 1장 덜 받는다.'}</small>`,
      buttons: [{l: '방진을 짠다', v: true, p: 1}, {l: '그대로 싸운다', v: false}], who: def.side});
    if (v) { formSquare(def); SFX.play('square'); render(); }
  }
  // 2. 퇴각 및 재편성
  if (kind === 'melee' && dS.cls === 'cav' && aS.cls === 'inf' && !opts.firstStrike && canRetire(def)) {
    const v = await ask({title: '퇴각 및 재편성?', body: `${unitLabel(def)}이(가) 보병의 근접공격을 받는다. 퇴각 및 재편성을 하면 공격자의 기병 기호만 명중하고, 그 뒤 2칸 후퇴한다(반격 없음).`,
      buttons: [{l: '퇴각 및 재편성', v: true, p: 1}, {l: '그대로 싸운다', v: false}], who: def.side});
    if (v) return retireReform(att, def, arts, aStart);
  }
  // 3. 방진이 기병보다 먼저 사격
  if (kind === 'melee' && def.square && aS.cls === 'cav') {
    const sq = diceFor(def, aStart, 'melee', {battleBack: true});
    SFX.play('volley', 3); FX.dust(...ctr(...P(defK)));
    const f = await rollDice(sq.n, `방진 선공: ${unitLabel(def)} → ${unitLabel(att)}`);
    const r = hitsFrom(f, 'cav', 'melee', dS.noSaber);
    diceNote(`명중 ${r.hits} · 추방 깃발 ${r.flags}`);
    const chk = {checked: false};
    const res = await takeHits(att, r.hits, def.side, chk);
    if (res.dead) { arts.forEach(o => o.a.battled = true); log('기병이 쓰러져 공격이 끝났다 (연합 포병 주사위도 사라짐)'); return; }
    if (r.flags) { const rr = await resolveFlags(att, r.flags, defK, 'melee', chk, true); if (rr.retreated || rr.dead) { arts.forEach(o => o.a.battled = true); log('기병이 밀려나 공격하지 못했다'); return; } }
  }
  // 3b. 2인 규칙: 방어측 선제 공격
  let fsUsed = false;
  if (isDuo() && kind === 'melee' && !opts.firstStrike && !(state.folly === state.turn && def.side === 'B') && state.hands[def.side].includes('firststrike') && !(def.square && aS.cls === 'cav') && def.ssTurn !== state.turn) {
    const d0 = diceFor(def, aStart, 'melee', {battleBack: true});
    const v = await ask({title: '선제 공격?', who: def.side, body: `${SIDE_KO[def.side]} 플레이어: 손에 <b>선제 공격</b> 카드가 있다. 쓰면 ${unitLabel(def)}이(가) 먼저 주사위 ${d0.n}개로 공격한다. 공격자가 밀려나지 않으면 원래 공격이 이어지고, 이 전투에서는 반격하지 않는다. 턴이 끝날 때 1장을 받는다.`,
      buttons: [{l: '선제 공격 사용', v: true, p: 1}, {l: '쓰지 않음', v: false}]});
    if (v) {
      fsUsed = true; const h = state.hands[def.side]; h.splice(h.indexOf('firststrike'), 1); state.discard.push('firststrike'); state.fsRefill.push(def.side);
      log(`${SIDE_KO[def.side]}: 「선제 공격」 사용`, 'card'); SFX.play('card');
      await FX.lunge(def.id, defK, aStart, dS.cls);
      const f0 = await rollDice(d0.n, `선제 공격: ${unitLabel(def)} → ${unitLabel(att)}`);
      const r0 = hitsFrom(f0, aS.cls, 'melee', dS.noSaber);
      // 선제 공격 카드를 쓴 창기병은 깃발 재굴림을 쓸 수 있다
      if (dS.lancer && r0.flags && !aS.cuir) { const fr = await rollDice(r0.flags, `창기병 깃발 재굴림 (${r0.flags}개)`); const rr = hitsFrom(fr, aS.cls, 'melee', dS.noSaber); r0.hits += rr.hits; r0.flags = rr.flags; }
      diceNote(`명중 ${r0.hits} · 깃발 ${r0.flags}`);
      const chk0 = {checked: false};
      const res0 = await takeHits(att, r0.hits, def.side, chk0);
      let pushed = res0.dead;
      if (!res0.dead && r0.flags) { const rr = await resolveFlags(att, r0.flags, defK, 'melee', chk0); pushed = rr.retreated || rr.dead; }
      if (pushed || !state.units.includes(att)) { arts.forEach(o => o.a.battled = true); log('선제 공격으로 공격이 무산됐다'); return; }
    }
  }
  // 4. 공격
  if (kind === 'melee') await FX.lunge(att.id, aStart, defK, aS.cls);
  else await FX.fire(aStart, defK, aS.cls, att.blocks);
  for (const o of arts) await FX.fire(hexOf(o.a), defK, 'art', 1);
  const main = diceFor(att, defK, kind, {vsSquareCav: kind === 'melee' && def.square && aS.cls === 'cav', firstStrike: opts.firstStrike});
  let n = main.n; arts.forEach(o => { n += o.dice.n; o.a.battled = true; });
  const faces = await rollDice(n, `${opts.firstStrike ? '선제 공격 ' : ''}${unitLabel(att)} → ${unitLabel(def)} ${kind === 'melee' ? '근접' : '사격'}${arts.length ? ' (연합)' : ''}`);
  const r = hitsFrom(faces, dS.cls, kind, aS.noSaber);
  // 창기병: 명령받은 창기병의 근접공격에서 나온 깃발을 한 번 다시 굴린다 (흉갑기병 상대는 안 됨)
  if (aS.lancer && kind === 'melee' && r.flags && !dS.cuir && att.side === state.active) {
    const f2 = await rollDice(r.flags, `창기병 깃발 재굴림 (${r.flags}개)`); const r2 = hitsFrom(f2, dS.cls, kind, aS.noSaber);
    r.hits += r2.hits; r.flags = r2.flags;
  }
  // 흉갑기병: 보병의 사격 명중 1개 무시
  if (dS.cuir && kind === 'fire' && aS.cls === 'inf' && r.hits > 0) { r.hits--; log(`${unitLabel(def)} 흉갑: 보병 사격 명중 1개 무시`); }
  diceNote(`명중 ${r.hits} · 깃발 ${r.flags}`);
  if (!r.hits && !r.flags) { SFX.play('miss'); FX.float(defK, '빗나감', '#e8f0e8', '#2b3d34'); }
  const chk = {checked: false};
  const dr = await takeHits(def, r.hits, att.side, chk);
  let retreated = false;
  if (!dr.dead && r.flags) { const fr = await resolveFlags(def, r.flags, aStart, kind, chk); retreated = !!fr.retreated; }
  // 5. 반격
  let bb = false;
  const defAlive = state.units.includes(def) && hexOf(def) === defK;
  if (kind === 'melee' && !opts.firstStrike && !fsUsed && defAlive && state.units.includes(att) && !(def.square && aS.cls === 'cav') && def.ssTurn !== state.turn) {
    const d2 = diceFor(def, hexOf(att), 'melee', {battleBack: true});
    const go = await ask({title: '반격', body: `${unitLabel(def)}이(가) 자리를 지켰다. 주사위 ${d2.n}개로 반격할 수 있다.<br><small>${d2.parts.map(([v, l]) => `${l} ${v > 0 ? '+' : ''}${v}`).join(' · ')}</small>`, buttons: [{l: `반격 (${d2.n}개)`, v: true, p: 1}, {l: '반격하지 않음', v: false}], who: def.side});
    if (go) {
      bb = true;
      await FX.lunge(def.id, defK, hexOf(att), dS.cls);
      const f2 = await rollDice(d2.n, `반격: ${unitLabel(def)} → ${unitLabel(att)}`);
      const r2 = hitsFrom(f2, aS.cls, 'melee', dS.noSaber);
      diceNote(`명중 ${r2.hits} · 깃발 ${r2.flags}`);
      const chk2 = {checked: false};
      const ar = await takeHits(att, r2.hits, def.side, chk2);
      if (!ar.dead && r2.flags) await resolveFlags(att, r2.flags, defK, 'melee', chk2);
    }
  }
  // 6. 위치확보 / 돌파
  if (kind === 'melee' && !opts.firstStrike && !fsUsed && !bb && state.units.includes(att) && hexOf(att) === aStart && !unitAt(defK) && !(leaderAt(defK) && leaderAt(defK).side !== att.side) && aS.cls !== 'art' && !att.square && passable(defK, att)) {
    await advance(att, defK, opts);
  }
}
async function retireReform(att, def, arts, aStart) {
  const dK = hexOf(def);
  const main = diceFor(att, dK, 'melee'); let n = main.n; arts.forEach(o => { n += o.dice.n; o.a.battled = true; });
  SFX.play('volley', n);
  const f = await rollDice(n, `퇴각 및 재편성: ${unitLabel(att)} → ${unitLabel(def)} (기병 기호만 명중)`);
  const r = hitsFrom(f, 'cav', 'melee', true, 'retire');
  diceNote(`명중 ${r.hits}`);
  const chk = {checked: false};
  const res = await takeHits(def, r.hits, att.side, chk);
  if (!res.dead) await retreatUnit(def, 2, chk);
  if (state.units.includes(att) && hexOf(att) === aStart && !unitAt(dK) && passable(dK, att)) await advance(att, dK, {});
}
async function leaderAttack(att, lk, opts) {
  const l = leaderAt(lk); const aStart = hexOf(att);
  const d = diceFor(att, lk, 'melee'); att.battled = true;
  await FX.lunge(att.id, aStart, lk, st(att).cls);
  const f = await rollDice(d.n, `${unitLabel(att)} → 리더 ${l.name} 근접 (칼이면 전사)`);
  if (f.includes('saber')) killLeader(l, att.side); else { log(`리더 ${l.name} 무사 → 후퇴`); await leaderRetreat(l); }
  if (!leaderAt(lk) && !unitAt(lk) && hexOf(att) === aStart && st(att).cls !== 'art') await advance(att, lk, opts);
}
async function advance(att, vk, opts) {
  const aS = st(att); const from = hexOf(att);
  const imp = scen().impetuous && att.nat === 'B' && aS.cls === 'cav';
  const name = aS.cls === 'cav' ? '돌파' : '위치확보';
  const go = imp ? true : await ask({title: name, body: `${unitLabel(att)}이(가) 근접전투에서 이겼다. 비게 된 ${vk} 칸으로 전진할 수 있다.${aS.cls === 'cav' && !opts.bonus ? '<br><small>기병은 전진한 뒤 한 칸 더 움직이고, 추가 근접공격을 1번 할 수 있다.</small>' : ''}`,
    buttons: [{l: `${name}: ${vk}로 전진`, v: true, p: 1}, {l: '제자리', v: false}], who: att.side});
  if (!go) return;
  if (imp) log('충동적인 영국 기병: 반드시 돌파한다', 'warn');
  const l = attLeader(att); const [r, c] = P(vk); att.r = r; att.c = c; if (l) { l.r = r; l.c = c; }
  log(`${unitLabel(att)} ${name} → ${vk}`);
  await animMove(att, [from, vk]);
  if (aS.cls !== 'cav' || opts.bonus) return;
  if (!stopsIn(vk)) {
    const opts2 = nbrKeys(vk).filter(k => passable(k, att) && !unitAt(k) && !leaderAt(k));
    if (opts2.length) {
      const k2 = await pickHex('돌파: 한 칸 더 움직일 칸을 고르세요 (원래 칸으로 돌아가도 된다)', opts2, imp ? null : {label: '여기서 멈춤', value: null});
      if (k2) { const [r2, c2] = P(k2); att.r = r2; att.c = c2; if (l) { l.r = r2; l.c = c2; } log(`${unitLabel(att)} 추가 이동 → ${k2}`); await animMove(att, [vk, k2]); }
    }
  }
  if (!att.bonusUsed) {
    const tg = adjEnemyUnits(att).map(hexOf).concat(adjEnemyLeadersAlone(att).map(hexOf));
    if (tg.length) {
      const k3 = await pickHex('추가 근접공격: 인접한 적을 고르세요', tg, {label: '추가공격 안 함', value: null});
      if (k3) {
        att.bonusUsed = true;
        if (!unitAt(k3)) { await combat(att, k3, 'leader', {bonus: true}); return; }
        const dec = await declare(att, k3, 'melee');
        if (dec) await combat(att, k3, 'melee', {bonus: true, arts: dec.arts});
      }
    }
  }
}

/* ===================== PRE CARDS (SOLO) ===================== */
async function playFirstStrike() {
  const side = state.active;
  const atts = state.units.filter(u => u.side === side && adjEnemyUnits(u).length);
  if (!atts.length) { log('선제 공격: 적과 인접한 아군 유닛이 없어 효과 없이 버렸다.'); return; }
  const ak = await pickHex('선제 공격: 공격할 아군 유닛을 고르세요 (적과 인접)', atts.map(hexOf), {label: '사용하지 않고 버림', value: null});
  if (!ak) { log('선제 공격을 사용하지 않고 버렸다.'); return; }
  const att = unitAt(ak);
  const tk = await pickHex('선제 공격: 인접한 적 유닛을 고르세요', adjEnemyUnits(att).map(hexOf), {label: '사용하지 않고 버림', value: null});
  if (!tk) return;
  await combat(att, tk, 'melee', {firstStrike: true});
  if (state.units.includes(att)) att.battled = false;
}
async function playShortSupply() {
  const cands = state.units.filter(u => !u.square).map(hexOf);
  const k = await pickHex('보급 부족: 대상 유닛을 고르세요 (적·아군 모두 가능)', cands, {label: '사용하지 않고 버림', value: null});
  if (!k) { log('보급 부족을 사용하지 않고 버렸다.'); return; }
  const u = unitAt(k); const base = u.side === 'B' ? 0 : 8, step = u.side === 'B' ? 1 : -1;
  const secs = screenSecs(u.r, u.c); let dest = [];
  for (const row of [base, base + step]) {
    for (let c = 0; c < ncols(row); c++) { const nk = K(row, c);
      if (!screenSecs(row, c).some(s => secs.includes(s))) continue;
      if (nk !== k && (!passable(nk, u) || unitAt(nk) || (leaderAt(nk) && leaderAt(nk).side !== u.side))) continue;
      dest.push(nk); }
    if (dest.length) break;
  }
  u.ssTurn = state.turn;
  if (!dest.length) { log(`보급 부족: ${unitLabel(u)}을(를) 보낼 칸이 없다. 이번 턴 전투 불가.`); return; }
  const dk = await pickHex(`보급 부족: ${unitLabel(u)}을(를) 보낼 칸 (같은 구역 맨 끝 열)`, dest, null, u.side);
  const l = attLeader(u); const [r, c] = P(dk); u.r = r; u.c = c; if (l) { l.r = r; l.c = c; }
  log(`보급 부족: ${unitLabel(u)} → ${dk}, 이번 턴 전투 불가`, 'warn');
  await animMove(u, [k, dk]);
}
async function rollCardDice() {
  const d = effDef(); const n = cmdNow();
  const f = await rollDice(n, `${d.n} 주사위 ${n}개`);
  const t = {inf: 0, cav: 0, art: 0, flag: 0};
  f.forEach(x => { if (t[x] != null) t[x]++; });
  if (d.k === 'rally') delete t.flag;
  state.tokens = t; state.rolled = true;
  diceNote(d.k === 'elan' ? `보병 ${t.inf} · 기병 ${t.cav} · 포병 ${t.art} · 깃발 ${t.flag} 명령` : `보병 ${t.inf} · 기병 ${t.cav} · 포병 ${t.art} 회복`);
}

/* ===================== 확장 규칙 ===================== */
// 전투 전 어머니 러시아 굴림: 러시아가 카드를 받기 직전, 받을 카드 수만큼 주사위
async function motherRussia(side, n) {
  const sc = scen(); if (!sc.mr || side !== 'B' || state.top !== 'R' || n <= 0) return;
  const f = await rollDice(n, `어머니 러시아 (주사위 ${n}개)`);
  const fresh = t => state.units.filter(u => u.side === 'B' && u.t === t && !u.max);
  const opts = {
    inf: {l: '전열보병 +1블록', ok: () => fresh('R-LN').length, go: () => boost(fresh('R-LN'), '전열보병')},
    art: {l: '포병 +1블록', ok: () => fresh('R-FA').length, go: () => boost(fresh('R-FA'), '도보포병')},
    flag: {l: '경보병 +1블록', ok: () => fresh('R-LT').length, go: () => boost(fresh('R-LT'), '경보병')},
    cav: {l: '코사크 배치', ok: () => sc.mr.cav !== false && cossackHexes().length, go: placeCossack},
    saber: {l: '2면 보루 놓기', ok: () => sc.mr.saber !== false && fwCands().length, go: placeFW},
  };
  for (const face of f) {
    if (face === 'flag') {
      const avail = Object.entries(opts).filter(([, o]) => o.ok());
      if (!avail.length) { log('어머니 러시아: 깃발 → 쓸 곳이 없다'); continue; }
      const v = await ask({title: '어머니 러시아: 깃발', who: 'B', body: '깃발은 경보병 강화, 또는 다른 결과 하나를 골라 쓸 수 있다.', buttons: avail.map(([k, o], i) => ({l: o.l, v: k, p: i === 0 ? 1 : 0})).concat([{l: '쓰지 않음', v: null}])});
      if (v) await opts[v].go();
    } else if (opts[face] && opts[face].ok()) await opts[face].go();
    else log(`어머니 러시아: ${FACE_KO[face]} → 효과 없음`);
    render();
  }
}
async function boost(list, nm) {
  const k = list.length === 1 ? hexOf(list[0]) : await pickHex(`어머니 러시아: 블록을 1개 더할 ${nm}을 고르세요`, list.map(hexOf), {label: '건너뜀', value: null}, 'B');
  if (!k) return; const u = unitAt(k); u.max = st(u).max + 1; u.blocks++;
  log(`어머니 러시아: ${unitLabel(u)} 블록 +1 (최대 ${u.max})`, 'vb'); FX.float(k, '+1', '#fff', '#2f7a3b');
}
function cossackHexes() { const out = []; for (let c = 0; c < ncols(0); c++) { const k = K(0, c); if (passable(k) && !unitAt(k) && !leaderAt(k) && !nbrKeys(k).some(n => { const x = unitAt(n); return x && x.side === 'F'; })) out.push(k); } return out; }
async function placeCossack() {
  const k = await pickHex('어머니 러시아: 코사크(블록 2개)를 놓을 러시아 끝 열 칸을 고르세요', cossackHexes(), {label: '건너뜀', value: null}, 'B');
  if (!k) return; const u = mkUnit('B', 'R', 'R-COS', ...P(k)); state.units.push(u); log(`어머니 러시아: 코사크 배치 (${k})`, 'vb');
}
function fwCands() { return state.units.filter(u => u.side === 'B' && st(u).cls !== 'cav' && !fwKind(hexOf(u))).map(hexOf); }
async function placeFW() {
  const k = await pickHex('어머니 러시아: 2면 보루를 놓을 보병·포병 칸을 고르세요', fwCands(), {label: '건너뜀', value: null}, 'B');
  if (!k) return; if (rawT(k) === 'clear' || rawT(k) === 'hill') state.terr[k] = 'fw'; else state.fwPlus.push(k);
  log(`어머니 러시아: ${k}에 보루`, 'vb');
}
// 스페인 게릴라 행동: 프랑스가 카드를 쓴 직후. 프랑스가 주사위 1개를 굴려 칼이면 무효, 아니면 그 카드는 취소
async function guerrillaCheck() {
  if (state.guer == null || !state.guer || state.active !== 'F' || !state.cur || state.cur.k === 'firststrike') return false;
  const v = await ask({title: '게릴라 행동?', who: 'B', body: `${SIDE_KO.B}: 게릴라 카운터 ${state.guer}개. 하나를 써서 프랑스의 「${CARD_BY_KEY[state.cur.k].n}」을(를) 막을 수 있다. 프랑스가 주사위 1개를 굴려 칼이 나오면 카운터만 잃고, 아니면 카드가 취소되어 프랑스는 1장을 받고 턴을 끝낸다.`,
    buttons: [{l: '게릴라 사용', v: true, p: 1}, {l: '쓰지 않음', v: false}]});
  if (!v) return false;
  state.guer--; log(`${SIDE_KO.B}: 게릴라 행동 (남은 카운터 ${state.guer}개)`, 'card');
  const f = await rollDice(1, '게릴라 대응 (칼이면 프랑스가 막아 냄)');
  if (f[0] === 'saber') { diceNote('칼: 게릴라를 물리쳤다'); log('프랑스가 게릴라를 물리쳐 카드를 그대로 쓴다'); return false; }
  diceNote('카드 취소'); log(`게릴라에게 막혀 「${CARD_BY_KEY[state.cur.k].n}」 취소`, 'warn');
  state.cur.eff = 'cancel'; state.cur.sec = null; state.scout = false; state.elanShuffle = false;
  return true;
}
