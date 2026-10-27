/* ===================== 설정 저장 ===================== */
function prefGet(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
function prefSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

/* ===================== 효과음: Web Audio 합성 (외부 파일 없음) ===================== */
const SFX = (() => {
  let ctx = null, master = null, nbuf = null, on = prefGet('cnc-sfx', true);
  function ac() {
    if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ctx = new C(); master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination); }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function noise() {
    if (!nbuf) { nbuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const s = ctx.createBufferSource(); s.buffer = nbuf; return s;
  }
  function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function burst(t, o) {
    const s = noise(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = o.type || 'bandpass'; f.frequency.value = o.freq || 1000; f.Q.value = o.q || 1;
    if (o.sweep) f.frequency.exponentialRampToValueAtTime(o.sweep, t + (o.a || .003) + (o.d || .15));
    env(g, t, o.a || .003, o.peak || .5, o.d || .15);
    s.connect(f).connect(g).connect(master); s.start(t, Math.random() * 1.4); s.stop(t + (o.a || .003) + (o.d || .15) + .05);
  }
  function tone(t, o) {
    const osc = ctx.createOscillator(), g = ctx.createGain(); osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f0, t); if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1, t + (o.a || .005) + (o.d || .3));
    env(g, t, o.a || .005, o.peak || .4, o.d || .3);
    let node = osc.connect(g);
    if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; node = g.connect(f); }
    node.connect(master); osc.start(t); osc.stop(t + (o.a || .005) + (o.d || .3) + .05);
  }
  const lib = {
    step(cls) { const t = ctx.currentTime;
      if (cls === 'cav') { burst(t, {freq: 950, q: 3, peak: .32, d: .05}); burst(t + .08, {freq: 720, q: 3, peak: .28, d: .05}); }
      else if (cls === 'art') { burst(t, {type: 'lowpass', freq: 200, q: .7, peak: .4, d: .28}); tone(t, {f0: 70, f1: 48, peak: .16, d: .22}); }
      else { burst(t, {freq: 240, q: 1.3, peak: .55, d: .09}); tone(t, {f0: 120, f1: 70, peak: .22, d: .08}); } },
    volley(n) { const t = ctx.currentTime, k = Math.min(7, Math.max(2, n || 3));
      for (let i = 0; i < k; i++) { const tt = t + i * .05 + Math.random() * .03; burst(tt, {freq: 1700 + Math.random() * 900, q: .8, peak: .45, d: .12}); burst(tt, {type: 'lowpass', freq: 320, q: .5, peak: .3, d: .3}); } },
    cannon() { const t = ctx.currentTime; tone(t, {f0: 150, f1: 32, peak: .9, a: .002, d: .95}); burst(t, {type: 'lowpass', freq: 420, q: .5, peak: .85, d: 1.1}); burst(t + .015, {freq: 2600, q: .6, peak: .25, d: .12}); },
    boom() { const t = ctx.currentTime; burst(t, {type: 'lowpass', freq: 300, q: .6, peak: .6, d: .6}); tone(t, {f0: 90, f1: 35, peak: .35, d: .4}); },
    clash() { const t = ctx.currentTime;
      for (let i = 0; i < 4; i++) { const tt = t + i * .075 + Math.random() * .04; [2350, 3150, 4200].forEach(f => tone(tt, {f0: f * (.94 + Math.random() * .12), type: 'triangle', peak: .07, a: .001, d: .2})); burst(tt, {freq: 3600, q: 2, peak: .18, d: .06}); }
      burst(t, {freq: 480, q: .6, peak: .3, d: .45}); },
    gallop() { const t = ctx.currentTime; for (let i = 0; i < 6; i++) { const tt = t + i * .11; burst(tt, {freq: 900, q: 3, peak: .3, d: .045}); burst(tt + .045, {freq: 650, q: 3, peak: .25, d: .045}); } },
    dice(n) { const t = ctx.currentTime; for (let i = 0; i < 7 + Math.min(n || 3, 8); i++) burst(t + i * .03 + Math.random() * .02, {freq: 2800 + Math.random() * 2400, q: 5, peak: .16, d: .025}); },
    hit() { const t = ctx.currentTime; tone(t, {f0: 110, f1: 45, peak: .45, d: .25}); burst(t, {type: 'lowpass', freq: 600, q: .7, peak: .35, d: .2}); },
    miss() { const t = ctx.currentTime; burst(t, {type: 'highpass', freq: 1500, sweep: 4000, q: .7, peak: .12, d: .2}); },
    die() { const t = ctx.currentTime; tone(t, {f0: 220, f1: 55, type: 'sawtooth', lp: 900, peak: .2, d: .7}); burst(t, {type: 'lowpass', freq: 500, q: .5, peak: .45, d: .8}); },
    flag() { const t = ctx.currentTime; [[392, 0], [523, .16], [392, .32]].forEach(([f, dt]) => tone(t + dt, {f0: f, type: 'sawtooth', lp: 1800, peak: .12, a: .02, d: .14})); },
    card() { const t = ctx.currentTime; burst(t, {type: 'highpass', freq: 900, sweep: 5000, q: .6, peak: .18, d: .16}); },
    order() { const t = ctx.currentTime; tone(t, {f0: 660, type: 'triangle', peak: .08, d: .06}); },
    square() { const t = ctx.currentTime; for (let i = 0; i < 8; i++) burst(t + i * .045, {freq: 260, q: 1.4, peak: .35 - i * .02, d: .05}); },
    win() { const t = ctx.currentTime; [[523, 0, .18], [659, .2, .18], [784, .4, .18], [1047, .6, .6]].forEach(([f, dt, d]) => { tone(t + dt, {f0: f, type: 'sawtooth', lp: 2200, peak: .14, a: .02, d}); tone(t + dt, {f0: f / 2, type: 'triangle', peak: .1, a: .02, d}); }); },
  };
  return {
    raw(name, ...a) { if (!on) return; try { if (!ac()) return; lib[name] && lib[name](...a); } catch (e) {} },
    play(name, ...a) { if (typeof NET !== 'undefined') NET.emit('sfx', [name, a]); this.raw(name, ...a); },
    get on() { return on; },
    toggle() { on = !on; prefSet('cnc-sfx', on); if (on) this.raw('order'); return on; },
  };
})();

/* ===================== 지도 애니메이션 ===================== */
const FXR = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  let enabled = prefGet('cnc-anim', true);
  const on = () => enabled && !reduceMotion && typeof Element.prototype.animate === 'function';
  const svg = () => document.getElementById('board');
  const layer = () => { const s = svg(); let g = s.querySelector('#fx'); if (!g) { g = document.createElementNS(NS, 'g'); g.id = 'fx'; g.setAttribute('pointer-events', 'none'); s.appendChild(g); } return g; };
  const mk = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); (parent || layer()).appendChild(e); return e; };
  const done = a => Promise.race([a.finished.catch(() => {}), sleep((a.effect && a.effect.getTiming().duration || 500) + 300)]);
  const grp = id => svg().querySelector(`[data-id="${id}"]`);
  const T = (x, y, extra) => `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)${extra || ''}`;
  const speed = cls => cls === 'cav' ? 150 : cls === 'art' ? 280 : 240;
  return {
    get on() { return enabled; },
    toggle() { enabled = !enabled; prefSet('cnc-anim', enabled); return enabled; },
    // 경로를 따라 한 칸씩 이동
    async move(id, keys, cls) {
      if (!keys || keys.length < 2) return;
      if (!on()) { SFX.raw('step', cls); return; }
      const g = grp(id); if (!g) return;
      const per = speed(cls); const pts = keys.map(k => ctr(...P(k)));
      const a = g.animate(pts.map(([x, y]) => ({transform: T(x, y)})), {duration: per * (pts.length - 1), easing: 'ease-in-out'});
      for (let i = 1; i < pts.length; i++) setTimeout(() => SFX.raw('step', cls), per * (i - 1) + per * .4);
      await done(a);
    },
    // 근접 돌격: 상대 쪽으로 반쯤 뛰어들었다 돌아옴
    async lunge(id, fromK, toK, cls) {
      if (cls === 'cav') SFX.raw('gallop');
      if (!on()) { SFX.raw('clash'); return; }
      const g = grp(id); if (!g) { SFX.raw('clash'); return; }
      const [x1, y1] = ctr(...P(fromK)), [x2, y2] = ctr(...P(toK));
      const mx = x1 + (x2 - x1) * .5, my = y1 + (y2 - y1) * .5;
      const a = g.animate([{transform: T(x1, y1)}, {transform: T(mx, my), offset: .45}, {transform: T(mx, my), offset: .6}, {transform: T(x1, y1)}], {duration: cls === 'cav' ? 620 : 520, easing: 'ease-in-out'});
      setTimeout(() => { SFX.raw('clash'); this.dust(mx, my); }, cls === 'cav' ? 280 : 230);
      await done(a);
    },
    dust(x, y) {
      if (!on()) return;
      for (let i = 0; i < 5; i++) { const c = mk('circle', {cx: x + (Math.random() - .5) * 26, cy: y + (Math.random() - .5) * 20, r: 5, fill: '#cbbf9e', opacity: .8});
        c.animate([{opacity: .8, r: 4}, {opacity: 0, r: 14}], {duration: 600 + Math.random() * 300}).onfinish = () => c.remove(); }
    },
    // 원거리 사격: 보병 머스킷 / 포병 포탄
    async fire(fromK, toK, cls, n) {
      const [x1, y1] = ctr(...P(fromK)), [x2, y2] = ctr(...P(toK));
      if (cls === 'art') SFX.raw('cannon'); else SFX.raw('volley', n);
      if (!on()) return;
      const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
      // 총구 화염과 연기
      const puffs = cls === 'art' ? 1 : 4;
      for (let i = 0; i < puffs; i++) {
        const ox = x1 + ux * 20 + (-uy) * (i - 1.5) * 9, oy = y1 + uy * 20 + ux * (i - 1.5) * 9;
        const f = mk('circle', {cx: ox, cy: oy, r: cls === 'art' ? 9 : 4, fill: '#ffcf5a'});
        f.animate([{opacity: 1}, {opacity: 0}], {duration: 180, delay: i * 45, fill: 'forwards'}).onfinish = () => f.remove();
        const sm = mk('circle', {cx: ox, cy: oy, r: 6, fill: '#e9e4d6', opacity: 0});
        sm.style.transformBox = 'fill-box'; sm.style.transformOrigin = 'center';
        sm.animate([{opacity: .85, transform: 'translate(0,0) scale(.6)'}, {opacity: 0, transform: `translate(${(-uy * 6).toFixed(1)}px,-10px) scale(2.4)`}], {duration: 1100, delay: i * 45, easing: 'ease-out'}).onfinish = () => sm.remove();
      }
      if (cls === 'art') {
        const ball = mk('circle', {cx: 0, cy: 0, r: 3.6, fill: '#222'});
        const steps = 12, h = Math.min(60, L * .25), fr = [];
        for (let i = 0; i <= steps; i++) { const t = i / steps; fr.push({transform: T(x1 + dx * t, y1 + dy * t - Math.sin(Math.PI * t) * h)}); }
        const a = ball.animate(fr, {duration: Math.min(700, 180 + L * 1.6), easing: 'linear'});
        await done(a); ball.remove();
        SFX.raw('boom');
        const ex = mk('circle', {cx: x2, cy: y2, r: 6, fill: '#ff9a3a', opacity: .9});
        ex.animate([{r: 4, opacity: .95}, {r: 26, opacity: 0}], {duration: 420, easing: 'ease-out'}).onfinish = () => ex.remove();
        this.dust(x2, y2);
        await sleep(220);
      } else {
        const lines = [];
        for (let i = 0; i < 4; i++) {
          const j = (Math.random() - .5) * 16;
          const ln = mk('line', {x1: x1 + ux * 22, y1: y1 + uy * 22, x2: x2 - ux * 14 - uy * j, y2: y2 - uy * 14 + ux * j, stroke: '#fff3c4', 'stroke-width': 1.3, 'stroke-dasharray': '6 200', opacity: .95});
          lines.push(ln.animate([{strokeDashoffset: 0}, {strokeDashoffset: -L}], {duration: 260, delay: i * 50, easing: 'ease-in'}));
          ln.animate([{opacity: .95}, {opacity: 0}], {duration: 320, delay: i * 50 + 200, fill: 'forwards'}).onfinish = () => ln.remove();
        }
        await done(lines[lines.length - 1]);
      }
    },
    // 명중: 흔들림 + 붉은 섬광 + 떠오르는 숫자
    async hit(id, k, hits) {
      SFX.raw('hit');
      if (!on()) return;
      const [x, y] = ctr(...P(k)); const g = grp(id);
      const fl = mk('polygon', {points: hexPts(x, y, HS - 2), fill: '#e0352b', opacity: .55});
      fl.animate([{opacity: .6}, {opacity: 0}], {duration: 520, easing: 'ease-out'}).onfinish = () => fl.remove();
      this.float(k, `−${hits}`, '#ffd9d4', '#a3221a');
      if (g) await done(g.animate([0, 5, -5, 4, -3, 0].map(d => ({transform: T(x + d, y)})), {duration: 380}));
      else await sleep(380);
    },
    float(k, text, fill, stroke) {
      if (!on()) return;
      const [x, y] = ctr(...P(k));
      const t = mk('text', {x, y: y - 6, 'text-anchor': 'middle', class: 'fxtxt', fill: fill || '#fff', stroke: stroke || '#222'});
      t.textContent = text;
      t.animate([{transform: 'translate(0,0)', opacity: 1}, {transform: 'translate(0,-26px)', opacity: 1, offset: .6}, {transform: 'translate(0,-36px)', opacity: 0}], {duration: 1200, easing: 'ease-out'}).onfinish = () => t.remove();
    },
    async destroy(id, k) {
      SFX.raw('die');
      if (!on()) return;
      const g = grp(id); const [x, y] = ctr(...P(k));
      this.dust(x, y); this.dust(x, y);
      if (g) await done(g.animate([{transform: T(x, y), opacity: 1}, {transform: T(x, y + 4, ' scale(.35) rotate(-18deg)'), opacity: 0}], {duration: 560, easing: 'ease-in', fill: 'forwards'}));
    },
  };
})();

// 공개용: 온라인이면 상대 화면에도 같은 효과를 보낸다
const FX = {
  get on() { return FXR.on; },
  toggle() { return FXR.toggle(); },
};
['move', 'lunge', 'fire', 'hit', 'destroy', 'float', 'dust'].forEach(n => { FX[n] = (...a) => { if (typeof NET !== 'undefined') NET.emit('fx', [n, a]); return FXR[n](...a); }; });
