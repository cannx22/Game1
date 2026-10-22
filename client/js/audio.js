// Oyunun kendi ses efektleri, WebAudio ile anlık üretilir. Mikrofon ya da ses iletimi yoktur.
let ctx = null;
let master = null;
let noiseBuf = null;
let volume = 0.6;
let muted = false;

try {
  const saved = JSON.parse(localStorage.getItem('ck_audio') || '{}');
  if (typeof saved.volume === 'number') volume = saved.volume;
  if (typeof saved.muted === 'boolean') muted = saved.muted;
} catch { /* storage unavailable */ }

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  master.gain.value = muted ? 0 : volume;
  return true;
}

function save() {
  try { localStorage.setItem('ck_audio', JSON.stringify({ volume, muted })); } catch { /* ignore */ }
}

export const audioSettings = {
  get volume() { return volume; },
  set volume(v) { volume = v; save(); if (master) master.gain.value = muted ? 0 : volume; },
  get muted() { return muted; },
  set muted(v) { muted = v; save(); if (master) master.gain.value = muted ? 0 : volume; },
};

function tone(freq, dur, { type = 'sine', gain = 0.2, to = null, delay = 0, attack = 0.01 } = {}) {
  if (!ensure() || muted) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(dur, { gain = 0.2, freq = 1200, q = 1, delay = 0, type = 'bandpass' } = {}) {
  if (!ensure() || muted) return;
  const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t);
  s.stop(t + dur + 0.05);
}

export const sfx = {
  unlock() { ensure(); },
  click() { tone(900, 0.05, { type: 'triangle', gain: 0.08 }); },
  peep() { tone(1900, 0.09, { gain: 0.12, to: 2600 }); tone(2100, 0.09, { gain: 0.1, to: 2900, delay: 0.11 }); },
  chirp() { tone(2600 + Math.random() * 800, 0.06, { gain: 0.03, to: 3400 }); },
  step() { noise(0.04, { gain: 0.03, freq: 500 }); },
  pop() { tone(500, 0.08, { type: 'triangle', gain: 0.15, to: 900 }); },
  success() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, { type: 'triangle', gain: 0.12, delay: i * 0.07 })); },
  fail() { tone(220, 0.25, { type: 'sawtooth', gain: 0.06, to: 140 }); },
  bell() { [0, 0.45, 0.9].forEach(d => { tone(880, 1.2, { gain: 0.15, delay: d }); tone(1320, 0.9, { gain: 0.06, delay: d }); }); },
  alarm() { for (let i = 0; i < 4; i++) { tone(620, 0.22, { type: 'square', gain: 0.05, delay: i * 0.45 }); tone(820, 0.22, { type: 'square', gain: 0.05, delay: i * 0.45 + 0.22 }); } },
  poof() { noise(0.45, { gain: 0.35, freq: 900, q: 0.6 }); tone(700, 0.3, { type: 'square', gain: 0.05, to: 200 }); },
  squawk() { tone(700, 0.15, { type: 'sawtooth', gain: 0.08, to: 1200 }); tone(600, 0.2, { type: 'sawtooth', gain: 0.07, to: 300, delay: 0.15 }); },
  vote() { tone(660, 0.08, { type: 'square', gain: 0.06 }); tone(990, 0.12, { type: 'square', gain: 0.06, delay: 0.08 }); },
  splash() { noise(0.35, { gain: 0.15, freq: 2500, q: 0.5 }); },
  thud() { tone(120, 0.18, { gain: 0.25, to: 60 }); noise(0.12, { gain: 0.1, freq: 300 }); },
  door() { tone(180, 0.3, { type: 'square', gain: 0.07, to: 90 }); },
  whoosh() { noise(0.4, { gain: 0.15, freq: 600, type: 'lowpass' }); },
  quack() { tone(420, 0.12, { type: 'sawtooth', gain: 0.07, to: 300 }); tone(420, 0.12, { type: 'sawtooth', gain: 0.07, to: 300, delay: 0.18 }); },
  rooster() { tone(500, 0.2, { type: 'sawtooth', gain: 0.06, to: 900 }); tone(900, 0.5, { type: 'sawtooth', gain: 0.06, to: 700, delay: 0.2 }); tone(700, 0.4, { type: 'sawtooth', gain: 0.05, to: 400, delay: 0.7 }); },
  meeting() { tone(523, 0.3, { type: 'triangle', gain: 0.15 }); tone(392, 0.4, { type: 'triangle', gain: 0.15, delay: 0.25 }); tone(523, 0.5, { type: 'triangle', gain: 0.15, delay: 0.55 }); },
  win() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.25, { type: 'triangle', gain: 0.14, delay: i * 0.13 })); },
  lose() { [392, 370, 349, 262].forEach((f, i) => tone(f, 0.35, { type: 'triangle', gain: 0.13, delay: i * 0.22 })); },
  role(imp) { if (imp) [196, 233, 196, 147].forEach((f, i) => tone(f, 0.4, { type: 'sawtooth', gain: 0.06, delay: i * 0.2 })); else [392, 494, 587, 784].forEach((f, i) => tone(f, 0.3, { type: 'triangle', gain: 0.12, delay: i * 0.15 })); },
};
