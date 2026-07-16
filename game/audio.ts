/* ================= audio (synthesized, no files) ================= */

let AC: AudioContext | null = null;
let NOISE: AudioBuffer | null = null;

export function audio(): AudioContext {
  if (!AC) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    AC = new Ctor();
  }
  if (AC.state === "suspended") AC.resume();
  return AC;
}

function env(node: AudioNode, t0: number, peak: number, dur: number) {
  const g = audio().createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  node.connect(g).connect(audio().destination);
  return g;
}

function noiseBuffer(): AudioBuffer {
  const ac = audio();
  const b = ac.createBuffer(1, ac.sampleRate * 0.3, ac.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

export function playThud(strong = false) {
  const ac = audio(),
    t = ac.currentTime;
  const o = ac.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(strong ? 110 : 85, t);
  o.frequency.exponentialRampToValueAtTime(35, t + 0.12);
  env(o, t, strong ? 0.5 : 0.22, 0.14);
  o.start(t);
  o.stop(t + 0.16);
}

export function playSplat() {
  const ac = audio(),
    t = ac.currentTime;
  if (!NOISE) NOISE = noiseBuffer();
  const src = ac.createBufferSource();
  src.buffer = NOISE;
  const f = ac.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.setValueAtTime(900, t);
  f.frequency.exponentialRampToValueAtTime(250, t + 0.12);
  f.Q.value = 1.2;
  src.connect(f);
  env(f, t, 0.4, 0.16);
  src.start(t);
  src.stop(t + 0.2);
}

export function playKnock() {
  const ac = audio(),
    t = ac.currentTime;
  const o = ac.createOscillator();
  o.type = "triangle";
  o.frequency.setValueAtTime(160, t);
  o.frequency.exponentialRampToValueAtTime(90, t + 0.06);
  env(o, t, 0.15, 0.08);
  o.start(t);
  o.stop(t + 0.1);
}

export function playLatch() {
  const ac = audio(),
    t = ac.currentTime;
  const o = ac.createOscillator();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(300, t);
  o.frequency.linearRampToValueAtTime(520, t + 0.09);
  env(o, t, 0.12, 0.12);
  o.start(t);
  o.stop(t + 0.14);
}

export function playHurt() {
  const ac = audio(),
    t = ac.currentTime;
  const o = ac.createOscillator();
  o.type = "square";
  o.frequency.setValueAtTime(220, t);
  o.frequency.exponentialRampToValueAtTime(70, t + 0.3);
  env(o, t, 0.3, 0.32);
  o.start(t);
  o.stop(t + 0.35);
}

export function playBite() {
  const ac = audio(),
    t = ac.currentTime;
  if (!NOISE) NOISE = noiseBuffer();
  // wet chomp: noise burst through a closing lowpass
  const src = ac.createBufferSource();
  src.buffer = NOISE;
  const f = ac.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.setValueAtTime(1300, t);
  f.frequency.exponentialRampToValueAtTime(300, t + 0.1);
  src.connect(f);
  env(f, t, 0.32, 0.12);
  src.start(t);
  src.stop(t + 0.14);
  // low crunch under it
  const o = ac.createOscillator();
  o.type = "square";
  o.frequency.setValueAtTime(95, t);
  o.frequency.exponentialRampToValueAtTime(48, t + 0.1);
  env(o, t, 0.18, 0.12);
  o.start(t);
  o.stop(t + 0.14);
}

export function playHeal() {
  const ac = audio(),
    t = ac.currentTime;
  [660, 880, 1174].forEach((freq, i) => {
    const o = ac.createOscillator();
    o.type = "sine";
    o.frequency.value = freq;
    env(o, t + i * 0.08, 0.2, 0.2);
    o.start(t + i * 0.08);
    o.stop(t + i * 0.08 + 0.22);
  });
}

export function playRampage() {
  const ac = audio(),
    t = ac.currentTime;
  [523, 659, 784, 1046].forEach((f, i) => {
    const o = ac.createOscillator();
    o.type = "triangle";
    o.frequency.value = f;
    env(o, t + i * 0.06, 0.18, 0.15);
    o.start(t + i * 0.06);
    o.stop(t + i * 0.06 + 0.18);
  });
}
