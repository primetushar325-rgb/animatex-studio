// ============================================================================
// AnimateX - Shared Canvas Renderer
// ----------------------------------------------------------------------------
// A single drawing engine used by BOTH the interactive editor canvas and the
// video exporter, so what you see in the editor is exactly what gets exported.
//
// Features:
//  - Distinct procedural characters per CharacterType (boy, girl, dog, cat…)
//  - Action based limb animation (walk / run / wave / dance / …)
//  - Expression + lip-sync mouth rendering
//  - Real image drawing (custom uploads) via drawImage
//  - Selection overlay geometry (resize / rotate handles) reused by Canvas
// ============================================================================

import type {
  CanvasObject,
  CharacterAction,
  CharacterExpression,
  CharacterType,
  MouthShape,
  MotionPreset,
  Scene,
} from '@/types/animation';

// ---------------------------------------------------------------------------
// Watermark
// ---------------------------------------------------------------------------

export function drawWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  text: string,
  enabled = true
) {
  if (!enabled || !text) return;

  const base = Math.max(width, height);
  const fontSize = Math.max(12, base * 0.022);
  const pad = base * 0.028;
  const margin = base * 0.02;

  ctx.save();
  ctx.font = `600 ${fontSize}px "Noto Sans Bengali", "Hind Siliguri", "Kalpurush", "SolaimanLipi", sans-serif`;
  const metrics = ctx.measureText(text);
  const textW = metrics.width;
  const pillW = textW + pad * 2;
  const pillH = fontSize * 1.9;

  // rounded pill at bottom-right corner
  const x = width - pillW - margin;
  const y = height - pillH - margin;

  ctx.globalAlpha = 0.78;
  ctx.fillStyle = 'rgba(10, 14, 26, 0.45)';
  rr(ctx, x, y, pillW, pillH, pillH / 2);
  ctx.fill();

  ctx.globalAlpha = 0.95;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('🎬', x + pad * 0.6, y + pillH / 2);
  ctx.fillText(text, x + pad + fontSize * 1.15, y + pillH / 2);

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Motion presets (entrance / exit effects driven by scene time)
// ---------------------------------------------------------------------------

const MOTION_DURATION = 850; // ms
const FADE_OUT_MS = 900; // ms before scene end

export interface MotionModifiers {
  dx: number;
  dy: number;
  scale: number;
  rotation: number;
  alpha: number;
}

function easeOutCubic(p: number) {
  return 1 - Math.pow(1 - p, 3);
}

export function getMotionModifiers(
  obj: CanvasObject,
  t: number,
  sceneDuration: number,
  playback: boolean
): MotionModifiers {
  const none: MotionModifiers = { dx: 0, dy: 0, scale: 1, rotation: 0, alpha: 1 };
  if (!playback) return none;

  const preset = obj.motion || 'none';
  if (preset === 'none') return none;

  const start = obj.motionStart ?? 0;
  const w = obj.width * obj.scaleX;
  const h = obj.height * obj.scaleY;

  if (preset === 'fade-out') {
    const dur = sceneDuration > 0 ? sceneDuration : 5000;
    const p = clamp((t - (dur - FADE_OUT_MS)) / FADE_OUT_MS, 0, 1);
    return { ...none, alpha: 1 - p };
  }

  const p = clamp((t - start) / MOTION_DURATION, 0, 1);
  const e = easeOutCubic(p);

  switch (preset) {
    case 'fade-in':
      return { ...none, alpha: p };
    case 'slide-left':
      return { ...none, dx: -(1 - e) * w * 0.7 };
    case 'slide-right':
      return { ...none, dx: (1 - e) * w * 0.7 };
    case 'slide-up':
      return { ...none, dy: -(1 - e) * h * 0.7 };
    case 'slide-down':
      return { ...none, dy: (1 - e) * h * 0.7 };
    case 'pop-in': {
      // overshoot scale
      const scale = p < 0.65 ? 0.3 + 1.15 * easeOutCubic(p / 0.65) : 1.075 - 0.075 * ((p - 0.65) / 0.35);
      return { ...none, scale };
    }
    case 'bounce': {
      const bounce = Math.abs(Math.sin(p * Math.PI * 3)) * (1 - p * 0.6);
      return { ...none, dy: -bounce * h * 0.12, scale: 0.92 + 0.08 * e };
    }
    case 'zoom-in':
      return { ...none, scale: 0.4 + 0.6 * e };
    case 'spin-in':
      return { ...none, scale: 0.3 + 0.7 * e, rotation: (1 - e) * 360 };
    default:
      return none;
  }
}

export const MOTION_PRESETS: { id: MotionPreset; label: string; icon: string }[] = [
  { id: 'none', label: 'None', icon: '🚫' },
  { id: 'fade-in', label: 'Fade In', icon: '🌅' },
  { id: 'fade-out', label: 'Fade Out', icon: '🌇' },
  { id: 'slide-left', label: 'Slide Left', icon: '⬅️' },
  { id: 'slide-right', label: 'Slide Right', icon: '➡️' },
  { id: 'slide-up', label: 'Slide Up', icon: '⬆️' },
  { id: 'slide-down', label: 'Slide Down', icon: '⬇️' },
  { id: 'pop-in', label: 'Pop In', icon: '🎉' },
  { id: 'bounce', label: 'Bounce', icon: '🏀' },
  { id: 'zoom-in', label: 'Zoom In', icon: '🔍' },
  { id: 'spin-in', label: 'Spin In', icon: '🌀' },
];

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const TAU = Math.PI * 2;

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

/** Phase of a repeating cycle: returns 0..TAU for the given time (ms). */
function cycle(t: number, period: number) {
  return ((t % period) / period) * TAU;
}

/** Rounded rectangle path (compatible with older browsers). */
function rr(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function ellipse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  fill: string
) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill();
}

/** Draws a thick rounded "bone" limb from a joint in a direction. */
function limb(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  length: number,
  angle: number,
  width: number,
  color: string
): { x: number; y: number } {
  const x1 = x0 + Math.cos(angle) * length;
  const y1 = y0 + Math.sin(angle) * length;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  return { x: x1, y: y1 };
}

/** Two-segment limb (upper + lower) with a joint. Returns the hand/foot tip. */
function limb2(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  upperLen: number,
  lowerLen: number,
  upperAngle: number,
  lowerBend: number,
  upperWidth: number,
  lowerWidth: number,
  upperColor: string,
  lowerColor: string
): { x: number; y: number } {
  const elbow = limb(ctx, x0, y0, upperLen, upperAngle, upperWidth, upperColor);
  return limb(
    ctx,
    elbow.x,
    elbow.y,
    lowerLen,
    upperAngle + lowerBend,
    lowerWidth,
    lowerColor
  );
}

// ---------------------------------------------------------------------------
// Image loading / caching
// ---------------------------------------------------------------------------

const imageCache = new Map<string, HTMLImageElement | null>();

export function getImage(url: string): Promise<HTMLImageElement | null> {
  const cached = imageCache.get(url);
  if (cached !== undefined) return Promise.resolve(cached);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageCache.set(url, img);
      resolve(img);
    };
    img.onerror = () => {
      imageCache.set(url, null);
      resolve(null);
    };
    img.src = url;
  });
}

export function getCachedImage(url?: string): HTMLImageElement | null {
  if (!url) return null;
  return imageCache.get(url) ?? null;
}

/** Test/dev hook: manually register an image in the cache (used by renderer tests). */
export function seedImageCache(url: string, img: HTMLImageElement | null): void {
  imageCache.set(url, img);
}

export async function preloadImages(objects: CanvasObject[]): Promise<void> {
  const urls = Array.from(
    new Set(objects.map((o) => o.imageUrl).filter((u): u is string => !!u))
  );
  await Promise.all(urls.map((u) => getImage(u).catch(() => null)));
}

/** Cover-fit image drawing (crops to fill the box, keeps aspect ratio). */
function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  if (!img.width || !img.height) return;
  const ir = img.width / img.height;
  const r = w / h;
  let dw: number, dh: number, dx: number, dy: number;
  if (ir > r) {
    dh = h;
    dw = h * ir;
    dx = x + (w - dw) / 2;
    dy = y;
  } else {
    dw = w;
    dh = w / ir;
    dx = x;
    dy = y + (h - dh) / 2;
  }
  ctx.drawImage(img, dx, dy, dw, dh);
}

// ---------------------------------------------------------------------------
// Character action poses
// ---------------------------------------------------------------------------

export interface CharacterPose {
  bodyY: number; // vertical body offset (multiplied by h when used)
  lean: number; // torso lean (radians)
  headTilt: number; // head tilt (radians)
  armL: number; // left shoulder rotation from rest (rad, 0 = down)
  armR: number;
  elbowL: number;
  elbowR: number;
  legL: number; // left hip rotation from rest
  legR: number;
  kneeL: number; // left knee bend
  kneeR: number;
  tailSwing: number; // animal tail
  wingFlap: number; // bird wing
  mouthOpen: number; // 0..1
  blink: boolean;
  bounce: number; // 0..1 body shake
}

function basePose(): CharacterPose {
  return {
    bodyY: 0,
    lean: 0,
    headTilt: 0,
    armL: 0,
    armR: 0,
    elbowL: 0,
    elbowR: 0,
    legL: 0,
    legR: 0,
    kneeL: 0,
    kneeR: 0,
    tailSwing: 0,
    wingFlap: 0,
    mouthOpen: 0,
    blink: false,
    bounce: 0,
  };
}

/**
 * Pose convention (front view):
 *  - armL/armR, legL/legR: swing from rest (0 = hanging straight down),
 *    POSITIVE = outward (away from the body centre).
 *  - elbowL/elbowR, kneeL/kneeR: bend, POSITIVE = outward.
 * The drawing code mirrors the sign per side automatically.
 */
export function getActionPose(action: CharacterAction, t: number): CharacterPose {
  const p = basePose();

  switch (action) {
    case 'idle': {
      const w = cycle(t, 3000);
      p.bodyY = Math.sin(w) * 0.012;
      p.armL = Math.sin(w) * 0.06;
      p.armR = -Math.sin(w) * 0.06;
      p.blink = t % 3400 < 140;
      return p;
    }
    case 'stand': {
      p.bodyY = Math.sin(cycle(t, 2600)) * 0.01;
      return p;
    }
    case 'sit': {
      p.legL = 0.9;
      p.legR = 0.9;
      p.kneeL = 1.1;
      p.kneeR = 1.1;
      p.armL = 0.18;
      p.armR = 0.18;
      p.elbowL = 0.5;
      p.elbowR = 0.5;
      p.bodyY = Math.sin(cycle(t, 3000)) * 0.008;
      return p;
    }
    case 'walk': {
      const w = cycle(t, 720);
      const s = Math.sin(w);
      p.legL = s * 0.2;
      p.legR = -s * 0.2;
      p.kneeL = Math.max(0, s) * 1.0;
      p.kneeR = Math.max(0, -s) * 1.0;
      p.armL = -s * 0.55;
      p.armR = s * 0.55;
      p.elbowL = 0.3;
      p.elbowR = 0.3;
      p.bodyY = Math.abs(s) * 0.03;
      p.lean = 0.08;
      return p;
    }
    case 'run': {
      const w = cycle(t, 380);
      const s = Math.sin(w);
      p.legL = s * 0.32;
      p.legR = -s * 0.32;
      p.kneeL = Math.max(0, s) * 1.4;
      p.kneeR = Math.max(0, -s) * 1.4;
      p.armL = -s * 0.9;
      p.armR = s * 0.9;
      p.elbowL = 0.55;
      p.elbowR = 0.55;
      p.bodyY = Math.abs(s) * 0.06;
      p.lean = 0.38;
      return p;
    }
    case 'jump': {
      const up = Math.sin(cycle(t, 1100)); // -1..1
      const rising = up > 0;
      p.bodyY = -up * 0.16;
      p.armL = rising ? 1.1 : 0.4;
      p.armR = rising ? 1.1 : 0.4;
      p.elbowL = 0.25;
      p.elbowR = 0.25;
      p.kneeL = rising ? 1.25 : 0.25;
      p.kneeR = rising ? 1.25 : 0.25;
      p.legL = rising ? 0.35 : -0.1;
      p.legR = rising ? 0.35 : -0.1;
      return p;
    }
    case 'wave': {
      const w = cycle(t, 500);
      p.armR = 2.55; // raised high, slightly out
      p.elbowR = Math.sin(w) * 0.6 - 0.35;
      p.armL = 0.15;
      p.elbowL = 0.4;
      p.headTilt = 0.14;
      p.bodyY = Math.sin(cycle(t, 2600)) * 0.01;
      return p;
    }
    case 'talk': {
      const w = cycle(t, 430);
      p.mouthOpen = 0.35 + 0.65 * Math.abs(Math.sin(w));
      p.headTilt = Math.sin(cycle(t, 1400)) * 0.05;
      p.armL = Math.sin(cycle(t, 1400)) * 0.16;
      p.armR = -p.armL;
      p.elbowL = 0.55;
      p.elbowR = 0.55;
      return p;
    }
    case 'point': {
      p.armR = 1.35; // arm out to the side
      p.elbowR = 0.1;
      p.armL = 0.35;
      p.elbowL = 1.15; // hand on hip
      p.legL = 0.14;
      p.legR = 0.34;
      p.headTilt = 0.16;
      return p;
    }
    case 'clap': {
      const w = cycle(t, 620);
      p.armL = 1.2;
      p.armR = 1.2;
      p.elbowL = 0.45 + Math.sin(w) * 0.4;
      p.elbowR = 0.45 - Math.sin(w) * 0.4;
      p.bodyY = Math.abs(Math.sin(w)) * 0.012;
      return p;
    }
    case 'cry': {
      p.armL = 1.7;
      p.armR = 1.7;
      p.elbowL = 0.9;
      p.elbowR = 0.9;
      p.headTilt = -0.12;
      p.bounce = 0.5;
      p.mouthOpen = 0.85;
      return p;
    }
    case 'laugh': {
      const w = cycle(t, 450);
      p.bodyY = Math.abs(Math.sin(w)) * 0.05;
      p.armL = 0.9;
      p.armR = 0.9;
      p.elbowL = 0.35;
      p.elbowR = 0.35;
      p.headTilt = -0.28;
      p.mouthOpen = 0.95;
      return p;
    }
    case 'dance': {
      const w = cycle(t, 600);
      p.armL = Math.sin(w) * 1.15;
      p.armR = -Math.sin(w) * 1.15;
      p.elbowL = 0.4;
      p.elbowR = 0.4;
      p.legL = Math.sin(w + Math.PI / 2) * 0.35;
      p.legR = -p.legL;
      p.kneeL = Math.max(0, Math.sin(w)) * 0.45;
      p.kneeR = Math.max(0, -Math.sin(w)) * 0.45;
      p.bodyY = Math.abs(Math.sin(w)) * 0.02;
      p.headTilt = Math.sin(w) * 0.22;
      return p;
    }
    case 'fall': {
      p.lean = 1.15;
      p.armL = 1.9;
      p.armR = -0.5;
      p.legL = 1.5;
      p.legR = -0.7;
      p.bodyY = 0.05;
      return p;
    }
    default:
      return p;
  }
}

// ---------------------------------------------------------------------------
// Character palettes (distinct look per type)
// ---------------------------------------------------------------------------

interface HumanCfg {
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
  shoes: string;
  dress?: boolean;
  hairStyle?: 'short' | 'long' | 'bald' | 'bun' | 'spiky';
  build?: 'slim' | 'wide';
  glasses?: boolean;
  hat?: 'cap' | 'none';
}

const HUMAN_PALETTES: Record<string, HumanCfg> = {
  boy: {
    skin: '#F6C39A',
    hair: '#3B2A1A',
    shirt: '#3B82F6',
    pants: '#2F4A6B',
    shoes: '#5D4037',
    hairStyle: 'spiky',
    hat: 'none',
  },
  girl: {
    skin: '#F6C39A',
    hair: '#8B4513',
    shirt: '#EC4899',
    pants: '#A855F7',
    shoes: '#F9A8D4',
    hairStyle: 'long',
    dress: true,
  },
  child: {
    skin: '#F6C39A',
    hair: '#6D4C41',
    shirt: '#F59E0B',
    pants: '#3F51B5',
    shoes: '#EF4444',
    hairStyle: 'short',
    hat: 'cap',
  },
  man: {
    skin: '#D9A066',
    hair: '#1F2937',
    shirt: '#10B981',
    pants: '#37474F',
    shoes: '#111827',
    hairStyle: 'short',
    build: 'wide',
  },
  woman: {
    skin: '#E8B78D',
    hair: '#4E342E',
    shirt: '#8E24AA',
    pants: '#512DA8',
    shoes: '#C2185B',
    hairStyle: 'long',
    dress: true,
  },
  'old-man': {
    skin: '#C68E62',
    hair: '#E5E7EB',
    shirt: '#64748B',
    pants: '#475569',
    shoes: '#334155',
    hairStyle: 'bald',
    glasses: true,
    build: 'wide',
  },
  'old-woman': {
    skin: '#D7A97C',
    hair: '#CBD5E1',
    shirt: '#7E57C2',
    pants: '#5E35B1',
    shoes: '#AB47BC',
    hairStyle: 'bun',
    glasses: true,
  },
};

interface AnimalCfg {
  body: string;
  belly: string;
  accent: string;
  ear: string;
  nose: string;
  tail: string;
  legs: string;
}

const ANIMAL_PALETTES: Record<string, AnimalCfg> = {
  dog: {
    body: '#B57A4F',
    belly: '#F0D9B8',
    accent: '#8A5A34',
    ear: '#7A4A2F',
    nose: '#2B2B2B',
    tail: '#B57A4F',
    legs: '#9A653F',
  },
  cat: {
    body: '#F59E0B',
    belly: '#FDE8C8',
    accent: '#B45309',
    ear: '#F59E0B',
    nose: '#F472B6',
    tail: '#F59E0B',
    legs: '#D97706',
  },
  cow: {
    body: '#F5F0E6',
    belly: '#FFFFFF',
    accent: '#3F3F46',
    ear: '#F5F0E6',
    nose: '#E8A0A8',
    tail: '#3F3F46',
    legs: '#D8D0C2',
  },
  goat: {
    body: '#E8E4DA',
    belly: '#FAF8F2',
    accent: '#B7AFA0',
    ear: '#D8D2C5',
    nose: '#C98E7D',
    tail: '#D8D2C5',
    legs: '#CFC7B8',
  },
  bird: {
    body: '#3B82F6',
    belly: '#BFDBFE',
    accent: '#1D4ED8',
    ear: '#3B82F6',
    nose: '#F59E0B',
    tail: '#1D4ED8',
    legs: '#F59E0B',
  },
};

// ---------------------------------------------------------------------------
// Face (expressions + mouth shapes)
// ---------------------------------------------------------------------------

function drawFace(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  expression: CharacterExpression,
  mouthOpen: number,
  blink: boolean,
  cfg?: HumanCfg
) {
  const eyeOff = r * 0.42;
  const eyeY = y - r * 0.05;
  const eyeR = r * 0.14;
  const browY = eyeY - r * 0.32;

  const stroke = (c: string, w: number) => {
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
  };

  // --- eyes & brows ---
  const drawEyePair = (mode: 'open' | 'happy' | 'closed-up' | 'closed-down' | 'wide' | 'narrow' | 'teary', offset = 0) => {
    for (const side of [-1, 1]) {
      const ex = x + side * eyeOff + offset * side;
      if (mode === 'happy') {
        stroke('#1F2937', Math.max(2, r * 0.09));
        ctx.beginPath();
        ctx.arc(ex, eyeY, eyeR * 0.9, Math.PI, 0);
        ctx.stroke();
      } else if (mode === 'closed-up' || mode === 'closed-down') {
        stroke('#1F2937', Math.max(2, r * 0.09));
        ctx.beginPath();
        ctx.arc(
          ex,
          mode === 'closed-up' ? eyeY + eyeR * 0.35 : eyeY + eyeR * 0.35,
          eyeR * 0.8,
          mode === 'closed-up' ? Math.PI : 0,
          mode === 'closed-up' ? 0 : Math.PI,
          mode === 'closed-up'
        );
        ctx.stroke();
      } else if (mode === 'wide') {
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(ex, eyeY, eyeR * 1.35, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#1F2937';
        ctx.beginPath();
        ctx.arc(ex, eyeY, eyeR * 0.55, 0, TAU);
        ctx.fill();
      } else if (mode === 'narrow') {
        stroke('#1F2937', Math.max(2, r * 0.11));
        ctx.beginPath();
        ctx.moveTo(ex - eyeR * 0.8, eyeY);
        ctx.lineTo(ex + eyeR * 0.8, eyeY);
        ctx.stroke();
      } else if (mode === 'teary') {
        ctx.fillStyle = '#1F2937';
        ctx.beginPath();
        ctx.arc(ex, eyeY, eyeR, 0, TAU);
        ctx.fill();
        // tear drop
        ctx.fillStyle = '#60A5FA';
        ctx.beginPath();
        ctx.arc(ex + r * 0.28, eyeY + eyeR * 1.1, r * 0.06, 0, TAU);
        ctx.fill();
      } else {
        // open
        ctx.fillStyle = '#1F2937';
        ctx.beginPath();
        ctx.arc(ex, eyeY, blink ? 0 : eyeR, 0, TAU);
        ctx.fill();
        if (blink) {
          stroke('#1F2937', Math.max(2, r * 0.08));
          ctx.beginPath();
          ctx.moveTo(ex - eyeR, eyeY);
          ctx.lineTo(ex + eyeR, eyeY);
          ctx.stroke();
        }
      }
    }
  };

  // --- mouth ---
  const drawMouth = (shape: 'smile' | 'frown' | 'open' | 'small-o' | 'w' | 'flat' | 'wide-smile', open = 0) => {
    const my = y + r * 0.58;
    if (shape === 'open' || shape === 'wide-smile' || shape === 'small-o') {
      const o = open > 0.2 ? open : shape === 'small-o' ? 0.35 : 0.55;
      ctx.fillStyle = '#7C2D12';
      ctx.beginPath();
      if (shape === 'small-o') {
        ctx.arc(x, my, r * 0.16 * o, 0, TAU);
      } else {
        ctx.ellipse(x, my, r * 0.3, r * (shape === 'wide-smile' ? 0.22 : 0.26) * o, 0, 0, TAU);
      }
      ctx.fill();
      if (shape === 'wide-smile' || shape === 'open') {
        // tongue
        ctx.fillStyle = '#F87171';
        ctx.beginPath();
        ctx.ellipse(x, my + r * 0.16 * o, r * 0.16, r * 0.1 * o, 0, 0, TAU);
        ctx.fill();
      }
    } else if (shape === 'smile') {
      stroke('#7C2D12', Math.max(2, r * 0.08));
      ctx.beginPath();
      ctx.arc(x, my - r * 0.08, r * 0.26, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    } else if (shape === 'frown') {
      stroke('#7C2D12', Math.max(2, r * 0.08));
      ctx.beginPath();
      ctx.arc(x, my + r * 0.22, r * 0.24, 1.15 * Math.PI, 1.85 * Math.PI);
      ctx.stroke();
    } else if (shape === 'w') {
      stroke('#7C2D12', Math.max(2, r * 0.07));
      ctx.beginPath();
      ctx.arc(x - r * 0.12, my, r * 0.08, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.arc(x + r * 0.12, my, r * 0.08, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();
    } else {
      stroke('#7C2D12', Math.max(2, r * 0.07));
      ctx.beginPath();
      ctx.moveTo(x - r * 0.2, my);
      ctx.lineTo(x + r * 0.2, my);
      ctx.stroke();
    }
  };

  // --- brows ---
  const drawBrows = (ang: number, offset = 0) => {
    stroke('#1F2937', Math.max(2, r * 0.09));
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + side * (eyeOff - eyeR * 0.6), browY + side * ang * r * 0.22 + offset);
      ctx.lineTo(x + side * (eyeOff + eyeR * 0.7), browY - side * ang * r * 0.22 + offset);
      ctx.stroke();
    }
  };

  switch (expression) {
    case 'happy':
      drawEyePair(blink ? 'closed-up' : 'happy');
      drawBrows(-0.3);
      drawMouth('smile');
      break;
    case 'sad':
      drawEyePair('open');
      drawBrows(0.7);
      drawMouth('frown');
      // tear
      ctx.fillStyle = '#60A5FA';
      ctx.beginPath();
      ctx.arc(x + eyeOff + r * 0.05, eyeY + r * 0.4, r * 0.06, 0, TAU);
      ctx.fill();
      break;
    case 'angry':
      drawEyePair('narrow');
      drawBrows(-0.85);
      drawMouth('frown');
      // angry vein line
      stroke('#EF4444', Math.max(1.5, r * 0.05));
      ctx.beginPath();
      ctx.moveTo(x - eyeOff - r * 0.35, browY - r * 0.15);
      ctx.lineTo(x - eyeOff + r * 0.05, browY + r * 0.05);
      ctx.stroke();
      break;
    case 'scared':
      drawEyePair('wide');
      drawBrows(-0.9, -r * 0.12);
      drawMouth('small-o', 0.5);
      break;
    case 'surprised':
      drawEyePair('wide');
      drawBrows(-0.8, -r * 0.1);
      drawMouth('small-o', 0.9);
      break;
    case 'laughing':
      drawEyePair('closed-up');
      drawBrows(-0.35);
      drawMouth('wide-smile', mouthOpen);
      break;
    case 'crying':
      drawEyePair('teary');
      drawBrows(-0.9);
      drawMouth('open', 0.9);
      break;
    case 'thinking':
      // one brow up
      stroke('#1F2937', Math.max(2, r * 0.09));
      ctx.beginPath();
      ctx.moveTo(x - eyeOff - eyeR * 0.6, browY - r * 0.18);
      ctx.lineTo(x - eyeOff + eyeR * 0.7, browY - r * 0.02);
      ctx.moveTo(x + eyeOff - eyeR * 0.6, browY + r * 0.12);
      ctx.lineTo(x + eyeOff + eyeR * 0.7, browY + r * 0.12);
      ctx.stroke();
      // eyes looking up
      ctx.fillStyle = '#1F2937';
      ctx.beginPath();
      ctx.arc(x - eyeOff, eyeY - r * 0.1, eyeR * 0.8, 0, TAU);
      ctx.arc(x + eyeOff, eyeY, eyeR * 0.8, 0, TAU);
      ctx.fill();
      drawMouth('w');
      break;
    case 'sleepy':
      ctx.fillStyle = '#1F2937';
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(x + side * eyeOff, eyeY, eyeR * 0.85, 0, TAU);
        ctx.fill();
        // heavy lid
        ctx.fillStyle = cfg?.skin || '#F6C39A';
        ctx.beginPath();
        ctx.arc(x + side * eyeOff, eyeY - eyeR * 0.35, eyeR * 1.05, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#1F2937';
      }
      drawMouth('small-o', 0.3);
      break;
    default:
      drawEyePair(blink ? 'closed-up' : 'open');
      drawBrows(0);
      drawMouth('smile');
  }

  // glasses
  if (cfg?.glasses) {
    stroke('#374151', Math.max(1.5, r * 0.06));
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(x + side * eyeOff, eyeY, eyeR * 1.35, 0, TAU);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(x - eyeOff + eyeR * 1.3, eyeY);
    ctx.lineTo(x + eyeOff - eyeR * 1.3, eyeY);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------
// Humanoid character
// ---------------------------------------------------------------------------

function drawHumanoid(
  ctx: CanvasRenderingContext2D,
  obj: CanvasObject,
  pose: CharacterPose,
  lifeT: number,
  expression: CharacterExpression
) {
  const w = obj.width * obj.scaleX;
  const h = obj.height * obj.scaleY;
  const x = obj.x;
  const y = obj.y;
  const cfg = HUMAN_PALETTES[obj.characterType || 'boy'] || HUMAN_PALETTES.boy;

  const bob = pose.bodyY * h + Math.sin(lifeT / 620) * h * 0.006;
  const shake = pose.bounce * Math.sin(lifeT / 90) * h * 0.008;
  const cx = x + w / 2;
  const hipY = y + h * 0.56 + bob + shake;
  const hipOff = w * 0.15;
  const torsoLen = h * 0.21;
  const shoulderOff = w * (cfg.build === 'wide' ? 0.2 : 0.17);
  const headD = h * (cfg.build === 'wide' ? 0.37 : 0.35);
  const thighLen = h * 0.21;
  const shinLen = h * 0.2;
  const upperLen = h * 0.21;
  const foreLen = h * 0.19;

  // --- legs (global space) ---
  const drawLeg = (hx: number, side: 1 | -1, swing: number, kneeBend: number) => {
    const legAngle = side === 1 ? Math.PI / 2 + swing : Math.PI / 2 - swing;
    const shinAngle = side === 1 ? legAngle + kneeBend : legAngle - kneeBend;
    const knee = limb(ctx, hx, hipY, thighLen, legAngle, w * 0.11, cfg.pants);
    const foot = limb(ctx, knee.x, knee.y, shinLen, shinAngle, w * 0.1, cfg.pants);
    // shoe
    ctx.fillStyle = cfg.shoes;
    rr(ctx, foot.x - w * 0.07, foot.y - w * 0.015, w * 0.14, w * 0.06, w * 0.02);
    ctx.fill();
  };
  drawLeg(cx - hipOff, 1, pose.legL, Math.max(0, pose.kneeL) * 0.9);
  drawLeg(cx + hipOff, -1, pose.legR, Math.max(0, pose.kneeR) * 0.9);

  // --- upper body (rotated around hips so "lean" works) ---
  ctx.save();
  ctx.translate(cx, hipY);
  ctx.rotate(pose.lean);

  // torso
  if (cfg.dress) {
    ctx.fillStyle = cfg.shirt;
    ctx.beginPath();
    ctx.moveTo(-shoulderOff, -torsoLen);
    ctx.lineTo(shoulderOff, -torsoLen);
    ctx.lineTo(hipOff * 1.5, 0);
    ctx.lineTo(-hipOff * 1.5, 0);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillStyle = cfg.shirt;
    rr(ctx, -shoulderOff, -torsoLen, shoulderOff * 2, torsoLen, w * 0.05);
    ctx.fill();
  }

  // arms
  const armColor = cfg.shirt;
  const handColor = cfg.skin;
  const drawArm = (sx: number, side: 1 | -1, swing: number, elbowBend: number) => {
    const armAngle = side === 1 ? Math.PI / 2 + swing : Math.PI / 2 - swing;
    const foreAngle = side === 1 ? armAngle + elbowBend : armAngle - elbowBend;
    const elbow = limb(ctx, sx, -torsoLen, upperLen, armAngle, w * 0.085, armColor);
    const hand = limb(ctx, elbow.x, elbow.y, foreLen, foreAngle, w * 0.075, handColor);
    // hand circle
    ctx.fillStyle = handColor;
    ctx.beginPath();
    ctx.arc(hand.x, hand.y, w * 0.045, 0, TAU);
    ctx.fill();
  };
  drawArm(-shoulderOff, 1, pose.armL, pose.elbowL);
  drawArm(shoulderOff, -1, pose.armR, pose.elbowR);

  // head (with tilt around neck)
  const neckY = -torsoLen + h * 0.02;
  ctx.save();
  ctx.translate(0, neckY);
  ctx.rotate(pose.headTilt);

  const headCX = 0;
  const headCY = -headD * 0.5 - h * 0.01;
  const headR = headD / 2;

  // ears
  ctx.fillStyle = cfg.skin;
  ctx.beginPath();
  ctx.arc(headCX - headR * 0.95, headCY, headR * 0.16, 0, TAU);
  ctx.arc(headCX + headR * 0.95, headCY, headR * 0.16, 0, TAU);
  ctx.fill();

  // head
  ctx.fillStyle = cfg.skin;
  ctx.beginPath();
  ctx.arc(headCX, headCY, headR, 0, TAU);
  ctx.fill();

  // hair
  const hairStyle = cfg.hairStyle || 'short';
  ctx.fillStyle = cfg.hair;
  if (hairStyle === 'bald') {
    // gray side fringe
    ctx.beginPath();
    ctx.arc(headCX, headCY, headR, Math.PI * 0.92, Math.PI * 1.08);
    ctx.arc(headCX - headR * 0.85, headCY - headR * 0.15, headR * 0.14, 0, TAU);
    ctx.fill();
  } else if (hairStyle === 'bun') {
    // cap
    ctx.beginPath();
    ctx.arc(headCX, headCY - headR * 0.12, headR * 1.02, Math.PI, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(headCX, headCY - headR * 1.05, headR * 0.32, 0, TAU);
    ctx.fill();
  } else if (hairStyle === 'long') {
    ctx.beginPath();
    ctx.arc(headCX, headCY - headR * 0.12, headR * 1.02, Math.PI, 0);
    ctx.fill();
    rr(ctx, headCX - headR * 0.98, headCY - headR * 0.5, headR * 0.32, headR * 1.7, headR * 0.16);
    ctx.fill();
    rr(ctx, headCX + headR * 0.66, headCY - headR * 0.5, headR * 0.32, headR * 1.7, headR * 0.16);
    ctx.fill();
  } else if (hairStyle === 'spiky') {
    ctx.beginPath();
    ctx.arc(headCX, headCY - headR * 0.12, headR * 1.02, Math.PI, 0);
    ctx.fill();
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(headCX + i * headR * 0.5 - headR * 0.18, headCY - headR * 0.62);
      ctx.lineTo(headCX + i * headR * 0.62, headCY - headR * 1.35);
      ctx.lineTo(headCX + i * headR * 0.5 + headR * 0.18, headCY - headR * 0.62);
      ctx.closePath();
      ctx.fill();
    }
  } else {
    ctx.beginPath();
    ctx.arc(headCX, headCY - headR * 0.12, headR * 1.02, Math.PI, 0);
    ctx.fill();
  }

  // cap
  if (cfg.hat === 'cap') {
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.arc(headCX, headCY - headR * 0.25, headR * 1.05, Math.PI, 0);
    ctx.fill();
    rr(ctx, headCX - headR * 0.15, headCY - headR * 1.05, headR * 0.9, headR * 0.18, headR * 0.08);
    ctx.fill();
  }

  // face
  drawFace(ctx, headCX, headCY, headR, expression, pose.mouthOpen, pose.blink, cfg);

  // hair bow for girl
  if ((obj.characterType === 'girl' || obj.characterType === 'woman') && hairStyle === 'long') {
    ctx.fillStyle = '#F59E0B';
    ellipse(ctx, headCX + headR * 0.8, headCY - headR * 0.55, headR * 0.18, headR * 0.1, '#F59E0B');
    ellipse(ctx, headCX + headR * 1.15, headCY - headR * 0.55, headR * 0.18, headR * 0.1, '#F59E0B');
    ctx.fillStyle = '#D97706';
    ctx.beginPath();
    ctx.arc(headCX + headR * 0.97, headCY - headR * 0.55, headR * 0.07, 0, TAU);
    ctx.fill();
  }

  ctx.restore(); // head tilt
  ctx.restore(); // body
}

// ---------------------------------------------------------------------------
// Quadruped animals (dog, cat, cow, goat)
// ---------------------------------------------------------------------------

function drawQuadruped(
  ctx: CanvasRenderingContext2D,
  obj: CanvasObject,
  pose: CharacterPose,
  lifeT: number,
  expression: CharacterExpression,
  kind: CharacterType
) {
  const w = obj.width * obj.scaleX;
  const h = obj.height * obj.scaleY;
  const x = obj.x;
  const y = obj.y;
  const cfg = ANIMAL_PALETTES[kind] || ANIMAL_PALETTES.dog;

  const bob = pose.bodyY * h + Math.sin(lifeT / 620) * h * 0.004;
  const groundY = y + h * 0.9;
  const bodyH = h * 0.42;
  const bodyY = groundY - bodyH + bob;

  // body
  ellipse(ctx, x + w * 0.5, bodyY, w * 0.38, bodyH / 2, cfg.body);
  // belly patch
  ellipse(ctx, x + w * 0.5, bodyY + bodyH * 0.12, w * 0.22, bodyH * 0.26, cfg.belly);

  // patches for cow
  if (kind === 'cow') {
    ellipse(ctx, x + w * 0.3, bodyY - bodyH * 0.1, w * 0.13, bodyH * 0.22, cfg.accent);
    ellipse(ctx, x + w * 0.68, bodyY + bodyH * 0.05, w * 0.11, bodyH * 0.2, cfg.accent);
  }

  // tail
  const tailBaseX = x + w * 0.14;
  const tailBaseY = bodyY + bodyH * 0.05;
  const tailAngle = Math.PI * 0.9 + pose.tailSwing;
  const tailEnd = limb(ctx, tailBaseX, tailBaseY, h * 0.16, tailAngle, w * 0.035, cfg.tail);
  if (kind === 'cow' || kind === 'goat') {
    ellipse(ctx, tailEnd.x, tailEnd.y, w * 0.04, w * 0.04, cfg.accent);
  }

  // legs (4)
  const legY = bodyY + bodyH * 0.28;
  const legH = groundY - legY + bob * 0.4;
  const legs = [
    { hx: x + w * 0.26, side: 1 as const, swing: pose.legR, knee: pose.kneeR * 0.8 },
    { hx: x + w * 0.4, side: 1 as const, swing: pose.legL, knee: pose.kneeL * 0.8 },
    { hx: x + w * 0.6, side: -1 as const, swing: pose.legR, knee: pose.kneeR * 0.8 },
    { hx: x + w * 0.74, side: -1 as const, swing: pose.legL, knee: pose.kneeL * 0.8 },
  ];
  for (const l of legs) {
    const angle = l.side === 1 ? Math.PI / 2 + l.swing : Math.PI / 2 - l.swing;
    const shinAngle = l.side === 1 ? angle + l.knee : angle - l.knee;
    const knee = limb(ctx, l.hx, legY, legH * 0.6, angle, w * 0.05, cfg.legs);
    limb(ctx, knee.x, knee.y, legH * 0.42, shinAngle, w * 0.045, cfg.legs);
    // hoof/paw
    ctx.fillStyle = cfg.accent;
    ctx.beginPath();
    ctx.arc(l.hx + Math.cos(angle) * legH, groundY, w * 0.035, 0, TAU);
    ctx.fill();
  }

  // head
  const headCX = x + w * 0.82;
  const headCY = bodyY - bodyH * 0.3;
  const headR = h * 0.19;

  // ears
  if (kind === 'cat') {
    ctx.fillStyle = cfg.ear;
    ctx.beginPath();
    ctx.moveTo(headCX - headR * 0.9, headCY - headR * 0.1);
    ctx.lineTo(headCX - headR * 0.55, headCY - headR * 1.05);
    ctx.lineTo(headCX - headR * 0.05, headCY - headR * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(headCX + headR * 0.05, headCY - headR * 0.15);
    ctx.lineTo(headCX + headR * 0.55, headCY - headR * 1.05);
    ctx.lineTo(headCX + headR * 0.9, headCY - headR * 0.1);
    ctx.closePath();
    ctx.fill();
  } else if (kind === 'cow' || kind === 'goat') {
    // horns
    ctx.strokeStyle = kind === 'cow' ? '#D7C9A3' : '#9E9E9E';
    ctx.lineWidth = w * 0.03;
    ctx.beginPath();
    ctx.moveTo(headCX - headR * 0.55, headCY - headR * 0.5);
    ctx.quadraticCurveTo(headCX - headR * 0.75, headCY - headR * 1.2, headCX - headR * 0.45, headCY - headR * 1.35);
    ctx.moveTo(headCX + headR * 0.55, headCY - headR * 0.5);
    ctx.quadraticCurveTo(headCX + headR * 0.75, headCY - headR * 1.2, headCX + headR * 0.45, headCY - headR * 1.35);
    ctx.stroke();
    // ears
    ctx.fillStyle = cfg.ear;
    ellipse(ctx, headCX - headR * 0.85, headCY - headR * 0.05, headR * 0.28, headR * 0.16, cfg.ear);
    ellipse(ctx, headCX + headR * 0.85, headCY - headR * 0.05, headR * 0.28, headR * 0.16, cfg.ear);
  } else {
    // floppy ears (dog)
    ctx.fillStyle = cfg.ear;
    ellipse(ctx, headCX - headR * 0.8, headCY - headR * 0.05, headR * 0.3, headR * 0.75, cfg.ear);
    ellipse(ctx, headCX + headR * 0.8, headCY - headR * 0.05, headR * 0.3, headR * 0.75, cfg.ear);
  }

  // head
  ctx.fillStyle = cfg.body;
  ctx.beginPath();
  ctx.arc(headCX, headCY, headR, 0, TAU);
  ctx.fill();

  // muzzle/snout
  const snoutCol = kind === 'cow' ? '#E8A0A8' : kind === 'goat' ? '#C98E7D' : cfg.belly;
  ellipse(ctx, headCX + headR * 0.42, headCY + headR * 0.28, headR * 0.5, headR * 0.4, snoutCol);
  // nose
  ctx.fillStyle = cfg.nose;
  ellipse(ctx, headCX + headR * 0.62, headCY + headR * 0.12, headR * 0.16, headR * 0.12, cfg.nose);
  // eyes
  ctx.fillStyle = '#1F2937';
  ctx.beginPath();
  ctx.arc(headCX + headR * 0.15, headCY - headR * 0.2, headR * 0.09, 0, TAU);
  ctx.arc(headCX + headR * 0.55, headCY - headR * 0.2, headR * 0.09, 0, TAU);
  ctx.fill();
  // happy mouth
  if (expression === 'happy' || expression === 'laughing') {
    ctx.strokeStyle = '#7C2D12';
    ctx.lineWidth = Math.max(1.5, headR * 0.07);
    ctx.beginPath();
    ctx.arc(headCX + headR * 0.55, headCY + headR * 0.3, headR * 0.18, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }
  // whiskers (cat)
  if (kind === 'cat') {
    ctx.strokeStyle = '#B45309';
    ctx.lineWidth = Math.max(1, headR * 0.05);
    ctx.beginPath();
    ctx.moveTo(headCX - headR * 0.4, headCY + headR * 0.1);
    ctx.lineTo(headCX - headR * 1.1, headCY + headR * 0.05);
    ctx.moveTo(headCX - headR * 0.4, headCY + headR * 0.28);
    ctx.lineTo(headCX - headR * 1.1, headCY + headR * 0.35);
    ctx.stroke();
  }
  // goat beard
  if (kind === 'goat') {
    ctx.fillStyle = '#D8D2C5';
    ctx.beginPath();
    ctx.moveTo(headCX + headR * 0.3, headCY + headR * 0.55);
    ctx.lineTo(headCX + headR * 0.75, headCY + headR * 0.55);
    ctx.lineTo(headCX + headR * 0.5, headCY + headR * 1.15);
    ctx.closePath();
    ctx.fill();
  }
}

// ---------------------------------------------------------------------------
// Bird
// ---------------------------------------------------------------------------

function drawBird(
  ctx: CanvasRenderingContext2D,
  obj: CanvasObject,
  pose: CharacterPose,
  lifeT: number
) {
  const w = obj.width * obj.scaleX;
  const h = obj.height * obj.scaleY;
  const x = obj.x;
  const y = obj.y;
  const cfg = ANIMAL_PALETTES.bird;

  const bob = pose.bodyY * h + Math.sin(lifeT / 600) * h * 0.005;
  const cx = x + w * 0.5;
  const bodyY = y + h * 0.48 + bob;
  const bodyR = Math.min(w * 0.28, h * 0.24);

  // tail
  ctx.fillStyle = cfg.tail;
  ctx.beginPath();
  ctx.moveTo(cx - bodyR * 0.9, bodyY + bodyR * 0.2);
  ctx.lineTo(cx - bodyR * 1.7, bodyY + bodyR * 0.1 - Math.sin(lifeT / 300) * 2);
  ctx.lineTo(cx - bodyR * 0.9, bodyY + bodyR * 0.5);
  ctx.closePath();
  ctx.fill();

  // wing
  ctx.save();
  ctx.translate(cx, bodyY - bodyR * 0.15);
  ctx.rotate(pose.wingFlap * 0.9 + Math.sin(lifeT / 380) * 0.06);
  ellipse(ctx, -bodyR * 0.4, -bodyR * 0.1, bodyR * 0.85, bodyR * 0.5, cfg.accent);
  ctx.restore();

  // body
  ellipse(ctx, cx, bodyY, bodyR, bodyR * 0.95, cfg.body);
  ellipse(ctx, cx + bodyR * 0.35, bodyY + bodyR * 0.3, bodyR * 0.6, bodyR * 0.45, cfg.belly);

  // head
  const headCX = cx + bodyR * 0.85;
  const headCY = bodyY - bodyR * 0.5;
  const headR = bodyR * 0.75;
  ctx.fillStyle = cfg.body;
  ctx.beginPath();
  ctx.arc(headCX, headCY, headR, 0, TAU);
  ctx.fill();

  // beak
  ctx.fillStyle = cfg.nose;
  ctx.beginPath();
  ctx.moveTo(headCX + headR * 0.75, headCY);
  ctx.lineTo(headCX + headR * 1.5, headCY + headR * 0.12);
  ctx.lineTo(headCX + headR * 0.75, headCY + headR * 0.35);
  ctx.closePath();
  ctx.fill();

  // eye
  ctx.fillStyle = '#1F2937';
  ctx.beginPath();
  ctx.arc(headCX + headR * 0.3, headCY - headR * 0.15, headR * 0.14, 0, TAU);
  ctx.fill();

  // legs
  const legY = bodyY + bodyR * 0.8;
  const legH = y + h - legY;
  ctx.strokeStyle = cfg.nose;
  ctx.lineWidth = w * 0.02;
  ctx.beginPath();
  ctx.moveTo(cx - bodyR * 0.35, legY);
  ctx.lineTo(cx - bodyR * 0.35, legY + legH * 0.8);
  ctx.moveTo(cx + bodyR * 0.3, legY);
  ctx.lineTo(cx + bodyR * 0.3, legY + legH * 0.8);
  ctx.stroke();
  // feet
  ctx.fillStyle = cfg.nose;
  for (const fx of [cx - bodyR * 0.35, cx + bodyR * 0.3]) {
    ctx.beginPath();
    ctx.moveTo(fx - w * 0.05, y + h);
    ctx.lineTo(fx, y + h - w * 0.03);
    ctx.lineTo(fx + w * 0.05, y + h);
    ctx.closePath();
    ctx.fill();
  }
}

// ---------------------------------------------------------------------------
// Draw dispatch
// ---------------------------------------------------------------------------

export interface DrawObjectOptions {
  interactive?: boolean;
  /** selection overlay colour */
  accent?: string;
  /** When true (during playback/export) motion presets are animated. */
  playback?: boolean;
  /** Scene duration in ms (needed for fade-out). */
  sceneDuration?: number;
  /** Live lip-sync level 0..1 — drives mouth of 'talk' characters. */
  lipSyncLevel?: number;
}

function drawObject(
  ctx: CanvasRenderingContext2D,
  obj: CanvasObject,
  t: number,
  lifeT: number,
  opts: DrawObjectOptions = {}
) {
  const w = obj.width * obj.scaleX;
  const h = obj.height * obj.scaleY;

  if (w <= 0 || h <= 0 || obj.opacity <= 0) return;

  // Motion preset modifiers (entrance/exit effects)
  const motion = getMotionModifiers(obj, t, opts.sceneDuration ?? 5000, opts.playback ?? false);
  const alpha = clamp(obj.opacity * motion.alpha, 0, 1);
  if (alpha <= 0) return;

  const centerX = obj.x + w / 2 + motion.dx;
  const centerY = obj.y + h / 2 + motion.dy;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(((obj.rotation + motion.rotation) * Math.PI) / 180);
  ctx.globalAlpha = alpha;
  if (motion.scale !== 1) ctx.scale(motion.scale, motion.scale);
  ctx.translate(-centerX, -centerY);

  const action = obj.action || 'idle';
  const pose = getActionPose(action, t);

  // Live lip-sync: 'talk' characters open their mouth with the audio level
  if (action === 'talk' && opts.lipSyncLevel !== undefined) {
    pose.mouthOpen = clamp(0.15 + opts.lipSyncLevel * 0.85, 0, 1);
  }

  // Custom uploaded image wins over procedural drawing
  const img = getCachedImage(obj.imageUrl);
  if (img) {
    if (obj.type === 'background') {
      drawImageCover(ctx, img, obj.x, obj.y, w, h);
    } else {
      // characters / props keep aspect, fit inside box
      const ir = img.width / img.height;
      const r = w / h;
      let dw = w, dh = h;
      if (ir > r) {
        dh = h;
        dw = h * ir;
      } else {
        dw = w;
        dh = w / ir;
      }
      const dx = obj.x + (w - dw) / 2;
      const dy = obj.y + (h - dh) / 2;
      ctx.drawImage(img, dx, dy, dw, dh);
    }
  } else if (obj.type === 'character') {
    const kind = (obj.characterType || 'boy') as CharacterType;
    if (kind === 'bird') {
      drawBird(ctx, obj, pose, lifeT);
    } else if (kind === 'dog' || kind === 'cat' || kind === 'cow' || kind === 'goat') {
      drawQuadruped(ctx, obj, pose, lifeT, obj.expression || 'neutral', kind);
    } else {
      drawHumanoid(ctx, obj, pose, lifeT, obj.expression || 'neutral');
    }
  } else if (obj.type === 'background') {
    drawBackgroundShape(ctx, obj);
  } else if (obj.type === 'prop') {
    drawPropShape(ctx, obj);
  } else if (obj.type === 'text') {
    drawTextObject(ctx, obj);
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Backgrounds & props & text (procedural fallbacks when no image)
// ---------------------------------------------------------------------------

const BG_ICONS: Record<string, string> = {
  Village: '🏘️', City: '🌆', School: '🏫', Market: '🏪', House: '🏠',
  Bedroom: '🛏️', Park: '🏞️', River: '🌊', Farm: '🌾', Road: '🛣️',
};

const PROP_ICONS: Record<string, string> = {
  Chair: '🪑', Table: '🪵', Phone: '📱', Book: '📚', Bag: '👜',
  Car: '🚗', Tree: '🌳', Food: '🍔', Gift: '🎁', Ball: '⚽',
};

function drawBackgroundShape(ctx: CanvasRenderingContext2D, obj: CanvasObject) {
  const w = obj.width * obj.scaleX;
  const h = obj.height * obj.scaleY;
  const x = obj.x;
  const y = obj.y;

  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, '#A7E0FF');
  grad.addColorStop(1, '#6FB7E8');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);

  // soft sun
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.arc(x + w * 0.8, y + h * 0.18, Math.min(w, h) * 0.12, 0, TAU);
  ctx.fill();

  // ground hill
  ctx.fillStyle = 'rgba(74,182,110,0.8)';
  ctx.beginPath();
  ctx.ellipse(x + w * 0.5, y + h * 0.95, w * 0.7, h * 0.22, 0, 0, TAU);
  ctx.fill();

  const icon = BG_ICONS[obj.name || ''] || '🏞️';
  ctx.font = `${Math.min(w, h) * 0.28}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillText(icon, x + w / 2, y + h * 0.42);
}

function drawPropShape(ctx: CanvasRenderingContext2D, obj: CanvasObject) {
  const w = obj.width * obj.scaleX;
  const h = obj.height * obj.scaleY;
  const x = obj.x;
  const y = obj.y;

  ctx.fillStyle = obj.color || '#4F8EF7';
  rr(ctx, x, y, w, h, Math.min(w, h) * 0.16);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  rr(ctx, x + w * 0.08, y + h * 0.06, w * 0.5, h * 0.3, w * 0.08);
  ctx.fill();

  const icon = PROP_ICONS[obj.name || ''] || '📦';
  ctx.font = `${Math.min(w, h) * 0.45}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(icon, x + w / 2, y + h / 2);
}

const TEXT_FONT_STACK =
  '"Noto Sans Bengali", "Hind Siliguri", "Kalpurush", "SolaimanLipi", "Vrinda", sans-serif';

function drawTextObject(ctx: CanvasRenderingContext2D, obj: CanvasObject) {
  if (!obj.content) return;
  const w = obj.width * obj.scaleX;
  const h = obj.height * obj.scaleY;
  const fontSize = Math.max(12, (obj.fontSize || h) * (obj.scaleY || 1));
  const color = obj.fontColor || '#111827';

  ctx.font = `${obj.fontWeight === 'bold' ? '700 ' : ''}${fontSize}px ${TEXT_FONT_STACK}`;
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // shadow
  if (obj.shadowColor && (obj.shadowBlur || 0) > 0) {
    ctx.shadowColor = obj.shadowColor;
    ctx.shadowBlur = obj.shadowBlur || 8;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
  }

  const words = obj.content.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > w && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);

  const lineHeight = fontSize * 1.25;

  // outline
  if (obj.strokeColor && (obj.strokeWidth || 0) > 0) {
    ctx.strokeStyle = obj.strokeColor;
    ctx.lineWidth = obj.strokeWidth || 2;
    ctx.lineJoin = 'round';
    for (let i = 0; i < lines.length; i++) {
      ctx.strokeText(lines[i], obj.x, obj.y + i * lineHeight);
    }
  }

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], obj.x, obj.y + i * lineHeight);
  }

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

// ---------------------------------------------------------------------------
// Scene transitions
// ---------------------------------------------------------------------------

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const num = parseInt(h, 16);
  if (Number.isNaN(num)) return { r: 255, g: 255, b: 255 };
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

export function mixColors(hexA: string, hexB: string, p: number): string {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const t = Math.min(1, Math.max(0, p));
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bl = Math.round(a.b + (b.b - a.b) * t);
  return `rgb(${r},${g},${bl})`;
}

/** Progress 0..1 of the transition window near the end of a scene (0 = no transition). */
export function transitionProgress(
  timeInScene: number,
  sceneDuration: number,
  transitionDuration: number
): number {
  if (transitionDuration <= 0) return 0;
  const start = sceneDuration - transitionDuration;
  if (timeInScene < start) return 0;
  return Math.min(1, (timeInScene - start) / transitionDuration);
}

// ---------------------------------------------------------------------------
// Scene drawing (used by Canvas & ExportModal)
// ---------------------------------------------------------------------------

export interface SceneDrawOptions extends DrawObjectOptions {
  watermark?: { text: string; enabled: boolean };
}

export function drawSceneContent(
  ctx: CanvasRenderingContext2D,
  objects: CanvasObject[],
  scene: Scene | undefined,
  t: number,
  lifeT: number,
  width: number,
  height: number,
  opts: SceneDrawOptions = {}
) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = scene?.backgroundColor || '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  const sorted = [...objects].sort((a, b) => a.zIndex - b.zIndex);
  for (const obj of sorted) {
    drawObject(ctx, obj, t, lifeT, opts);
  }

  if (opts.watermark) {
    drawWatermark(ctx, width, height, opts.watermark.text, opts.watermark.enabled);
  }
}

// ---------------------------------------------------------------------------
// Selection overlay geometry (shared with Canvas hit-testing)
// ---------------------------------------------------------------------------

export interface SelectionHandles {
  corners: { id: 'tl' | 'tr' | 'bl' | 'br'; x: number; y: number }[];
  edges: { id: 'n' | 's' | 'e' | 'w'; x: number; y: number }[];
  rotate: { x: number; y: number };
}

export function getSelectionHandles(obj: CanvasObject): SelectionHandles {
  const w = obj.width * obj.scaleX;
  const h = obj.height * obj.scaleY;
  const x = obj.x;
  const y = obj.y;
  const cx = x + w / 2;
  const cy = y + h / 2;

  return {
    corners: [
      { id: 'tl', x, y },
      { id: 'tr', x: x + w, y },
      { id: 'bl', x, y: y + h },
      { id: 'br', x: x + w, y: y + h },
    ],
    edges: [
      { id: 'n', x: cx, y },
      { id: 's', x: cx, y: y + h },
      { id: 'e', x: x + w, y: cy },
      { id: 'w', x, y: cy },
    ],
    rotate: { x: cx, y: y - 28 },
  };
}

export function drawSelectionOverlay(
  ctx: CanvasRenderingContext2D,
  obj: CanvasObject,
  accent = '#3B82F6'
) {
  const w = obj.width * obj.scaleX;
  const h = obj.height * obj.scaleY;
  const x = obj.x;
  const y = obj.y;
  const cx = x + w / 2;
  const cy = y + h / 2;

  // dashed border
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);

  // rotate handle
  const rotY = y - 28;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, y);
  ctx.lineTo(cx, rotY);
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(cx, rotY, 7, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(cx, rotY, 3, 0, TAU);
  ctx.fill();

  // corner handles
  for (const c of getSelectionHandles(obj).corners) {
    ctx.fillStyle = accent;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.rect(c.x - 5, c.y - 5, 10, 10);
    ctx.fill();
    ctx.stroke();
  }

  // edge handles
  for (const e of getSelectionHandles(obj).edges) {
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.rect(e.x - 4, e.y - 4, 8, 8);
    ctx.fill();
    ctx.stroke();
  }

  // size label
  ctx.fillStyle = 'rgba(15,23,42,0.85)';
  rr(ctx, cx - 40, y - 52, 80, 18, 6);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '11px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.round(w)}×${Math.round(h)}`, cx, y - 43);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Export entrypoint
// ---------------------------------------------------------------------------

export function renderFrameToCanvas(
  canvas: HTMLCanvasElement,
  objects: CanvasObject[],
  scene: Scene | undefined,
  t: number,
  width: number,
  height: number
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  drawSceneContent(ctx, objects, scene, t, t, width, height);
}
