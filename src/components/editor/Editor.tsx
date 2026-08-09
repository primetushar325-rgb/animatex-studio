'use client';

import { useEffect, useState, useCallback } from 'react';
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
import { saveDraft, getDraft } from '@/lib/storage/indexeddb';
import { Logo } from '@/components/brand/Logo';

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
  } = useEditorStore();
  const { openProject, currentProject, saveProject } = useProjectStore();

  // Initialize editor + restore any saved draft (fixes objects disappearing on refresh)
  useEffect(() => {
    const init = async () => {
      await openProject(projectId);
      initializeEditor(projectId);

      try {
        const draft = (await getDraft(projectId)) as {
          scenes?: unknown[];
          tracks?: unknown[];
          clips?: unknown[];
          canvasObjects?: unknown[];
          characters?: unknown[];
          backgrounds?: unknown[];
          props?: unknown[];
          audioClips?: unknown[];
          textElements?: unknown[];
          currentSceneId?: string | null;
          selectedObjectId?: string | null;
          currentTime?: number;
        } | null;

        if (draft && draft.canvasObjects && draft.scenes) {
          loadEditorState(draft as Parameters<typeof loadEditorState>[0]);
        }
      } catch (err) {
        console.warn('Failed to restore draft', err);
      }
    };
    init();
  }, [projectId, openProject, initializeEditor, loadEditorState]);

  // Auto-save (debounced)
  const handleAutoSave = useCallback(async () => {
    if (!currentProject) return;

    const editorState = getEditorState();
    await saveDraft(projectId, editorState);

    await saveProject({
      sceneCount: scenes.length,
      duration: scenes.reduce((total, scene) => total + scene.duration, 0),
    });
  }, [currentProject, projectId, saveProject, scenes, getEditorState]);

  useEffect(() => {
    if (!currentProject) return;
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
    currentProject,
  ]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (e.shiftKey) {
          useEditorStore.getState().redo();
        } else {
          useEditorStore.getState().undo();
        }
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
      // Arrow key nudging
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

  const handleBack = () => {
    handleAutoSave();
    router.push('/studio');
  };

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
      {/* Toolbar */}
      <Toolbar onBack={handleBack} onAddText={() => openAssetTab('text')} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Canvas Area */}
        <Canvas />

        {/* Bottom Navigation */}
        <div className="bg-slate-800 border-t border-slate-700 px-4 py-2 flex items-center justify-between">
          {/* Scene Selector */}
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

          {/* Quick Actions */}
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

        {/* Timeline */}
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
                  placeholder="একজন ছেলে গ্রামের রাস্তায় হাঁটছিল। হঠাৎ একটি কুকুর তার সামনে আসে।"
                  className="w-full h-32 px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div className="flex gap-2">
                <button className="flex-1 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all">
                  Generate Scenes
                </button>
                <button className="flex-1 py-2 bg-slate-700 text-white font-medium rounded-lg hover:bg-slate-600 transition-colors">
                  AI Character
                </button>
              </div>

              <p className="text-xs text-slate-500 text-center">
                AI features require API configuration. Results will be editable.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
