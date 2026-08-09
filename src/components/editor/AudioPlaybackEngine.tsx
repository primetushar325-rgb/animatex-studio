'use client';

import { useEffect, useRef } from 'react';
import { useEditorStore } from '@/store/editor-store';

/**
 * Plays audio clips (voice / music / sfx) in sync with the timeline and
 * computes a live lip-sync level (0..1) for "talk" characters.
 *
 * Implemented as ONE rAF loop that reads the store via getState() — no React
 * effect churn per frame, and it never restarts when the scene changes
 * (fixes audio/video playback glitches).
 */
export function AudioPlaybackEngine() {
  const elsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const analysersRef = useRef<Map<string, AnalyserNode>>(new Map());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  // ---------------------------------------------------------------------------
  // analyser helpers
  // ---------------------------------------------------------------------------

  const getCtx = () => {
    if (audioCtxRef.current) return audioCtxRef.current;
    const AC =
      typeof window !== 'undefined'
        ? window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        : undefined;
    if (!AC) return null;
    const ctx = new AC();
    audioCtxRef.current = ctx;
    return ctx;
  };

  const ensureAnalyser = (clipId: string, el: HTMLAudioElement) => {
    if (analysersRef.current.has(clipId)) return analysersRef.current.get(clipId)!;
    const ctx = getCtx();
    if (!ctx) return null;
    try {
      const source = ctx.createMediaElementSource(el);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      analysersRef.current.set(clipId, analyser);
      return analyser;
    } catch {
      return null; // element already connected to another source
    }
  };

  // ---------------------------------------------------------------------------
  // single loop
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const els = elsRef.current;
    const analysers = analysersRef.current;

    const stopAll = () => {
      elsRef.current.forEach((el) => {
        el.pause();
        el.currentTime = 0;
      });
    };

    const tick = () => {
      const st = useEditorStore.getState();

      if (!st.isPlaying) {
        stopAll();
        if (st.lipSyncLevel !== 0) st.setLipSyncLevel(0);
        rafRef.current = null;
        return;
      }

      const scene = st.scenes.find((s) => s.id === st.currentSceneId);
      const sceneDuration = scene?.duration || 5000;
      const activeClips = st.clips.filter((c) => c.sceneId === st.currentSceneId);
      const t = st.currentTime;

      let maxLevel = 0;

      for (const clip of activeClips) {
        const audio = st.audioClips.find((a) => a.id === clip.assetId);
        if (!audio || !audio.fileUrl) continue;

        let el = elsRef.current.get(clip.id);
        if (!el) {
          el = new Audio();
          el.preload = 'auto';
          elsRef.current.set(clip.id, el);
        }
        if (el.src !== audio.fileUrl) {
          el.src = audio.fileUrl;
          analysersRef.current.delete(clip.id);
        }

        try {
          if (t >= clip.startTime && t < clip.endTime) {
            const localT = (t - clip.startTime) / 1000;
            const drift = Math.abs(el.currentTime - localT);
            if (el.paused || drift > 0.35) {
              el.currentTime = localT;
              void el.play().catch(() => undefined);
            }
            const analyser = ensureAnalyser(clip.id, el);
            if (analyser) {
              const data = new Uint8Array(analyser.frequencyBinCount);
              analyser.getByteTimeDomainData(data);
              let sum = 0;
              for (let i = 0; i < data.length; i++) {
                const v = (data[i] - 128) / 128;
                sum += v * v;
              }
              maxLevel = Math.max(maxLevel, Math.sqrt(sum / data.length));
            }
          } else if (!el.paused) {
            el.pause();
            el.currentTime = 0;
          }
        } catch {
          // ignore per-clip errors
        }
      }

      // update lip-sync level (only meaningful when something is playing)
      const level = maxLevel > 0.015 ? Math.min(1, (maxLevel - 0.02) * 2.6) : 0;
      if (Math.abs(st.lipSyncLevel - level) > 0.012) st.setLipSyncLevel(level);

      // stop everything at the very end of the scene
      if (t >= sceneDuration) {
        stopAll();
        if (st.lipSyncLevel !== 0) st.setLipSyncLevel(0);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      els.forEach((el) => {
        el.pause();
        el.src = '';
      });
      els.clear();
      analysers.clear();
      const ctx = audioCtxRef.current;
      if (ctx) void ctx.close().catch(() => undefined);
      audioCtxRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
