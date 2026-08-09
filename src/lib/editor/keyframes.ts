// ============================================================================
// Keyframe interpolation for timeline clips
// ----------------------------------------------------------------------------
// Keyframes are stored per clip (clip.keyframes). Each keyframe carries a
// time (ms, relative to clip start) and partial CanvasObject properties.
// This module computes the interpolated object state for a given playback
// time, with easing — used by the live canvas, the audio engine and export.
// ============================================================================

import type { CanvasObject, Keyframe, TimelineClip, KeyframeProperties } from '@/types/animation';

const EASING_FNS: Record<Keyframe['easing'], (p: number) => number> = {
  linear: (p) => p,
  'ease-in': (p) => p * p,
  'ease-out': (p) => 1 - (1 - p) * (1 - p),
  'ease-in-out': (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2),
};

const NUMERIC_PROPS: (keyof KeyframeProperties & keyof CanvasObject)[] = [
  'x',
  'y',
  'scaleX',
  'scaleY',
  'rotation',
  'opacity',
];

const STEPPED_PROPS: (keyof KeyframeProperties)[] = ['expression', 'action', 'mouthShape'];

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/**
 * Find the clip that owns a canvas object in a given scene.
 * Objects are linked to clips through assetId (+ sceneId).
 */
export function findClipForObject(
  clips: TimelineClip[],
  obj: CanvasObject,
  sceneId?: string
): TimelineClip | undefined {
  return clips.find(
    (c) =>
      c.assetId === obj.assetId &&
      c.assetId != null &&
      (sceneId ? c.sceneId === sceneId : true)
  );
}

/**
 * Interpolate a canvas object's transform at playback time t (scene-relative ms).
 * Returns the same object reference when there are no keyframes.
 */
export function applyKeyframes(
  obj: CanvasObject,
  clips: TimelineClip[],
  t: number,
  sceneId?: string
): CanvasObject {
  const clip = findClipForObject(clips, obj, sceneId);
  if (!clip || !clip.keyframes || clip.keyframes.length === 0) return obj;

  const kfs = [...clip.keyframes].sort((a, b) => a.time - b.time);
  const ct = t - clip.startTime;

  // before the first keyframe → first keyframe wins (snap)
  if (ct <= kfs[0].time) return { ...obj, ...kfs[0].properties };
  // after the last keyframe → last keyframe wins
  if (ct >= kfs[kfs.length - 1].time) return { ...obj, ...kfs[kfs.length - 1].properties };

  // find surrounding pair
  let k0 = kfs[0];
  let k1 = kfs[kfs.length - 1];
  for (let i = 0; i < kfs.length - 1; i++) {
    if (ct >= kfs[i].time && ct <= kfs[i + 1].time) {
      k0 = kfs[i];
      k1 = kfs[i + 1];
      break;
    }
  }

  const span = k1.time - k0.time || 1;
  let u = (ct - k0.time) / span;
  const ease = EASING_FNS[k0.easing] || EASING_FNS['ease-in-out'];
  u = ease(Math.min(1, Math.max(0, u)));

  const p0 = k0.properties;
  const p1 = k1.properties;
  const merged: Partial<CanvasObject> = {};

  for (const prop of NUMERIC_PROPS) {
    const a = p0[prop];
    const b = p1[prop];
    if (a !== undefined && b !== undefined) {
      (merged as Record<string, number>)[prop] = lerp(a as number, b as number, u);
    } else if (a !== undefined) {
      (merged as Record<string, number>)[prop] = a as number;
    }
  }

  // stepped props take the value of the earlier keyframe
  for (const prop of STEPPED_PROPS) {
    if (p0[prop] !== undefined) {
      (merged as Record<string, unknown>)[prop] = p0[prop];
    }
  }

  // keep motion preset from the object (motion isn't keyframed — yet)
  return { ...obj, ...merged };
}

/**
 * Snapshot the current object transform as a keyframe property set.
 */
export function objectToKeyframeProperties(obj: CanvasObject): KeyframeProperties {
  return {
    x: obj.x,
    y: obj.y,
    scaleX: obj.scaleX,
    scaleY: obj.scaleY,
    rotation: obj.rotation,
    opacity: obj.opacity,
    expression: obj.expression,
    action: obj.action,
  };
}

/**
 * Upsert a keyframe at time for the given object's clip.
 * Returns the clip id when a clip was found, else null.
 */
export function upsertKeyframeForObject(
  clips: TimelineClip[],
  obj: CanvasObject,
  time: number,
  props: KeyframeProperties
): { clipId: string; keyframeId: string } | null {
  const clip = findClipForObject(clips, obj, obj.sceneId);
  if (!clip) return null;

  const clipTime = time - clip.startTime;
  if (clipTime < 0) return null;

  const existing = clip.keyframes.find((k) => Math.abs(k.time - clipTime) < 16);
  const kf: Keyframe = existing
    ? { ...existing, time: clipTime, properties: props }
    : {
        id:
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `kf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        clipId: clip.id,
        time: clipTime,
        properties: props,
        easing: 'ease-in-out',
      };

  return { clipId: clip.id, keyframeId: kf.id };
}
