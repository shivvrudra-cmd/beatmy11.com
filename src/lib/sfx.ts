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

/**
 * True when a sound would be heard right now: not muted and the audio context is running.
 * A page that plays sounds by itself (the result page's reveal) must check this first: browsers
 * keep audio suspended until the visitor taps the page, and notes queued while suspended would
 * all play at once on that first tap.
 */
export function soundReady(): boolean {
  const c = audio();
  return !!c && c.state === 'running';
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
  // ---- result page (2026-10-02). Call only when soundReady(). ----
  /** A match card appears: won, lost, or level. */
  matchWon: () => { tone('triangle', 660, 660, 80, 0.5); tone('triangle', 990, 990, 140, 0.5, 0.08); },
  matchLost: () => tone('sine', 260, 170, 200, 0.6),
  matchLevel: () => tone('triangle', 440, 440, 120, 0.4),
  /** The series verdict. */
  seriesWon: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone('triangle', f, f, 200, 0.6, i * 0.1)),
  seriesLost: () => [392, 330, 262].forEach((f, i) => tone('sine', f, f, 220, 0.5, i * 0.14)),
  seriesLevel: () => [523, 523].forEach((f, i) => tone('triangle', f, f, 160, 0.5, i * 0.16)),
  /** The strength bars filling (`ms` long), then the grade appearing. */
  bars: (ms: number) => tone('sine', 220, 660, ms, 0.25),
  grade: () => { tone('triangle', 784, 784, 120, 0.6); tone('triangle', 1175, 1175, 260, 0.6, 0.1); },
  /** The eleventh player placed. */
  complete: () => [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 170, 0.6, i * 0.09)),
};
