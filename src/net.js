/* ===================== 온라인 2인 (Firebase Realtime Database) =====================
   방 구조  rooms/{코드}
     meta     {scen, v, created}
     seats    {B: uid, F: uid}           각 진영을 맡은 사람
     presence {B: true, F: true}         접속 중 표시 (끊기면 자동 삭제)
     state    {json, seq, by}            게임 상태 전체 (JSON 문자열)
     ask      {id, to, kind, json}       상대에게 묻는 결정 (방진, 반격, 후퇴 칸 …)
     ans      {id, json}                 그 답
     fx       push 목록 {json}           애니메이션·효과음·주사위 중계
     chat     push 목록 {side, text, t}  채팅 (방이 남아 있는 동안 유지)
   차례인 쪽 브라우저가 규칙을 계산하고 상태를 올린다. 상대 브라우저는 받아서 그리고, 자기 결정만 답한다. */
const FB_SDK = '10.12.2';
const NET = (() => {
  const clientId = (() => { try { let v = sessionStorage.getItem('cnc-cid'); if (!v) { v = uid() + uid(); sessionStorage.setItem('cnc-cid', v); } return v; } catch (e) { return uid() + uid(); } })();
  let T = null, room = null, me = null, seq = 0, lastSeqIn = -1, unsub = [], seenFx = new Set(), prunedTurn = -1;
  let chat = [], seenChat = new Set();
  let askSeq = 0, pendingAsk = null, handledAsk = null, replaying = false, fxq = [], fxRunning = false, pendingState = null;
  const net = {
    status: 'off', opp: false, error: null,
    get room() { return room; }, get me() { return me; },
    get on() { return !!(state && state.mode === 'online' && room); },
    get myTurn() { return !net.on || state.active === me; },
    get replaying() { return replaying; },
    get chat() { return chat; },
    available() { return !!transportKind(); },
  };
  function transportKind() {
    try { if (new URLSearchParams(location.search).get('net') === 'local') return 'local'; } catch (e) {}
    if (window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.apiKey && window.FIREBASE_CONFIG.databaseURL) return 'firebase';
    return null;
  }
  const P_ = p => `rooms/${room}/${p}`;

  /* ---------- 전송: Firebase ---------- */
  function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('스크립트를 불러오지 못했다: ' + src)); document.head.appendChild(s); }); }
  async function firebaseTransport() {
    if (!window.firebase || !firebase.database) {
      const base = `https://www.gstatic.com/firebasejs/${FB_SDK}/`;
      await loadScript(base + 'firebase-app-compat.js');
      await loadScript(base + 'firebase-auth-compat.js');
      await loadScript(base + 'firebase-database-compat.js');
    }
    if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
    const cred = firebase.auth().currentUser || (await firebase.auth().signInAnonymously()).user;
    const db = firebase.database();
    return {
      uid: cred.uid,
      get: async p => (await db.ref(p).get()).val(),
      set: (p, v) => db.ref(p).set(v),
      push: (p, v) => db.ref(p).push(v),
      claim: async (p, id) => { const r = await db.ref(p).transaction(cur => (cur == null || cur === id) ? id : undefined); return r.committed; },
      on: (p, cb) => { const r = db.ref(p); const h = r.on('value', s => cb(s.val())); return () => r.off('value', h); },
      onChild: (p, cb) => { const r = db.ref(p); const h = r.on('child_added', s => cb(s.val(), s.key)); return () => r.off('child_added', h); },
      presence: p => { const r = db.ref(p); const c = db.ref('.info/connected'); const h = c.on('value', s => { if (s.val()) { r.onDisconnect().remove(); r.set(true); } }); return () => { c.off('value', h); r.remove(); }; },
    };
  }
  /* ---------- 전송: 같은 브라우저의 두 창 (테스트용, ?net=local) ---------- */
  function localTransport() {
    // 같은 브라우저의 창끼리 BroadcastChannel로 변경 내용을 직접 주고받는다 (테스트용)
    const bc = new BroadcastChannel('cnc-net-local');
    let db = {}; const subs = new Set();
    const getP = (o, p) => p.split('/').reduce((x, k) => (x == null ? undefined : x[k]), o);
    const setP = (o, p, v) => { const ks = p.split('/'); let x = o; ks.slice(0, -1).forEach(k => { if (x[k] == null || typeof x[k] !== 'object') x[k] = {}; x = x[k]; }); if (v == null) delete x[ks[ks.length - 1]]; else x[ks[ks.length - 1]] = v; };
    const notify = () => subs.forEach(f => f());
    const apply = m => { if (m.op === 'set') setP(db, m.p, m.v); else if (m.op === 'snap') db = m.db; };
    bc.onmessage = e => { const m = e.data; if (m.op === 'hello') { bc.postMessage({op: 'snap', db}); return; } if (m.op === 'snap' && Object.keys(db).length) return; apply(m); notify(); };
    const op = m => { apply(m); bc.postMessage(m); setTimeout(notify, 0); };
    bc.postMessage({op: 'hello'});
    let n = 0;
    const ready = new Promise(r => setTimeout(r, 150));
    return {
      uid: clientId, ready,
      get: async p => { await ready; const v = getP(db, p); return v === undefined ? null : JSON.parse(JSON.stringify(v)); },
      set: async (p, v) => op({op: 'set', p, v}),
      push: async (p, v) => op({op: 'set', p: `${p}/${Date.now().toString(36)}${(n++).toString(36).padStart(4, '0')}${clientId.slice(0, 4)}`, v}),
      claim: async (p, id) => { await ready; const cur = getP(db, p); if (cur != null && cur !== id) return false; op({op: 'set', p, v: id}); return true; },
      on: (p, cb) => { let last; const f = () => { const v = getP(db, p); const s = JSON.stringify(v === undefined ? null : v); if (s !== last) { last = s; cb(JSON.parse(s)); } }; subs.add(f); f(); return () => subs.delete(f); },
      onChild: (p, cb) => { const seen = new Set(); const f = () => { const o = getP(db, p) || {}; Object.keys(o).sort().forEach(k => { if (!seen.has(k)) { seen.add(k); cb(o[k], k); } }); }; subs.add(f); f(); return () => subs.delete(f); },
      presence: p => { op({op: 'set', p, v: true}); const off = () => op({op: 'set', p, v: null}); addEventListener('pagehide', off); return off; },
    };
  }
  async function connect() {
    if (T) return T;
    const k = transportKind();
    if (!k) throw new Error('Firebase 설정이 없다. README의 "온라인 대전 설정"을 따라 firebase-config.js를 채워라.');
    net.status = 'connecting'; render();
    T = k === 'local' ? localTransport() : await firebaseTransport();
    return T;
  }

  /* ---------- 방 ---------- */
  const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function code() { const a = new Uint32Array(5); crypto.getRandomValues(a); return [...a].map(x => ALPHA[x % ALPHA.length]).join(''); }
  function saveSession() { prefSet('cnc-net-session', room ? {room, side: me} : null); }
  function detach() { unsub.forEach(f => { try { f(); } catch (e) {} }); unsub = []; }
  async function attach() {
    detach(); seenFx = new Set(); lastSeqIn = -1;
    const existing = (await T.get(P_('fx'))) || {}; Object.keys(existing).forEach(k => seenFx.add(k));
    chat = []; seenChat = new Set(Object.keys((await T.get(P_('chat'))) || {}));
    unsub.push(T.presence(P_('presence/' + me)));
    unsub.push(T.on(P_('presence/' + other(me)), v => { net.opp = !!v; render(); }));
    unsub.push(T.on(P_('state'), onState));
    unsub.push(T.on(P_('ask'), onAsk));
    unsub.push(T.on(P_('ans'), onAns));
    unsub.push(T.onChild(P_('chat'), (v, k) => {
      if (!v || typeof v.text !== 'string') return;
      chat.push({side: v.side, text: v.text.slice(0, 200), t: v.t});
      if (!seenChat.has(k) && v.side !== me) { SFX.raw('order'); toast(`${SIDE_KO[v.side] || '상대'}: ${v.text.slice(0, 60)}`); }
      seenChat.add(k); renderChat();
    }));
    unsub.push(T.onChild(P_('fx'), (v, k) => { if (seenFx.has(k)) return; seenFx.add(k); if (!v || v.by === clientId) return; try { fxq.push(JSON.parse(v.json)); } catch (e) {} runFx(); }));
    net.status = 'on'; saveSession();
    try { history.replaceState(null, '', '#r-' + room); } catch (e) {}
    render();
  }
  net.create = async (scenId, side) => {
    await connect();
    room = code(); me = side;
    await T.set(P_('meta'), {scen: scenId, v: 1, created: Date.now()});
    if (!(await T.claim(P_('seats/' + side), T.uid))) throw new Error('자리를 잡지 못했다. 다시 시도해라.');
    newGame(scenId, 'online'); undoStack.length = 0;
    await pushState(true);
    await attach();
    log(`온라인 방 ${room} 개설. 나: ${SIDE_KO[me]}`, 'sys');
  };
  net.join = async (c) => {
    await connect();
    c = (c || '').trim().toUpperCase().replace(/^#?R-/, '');
    const meta = await T.get(`rooms/${c}/meta`);
    if (!meta) throw new Error(`방 ${c}을(를) 찾지 못했다. 코드를 확인해라.`);
    room = c;
    const seats = (await T.get(P_('seats'))) || {};
    let side = ['B', 'F'].find(s => seats[s] === T.uid) || ['B', 'F'].find(s => !seats[s]);
    if (!side) { room = null; throw new Error('이미 두 사람이 들어간 방이다.'); }
    if (!(await T.claim(P_('seats/' + side), T.uid))) { room = null; throw new Error('자리를 잡지 못했다. 다시 시도해라.'); }
    me = side;
    const s = await T.get(P_('state'));
    if (s && s.json) { state = JSON.parse(s.json); lastSeqIn = s.seq; seq = s.seq; }
    undoStack.length = 0;
    await attach();
  };
  net.resume = async () => {
    const ses = prefGet('cnc-net-session', null); if (!ses || !ses.room || !transportKind()) return false;
    try { await connect(); room = ses.room; me = ses.side;
      const seats = (await T.get(P_('seats'))) || {};
      if (seats[me] !== T.uid) { room = null; me = null; saveSession(); return false; }
      const s = await T.get(P_('state')); if (!s || !s.json) { room = null; saveSession(); return false; }
      state = JSON.parse(s.json); seq = lastSeqIn = s.seq; undoStack.length = 0;
      await attach(); return true;
    } catch (e) { net.status = 'error'; net.error = e.message; render(); return false; }
  };
  net.leave = () => { detach(); chat = []; room = null; me = null; net.status = 'off'; net.opp = false; saveSession(); pendingAsk = null; ui.waiting = null; try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {} };
  net.say = async text => {
    text = String(text).trim().slice(0, 200);
    if (!text || !T || !room) return;
    await T.push(P_('chat'), {side: me, text, t: Date.now()});
  };
  net.link = () => location.href.split('#')[0] + '#r-' + room;

  /* ---------- 상태 ---------- */
  async function pushState(force) {
    if (!T || !room || (!force && !net.on)) return;
    if (!force && state.active !== me && !ui.busy) return;
    seq = Math.max(seq, lastSeqIn) + 1;
    if (state.active === me && prunedTurn !== state.turn) { prunedTurn = state.turn; await T.set(P_('fx'), null); }
    await T.set(P_('state'), {json: JSON.stringify(Object.assign({}, state, {log: state.log.slice(0, 60)})), seq, by: clientId});
  }
  net.push = () => pushState(false).catch(e => toast('동기화 실패: ' + e.message));
  function onState(v) {
    if (!v || !v.json || v.by === clientId || v.seq <= lastSeqIn) return;
    lastSeqIn = v.seq; pendingState = v.json;
    if (!fxRunning) applyState();
  }
  function applyState() {
    if (!pendingState) return;
    const was = state && state.active;
    state = JSON.parse(pendingState); pendingState = null; undoStack.length = 0;
    if (was !== me && state.active === me && !state.winner) { SFX.raw('order'); toast('내 차례다.'); }
    save(); render();
  }

  /* ---------- 상대에게 묻기 ---------- */
  net.remote = who => net.on && who && who !== me;
  net.ask = async (kind, o) => {
    await pushState(false);
    const id = clientId.slice(0, 6) + (++askSeq); net.asked = (net.asked || 0) + 1;
    const payload = kind === 'ask' ? {title: o.title, body: o.body, buttons: o.buttons.map(b => ({l: b.l, p: b.p})), toggles: o.toggles || null}
                                   : {msg: o.msg, cands: [...o.cands], extra: o.extra};
    return new Promise(resolve => {
      const finish = raw => { if (pendingAsk !== rec) return; pendingAsk = null; ui.waiting = null; T.set(P_('ask'), null); render();
        if (kind === 'ask') { const b = o.buttons[raw.i]; resolve(o.toggles ? {v: b.v, toggles: raw.toggles || {}} : b.v); } else resolve(raw.k); };
      const rec = {id, finish};
      pendingAsk = rec;
      ui.waiting = {who: o.who, title: kind === 'ask' ? o.title : o.msg, takeover: async () => {
        if (pendingAsk !== rec) return;
        pendingAsk = null; ui.waiting = null; T.set(P_('ask'), null);
        const v = kind === 'ask' ? await localAsk(o) : await localPick(o.msg, [...o.cands], o.extra, o.who);
        resolve(v);
      }};
      T.set(P_('ask'), {id, to: o.who, kind, json: JSON.stringify(payload)});
      render();
    });
  };
  function onAns(v) { if (!v || !pendingAsk || v.id !== pendingAsk.id) return; try { pendingAsk.finish(JSON.parse(v.json)); } catch (e) {} }
  async function onAsk(v) {
    if (!v) { if (ui.remoteAsk) { ui.remoteAsk = null; ui.prompt = null; ui.picking = null; render(); } return; }
    if (v.to !== me || v.id === handledAsk || state.active === me) return;
    handledAsk = v.id; ui.remoteAsk = v.id; net.answered = (net.answered || 0) + 1;
    if (pendingState) applyState();
    const p = JSON.parse(v.json);
    SFX.raw('order');
    let ans;
    if (v.kind === 'ask') {
      const r = await localAsk({title: p.title, body: p.body, toggles: p.toggles, who: me, buttons: p.buttons.map((b, i) => ({l: b.l, p: b.p, v: i}))});
      if (ui.remoteAsk !== v.id) return;
      ans = p.toggles ? {i: r.v, toggles: r.toggles} : {i: r};
    } else {
      const k = await localPick(p.msg, p.cands, p.extra, me);
      if (ui.remoteAsk !== v.id) return;
      ans = {k};
    }
    ui.remoteAsk = null;
    await T.set(P_('ans'), {id: v.id, json: JSON.stringify(ans)});
  }

  /* ---------- 애니메이션·소리 중계 ---------- */
  net.emit = (type, payload) => {
    if (replaying || !net.on || state.active !== me || !T) return;
    T.push(P_('fx'), {json: JSON.stringify([type, payload]), by: clientId}).catch(() => {});
  };
  async function runFx() {
    if (fxRunning) return; fxRunning = true; replaying = true;
    try {
      while (fxq.length) {
        const [type, p] = fxq.shift();
        try {
          if (type === 'fx') await FXR[p[0]](...p[1]);
          else if (type === 'sfx') SFX.raw(p[0], ...p[1]);
          else if (type === 'dice') { ui.dice = {label: p.label, faces: p.faces, rolling: true, note: ''}; render(); SFX.raw('dice', p.faces.length); await sleep(reduceMotion ? 60 : 520); if (ui.dice) ui.dice.rolling = false; render(); }
          else if (type === 'note') { if (ui.dice) ui.dice.note = p; render(); }
        } catch (e) {}
      }
    } finally { replaying = false; fxRunning = false; }
    applyState();
  }
  net._dbg = () => ({seq, lastSeqIn, fxRunning, fxq: fxq.length, pending: !!pendingState, pendingAsk: !!pendingAsk, handledAsk});
  return net;
})();
