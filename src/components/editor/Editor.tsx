'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useEditorStore } from '@/store/editor-store';
import { useProjectStore } from '@/store/project-store';
import { Canvas } from './Canvas';
import { Timeline } from './Timeline';
import { Toolbar } from './Toolbar';
import { AssetPanel } from './AssetPanel';
import { ScenePanel } from './ScenePanel';
import { VoiceRecorder } from './VoiceRecorder';
import { ExportModal } from './ExportModal';
import { saveDraft } from '@/lib/storage/indexeddb';
import { Logo } from '@/components/brand/Logo';

interface EditorProps {
  projectId: string;
  autoExport?: boolean;
}

export function Editor({ projectId, autoExport = false }: EditorProps) {
  const router = useRouter();
  const [showAssetPanel, setShowAssetPanel] = useState(false);
  const [showScenePanel, setShowScenePanel] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [showExportModal, setShowExportModal] = useState(autoExport);

  const { initializeEditor, getEditorState, scenes, currentSceneId, showTimeline, toggleTimeline } = useEditorStore();
  const { openProject, currentProject, saveProject } = useProjectStore();

  // Initialize editor
  useEffect(() => {
    const init = async () => {
      await openProject(projectId);
      initializeEditor(projectId);
    };
    init();
  }, [projectId, openProject, initializeEditor]);

  // Auto-save
  const handleAutoSave = useCallback(async () => {
    if (!currentProject) return;
    
    const editorState = getEditorState();
    await saveDraft(projectId, editorState);
    
    await saveProject({
      sceneCount: scenes.length,
      duration: scenes.reduce((total, scene) => total + scene.duration, 0),
    });
  }, [currentProject, projectId, saveProject, scenes, getEditorState]);

  // Auto-save on changes (debounced)
  useEffect(() => {
    const timeout = setTimeout(handleAutoSave, 3000);
    return () => clearTimeout(timeout);
  }, [scenes, handleAutoSave]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (e.shiftKey) {
          useEditorStore.getState().redo();
        } else {
          useEditorStore.getState().undo();
        }
      }
      if (e.key === ' ') {
        e.preventDefault();
        useEditorStore.getState().togglePlay();
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const { selectedObjectId, deleteCanvasObject } = useEditorStore.getState();
        if (selectedObjectId && document.activeElement?.tagName !== 'INPUT') {
          e.preventDefault();
          deleteCanvasObject(selectedObjectId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
      <Toolbar onBack={handleBack} />

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
              onClick={() => setShowAssetPanel(true)}
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
      <AssetPanel isOpen={showAssetPanel} onClose={() => setShowAssetPanel(false)} />
      <ScenePanel isOpen={showScenePanel} onClose={() => setShowScenePanel(false)} />
      <VoiceRecorder isOpen={showVoiceRecorder} onClose={() => setShowVoiceRecorder(false)} />
      <ExportModal isOpen={showExportModal} onClose={() => setShowExportModal(false)} />

      {/* AI Panel */}
      {showAIPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowAIPanel(false)}>
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
