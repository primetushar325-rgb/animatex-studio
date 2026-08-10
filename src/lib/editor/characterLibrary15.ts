'use client';

// ============================================================================
// AnimateX — Official 15-Character Library (Part 10)
// The uploaded character reference sheet defines these 15 characters as the
// initial library. Each maps to a procedural CharacterType in the renderer
// (same visual language: clean outlines, consistent proportions, expressive
// faces, full-body). Views are generated per character by the renderer.
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
}

export const CHARACTER_LIBRARY_15: OfficialCharacter[] = [
  { id: 'child-boy', type: 'child', name: 'Child Boy', category: 'Kids', gender: 'male', age: 'child', default: { action: 'idle', expression: 'happy' }, size: { w: 200, h: 280 } },
  { id: 'child-girl', type: 'girl', name: 'Child Girl', category: 'Kids', gender: 'female', age: 'child', default: { action: 'idle', expression: 'happy' }, size: { w: 200, h: 280 } },
  { id: 'student-boy', type: 'student-boy', name: 'Student Boy', category: 'Students', gender: 'male', age: 'teen', default: { action: 'stand', expression: 'neutral' }, size: { w: 210, h: 300 } },
  { id: 'student-girl', type: 'student-girl', name: 'Student Girl', category: 'Students', gender: 'female', age: 'teen', default: { action: 'stand', expression: 'neutral' }, size: { w: 210, h: 300 } },
  { id: 'young-man', type: 'young-man', name: 'Young Man', category: 'Adults', gender: 'male', age: 'adult', default: { action: 'stand', expression: 'neutral' }, size: { w: 220, h: 320 } },
  { id: 'young-woman', type: 'young-woman', name: 'Young Woman', category: 'Adults', gender: 'female', age: 'adult', default: { action: 'stand', expression: 'happy' }, size: { w: 220, h: 320 } },
  { id: 'village-man', type: 'village-man', name: 'Village Man', category: 'Village', gender: 'male', age: 'adult', default: { action: 'walk', expression: 'neutral' }, size: { w: 220, h: 320 } },
  { id: 'farmer', type: 'farmer', name: 'Farmer', category: 'Village', gender: 'male', age: 'adult', default: { action: 'farm', expression: 'neutral' }, size: { w: 220, h: 320 } },
  { id: 'shopkeeper', type: 'shopkeeper', name: 'Shopkeeper', category: 'Village', gender: 'male', age: 'adult', default: { action: 'stand', expression: 'happy' }, size: { w: 220, h: 320 } },
  { id: 'teacher', type: 'teacher', name: 'Teacher', category: 'Professions', gender: 'female', age: 'adult', default: { action: 'talk', expression: 'neutral' }, size: { w: 220, h: 320 } },
  { id: 'doctor', type: 'doctor', name: 'Doctor', category: 'Professions', gender: 'male', age: 'adult', default: { action: 'stand', expression: 'neutral' }, size: { w: 220, h: 320 } },
  { id: 'police-officer', type: 'police', name: 'Police Officer', category: 'Professions', gender: 'male', age: 'adult', default: { action: 'stand', expression: 'neutral' }, size: { w: 220, h: 320 } },
  { id: 'old-man', type: 'old-man', name: 'Old Man', category: 'Seniors', gender: 'male', age: 'senior', default: { action: 'idle', expression: 'neutral' }, size: { w: 210, h: 300 } },
  { id: 'old-woman', type: 'old-woman', name: 'Old Woman', category: 'Seniors', gender: 'female', age: 'senior', default: { action: 'idle', expression: 'happy' }, size: { w: 210, h: 300 } },
  { id: 'baby', type: 'baby', name: 'Baby', category: 'Infants', gender: 'male', age: 'infant', default: { action: 'idle', expression: 'happy' }, size: { w: 170, h: 220 } },
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
