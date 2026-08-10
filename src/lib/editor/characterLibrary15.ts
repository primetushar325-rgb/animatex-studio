'use client';

// ============================================================================
// AnimateX — Official 15-Character Library
// The uploaded 15 PNGs (transparent, front-view) are the official art source.
// Files live in /public/characters/ (the project's existing stock-art folder).
//
// Each character:
//   frontImageUrl         → real PNG (rendered as the thumbnail + canvas image)
//   threeQuarterFrontUrl  → null for now (3/4 views reuse the "coming soon"
//                           placeholder UI already used for incomplete art)
//   threeQuarterBackUrl   → null (same)
//   type                  → falls back to the procedural character when no
//                           image is available (custom uploads, etc.)
// ============================================================================

import type { CharacterType, CharacterAction, CharacterExpression } from '@/types/animation';

export interface OfficialCharacter {
  id: string;
  type: CharacterType;
  name: string;
  category: 'Kids' | 'Students' | 'Adults' | 'Village' | 'Professions' | 'Seniors' | 'Infants';
  gender: 'male' | 'female';
  age: 'infant' | 'child' | 'teen' | 'adult' | 'senior';
  default: { action: CharacterAction; expression: CharacterExpression };
  /** Default spawn size (width x height) on the canvas. */
  size: { w: number; h: number };
  /** Real transparent PNG (front view). Public path under /characters/. */
  frontImageUrl: string;
  /** Not supplied yet — keep null so UI shows the "coming soon" placeholder. */
  threeQuarterFrontUrl: string | null;
  threeQuarterBackUrl: string | null;
}

// helper: /characters/<Name>.png (spaces URL-encoded by the browser)
const img = (name: string) => `/characters/${name}.png`;

export const CHARACTER_LIBRARY_15: OfficialCharacter[] = [
  { id: 'child-boy', type: 'child', name: 'Child Boy', category: 'Kids', gender: 'male', age: 'child', default: { action: 'idle', expression: 'happy' }, size: { w: 200, h: 280 }, frontImageUrl: img('Child Boy'), threeQuarterFrontUrl: null, threeQuarterBackUrl: null },
  { id: 'child-girl', type: 'girl', name: 'Child Girl', category: 'Kids', gender: 'female', age: 'child', default: { action: 'idle', expression: 'happy' }, size: { w: 200, h: 280 }, frontImageUrl: img('Child Girl'), threeQuarterFrontUrl: null, threeQuarterBackUrl: null },
  { id: 'student-boy', type: 'student-boy', name: 'Student Boy', category: 'Students', gender: 'male', age: 'teen', default: { action: 'stand', expression: 'neutral' }, size: { w: 210, h: 300 }, frontImageUrl: img('Student Boy'), threeQuarterFrontUrl: null, threeQuarterBackUrl: null },
  { id: 'student-girl', type: 'student-girl', name: 'Student Girl', category: 'Students', gender: 'female', age: 'teen', default: { action: 'stand', expression: 'neutral' }, size: { w: 210, h: 300 }, frontImageUrl: img('Student Girl'), threeQuarterFrontUrl: null, threeQuarterBackUrl: null },
  { id: 'young-man', type: 'young-man', name: 'Young Man', category: 'Adults', gender: 'male', age: 'adult', default: { action: 'stand', expression: 'neutral' }, size: { w: 220, h: 320 }, frontImageUrl: img('Young Man'), threeQuarterFrontUrl: null, threeQuarterBackUrl: null },
  { id: 'young-woman', type: 'young-woman', name: 'Young Woman', category: 'Adults', gender: 'female', age: 'adult', default: { action: 'stand', expression: 'happy' }, size: { w: 220, h: 320 }, frontImageUrl: img('Young Woman'), threeQuarterFrontUrl: null, threeQuarterBackUrl: null },
  { id: 'village-man', type: 'village-man', name: 'Village Man', category: 'Village', gender: 'male', age: 'adult', default: { action: 'walk', expression: 'neutral' }, size: { w: 220, h: 320 }, frontImageUrl: img('Village Man'), threeQuarterFrontUrl: null, threeQuarterBackUrl: null },
  { id: 'farmer', type: 'farmer', name: 'Farmer', category: 'Village', gender: 'male', age: 'adult', default: { action: 'farm', expression: 'neutral' }, size: { w: 220, h: 320 }, frontImageUrl: img('Farmer'), threeQuarterFrontUrl: null, threeQuarterBackUrl: null },
  { id: 'shopkeeper', type: 'shopkeeper', name: 'Shopkeeper', category: 'Village', gender: 'male', age: 'adult', default: { action: 'stand', expression: 'happy' }, size: { w: 220, h: 320 }, frontImageUrl: img('Shopkeeper'), threeQuarterFrontUrl: null, threeQuarterBackUrl: null },
  { id: 'teacher', type: 'teacher', name: 'Teacher', category: 'Professions', gender: 'female', age: 'adult', default: { action: 'talk', expression: 'neutral' }, size: { w: 220, h: 320 }, frontImageUrl: img('Teacher'), threeQuarterFrontUrl: null, threeQuarterBackUrl: null },
  { id: 'doctor', type: 'doctor', name: 'Doctor', category: 'Professions', gender: 'male', age: 'adult', default: { action: 'stand', expression: 'neutral' }, size: { w: 220, h: 320 }, frontImageUrl: img('Doctor'), threeQuarterFrontUrl: null, threeQuarterBackUrl: null },
  { id: 'police-officer', type: 'police', name: 'Police', category: 'Professions', gender: 'male', age: 'adult', default: { action: 'stand', expression: 'neutral' }, size: { w: 220, h: 320 }, frontImageUrl: img('Police'), threeQuarterFrontUrl: null, threeQuarterBackUrl: null },
  { id: 'old-man', type: 'old-man', name: 'Old Man', category: 'Seniors', gender: 'male', age: 'senior', default: { action: 'idle', expression: 'neutral' }, size: { w: 210, h: 300 }, frontImageUrl: img('Old Man'), threeQuarterFrontUrl: null, threeQuarterBackUrl: null },
  { id: 'old-woman', type: 'old-woman', name: 'Old Woman', category: 'Seniors', gender: 'female', age: 'senior', default: { action: 'idle', expression: 'happy' }, size: { w: 210, h: 300 }, frontImageUrl: img('Old Woman'), threeQuarterFrontUrl: null, threeQuarterBackUrl: null },
  { id: 'baby', type: 'baby', name: 'Baby', category: 'Infants', gender: 'male', age: 'infant', default: { action: 'idle', expression: 'happy' }, size: { w: 170, h: 220 }, frontImageUrl: img('Baby'), threeQuarterFrontUrl: null, threeQuarterBackUrl: null },
];

export const CHARACTER_CATEGORIES: { id: OfficialCharacter['category'] | 'All'; label: string }[] = [
  { id: 'All', label: 'All' },
  { id: 'Kids', label: 'Kids' },
  { id: 'Students', label: 'Students' },
  { id: 'Adults', label: 'Adults' },
  { id: 'Village', label: 'Village' },
  { id: 'Professions', label: 'Professions' },
  { id: 'Seniors', label: 'Seniors' },
  { id: 'Infants', label: 'Infants' },
];

export function getOfficialCharacter(id: string): OfficialCharacter | undefined {
  return CHARACTER_LIBRARY_15.find((c) => c.id === id);
}

/** CSS animation class for basic motion (STEP 4 — CSS only, no sprite sheets). */
export function charMotionClass(action: CharacterAction): string {
  switch (action) {
    case 'run':
      return 'char-run';
    case 'walk':
    case 'jog':
      return 'char-walk';
    default:
      return 'char-idle';
  }
}
