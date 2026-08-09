'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  LayoutGrid,
  Shapes,
  Image as ImageIcon,
  Clapperboard,
  Mic,
  Sparkles,
  Search,
  Check,
  X,
  Theater,
  type LucideIcon,
} from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
import { useProjectStore } from '@/store/project-store';
import { Canvas } from './Canvas';
import { Timeline } from './Timeline';
import { Toolbar } from './Toolbar';
import { AssetPanel, type AssetTab } from './AssetPanel';
import { CharacterPanel } from './CharacterPanel';
import { TemplatesPanel } from './TemplatesPanel';
import { ScenePanel } from './ScenePanel';
import { VoiceRecorder } from './VoiceRecorder';
import { ExportModal } from './ExportModal';
import { AIVoicePanel } from './AIVoicePanel';
import { GlobalSearch } from './GlobalSearch';
import { TutorialOverlay } from './TutorialOverlay';
import { AudioPlaybackEngine } from './AudioPlaybackEngine';
import { saveDraft, getDraft } from '@/lib/storage/indexeddb';
import { drawSceneContent } from '@/lib/editor/renderer';
import { generateStory } from '@/lib/editor/storyGenerator';
import { useFeatureGate } from '@/lib/editor/featureGate';
import { useLanguage, recordRecent, type AssetRef } from '@/lib/editor/useEditorUI';
import { t } from '@/lib/editor/i18n';
import { Logo } from '@/components/brand/Logo';
import type { CanvasObject } from '@/types/animation';

interface EditorProps {
  projectId: string;
  autoExport?: boolean;
}

export function Editor({ projectId, autoExport = false }: EditorProps) {
  const router = useRouter();
  const gate = useFeatureGate();
  const [lang] = useLanguage();

  const [showAssetPanel, setShowAssetPanel] = useState(false);
  const [assetInitialTab, setAssetInitialTab] = useState<AssetTab>('characters');
  const [showCharacterPanel, setShowCharacterPanel] = useState(false);
  const [showTemplatesPanel, setShowTemplatesPanel] = useState(false);
  const [showAIVoicePanel, setShowAIVoicePanel] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState<'character' | 'media' | 'templates' | null>(null);
  const [showScenePanel, setShowScenePanel] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [showExportModal, setShowExportModal] = useState(autoExport);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [textDraft, setTextDraft] = useState({ content: '', fontSize: 48, color: '#111827', weight: 'normal' as 'normal' | 'bold' });
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showWelcomeHint, setShowWelcomeHint] = useState(false);
  const isSavingRef = useRef(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

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
    addCanvasObject,
    addClip,
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
          showToast(t('saved', lang) === 'Saved' ? '💾 আগের ড্রাফট ফিরিয়ে আনা হয়েছে' : '💾 Draft restored');
        }
      } catch (err) {
        console.warn('Failed to restore draft', err);
      }

      const st = useEditorStore.getState();
      if (st.canvasObjects.length === 0) {
        const tt = setTimeout(() => setShowWelcomeHint(true), 1200);
        return () => clearTimeout(tt);
      }
    };
    init();
  }, [projectId, openProject, initializeEditor, loadEditorState, showToast, lang]);

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

  // Never throws — always resets the guard so the Back button can never be blocked.
  const handleAutoSave = useCallback(async () => {
    if (isSavingRef.current) return;
    if (!useProjectStore.getState().currentProject) return;
    isSavingRef.current = true;
    try {
      const editorState = getEditorState();
      await saveDraft(projectId, editorState).catch(() => undefined);
      const thumbnail = generateThumbnail();
      await saveProject({
        sceneCount: scenes.length,
        duration: scenes.reduce((total, scene) => total + scene.duration, 0),
        ...(thumbnail ? { thumbnail } : {}),
      }).catch(() => undefined);
    } catch {
      // swallow
    } finally {
      isSavingRef.current = false;
    }
  }, [projectId, saveProject, scenes, getEditorState, generateThumbnail]);

  useEffect(() => {
    if (!useProjectStore.getState().currentProject) return;
    const timeout = setTimeout(handleAutoSave, 2500);
    return () => clearTimeout(timeout);
  }, [scenes, canvasObjects, clips, tracks, characters, backgrounds, props, audioClips, textElements, handleAutoSave]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void handleAutoSave();
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
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowGlobalSearch((s) => !s);
      }
      if (!typing && e.key.startsWith('Arrow')) {
        const { selectedObjectId, canvasObjects, updateCanvasObject } = useEditorStore.getState();
        const obj = canvasObjects.find((o) => o.id === selectedObjectId);
        if (obj) {
          e.preventDefault();
          const step = e.shiftKey ? 1 : 5;
          const delta =
            e.key === 'ArrowLeft' ? { x: obj.x - step }
            : e.key === 'ArrowRight' ? { x: obj.x + step }
            : e.key === 'ArrowUp' ? { y: obj.y - step }
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

  const handleBack = () => {
    void handleAutoSave().catch(() => undefined);
    router.push('/studio');
  };

  // ---------------------------------------------------------------------------
  // Smart (offline) story generation
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
      const bgTrack = tr.find((tt) => tt.sceneId === sceneId && tt.type === 'background');
      const charTrack = tr.find((tt) => tt.sceneId === sceneId && tt.type === 'character');
      const propTrack = tr.find((tt) => tt.sceneId === sceneId && tt.type === 'prop');

      if (bgTrack) {
        const assetId = newId();
        st.addCanvasObject({ type: 'background', x: 0, y: 0, width: pw, height: ph, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, zIndex: 0, assetId, name: s.background });
        st.addClip(bgTrack.id, assetId, 0, 5000);
      }

      const n = s.characters.length;
      s.characters.forEach((c, i) => {
        if (!charTrack) return;
        const assetId = newId();
        const w = 200;
        const h = 300;
        st.addCanvasObject({
          type: 'character', x: (pw * (i + 1)) / (n + 1) - w / 2, y: ph * 0.55 - h / 2,
          width: w, height: h, rotation: 0, scaleX: 1.1, scaleY: 1.1, opacity: 1, zIndex: 10,
          assetId, name: c.name, characterType: c.type, expression: c.expression, action: c.action,
        });
        st.addClip(charTrack.id, assetId, 0, 5000);
      });

      if (propTrack) {
        s.props.slice(0, 3).forEach((p, i) => {
          const assetId = newId();
          st.addCanvasObject({
            type: 'prop', x: pw * 0.75 + i * 60, y: ph * 0.62, width: 100, height: 100,
            rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, zIndex: 5, assetId, name: p,
          });
          st.addClip(propTrack.id, assetId, 0, 5000);
        });
      }
    }

    if (firstSceneId) useEditorStore.getState().setCurrentScene(firstSceneId);
    setAiStatus(`✅ ${story.length}টা scene তৈরি হয়েছে! দেখে নাও।`);
  };

  const handleGenerateScenes = () => applyStoryToEditor(aiPrompt);

  const handleRandomCharacter = () => {
    const types = ['boy', 'girl', 'child', 'man', 'woman', 'old-man', 'old-woman', 'dog', 'cat', 'bird', 'cow', 'goat'] as const;
    const type = types[Math.floor(Math.random() * types.length)];
    const st = useEditorStore.getState();
    const project = useProjectStore.getState().currentProject;
    const pw = project?.width || 1080;
    const ph = project?.height || 1920;
    const sceneId = st.currentSceneId;
    const charTrack = st.tracks.find((tt) => tt.sceneId === sceneId && tt.type === 'character');
    if (!charTrack || !sceneId) return;

    const assetId = newId();
    st.addCanvasObject({
      type: 'character', x: pw * 0.3 + Math.random() * pw * 0.3 - 100, y: ph * 0.55 - 150,
      width: 200, height: 300, rotation: 0, scaleX: 1.2, scaleY: 1.2, opacity: 1, zIndex: 10,
      assetId, name: type, characterType: type, expression: 'happy', action: 'idle',
    });
    st.addClip(charTrack.id, assetId, 0, 3000);
    setAiStatus(`🎭 "${type}" character যোগ হয়েছে।`);
  };

  const handleGlobalAdd = (kind: 'character' | 'background' | 'prop', name: string, imageUrl?: string) => {
    const st = useEditorStore.getState();
    const project = useProjectStore.getState().currentProject;
    const pw = project?.width || 1080;
    const ph = project?.height || 1920;
    const sceneId = st.currentSceneId;
    const trackType = kind;
    const track = st.tracks.find((tt) => tt.sceneId === sceneId && tt.type === trackType);
    if (!track || !sceneId) return;

    const assetId = newId();
    const isBg = kind === 'background';
    st.addCanvasObject({
      type: trackType as 'character',
      x: isBg ? 0 : pw / 2 - 110,
      y: isBg ? 0 : ph * 0.55 - 160,
      width: isBg ? pw : 220,
      height: isBg ? ph : 320,
      rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
      zIndex: isBg ? 0 : kind === 'prop' ? 5 : 10,
      assetId, name,
      ...(imageUrl ? { imageUrl } : {}),
      ...(kind === 'character' ? { characterType: 'custom' as const, expression: 'neutral' as const, action: 'idle' as const } : {}),
    } as never);
    st.addClip(track.id, assetId, 0, isBg ? 5000 : 3000);

    recordRecent({ kind, id: assetId, name, url: imageUrl } as AssetRef);
    showToast(`✅ ${name} যোগ হয়েছে`);
  };

  const newId = (): string =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  if (!currentProject) {
    return (
      <div className="min-h-screen editor-surface flex items-center justify-center">
        <div className="text-center">
          <Logo size={64} />
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--editor-accent)] mx-auto mt-4"></div>
        </div>
      </div>
    );
  }

  const creditsLabel = gate.plan === 'pro' ? '∞' : gate.credits;

  return (
    <div className="h-screen flex flex-col editor-surface overflow-hidden">
      <AudioPlaybackEngine />

      <Toolbar
        onBack={handleBack}
        onAddText={() => openAssetTab('text')}
        onSave={() => void handleAutoSave()}
        onEditText={openTextEditor}
        onExport={() => setShowExportModal(true)}
        onSearch={() => {
          setShowGlobalSearch(true);
          // warm the public character manifest so the first search is instant
          import('@/lib/editor/characterLibrary').then((m) => m.getPublicCharacters().catch(() => undefined));
        }}
        lang={lang}
      />

      <div className="flex-1 flex flex-col overflow-hidden relative">
        <Canvas onDoubleClickObject={handleDoubleClickObject} />

        {/* Bottom Tab Bar */}
        <div className="editor-surface border-t border-[var(--editor-border)] px-1 pt-1.5 pb-[max(0.4rem,env(safe-area-inset-bottom))]">
          <div className="flex items-stretch justify-around">
            <BottomTab icon={Users} label={t('characters', lang)} active={activeBottomTab === 'character'} onClick={() => { setActiveBottomTab('character'); setShowCharacterPanel(true); }} />
            <BottomTab icon={LayoutGrid} label={t('media', lang)} active={activeBottomTab === 'media'} onClick={() => { setActiveBottomTab('media'); openAssetTab('characters'); }} />
            <BottomTab icon={Shapes} label={t('templates', lang)} active={activeBottomTab === 'templates'} onClick={() => { setActiveBottomTab('templates'); setShowTemplatesPanel(true); }} />
            <BottomTab icon={ImageIcon} label={t('imageGen', lang)} ai onClick={() => { setActiveBottomTab(null); setShowAIPanel(true); }} />
            <BottomTab icon={Clapperboard} label={t('videoGen', lang)} ai onClick={() => { setActiveBottomTab(null); setShowExportModal(true); }} />
            <BottomTab icon={Mic} label={t('aiVoice', lang)} ai onClick={() => { setActiveBottomTab(null); setShowAIVoicePanel(true); }} />
            <BottomTab icon={Sparkles} label={t('aiChar', lang)} ai onClick={() => { setActiveBottomTab(null); handleRandomCharacter(); }} />
          </div>

          {/* Credits badge + scene pill + search */}
          <div className="flex items-center justify-center gap-2 mt-1.5">
            <button
              onClick={() => setShowGlobalSearch(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full editor-panel-2 text-[11px] text-[var(--editor-text-2)] hover:text-white transition-colors"
              title="Search everything (Ctrl+K)"
            >
              <Search size={12} /> {t('globalSearch', lang)}
            </button>
            <button
              onClick={() => setShowScenePanel(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full editor-panel-2 text-[11px] text-[var(--editor-text-2)] hover:text-white transition-colors"
            >
              🎬 {scenes.find((s) => s.id === currentSceneId)?.name || 'Scene 1'} · {scenes.length}
            </button>
            <button
              onClick={() => setShowAIPanel(true)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                gate.credits <= 2 && gate.plan !== 'pro'
                  ? 'bg-red-500/20 text-red-300'
                  : 'bg-[var(--editor-accent)]/15 text-[var(--editor-accent)]'
              }`}
              title="AI credits"
            >
              ⚡ {creditsLabel}
            </button>
          </div>
        </div>

        {showTimeline && <Timeline />}

        {/* Tutorial overlays */}
        <TutorialOverlay id="timeline" anchor="bottom" title="Timeline tips" body="Scene tabs উপরে, clip ধরে টেনে সরান, কিনারা ধরে বড়/ছোট করুন। ◆ দিয়ে keyframe যোগ করুন।" />
        {showCharacterPanel && (
          <TutorialOverlay id="characters" anchor="top" title="Character Library" body="যেকোনো character-এ ক্লিক করলেই ক্যানভাসে যোগ হয়। FRONT/3-4 FRONT pose সুইচার আছে।" />
        )}
        {showTemplatesPanel && (
          <TutorialOverlay id="templates" anchor="top" title="Templates" body="'+ Blank Scene' ডিফল্ট সিলেক্টেড — তারপর 'Apply Scene' চাপুন। টেমপ্লেট শীঘ্রই আসছে।" />
        )}

        {/* Empty-canvas welcome hint */}
        {showWelcomeHint && (
          <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
            <div className="bg-slate-900/90 backdrop-blur border border-slate-700 rounded-2xl p-6 max-w-sm text-center shadow-2xl pointer-events-auto animate-fadeIn">
              <div className="text-4xl mb-3">🎬</div>
              <h3 className="text-white font-bold text-lg mb-1">Let&apos;s make an animation!</h3>
              <p className="text-slate-300 text-sm mb-4">
                একটা লাইন লিখো — <span className="text-purple-300">&quot;একটি ছেলে গ্রামের রাস্তায় হাঁটছিল&quot;</span> —
                Smart Generator scene বানিয়ে দেবে। অথবা নিচ থেকে character যোগ করো।
              </p>
              <div className="flex gap-2 justify-center">
                <button onClick={() => { setShowWelcomeHint(false); setShowAIPanel(true); }} className="px-4 py-2 editor-gradient text-white rounded-lg text-sm font-medium transition-all">
                  ✨ Smart Generate
                </button>
                <button onClick={() => { setShowWelcomeHint(false); setShowCharacterPanel(true); }} className="px-4 py-2 editor-panel-2 text-white rounded-lg text-sm font-medium transition-all">
                  ➕ Add Character
                </button>
              </div>
              <button onClick={() => setShowWelcomeHint(false)} className="mt-3 text-xs text-slate-500 hover:text-slate-300">
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 px-4 py-2 bg-slate-800/95 backdrop-blur border border-slate-700 text-white text-sm rounded-full shadow-xl animate-slideDown">
            {toast}
          </div>
        )}
      </div>

      {/* Panels */}
      <AssetPanel isOpen={showAssetPanel} onClose={() => { setShowAssetPanel(false); setActiveBottomTab(null); }} initialTab={assetInitialTab} onRecordVoice={() => setShowVoiceRecorder(true)} />
      <CharacterPanel isOpen={showCharacterPanel} onClose={() => { setShowCharacterPanel(false); setActiveBottomTab(null); }} onCreate={() => { setShowCharacterPanel(false); setShowAIPanel(true); }} />
      <TemplatesPanel isOpen={showTemplatesPanel} onClose={() => { setShowTemplatesPanel(false); setActiveBottomTab(null); }} />
      <ScenePanel isOpen={showScenePanel} onClose={() => setShowScenePanel(false)} />
      <VoiceRecorder isOpen={showVoiceRecorder} onClose={() => setShowVoiceRecorder(false)} />
      <AIVoicePanel isOpen={showAIVoicePanel} onClose={() => setShowAIVoicePanel(false)} />
      <ExportModal isOpen={showExportModal} onClose={() => setShowExportModal(false)} />
      <GlobalSearch
        isOpen={showGlobalSearch}
        onClose={() => setShowGlobalSearch(false)}
        onAddObject={handleGlobalAdd}
      />

      {/* Text edit modal */}
      {editingTextId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setEditingTextId(null)}>
          <div className="editor-panel border border-[var(--editor-border)] rounded-2xl w-full max-w-sm p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">✏️ Edit Text</h2>
              <button onClick={() => setEditingTextId(null)} className="text-[var(--editor-text-2)] hover:text-white"><X size={18} /></button>
            </div>
            <textarea value={textDraft.content} onChange={(e) => setTextDraft((d) => ({ ...d, content: e.target.value }))} rows={3} autoFocus className="w-full editor-input p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--editor-accent)]" placeholder="Type here…" />
            <div className="flex items-center gap-3 mt-4">
              <label className="flex items-center gap-2 text-xs text-[var(--editor-text-2)]">
                Size
                <input type="number" min={12} max={200} value={textDraft.fontSize} onChange={(e) => setTextDraft((d) => ({ ...d, fontSize: parseInt(e.target.value, 10) || 48 }))} className="w-16 editor-input px-2 py-1 text-sm" />
              </label>
              <label className="flex items-center gap-2 text-xs text-[var(--editor-text-2)]">
                Color
                <input type="color" value={textDraft.color} onChange={(e) => setTextDraft((d) => ({ ...d, color: e.target.value }))} className="w-8 h-8 rounded border border-[var(--editor-border)] cursor-pointer" />
              </label>
              <button onClick={() => setTextDraft((d) => ({ ...d, weight: d.weight === 'bold' ? 'normal' : 'bold' }))} className={`px-3 py-1.5 rounded border text-sm font-bold ${textDraft.weight === 'bold' ? 'editor-gradient text-white' : 'editor-panel-2 text-[var(--editor-text-2)]'}`}>B</button>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditingTextId(null)} className="flex-1 py-2.5 editor-panel-2 text-white font-medium rounded-lg">Cancel</button>
              <button onClick={saveText} disabled={!textDraft.content.trim()} className="flex-1 py-2.5 editor-gradient text-white font-medium rounded-lg disabled:opacity-50">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* AI Panel */}
      {showAIPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowAIPanel(false)}>
          <div className="editor-panel-2 border border-[var(--editor-border)] rounded-2xl w-full max-w-md p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Sparkles size={20} className="text-[var(--editor-accent-2)]" /> AI Tools
              </h2>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-full text-[10px] font-semibold ${gate.plan === 'pro' ? 'bg-[var(--editor-accent)]/20 text-[var(--editor-accent)]' : 'bg-[var(--editor-accent-2)]/20 text-[var(--editor-accent-2)]'}`}>
                  {gate.plan === 'pro' ? 'PRO' : `${gate.credits} credits`}
                </span>
                <button onClick={() => setShowAIPanel(false)} className="text-[var(--editor-text-2)] hover:text-white"><X size={18} /></button>
              </div>
            </div>

            {/* Text-to-Image & Video — clearly stubbed */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button disabled className="flex flex-col items-center gap-1 py-4 rounded-xl editor-panel-2 text-[var(--editor-text-2)] opacity-60 cursor-not-allowed">
                <ImageIcon size={20} />
                <span className="text-xs">Text→Image</span>
                <span className="text-[9px] text-[var(--editor-text-2)]">Coming soon</span>
              </button>
              <button disabled className="flex flex-col items-center gap-1 py-4 rounded-xl editor-panel-2 text-[var(--editor-text-2)] opacity-60 cursor-not-allowed">
                <Clapperboard size={20} />
                <span className="text-xs">Text→Video</span>
                <span className="text-[9px] text-[var(--editor-text-2)]">Coming soon</span>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Describe your story</label>
                <textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="একজন ছেলে গ্রামের রাস্তায় হাঁটছিল। হঠাৎ একটি কুকুর তার সামনে আসে।" className="w-full h-32 px-4 py-3 editor-input text-white placeholder-[var(--editor-text-2)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--editor-accent-2)]" />
              </div>
              <div className="flex gap-2">
                <button onClick={handleGenerateScenes} className="flex-1 py-2 editor-gradient text-white font-medium rounded-lg transition-all flex items-center justify-center gap-1.5"><Sparkles size={15} /> Smart Generate</button>
                <button onClick={handleRandomCharacter} className="flex-1 py-2 editor-panel-2 text-white font-medium rounded-lg hover:bg-[var(--editor-panel-3)] transition-colors flex items-center justify-center gap-1.5"><Theater size={15} /> Random Character</button>
              </div>
              {aiStatus && <p className="text-xs text-[var(--editor-accent-2)] bg-[var(--editor-accent-2)]/10 border border-[var(--editor-accent-2)]/20 rounded-lg px-3 py-2">{aiStatus}</p>}
              <p className="text-xs text-slate-500 text-center">
                ⚡ অফলাইন স্মার্ট জেনারেটর — Bangla/English বাক্য থেকে scene, character, action, background বানায়। Text→Image/Video শীঘ্রই।
              </p>
              {gate.plan !== 'pro' && (
                <button onClick={() => showToast('Pro শীঘ্রই আসছে — আপাতত সব AI টুল ফ্রি')} className="w-full py-2 rounded-xl border border-[var(--editor-accent-2)]/40 text-[var(--editor-accent-2)] text-xs font-medium">
                  ⚡ Upgrade to Pro
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pro upgrade toast for gated features */}
      {gate.plan !== 'pro' && gate.credits === 0 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[80] px-4 py-2.5 rounded-full editor-panel-2 border border-[var(--editor-accent-2)]/50 text-xs text-white shadow-2xl flex items-center gap-2">
          <span>AI credits শেষ — Image/Video Gen ও AI Voice-তে Pro লাগবে।</span>
          <button onClick={() => { /* placeholder for real upgrade flow */ showToast('Pro checkout শীঘ্রই আসছে'); }} className="px-2 py-0.5 rounded-full editor-gradient text-white font-semibold">Pro</button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bottom tab bar item — lucide icon + premium variants
// ---------------------------------------------------------------------------

interface BottomTabProps {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  ai?: boolean;
  onClick: () => void;
}

function BottomTab({ icon: Icon, label, active, ai, onClick }: BottomTabProps) {
  return (
    <button
      onClick={onClick}
      className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl transition-colors ${
        active ? 'text-[var(--editor-accent)]' : 'text-[var(--editor-text-2)] hover:text-white'
      }`}
    >
      <span className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
        active ? 'editor-gradient text-white shadow-lg shadow-black/40' : ''
      }`}>
        <Icon size={18} strokeWidth={2} />
      </span>
      <span className={`text-[9px] font-medium ${active ? 'text-[var(--editor-accent)]' : ''}`}>{label}</span>
      {ai && (
        <span className="absolute -top-0.5 right-1.5 px-1 rounded-full editor-gradient text-white text-[7px] font-bold leading-[10px]">AI</span>
      )}
      {active && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full editor-gradient" />}
    </button>
  );
}
