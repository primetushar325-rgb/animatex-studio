'use client';

// ============================================================================
// GlobalSearch — one search entry point across characters + backgrounds +
// props + templates. Opens a modal, live-filtered.
// ============================================================================

import { useState, useEffect, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
import { getPublicCharacters } from '@/lib/editor/characterLibrary';
import { recordRecent } from '@/lib/editor/useEditorUI';

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onAddObject: (kind: 'character' | 'background' | 'prop', name: string, imageUrl?: string) => void;
}

interface Hit {
  kind: 'character' | 'background' | 'prop' | 'template';
  name: string;
  imageUrl?: string;
}

export function GlobalSearch({ isOpen, onClose, onAddObject }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [publicChars, setPublicChars] = useState<{ name: string; imageUrl: string }[]>([]);

  const { characters, backgrounds, props } = useEditorStore();


  const hits = useMemo<Hit[]>(() => {
    const q = query.trim().toLowerCase();
    const all: Hit[] = [
      ...characters.filter((c) => c.isCustom).map((c) => ({ kind: 'character' as const, name: c.name, imageUrl: c.imageUrl })),
      ...publicChars.map((c) => ({ kind: 'character' as const, name: c.name, imageUrl: c.imageUrl })),
      ...backgrounds.filter((b) => b.isCustom).map((b) => ({ kind: 'background' as const, name: b.name, imageUrl: b.imageUrl })),
      ...props.filter((p) => p.isCustom).map((p) => ({ kind: 'prop' as const, name: p.name, imageUrl: p.imageUrl })),
      ...[
        { kind: 'background' as const, name: 'Village' },
        { kind: 'background' as const, name: 'City' },
        { kind: 'background' as const, name: 'School' },
        { kind: 'background' as const, name: 'Park' },
        { kind: 'background' as const, name: 'River' },
        { kind: 'background' as const, name: 'Farm' },
        { kind: 'background' as const, name: 'Road' },
        { kind: 'prop' as const, name: 'Tree' },
        { kind: 'prop' as const, name: 'Car' },
        { kind: 'prop' as const, name: 'Ball' },
        { kind: 'template' as const, name: 'Village Morning' },
        { kind: 'template' as const, name: 'Kids Cartoon Intro' },
      ],
    ];
    if (!q) return all.slice(0, 12);
    return all.filter((h) => h.name.toLowerCase().includes(q));
  }, [query, characters, backgrounds, props, publicChars]);

  const pick = (h: Hit) => {
    if (h.kind === 'template') {
      onClose();
      return;
    }
    recordRecent({ kind: h.kind, id: h.name + (h.imageUrl || ''), name: h.name, url: h.imageUrl });
    onAddObject(h.kind, h.name, h.imageUrl);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-16 px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md editor-panel border border-[var(--editor-border)] rounded-2xl shadow-2xl overflow-hidden animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--editor-border)]">
          <Search size={18} className="text-[var(--editor-text-2)] shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              void getPublicCharacters().then((list) =>
                setPublicChars(list.map((c) => ({ name: c.name, imageUrl: c.imageUrl })))
              );
            }}
            placeholder="Search everything (characters, backgrounds, props, templates)…"
            className="flex-1 bg-transparent text-white text-sm placeholder-[var(--editor-text-2)] focus:outline-none"
          />
          <button onClick={onClose} className="text-[var(--editor-text-2)] hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto editor-scroll p-3">
          {hits.length === 0 ? (
            <p className="text-center text-xs text-[var(--editor-text-2)] py-8">No results</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {hits.map((h, i) => (
                <button
                  key={`${h.kind}-${h.name}-${i}`}
                  onClick={() => pick(h)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl editor-panel-2 hover:bg-[var(--editor-panel-3)] transition-colors text-left"
                >
                  {h.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={h.imageUrl} alt="" className="w-8 h-8 object-contain rounded" />
                  ) : (
                    <span className="w-8 h-8 rounded editor-gradient flex items-center justify-center text-white text-xs">
                      {h.kind === 'background' ? 'Bg' : h.kind === 'prop' ? 'Pr' : h.kind === 'template' ? 'Tp' : 'Ch'}
                    </span>
                  )}
                  <span className="text-xs text-white truncate">{h.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
