'use client';

// ============================================================================
// SoundKit — procedural SFX (no external files/APIs).
// Preview plays instantly via WebAudio; "add" renders a short WAV blob that is
// placed on the timeline like any other audio clip.
// ============================================================================

export interface SoundItem {
  id: string;
  name: string;
  category: 'sfx' | 'music';
}

export const SOUND_LIBRARY: SoundItem[] = [
  { id: 'chime', name: 'Chime', category: 'sfx' },
  { id: 'click', name: 'Click', category: 'sfx' },
  { id: 'pop', name: 'Pop', category: 'sfx' },
  { id: 'whoosh', name: 'Whoosh', category: 'sfx' },
  { id: 'ding', name: 'Ding', category: 'sfx' },
  { id: 'bird', name: 'Bird Chirp', category: 'sfx' },
  { id: 'drum', name: 'Drum Beat', category: 'music' },
  { id: 'piano', name: 'Piano Note', category: 'music' },
];

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC =
    window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
  return ctx;
}

function tone(
  c: AudioContext,
  freq: number,
  start: number,
  dur: number,
  type: OscillatorType = 'sine',
  gain = 0.2
) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime + start);
  g.gain.setValueAtTime(0.0001, c.currentTime + start);
  g.gain.exponentialRampToValueAtTime(gain, c.currentTime + start + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(c.currentTime + start);
  osc.stop(c.currentTime + start + dur + 0.05);
}

/** Preview a sound immediately (no recording). */
export function previewSound(id: string) {
  const c = ac();
  if (!c) return;
  const now = 0;
  switch (id) {
    case 'chime':
      tone(c, 880, now, 0.4, 'sine');
      tone(c, 1320, now + 0.1, 0.5, 'sine', 0.12);
      break;
    case 'click':
      tone(c, 1200, now, 0.08, 'square', 0.1);
      break;
    case 'pop':
      tone(c, 500, now, 0.15, 'sine', 0.3);
      tone(c, 250, now + 0.05, 0.12, 'sine', 0.2);
      break;
    case 'whoosh':
      tone(c, 200, now, 0.4, 'sawtooth', 0.08);
      tone(c, 600, now, 0.3, 'sawtooth', 0.05);
      break;
    case 'ding':
      tone(c, 1568, now, 0.6, 'sine', 0.15);
      tone(c, 2093, now + 0.12, 0.7, 'sine', 0.08);
      break;
    case 'bird': {
      for (let i = 0; i < 4; i++) tone(c, 2600 + Math.random() * 600, i * 0.18, 0.09, 'sine', 0.06);
      break;
    }
    case 'drum':
      tone(c, 120, now, 0.18, 'sine', 0.4);
      tone(c, 90, now + 0.22, 0.18, 'sine', 0.4);
      tone(c, 120, now + 0.44, 0.18, 'sine', 0.4);
      break;
    case 'piano':
      tone(c, 523, now, 0.5, 'triangle', 0.2);
      tone(c, 659, now + 0.12, 0.5, 'triangle', 0.16);
      tone(c, 784, now + 0.24, 0.6, 'triangle', 0.14);
      break;
    default:
      break;
  }
}

function writeWavHeader(wav: DataView, sr: number, n: number) {
  const bytes = 44 + n * 2;
  wav.setUint8(0, 0x52); wav.setUint8(1, 0x49); wav.setUint8(2, 0x46); wav.setUint8(3, 0x46); // RIFF
  wav.setUint32(4, bytes - 8, true);
  wav.setUint8(8, 0x57); wav.setUint8(9, 0x41); wav.setUint8(10, 0x56); wav.setUint8(11, 0x45); // WAVE
  wav.setUint8(12, 0x66); wav.setUint8(13, 0x6d); wav.setUint8(14, 0x74); wav.setUint8(15, 0x20); // fmt
  wav.setUint32(16, 16, true);
  wav.setUint16(20, 1, true);
  wav.setUint16(22, 1, true);
  wav.setUint32(24, sr, true);
  wav.setUint32(28, sr * 2, true);
  wav.setUint16(32, 2, true);
  wav.setUint16(34, 16, true);
  wav.setUint8(36, 0x64); wav.setUint8(37, 0x61); wav.setUint8(38, 0x74); wav.setUint8(39, 0x61); // data
  wav.setUint32(40, n * 2, true);
}

/** Render a short audio blob for the given sound (async, ~1s). */
export async function renderSound(id: string): Promise<Blob> {
  // simple: use preview path with a tiny manual buffer fallback so the clip is
  // always non-empty; real synthesis quality is a future upgrade.
  const seconds = 1;
  const sr = 16000;
  const n = sr * seconds;
  const arr = new Uint8Array(44 + n * 2);
  const wav = new DataView(arr.buffer);
  writeWavHeader(wav, sr, n);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let v = 0;
    if (id === 'ding') v = 0.15 * Math.sin(2 * Math.PI * 1568 * t) * Math.exp(-6 * t);
    else if (id === 'chime') v = 0.12 * Math.sin(2 * Math.PI * 880 * t) * Math.exp(-5 * t);
    else if (id === 'pop') v = 0.2 * Math.sin(2 * Math.PI * 400 * t) * Math.exp(-20 * t);
    else if (id === 'click') v = 0.1 * (t < 0.06 ? Math.sin(2 * Math.PI * 1200 * t) : 0);
    else if (id === 'whoosh') v = 0.08 * Math.sin(2 * Math.PI * (200 + 800 * t) * t) * (t < 0.5 ? 1 : 0);
    else if (id === 'bird') v = 0.06 * Math.sin(2 * Math.PI * 2600 * t) * Math.exp(-12 * ((t % 0.18)));
    else if (id === 'drum') v = (t < 0.15 ? 0.3 * Math.sin(2 * Math.PI * 120 * t) * Math.exp(-15 * t) : 0) + (t > 0.25 && t < 0.4 ? 0.3 * Math.sin(2 * Math.PI * 120 * (t - 0.25)) * Math.exp(-15 * (t - 0.25)) : 0);
    else if (id === 'piano') v = 0.14 * Math.sin(2 * Math.PI * 523 * t) * Math.exp(-3 * t);
    wav.setInt16(44 + i * 2, Math.max(-1, Math.min(1, v)) * 32767, true);
  }
  return new Blob([arr], { type: 'audio/wav' });
}
