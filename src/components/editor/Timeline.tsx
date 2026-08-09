'use client';

import { useRef, useState, useEffect } from 'react';
import { useEditorStore } from '@/store/editor-store';

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
  } = useEditorStore();

  const currentScene = scenes.find((s) => s.id === currentSceneId);
  const sceneDuration = currentScene?.duration || 5000;
  const sceneTracks = tracks.filter((t) => t.sceneId === currentSceneId);

  // Map assetId -> canvas object name (for readable clip labels)
  const objectByAssetId = new Map<string, { name?: string; type: string }>();
  for (const obj of canvasObjects) {
    if (obj.assetId) objectByAssetId.set(obj.assetId, { name: obj.name, type: obj.type });
  }

  // Playback timer
  useEffect(() => {
    if (!isPlaying) return;

    const startTime = Date.now() - currentTime;
    let animationId: number;

    const tick = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed >= sceneDuration) {
        setCurrentTime(0);
        pause();
      } else {
        setCurrentTime(elapsed);
        animationId = requestAnimationFrame(tick);
      }
    };

    animationId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isPlaying, currentTime, sceneDuration, setCurrentTime, pause]);

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

  // Clicking a clip selects the matching canvas object
  const handleClipClick = (e: React.MouseEvent, clipId: string, assetId: string) => {
    e.stopPropagation();
    const obj = canvasObjects.find((o) => o.assetId === assetId && o.sceneId === currentSceneId);
    if (obj) {
      selectObject(obj.id);
    } else {
      selectObject(null);
    }
  };

  const handleClipDelete = (e: React.MouseEvent, clipId: string) => {
    e.stopPropagation();
    deleteClip(clipId);
  };

  return (
    <div className="bg-gray-800 border-t border-gray-700 flex flex-col">
      {/* Transport Controls */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-gray-700">
        {/* Play/Pause */}
        <button
          onClick={togglePlay}
          className="w-10 h-10 flex items-center justify-center bg-blue-600 hover:bg-blue-700 rounded-full text-white transition-colors"
          title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
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

        {/* Time Display */}
        <div className="font-mono text-white text-sm bg-gray-900 px-3 py-1 rounded">
          {formatTime(currentTime)} / {formatTime(sceneDuration)}
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-2 ml-auto">
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
        {/* Time markers */}
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
                        <span className="truncate">{linked?.name || clip.assetId.slice(0, 8)}</span>
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
