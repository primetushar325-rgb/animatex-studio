'use client';

// ============================================================================
// AnimateX — Professional CapCut-style Timeline
// ----------------------------------------------------------------------------
// SINGLE SOURCE OF TRUTH: store.currentTime (milliseconds, exact float).
//
// Pixel system (NOT percent):
//   pps (pixels per second) = BASE_PPS * zoom
//   timeToX(t) = t / 1000 * pps          (absolute px inside the content)
//   xToTime(x) = x / pps * 1000
//   keyframe.time / clip.startTime / split all derive from currentTime or
//   xToTime() — NEVER from DOM offsets.
//
// Features: full-height draggable playhead, adaptive ruler, frame stepping,
// split-at-playhead (keyframes preserved), draggable keyframes, snapping
// (frame / playhead / clip edge), zoom in-out-fit (preserves currentTime),
// auto-scroll during playback, loop region, markers, FPS config, undo/redo.
// ============================================================================

import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, ChevronLeft, ChevronRight,
  Plus, MoreVertical, Copy, Scissors, Diamond, Undo2, Redo2,
  ZoomIn, ZoomOut, Maximize, Minimize, Lock, Unlock, Eye,
  User, Image as ImageIcon, Box, Type, Mic, Music, Volume2,
  ChevronDown, ChevronUp, Magnet, Repeat, KeyRound, Flag, Frame,
  Trash2, GripHorizontal, RefreshCw,
} from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
import { objectToKeyframeProperties, findClipForObject } from '@/lib/editor/keyframes';
import type { Keyframe, TimelineClip } from '@/types/animation';

const BASE_PPS = 60; // px per second at zoom 1
const PLAYHEAD_HIT = 28; // px — generous touch target
const SNAP_PX = 12; // snap threshold in px

type ClipDragMode = 'move' | 'trim-l' | 'trim-r' | null;

const TRACK_ICON: Record<string, React.ReactNode> = {
  character: <User size={12} />,
  background: <ImageIcon size={12} />,
  prop: <Box size={12} />,
  text: <Type size={12} />,
  voice: <Mic size={12} />,
  music: <Music size={12} />,
  sfx: <Volume2 size={12} />,
};

// module-level: impure spawn logic kept OUT of the component body
function dropCharacterOntoTrack(e: React.DragEvent, atTime: number) {
  e.preventDefault();
  const raw = e.dataTransfer.getData('text/animatex-character');
  if (!raw) return;
  try {
    const { name, type } = JSON.parse(raw) as { name?: string; type?: string };
    const charName = name || 'Character';
    const st = useEditorStore.getState();
    const track = st.addTrack('character', charName);
    if (!track) return;
    const assetId = 'ch-drop-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    st.addCanvasObject({
      type: 'character',
      x: 400, y: 200, width: 220, height: 320,
      rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, zIndex: 10,
      assetId, name: charName,
      characterType: (type as never) || 'custom',
      expression: 'neutral', action: 'idle',
    });
    st.addClip(track.id, assetId, Math.max(0, atTime), 3000);
  } catch { /* ignore */ }
}

const CLIP_COLOR: Record<string, string> = {
  character: 'from-pink-500 to-pink-600',
  background: 'from-green-500 to-green-600',
  prop: 'from-blue-500 to-blue-600',
  text: 'from-yellow-500 to-yellow-600',
  voice: 'from-purple-500 to-purple-600',
  music: 'from-orange-500 to-orange-600',
  sfx: 'from-cyan-500 to-cyan-600',
};

export function Timeline() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const clipDragRef = useRef<{ mode: ClipDragMode; clipId: string; startClientX: number; origStart: number; origDur: number } | null>(null);
  const kfDragRef = useRef<{ clipId: string; kfId: string; startClientX: number; origTime: number } | null>(null);
  const pinchRef = useRef<{ startDist: number; startZoom: number } | null>(null);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [menuSceneId, setMenuSceneId] = useState<string | null>(null);
  const [splitTool, setSplitTool] = useState(false);
  const [selectedKfId, setSelectedKfId] = useState<string | null>(null);
  const [markerMenuId, setMarkerMenuId] = useState<string | null>(null);

  const {
    tracks, clips, currentTime, isPlaying, playbackRate, zoom, currentSceneId,
    togglePlay, seek, setZoom, setPlaybackRate, setCurrentTime,
    scenes, canvasObjects, selectedObjectId, selectedObjectIds, selectObject,
    deleteClip, addKeyframe, setCurrentScene, addScene, renameScene, duplicateScene,
    deleteScene, moveClip, trimClip, setClipDuration, toggleTrackLock, splitClip,
    duplicateClip, undo, redo, history, moveKeyframe, setKeyframeEasing,
    fps, setFps, loopEnabled, loopStart, loopEnd, setLoopRegion,
    snapEnabled, setSnapEnabled, autoKeyframe, setAutoKeyframe,
    rippleEnabled, setRippleEnabled,
    markers, addMarker, deleteMarker, renameMarker, updateKeyframe,
    reorderTracks, deleteTrack,
  } = useEditorStore();

  const currentScene = scenes.find((s) => s.id === currentSceneId);
  const sceneDuration = currentScene?.duration || 5000;
  const sceneTracks = tracks
    .filter((t) => t.sceneId === currentSceneId)
    .sort((a, b) => a.order - b.order);
  const sceneIndex = scenes.findIndex((s) => s.id === currentSceneId);
  const totalDuration = scenes.reduce((t, s) => t + s.duration, 0);

  // -------------------------------------------------------------------------
  // PIXEL SYSTEM — single conversion pair
  // -------------------------------------------------------------------------
  const pps = BASE_PPS * zoom;
  const contentW = Math.max(sceneDuration / 1000 * pps, 800) + 120;

  const timeToX = useCallback((t: number) => (t / 1000) * pps, [pps]);
  const xToTime = useCallback((x: number) => (x / pps) * 1000, [pps]);

  // snap helper: frame snap + playhead snap + clip-edge snap
  const applySnap = useCallback(
    (t: number, edges: number[]): number => {
      if (!snapEnabled) return t;
      let out = t;
      // frame snap
      const frameDur = 1000 / fps;
      out = Math.round(out / frameDur) * frameDur;
      // playhead snap
      if (Math.abs(out - currentTime) < (SNAP_PX / pps) * 1000) out = currentTime;
      // clip edge / boundary snap
      const threshold = (SNAP_PX / pps) * 1000;
      for (const edge of edges) {
        if (Math.abs(out - edge) < threshold) {
          out = edge;
          break;
        }
      }
      return out;
    },
    [snapEnabled, fps, currentTime, pps]
  );

  // all clip edges + scene boundaries for snapping
  const snapEdges = useMemo(() => {
    const edges: number[] = [0, sceneDuration];
    for (const c of clips) {
      if (c.sceneId !== currentSceneId) continue;
      edges.push(c.startTime, c.endTime);
    }
    return edges;
  }, [clips, currentSceneId, sceneDuration]);

  // -------------------------------------------------------------------------
  // Playback — rAF based, EXACT currentTime (no rounding!), loop region aware
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!isPlaying || scenes.length === 0) return;

    const st0 = useEditorStore.getState();
    let globalPos = st0.currentTime;
    for (let i = 0; i < scenes.length; i++) {
      if (scenes[i].id === st0.currentSceneId) break;
      globalPos += scenes[i].duration;
    }
    const playStart = Date.now() - globalPos;
    let animationId: number;
    let lastTick = 0;

    const tick = () => {
      const now = Date.now();
      const st = useEditorStore.getState();
      const rate = st.playbackRate;
      let globalT = ((now - playStart) * rate) % Math.max(1, totalDuration);

      // loop region (per current scene)
      const loop = st.loopEnabled && st.loopEnd > st.loopStart;
      if (loop) {
        const sc = st.scenes.find((s) => s.id === st.currentSceneId);
        const sceneLen = sc?.duration || 5000;
        let acc = 0;
        let idx = 0;
        for (let i = 0; i < st.scenes.length; i++) {
          if (globalT < acc + st.scenes[i].duration) { idx = i; break; }
          acc += st.scenes[i].duration; idx = i;
        }
        const inScene = globalT - acc;
        if (inScene >= st.loopEnd) {
          globalT = globalT - inScene + st.loopStart;
        }
        void sceneLen;
        void idx;
      }

      let acc = 0;
      let idx = 0;
      for (let i = 0; i < scenes.length; i++) {
        if (globalT < acc + scenes[i].duration) { idx = i; break; }
        acc += scenes[i].duration; idx = i;
      }
      const timeInScene = globalT - acc;
      const sc = scenes[idx];

      // exact value — no rounding
      if (now - lastTick >= 33) {
        lastTick = now;
        if (sc && sc.id !== st.currentSceneId) st.setCurrentScene(sc.id);
        if (Math.abs(st.currentTime - timeInScene) > 0.01) {
          st.setCurrentTime(Math.min(timeInScene, sc?.duration || 0));
        }
      }
      animationId = requestAnimationFrame(tick);
    };

    animationId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationId);
  }, [isPlaying, totalDuration, scenes]);

  // auto-scroll during playback: keep playhead visible
  useEffect(() => {
    if (!isPlaying) return;
    const scroll = scrollRef.current;
    if (!scroll) return;
    const px = timeToX(currentTime);
    const vw = scroll.clientWidth;
    if (px > scroll.scrollLeft + vw - 60) {
      scroll.scrollLeft = px - vw * 0.8;
    } else if (px < scroll.scrollLeft + 10) {
      scroll.scrollLeft = Math.max(0, px - 10);
    }
  }, [currentTime, isPlaying, timeToX]);

  // -------------------------------------------------------------------------
  // Time helpers
  // -------------------------------------------------------------------------
  const fmtTime = (ms: number) => {
    const c = Math.max(0, ms);
    const secs = c / 1000;
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const cs = Math.floor((secs % 1) * 100);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
  };

  const frameDur = 1000 / fps;

  // -------------------------------------------------------------------------
  // Ruler / playhead seeking (click + drag scrub)
  // -------------------------------------------------------------------------
  const seekFromClientX = (clientX: number) => {
    const content = contentRef.current;
    const scroll = scrollRef.current;
    if (!content || !scroll) return;
    const rect = content.getBoundingClientRect();
    const x = clientX - rect.left + scroll.scrollLeft;
    const t = Math.max(0, Math.min(xToTime(x), sceneDuration));
    seek(t);
  };

  const handleRulerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setIsDraggingPlayhead(true);
    seekFromClientX(e.clientX);
  };
  const handleRulerMove = (e: React.PointerEvent) => {
    if (!isDraggingPlayhead) return;
    seekFromClientX(e.clientX);
  };
  const handleRulerUp = () => setIsDraggingPlayhead(false);

  // -------------------------------------------------------------------------
  // Clip interactions (move / resize) with snapping
  // -------------------------------------------------------------------------
  const handleClipDown = (e: React.PointerEvent, clip: TimelineClip, mode: ClipDragMode) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    clipDragRef.current = { mode, clipId: clip.id, startClientX: e.clientX, origStart: clip.startTime, origDur: clip.duration };
  };
  const handleClipMove = (e: React.PointerEvent) => {
    const drag = clipDragRef.current;
    if (!drag) return;
    const content = contentRef.current;
    const scroll = scrollRef.current;
    if (!content || !scroll) return;
    const rect = content.getBoundingClientRect();
    const x = e.clientX - rect.left + scroll.scrollLeft;
    const t = xToTime(x);

    if (drag.mode === 'move') {
      const target = applySnap(drag.origStart + (t - xToTime(drag.startClientX - rect.left + scroll.scrollLeft)), snapEdges);
      moveClip(drag.clipId, Math.max(0, Math.min(sceneDuration - drag.origDur, target)));
    } else if (drag.mode === 'trim-l') {
      const target = applySnap(drag.origStart + (t - xToTime(drag.startClientX - rect.left + scroll.scrollLeft)), snapEdges);
      const newStart = Math.max(0, Math.min(drag.origStart + drag.origDur - 200, target));
      trimClip(drag.clipId, newStart, drag.origStart + drag.origDur - newStart);
    } else if (drag.mode === 'trim-r') {
      const newDur = Math.max(200, Math.min(sceneDuration - drag.origStart, drag.origDur + (t - drag.origStart)));
      setClipDuration(drag.clipId, newDur);
    }
  };
  const handleClipUp = () => {
    if (clipDragRef.current) {
      clipDragRef.current = null;
      useEditorStore.getState().commitTransform();
    }
  };

  // -------------------------------------------------------------------------
  // Keyframe dragging (exact time via xToTime)
  // -------------------------------------------------------------------------
  const handleKfDown = (e: React.PointerEvent, clip: TimelineClip, kf: Keyframe) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setSelectedKfId(kf.id);
    kfDragRef.current = { clipId: clip.id, kfId: kf.id, startClientX: e.clientX, origTime: kf.time };
  };
  const handleKfMove = (e: React.PointerEvent, clip: TimelineClip) => {
    const drag = kfDragRef.current;
    if (!drag || drag.clipId !== clip.id) return;
    const content = contentRef.current;
    const scroll = scrollRef.current;
    if (!content || !scroll) return;
    const rect = content.getBoundingClientRect();
    const x = e.clientX - rect.left + scroll.scrollLeft;
    const local = xToTime(x) - clip.startTime;
    const target = applySnap(Math.max(0, local), [currentTime - clip.startTime]);
    moveKeyframe(clip.id, drag.kfId, Math.max(0, Math.min(clip.duration, target)));
  };
  const handleKfUp = () => {
    if (kfDragRef.current) {
      kfDragRef.current = null;
      useEditorStore.getState().commitTransform();
    }
  };

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------
  const handleAddKeyframe = () => {
    const sel = canvasObjects.find((o) => o.id === selectedObjectId);
    if (!sel || !sel.assetId) return;
    const clip = findClipForObject(clips, sel, currentSceneId ?? undefined);
    if (!clip) return;
    const clipTime = currentTime - clip.startTime;
    if (clipTime < 0) return;
    addKeyframe(clip.id, clipTime, objectToKeyframeProperties(sel));
  };

  const selectedClipId = useMemo(() => {
    if (!selectedObjectId) return undefined;
    const obj = canvasObjects.find((o) => o.id === selectedObjectId);
    if (!obj?.assetId) return undefined;
    return clips.find((c) => c.assetId === obj.assetId && c.sceneId === currentSceneId)?.id;
  }, [selectedObjectId, canvasObjects, clips, currentSceneId]);

  const handleSplit = useCallback((clipId?: string, atTime?: number) => {
    const targetClip = clipId || clips.find((c) => c.id === selectedClipId)?.id;
    if (!targetClip) return;
    const clip = clips.find((c) => c.id === targetClip);
    if (!clip) return;
    const t = atTime !== undefined ? atTime : currentTime;
    if (t <= clip.startTime || t >= clip.endTime) return; // safe split rule
    splitClip(targetClip, t);
  }, [clips, selectedClipId, currentTime, splitClip]);

  const stepFrame = useCallback(
    (dir: 1 | -1) => {
      const next = Math.max(0, Math.min(sceneDuration, currentTime + dir * frameDur));
      seek(Math.round(next / frameDur) * frameDur);
    },
    [sceneDuration, currentTime, frameDur, seek]
  );

  let selectedKf: { clip: TimelineClip; kf: Keyframe } | null = null;
  if (selectedKfId) {
    for (const c of clips) {
      const kf = c.keyframes.find((k) => k.id === selectedKfId);
      if (kf) { selectedKf = { clip: c, kf }; break; }
    }
  }

  const fitTimeline = useCallback(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const w = scroll.clientWidth;
    setZoom(Math.max(0.5, Math.min(5, w / (sceneDuration / 1000) / BASE_PPS)));
  }, [sceneDuration, setZoom]);

  const toggleFullscreen = () => {
    try {
      if (!document.fullscreenElement) { void document.documentElement.requestFullscreen?.(); setFullscreen(true); }
      else { void document.exitFullscreen?.(); setFullscreen(false); }
    } catch { setFullscreen((f) => !f); }
  };

  const speedOptions = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

  const iconBtn = (active = false, extra = '') =>
    `w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
      active ? 'editor-gradient text-white' : 'editor-panel-2 text-[var(--editor-text-2)] hover:text-white'
    } ${extra}`;

  const playheadX = timeToX(currentTime);
  const loopStartX = timeToX(loopStart);
  const loopEndX = timeToX(loopEnd);

  return (
    <div className="editor-surface border-t border-[var(--editor-border)] flex flex-col">
      {/* Scene tabs row */}
      <div className="flex items-center gap-2 px-3 pt-2">
        <button onClick={() => sceneIndex > 0 && setCurrentScene(scenes[sceneIndex - 1].id)} className={iconBtn()} disabled={sceneIndex <= 0}>
          <ChevronLeft size={16} />
        </button>
        <div className="flex items-center gap-1 flex-1 editor-scroll overflow-x-auto">
          {scenes.slice().sort((a, b) => a.order - b.order).map((s, i) => (
            <div key={s.id} className="relative shrink-0">
              <button
                onClick={() => setCurrentScene(s.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  s.id === currentSceneId ? 'editor-gradient text-white' : 'editor-panel-2 text-[var(--editor-text-2)] hover:text-white'
                }`}
              >
                Scene {i + 1}
              </button>
              <button
                onClick={() => setMenuSceneId(menuSceneId === s.id ? null : s.id)}
                className="absolute -right-1.5 -top-1.5 w-4 h-4 rounded-full bg-black/70 text-[var(--editor-text-2)] flex items-center justify-center"
              >
                <MoreVertical size={9} />
              </button>
              {menuSceneId === s.id && (
                <div className="absolute left-0 top-8 z-20 editor-panel-2 border border-[var(--editor-border)] rounded-lg shadow-xl p-1 min-w-32">
                  <button onClick={() => { renameScene(s.id, `Scene ${i + 1} (renamed)`); setMenuSceneId(null); }} className="w-full text-left px-2.5 py-1.5 text-xs text-white hover:bg-[var(--editor-panel-3)] rounded">✏️ Rename</button>
                  <button onClick={() => { duplicateScene(s.id); setMenuSceneId(null); }} className="w-full text-left px-2.5 py-1.5 text-xs text-white hover:bg-[var(--editor-panel-3)] rounded">📋 Duplicate</button>
                  <button onClick={() => { deleteScene(s.id); setMenuSceneId(null); }} disabled={scenes.length <= 1} className="w-full text-left px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-500/20 rounded disabled:opacity-40">🗑️ Delete</button>
                </div>
              )}
            </div>
          ))}
          <button onClick={() => addScene()} className="px-3 py-1.5 rounded-lg text-xs border border-dashed border-[#33333F] text-[var(--editor-text-2)] hover:text-white shrink-0 flex items-center gap-1">
            <Plus size={12} /> New Scene
          </button>
        </div>
        <button onClick={() => sceneIndex < scenes.length - 1 && setCurrentScene(scenes[sceneIndex + 1].id)} className={iconBtn()} disabled={sceneIndex >= scenes.length - 1}>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Professional toolbar */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-[var(--editor-border)] overflow-x-auto editor-scroll">
        <button onClick={togglePlay} className="w-9 h-9 rounded-full editor-gradient text-white flex items-center justify-center shrink-0">
          {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
        </button>
        <button onClick={() => stepFrame(-1)} className={iconBtn()} title="Previous frame">
          <GripHorizontal size={14} className="rotate-90" />
        </button>
        <button onClick={() => stepFrame(1)} className={iconBtn()} title="Next frame">
          <GripHorizontal size={14} className="-rotate-90" />
        </button>
        <button onClick={() => { if (scenes.length > 0) setCurrentScene(scenes[0].id); seek(0); }} className={iconBtn()} title="To start">
          <SkipBack size={14} />
        </button>
        <button onClick={() => { if (scenes.length > 0) setCurrentScene(scenes[scenes.length - 1].id); seek(scenes[scenes.length - 1]?.duration || 0); }} className={iconBtn()} title="To end">
          <SkipForward size={14} />
        </button>
        <div className="w-px h-5 bg-[var(--editor-border)]" />
        {/* Split */}
        <button
          onClick={() => { if (!selectedClipId) { setSplitTool((v) => !v); return; } handleSplit(); }}
          className={iconBtn(splitTool, 'relative')}
          title={selectedClipId ? 'Split at playhead' : 'Split tool: tap a clip to cut'}
        >
          <Scissors size={14} />
          {splitTool && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[var(--editor-accent)]" />}
        </button>
        <button onClick={() => selectedClipId && duplicateClip(selectedClipId)} className={iconBtn()} title="Duplicate clip" disabled={!selectedClipId}>
          <Copy size={14} />
        </button>
        <button onClick={() => selectedClipId && deleteClip(selectedClipId)} className={iconBtn()} title="Delete clip" disabled={!selectedClipId}>
          <Trash2 size={14} />
        </button>
        <button onClick={handleAddKeyframe} className={iconBtn()} title="Add keyframe at playhead" disabled={!selectedObjectId}>
          <Diamond size={14} />
        </button>
        <div className="w-px h-5 bg-[var(--editor-border)]" />
        <button onClick={undo} className={iconBtn()} disabled={history.past.length === 0} title="Undo"><Undo2 size={14} /></button>
        <button onClick={redo} className={iconBtn()} disabled={history.future.length === 0} title="Redo"><Redo2 size={14} /></button>
        <div className="w-px h-5 bg-[var(--editor-border)]" />
        {/* Snap */}
        <button onClick={() => setSnapEnabled(!snapEnabled)} className={iconBtn(snapEnabled)} title="Snap on/off">
          <Magnet size={14} />
        </button>
        {/* Ripple edit toggle */}
        <button onClick={() => setRippleEnabled(!rippleEnabled)} className={iconBtn(rippleEnabled)} title="Ripple edit: deleting shifts later clips">
          <span className="text-[11px] font-bold">{rippleEnabled ? 'RPL' : 'rpl'}</span>
        </button>
        {/* Loop region */}
        <button onClick={() => setLoopRegion(currentTime, null)} className={iconBtn(loopEnabled && loopStart === currentTime)} title="Set loop IN at playhead">
          <GripHorizontal size={14} />
        </button>
        <button onClick={() => setLoopRegion(null, currentTime)} className={iconBtn(loopEnabled && loopEnd === currentTime)} title="Set loop OUT at playhead">
          <GripHorizontal size={14} className="rotate-180" />
        </button>
        <button onClick={() => setLoopRegion(null, null)} className={iconBtn(loopEnabled)} title="Loop toggle">
          <Repeat size={14} />
        </button>
        {/* Auto keyframe */}
        <button onClick={() => setAutoKeyframe(!autoKeyframe)} className={iconBtn(autoKeyframe)} title="Auto keyframe">
          <KeyRound size={14} />
        </button>
        {/* Marker */}
        <button onClick={() => addMarker(currentTime, `Marker ${markers.length + 1}`)} className={iconBtn()} title="Add marker at playhead">
          <Flag size={14} />
        </button>
        <div className="w-px h-5 bg-[var(--editor-border)]" />
        {/* Zoom */}
        <button onClick={() => setZoom(Math.max(0.5, zoom - 0.5))} className={iconBtn()} title="Zoom out"><ZoomOut size={14} /></button>
        <span className="text-[10px] text-[var(--editor-text-2)] w-10 text-center">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom(Math.min(5, zoom + 0.5))} className={iconBtn()} title="Zoom in"><ZoomIn size={14} /></button>
        <button onClick={fitTimeline} className={iconBtn()} title="Fit timeline"><RefreshCw size={14} /></button>
        <button onClick={toggleFullscreen} className={iconBtn()} title="Fullscreen">{fullscreen ? <Minimize size={14} /> : <Maximize size={14} />}</button>
        <div className="flex-1" />
        {/* FPS */}
        <select value={fps} onChange={(e) => setFps(parseInt(e.target.value, 10))} className="editor-input px-1.5 py-1 text-[10px]" title="Project FPS">
          {[24, 25, 30, 60].map((f) => <option key={f} value={f} className="bg-[#16161C]">{f} fps</option>)}
        </select>
        {/* Speed */}
        <select value={playbackRate} onChange={(e) => setPlaybackRate(parseFloat(e.target.value))} className="editor-input px-1.5 py-1 text-[10px]" title="Playback speed">
          {speedOptions.map((s) => <option key={s} value={s} className="bg-[#16161C]">{s}x</option>)}
        </select>
      </div>

      {/* Scrollable timeline body */}
      <div
        ref={scrollRef}
        className="editor-scroll overflow-x-auto overflow-y-auto"
        style={{ maxHeight: collapsed ? 0 : '12.5rem', touchAction: 'pan-x pan-y' }}
        onPointerDown={(e) => {
          if (e.pointerType === 'touch' && pinchRef.current) {
            // second finger joins — record pinch start
            pinchRef.current = null;
          }
        }}
        onTouchStartCapture={(e) => {
          if (e.touches.length === 2) {
            const t = e.touches;
            const dist = Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
            pinchRef.current = { startDist: dist, startZoom: zoom };
          }
        }}
        onTouchMoveCapture={(e) => {
          if (e.touches.length === 2 && pinchRef.current) {
            const t = e.touches;
            const dist = Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
            const ratio = dist / pinchRef.current.startDist;
            const next = Math.min(5, Math.max(0.5, pinchRef.current.startZoom * ratio));
            // preserve playhead-centered zoom
            const before = timeToX(currentTime);
            setZoom(Math.round(next * 2) / 2);
            const after = timeToX(currentTime);
            if (scrollRef.current) scrollRef.current.scrollLeft += after - before;
          }
        }}
        onTouchEndCapture={() => { pinchRef.current = null; }}
      >
        <div ref={contentRef} className="relative" style={{ width: contentW, minWidth: '100%' }}>
          {/* Loop region shading */}
          {loopEnabled && loopEnd > loopStart && (
            <div className="absolute top-0 bottom-0 bg-[var(--editor-accent)]/8 pointer-events-none" style={{ left: loopStartX, width: loopEndX - loopStartX }} />
          )}

          {/* RULER */}
          <Ruler
            pps={pps}
            sceneDuration={sceneDuration}
            timeToX={timeToX}
            onDown={handleRulerDown}
            onMove={handleRulerMove}
            onUp={handleRulerUp}
            dragging={isDraggingPlayhead}
          />

          {/* TRACKS */}
          {sceneTracks.map((track) => {
            const trackClips = clips.filter((c) => c.trackId === track.id);
            return (
              <div key={track.id} className="flex border-b border-[var(--editor-border)]">
                {/* label */}
                <div className="w-24 flex-shrink-0 editor-panel px-1 py-0.5 flex items-center gap-0.5 border-r border-[var(--editor-border)] sticky left-0 z-10 group">
                  <span className="text-white text-[9px] truncate flex-1">{track.name}</span>
                  {/* compact reorder controls (hover) */}
                  <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => reorderTracks(track.order, Math.max(0, track.order - 1))} className="w-3.5 h-3 flex items-center justify-center text-[var(--editor-text-2)] hover:text-white" title="Move layer up">
                      <ChevronUp size={9} />
                    </button>
                    <button onClick={() => reorderTracks(track.order, Math.min(sceneTracks.length - 1, track.order + 1))} className="w-3.5 h-3 flex items-center justify-center text-[var(--editor-text-2)] hover:text-white" title="Move layer down">
                      <ChevronDown size={9} />
                    </button>
                  </div>
                  <button onClick={() => toggleTrackLock(track.id)} className={`w-4.5 h-4.5 rounded flex items-center justify-center ${track.locked ? 'bg-[var(--editor-accent-2)] text-white' : 'bg-[var(--editor-panel-3)] text-[var(--editor-text-2)]'}`} title={track.locked ? 'Unlock' : 'Lock'} style={{width:18,height:18}}>
                    {track.locked ? <Lock size={9} /> : <Unlock size={9} />}
                  </button>
                  <button onClick={() => deleteTrack(track.id)} className="w-4 h-4 rounded flex items-center justify-center text-[var(--editor-text-2)] hover:text-red-400" title="Delete layer" style={{width:16,height:16}}>
                    <Trash2 size={9} />
                  </button>
                </div>

                {/* content */}
                <div
                  className="flex-1 relative"
                  style={{ height: 44, backgroundColor: '#14141B' }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    const x = e.clientX - rect.left + (scrollRef.current?.scrollLeft || 0);
                    dropCharacterOntoTrack(e, xToTime(x));
                  }}
                >
                  {/* empty-track seek */}
                  <div
                    className="absolute inset-0"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setIsDraggingPlayhead(true);
                      seekFromClientX(e.clientX);
                    }}
                    onPointerMove={(e) => isDraggingPlayhead && seekFromClientX(e.clientX)}
                    onPointerUp={() => setIsDraggingPlayhead(false)}
                  />

                  {trackClips.map((clip) => {
                    const left = timeToX(clip.startTime);
                    const width = Math.max(3, timeToX(clip.duration));
                    const linked = canvasObjects.find((o) => o.assetId === clip.assetId);
                    const isSelected = selectedClipId === clip.id;
                    const clipColor = CLIP_COLOR[track.type] || CLIP_COLOR.sfx;

                    return (
                      <div
                        key={clip.id}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          selectObject(linked?.id || null);
                          if (splitTool) { handleSplit(clip.id, xToTime(e.clientX - (contentRef.current?.getBoundingClientRect().left || 0) + (scrollRef.current?.scrollLeft || 0))); setSplitTool(false); return; }
                          handleClipDown(e, clip, 'move');
                        }}
                        onPointerMove={(e) => { handleClipMove(e); handleKfMove(e, clip); }}
                        onPointerUp={handleClipUp}
                        onPointerCancel={handleClipUp}
                        className={`absolute top-1 bottom-1 rounded-md cursor-grab active:cursor-grabbing select-none touch-none group bg-gradient-to-b ${clipColor} ${isSelected ? 'ring-2 ring-white' : ''} ${track.locked ? 'opacity-60' : ''}`}
                        style={{ left, width, minWidth: 44 }}
                        title={`${linked?.name || clip.assetId.slice(0, 8)} · ${(clip.startTime / 1000).toFixed(2)}s → ${(clip.endTime / 1000).toFixed(2)}s`}
                      >
                        {!track.locked && (
                          <>
                            <span onPointerDown={(e) => { e.stopPropagation(); selectObject(linked?.id || null); handleClipDown(e, clip, 'trim-l'); }} className="absolute left-0 top-0 bottom-0 w-2.5 cursor-ew-resize bg-black/30 hover:bg-black/50 rounded-l-md" />
                            <span onPointerDown={(e) => { e.stopPropagation(); selectObject(linked?.id || null); handleClipDown(e, clip, 'trim-r'); }} className="absolute right-0 top-0 bottom-0 w-2.5 cursor-ew-resize bg-black/30 hover:bg-black/50 rounded-r-md" />
                          </>
                        )}
                        <div className="px-3 py-1.5 text-white text-[10px] truncate flex items-center gap-1 pointer-events-none">
                          {TRACK_ICON[track.type]}
                          <span className="truncate">{linked?.name || clip.assetId.slice(0, 8)}</span>
                        </div>

                        {/* KEYFRAME DIAMONDS — exact time position, draggable */}
                        {clip.keyframes.map((kf) => (
                          <div
                            key={kf.id}
                            onPointerDown={(e) => handleKfDown(e, clip, kf)}
                            onPointerUp={handleKfUp}
                            className={`absolute top-0 w-3 h-3 -translate-x-1/2 cursor-ew-resize touch-none flex items-center justify-center ${selectedKfId === kf.id ? 'z-20' : 'z-10'}`}
                            style={{ left: timeToX(clip.startTime + kf.time), zIndex: selectedKfId === kf.id ? 30 : 10 }}
                            title={`Keyframe @ ${((clip.startTime + kf.time) / 1000).toFixed(2)}s`}
                          >
                            <span className={`w-2.5 h-2.5 rotate-45 rounded-[2px] ${selectedKfId === kf.id ? 'bg-white ring-2 ring-[var(--editor-accent)]' : 'bg-yellow-300 border border-yellow-600'}`} />
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {sceneTracks.length === 0 && (
            <div className="text-[var(--editor-text-2)] text-center py-6 text-xs">No tracks in this scene</div>
          )}

          {/* MARKERS */}
          {markers.filter((m) => true).map((m) => (
            <div key={m.id} className="absolute top-0 z-20 pointer-events-none" style={{ left: timeToX(m.time) }}>
              <button
                className="pointer-events-auto -translate-x-1/2 mt-[26px] flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#8B5CF6]/80 text-white text-[9px]"
                onClick={() => seek(m.time)}
                title={m.label}
              >
                <Flag size={8} /> {m.label}
              </button>
              <button
                className="pointer-events-auto absolute -translate-x-1/2 left-0 -top-1 w-3.5 h-3.5 rounded-full bg-[#8B5CF6] text-white text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100"
                onClick={() => deleteMarker(m.id)}
                title="Delete marker"
              >
                ✕
              </button>
            </div>
          ))}

          {/* PLAYHEAD — full height, exact position */}
          <div
            className="absolute top-0 bottom-0 z-30 pointer-events-none"
            style={{ left: playheadX }}
          >
            <div className="absolute top-0 bottom-0 w-[2px] -translate-x-1/2 bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.9)]" />
            <div className="absolute top-0 -translate-x-1/2 w-[3px] h-3 bg-red-500" />
            {/* time flag */}
            <div className="absolute top-3 -translate-x-1/2 px-1.5 py-0.5 rounded bg-red-500 text-white text-[9px] font-mono whitespace-nowrap">
              {fmtTime(currentTime)}
            </div>
          </div>
        </div>
      </div>

      {/* Status / current time readout */}
      <div className="px-3 py-1 flex items-center justify-between border-t border-[var(--editor-border)]">
        <span className="font-mono text-[11px] text-white bg-red-500/20 border border-red-500/30 px-2 py-0.5 rounded">
          {fmtTime(currentTime)} / {fmtTime(sceneDuration)}
        </span>
        <div className="flex items-center gap-2 text-[10px] text-[var(--editor-text-2)]">
          {loopEnabled && loopEnd > loopStart && <span className="px-1.5 py-0.5 rounded bg-[var(--editor-accent)]/15 text-[var(--editor-accent)]">LOOP {fmtTime(loopStart)}–{fmtTime(loopEnd)}</span>}
          {splitTool && <span className="px-1.5 py-0.5 rounded bg-[#8B5CF6]/20 text-[#A78BFA]">✂ Split tool — tap a clip</span>}
          {selectedKf && (
            <span className="flex items-center gap-1">
              <Diamond size={10} className="text-yellow-300" />
              {(selectedKf.kf.time / 1000).toFixed(2)}s
              <select
                value={selectedKf.kf.easing}
                onChange={(e) => setKeyframeEasing(selectedKf.clip.id, selectedKf.kf.id, e.target.value as Keyframe['easing'])}
                className="editor-input px-1 py-0.5 text-[9px]"
              >
                <option value="linear">linear</option>
                <option value="ease-in">ease-in</option>
                <option value="ease-out">ease-out</option>
                <option value="ease-in-out">ease-in-out</option>
              </select>
              <button onClick={() => { useEditorStore.getState().deleteKeyframe(selectedKf.clip.id, selectedKf.kf.id); setSelectedKfId(null); }} className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">✕</button>
            </span>
          )}
          <span>{selectedObjectIds.length > 0 ? `${selectedObjectIds.length} selected` : ''}</span>
        </div>
      </div>

      {/* Collapse toggle */}
      <button onClick={() => setCollapsed((c) => !c)} className="flex items-center justify-center w-full py-0.5 text-[var(--editor-text-2)] hover:text-white">
        <ChevronDown size={13} className={`transition-transform ${collapsed ? '' : 'rotate-180'}`} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ruler — adaptive time markers based on zoom (px per second)
// ---------------------------------------------------------------------------

function Ruler({
  pps, sceneDuration, timeToX, onDown, onMove, onUp, dragging,
}: {
  pps: number;
  sceneDuration: number;
  timeToX: (t: number) => number;
  onDown: (e: React.PointerEvent) => void;
  onMove: (e: React.PointerEvent) => void;
  onUp: () => void;
  dragging: boolean;
}) {
  // choose step based on pixels-per-second so labels don't collide
  const stepMs = pps >= 400 ? 100 : pps >= 150 ? 500 : 1000;
  const ticks: { t: number; label: string }[] = [];
  for (let t = 0; t <= sceneDuration + 1; t += stepMs) {
    ticks.push({ t, label: fmtTick(t, stepMs) });
  }

  return (
    <div
      className="relative h-7 editor-panel border-b border-[var(--editor-border)] cursor-pointer touch-none select-none"
      style={{ touchAction: 'none' }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      {ticks.map(({ t, label }) => (
        <div key={t} className="absolute top-0 h-full border-l border-[#33333F]" style={{ left: timeToX(t) }}>
          <span className="pl-1 text-[9px] text-[var(--editor-text-2)]">{label}</span>
        </div>
      ))}
      <div className="absolute inset-y-0 right-0 w-px bg-[#5B8DEF]/60" style={{ left: timeToX(sceneDuration) }} title="Scene end" />
    </div>
  );
}

function fmtTick(ms: number, stepMs: number): string {
  const s = ms / 1000;
  if (stepMs < 1000) {
    const tenth = Math.floor((ms % 1000) / (stepMs === 100 ? 100 : 500));
    return `${Math.floor(s / 60)}:${(Math.floor(s % 60)).toString().padStart(2, '0')}.${stepMs === 100 ? tenth : tenth === 0 ? '0' : '5'}`;
  }
  return `${Math.floor(s / 60)}:${(Math.floor(s % 60)).toString().padStart(2, '0')}`;
}
