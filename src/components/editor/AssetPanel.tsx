'use client';

import { useState } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { v4 as uuidv4 } from 'uuid';
import type { CharacterType, BackgroundCategory, CharacterExpression, CharacterAction } from '@/types/animation';

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
  'surprised', 'laughing', 'crying', 'thinking', 'sleepy'
];

const actions: CharacterAction[] = [
  'idle', 'walk', 'run', 'jump', 'sit', 'stand',
  'wave', 'talk', 'point', 'clap', 'cry', 'laugh', 'dance', 'fall'
];

interface AssetPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AssetPanel({ isOpen, onClose }: AssetPanelProps) {
  const [activeTab, setActiveTab] = useState<'characters' | 'backgrounds' | 'props' | 'text' | 'audio'>('characters');
  const [textContent, setTextContent] = useState('');
  const { addCanvasObject, addClip, tracks, currentSceneId } = useEditorStore();

  const handleAddCharacter = (char: typeof builtInCharacters[0]) => {
    const characterTrack = tracks.find((t) => t.sceneId === currentSceneId && t.type === 'character');
    if (!characterTrack) return;

    const assetId = uuidv4();
    
    // Add to canvas
    addCanvasObject({
      type: 'character',
      x: 200,
      y: 200,
      width: 150,
      height: 200,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      zIndex: 10,
      assetId,
      expression: 'neutral',
      action: 'idle',
    });

    // Add to timeline
    addClip(characterTrack.id, assetId, 0, 3000);
    onClose();
  };

  const handleAddBackground = (bg: typeof builtInBackgrounds[0]) => {
    const bgTrack = tracks.find((t) => t.sceneId === currentSceneId && t.type === 'background');
    if (!bgTrack) return;

    const assetId = uuidv4();
    
    addCanvasObject({
      type: 'background',
      x: 0,
      y: 0,
      width: 1080,
      height: 1920,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      zIndex: 0,
      assetId,
    });

    addClip(bgTrack.id, assetId, 0, 5000);
    onClose();
  };

  const handleAddProp = (prop: typeof builtInProps[0]) => {
    const propTrack = tracks.find((t) => t.sceneId === currentSceneId && t.type === 'prop');
    if (!propTrack) return;

    const assetId = uuidv4();
    
    addCanvasObject({
      type: 'prop',
      x: 300,
      y: 400,
      width: 100,
      height: 100,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      zIndex: 5,
      assetId,
    });

    addClip(propTrack.id, assetId, 0, 3000);
    onClose();
  };

  const handleAddText = () => {
    if (!textContent.trim()) return;

    const textTrack = tracks.find((t) => t.sceneId === currentSceneId && t.type === 'text');
    if (!textTrack) return;

    const assetId = uuidv4();
    
    addCanvasObject({
      type: 'text',
      x: 100,
      y: 300,
      width: 300,
      height: 50,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      zIndex: 20,
      assetId,
      content: textContent,
    });

    addClip(textTrack.id, assetId, 0, 2000);
    setTextContent('');
    onClose();
  };

  if (!isOpen) return null;

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
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {(['characters', 'backgrounds', 'props', 'text', 'audio'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-sm capitalize ${
                activeTab === tab
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

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
                    className="p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors flex flex-col items-center"
                  >
                    <span className="text-2xl mb-1">{char.icon}</span>
                    <span className="text-xs text-gray-600">{char.name}</span>
                  </button>
                ))}
              </div>

              <div className="pt-4 border-t">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Expressions</h3>
                <div className="flex flex-wrap gap-1">
                  {expressions.map((expr) => (
                    <span
                      key={expr}
                      className="px-2 py-1 bg-pink-50 text-pink-700 rounded text-xs capitalize"
                    >
                      {expr}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Actions</h3>
                <div className="flex flex-wrap gap-1">
                  {actions.map((action) => (
                    <span
                      key={action}
                      className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs capitalize"
                    >
                      {action}
                    </span>
                  ))}
                </div>
              </div>

              <button className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-blue-500 hover:text-blue-500 transition-colors">
                + Upload Custom Character
              </button>
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
                    className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors flex flex-col items-center"
                  >
                    <span className="text-3xl mb-2">{bg.icon}</span>
                    <span className="text-sm text-gray-600">{bg.name}</span>
                  </button>
                ))}
              </div>

              <button className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-blue-500 hover:text-blue-500 transition-colors">
                + Upload Custom Background
              </button>
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
                    className="p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors flex flex-col items-center"
                  >
                    <span className="text-2xl mb-1">{prop.icon}</span>
                    <span className="text-xs text-gray-600">{prop.name}</span>
                  </button>
                ))}
              </div>

              <button className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-blue-500 hover:text-blue-500 transition-colors">
                + Upload Custom Prop
              </button>
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
              <button className="w-full py-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-600 hover:bg-red-100 transition-colors flex items-center justify-center gap-2">
                <span className="text-2xl">🎙️</span>
                Record Voice
              </button>

              <div className="pt-4 border-t">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Upload Audio</h3>
                <button className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-blue-500 hover:text-blue-500 transition-colors">
                  + Upload MP3, WAV, M4A, OGG
                </button>
              </div>

              <div className="pt-4 border-t">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Music & SFX</h3>
                <div className="space-y-2">
                  {['🎵 Background Music', '🔔 Sound Effects', '🎹 Piano', '🎸 Guitar'].map((item, i) => (
                    <button
                      key={i}
                      className="w-full py-2 px-3 text-left bg-gray-50 rounded-lg hover:bg-gray-100 text-sm flex items-center gap-2"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
