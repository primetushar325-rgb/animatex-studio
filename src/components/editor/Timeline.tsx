'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { objectToKeyframeProperties, findClipForObject } from '@/lib/editor/keyframes';

export function Timeline() {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);

  const {
    tracks,
    clips,
    currentTime,
    isPlaying,
    zoom,
    currentSceneId,
    pause,
    togglePlay,
    seek,
    setZoom,
    setCurrentTime,
    scenes,
    canvasObjects,
    selectedObjectId,
    selectObject,
    deleteClip,
    addKeyframe,
    setCurrentScene,
  } = useEditorStore();

  const currentScene = scenes.find((s) => s.id === currentSceneId);
  const sceneDuration = currentScene?.duration || 5000;
  const sceneTracks = tracks.filter((t) => t.sceneId === currentSceneId);

  // Map assetId -> canvas object name (for readable clip labels)
  const objectByAssetId = new Map<string, { name?: string; type: string }>();
  for (const obj of canvasObjects) {
    if (obj.assetId) objectByAssetId.set(obj.assetId, { name: obj.name, type: obj.type });
  }

  const selectedObject = canvasObjects.find((o) => o.id === selectedObjectId) || null;

  // Playback across ALL scenes (loops through the sequence)
  const totalDuration = scenes.reduce((t, s) => t + s.duration, 0);
  const playStartRef = useRef(0);

  useEffect(() => {
    if (!isPlaying) return;
    if (scenes.length === 0) return;

    // read the initial playhead position without subscribing (avoids restart loops)
    playStartRef.current = Date.now() - useEditorStore.getState().currentTime;
    let animationId: number;

    const tick = () => {
      const globalT = (Date.now() - playStartRef.current) % Math.max(1, totalDuration);

      // find which scene this time falls in
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
      if (sc && sc.id !== currentSceneId) {
        setCurrentScene(sc.id);
      }
      setCurrentTime(Math.min(timeInScene, sc?.duration || 0));
      animationId = requestAnimationFrame(tick);
    };

    animationId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isPlaying, totalDuration, currentSceneId, setCurrentScene, setCurrentTime, scenes]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const frames = Math.floor((ms % 1000) / (1000 / 30));
    return `${minutes}:${seconds.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
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

  const handleClipClick = (e: React.MouseEvent, clipId: string, assetId: string) => {
    e.stopPropagation();
    const obj = canvasObjects.find((o) => o.assetId === assetId && o.sceneId === currentSceneId);
    selectObject(obj ? obj.id : null);
  };

  const handleClipDelete = (e: React.MouseEvent, clipId: string) => {
    e.stopPropagation();
    deleteClip(clipId);
  };

  // Add a keyframe at the playhead for the selected object
  const handleAddKeyframe = useCallback(() => {
    if (!selectedObject || !selectedObject.assetId) return;
    const clip = findClipForObject(clips, selectedObject, currentSceneId ?? undefined);
    if (!clip) return;

    const props = objectToKeyframeProperties(selectedObject);
    const clipTime = currentTime - clip.startTime;
    if (clipTime < 0) return;

    addKeyframe(clip.id, clipTime, props);
  }, [selectedObject, clips, currentSceneId, currentTime, addKeyframe]);

  const handleSeekToStart = () => {
    // go to first scene, time 0
    if (scenes.length > 0) {
      setCurrentScene(scenes[0].id);
    }
    seek(0);
  };

  return (
    <div className="bg-gray-800 border-t border-gray-700 flex flex-col">
      {/* Transport Controls */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-700 overflow-x-auto">
        {/* Play/Pause */}
        <button
          onClick={togglePlay}
          className="w-10 h-10 flex items-center justify-center bg-blue-600 hover:bg-blue-700 rounded-full text-white transition-colors shrink-0"
          title={isPlaying ? 'Pause (Space)' : 'Play all scenes (Space)'}
        >
          {isPlaying ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="5" width="4" height="14" />
              <rect x="14" y="5" width="4" height="14" />
            </svg>
          ) : (
            <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          )}
        </button>

        <button
          onClick={handleSeekToStart}
          className="w-8 h-8 flex items-center justify-center bg-gray-700 hover:bg-gray-600 rounded text-white shrink-0"
          title="Go to start"
        >
          ⏮️
        </button>

        {/* Time Display */}
        <div className="font-mono text-white text-sm bg-gray-900 px-3 py-1 rounded shrink-0">
          {formatTime(currentTime)} / {formatTime(sceneDuration)}
        </div>

        {/* Keyframe button */}
        {selectedObject && selectedObject.assetId && (
          <button
            onClick={handleAddKeyframe}
            className="flex items-center gap-1 px-2 py-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 rounded-lg text-xs font-medium shrink-0 transition-colors"
            title="Add keyframe at playhead for the selected object"
          >
            ◆ Keyframe
          </button>
        )}

        {/* Zoom Controls */}
        <div className="flex items-center gap-2 ml-auto shrink-0">
          <button
            onClick={() => setZoom(Math.max(0.5, zoom - 0.5))}
            className="w-8 h-8 flex items-center justify-center bg-gray-700 hover:bg-gray-600 rounded text-white"
          >
            -
          </button>
          <span className="text-white text-sm w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(Math.min(5, zoom + 0.5))}
            className="w-8 h-8 flex items-center justify-center bg-gray-700 hover:bg-gray-600 rounded text-white"
          >
            +
          </button>
        </div>
      </div>

      {/* Timeline Ruler */}
      <div
        ref={timelineRef}
        className="relative h-6 bg-gray-700 cursor-pointer overflow-hidden"
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
          <div
            key={i}
            className="absolute top-0 h-full border-l border-gray-500 text-xs text-gray-400 pl-1"
            style={{ left: `${(i * 1000) / sceneDuration}%` }}
          >
            {i}s
          </div>
        ))}

        {/* Playhead */}
        <div
          className="absolute top-0 h-full w-0.5 bg-red-500 z-10"
          style={{ left: `${(currentTime / sceneDuration) * 100}%` }}
        >
          <div className="absolute -top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-500 transform rotate-45"></div>
        </div>
      </div>

      {/* Tracks */}
      <div className="flex-1 overflow-y-auto max-h-48">
        {sceneTracks.map((track) => {
          const trackClips = clips.filter((c) => c.trackId === track.id);

          return (
            <div key={track.id} className="flex border-b border-gray-700">
              {/* Track Label */}
              <div className="w-28 flex-shrink-0 bg-gray-800 p-2 flex items-center gap-2 border-r border-gray-700">
                <button
                  className={`w-4 h-4 rounded flex items-center justify-center text-xs ${
                    track.visible ? 'bg-green-500' : 'bg-gray-600'
                  }`}
                  title={track.visible ? 'Hide' : 'Show'}
                >
                  👁
                </button>
                <button
                  className={`w-4 h-4 rounded flex items-center justify-center text-xs ${
                    track.muted ? 'bg-red-500' : 'bg-gray-600'
                  }`}
                  title={track.muted ? 'Unmute' : 'Mute'}
                >
                  🔇
                </button>
                <span className="text-white text-xs truncate flex-1">{track.name}</span>
              </div>

              {/* Track Content */}
              <div className="flex-1 relative h-12 bg-gray-750" style={{ backgroundColor: '#374151' }}>
                {trackClips.map((clip) => {
                  const left = (clip.startTime / sceneDuration) * 100;
                  const width = (clip.duration / sceneDuration) * 100;
                  const linked = objectByAssetId.get(clip.assetId);
                  const isSelected =
                    selectedObjectId != null &&
                    canvasObjects.find(
                      (o) => o.id === selectedObjectId && o.assetId === clip.assetId
                    ) != null;

                  return (
                    <div
                      key={clip.id}
                      onClick={(e) => handleClipClick(e, clip.id, clip.assetId)}
                      className={`absolute top-1 bottom-1 rounded cursor-pointer transition-all group ${
                        track.type === 'character'
                          ? 'bg-pink-500 hover:bg-pink-400'
                          : track.type === 'background'
                          ? 'bg-green-500 hover:bg-green-400'
                          : track.type === 'prop'
                          ? 'bg-blue-500 hover:bg-blue-400'
                          : track.type === 'text'
                          ? 'bg-yellow-500 hover:bg-yellow-400'
                          : track.type === 'voice'
                          ? 'bg-purple-500 hover:bg-purple-400'
                          : track.type === 'music'
                          ? 'bg-orange-500 hover:bg-orange-400'
                          : 'bg-cyan-500 hover:bg-cyan-400'
                      } ${isSelected ? 'ring-2 ring-white' : ''}`}
                      style={{
                        left: `${left}%`,
                        width: `${Math.max(width, 2)}%`,
                        minWidth: '28px',
                      }}
                      title={`${linked?.name || clip.assetId.slice(0, 8)} — click to select`}
                    >
                      <div className="px-2 py-1 text-white text-xs truncate flex items-center gap-1">
                        <span className="truncate">
                          {linked?.name || clip.assetId.slice(0, 8)}
                        </span>
                        {isSelected && (
                          <button
                            onClick={(e) => handleClipDelete(e, clip.id)}
                            className="ml-auto w-4 h-4 rounded bg-black/30 hover:bg-red-600 text-[10px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete clip"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      {/* Keyframe diamonds */}
                      {clip.keyframes.map((kf) => (
                        <div
                          key={kf.id}
                          className="absolute -top-0.5 w-2.5 h-2.5 bg-yellow-300 border border-yellow-600 rounded-[2px] rotate-45"
                          style={{
                            left: `${((clip.startTime + kf.time) / sceneDuration) * 100}%`,
                          }}
                          title={`Keyframe @ ${(kf.time / 1000).toFixed(1)}s`}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {sceneTracks.length === 0 && (
          <div className="text-gray-500 text-center py-8">No tracks in this scene</div>
        )}
      </div>
    </div>
  );
}
