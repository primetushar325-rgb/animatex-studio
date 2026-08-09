'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Plus,
  MoreVertical,
  Copy,
  Scissors,
  Diamond,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize,
  Minimize,
  Lock,
  Unlock,
  Eye,
  User,
  Image as ImageIcon,
  Box,
  Type,
  Mic,
  Music,
  Volume2,
  ChevronDown,
} from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
import { objectToKeyframeProperties, findClipForObject } from '@/lib/editor/keyframes';

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

export function Timeline() {
  const timelineRef = useRef<HTMLDivElement>(null);
  const trackAreaRef = useRef<HTMLDivElement | null>(null);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [menuSceneId, setMenuSceneId] = useState<string | null>(null);
  const clipDragRef = useRef<{ mode: ClipDragMode; clipId: string; startClientX: number; origStart: number; origDur: number } | null>(null);

  const {
    tracks,
    clips,
    currentTime,
    isPlaying,
    playbackRate,
    zoom,
    currentSceneId,
    togglePlay,
    seek,
    setZoom,
    setPlaybackRate,
    setCurrentTime,
    scenes,
    canvasObjects,
    selectedObjectId,
    selectedObjectIds,
    selectObject,
    deleteClip,
    addKeyframe,
    setCurrentScene,
    addScene,
    renameScene,
    duplicateScene,
    deleteScene,
    moveClip,
    trimClip,
    toggleTrackLock,
    splitClip,
    duplicateClip,
    undo,
    redo,
    history,
  } = useEditorStore();

  const currentScene = scenes.find((s) => s.id === currentSceneId);
  const sceneDuration = currentScene?.duration || 5000;
  const sceneTracks = tracks
    .filter((t) => t.sceneId === currentSceneId)
    .sort((a, b) => a.order - b.order);
  const sceneIndex = scenes.findIndex((s) => s.id === currentSceneId);

  const objectByAssetId = new Map<string, { name?: string; type: string }>();
  for (const obj of canvasObjects) {
    if (obj.assetId) objectByAssetId.set(obj.assetId, { name: obj.name, type: obj.type });
  }

  const selectedObject = canvasObjects.find((o) => o.id === selectedObjectId) || null;
  const selectedClipId = selectedObject?.assetId
    ? clips.find((c) => c.assetId === selectedObject.assetId && c.sceneId === currentSceneId)?.id
    : undefined;

  // ---------------------------------------------------------------------------
  // Playback across ALL scenes — wall-clock driven, rate-aware, never restarts
  // ---------------------------------------------------------------------------
  const totalDuration = scenes.reduce((t, s) => t + s.duration, 0);

  useEffect(() => {
    if (!isPlaying || scenes.length === 0) return;

    const playStart = Date.now() - useEditorStore.getState().currentTime;
    let animationId: number;
    let lastTick = 0;

    const tick = () => {
      const now = Date.now();
      const rate = useEditorStore.getState().playbackRate;
      const globalT = ((now - playStart) * rate) % Math.max(1, totalDuration);

      let acc = 0;
      let idx = 0;
      for (let i = 0; i < scenes.length; i++) {
        if (globalT < acc + scenes[i].duration) {
          idx = i;
          break;
        }
        acc += scenes[i].duration;
        idx = i;
      }
      const timeInScene = globalT - acc;
      const sc = scenes[idx];
      const st = useEditorStore.getState();

      if (now - lastTick >= 33) {
        lastTick = now;
        if (sc && sc.id !== st.currentSceneId) st.setCurrentScene(sc.id);
        const rounded = Math.round(timeInScene);
        if (Math.abs(st.currentTime - rounded) > 0.5) {
          st.setCurrentTime(Math.min(rounded, sc?.duration || 0));
        }
      }
      animationId = requestAnimationFrame(tick);
    };

    animationId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationId);
  }, [isPlaying, totalDuration, scenes]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleTimelineClick = (e: React.MouseEvent | React.TouchEvent) => {
    const timeline = timelineRef.current;
    if (!timeline) return;
    const rect = timeline.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const x = clientX - rect.left;
    const time = Math.max(0, Math.min((x / rect.width) * sceneDuration, sceneDuration));
    seek(time);
  };

  const handlePlayheadDrag = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDraggingPlayhead) return;
    handleTimelineClick(e);
  };

  const handleClipClick = (e: React.MouseEvent, assetId: string) => {
    e.stopPropagation();
    const obj = canvasObjects.find((o) => o.assetId === assetId && o.sceneId === currentSceneId);
    selectObject(obj ? obj.id : null);
  };

  const pxToMs = (px: number) => (px / (trackAreaRef.current?.clientWidth || 1)) * sceneDuration;

  const handleClipPointerDown = (e: React.PointerEvent, clipId: string, mode: ClipDragMode) => {
    e.stopPropagation();
    const clip = clips.find((c) => c.id === clipId);
    if (!clip) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    clipDragRef.current = { mode, clipId, startClientX: e.clientX, origStart: clip.startTime, origDur: clip.duration };
  };

  const handleClipPointerMove = (e: React.PointerEvent) => {
    const drag = clipDragRef.current;
    if (!drag) return;
    const dxMs = pxToMs(e.clientX - drag.startClientX);

    if (drag.mode === 'move') {
      const newStart = Math.max(0, Math.min(sceneDuration - drag.origDur, drag.origStart + dxMs));
      moveClip(drag.clipId, newStart);
    } else if (drag.mode === 'trim-l') {
      const newStart = Math.max(0, Math.min(drag.origStart + drag.origDur - 200, drag.origStart + dxMs));
      trimClip(drag.clipId, newStart, drag.origStart + drag.origDur - newStart);
    } else if (drag.mode === 'trim-r') {
      const newDur = Math.max(200, Math.min(sceneDuration - drag.origStart, drag.origDur + dxMs));
      trimClip(drag.clipId, drag.origStart, newDur);
    }
  };

  const handleClipPointerUp = () => {
    clipDragRef.current = null;
  };

  const handleDuplicateClip = () => {
    if (selectedClipId) duplicateClip(selectedClipId);
  };

  const handleCutClip = () => {
    if (selectedClipId && currentTime > 0) splitClip(selectedClipId, currentTime);
  };

  const handleAddKeyframe = useCallback(() => {
    if (!selectedObject || !selectedObject.assetId) return;
    const clip = findClipForObject(clips, selectedObject, currentSceneId ?? undefined);
    if (!clip) return;
    const clipTime = currentTime - clip.startTime;
    if (clipTime < 0) return;
    addKeyframe(clip.id, clipTime, objectToKeyframeProperties(selectedObject));
  }, [selectedObject, clips, currentSceneId, currentTime, addKeyframe]);

  const toggleFullscreen = () => {
    try {
      if (!document.fullscreenElement) {
        void document.documentElement.requestFullscreen?.();
        setFullscreen(true);
      } else {
        void document.exitFullscreen?.();
        setFullscreen(false);
      }
    } catch {
      setFullscreen((f) => !f);
    }
  };

  const resetView = () => setZoom(1);
  const speedOptions = [0.5, 1, 1.5, 2];

  const goPrevScene = () => {
    if (sceneIndex > 0) setCurrentScene(scenes[sceneIndex - 1].id);
  };
  const goNextScene = () => {
    if (sceneIndex < scenes.length - 1) setCurrentScene(scenes[sceneIndex + 1].id);
  };

  const toolbarIcon =
    'w-8 h-8 flex items-center justify-center rounded-lg editor-panel-2 text-[var(--editor-text-2)] hover:text-white transition-colors disabled:opacity-40';
  const toolbarIconActive = (active: boolean) =>
    `w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
      active ? 'editor-gradient text-white' : 'editor-panel-2 text-[var(--editor-text-2)] hover:text-white'
    }`;

  return (
    <div className="editor-surface border-t border-[var(--editor-border)] flex flex-col">
      {/* Scene tabs row */}
      <div className="flex items-center gap-2 px-3 pt-2">
        <button onClick={goPrevScene} className={toolbarIcon} title="Previous scene" disabled={sceneIndex <= 0}>
          <ChevronLeft size={16} />
        </button>

        <div className="flex items-center gap-1 flex-1 editor-scroll overflow-x-auto">
          {scenes
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((s, i) => (
              <div key={s.id} className="relative shrink-0">
                <button
                  onClick={() => setCurrentScene(s.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    s.id === currentSceneId
                      ? 'editor-gradient text-white'
                      : 'editor-panel-2 text-[var(--editor-text-2)] hover:text-white'
                  }`}
                >
                  Scene {i + 1}
                </button>
                <button
                  onClick={() => setMenuSceneId(menuSceneId === s.id ? null : s.id)}
                  className="absolute -right-1.5 -top-1.5 w-4 h-4 rounded-full bg-black/70 text-[var(--editor-text-2)] text-[9px] flex items-center justify-center"
                  title="Scene menu"
                >
                  <MoreVertical size={9} />
                </button>
                {menuSceneId === s.id && (
                  <div className="absolute left-0 top-8 z-20 editor-panel-2 border border-[var(--editor-border)] rounded-lg shadow-xl p-1 min-w-32">
                    <button onClick={() => { renameScene(s.id, `Scene ${i + 1} (renamed)`); setMenuSceneId(null); }} className="w-full text-left px-2.5 py-1.5 text-xs text-white hover:bg-[var(--editor-panel-3)] rounded">
                      ✏️ Rename
                    </button>
                    <button onClick={() => { duplicateScene(s.id); setMenuSceneId(null); }} className="w-full text-left px-2.5 py-1.5 text-xs text-white hover:bg-[var(--editor-panel-3)] rounded">
                      📋 Duplicate
                    </button>
                    <button onClick={() => { deleteScene(s.id); setMenuSceneId(null); }} disabled={scenes.length <= 1} className="w-full text-left px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-500/20 rounded disabled:opacity-40">
                      🗑️ Delete
                    </button>
                  </div>
                )}
              </div>
            ))}

          <button onClick={() => addScene()} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-dashed border-[#33333F] text-[var(--editor-text-2)] hover:text-white hover:border-[var(--editor-accent)] transition-colors shrink-0 flex items-center gap-1">
            <Plus size={12} /> New Scene
          </button>
        </div>

        <button onClick={goNextScene} className={toolbarIcon} title="Next scene" disabled={sceneIndex >= scenes.length - 1}>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Timeline toolbar */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-[var(--editor-border)] overflow-x-auto">
        <button onClick={handleDuplicateClip} className={toolbarIcon} title="Duplicate clip" disabled={!selectedClipId}>
          <Copy size={15} />
        </button>
        <button onClick={handleCutClip} className={toolbarIcon} title="Cut clip at playhead" disabled={!selectedClipId}>
          <Scissors size={15} />
        </button>
        <button onClick={handleAddKeyframe} className={toolbarIcon} title="Add keyframe" disabled={!selectedObject?.assetId}>
          <Diamond size={15} />
        </button>
        <div className="w-px h-5 bg-[var(--editor-border)]" />
        <button onClick={undo} className={toolbarIcon} title="Undo" disabled={history.past.length === 0}>
          <Undo2 size={15} />
        </button>
        <button onClick={redo} className={toolbarIcon} title="Redo" disabled={history.future.length === 0}>
          <Redo2 size={15} />
        </button>
        <div className="w-px h-5 bg-[var(--editor-border)]" />
        <button onClick={() => setZoom(Math.max(0.5, zoom - 0.5))} className={toolbarIcon} title="Zoom out">
          <ZoomOut size={15} />
        </button>
        <span className="text-[10px] text-[var(--editor-text-2)] w-9 text-center">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom(Math.min(5, zoom + 0.5))} className={toolbarIcon} title="Zoom in">
          <ZoomIn size={15} />
        </button>
        <button onClick={resetView} className={toolbarIcon} title="Reset view">
          <RotateCcw size={15} />
        </button>
        <div className="flex-1" />
        <button onClick={toggleFullscreen} className={toolbarIcon} title="Fullscreen">
          {fullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
        </button>
      </div>

      {/* Playback controls */}
      <div className="flex items-center gap-2 px-3 py-1.5">
        <button onClick={() => { if (scenes.length > 0) setCurrentScene(scenes[0].id); seek(0); }} className={toolbarIcon} title="Skip to start">
          <SkipBack size={16} />
        </button>
        <button
          onClick={togglePlay}
          className="w-9 h-9 flex items-center justify-center rounded-full editor-gradient text-white shadow-lg transition-transform active:scale-95"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
        </button>
        <button onClick={() => { if (scenes.length > 0) setCurrentScene(scenes[scenes.length - 1].id); seek(scenes[scenes.length - 1]?.duration || 0); }} className={toolbarIcon} title="Skip to end">
          <SkipForward size={16} />
        </button>
        <span className="font-mono text-[11px] text-[var(--editor-text-2)] bg-[var(--editor-panel-2)] px-2 py-1 rounded">
          {formatTime(currentTime)} / {formatTime(sceneDuration)}
        </span>

        <div className="flex-1" />

        <div className="flex items-center gap-0.5">
          {speedOptions.map((s) => (
            <button key={s} onClick={() => setPlaybackRate(s)} className={toolbarIconActive(playbackRate === s)} title={`${s}x speed`}>
              <span className="text-[10px] font-semibold">{s === 1 ? '1x' : `${s}x`}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Collapsible toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center justify-center w-full py-1 text-[var(--editor-text-2)] hover:text-white transition-colors"
        title={collapsed ? 'Expand timeline' : 'Collapse timeline'}
      >
        <ChevronDown size={14} className={`transition-transform ${collapsed ? '' : 'rotate-180'}`} />
      </button>

      {!collapsed && (
        <>
          {/* Time ruler */}
          <div
            ref={timelineRef}
            className="relative h-6 bg-[var(--editor-panel)] cursor-pointer overflow-hidden border-b border-[var(--editor-border)]"
            onClick={handleTimelineClick}
            onMouseDown={() => setIsDraggingPlayhead(true)}
            onMouseMove={handlePlayheadDrag}
            onMouseUp={() => setIsDraggingPlayhead(false)}
            onMouseLeave={() => setIsDraggingPlayhead(false)}
            onTouchStart={() => setIsDraggingPlayhead(true)}
            onTouchMove={handlePlayheadDrag}
            onTouchEnd={() => setIsDraggingPlayhead(false)}
          >
            {Array.from({ length: Math.ceil(sceneDuration / 1000) + 1 }).map((_, i) => (
              <div key={i} className="absolute top-0 h-full border-l border-[#33333F] text-[9px] text-[var(--editor-text-2)] pl-1" style={{ left: `${(i * 1000) / sceneDuration}%` }}>
                {i}s
              </div>
            ))}
            <div className="absolute top-0 h-full w-0.5 bg-red-400 z-10" style={{ left: `${(currentTime / sceneDuration) * 100}%` }}>
              <div className="absolute -top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-400 transform rotate-45"></div>
            </div>
          </div>

          {/* Tracks */}
          <div className="editor-scroll overflow-y-auto" style={{ maxHeight: '9.5rem' }}>
            {sceneTracks.map((track) => {
              const trackClips = clips.filter((c) => c.trackId === track.id);

              return (
                <div key={track.id} className="flex border-b border-[var(--editor-border)]">
                  <div className="w-28 flex-shrink-0 editor-panel p-1.5 flex items-center gap-1.5 border-r border-[var(--editor-border)]">
                    <button
                      onClick={() => toggleTrackLock(track.id)}
                      className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                        track.locked ? 'bg-[var(--editor-accent-2)] text-white' : 'bg-[var(--editor-panel-3)] text-[var(--editor-text-2)]'
                      }`}
                      title={track.locked ? 'Unlock track' : 'Lock track'}
                    >
                      {track.locked ? <Lock size={10} /> : <Unlock size={10} />}
                    </button>
                    <button
                      className={`w-5 h-5 rounded flex items-center justify-center ${
                        track.visible ? 'bg-green-500/70 text-white' : 'bg-[var(--editor-panel-3)] text-[var(--editor-text-2)]'
                      }`}
                      title={track.visible ? 'Hide' : 'Show'}
                    >
                      <Eye size={10} />
                    </button>
                    <span className="text-white text-[10px] truncate flex-1">{track.name}</span>
                  </div>

                  <div ref={trackAreaRef} className="flex-1 relative h-12" style={{ backgroundColor: '#14141B' }}>
                    {trackClips.map((clip) => {
                      const left = (clip.startTime / sceneDuration) * 100;
                      const width = (clip.duration / sceneDuration) * 100;
                      const linked = objectByAssetId.get(clip.assetId);
                      const isSelected =
                        selectedObjectId != null &&
                        canvasObjects.find((o) => o.id === selectedObjectId && o.assetId === clip.assetId) != null;
                      const clipColor =
                        track.type === 'character' ? 'from-pink-500 to-pink-600'
                        : track.type === 'background' ? 'from-green-500 to-green-600'
                        : track.type === 'prop' ? 'from-blue-500 to-blue-600'
                        : track.type === 'text' ? 'from-yellow-500 to-yellow-600'
                        : track.type === 'voice' ? 'from-purple-500 to-purple-600'
                        : track.type === 'music' ? 'from-orange-500 to-orange-600'
                        : 'from-cyan-500 to-cyan-600';

                      return (
                        <div
                          key={clip.id}
                          onPointerDown={(e) => handleClipPointerDown(e, clip.id, 'move')}
                          onPointerMove={handleClipPointerMove}
                          onPointerUp={handleClipPointerUp}
                          onPointerCancel={handleClipPointerUp}
                          onClick={(e) => handleClipClick(e, clip.assetId)}
                          className={`absolute top-1 bottom-1 rounded-md cursor-grab active:cursor-grabbing transition-colors select-none touch-none group bg-gradient-to-b ${clipColor} ${
                            isSelected ? 'ring-2 ring-white' : ''
                          } ${track.locked ? 'opacity-60' : ''}`}
                          style={{ left: `${left}%`, width: `${Math.max(width, 3)}%`, minWidth: '44px' }}
                          title={`${linked?.name || clip.assetId.slice(0, 8)} — drag to move, edges to trim`}
                        >
                          {!track.locked && (
                            <>
                              <span onPointerDown={(e) => { e.stopPropagation(); handleClipPointerDown(e, clip.id, 'trim-l'); }} className="absolute left-0 top-0 bottom-0 w-2.5 cursor-ew-resize bg-black/30 hover:bg-black/50 rounded-l-md" />
                              <span onPointerDown={(e) => { e.stopPropagation(); handleClipPointerDown(e, clip.id, 'trim-r'); }} className="absolute right-0 top-0 bottom-0 w-2.5 cursor-ew-resize bg-black/30 hover:bg-black/50 rounded-r-md" />
                            </>
                          )}

                          <div className="px-3 py-1.5 text-white text-[10px] truncate flex items-center gap-1 pointer-events-none">
                            <span>{TRACK_ICON[track.type]}</span>
                            <span className="truncate">{linked?.name || clip.assetId.slice(0, 8)}</span>
                          </div>

                          {clip.keyframes.map((kf) => (
                            <div key={kf.id} className="absolute -top-0.5 w-2.5 h-2.5 bg-yellow-300 border border-yellow-600 rounded-[2px] rotate-45" style={{ left: `${((clip.startTime + kf.time) / sceneDuration) * 100}%` }} title={`Keyframe @ ${(kf.time / 1000).toFixed(1)}s`} />
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
          </div>

          <div className="px-3 py-1 flex items-center justify-between border-t border-[var(--editor-border)]">
            <span className="font-mono text-[11px] text-[var(--editor-text-2)]">{formatTime(currentTime)}</span>
            <span className="text-[9px] text-[var(--editor-text-2)]">
              {selectedObjectIds.length > 0 ? `${selectedObjectIds.length} selected` : 'drag clips to edit'}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
