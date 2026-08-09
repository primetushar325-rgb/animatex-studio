'use client';

// ============================================================================
// Editor UI helpers: recently-used assets, favorites, tutorial state, language.
// All persisted in localStorage.
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { getLang, setLang as persistLang, type Lang } from './i18n';

const RECENT_KEY = 'animatex-recent';
const FAV_KEY = 'animatex-favorites';
const TUTORIAL_KEY = 'animatex-tutorials';

export type AssetRef = { kind: 'character' | 'background' | 'prop' | 'music' | 'sfx'; id: string; name: string; url?: string };

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

/** Push to recently-used list (max 10), deduped. */
export function recordRecent(item: AssetRef) {
  const list = read<AssetRef[]>(RECENT_KEY, []);
  const next = [item, ...list.filter((i) => !(i.kind === item.kind && i.id === item.id))].slice(0, 10);
  write(RECENT_KEY, next);
  try {
    window.dispatchEvent(new Event('animatex-recent-change'));
  } catch {
    // ignore
  }
}

export function getRecent(): AssetRef[] {
  return read<AssetRef[]>(RECENT_KEY, []);
}

export function toggleFavorite(item: AssetRef): boolean {
  const favs = read<AssetRef[]>(FAV_KEY, []);
  const exists = favs.some((f) => f.kind === item.kind && f.id === item.id);
  const next = exists
    ? favs.filter((f) => !(f.kind === item.kind && f.id === item.id))
    : [item, ...favs].slice(0, 50);
  write(FAV_KEY, next);
  try {
    window.dispatchEvent(new Event('animatex-fav-change'));
  } catch {
    // ignore
  }
  return !exists;
}

export function isFavorite(item: AssetRef): boolean {
  return read<AssetRef[]>(FAV_KEY, []).some((f) => f.kind === item.kind && f.id === item.id);
}

export function getFavorites(): AssetRef[] {
  return read<AssetRef[]>(FAV_KEY, []);
}

/** One-time tutorial overlays per panel id. */
export function shouldShowTutorial(id: string): boolean {
  const seen = read<string[]>(TUTORIAL_KEY, []);
  return !seen.includes(id);
}

export function dismissTutorial(id: string) {
  const seen = read<string[]>(TUTORIAL_KEY, []);
  if (!seen.includes(id)) {
    write(TUTORIAL_KEY, [...seen, id]);
  }
}

export function resetTutorials() {
  write(TUTORIAL_KEY, []);
}

/** React hook for live language. */
export function useLanguage(): [Lang, (l: Lang) => void] {
  const [lang, setLangState] = useState<Lang>(() => getLang());
  useEffect(() => {
    const onChange = () => setLangState(getLang());
    window.addEventListener('animatex-lang-change', onChange);
    return () => window.removeEventListener('animatex-lang-change', onChange);
  }, []);
  const set = useCallback((l: Lang) => persistLang(l), []);
  return [lang, set];
}

/** React hook for live recent list. */
export function useRecent(): AssetRef[] {
  const [list, setList] = useState<AssetRef[]>(() => getRecent());
  useEffect(() => {
    const on = () => setList(getRecent());
    window.addEventListener('animatex-recent-change', on);
    return () => window.removeEventListener('animatex-recent-change', on);
  }, []);
  return list;
}

/** React hook for live favorites. */
export function useFavorites(): AssetRef[] {
  const [list, setList] = useState<AssetRef[]>(() => getFavorites());
  useEffect(() => {
    const on = () => setList(getFavorites());
    window.addEventListener('animatex-fav-change', on);
    return () => window.removeEventListener('animatex-fav-change', on);
  }, []);
  return list;
}
