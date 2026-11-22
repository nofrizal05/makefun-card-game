// Small WebAudio sounds, generated in code — no audio files. Sounds only
// start after a user gesture (the browser requires it), so the title screen
// stays silent until Play is pressed.
let context = null;
let muted = false;

export function setMuted(value) {
  muted = value;
}

export function isMuted() {
  return muted;
}

function audio() {
  if (muted) return null;
  try {
    if (!context) context = new (window.AudioContext || window.webkitAudioContext)();
    if (context.state === 'suspended') void context.resume();
    return context;
  } catch {
    return null;
  }
}

function tone(freq, dur, type, gain, when = 0) {
  const ctx = audio();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    amp.gain.setValueAtTime(gain, ctx.currentTime + when);
    amp.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + when + dur);
    osc.connect(amp);
    amp.connect(ctx.destination);
    osc.start(ctx.currentTime + when);
    osc.stop(ctx.currentTime + when + dur);
  } catch {
    // Sound is garnish: a failure here must never break the game.
  }
}

export const sfx = {
  play() { tone(520, 0.12, 'triangle', 0.12); tone(780, 0.14, 'triangle', 0.1, 0.07); },
  attack() { tone(180, 0.16, 'sawtooth', 0.1); tone(90, 0.2, 'square', 0.08, 0.05); },
  hurt() { tone(140, 0.25, 'sawtooth', 0.1); },
  heal() { tone(660, 0.15, 'sine', 0.1); tone(880, 0.2, 'sine', 0.08, 0.1); },
  turn() { tone(440, 0.1, 'triangle', 0.08); },
  win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.12, i * 0.12)); },
  lose() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.25, 'triangle', 0.1, i * 0.14)); },
  error() { tone(110, 0.12, 'square', 0.06); },
};
