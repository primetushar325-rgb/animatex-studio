'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useEditorStore } from '@/store/editor-store';
import { useProjectStore } from '@/store/project-store';
import { Canvas } from './Canvas';
import { Timeline } from './Timeline';
import { Toolbar } from './Toolbar';
import { AssetPanel, type AssetTab } from './AssetPanel';
import { ScenePanel } from './ScenePanel';
import { VoiceRecorder } from './VoiceRecorder';
import { ExportModal } from './ExportModal';
import { AudioPlaybackEngine } from './AudioPlaybackEngine';
import { saveDraft, getDraft } from '@/lib/storage/indexeddb';
import { drawSceneContent } from '@/lib/editor/renderer';
import { generateStory } from '@/lib/editor/storyGenerator';
import { Logo } from '@/components/brand/Logo';
import type { CanvasObject } from '@/types/animation';

interface EditorProps {
  projectId: string;
  autoExport?: boolean;
}

export function Editor({ projectId, autoExport = false }: EditorProps) {
  const router = useRouter();
  const [showAssetPanel, setShowAssetPanel] = useState(false);
  const [assetInitialTab, setAssetInitialTab] = useState<AssetTab>('characters');
  const [showScenePanel, setShowScenePanel] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [showExportModal, setShowExportModal] = useState(autoExport);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [textDraft, setTextDraft] = useState({ content: '', fontSize: 48, color: '#111827', weight: 'normal' as 'normal' | 'bold' });
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const isSavingRef = useRef(false);

  const {
    initializeEditor,
    loadEditorState,
    getEditorState,
    scenes,
    currentSceneId,
    showTimeline,
    toggleTimeline,
    canvasObjects,
    clips,
    tracks,
    characters,
    backgrounds,
    props,
    audioClips,
    textElements,
    updateCanvasObject,
  } = useEditorStore();
  const { openProject, currentProject, saveProject } = useProjectStore();

  // Initialize editor + restore any saved draft
  useEffect(() => {
    const init = async () => {
      await openProject(projectId);
      initializeEditor(projectId);

      try {
        const draft = (await getDraft(projectId)) as Record<string, unknown> | null;
        if (draft && draft.canvasObjects && draft.scenes) {
          loadEditorState(draft as Parameters<typeof loadEditorState>[0]);
        }
      } catch (err) {
        console.warn('Failed to restore draft', err);
      }
    };
    init();
  }, [projectId, openProject, initializeEditor, loadEditorState]);

  // Auto-save (debounced). Reads the project from the store directly so that
  // saving (which updates currentProject) never retriggers another save.
  // Render a small PNG thumbnail of the first scene for the project card
  const generateThumbnail = useCallback((): string | undefined => {
    try {
      const st = useEditorStore.getState();
      const scene0 = st.scenes[0];
      if (!scene0) return undefined;
      const objs = st.canvasObjects.filter((o) => o.sceneId === scene0.id);
      const project = useProjectStore.getState().currentProject;
      const pw = project?.width || 1080;
      const ph = project?.height || 1920;
      const canvas = document.createElement('canvas');
      const w = 320;
      const h = Math.max(1, Math.round((w * ph) / pw));
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return undefined;
      ctx.scale(w / pw, h / ph);
      drawSceneContent(ctx, objs, scene0, 0, 0, pw, ph);
      return canvas.toDataURL('image/jpeg', 0.65);
    } catch {
      return undefined;
    }
  }, []);

  const handleAutoSave = useCallback(async () => {
    if (isSavingRef.current) return;
    if (!useProjectStore.getState().currentProject) return;
    isSavingRef.current = true;
    try {
      const editorState = getEditorState();
      await saveDraft(projectId, editorState);
      const thumbnail = generateThumbnail();
      await saveProject({
        sceneCount: scenes.length,
        duration: scenes.reduce((total, scene) => total + scene.duration, 0),
        ...(thumbnail ? { thumbnail } : {}),
      });
    } finally {
      isSavingRef.current = false;
    }
  }, [projectId, saveProject, scenes, getEditorState, generateThumbnail]);

  useEffect(() => {
    if (!useProjectStore.getState().currentProject) return;
    const timeout = setTimeout(handleAutoSave, 2500);
    return () => clearTimeout(timeout);
  }, [
    scenes,
    canvasObjects,
    clips,
    tracks,
    characters,
    backgrounds,
    props,
    audioClips,
    textElements,
    handleAutoSave,
  ]);

  // Save when the tab is hidden (mobile-friendly — switching apps won't lose work)
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        void handleAutoSave();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [handleAutoSave]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (e.shiftKey) useEditorStore.getState().redo();
        else useEditorStore.getState().undo();
      }
      if (e.key === 'd' && (e.ctrlKey || e.metaKey) && !typing) {
        e.preventDefault();
        const { selectedObjectId, duplicateCanvasObject } = useEditorStore.getState();
        if (selectedObjectId) duplicateCanvasObject(selectedObjectId);
      }
      if (e.key === ' ' && !typing) {
        e.preventDefault();
        useEditorStore.getState().togglePlay();
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && !typing) {
        const { selectedObjectId, deleteCanvasObject } = useEditorStore.getState();
        if (selectedObjectId) {
          e.preventDefault();
          deleteCanvasObject(selectedObjectId);
        }
      }
      if (!typing && e.key.startsWith('Arrow')) {
        const { selectedObjectId, canvasObjects, updateCanvasObject } = useEditorStore.getState();
        const obj = canvasObjects.find((o) => o.id === selectedObjectId);
        if (obj) {
          e.preventDefault();
          const step = e.shiftKey ? 1 : 5;
          const delta =
            e.key === 'ArrowLeft'
              ? { x: obj.x - step }
              : e.key === 'ArrowRight'
              ? { x: obj.x + step }
              : e.key === 'ArrowUp'
              ? { y: obj.y - step }
              : { y: obj.y + step };
          updateCanvasObject(obj.id, delta);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const openAssetTab = (tab: AssetTab) => {
    setAssetInitialTab(tab);
    setShowAssetPanel(true);
  };

  const handleDoubleClickObject = (obj: CanvasObject) => {
    if (obj.type === 'text') {
      setTextDraft({
        content: obj.content || '',
        fontSize: obj.fontSize || 48,
        color: obj.fontColor || '#111827',
        weight: obj.fontWeight === 'bold' ? 'bold' : 'normal',
      });
      setEditingTextId(obj.id);
    } else if (obj.type === 'character') {
      openAssetTab('characters');
    }
  };

  const openTextEditor = () => {
    const selId = useEditorStore.getState().selectedObjectId;
    const obj = canvasObjects.find((o) => o.id === selId);
    if (!obj || obj.type !== 'text') return;
    setTextDraft({
      content: obj.content || '',
      fontSize: obj.fontSize || 48,
      color: obj.fontColor || '#111827',
      weight: obj.fontWeight === 'bold' ? 'bold' : 'normal',
    });
    setEditingTextId(obj.id);
  };

  const saveText = () => {
    if (editingTextId && textDraft.content.trim()) {
      updateCanvasObject(editingTextId, {
        content: textDraft.content,
        fontSize: textDraft.fontSize,
        fontColor: textDraft.color,
        fontWeight: textDraft.weight,
      });
    }
    setEditingTextId(null);
  };

  const handleBack = async () => {
    await handleAutoSave();
    router.push('/studio');
  };

  // ---------------------------------------------------------------------------
  // Smart (offline) story generation — no external AI API needed
  // ---------------------------------------------------------------------------

  const applyStoryToEditor = (prompt: string) => {
    const story = generateStory(prompt);
    if (story.length === 0) {
      setAiStatus('কিছু লিখুন আগে — যেমন: "একটি ছেলে গ্রামের রাস্তায় হাঁটছিল"');
      return;
    }

    const st = useEditorStore.getState();
    const project = useProjectStore.getState().currentProject;
    const pw = project?.width || 1080;
    const ph = project?.height || 1920;

    let firstSceneId: string | null = null;

    for (const s of story) {
      st.addScene(s.name);
      const sceneId = useEditorStore.getState().currentSceneId;
      if (!sceneId) continue;
      if (!firstSceneId) firstSceneId = sceneId;
      st.setCurrentScene(sceneId);
      st.updateScene(sceneId, { backgroundColor: s.bgColor });

      const tr = useEditorStore.getState().tracks;
      const bgTrack = tr.find((t) => t.sceneId === sceneId && t.type === 'background');
      const charTrack = tr.find((t) => t.sceneId === sceneId && t.type === 'character');
      const propTrack = tr.find((t) => t.sceneId === sceneId && t.type === 'prop');

      if (bgTrack) {
        const assetId = newId();
        st.addCanvasObject({
          type: 'background',
          x: 0,
          y: 0,
          width: pw,
          height: ph,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          opacity: 1,
          zIndex: 0,
          assetId,
          name: s.background,
        });
        st.addClip(bgTrack.id, assetId, 0, 5000);
      }

      const n = s.characters.length;
      s.characters.forEach((c, i) => {
        if (!charTrack) return;
        const assetId = newId();
        const w = 200;
        const h = 300;
        st.addCanvasObject({
          type: 'character',
          x: (pw * (i + 1)) / (n + 1) - w / 2,
          y: ph * 0.55 - h / 2,
          width: w,
          height: h,
          rotation: 0,
          scaleX: 1.1,
          scaleY: 1.1,
          opacity: 1,
          zIndex: 10,
          assetId,
          name: c.name,
          characterType: c.type,
          expression: c.expression,
          action: c.action,
        });
        st.addClip(charTrack.id, assetId, 0, 5000);
      });

      if (propTrack) {
        s.props.slice(0, 3).forEach((p, i) => {
          const assetId = newId();
          st.addCanvasObject({
            type: 'prop',
            x: pw * 0.75 + i * 60,
            y: ph * 0.62,
            width: 100,
            height: 100,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            opacity: 1,
            zIndex: 5,
            assetId,
            name: p,
          });
          st.addClip(propTrack.id, assetId, 0, 5000);
        });
      }
    }

    if (firstSceneId) {
      useEditorStore.getState().setCurrentScene(firstSceneId);
    }
    setAiStatus(`✅ ${story.length}টা scene তৈরি হয়েছে! দেখে নাও।`);
  };

  const handleGenerateScenes = () => {
    applyStoryToEditor(aiPrompt);
  };

  const handleRandomCharacter = () => {
    const types = [
      'boy', 'girl', 'child', 'man', 'woman', 'old-man', 'old-woman',
      'dog', 'cat', 'bird', 'cow', 'goat',
    ] as const;
    const type = types[Math.floor(Math.random() * types.length)];
    const st = useEditorStore.getState();
    const project = useProjectStore.getState().currentProject;
    const pw = project?.width || 1080;
    const ph = project?.height || 1920;
    const sceneId = st.currentSceneId;
    const charTrack = st.tracks.find((t) => t.sceneId === sceneId && t.type === 'character');
    if (!charTrack || !sceneId) return;

    const assetId = newId();
    const w = 200;
    const h = 300;
    st.addCanvasObject({
      type: 'character',
      x: pw * 0.3 + Math.random() * pw * 0.3 - w / 2,
      y: ph * 0.55 - h / 2,
      width: w,
      height: h,
      rotation: 0,
      scaleX: 1.2,
      scaleY: 1.2,
      opacity: 1,
      zIndex: 10,
      assetId,
      name: type,
      characterType: type,
      expression: 'happy',
      action: 'idle',
    });
    st.addClip(charTrack.id, assetId, 0, 3000);
    setAiStatus(`🎭 "${type}" character যোগ হয়েছে।`);
  };

  const newId = (): string =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  if (!currentProject) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Logo size={64} />
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mt-4"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-900 overflow-hidden">
      {/* Hidden audio engine for timeline voice/music playback */}
      <AudioPlaybackEngine />

      {/* Toolbar */}
      <Toolbar
        onBack={handleBack}
        onAddText={() => openAssetTab('text')}
        onSave={() => void handleAutoSave()}
        onEditText={openTextEditor}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Canvas Area */}
        <Canvas onDoubleClickObject={handleDoubleClickObject} />

        {/* Bottom Navigation */}
        <div className="bg-slate-800 border-t border-slate-700 px-4 py-2 flex items-center justify-between">
          <button
            onClick={() => setShowScenePanel(true)}
            className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors"
          >
            <span>🎬</span>
            <span className="text-sm">
              {scenes.find((s) => s.id === currentSceneId)?.name || 'Scene 1'}
            </span>
            <span className="text-xs text-slate-400">({scenes.length})</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => openAssetTab('characters')}
              className="w-10 h-10 flex items-center justify-center bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors"
              title="Add Assets"
            >
              +
            </button>
            <button
              onClick={() => setShowVoiceRecorder(true)}
              className="w-10 h-10 flex items-center justify-center bg-red-600 hover:bg-red-700 rounded-lg text-white transition-colors"
              title="Record Voice"
            >
              🎙️
            </button>
            <button
              onClick={() => setShowAIPanel(true)}
              className="w-10 h-10 flex items-center justify-center bg-purple-600 hover:bg-purple-700 rounded-lg text-white transition-colors"
              title="AI Animation"
            >
              ✨
            </button>
            <button
              onClick={() => setShowExportModal(true)}
              className="w-10 h-10 flex items-center justify-center bg-green-600 hover:bg-green-700 rounded-lg text-white transition-colors"
              title="Export Video"
            >
              📤
            </button>
            <button
              onClick={toggleTimeline}
              className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${
                showTimeline ? 'bg-slate-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
              }`}
              title="Toggle Timeline"
            >
              📊
            </button>
          </div>
        </div>

        {showTimeline && <Timeline />}
      </div>

      {/* Panels */}
      <AssetPanel
        isOpen={showAssetPanel}
        onClose={() => setShowAssetPanel(false)}
        initialTab={assetInitialTab}
        onRecordVoice={() => setShowVoiceRecorder(true)}
      />
      <ScenePanel isOpen={showScenePanel} onClose={() => setShowScenePanel(false)} />
      <VoiceRecorder isOpen={showVoiceRecorder} onClose={() => setShowVoiceRecorder(false)} />
      <ExportModal isOpen={showExportModal} onClose={() => setShowExportModal(false)} />

      {/* Text edit modal */}
      {editingTextId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setEditingTextId(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">✏️ Edit Text</h2>
              <button onClick={() => setEditingTextId(null)} className="text-gray-500 hover:text-gray-700">
                ✕
              </button>
            </div>

            <textarea
              value={textDraft.content}
              onChange={(e) => setTextDraft((d) => ({ ...d, content: e.target.value }))}
              rows={3}
              autoFocus
              className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Type here…"
            />

            <div className="flex items-center gap-3 mt-4">
              <label className="flex items-center gap-2 text-xs text-gray-600">
                Size
                <input
                  type="number"
                  min={12}
                  max={200}
                  value={textDraft.fontSize}
                  onChange={(e) => setTextDraft((d) => ({ ...d, fontSize: parseInt(e.target.value, 10) || 48 }))}
                  className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-600">
                Color
                <input
                  type="color"
                  value={textDraft.color}
                  onChange={(e) => setTextDraft((d) => ({ ...d, color: e.target.value }))}
                  className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
                />
              </label>
              <button
                onClick={() => setTextDraft((d) => ({ ...d, weight: d.weight === 'bold' ? 'normal' : 'bold' }))}
                className={`px-3 py-1.5 rounded border text-sm font-bold ${
                  textDraft.weight === 'bold'
                    ? 'bg-blue-600 text-white border-blue-700'
                    : 'bg-gray-50 text-gray-600 border-gray-200'
                }`}
              >
                B
              </button>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setEditingTextId(null)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={saveText}
                disabled={!textDraft.content.trim()}
                className="flex-1 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Panel */}
      {showAIPanel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setShowAIPanel(false)}
        >
          <div
            className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">✨ AI Animation</h2>
              <button onClick={() => setShowAIPanel(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Describe your story
                </label>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="একজন ছেলে গ্রামের রাস্তায় হাঁটছিল। হঠাৎ একটি কুকুর তার সামনে আসে।"
                  className="w-full h-32 px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleGenerateScenes}
                  className="flex-1 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all"
                >
                  ✨ Smart Generate
                </button>
                <button
                  onClick={handleRandomCharacter}
                  className="flex-1 py-2 bg-slate-700 text-white font-medium rounded-lg hover:bg-slate-600 transition-colors"
                >
                  🎭 Random Character
                </button>
              </div>

              {aiStatus && (
                <p className="text-xs text-purple-300 bg-purple-500/10 border border-purple-500/20 rounded-lg px-3 py-2">
                  {aiStatus}
                </p>
              )}

              <p className="text-xs text-slate-500 text-center">
                ⚡ অফলাইন স্মার্ট জেনারেটর — Bangla/English বাক্য থেকে scene, character, action,
                background নিজে থেকেই বানিয়ে দেয় (কোনো API লাগে না)।
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
