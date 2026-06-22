/* ============================================================
   FISHER SWEETS — CRT controller
   - power on/off + boot
   - rotary dial (drag / keyboard / step buttons) -> channels
   - static burst + glitch + OSD on channel change
   - synthesized Web Audio (no audio files)
   ============================================================ */

(() => {
  const CHANNELS = [
    { n: 1, name: 'NOW PLAYING' },
    { n: 2, name: 'DEMOS' },
    { n: 3, name: 'PHOTO DUMP' },
    { n: 4, name: 'TRANSMISSION' },
  ];
  const COUNT = CHANNELS.length;
  const DEG_PER = 60;                 // dial spacing between channels
  const BASE = -90;                   // dial angle for channel 1

  // ---- elements ----
  const $ = (s) => document.querySelector(s);
  const body = document.body;
  const screen = $('#screen');
  const channelsEl = $('#channels');
  const channelEls = [...document.querySelectorAll('.channel')];
  const osd = $('#osd'), osdCh = $('#osdCh'), osdName = $('#osdName');
  const knob = $('#knob'), knobFace = knob.querySelector('.knob-face'), knobTicks = $('#knobTicks');
  const dialReadout = $('#dialReadout'), dialHint = $('#dialHint');
  const powerCover = $('#powerCover'), powerOn = $('#powerOn'), offLine = powerCover.querySelector('.off-line');
  const pwrBtn = $('#pwrBtn'), muteBtn = $('#muteBtn');
  const chUp = $('#chUp'), chDown = $('#chDown');
  const canvas = $('#staticCanvas'), ctx = canvas.getContext('2d', { alpha: true });
  const yr = $('#yr');

  let current = 1;        // 1-indexed channel
  let powered = false;
  let changing = false;
  let muted = false;

  yr.textContent = new Date().getFullYear();

  // build dial ticks
  for (let i = 0; i < COUNT; i++) {
    const t = document.createElement('i');
    t.style.transform = `rotate(${BASE + 90 + i * DEG_PER}deg)`;
    knobTicks.appendChild(t);
  }
  const tickEls = [...knobTicks.children];

  /* ---------------- AUDIO (synthesized) ---------------- */
  let AC = null, hum = null, humGain = null, masterGain = null;
  function audioInit() {
    if (AC) return;
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = AC.createGain();
      masterGain.gain.value = muted ? 0 : 1;
      masterGain.connect(AC.destination);
      // low CRT hum
      hum = AC.createOscillator(); hum.type = 'sine'; hum.frequency.value = 60;
      const hum2 = AC.createOscillator(); hum2.type = 'sine'; hum2.frequency.value = 120;
      humGain = AC.createGain(); humGain.gain.value = 0;
      hum.connect(humGain); hum2.connect(humGain); humGain.connect(masterGain);
      hum.start(); hum2.start();
    } catch (e) { AC = null; }
  }
  function setHum(on) {
    if (!AC || !humGain) return;
    humGain.gain.cancelScheduledValues(AC.currentTime);
    humGain.gain.linearRampToValueAtTime(on ? 0.012 : 0, AC.currentTime + (on ? 0.4 : 0.25));
  }
  // white-noise burst (static hiss)
  function noiseBurst(dur = 0.18, vol = 0.16) {
    if (!AC) return;
    const n = Math.floor(AC.sampleRate * dur);
    const buf = AC.createBuffer(1, n, AC.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = AC.createBufferSource(); src.buffer = buf;
    const bp = AC.createBiquadFilter(); bp.type = 'highpass'; bp.frequency.value = 900;
    const g = AC.createGain(); g.gain.value = vol;
    src.connect(bp); bp.connect(g); g.connect(masterGain);
    src.start();
  }
  // mechanical "ka-chunk" click for the dial detent
  function clickTick() {
    if (!AC) return;
    const t = AC.currentTime;
    const o = AC.createOscillator(); o.type = 'square'; o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(70, t + 0.04);
    const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    o.connect(g); g.connect(masterGain); o.start(t); o.stop(t + 0.09);
    noiseBurst(0.05, 0.05);
  }
  // degauss "thunk" on power
  function powerThunk() {
    if (!AC) return;
    const t = AC.currentTime;
    const o = AC.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.5);
    const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    o.connect(g); g.connect(masterGain); o.start(t); o.stop(t + 0.65);
    noiseBurst(0.4, 0.12);
  }

  /* ---------------- STATIC CANVAS ---------------- */
  let rafId = null, staticUntil = 0;
  function sizeCanvas() {
    const r = canvas.getBoundingClientRect();
    canvas.width = Math.max(2, Math.floor(r.width / 3));   // low-res = chunky pixels
    canvas.height = Math.max(2, Math.floor(r.height / 3));
  }
  function drawStatic() {
    const w = canvas.width, h = canvas.height;
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    if (performance.now() < staticUntil) rafId = requestAnimationFrame(drawStatic);
    else { rafId = null; canvas.classList.remove('show'); }
  }
  function burstStatic(ms = 320) {
    sizeCanvas();
    canvas.classList.add('show');
    staticUntil = performance.now() + ms;
    if (!rafId) rafId = requestAnimationFrame(drawStatic);
  }

  /* ---------------- CHANNELS ---------------- */
  function fireGlitch() {
    channelEls.forEach((el) => {
      if (!el.classList.contains('active')) return;
      el.querySelectorAll('.glitch').forEach((g) => {
        g.classList.remove('fire'); void g.offsetWidth; g.classList.add('fire');
      });
    });
  }
  function showOSD(ch) {
    osdCh.textContent = 'CH 0' + ch.n;
    osdName.textContent = ch.name;
    osd.classList.add('show');
    clearTimeout(showOSD._t);
    showOSD._t = setTimeout(() => osd.classList.remove('show'), 2200);
  }
  function setKnobAngle(ch) {
    const ang = BASE + (ch - 1) * DEG_PER;
    knobFace.style.transform = `rotate(${ang}deg)`;
    tickEls.forEach((t, i) => t.classList.toggle('on', i === ch - 1));
  }
  function applyChannel(ch, { silent = false } = {}) {
    const meta = CHANNELS[ch - 1];
    current = ch;
    dialReadout.textContent = '0' + ch;
    knob.setAttribute('aria-valuenow', ch);
    setKnobAngle(ch);
    channelEls.forEach((el) => el.classList.toggle('active', +el.dataset.ch === ch));
    showOSD(meta);
    if (!silent) { fireGlitch(); }
    const sc = document.querySelector('.channel.active .ch-scroll');
    if (sc) sc.scrollTop = 0;
    setTimeout(updateScrollCue, 60);
  }
  function goTo(ch, { fromUser = true } = {}) {
    ch = ((ch - 1 + COUNT) % COUNT) + 1;     // wrap 1..COUNT
    if (!powered || changing) return;
    if (ch === current) return;
    changing = true;
    if (fromUser && AC) { clickTick(); noiseBurst(0.22, 0.14); }
    burstStatic(300);
    // swap content mid-static
    setTimeout(() => applyChannel(ch), 130);
    setTimeout(() => { changing = false; }, 320);
    if (dialHint && !dialHint.classList.contains('gone')) dialHint.classList.add('gone');
  }

  /* ---------------- POWER ---------------- */
  function powerUp() {
    if (powered) return;
    powered = true;
    audioInit();
    if (AC && AC.state === 'suspended') AC.resume();
    powerThunk();
    setHum(true);
    body.classList.add('is-on');
    pwrBtn.classList.add('on');
    // CRT boot animation
    offLine.style.transition = 'opacity .15s';
    offLine.style.opacity = '1';
    burstStatic(520);
    screen.classList.add('on');
    setTimeout(() => { offLine.style.opacity = '0'; }, 200);
    setTimeout(() => {
      powerCover.classList.add('hidden');
      applyChannel(current, { silent: true });
      fireGlitch();
    }, 360);
    setTimeout(() => screen.classList.remove('on'), 1000);
  }
  function powerDown() {
    if (!powered) return;
    powered = false;
    setHum(false);
    noiseBurst(0.2, 0.1);
    body.classList.remove('is-on');
    pwrBtn.classList.remove('on');
    burstStatic(160);
    channelEls.forEach((el) => el.classList.remove('active'));
    osd.classList.remove('show');
    setTimeout(() => {
      powerCover.classList.remove('hidden');
      offLine.style.transition = 'opacity .2s';
      offLine.style.opacity = '1';
      setTimeout(() => { offLine.style.opacity = '0'; }, 220);
    }, 120);
  }
  function togglePower() { powered ? powerDown() : powerUp(); }

  /* ---------------- DIAL (drag) ---------------- */
  let dragging = false, dragLast = 0, dragAccum = 0;
  function angleFromEvent(e) {
    const r = knob.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const p = e.touches ? e.touches[0] : e;
    return Math.atan2(p.clientY - cy, p.clientX - cx) * 180 / Math.PI;
  }
  function dragStart(e) {
    if (!powered) { powerUp(); return; }
    dragging = true; dragAccum = 0;
    dragLast = angleFromEvent(e);
    knob.style.cursor = 'grabbing';
    e.preventDefault();
  }
  function dragMove(e) {
    if (!dragging) return;
    const a = angleFromEvent(e);
    let delta = a - dragLast;
    if (delta > 180) delta -= 360; else if (delta < -180) delta += 360;
    dragLast = a;
    dragAccum += delta;
    // each ~detent of rotation steps a channel
    while (dragAccum >= DEG_PER) { dragAccum -= DEG_PER; goTo(current + 1); }
    while (dragAccum <= -DEG_PER) { dragAccum += DEG_PER; goTo(current - 1); }
    e.preventDefault();
  }
  function dragEnd() { dragging = false; knob.style.cursor = 'grab'; }

  knob.addEventListener('mousedown', dragStart);
  window.addEventListener('mousemove', dragMove);
  window.addEventListener('mouseup', dragEnd);
  knob.addEventListener('touchstart', dragStart, { passive: false });
  window.addEventListener('touchmove', dragMove, { passive: false });
  window.addEventListener('touchend', dragEnd);

  // tap knob = next channel
  let downT = 0, moved = false;
  knob.addEventListener('pointerdown', () => { downT = performance.now(); moved = false; });
  knob.addEventListener('pointermove', () => { if (dragging) moved = true; });
  knob.addEventListener('click', () => {
    if (!powered) { powerUp(); return; }
    if (!moved && performance.now() - downT < 250) goTo(current + 1);
  });

  // keyboard on knob
  knob.addEventListener('keydown', (e) => {
    if (!powered && (e.key === 'Enter' || e.key === ' ')) { powerUp(); e.preventDefault(); return; }
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { goTo(current + 1); e.preventDefault(); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { goTo(current - 1); e.preventDefault(); }
  });

  /* ---------------- buttons ---------------- */
  powerOn.addEventListener('click', powerUp);
  pwrBtn.addEventListener('click', togglePower);
  chUp.addEventListener('click', () => powered ? goTo(current + 1) : powerUp());
  chDown.addEventListener('click', () => powered ? goTo(current - 1) : powerUp());
  muteBtn.addEventListener('click', () => {
    muted = !muted;
    muteBtn.classList.toggle('muted', muted);
    if (masterGain) masterGain.gain.value = muted ? 0 : 1;
  });

  /* ---------------- theme toggle ---------------- */
  const themeToggle = $('#themeToggle'), themeLabel = $('#themeLabel');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const retro = body.classList.toggle('theme-retro');
      themeLabel.textContent = retro ? 'TAN' : 'BLACK';
      if (AC) noiseBurst(0.06, 0.05);
    });
  }

  /* ---------------- scroll cue ---------------- */
  const scrollCue = $('#scrollCue');
  function updateScrollCue() {
    if (!powered || !scrollCue) { scrollCue && scrollCue.classList.add('hide'); return; }
    const sc = document.querySelector('.channel.active .ch-scroll');
    if (!sc) { scrollCue.classList.add('hide'); return; }
    const more = sc.scrollHeight - sc.clientHeight - sc.scrollTop > 24;
    scrollCue.classList.toggle('hide', !more);
  }
  channelsEl.addEventListener('scroll', updateScrollCue, { passive: true, capture: true });

  /* ---------------- photo channel ---------------- */
  const photoFrame = $('#photoFrame');
  if (photoFrame) {
    const photos = [...photoFrame.querySelectorAll('.photo')];
    const filmstrip = $('#filmstrip'), phStamp = $('#phStamp');
    let pIdx = 0;
    photos.forEach((_, i) => {
      const d = document.createElement('span');
      d.className = 'dot' + (i === 0 ? ' on' : '');
      filmstrip.appendChild(d);
    });
    const dots = [...filmstrip.children];
    function showPhoto(i) {
      pIdx = (i + photos.length) % photos.length;
      photos.forEach((p, k) => p.classList.toggle('active', k === pIdx));
      dots.forEach((d, k) => d.classList.toggle('on', k === pIdx));
      if (phStamp) phStamp.textContent = 'REC  00:0' + (pIdx + 1);
      if (powered && AC) noiseBurst(0.06, 0.06);
    }
    photoFrame.addEventListener('click', () => showPhoto(pIdx + 1));
  }

  /* ---------------- resize ---------------- */
  let rT;
  window.addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(sizeCanvas, 150); });

  // init dial position
  setKnobAngle(1);

  // gentle faint static always present once powered (subtle texture)
  const faint = document.createElement('canvas');
  // (kept simple — the CSS scanlines + flicker carry the idle texture)

})();
