'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { useProjectStore } from '@/store/project-store';
import { useAuthStore } from '@/store/auth-store';
import { v4 as uuidv4 } from 'uuid';
import {
  getPublicCharacters,
  getCloudLibrary,
  addToLibrary,
  removeFromLibrary,
  type LibraryCharacter,
} from '@/lib/editor/characterLibrary';
import { SOUND_LIBRARY, previewSound, renderSound } from '@/lib/editor/soundKit';
import { CHARACTER_LIBRARY_15, CHARACTER_CATEGORIES, type OfficialCharacter } from '@/lib/editor/characterLibrary15';
import {
  Mic, Home, Building2, School, Store, BedDouble, TreePine, Waves, Tractor, Route,
  Armchair, Table as TableIcon, Smartphone, BookOpen, ShoppingBag, Car, UtensilsCrossed,
  Gift, Circle, Meh, Smile, Frown, Angry, AlertTriangle, AlertCircle, Laugh, Droplets,
  Brain, Moon, Music, Image as ImageIcon, Mountain, BookMarked,
} from 'lucide-react';
import { drawSceneContent } from '@/lib/editor/renderer';
import type { CanvasObject } from '@/types/animation';
import type {
  CharacterType,
  BackgroundCategory,
  CharacterExpression,
  Character,
  Background,
  Prop,
  AudioClip,
} from '@/types/animation';

export type AssetTab = 'characters' | 'backgrounds' | 'props' | 'text' | 'audio';

// Official 15-character library (from the uploaded reference sheet)
const builtInCharacters: OfficialCharacter[] = CHARACTER_LIBRARY_15;

// extra creatures (kept compact)
const extraCreatures: { type: CharacterType; name: string }[] = [
  { type: 'boy', name: 'Boy' },
  { type: 'girl', name: 'Girl' },
  { type: 'chef', name: 'Chef' },
  { type: 'soldier', name: 'Soldier' },
  { type: 'princess', name: 'Princess' },
  { type: 'king', name: 'King' },
  { type: 'astronaut', name: 'Astronaut' },
  { type: 'dog', name: 'Dog' },
  { type: 'cat', name: 'Cat' },
  { type: 'fox', name: 'Fox' },
  { type: 'rabbit', name: 'Rabbit' },
  { type: 'lion', name: 'Lion' },
  { type: 'tiger', name: 'Tiger' },
  { type: 'elephant', name: 'Elephant' },
  { type: 'horse', name: 'Horse' },
  { type: 'sheep', name: 'Sheep' },
  { type: 'monkey', name: 'Monkey' },
  { type: 'duck', name: 'Duck' },
  { type: 'bird', name: 'Bird' },
  { type: 'cow', name: 'Cow' },
  { type: 'goat', name: 'Goat' },
];

const builtInBackgrounds: { category: BackgroundCategory; name: string }[] = [
  { category: 'village', name: 'Village' },
  { category: 'city', name: 'City' },
  { category: 'school', name: 'School' },
  { category: 'market', name: 'Market' },
  { category: 'house', name: 'House' },
  { category: 'bedroom', name: 'Bedroom' },
  { category: 'park', name: 'Park' },
  { category: 'river', name: 'River' },
  { category: 'farm', name: 'Farm' },
  { category: 'road', name: 'Road' },
  { category: 'office', name: 'Office' },
  { category: 'forest', name: 'Forest' },
  { category: 'beach', name: 'Beach' },
  { category: 'mountain', name: 'Mountain' },
];

const builtInProps = [
  { name: 'Chair', icon: '🪑' },
  { name: 'Table', icon: '🪵' },
  { name: 'Phone', icon: '📱' },
  { name: 'Book', icon: '📚' },
  { name: 'Bag', icon: '👜' },
  { name: 'Car', icon: '🚗' },
  { name: 'Tree', icon: '🌳' },
  { name: 'Food', icon: '🍔' },
  { name: 'Gift', icon: '🎁' },
  { name: 'Ball', icon: '⚽' },
];

const expressions: CharacterExpression[] = [
  'neutral', 'happy', 'sad', 'angry', 'scared',
  'surprised', 'laughing', 'crying', 'thinking', 'sleepy',
];

const BG_ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Village: Home,
  City: Building2,
  School: School,
  Market: Store,
  House: Home,
  Bedroom: BedDouble,
  Park: TreePine,
  River: Waves,
  Farm: Tractor,
  Road: Route,
  Office: Building2,
  Forest: TreePine,
  Beach: Waves,
  Mountain: Mountain,
};

const PROP_ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Chair: Armchair,
  Table: TableIcon,
  Phone: Smartphone,
  Book: BookOpen,
  Bag: ShoppingBag,
  Car: Car,
  Tree: TreePine,
  Food: UtensilsCrossed,
  Gift: Gift,
  Ball: Circle,
};

const EXPR_ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  neutral: Meh,
  happy: Smile,
  sad: Frown,
  angry: Angry,
  scared: AlertTriangle,
  surprised: AlertCircle,
  laughing: Laugh,
  crying: Droplets,
  thinking: Brain,
  sleepy: Moon,
};

/** Renders a real procedural character illustration on a mini canvas (no emoji). */
function CharacterThumb({ type, className = '' }: { type: string; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const w = c.width;
    const h = c.height;
    ctx.clearRect(0, 0, w, h);
    const o: CanvasObject = {
      id: 'thumb',
      type: 'character',
      x: 2,
      y: 2,
      width: w - 4,
      height: h - 4,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      zIndex: 1,
      characterType: type as CanvasObject['characterType'],
      expression: 'neutral',
      action: 'idle',
    };
    drawSceneContent(ctx, [o], {
      id: 't', projectId: '', name: 't', order: 0, duration: 5000, backgroundColor: 'transparent',
      cameraSettings: { x: 0, y: 0, zoom: 1, rotation: 0, keyframes: [] },
      transition: { type: 'none', duration: 0 },
    }, 0, 0, w, h, { playback: false });
  }, [type]);
  return <canvas ref={ref} width={56} height={68} className={`${className} object-contain`} />;
}

interface AssetPanelProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: AssetTab;
  onRecordVoice?: () => void;
}

type UploadKind = 'character' | 'background' | 'prop' | 'audio';

export function AssetPanel({ isOpen, onClose, initialTab, onRecordVoice }: AssetPanelProps) {
  const [activeTab, setActiveTab] = useState<AssetTab>('characters');
  const [textContent, setTextContent] = useState('');
  const [charCategory, setCharCategory] = useState<string>('All');
  const [textSize, setTextSize] = useState(48);
  const [textColor, setTextColor] = useState('#111827');
  const [textWeight, setTextWeight] = useState<'normal' | 'bold'>('normal');
  const [uploading, setUploading] = useState<UploadKind | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Character library (cloud + public folder)
  const [libraryItems, setLibraryItems] = useState<LibraryCharacter[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryUploading, setLibraryUploading] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [sfxBusy, setSfxBusy] = useState<string | null>(null);

  const characterInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const propInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const {
    addCanvasObject,
    addClip,
    addTrack,
    tracks,
    currentSceneId,
    canvasObjects,
    selectedObjectId,
    updateCanvasObject,
    setObjectExpression,
    characters,
    backgrounds,
    props,
    addCharacter,
    addBackground,
    addProp,
    addAudioClip,
    currentTime,
  } = useEditorStore();

  const { currentProject } = useProjectStore();
  const { user } = useAuthStore();

  const selectedObject = canvasObjects.find((o) => o.id === selectedObjectId) || null;

  // Sync tab when the parent asks for a specific one
  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  // Load character library (public folder + user's cloud library)
  const loadLibrary = useCallback(async () => {
    setLibraryLoading(true);
    setLibraryError(null);
    try {
      const [publicChars, cloudChars] = await Promise.all([
        getPublicCharacters(),
        user?.uid ? getCloudLibrary(user.uid) : Promise.resolve([]),
      ]);
      setLibraryItems([...publicChars, ...cloudChars]);
    } catch (err) {
      setLibraryError(err instanceof Error ? err.message : 'Library failed to load');
    } finally {
      setLibraryLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (isOpen) void loadLibrary();
  }, [isOpen, loadLibrary]);

  const handleAddToLibrary = async (file: File) => {
    if (!user?.uid) {
      setLibraryError('লগইন করা লাগবে — Library আপনার অ্যাকাউন্টে সেভ হয়।');
      return;
    }
    setLibraryUploading(true);
    setLibraryError(null);
    try {
      const name = file.name.replace(/\.[^.]+$/, '') || 'Character';
      await addToLibrary(user.uid, file, name);
      await loadLibrary();
    } catch (err) {
      setLibraryError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setLibraryUploading(false);
    }
  };

  const handleAddSound = async (id: string, name: string) => {
    setSfxBusy(id);
    try {
      const blob = await renderSound(id);
      const audioId = uuidv4();
      const url = URL.createObjectURL(blob);
      const track = findTrack('music');
      const clip: AudioClip = {
        id: audioId,
        projectId: currentProject?.id || '',
        name,
        type: 'music',
        fileUrl: url,
        duration: 1000,
      };
      addAudioClip(clip);
      if (track) addClip(track.id, audioId, currentTime ?? 0, 1000);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Sound failed to add');
    } finally {
      setSfxBusy(null);
    }
  };

  const handleRemoveFromLibrary = async (item: LibraryCharacter) => {
    if (!user?.uid) return;
    setLibraryError(null);
    try {
      await removeFromLibrary(user.uid, item);
      setConfirmDeleteId(null);
      await loadLibrary();
    } catch (err) {
      setLibraryError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const findTrack = useCallback(
    (type: string) => tracks.find((t) => t.sceneId === currentSceneId && t.type === type),
    [tracks, currentSceneId]
  );

  const defaultSizeFor = useCallback(
    (type: string): { width: number; height: number; zIndex: number } => {
      const p = currentProject;
      switch (type) {
        case 'background':
          return { width: p?.width || 1080, height: p?.height || 1920, zIndex: 0 };
        case 'character':
          return { width: 220, height: 320, zIndex: 10 };
        case 'prop':
          return { width: 160, height: 160, zIndex: 5 };
        default:
          return { width: 300, height: 60, zIndex: 20 };
      }
    },
    [currentProject]
  );

  const spawnObject = useCallback(
    (kind: 'character' | 'background' | 'prop' | 'text', extra: Record<string, unknown>) => {
      const trackType =
        kind === 'character' ? 'character' : kind === 'background' ? 'background' : kind === 'prop' ? 'prop' : 'text';

      // PROFESSIONAL LAYERS: each new character gets its OWN layer row
      // (Character 1 / Character 2 / …) instead of sharing one giant track.
      let track: ReturnType<typeof findTrack> | null = findTrack(trackType);
      if (kind === 'character') {
        const charName = (extra.name as string) || 'Character';
        track = addTrack('character', charName);
      }
      if (!track) return;

      const assetId = uuidv4();
      const size = defaultSizeFor(trackType);
      const projectW = currentProject?.width || 1080;
      const projectH = currentProject?.height || 1920;

      addCanvasObject({
        type: trackType,
        x: (projectW - size.width) / 2 + (Math.random() - 0.5) * 60,
        y: kind === 'background' ? 0 : projectH * 0.55 - size.height / 2 + (Math.random() - 0.5) * 40,
        width: size.width,
        height: size.height,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        opacity: 1,
        zIndex: size.zIndex,
        assetId,
        ...extra,
      });

      // CRITICAL: new clips start EXACTLY at the playhead (currentTime)
      const start = currentTime ?? 0;
      addClip(track.id, assetId, start, trackType === 'background' ? 5000 : 3000);
    },
    [addCanvasObject, addClip, addTrack, findTrack, currentProject, defaultSizeFor, currentTime]
  );

  const handleAddCharacter = (char: OfficialCharacter | { type: CharacterType; name: string }) => {
    const official = 'default' in char ? char : undefined;
    spawnObject('character', {
      characterType: char.type,
      name: char.name,
      expression: official?.default.expression || 'neutral',
      action: official?.default.action || 'idle',
      ...(official ? { width: official.size.w, height: official.size.h } : {}),
    });
    onClose();
  };

  const handleAddBackground = (bg: { name: string }) => {
    spawnObject('background', { name: bg.name });
    onClose();
  };

  const handleAddProp = (prop: { name: string }) => {
    spawnObject('prop', { name: prop.name });
    onClose();
  };

  const handleAddText = () => {
    if (!textContent.trim()) return;
    spawnObject('text', {
      content: textContent,
      name: 'Text',
      fontSize: textSize,
      fontColor: textColor,
      fontWeight: textWeight,
    });
    setTextContent('');
    onClose();
  };

  // -------------------------------------------------------------------------
  // Custom uploads via /api/upload (Cloudinary)
  // -------------------------------------------------------------------------

  const uploadFile = async (file: File, kind: UploadKind) => {
    setUploading(kind);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Upload failed');
      }

      const assetId = uuidv4();
      const projectId = currentProject?.id || '';

      if (kind === 'character') {
        const char: Character = {
          id: assetId,
          projectId,
          name: file.name.replace(/\.[^.]+$/, ''),
          type: 'custom',
          imageUrl: data.url,
          isCustom: true,
          defaultExpression: 'neutral',
          defaultAction: 'idle',
        };
        addCharacter(char);
        spawnObject('character', {
          characterType: 'custom',
          name: char.name,
          imageUrl: data.url,
          expression: 'neutral',
          action: 'idle',
        });
      } else if (kind === 'background') {
        const bg: Background = {
          id: assetId,
          projectId,
          name: file.name.replace(/\.[^.]+$/, ''),
          category: 'custom',
          imageUrl: data.url,
          isCustom: true,
        };
        addBackground(bg);
        spawnObject('background', { name: bg.name, imageUrl: data.url });
      } else if (kind === 'prop') {
        const prop: Prop = {
          id: assetId,
          projectId,
          name: file.name.replace(/\.[^.]+$/, ''),
          category: 'custom',
          imageUrl: data.url,
          isCustom: true,
        };
        addProp(prop);
        spawnObject('prop', { name: prop.name, imageUrl: data.url });
      } else {
        // audio
        const track = findTrack('voice');
        const clip: AudioClip = {
          id: assetId,
          projectId,
          name: file.name.replace(/\.[^.]+$/, ''),
          type: 'voice',
          fileUrl: data.url,
          duration: 0,
        };
        addAudioClip(clip);
        if (track) addClip(track.id, assetId, currentTime ?? 0, 3000);
      }
      onClose();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(null);
    }
  };

  const triggerUpload = (kind: UploadKind) => {
    const ref =
      kind === 'character'
        ? characterInputRef
        : kind === 'background'
        ? backgroundInputRef
        : kind === 'prop'
        ? propInputRef
        : audioInputRef;
    ref.current?.click();
  };

  const customCharacters = characters.filter((c) => c.isCustom);
  const customBackgrounds = backgrounds.filter((b) => b.isCustom);
  const customProps = props.filter((p) => p.isCustom);

  if (!isOpen) return null;

  const tabClass = (tab: AssetTab) =>
    `flex-1 py-2 text-sm capitalize transition-colors ${
      activeTab === tab
        ? 'border-b-2 border-blue-600 text-blue-600 font-medium'
        : 'text-gray-500 hover:text-gray-700'
    }`;

  const uploadButton = (kind: UploadKind, label: string, inputRef: React.RefObject<HTMLInputElement | null>, accept: string) => (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) uploadFile(file, kind);
          e.target.value = '';
        }}
      />
      <button
        onClick={() => triggerUpload(kind)}
        disabled={uploading !== null}
        className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-blue-500 hover:text-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {uploading === kind ? (
          <>
            <span className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent" />
            Uploading...
          </>
        ) : (
          <>+ {label}</>
        )}
      </button>
    </>
  );

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      {/* Backdrop */}
      <div className="flex-1 bg-black/50" />

      {/* Panel */}
      <div
        className="w-80 editor-panel h-full shadow-xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Assets</h2>
          <button onClick={onClose} className="text-[var(--editor-text-2)] hover:text-white p-1">
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {(['characters', 'backgrounds', 'props', 'text', 'audio'] as AssetTab[]).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={tabClass(tab)}>
              {tab}
            </button>
          ))}
        </div>

        {uploadError && (
          <div className="mx-4 mt-3 px-3 py-2 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg">
            {uploadError}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'characters' && (
            <div className="space-y-4">
              {/* Character Library (cloud PNGs + public folder) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-700 flex items-center gap-1.5"><BookMarked size={14} className="text-[var(--editor-accent)]" /> Character Library</h3>
                  <button
                    onClick={() => libraryInputRef.current?.click()}
                    disabled={libraryUploading}
                    className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-1"
                  >
                    {libraryUploading ? (
                      <span className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent" />
                    ) : (
                      '+'
                    )}
                    Add PNG
                  </button>
                </div>
                <input
                  ref={libraryInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleAddToLibrary(file);
                    e.target.value = '';
                  }}
                />

                {libraryError && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5 mb-2">
                    {libraryError}
                  </p>
                )}

                {libraryLoading ? (
                  <p className="text-xs text-gray-400 py-2">Loading library…</p>
                ) : libraryItems.length === 0 ? (
                  <p className="text-xs text-gray-400 py-2">
                    এখনো কোনো character নেই। PNG যোগ করতে &quot;+ Add PNG&quot; চাপো — আপনার ক্লাউড স্টোরেজে সেভ হবে।
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {libraryItems.map((item) => (
                      <div key={item.id} className="relative group">
                        <button
                          onClick={() => {
                            spawnObject('character', {
                              characterType: 'custom',
                              name: item.name,
                              imageUrl: item.imageUrl,
                              expression: 'neutral',
                              action: 'idle',
                            });
                            onClose();
                          }}
                          className="w-full p-2 bg-gray-50 rounded-xl hover:bg-blue-50 hover:ring-2 hover:ring-blue-200 transition-all flex flex-col items-center"
                          title={`${item.name} — click to add`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-14 h-16 object-contain mb-1 rounded"
                            loading="lazy"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.visibility = 'hidden';
                            }}
                          />
                          <span className="text-[10px] text-gray-600 truncate w-full text-center">
                            {item.name}
                          </span>
                        </button>
                        {item.source === 'cloud' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteId(item.id);
                            }}
                            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Remove from library"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {!user?.uid && (
                  <p className="text-[10px] text-amber-600 mt-1">
                    Cloud library-এর জন্য লগইন লাগবে। অথবা public folder থেকে character আসে।
                  </p>
                )}

                {/* Delete confirm */}
                {confirmDeleteId && (
                  <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40">
                    <div className="bg-white rounded-xl p-4 max-w-xs w-full shadow-xl">
                      <h4 className="font-semibold text-sm mb-2">Remove this character?</h4>
                      <p className="text-xs text-gray-500 mb-4">
                        এটি আপনার ক্লাউড লাইব্রেরি থেকে মুছে যাবে।
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => {
                            const item = libraryItems.find((i) => i.id === confirmDeleteId);
                            if (item) void handleRemoveFromLibrary(item);
                            else setConfirmDeleteId(null);
                          }}
                          className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t">
                <h3 className="text-sm font-medium text-gray-700 mb-2">🎬 Character Library</h3>
                {/* category chips */}
                <div className="flex gap-1.5 mb-2 overflow-x-auto editor-scroll">
                  {CHARACTER_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setCharCategory(cat.id)}
                      className={`px-2.5 py-1 rounded-full text-[10px] whitespace-nowrap transition-colors ${
                        charCategory === cat.id
                          ? 'editor-gradient text-white font-medium'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {builtInCharacters
                    .filter((c) => charCategory === 'All' || c.category === charCategory)
                    .map((char) => (
                      <button
                        key={char.id}
                        onClick={() => handleAddCharacter(char)}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/animatex-character', JSON.stringify({ name: char.name, type: char.type }));
                          e.dataTransfer.effectAllowed = 'copy';
                        }}
                        className="p-2 bg-gray-50 rounded-xl hover:bg-blue-50 hover:ring-2 hover:ring-blue-200 transition-all flex flex-col items-center"
                        title={`${char.name} · ${char.category} — adds at playhead, drag to timeline`}
                      >
                        <CharacterThumb type={char.type} className="mb-1" />
                        <span className="text-[11px] text-gray-600 truncate w-full text-center">{char.name}</span>
                        <span className="text-[8px] text-gray-400">{char.category}</span>
                      </button>
                    ))}
                </div>
                {/* extra creatures */}
                <details className="mt-2">
                  <summary className="text-[10px] text-gray-400 cursor-pointer hover:text-gray-600">More creatures…</summary>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {extraCreatures.map((char) => (
                      <button
                        key={char.type}
                        onClick={() => handleAddCharacter(char)}
                        className="p-2 bg-gray-50 rounded-xl hover:bg-blue-50 transition-all flex flex-col items-center"
                      >
                        <CharacterThumb type={char.type} className="mb-1" />
                        <span className="text-[10px] text-gray-600 truncate w-full text-center">{char.name}</span>
                      </button>
                    ))}
                  </div>
                </details>
              </div>

              {customCharacters.length > 0 && (
                <>
                  <div className="pt-4 border-t">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">My Characters</h3>
                    <div className="grid grid-cols-3 gap-2">
                      {customCharacters.map((c) => (
                        <button
                          key={c.id}
                          onClick={() =>
                            spawnObject('character', {
                              characterType: 'custom',
                              name: c.name,
                              imageUrl: c.imageUrl,
                              expression: 'neutral',
                              action: 'idle',
                            })
                          }
                          className="p-2 bg-gray-50 rounded-xl hover:bg-blue-50 hover:ring-2 hover:ring-blue-200 transition-all flex flex-col items-center"
                        >
                          <ImageIcon size={20} className="mb-1 text-gray-400" />
                          <span className="text-xs text-gray-600 truncate w-full text-center">{c.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Expressions now control the SELECTED object */}
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-700">Expressions</h3>
                  {!selectedObject && (
                    <span className="text-[10px] text-amber-600">select an object first</span>
                  )}
                </div>
                {selectedObject ? (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {expressions.map((expr) => (
                      <button
                        key={expr}
                        onClick={() => setObjectExpression(selectedObject.id, expr)}
                        className={`px-2 py-1 rounded-lg text-xs capitalize transition-colors border flex items-center gap-1 ${
                          selectedObject.expression === expr
                            ? 'bg-pink-500 text-white border-pink-600'
                            : 'bg-pink-50 text-pink-700 border-pink-100 hover:bg-pink-100'
                        }`}
                      >
                        {(() => {
                          const ExprIcon = EXPR_ICON_MAP[expr] || Meh;
                          return <ExprIcon size={12} />;
                        })()}
                        {expr}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 mt-1">
                    Click an object on the canvas to apply expressions.
                  </p>
                )}
              </div>

              <div className="pt-4 border-t">
                {uploadButton('character', 'Upload Custom Character', characterInputRef, 'image/*')}
              </div>
            </div>
          )}

          {activeTab === 'backgrounds' && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-700">Built-in Backgrounds</h3>
              <div className="grid grid-cols-2 gap-2">
                {builtInBackgrounds.map((bg) => {
                  const BgIcon = BG_ICON_MAP[bg.name] || ImageIcon;
                  return (
                    <button
                      key={bg.category}
                      onClick={() => handleAddBackground(bg)}
                      className="p-4 bg-gray-50 rounded-xl hover:bg-blue-50 hover:ring-2 hover:ring-blue-200 transition-all flex flex-col items-center"
                    >
                      <BgIcon size={26} className="mb-2 text-[var(--editor-accent)]" />
                      <span className="text-sm text-gray-600">{bg.name}</span>
                    </button>
                  );
                })}
              </div>

              {customBackgrounds.length > 0 && (
                <div className="pt-4 border-t">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">My Backgrounds</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {customBackgrounds.map((b) => (
                      <button
                        key={b.id}
                        onClick={() => spawnObject('background', { name: b.name, imageUrl: b.imageUrl })}
                        className="p-2 bg-gray-50 rounded-xl hover:bg-blue-50 hover:ring-2 hover:ring-blue-200 transition-all flex flex-col items-center"
                      >
                        <ImageIcon size={20} className="mb-1 text-gray-400" />
                        <span className="text-xs text-gray-600 truncate w-full text-center">{b.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t">
                {uploadButton('background', 'Upload Custom Background', backgroundInputRef, 'image/*')}
              </div>
            </div>
          )}

          {activeTab === 'props' && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-700">Built-in Props</h3>
              <div className="grid grid-cols-3 gap-2">
                {builtInProps.map((prop) => {
                  const PropIcon = PROP_ICON_MAP[prop.name] || ImageIcon;
                  return (
                    <button
                      key={prop.name}
                      onClick={() => handleAddProp(prop)}
                      className="p-3 bg-gray-50 rounded-xl hover:bg-blue-50 hover:ring-2 hover:ring-blue-200 transition-all flex flex-col items-center"
                    >
                      <PropIcon size={20} className="mb-1 text-[var(--editor-accent)]" />
                      <span className="text-xs text-gray-600">{prop.name}</span>
                    </button>
                  );
                })}
              </div>

              {customProps.length > 0 && (
                <div className="pt-4 border-t">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">My Props</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {customProps.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => spawnObject('prop', { name: p.name, imageUrl: p.imageUrl })}
                        className="p-2 bg-gray-50 rounded-xl hover:bg-blue-50 hover:ring-2 hover:ring-blue-200 transition-all flex flex-col items-center"
                      >
                        <ImageIcon size={20} className="mb-1 text-gray-400" />
                        <span className="text-xs text-gray-600 truncate w-full text-center">{p.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t">
                {uploadButton('prop', 'Upload Custom Prop', propInputRef, 'image/*')}
              </div>
            </div>
          )}

          {activeTab === 'text' && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-700">Add Text</h3>
              <p className="text-xs text-gray-500">Supports Bangla, English, and mixed text</p>

              <textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="আজকে আমরা village-এ যাবো!"
                className="w-full h-24 p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Font Size</label>
                  <input
                    type="range"
                    min="16"
                    max="160"
                    value={textSize}
                    onChange={(e) => setTextSize(parseInt(e.target.value, 10))}
                    className="w-full"
                  />
                  <span className="text-xs text-gray-500">{textSize}px</span>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={textColor}
                      onChange={(e) => setTextColor(e.target.value)}
                      className="w-10 h-8 rounded border border-gray-300 cursor-pointer"
                    />
                    <span className="text-xs text-gray-500">{textColor}</span>
                    <button
                      onClick={() => setTextWeight(textWeight === 'bold' ? 'normal' : 'bold')}
                      className={`px-2 py-1 rounded text-xs border ${
                        textWeight === 'bold'
                          ? 'bg-blue-600 text-white border-blue-700 font-bold'
                          : 'bg-gray-50 text-gray-600 border-gray-200'
                      }`}
                    >
                      B
                    </button>
                  </div>
                </div>
              </div>

              <button
                onClick={handleAddText}
                disabled={!textContent.trim()}
                className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Add Text
              </button>

              <div className="pt-4 border-t">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Quick Templates</h4>
                <div className="space-y-2">
                  {[
                    'Hello! 👋',
                    'আমি তোমাকে ভালোবাসি',
                    'What a beautiful day!',
                    'হ্যালো বন্ধু!',
                  ].map((template, i) => (
                    <button
                      key={i}
                      onClick={() => setTextContent(template)}
                      className="w-full py-2 px-3 text-left bg-gray-50 rounded-lg hover:bg-gray-100 text-sm"
                    >
                      {template}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'audio' && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-700">Voice Recording</h3>
              <button
                onClick={() => {
                  onRecordVoice?.();
                  onClose();
                }}
                className="w-full py-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-600 hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
              >
                <Mic size={18} />
                Record Voice
              </button>

              <div className="pt-4 border-t">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Upload Audio</h3>
                {uploadButton('audio', 'Upload MP3, WAV, M4A, OGG', audioInputRef, 'audio/*,.mp3,.wav,.m4a,.ogg')}
              </div>

              <div className="pt-4 border-t">
                <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5"><Music size={14} className="text-[var(--editor-accent)]" /> Sound Library (built-in)</h3>
                <p className="text-xs text-gray-500 mb-2">Preview বাজিয়ে পছন্দ হলে add করুন — Music track-এ যোগ হবে।</p>
                <div className="grid grid-cols-2 gap-2">
                  {SOUND_LIBRARY.map((item) => (
                    <div key={item.id} className="flex items-center gap-1.5">
                      <button
                        onClick={() => previewSound(item.id)}
                        className="w-8 h-8 shrink-0 rounded-lg bg-gray-100 hover:bg-blue-100 flex items-center justify-center"
                        title="Preview"
                      >
                        ▶
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-700 truncate">{item.name}</p>
                        <p className="text-[9px] text-gray-400">{item.category}</p>
                      </div>
                      <button
                        onClick={() => void handleAddSound(item.id, item.name)}
                        disabled={sfxBusy === item.id}
                        className="px-2 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] disabled:opacity-50"
                      >
                        {sfxBusy === item.id ? '…' : '+ Add'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Tip</h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Record or upload a voice line, then play the timeline to preview. Audio is added
                  to the Voice track automatically.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
