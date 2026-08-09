'use client';

// ============================================================================
// TemplatesPanel — modal opened from the editor's "Templates" tab.
// Lets the user pick a scene template (or a blank scene) and apply it.
//
// TODO: replace the 3 placeholder scene templates below with real scene
// thumbnails once they are created (see PLACEHOLDER_TEMPLATES array).
// ============================================================================

import { useState, useEffect } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { Search, X, Check, Plus } from 'lucide-react';

// ---------------------------------------------------------------------------
// Placeholder templates — real scene thumbnails/assets will replace these.
// ---------------------------------------------------------------------------
// TODO: replace with real scene thumbnails
const PLACEHOLDER_TEMPLATES: {
  id: string;
  name: string;
  category: string;
  duration: number;
  scenes: number;
}[] = [
  { id: 'tpl-1', name: 'Village Morning', category: 'Village', duration: 5, scenes: 1 },
  { id: 'tpl-2', name: 'Kids Cartoon Intro', category: 'Kids', duration: 5, scenes: 2 },
  { id: 'tpl-3', name: 'Animal Story', category: 'Animals', duration: 5, scenes: 1 },
];

const TABS = ['All', 'Village', 'Kids', 'Animals', 'Funny', 'Educational', 'Narrator'];
const CHIPS = ['Trending', 'New', 'Kids Cartoon', 'Village Story', 'Comedy Shorts', 'Emotional', 'Quick Shorts'];

interface TemplatesPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TemplatesPanel({ isOpen, onClose }: TemplatesPanelProps) {
  const [tab, setTab] = useState('All');
  const [search, setSearch] = useState('');
  const [chip, setChip] = useState('Trending');
  const [selectedId, setSelectedId] = useState<string>('blank'); // blank selected by default

  const { scenes, addScene, updateScene, setCurrentScene } = useEditorStore();

  // reset selection when the panel closes (deferred so it never runs mid-render)
  useEffect(() => {
    if (!isOpen) {
      const t = setTimeout(() => {
        setSearch('');
        setSelectedId('blank');
      }, 0);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  const filteredTemplates = PLACEHOLDER_TEMPLATES.filter((t) => {
    const matchesTab = tab === 'All' || t.category === tab;
    const matchesSearch = t.name.toLowerCase().includes(search.trim().toLowerCase());
    return matchesTab && matchesSearch;
  });

  const applyBlankScene = () => {
    // ensure at least one scene exists
    if (scenes.length === 0) {
      addScene('Scene 1');
    } else {
      // jump to first scene
      setCurrentScene(scenes[0].id);
    }
    onClose();
  };

  const applyTemplate = (tpl: (typeof PLACEHOLDER_TEMPLATES)[number]) => {
    // placeholder behaviour — creates a scene with the template name so the
    // flow works end-to-end. Real templates will populate scenes/objects.
    for (let i = 0; i < tpl.scenes; i++) {
      addScene(i === 0 ? tpl.name : `${tpl.name} ${i + 1}`);
    }
    const st = useEditorStore.getState();
    const firstSceneId = st.scenes.find((s) => s.name === tpl.name)?.id;
    if (firstSceneId) {
      st.setCurrentScene(firstSceneId);
      st.updateScene(firstSceneId, { duration: tpl.duration * 1000 });
    }
    onClose();
  };

  const handleApply = () => {
    if (selectedId === 'blank') {
      applyBlankScene();
    } else {
      const tpl = PLACEHOLDER_TEMPLATES.find((t) => t.id === selectedId);
      if (tpl) applyTemplate(tpl);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-md editor-panel border border-[var(--editor-border)] rounded-2xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-[var(--editor-border)] flex items-start justify-between gap-3">
          <h2 className="text-base font-bold text-white leading-snug">
            Use Templates To Create
            <br />
            Project Faster
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full editor-panel-2 text-[var(--editor-text-2)] hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-4 pt-3 editor-scroll overflow-x-auto flex gap-2">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3.5 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors ${
                tab === t
                  ? 'editor-gradient text-white font-medium'
                  : 'editor-panel-2 text-[var(--editor-text-2)] hover:text-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="px-4 pt-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--editor-text-2)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Scenes"
              className="editor-input w-full pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--editor-accent)]"
            />
          </div>
        </div>

        {/* Category chips */}
        <div className="px-4 pt-3 editor-scroll overflow-x-auto flex gap-2">
          {CHIPS.map((c) => (
            <button
              key={c}
              onClick={() => setChip(c)}
              className={`px-3 py-1.5 rounded-lg text-[11px] whitespace-nowrap border transition-colors ${
                chip === c
                  ? 'border-[var(--editor-accent-2)] bg-[var(--editor-accent-2)]/15 text-[var(--editor-accent-2)]'
                  : 'border-[var(--editor-border)] text-[var(--editor-text-2)] hover:text-white'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto editor-scroll px-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            {/* Blank scene — always first & selected by default */}
            <SceneCard
              name="+ Blank Scene"
              selected={selectedId === 'blank'}
              onSelect={() => setSelectedId('blank')}
              blank
            />

            {/* Placeholder templates — TODO: replace with real scene thumbnails */}
            {filteredTemplates.map((tpl) => (
              <SceneCard
                key={tpl.id}
                name={tpl.name}
                meta={`${tpl.scenes} scene${tpl.scenes > 1 ? 's' : ''} · ${tpl.duration}s`}
                selected={selectedId === tpl.id}
                onSelect={() => setSelectedId(tpl.id)}
                placeholder
              />
            ))}
          </div>
        </div>

        {/* Sticky Apply button */}
        <div className="p-4 border-t border-[var(--editor-border)]">
          <button
            onClick={handleApply}
            className="w-full py-3.5 rounded-xl editor-gradient text-white font-semibold text-sm shadow-lg transition-transform active:scale-[0.98]"
          >
            <Check size={15} /> Apply Scene
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

interface SceneCardProps {
  name: string;
  meta?: string;
  selected: boolean;
  onSelect: () => void;
  blank?: boolean;
  placeholder?: boolean;
}

function SceneCard({ name, meta, selected, onSelect, blank, placeholder }: SceneCardProps) {
  return (
    <button
      onClick={onSelect}
      className={`relative rounded-2xl overflow-hidden border text-left transition-all ${
        selected
          ? 'border-[var(--editor-accent)] ring-2 ring-[var(--editor-accent)]/40'
          : 'border-[var(--editor-border)] hover:border-[var(--editor-accent)]/60'
      }`}
    >
      {/* Thumbnail */}
      <div className="aspect-video w-full flex items-center justify-center bg-gradient-to-br from-[#1E1E28] to-[#16161C]">
        {blank ? (
          <span className="text-4xl text-[var(--editor-accent)]"><Plus size={20} /></span>
        ) : (
          <span className="text-4xl opacity-80">{placeholder ? '🎬' : '🖼️'}</span>
        )}
      </div>

      {/* Checkmark when selected */}
      {selected && (
        <span className="absolute top-2 right-2 w-5 h-5 rounded-full editor-gradient flex items-center justify-center text-white text-[10px]">
          ✓
        </span>
      )}

      <div className="px-2.5 py-2">
        <p className="text-xs font-medium text-white truncate">{name}</p>
        {meta && <p className="text-[10px] text-[var(--editor-text-2)] mt-0.5">{meta}</p>}
      </div>
    </button>
  );
}
