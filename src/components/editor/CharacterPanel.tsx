'use client';

// ============================================================================
// CharacterPanel — bottom sheet opened from the editor's "Character" tab.
// Shows the character library + 4 placeholder slots for future assets.
//
// TODO: replace the 4 placeholder character slots below with real character
// assets once they are added (see PLACEHOLDER_CHARACTERS array).
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { useProjectStore } from '@/store/project-store';
import { useAuthStore } from '@/store/auth-store';
import { getPublicCharacters, getCloudLibrary } from '@/lib/editor/characterLibrary';
import type { LibraryCharacter } from '@/lib/editor/characterLibrary';
import { Search, X, Sparkles, Star, Heart, Clock, Pencil, User, Image as ImageIcon } from 'lucide-react';
import { useRecent, useFavorites, toggleFavorite, isFavorite, recordRecent, type AssetRef } from '@/lib/editor/useEditorUI';

// ---------------------------------------------------------------------------
// Placeholder characters — real assets will replace these.
// Structure matches how the library cards render (name + optional image).
// ---------------------------------------------------------------------------
// TODO: replace with real character assets
const PLACEHOLDER_CHARACTERS: { id: string; name: string; imageUrl?: string }[] = [
  { id: 'ph-1', name: 'New Character 1' },
  { id: 'ph-2', name: 'New Character 2' },
  { id: 'ph-3', name: 'New Character 3' },
  { id: 'ph-4', name: 'New Character 4' },
];

const CATEGORIES = ['All', 'Desi', 'Western', 'Village', 'Animals', 'Vehicles', 'Latest'];

type Pose = 'FRONT' | '3/4 FRONT' | '3/4 BACK';
const POSES: Pose[] = ['FRONT', '3/4 FRONT', '3/4 BACK'];

interface CharacterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate?: () => void;
}

export function CharacterPanel({ isOpen, onClose, onCreate }: CharacterPanelProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [libraryItems, setLibraryItems] = useState<LibraryCharacter[]>([]);
  const [poses, setPoses] = useState<Record<string, Pose>>({});
  const [loading, setLoading] = useState(false);
  const recent = useRecent();
  const favorites = useFavorites();

  const { addCanvasObject, addClip, tracks, currentSceneId } = useEditorStore();
  const { currentProject } = useProjectStore();
  const { user } = useAuthStore();

  // Load real characters (public folder + cloud library)
  const loadLibrary = useCallback(async () => {
    setLoading(true);
    try {
      const [publicChars, cloudChars] = await Promise.all([
        getPublicCharacters(),
        user?.uid ? getCloudLibrary(user.uid) : Promise.resolve([]),
      ]);
      setLibraryItems([...publicChars, ...cloudChars]);
    } catch {
      // ignore — placeholders remain
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (isOpen) void loadLibrary();
  }, [isOpen, loadLibrary]);

  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      setCategory('All');
    }
  }, [isOpen]);

  const addCharacterToCanvas = (name: string, imageUrl?: string) => {
    const track = tracks.find((t) => t.sceneId === currentSceneId && t.type === 'character');
    if (!track) return;

    const assetId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `ch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const p = currentProject;
    const pw = p?.width || 1080;
    const ph = p?.height || 1920;

    addCanvasObject({
      type: 'character',
      x: pw / 2 - 110,
      y: ph * 0.55 - 160,
      width: 220,
      height: 320,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      zIndex: 10,
      assetId,
      name,
      characterType: 'custom',
      ...(imageUrl ? { imageUrl } : {}),
      expression: 'neutral',
      action: 'idle',
    });
    addClip(track.id, assetId, 0, 3000);
    recordRecent({ kind: 'character', id: assetId, name, url: imageUrl } as AssetRef);
    onClose();
  };

  const quickAddRecent = (item: AssetRef) => addCharacterToCanvas(item.name, item.url);

  const filtered = libraryItems.filter(
    (c) => category === 'All' || c.name.toLowerCase().includes(category.toLowerCase())
  );
  const searched = filtered.filter((c) =>
    c.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Bottom Sheet */}
      <div
        className="relative editor-panel border-t border-[var(--editor-border)] rounded-t-3xl shadow-2xl max-h-[78vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grab handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[#33333F]" />
        </div>

        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-[var(--editor-border)]">
          <h2 className="text-lg font-bold text-white">Characters</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={onCreate}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full editor-gradient text-white text-xs font-medium"
              title="Create character (AI)"
            >
              <Sparkles size={13} /> Create
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full editor-panel-2 text-[var(--editor-text-2)] hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 pt-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--editor-text-2)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Characters"
              className="editor-input w-full pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--editor-accent)]"
            />
          </div>
        </div>

        {/* Category chips */}
        <div className="px-4 pt-3 editor-scroll overflow-x-auto flex gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3.5 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors ${
                category === cat
                  ? 'editor-gradient text-white font-medium'
                  : 'editor-panel-2 text-[var(--editor-text-2)] hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Favorites + Recently used */}
        {(favorites.length > 0 || recent.length > 0) && (
          <div className="px-4 pt-3 space-y-3">
            {favorites.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[var(--editor-text-2)] mb-1.5 flex items-center gap-1">
                  <Heart size={11} className="text-[var(--editor-accent-2)]" /> Favorites
                </p>
                <div className="flex gap-2 overflow-x-auto editor-scroll">
                  {favorites.slice(0, 8).map((f) => (
                    <button
                      key={f.kind + f.id}
                      onClick={() => quickAddRecent(f)}
                      className="shrink-0 w-14 flex flex-col items-center gap-1"
                      title={f.name}
                    >
                      {f.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={f.url} alt={f.name} className="w-12 h-14 object-contain rounded-lg bg-[var(--editor-panel-2)]" />
                      ) : (
                        <span className="w-12 h-14 rounded-lg editor-gradient flex items-center justify-center text-white text-[9px] font-bold">{f.name.slice(0, 2)}</span>
                      )}
                      <span className="text-[8px] text-[var(--editor-text-2)] truncate w-full text-center">{f.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {recent.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[var(--editor-text-2)] mb-1.5 flex items-center gap-1">
                  <Clock size={11} /> Recently Used
                </p>
                <div className="flex gap-2 overflow-x-auto editor-scroll">
                  {recent.slice(0, 8).map((r) => (
                    <button
                      key={r.kind + r.id}
                      onClick={() => quickAddRecent(r)}
                      className="shrink-0 w-14 flex flex-col items-center gap-1"
                      title={r.name}
                    >
                      {r.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.url} alt={r.name} className="w-12 h-14 object-contain rounded-lg bg-[var(--editor-panel-2)]" />
                      ) : (
                        <span className="w-12 h-14 rounded-lg bg-[var(--editor-panel-2)] flex items-center justify-center text-white text-[9px] font-bold">{r.name.slice(0, 2)}</span>
                      )}
                      <span className="text-[8px] text-[var(--editor-text-2)] truncate w-full text-center">{r.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Grid */}
        <div className="flex-1 overflow-y-auto editor-scroll px-4 py-4">
          {loading && libraryItems.length === 0 && (
            <p className="text-center text-xs text-[var(--editor-text-2)] py-6">Loading…</p>
          )}

          <div className="grid grid-cols-2 gap-3">
            {/* Real characters */}
            {searched.map((item) => (
              <CharacterCard
                key={item.id}
                name={item.name}
                imageUrl={item.imageUrl}
                pose={poses[item.id] || 'FRONT'}
                onPose={(p) => setPoses((prev) => ({ ...prev, [item.id]: p }))}
                onAdd={() => addCharacterToCanvas(item.name, item.imageUrl)}
              />
            ))}

            {/* Placeholder slots — TODO: replace with real character assets */}
            {PLACEHOLDER_CHARACTERS.map((ph) => (
              <CharacterCard
                key={ph.id}
                name={ph.name}
                imageUrl={ph.imageUrl}
                placeholder
                pose={poses[ph.id] || 'FRONT'}
                onPose={(p) => setPoses((prev) => ({ ...prev, [ph.id]: p }))}
                onAdd={() => addCharacterToCanvas(ph.name)}
              />
            ))}
          </div>

          <p className="text-center text-[10px] text-[var(--editor-text-2)] mt-4">
            আরও character আসছে — লাইব্রেরিতে যোগ করা হলে এখানে দেখা যাবে
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

interface CharacterCardProps {
  name: string;
  imageUrl?: string;
  placeholder?: boolean;
  pose: Pose;
  onPose: (p: Pose) => void;
  onAdd: () => void;
}

function CharacterCard({ name, imageUrl, placeholder, pose, onPose, onAdd }: CharacterCardProps) {
  const [fav, setFav] = useState(() => (placeholder ? false : isFavorite({ kind: 'character', id: name + (imageUrl || ''), name })));
  const toggle = () => {
    if (placeholder) return;
    setFav(toggleFavorite({ kind: 'character', id: name + (imageUrl || ''), name, url: imageUrl }));
  };
  return (
    <div
      className={`rounded-2xl overflow-hidden editor-panel-2 border transition-all ${
        placeholder
          ? 'border-dashed border-[#33333F] opacity-80'
          : 'border-[var(--editor-border)] hover:border-[var(--editor-accent)]'
      }`}
    >
      {/* Thumbnail */}
      <button onClick={onAdd} className="w-full aspect-[3/4] relative block">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={name} className="w-full h-full object-contain p-2" loading="lazy" />
        ) : (
          <div
            className={`w-full h-full flex flex-col items-center justify-center gap-1 ${
              placeholder
                ? 'bg-[repeating-linear-gradient(45deg,#1E1E28,#1E1E28_6px,#23232F_6px,#23232F_12px)]'
                : 'bg-gradient-to-br from-[#1E1E28] to-[#16161C]'
            }`}
          >
            {placeholder ? (
              <>
                <User size={26} className="text-[var(--editor-text-2)]" />
                <span className="text-[9px] text-[var(--editor-text-2)]">coming soon</span>
              </>
            ) : (
              <ImageIcon size={26} className="text-[var(--editor-text-2)]" />
            )}
          </div>
        )}

        {/* Edit pill */}
        <span className="absolute top-2 right-2 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur text-white text-[10px] font-medium flex items-center gap-1">
          <Pencil size={9} /> Edit
        </span>

        {/* Favorite star */}
        {!placeholder && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              toggle();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.stopPropagation();
                toggle();
              }
            }}
            className={`absolute top-2 left-2 w-6 h-6 rounded-full bg-black/60 backdrop-blur flex items-center justify-center transition-colors ${
              fav ? 'text-yellow-300' : 'text-[var(--editor-text-2)] hover:text-white'
            }`}
            title={fav ? 'Remove favorite' : 'Add to favorites'}
          >
            <Star size={12} fill={fav ? 'currentColor' : 'none'} />
          </span>
        )}
      </button>

      {/* Name */}
      <div className="px-2.5 pt-2">
        <p className="text-xs font-medium text-white truncate">{name}</p>
      </div>

      {/* Pose labels */}
      <div className="px-2 pb-2.5 pt-1.5 flex gap-1">
        {POSES.map((p) => (
          <button
            key={p}
            onClick={() => onPose(p)}
            className={`flex-1 py-1 rounded-md text-[8px] font-semibold tracking-tight transition-colors ${
              pose === p
                ? 'editor-gradient text-white'
                : 'editor-panel-3 text-[var(--editor-text-2)] hover:text-white'
            }`}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
