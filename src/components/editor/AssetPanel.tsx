'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { useProjectStore } from '@/store/project-store';
import { v4 as uuidv4 } from 'uuid';
import type {
  CharacterType,
  BackgroundCategory,
  CharacterExpression,
  CharacterAction,
  Character,
  Background,
  Prop,
  AudioClip,
} from '@/types/animation';

export type AssetTab = 'characters' | 'backgrounds' | 'props' | 'text' | 'audio';

const builtInCharacters: { type: CharacterType; name: string; icon: string }[] = [
  { type: 'boy', name: 'Boy', icon: '👦' },
  { type: 'girl', name: 'Girl', icon: '👧' },
  { type: 'child', name: 'Child', icon: '🧒' },
  { type: 'man', name: 'Man', icon: '👨' },
  { type: 'woman', name: 'Woman', icon: '👩' },
  { type: 'old-man', name: 'Old Man', icon: '👴' },
  { type: 'old-woman', name: 'Old Woman', icon: '👵' },
  { type: 'dog', name: 'Dog', icon: '🐕' },
  { type: 'cat', name: 'Cat', icon: '🐈' },
  { type: 'bird', name: 'Bird', icon: '🐦' },
  { type: 'cow', name: 'Cow', icon: '🐄' },
  { type: 'goat', name: 'Goat', icon: '🐐' },
];

const builtInBackgrounds: { category: BackgroundCategory; name: string; icon: string }[] = [
  { category: 'village', name: 'Village', icon: '🏘️' },
  { category: 'city', name: 'City', icon: '🌆' },
  { category: 'school', name: 'School', icon: '🏫' },
  { category: 'market', name: 'Market', icon: '🏪' },
  { category: 'house', name: 'House', icon: '🏠' },
  { category: 'bedroom', name: 'Bedroom', icon: '🛏️' },
  { category: 'park', name: 'Park', icon: '🏞️' },
  { category: 'river', name: 'River', icon: '🌊' },
  { category: 'farm', name: 'Farm', icon: '🌾' },
  { category: 'road', name: 'Road', icon: '🛣️' },
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

const actions: CharacterAction[] = [
  'idle', 'walk', 'run', 'jump', 'sit', 'stand',
  'wave', 'talk', 'point', 'clap', 'cry', 'laugh', 'dance', 'fall',
];

const EXPRESSION_ICONS: Record<string, string> = {
  neutral: '😐', happy: '😊', sad: '😢', angry: '😠', scared: '😨',
  surprised: '😲', laughing: '😂', crying: '😭', thinking: '🤔', sleepy: '😴',
};

const ACTION_ICONS: Record<string, string> = {
  idle: '🧍', walk: '🚶', run: '🏃', jump: '🤸', sit: '🧘', stand: '🧍',
  wave: '👋', talk: '🗣️', point: '👉', clap: '👏', cry: '😭', laugh: '😆', dance: '💃', fall: '🤕',
};

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
  const [textSize, setTextSize] = useState(48);
  const [textColor, setTextColor] = useState('#111827');
  const [textWeight, setTextWeight] = useState<'normal' | 'bold'>('normal');
  const [uploading, setUploading] = useState<UploadKind | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const characterInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const propInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const {
    addCanvasObject,
    addClip,
    tracks,
    currentSceneId,
    canvasObjects,
    selectedObjectId,
    updateCanvasObject,
    setObjectExpression,
    setObjectAction,
    characters,
    backgrounds,
    props,
    addCharacter,
    addBackground,
    addProp,
    addAudioClip,
  } = useEditorStore();

  const { currentProject } = useProjectStore();

  const selectedObject = canvasObjects.find((o) => o.id === selectedObjectId) || null;

  // Sync tab when the parent asks for a specific one
  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

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
      const track = findTrack(trackType);
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

      addClip(track.id, assetId, 0, trackType === 'background' ? 5000 : 3000);
    },
    [addCanvasObject, addClip, findTrack, currentProject, defaultSizeFor]
  );

  const handleAddCharacter = (char: { type: CharacterType; name: string }) => {
    spawnObject('character', {
      characterType: char.type,
      name: char.name,
      expression: 'neutral',
      action: 'idle',
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
        if (track) addClip(track.id, assetId, 0, 3000);
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
        className="w-80 bg-white h-full shadow-xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Assets</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 p-1">
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
              <h3 className="text-sm font-medium text-gray-700">Built-in Characters</h3>
              <div className="grid grid-cols-3 gap-2">
                {builtInCharacters.map((char) => (
                  <button
                    key={char.type}
                    onClick={() => handleAddCharacter(char)}
                    className="p-3 bg-gray-50 rounded-xl hover:bg-blue-50 hover:ring-2 hover:ring-blue-200 transition-all flex flex-col items-center"
                  >
                    <span className="text-2xl mb-1">{char.icon}</span>
                    <span className="text-xs text-gray-600">{char.name}</span>
                  </button>
                ))}
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
                          <span className="text-2xl mb-1">🖼️</span>
                          <span className="text-xs text-gray-600 truncate w-full text-center">{c.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Expressions & Actions now control the SELECTED object */}
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
                        className={`px-2 py-1 rounded-lg text-xs capitalize transition-colors border ${
                          selectedObject.expression === expr
                            ? 'bg-pink-500 text-white border-pink-600'
                            : 'bg-pink-50 text-pink-700 border-pink-100 hover:bg-pink-100'
                        }`}
                      >
                        {EXPRESSION_ICONS[expr] || ''} {expr}
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
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-700">Actions</h3>
                  {!selectedObject && (
                    <span className="text-[10px] text-amber-600">select an object first</span>
                  )}
                </div>
                {selectedObject ? (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {actions.map((action) => (
                      <button
                        key={action}
                        onClick={() => setObjectAction(selectedObject.id, action)}
                        className={`px-2 py-1 rounded-lg text-xs capitalize transition-colors border ${
                          selectedObject.action === action
                            ? 'bg-blue-600 text-white border-blue-700'
                            : 'bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100'
                        }`}
                      >
                        {ACTION_ICONS[action] || ''} {action}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 mt-1">
                    Click an object on the canvas to apply actions.
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
                {builtInBackgrounds.map((bg) => (
                  <button
                    key={bg.category}
                    onClick={() => handleAddBackground(bg)}
                    className="p-4 bg-gray-50 rounded-xl hover:bg-blue-50 hover:ring-2 hover:ring-blue-200 transition-all flex flex-col items-center"
                  >
                    <span className="text-3xl mb-2">{bg.icon}</span>
                    <span className="text-sm text-gray-600">{bg.name}</span>
                  </button>
                ))}
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
                        <span className="text-2xl mb-1">🖼️</span>
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
                {builtInProps.map((prop) => (
                  <button
                    key={prop.name}
                    onClick={() => handleAddProp(prop)}
                    className="p-3 bg-gray-50 rounded-xl hover:bg-blue-50 hover:ring-2 hover:ring-blue-200 transition-all flex flex-col items-center"
                  >
                    <span className="text-2xl mb-1">{prop.icon}</span>
                    <span className="text-xs text-gray-600">{prop.name}</span>
                  </button>
                ))}
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
                        <span className="text-2xl mb-1">🖼️</span>
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
                <span className="text-2xl">🎙️</span>
                Record Voice
              </button>

              <div className="pt-4 border-t">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Upload Audio</h3>
                {uploadButton('audio', 'Upload MP3, WAV, M4A, OGG', audioInputRef, 'audio/*,.mp3,.wav,.m4a,.ogg')}
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
