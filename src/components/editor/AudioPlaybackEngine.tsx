'use client';

import { useEffect, useRef } from 'react';
import { useEditorStore } from '@/store/editor-store';

/**
 * Plays audio clips (voice / music / sfx) in sync with the timeline.
 * Renders nothing — just a hidden engine.
 */
export function AudioPlaybackEngine() {
  const elsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  const { clips, audioClips, currentTime, isPlaying, currentSceneId, scenes } =
    useEditorStore();

  const scene = scenes.find((s) => s.id === currentSceneId);
  const sceneDuration = scene?.duration || 5000;

  useEffect(() => {
    const els = elsRef.current;

    // Release audio elements on unmount
    return () => {
      els.forEach((el) => {
        el.pause();
        el.src = '';
      });
      els.clear();
    };
  }, []);

  useEffect(() => {
    if (!isPlaying) {
      elsRef.current.forEach((el) => {
        el.pause();
        el.currentTime = 0;
      });
      return;
    }

    const activeClips = clips.filter((c) => c.sceneId === currentSceneId);
    const t = currentTime;

    for (const clip of activeClips) {
      const audio = audioClips.find((a) => a.id === clip.assetId);
      if (!audio || !audio.fileUrl) continue;

      let el = elsRef.current.get(clip.id);
      if (!el) {
        el = new Audio();
        el.preload = 'auto';
        elsRef.current.set(clip.id, el);
      }
      if (el.src !== audio.fileUrl) {
        el.src = audio.fileUrl;
      }

      try {
        if (t >= clip.startTime && t < clip.endTime) {
          const localT = t - clip.startTime;
          const drift = Math.abs(el.currentTime - localT / 1000);
          if (el.paused || drift > 0.35) {
            el.currentTime = localT / 1000;
            void el.play().catch(() => undefined);
          }
        } else {
          if (!el.paused) {
            el.pause();
          }
        }
      } catch {
        // audio element unavailable — ignore
      }
    }

    // if playback finished, stop everything
    if (currentTime >= sceneDuration) {
      elsRef.current.forEach((el) => {
        el.pause();
        el.currentTime = 0;
      });
    }
  }, [isPlaying, currentTime, clips, audioClips, currentSceneId, sceneDuration]);

  return null;
}
