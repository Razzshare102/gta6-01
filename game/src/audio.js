// All sound in Solmar City is synthesized with WebAudio — no audio files,
// no network. Engine hum, sirens, gunshots, pickups and a bass-line radio.
// Written fresh for gta6-01.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null, engineOsc2 = null, engineGain = null, engineFilter = null;
  let musicOn = true;
  let musicTimer = null;
  let sirenOsc = null, sirenGain = null, sirenStep = 0, sirenTimer = null;
  let noiseBuf = null;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      // Shared white-noise buffer for shots, skids and hats.
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    } catch {
      ctx = null;
    }
    return !!ctx;
  }

  function blip(freq, dur, type = 'sine', vol = 0.25, slideTo = null) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noiseBurst(dur, vol, filterFreq, type = 'lowpass') {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t); src.stop(t + dur + 0.02);
  }

  // --- engine: two detuned saws through a lowpass, pitch follows speed ---
  function startEngine() {
    if (!ensure() || engineOsc) return;
    engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth';
    engineOsc2 = ctx.createOscillator(); engineOsc2.type = 'square';
    engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass'; engineFilter.frequency.value = 420;
    engineGain = ctx.createGain(); engineGain.gain.value = 0.0;
    engineOsc.connect(engineFilter);
    engineOsc2.connect(engineFilter);
    engineFilter.connect(engineGain); engineGain.connect(master);
    engineOsc.start(); engineOsc2.start();
  }
  function setEngine(speedNorm, on) {
    if (!engineOsc) return;
    const t = ctx.currentTime;
    const f = 55 + speedNorm * 165;
    engineOsc.frequency.setTargetAtTime(f, t, 0.08);
    engineOsc2.frequency.setTargetAtTime(f * 1.5 + 3, t, 0.08);
    engineFilter.frequency.setTargetAtTime(320 + speedNorm * 900, t, 0.1);
    engineGain.gain.setTargetAtTime(on ? 0.05 + speedNorm * 0.06 : 0.0, t, 0.1);
  }

  // --- police siren: alternating two-tone ---
  function setSiren(on) {
    if (on && !sirenOsc && ensure()) {
      sirenOsc = ctx.createOscillator(); sirenOsc.type = 'triangle';
      sirenGain = ctx.createGain(); sirenGain.gain.value = 0.045;
      sirenOsc.connect(sirenGain); sirenGain.connect(master);
      sirenOsc.start();
      sirenTimer = window.setInterval(() => {
        sirenStep = 1 - sirenStep;
        if (sirenOsc) sirenOsc.frequency.value = sirenStep ? 950 : 700;
      }, 420);
    } else if (!on && sirenOsc) {
      window.clearInterval(sirenTimer);
      sirenTimer = null;
      try { sirenOsc.stop(); } catch { /* already stopped */ }
      sirenOsc = null; sirenGain = null;
    }
  }

  // --- radio: a moody 8-step bassline + hats, scheduled in a loop ---
  const BASSLINE = [55, 0, 65.4, 0, 49, 0, 58.3, 73.4];
  function startMusic() {
    if (!ensure() || musicTimer || !musicOn) return;
    let step = 0;
    musicTimer = window.setInterval(() => {
      if (!musicOn || !ctx) return;
      const f = BASSLINE[step % BASSLINE.length];
      if (f) blip(f, 0.34, 'square', 0.055);
      if (step % 2 === 0) noiseBurst(0.05, 0.03, 6000, 'highpass');
      step += 1;
    }, 240);
  }
  function stopMusic() {
    if (musicTimer) { window.clearInterval(musicTimer); musicTimer = null; }
  }
  function toggleMusic() {
    musicOn = !musicOn;
    if (musicOn) startMusic(); else stopMusic();
    return musicOn;
  }

  return {
    unlock() { ensure(); startEngine(); startMusic(); },
    setEngine,
    setSiren,
    toggleMusic,
    get musicOn() { return musicOn; },
    shoot() { noiseBurst(0.14, 0.5, 1800); blip(160, 0.1, 'square', 0.2, 60); },
    enemyShoot() { noiseBurst(0.1, 0.22, 1400); },
    dryClick() { blip(1200, 0.04, 'square', 0.12); },
    reload() { blip(500, 0.06, 'square', 0.12); window.setTimeout(() => blip(700, 0.06, 'square', 0.12), 180); },
    pickup() { blip(880, 0.09, 'sine', 0.25); window.setTimeout(() => blip(1318, 0.14, 'sine', 0.25), 90); },
    cash() { blip(1046, 0.08, 'sine', 0.22); window.setTimeout(() => blip(1568, 0.16, 'sine', 0.22), 80); },
    hit() { noiseBurst(0.08, 0.3, 900); },
    hurt() { blip(220, 0.18, 'sawtooth', 0.25, 90); },
    crash() { noiseBurst(0.25, 0.45, 500); blip(90, 0.25, 'sine', 0.3, 40); },
    sirenBlip() { blip(950, 0.12, 'triangle', 0.15, 700); },
    missionDone() { [523, 659, 784, 1046].forEach((f, i) => window.setTimeout(() => blip(f, 0.22, 'triangle', 0.22), i * 110)); },
    busted() { [392, 311, 233].forEach((f, i) => window.setTimeout(() => blip(f, 0.3, 'sawtooth', 0.2), i * 160)); },
  };
}
