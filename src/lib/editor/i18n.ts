'use client';

// ============================================================================
// Minimal editor UI translation (Bangla + English).
// Extendable: add keys for more strings as needed.
// ============================================================================

export type Lang = 'en' | 'bn';

const STRINGS = {
  en: {
    characters: 'Characters',
    media: 'Media',
    templates: 'Templates',
    imageGen: 'Image Gen',
    videoGen: 'Video Gen',
    aiVoice: 'AI Voice',
    aiChar: 'AI Char',
    search: 'Search',
    applyScene: 'Apply Scene',
    blankScene: 'Blank Scene',
    download: 'Download',
    save: 'Save',
    saved: 'Saved',
    undo: 'Undo',
    redo: 'Redo',
    keyframe: 'Keyframe',
    duplicate: 'Duplicate',
    cut: 'Cut',
    addScene: 'New Scene',
    settings: 'Settings',
    notifications: 'Notifications',
    history: 'History',
    export: 'Export',
    voice: 'Voice',
    sound: 'Sound',
    text: 'Text',
    props: 'Props',
    stickers: 'Stickers',
    credits: 'Credits',
    upgrade: 'Upgrade to Pro',
    comingSoon: 'Coming soon',
    create: 'Create',
    edit: 'Edit',
    recentlyUsed: 'Recently Used',
    favorites: 'Favorites',
    globalSearch: 'Search everything',
  },
  bn: {
    characters: 'চরিত্র',
    media: 'মিডিয়া',
    templates: 'টেমপ্লেট',
    imageGen: 'ইমেজ জেন',
    videoGen: 'ভিডিও জেন',
    aiVoice: 'এআই ভয়েস',
    aiChar: 'এআই চরিত্র',
    search: 'খুঁজুন',
    applyScene: 'সিন প্রয়োগ করুন',
    blankScene: 'খালি সিন',
    download: 'ডাউনলোড',
    save: 'সেভ',
    saved: 'সেভ হয়েছে',
    undo: 'আনডু',
    redo: 'রিডু',
    keyframe: 'কিফ্রেম',
    duplicate: 'ডুপ্লিকেট',
    cut: 'কাট',
    addScene: 'নতুন সিন',
    settings: 'সেটিংস',
    notifications: 'নোটিফিকেশন',
    history: 'ইতিহাস',
    export: 'এক্সপোর্ট',
    voice: 'ভয়েস',
    sound: 'সাউন্ড',
    text: 'টেক্সট',
    props: 'প্রপস',
    stickers: 'স্টিকার',
    credits: 'ক্রেডিট',
    upgrade: 'প্রোতে আপগ্রেড',
    comingSoon: 'শীঘ্রই আসছে',
    create: 'তৈরি করুন',
    edit: 'এডিট',
    recentlyUsed: 'সম্প্রতি ব্যবহৃত',
    favorites: 'পছন্দসমূহ',
    globalSearch: 'সব খুঁজুন',
  },
} as const;

export type I18nKey = keyof (typeof STRINGS)['en'];

const LANG_KEY = 'animatex-lang';

export function getLang(): Lang {
  try {
    return localStorage.getItem(LANG_KEY) === 'bn' ? 'bn' : 'en';
  } catch {
    return 'en';
  }
}

export function setLang(lang: Lang) {
  try {
    localStorage.setItem(LANG_KEY, lang);
    window.dispatchEvent(new Event('animatex-lang-change'));
  } catch {
    // ignore
  }
}

export function t(key: I18nKey, lang?: Lang): string {
  const l = lang || getLang();
  return STRINGS[l][key];
}
