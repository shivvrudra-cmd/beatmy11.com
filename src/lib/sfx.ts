/**
 * sfx.ts — the draft's sound effects (owner, 2026-10-02): reel ticks, the two landings, picking
 * and placing a player. Synthesised with Web Audio, so there are no sound files to download.
 * Browser-only. Quiet by design, off with one tap (remembered), and silent wherever Web Audio is
 * missing. The audio context is created on the first sound, which always follows a tap.
 */
const KEY = 'beatmy11.sound';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
try {
  muted = localStorage.getItem(KEY) === 'off';
} catch {
  /* storage blocked: sound stays on for this visit */
}

export const isMuted = () => muted;

export function setMuted(next: boolean): void {
  muted = next;
  try {
    localStorage.setItem(KEY, next ? 'off' : 'on');
  } catch {
    /* not remembered, still applied */
  }
}

function audio(): AudioContext | null {
  if (muted) return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.22;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** One short note: `from` → `to` Hz over `ms`, starting `at` seconds from now. */
function tone(type: OscillatorType, from: number, to: number, ms: number, vol = 1, at = 0): void {
  const c = audio();
  if (!c || !master) return;
  const t = c.currentTime + at;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + ms / 1000);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + ms / 1000 + 0.02);
}

export const sfx = {
  /** A reel moving on one step. */
  tick: () => tone('square', 1100, 700, 28, 0.25),
  /** A reel stopping. The second (last) reel also rings. */
  land: (last: boolean) => {
    tone('sine', 190, 70, 150, 1);
    tone('square', 900, 300, 40, 0.3);
    if (last) {
      tone('triangle', 880, 880, 160, 0.5, 0.05);
      tone('triangle', 1320, 1320, 260, 0.5, 0.15);
    }
  },
  /** A player card picked up. */
  select: () => tone('triangle', 620, 760, 60, 0.5),
  /** A player placed in the XI. */
  place: () => {
    tone('triangle', 520, 520, 70, 0.6);
    tone('triangle', 780, 780, 110, 0.6, 0.07);
  },
  /** A player taken back out, or a pick cancelled. */
  remove: () => tone('triangle', 520, 330, 110, 0.5),
  /** A pick that cannot be made. */
  blocked: () => tone('sawtooth', 150, 110, 140, 0.35),
  /** The eleventh player placed. */
  complete: () => [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 170, 0.6, i * 0.09)),
};
