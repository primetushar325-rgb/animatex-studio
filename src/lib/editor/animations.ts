'use client';

// ============================================================================
// AnimateX — Action + Angle Animation Engine (data-driven registry)
// ----------------------------------------------------------------------------
// The motion math itself lives in renderer.ts (`getActionPose`). This module
// is the scalable REGISTRY on top of it:
//
//   ActionClip = structured animation clip metadata (duration, fps, loop,
//   speed, category, keywords, supported angles, fallback).
//
//   resolveClip()  — safe lookup with fallback chain:
//                    exact angle+action → nearest angle+action → generic →
//                    idle. Never crashes.
//
//   searchActions() — fast keyword/label search for the picker.
//
//   blendPoses() + PoseAnimator — smooth transitions between actions so the
//   character never teleports between poses.
//
// Adding hundreds of future actions = add one entry to ACTION_REGISTRY.
// No engine changes required.
// ============================================================================

import type { CharacterAction, CharacterExpression } from '@/types/animation';
import type { CharacterPose } from './renderer';
import { getActionPose } from './renderer';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AnimationView = 'front' | '3-4-front' | 'side' | '3-4-back' | 'back';

export type ActionCategory =
  | 'basic'
  | 'movement'
  | 'communication'
  | 'sitting'
  | 'lying'
  | 'work'
  | 'emotion'
  | 'hand'
  | 'special';

export interface ActionClip {
  /** Primary key — CharacterAction value (or synthetic id). */
  id: string;
  /** Display label, e.g. "Sitting On Knees". */
  label: string;
  /** Underlying motion used by the renderer. */
  action: CharacterAction;
  /** Optional expression applied with the motion (emotion actions). */
  expression?: CharacterExpression;
  category: ActionCategory;
  /** Extra search keywords (Bangla + English aliases). */
  keywords?: string[];
  /** Angles this clip has dedicated/valid motion for. Falls back otherwise. */
  angles?: AnimationView[];
  /** Clip duration in ms (one loop cycle reference). */
  duration: number;
  /** Playback frames per second. */
  fps: number;
  /** Loop forever? */
  loop: boolean;
  /** Default playback speed multiplier. */
  speed: number;
  /** Hidden from the picker? (registry still resolves it) */
  enabled: boolean;
  /** Closest clip to use if this one can't resolve. */
  fallback?: string;
}

// ---------------------------------------------------------------------------
// Registry — the whole action library, fully data-driven
// ---------------------------------------------------------------------------

export const ACTION_REGISTRY: ActionClip[] = [
  // -------------------- BASIC --------------------
  { id: 'idle', label: 'Idle', action: 'idle', category: 'basic', keywords: ['stand', 'still'], duration: 3000, fps: 30, loop: true, speed: 1, enabled: true },
  { id: 'idle-happy', label: 'Idle Happy', action: 'idle', expression: 'happy', category: 'basic', keywords: ['smile'], duration: 3000, fps: 30, loop: true, speed: 1, enabled: true },
  { id: 'idle-sad', label: 'Idle Sad', action: 'idle', expression: 'sad', category: 'basic', keywords: ['sad', 'upset'], duration: 3000, fps: 30, loop: true, speed: 1, enabled: true },
  { id: 'walk', label: 'Walk', action: 'walk', category: 'basic', keywords: ['hata', 'হাঁটা', 'walking'], duration: 720, fps: 30, loop: true, speed: 1, enabled: true },
  { id: 'jog', label: 'Jogging', action: 'jog', category: 'basic', keywords: ['jog'], duration: 460, fps: 30, loop: true, speed: 1, enabled: true },
  { id: 'run', label: 'Run', action: 'run', category: 'basic', keywords: ['running', 'দৌড়'], duration: 380, fps: 30, loop: true, speed: 1, enabled: true },

  // -------------------- MOVEMENT --------------------
  { id: 'jump', label: 'Jump', action: 'jump', category: 'movement', keywords: ['hop', 'লাফ'], duration: 1100, fps: 30, loop: true, speed: 1, enabled: true },
  { id: 'turn', label: 'Turn', action: 'turn', category: 'movement', keywords: ['rotate', 'ঘোরা'], duration: 1200, fps: 30, loop: true, speed: 1, enabled: true },
  { id: 'bend', label: 'Bend', action: 'bend', category: 'movement', keywords: ['lean'], duration: 1500, fps: 30, loop: true, speed: 1, enabled: true },
  { id: 'kneel', label: 'Kneel', action: 'kneel', category: 'movement', keywords: ['squat'], duration: 1600, fps: 30, loop: true, speed: 1, enabled: true },
  { id: 'stand-up', label: 'Stand Up', action: 'stand-up', category: 'movement', keywords: ['get up'], duration: 900, fps: 30, loop: false, speed: 1, enabled: true },
  { id: 'sit-down', label: 'Sit Down', action: 'sit-down', category: 'movement', keywords: ['lower'], duration: 900, fps: 30, loop: false, speed: 1, enabled: true },

  // -------------------- COMMUNICATION --------------------
  { id: 'talk', label: 'Talking', action: 'talk', category: 'communication', keywords: ['speak', 'কথা'], duration: 430, fps: 30, loop: true, speed: 1, enabled: true },
  { id: 'wave', label: 'Hand Wave', action: 'wave', category: 'communication', keywords: ['hello', 'হাত নাড়া'], duration: 500, fps: 30, loop: true, speed: 1, enabled: true },
  { id: 'point', label: 'Pointing', action: 'point', category: 'communication', keywords: ['point right'], duration: 1400, fps: 30, loop: true, speed: 1, enabled: true },
  { id: 'give', label: 'Giving Things', action: 'give', category: 'communication', keywords: ['offer', 'দেওয়া'], duration: 1600, fps: 30, loop: true, speed: 1, enabled: true },
  { id: 'call', label: 'Calling', action: 'call', category: 'communication', keywords: ['come here', 'ডাকা'], duration: 700, fps: 30, loop: true, speed: 1, enabled: true },
  { id: 'greet', label: 'Greeting', action: 'greet', category: 'communication', keywords: ['hello', 'নমস্কার'], duration: 1200, fps: 30, loop: true, speed: 1, enabled: true },
  { id: 'namaskar', label: 'Namaskar', action: 'namaskar', category: 'communication', keywords: ['prayer', 'প্রণাম'], duration: 2600, fps: 30, loop: true, speed: 1, enabled: true },
  { id: 'gesture', label: 'Hand Gesture', action: 'gesture', category: 'communication', keywords: ['explain hands'], duration: 1000, fps: 30, loop: true, speed: 1, enabled: true },

  // -------------------- SITTING --------------------
  { id: 'sit', label: 'Sitting', action: 'sit', category: 'sitting', keywords: ['chair'], duration: 2600, fps: 30, loop: true, speed: 1, enabled: true },
  { id: 'sit-idle', label: 'Sitting Idle', action: 'sit', category: 'sitting', keywords: ['sit still'], duration: 3000, fps: 30, loop: true, speed: 1, enabled: true },
  { id: 'sit-crossed', label: 'Sitting Crossed Leg', action: 'sit-crossed', category: 'sitting', keywords: ['cross legged'], duration: 2400, fps: 30, loop: true, speed: 1, enabled: true },
  { id: 'sit-floor', label: 'Sitting On Floor', action: 'sit', category: 'sitting', keywords: ['ground'], duration: 2600, fps: 30, loop: true, speed: 1, enabled: true },
  { id: 'sit-kneel', label: 'Sitting On Knees', action: 'sit-kneel', category: 'sitting', keywords: ['kneeling'], duration: 2200, fps: 30, loop: true, speed: 1, enabled: true },
  { id: 'sit-relaxed', label: 'Sitting Relaxed', action: 'sit-relaxed', category: 'sitting', keywords: ['chill'], duration: 2800, fps: 30, loop: true, speed: 1, enabled: true },

  // -------------------- LYING --------------------
  { id: 'sleep-back', label: 'Sleeping On Back', action: 'sleep-back', category: 'lying', keywords: ['sleep', 'ঘুম'], duration: 2800, fps: 30, loop: true, speed: 1, enabled: true },
  { id: 'sleep-stomach', label: 'Sleeping On Stomach', action: 'sleep-stomach', category: 'lying', keywords: ['tummy'], duration: 2600, fps: 30, loop: true, speed: 1, enabled: true },
  { id: 'sleep-side', label: 'Sleeping Sideways', action: 'sleep-side', category: 'lying', keywords: ['side sleep'], duration: 3000, fps: 30, loop: true, speed: 1, enabled: true },
  { id: 'lie-idle', label: 'Lying Idle', action: 'lie-idle', category: 'lying', keywords: ['lie down'], duration: 2800, fps: 30, loop: true, speed: 1, enabled: true },

  // -------------------- WORK --------------------
  { id: 'cook', label: 'Cooking', action: 'cook', category: 'work', keywords: ['stir', 'রান্না'], duration: 850, fps: 30, loop: true, speed: 1, enabled: true },
  { id: 'clean', label: 'Cleaning', action: 'clean', category: 'work', keywords: ['wipe'], duration: 900, fps: 30, loop: true, speed: 1, enabled: true },
  { id: 'sweep', label: 'Dust Collect Karna', action: 'sweep', category: 'work', keywords: ['dust', 'broom'], duration: 900, fps: 30, loop: true, speed: 1, enabled: true },
  { id: 'wash', label: 'Washing Dishes', action: 'wash', category: 'work', keywords: ['bartan dhona', 'বাসন'], duration: 700, fps: 30, loop: true, speed: 1, enabled: true },
  { id: 'farm', label: 'Farming', action: 'farm', category: 'work', keywords: ['field'], duration: 1200, fps: 30, loop: true, speed: 1, enabled: true },
  { id: 'dig', label: 'Digging', action: 'dig', category: 'work', keywords: ['shovel', 'খনন'], duration: 1100, fps: 30, loop: true, speed: 1, enabled: true },
  { id: 'carry', label: 'Carrying Object', action: 'carry', category: 'work', keywords: ['hold'], duration: 1600, fps: 30, loop: true, speed: 1, enabled: true },
  { id: 'pick', label: 'Picking Object', action: 'pick', category: 'work', keywords: ['grab', 'তোলা'], duration: 1400, fps: 30, loop: true, speed: 1, enabled: true },
  { id: 'drop', label: 'Dropping Object', action: 'drop', category: 'work', keywords: ['place'], duration: 1200, fps: 30, loop: true, speed: 1, enabled: true },

  // -------------------- EMOTION (expression + body) --------------------
  { id: 'happy', label: 'Happy', action: 'idle', expression: 'happy', category: 'emotion', keywords: ['খুশি'], duration: 2600, fps: 30, loop: true, speed: 1, enabled: true },
  { id: 'sad', label: 'Sad', action: 'idle', expression: 'sad', category: 'emotion', keywords: ['দুঃখ'], duration: 2600, fps: 30, loop: true, speed: 1, enabled: true },
  { id: 'angry', label: 'Angry', action: 'idle', expression: 'angry', category: 'emotion', keywords: ['রাগ'], duration: 2400, fps: 30, loop: true, speed: 1, enabled: true },
  { id: 'surprised', label: 'Surprised', action: 'idle', expression: 'surprised', category: 'emotion', keywords: ['আশ্চর্য'], duration: 2200, fps: 30, loop: true, speed: 1, enabled: true },
  { id: 'scared', label: 'Scared', action: 'idle', expression: 'scared', category: 'emotion', keywords: ['ভয়'], duration: 2000, fps: 30, loop: true, speed: 1, enabled: true },
  { id: 'thinking', label: 'Thinking', action: 'idle', expression: 'thinking', category: 'emotion', keywords: ['ভাবা'], duration: 2600, fps: 30, loop: true, speed: 1, enabled: true },
  { id: 'crying', label: 'Crying', action: 'cry', category: 'emotion', keywords: ['কান্না'], duration: 700, fps: 30, loop: true, speed: 1, enabled: true },
  { id: 'laughing', label: 'Laughing', action: 'laugh', category: 'emotion', keywords: ['হাসি'], duration: 450, fps: 30, loop: true, speed: 1, enabled: true },

  // -------------------- HAND --------------------
  { id: 'point-left', label: 'Point Left', action: 'point-left', category: 'hand', keywords: ['left'], duration: 1400, fps: 30, loop: true, speed: 1, enabled: true },
  { id: 'point-right', label: 'Point Right', action: 'point-right', category: 'hand', keywords: ['right'], duration: 1400, fps: 30, loop: true, speed: 1, enabled: true },
  { id: 'point-forward', label: 'Point Forward', action: 'point-forward', category: 'hand', keywords: ['forward'], duration: 1400, fps: 30, loop: true, speed: 1, enabled: true },
  { id: 'raise-hand', label: 'Raise Hand', action: 'raise-hand', category: 'hand', keywords: ['up'], duration: 1200, fps: 30, loop: true, speed: 1, enabled: true },
  { id: 'receive', label: 'Receive Object', action: 'receive', category: 'hand', keywords: ['take'], duration: 1400, fps: 30, loop: true, speed: 1, enabled: true },
  { id: 'explain', label: 'Explain', action: 'explain', category: 'hand', keywords: ['talk hands'], duration: 1000, fps: 30, loop: true, speed: 1, enabled: true },
  { id: 'clap', label: 'Clap', action: 'clap', category: 'hand', keywords: ['তালি'], duration: 620, fps: 30, loop: true, speed: 1, enabled: true },

  // -------------------- SPECIAL --------------------
  { id: 'dance', label: 'Dance', action: 'dance', category: 'special', keywords: ['নাচ'], duration: 600, fps: 30, loop: true, speed: 1, enabled: true },
  { id: 'fly', label: 'Flying Idle', action: 'fly', category: 'special', keywords: ['superman'], duration: 1500, fps: 30, loop: true, speed: 1, enabled: true },
  { id: 'fall', label: 'Fall', action: 'fall', category: 'special', keywords: ['trip'], duration: 1400, fps: 30, loop: false, speed: 1, enabled: true },
];

// ---------------------------------------------------------------------------
// Category metadata (label + order) — extend freely
// ---------------------------------------------------------------------------

export const ACTION_CATEGORIES: { id: ActionCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'basic', label: 'Basic' },
  { id: 'movement', label: 'Movement' },
  { id: 'communication', label: 'Communication' },
  { id: 'sitting', label: 'Sitting' },
  { id: 'lying', label: 'Lying' },
  { id: 'work', label: 'Work' },
  { id: 'emotion', label: 'Emotion' },
  { id: 'hand', label: 'Hand Gestures' },
  { id: 'special', label: 'Special' },
];

export const VIEW_LABELS: Record<AnimationView, string> = {
  front: 'FRONT',
  '3-4-front': '3/4 FRONT',
  side: 'SIDE',
  '3-4-back': '3/4 BACK',
  back: 'BACK',
};

// ---------------------------------------------------------------------------
// Overrides (admin-managed, merged over the static registry)
// ---------------------------------------------------------------------------

let overrides: Record<string, Partial<ActionClip>> = {};

/** Apply admin/Firestore overrides (speed/loop/duration/fps/enabled + new actions). */
export function setActionOverrides(o: Record<string, Partial<ActionClip>>) {
  overrides = o || {};
}

/** Full effective list — static registry merged with overrides. */
export function effectiveRegistry(): ActionClip[] {
  const ids = new Set([...ACTION_REGISTRY.map((c) => c.id), ...Object.keys(overrides)]);
  const out: ActionClip[] = [];
  for (const id of ids) {
    const base = ACTION_REGISTRY.find((c) => c.id === id);
    const ov = overrides[id];
    if (ov && ov.enabled === false) continue; // admin-disabled
    out.push({ ...base, ...ov, id } as ActionClip);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Lookup + search
// ---------------------------------------------------------------------------

export function getClip(id: string): ActionClip | undefined {
  const base = ACTION_REGISTRY.find((c) => c.id === id);
  const ov = overrides[id];
  if (ov && ov.enabled === false) return undefined;
  return base ? { ...base, ...ov } : undefined;
}

export function getClipsByCategory(category: ActionCategory | 'all'): ActionClip[] {
  return effectiveRegistry().filter((c) =>
    category === 'all' ? true : c.category === category
  );
}

/** Fast keyword/label search. Case-insensitive; matches label + keywords. */
export function searchActions(query: string, category: ActionCategory | 'all' = 'all'): ActionClip[] {
  const q = query.trim().toLowerCase();
  const base = getClipsByCategory(category);
  if (!q) return base;
  return base.filter((c) => {
    if (c.label.toLowerCase().includes(q)) return true;
    return (c.keywords || []).some((k) => k.toLowerCase().includes(q));
  });
}

/** How close a clip is to an angle: exact = 0, adjacent = 1, generic = 2. */
function angleDistance(view: AnimationView, clipView: AnimationView): number {
  if (view === clipView) return 0;
  const order: AnimationView[] = ['front', '3-4-front', 'side', '3-4-back', 'back'];
  return Math.abs(order.indexOf(view) - order.indexOf(clipView));
}

/**
 * Safe resolution with fallback chain:
 *   exact angle+action → nearest compatible angle → generic action → idle.
 * Returns null only when even idle is missing (never happens).
 */
export function resolveClip(
  action: string,
  view: AnimationView,
  characterType?: string
): ActionClip | null {
  const start = getClip(action) || null;
  let clip = start;
  const visited = new Set<string>();
  const charKey = characterType || '';

  while (clip) {
    if (visited.has(clip.id)) break;
    visited.add(clip.id);

    // angle support check (default = all angles)
    const angles = clip.angles;
    if (angles) {
      if (angles.includes(view)) return clip;
      // nearest compatible angle
      let best: ActionClip | null = null;
      let bestDist = Infinity;
      for (const av of angles) {
        const d = angleDistance(view, av);
        if (d < bestDist) {
          bestDist = d;
          best = clip;
        }
      }
      if (best) return best;
    } else {
      return clip;
    }

    // follow fallback chain
    const fb = clip.fallback;
    if (!fb) {
      // nearest available clip → idle
      return getClip('idle') || null;
    }
    clip = getClip(fb) || getClip('idle') || null;
    if (!clip) break;
  }
  void charKey;
  return getClip('idle') || null;
}

// ---------------------------------------------------------------------------
// Pose blending (smooth action transitions — no teleporting)
// ---------------------------------------------------------------------------

const POSE_PROPS: (keyof CharacterPose)[] = [
  'bodyY', 'lean', 'headTilt', 'armL', 'armR', 'elbowL', 'elbowR',
  'legL', 'legR', 'kneeL', 'kneeR', 'tailSwing', 'wingFlap',
  'mouthOpen', 'bounce',
];

function easeInOut(p: number): number {
  return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
}

/** Blend two poses 0..1 (1 = fully `to`). */
export function blendPoses(from: CharacterPose, to: CharacterPose, t: number): CharacterPose {
  const u = Math.min(1, Math.max(0, t));
  const e = easeInOut(u);
  const out = { ...to };
  for (const prop of POSE_PROPS) {
    (out[prop] as number) = (from[prop] as number) + ((to[prop] as number) - (from[prop] as number)) * e;
  }
  out.blink = from.blink || to.blink;
  return out;
}

/**
 * PoseAnimator — drives a character's pose with smooth transitions between
 * actions. One instance per rendered character (main canvas + previews).
 * Uses wall-clock so transitions work at any speed.
 */
export class PoseAnimator {
  private currentAction = '';
  private currentView: AnimationView = 'front';
  private fromPose: CharacterPose | null = null;
  private lastPose: CharacterPose | null = null;
  private transitionStart = 0;
  private transitionDur = 220; // ms — configurable per clip later

  setView(view: AnimationView) {
    this.currentView = view;
  }

  /**
   * Compute the pose for `action` at clip-time `t` (ms), blending from the
   * previous action when the action changed.
   */
  step(action: CharacterAction, t: number, now: number, speed = 1): CharacterPose {
    if (action !== this.currentAction) {
      this.fromPose = this.lastPose || getActionPose(action, t);
      this.currentAction = action;
      this.transitionStart = now;
    }

    let pose = getActionPose(action, t * speed);

    if (this.fromPose && now - this.transitionStart < this.transitionDur) {
      const p = (now - this.transitionStart) / this.transitionDur;
      pose = blendPoses(this.fromPose, pose, p);
      if (p >= 1) this.fromPose = null;
    }

    this.lastPose = pose;
    return pose;
  }

  /** Instant pose without transition (used for previews that should settle). */
  pose(action: CharacterAction, t: number, speed = 1): CharacterPose {
    return getActionPose(action, t * speed);
  }
}
