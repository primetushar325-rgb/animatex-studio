// ============================================================================
// Offline "Smart Story" generator
// ----------------------------------------------------------------------------
// Turns a free-form Bangla/English sentence into a scene plan:
// detects characters, backgrounds, actions and expressions by keyword.
// No external AI API — 100% free, works offline.
// ============================================================================

import type {
  CharacterType,
  CharacterAction,
  CharacterExpression,
} from '@/types/animation';

export interface StoryCharacter {
  type: CharacterType;
  name: string;
  action: CharacterAction;
  expression: CharacterExpression;
}

export interface StoryScene {
  name: string;
  background: string; // built-in background name (Village, City, School…)
  bgColor: string;
  characters: StoryCharacter[];
  props: string[];
}

interface CharRule {
  type: CharacterType;
  name: string;
  keys: string[];
}

const CHAR_RULES: CharRule[] = [
  { type: 'boy', name: 'Boy', keys: ['ছেলে', 'ছেলেটা', 'ছেলেটি', 'বালক', 'boy', 'ছোকরা'] },
  { type: 'girl', name: 'Girl', keys: ['মেয়ে', 'মেয়েটা', 'মেয়েটি', 'বালিকা', 'girl'] },
  { type: 'child', name: 'Child', keys: ['শিশু', 'বাচ্চা', 'ছোট্ট', 'খোকা', 'child'] },
  { type: 'man', name: 'Man', keys: ['বাবা', 'মানুষ', 'পুরুষ', 'ভাই', 'man'] },
  { type: 'woman', name: 'Woman', keys: ['মা', 'মহিলা', 'আপা', 'woman'] },
  { type: 'old-man', name: 'Old Man', keys: ['দাদু', 'বুড়ো', 'বৃদ্ধ', 'old man'] },
  { type: 'old-woman', name: 'Old Woman', keys: ['দাদি', 'বুড়ি', 'বৃদ্ধা', 'old woman'] },
  { type: 'dog', name: 'Dog', keys: ['কুকুর', 'কুত্তা', 'dog', 'বড় কুকুর'] },
  { type: 'cat', name: 'Cat', keys: ['বিড়াল', 'বেড়াল', 'cat', 'বিরাল'] },
  { type: 'cow', name: 'Cow', keys: ['গরু', 'cow'] },
  { type: 'goat', name: 'Goat', keys: ['ছাগল', 'goat'] },
  { type: 'bird', name: 'Bird', keys: ['পাখি', 'পাখিটা', 'bird', 'চড়ুই', 'কাক'] },
];

const BG_RULES: { name: string; color: string; keys: string[] }[] = [
  { name: 'Village', color: '#CFE8A9', keys: ['গ্রাম', 'গাঁয়', 'village'] },
  { name: 'City', color: '#BFD9EA', keys: ['শহর', 'city'] },
  { name: 'School', color: '#E8D5B7', keys: ['স্কুল', 'শালা', 'school', 'বিদ্যালয়'] },
  { name: 'Market', color: '#F0D9A8', keys: ['বাজার', 'হাট', 'market'] },
  { name: 'House', color: '#EAD9C0', keys: ['বাড়ি', 'ঘর', 'house', 'home'] },
  { name: 'Park', color: '#C9E8C0', keys: ['পার্ক', 'বাগান', 'park', 'garden'] },
  { name: 'River', color: '#A9D6F0', keys: ['নদী', 'river', 'নদ'] },
  { name: 'Farm', color: '#E8DFA8', keys: ['খামার', 'মাঠ', 'ক্ষেত', 'farm', 'জমি'] },
  { name: 'Road', color: '#D5D5D5', keys: ['রাস্তা', 'পথ', 'road'] },
];

const ACTION_RULES: { action: CharacterAction; keys: string[] }[] = [
  { action: 'walk', keys: ['হাঁট', 'হেঁটে', 'পথে যাচ্ছে', 'walk', 'walking', 'চলছে'] },
  { action: 'run', keys: ['দৌড়', 'ছুটছে', 'run', 'running', 'ধাওয়া'] },
  { action: 'jump', keys: ['লাফ', 'ঝাঁপ', 'jump', 'jumping'] },
  { action: 'sit', keys: ['বস', 'sit', 'sitting'] },
  { action: 'wave', keys: ['হাত নাড়া', 'হাত নাড়ছ', 'wave', 'waving', 'ডাকছে'] },
  { action: 'talk', keys: ['কথা', 'বলে', 'বলল', 'বলছে', 'জিজ্ঞেস', 'talk', 'speaking', 'কথা বলে'] },
  { action: 'laugh', keys: ['হাসি', 'হাসছে', 'হেসে', 'laugh', 'laughing'] },
  { action: 'cry', keys: ['কাঁদ', 'কাদছ', 'কান্না', 'cry', 'crying'] },
  { action: 'dance', keys: ['নাচ', 'dance', 'dancing'] },
  { action: 'point', keys: ['দেখা', 'দেখাল', 'point', 'pointing', 'দেখাচ্ছে'] },
  { action: 'clap', keys: ['তালি', 'হাততালি', 'clap', 'clapping'] },
  { action: 'stand', keys: ['দাঁড়', 'stand', 'standing', 'থামল'] },
];

const EXPR_RULES: { expr: CharacterExpression; keys: string[] }[] = [
  { expr: 'happy', keys: ['খুশি', 'আনন্দ', 'হাসি', 'হাসছে', 'happy', 'খুশিতে'] },
  { expr: 'sad', keys: ['দুঃখ', 'মন খারাপ', 'sad', 'বেদনা', 'কষ্ট'] },
  { expr: 'angry', keys: ['রাগ', 'angry', 'ক্ষিপ্ত', 'রাগে'] },
  { expr: 'scared', keys: ['ভয়', 'ভীত', 'scared', 'আতঙ্ক'] },
  { expr: 'surprised', keys: ['আশ্চর্য', 'হঠাৎ', 'চমকে', 'surprised', 'শক'] },
  { expr: 'sleepy', keys: ['ঘুম', 'ক্লান্ত', 'sleepy', 'তন্দ্রা'] },
  { expr: 'thinking', keys: ['ভাবছে', 'ভাবল', 'thinking', 'চিন্তা'] },
  { expr: 'laughing', keys: ['হো হো', 'হাসিতে', 'laughing'] },
  { expr: 'crying', keys: ['কাঁদছে', 'কান্না', 'crying', 'কাদছিল'] },
];

const DEFAULT_BG = { name: 'Park', color: '#C9E8C0' };

function containsAny(text: string, keys: string[]): boolean {
  const lower = text.toLowerCase();
  return keys.some((k) => lower.includes(k.toLowerCase()));
}

function splitSentences(text: string): string[] {
  return text
    .split(/[।.!?\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

export function generateStory(text: string): StoryScene[] {
  const sentences = splitSentences(text).slice(0, 8);
  if (sentences.length === 0) return [];

  return sentences.map((sentence, idx) => {
    // background
    const bgRule = BG_RULES.find((r) => containsAny(sentence, r.keys)) || DEFAULT_BG;

    // characters (dedupe by type, keep order)
    const found: CharRule[] = [];
    for (const rule of CHAR_RULES) {
      if (containsAny(sentence, rule.keys) && !found.some((f) => f.type === rule.type)) {
        found.push(rule);
      }
    }
    // default: a boy if nothing detected
    if (found.length === 0) found.push(CHAR_RULES[0]);

    const actionRule = ACTION_RULES.find((r) => containsAny(sentence, r.keys));
    const action: CharacterAction = actionRule?.action || (idx % 2 === 0 ? 'walk' : 'idle');

    const exprRule = EXPR_RULES.find((r) => containsAny(sentence, r.keys));
    const expression: CharacterExpression = exprRule?.expr || 'happy';

    // props
    const props: string[] = [];
    if (containsAny(sentence, ['গাছ', 'tree'])) props.push('Tree');
    if (containsAny(sentence, ['বই', 'book'])) props.push('Book');
    if (containsAny(sentence, ['ফোন', 'phone'])) props.push('Phone');
    if (containsAny(sentence, ['বল', 'ball'])) props.push('Ball');
    if (containsAny(sentence, ['গাড়ি', 'car'])) props.push('Car');
    if (containsAny(sentence, ['চেয়ার', 'chair'])) props.push('Chair');

    const characters: StoryCharacter[] = found.map((f, i) => ({
      type: f.type,
      name: f.name,
      action: i === 0 ? action : 'idle',
      expression: i === 0 ? expression : 'neutral',
    }));

    return {
      name: `Scene ${idx + 1}`,
      background: bgRule.name,
      bgColor: bgRule.color,
      characters,
      props,
    };
  });
}
