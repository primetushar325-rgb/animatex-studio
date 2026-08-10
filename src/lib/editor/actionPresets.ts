'use client';

// ============================================================================
// AnimateX — Transform-based Action Presets (Phase 1)
// ----------------------------------------------------------------------------
// For uploaded PNG characters (no rig), actions are driven by TRANSFORM
// keyframes on the timeline clip:
//
//   walk : X moves forward (+distance) with Y bounce + slight rotation
//   run  : same as walk but faster + bigger bounce + larger stride
//   jump : parabolic Y (up then down, ease-in-out) with small X forward
//   idle : gentle breathing (scale 1 → 1.02 → 1)
//
// generateActionKeyframes() writes these keyframes into the character's clip
// starting at the current playhead, so playback interpolates the character
// across the scene — no sprite sheets, no rig needed.
// ============================================================================

import type { CanvasObject, KeyframeProperties } from '@/types/animation';

export type ActionPresetId = 'idle' | 'walk' | 'run' | 'jump';

export interface ActionPreset {
  id: ActionPresetId;
  label: string;
  /** Duration of one cycle in ms. */
  cycle: number;
  /** How far the character travels per cycle (px). Direction flips this. */
  distance: number;
  /** Vertical bounce amplitude (px). */
  bounce: number;
  /** Rotation swing amplitude (degrees). */
  tilt: number;
  /** Scale breathing amount (0 = none). */
  scaleAmount: number;
  /** Parabolic jump height (px) — jump only. */
  jumpHeight?: number;
  /** Frames per keyframe sample. */
  samples: number;
}

export const ACTION_PRESETS: Record<ActionPresetId, ActionPreset> = {
  idle: { id: 'idle', label: 'Idle', cycle: 2200, distance: 0, bounce: 4, tilt: 1.5, scaleAmount: 0.02, samples: 6 },
  walk: { id: 'walk', label: 'Walk', cycle: 900, distance: 120, bounce: 10, tilt: 3, scaleAmount: 0.01, samples: 8 },
  run: { id: 'run', label: 'Run', cycle: 450, distance: 180, bounce: 16, tilt: 6, scaleAmount: 0.02, samples: 8 },
  jump: { id: 'jump', label: 'Jump', cycle: 1100, distance: 60, bounce: 0, tilt: 4, scaleAmount: 0.03, jumpHeight: 70, samples: 12 },
};

/**
 * Build a keyframe sequence for a preset.
 * `startClipTime` = clip-local time where the action begins (playhead − clip.startTime).
 * `duration`     = how long the whole sequence lasts in ms (multiple cycles loop).
 * `direction`    = 1 (right) or -1 (left); flips X travel + mirrors the image (flipX).
 * Returns keyframes sorted by time, each with full transform properties.
 */
export function generateActionKeyframes(
  preset: ActionPresetId,
  startClipTime: number,
  duration: number,
  direction: 1 | -1,
  baseObj: CanvasObject
): { time: number; properties: KeyframeProperties }[] {
  const p = ACTION_PRESETS[preset];
  const dir = direction;
  const out: { time: number; properties: KeyframeProperties }[] = [];
  const cycles = Math.max(1, Math.round(duration / p.cycle));
  const total = cycles * p.cycle;
  const n = Math.max(4, p.samples * cycles);
  const frameDur = total / n;

  for (let i = 0; i <= n; i++) {
    const t = Math.round(i * frameDur); // clip-local ms
    // last sample snaps to the exact end of the final cycle so the character
    // ends the action at the full travel distance (no cycle-boundary reset)
    const isLast = i === n;
    const cyc = isLast ? 1 : (t % p.cycle) / p.cycle; // 0..1 within the current cycle

    let x = 0;
    let y = 0;
    let rot = 0;
    let scale = 1;

    if (preset === 'jump') {
      // parabolic jump: rise fast, fall slower (ease-in-out)
      const ph = Math.sin(cyc * Math.PI); // 0 → 1 → 0
      const eased = 1 - Math.pow(1 - ph, 2);
      y = -p.jumpHeight! * eased;
      x = p.distance * cyc * dir;
      rot = Math.sin(cyc * Math.PI * 2) * p.tilt * 0.6;
      scale = 1 + p.scaleAmount * ph;
    } else if (preset === 'idle') {
      // breathing: subtle scale + tiny bob
      const ph = Math.sin(cyc * Math.PI * 2);
      y = -Math.abs(ph) * p.bounce;
      scale = 1 + p.scaleAmount * Math.max(0, ph);
      rot = ph * p.tilt * 0.4;
    } else {
      // walk / run: X travels LINEARLY across the whole duration (never
      // resets at cycle boundaries); bounce + rock follow the cycle
      const progress = isLast ? 1 : i / n;
      x = p.distance * cycles * progress * dir;
      y = -Math.abs(Math.sin(cyc * Math.PI)) * p.bounce;
      rot = Math.sin(cyc * Math.PI * 2) * p.tilt;
      scale = 1 + p.scaleAmount * Math.abs(Math.sin(cyc * Math.PI * 2));
    }

    out.push({
      time: startClipTime + t,
      properties: {
        x: baseObj.x + x,
        y: baseObj.y + y,
        rotation: baseObj.rotation + rot,
        scaleX: baseObj.scaleX * scale,
        scaleY: baseObj.scaleY * scale,
        opacity: baseObj.opacity,
      },
    });
  }

  return out;
}

/** Default duration for a single preset cycle, in ms. */
export function presetDefaultDuration(preset: ActionPresetId): number {
  return ACTION_PRESETS[preset].cycle;
}
