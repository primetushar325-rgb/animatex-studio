'use client';

import { useEffect, useRef } from 'react';
import { useEditorStore } from '@/store/editor-store';

interface AnalyserEntry {
  analyser: AnalyserNode;
  data: Uint8Array<ArrayBuffer>;
  audio: HTMLAudioElement;
}

/**
 * Plays audio clips (voice / music / sfx) in sync with the timeline,
 * and computes a live lip-sync level (0..1) from the audio amplitude so
 * 'talk' characters move their mouths with the voice.
 * Renders nothing — just a hidden engine.
 */
export function AudioPlaybackEngine() {
  const elsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const analysersRef = useRef<Map<string, AnalyserEntry>>(new Map());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  const { clips, audioClips, currentTime, isPlaying, currentSceneId, scenes, setLipSyncLevel } =
    useEditorStore();

  const scene = scenes.find((s) => s.id === currentSceneId);
  const sceneDuration = scene?.duration || 5000;

  // get or create an analyser for an audio element
  const getAnalyser = (clipId: string, el: HTMLAudioElement) => {
    const existing = analysersRef.current.get(clipId);
    if (existing) return existing;

    let ctx = audioCtxRef.current;
    if (!ctx) {
      const AC =
        typeof window !== 'undefined'
          ? window.AudioContext ||
            (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
          : undefined;
      if (!AC) return null;
      ctx = new AC();
      audioCtxRef.current = ctx;
    }
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);

    try {
      const source = ctx.createMediaElementSource(el);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.55;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      const entry: AnalyserEntry = {
        analyser,
        data: new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount)),
        audio: el,
      };
      analysersRef.current.set(clipId, entry);
      return entry;
    } catch {
      return null; // element already connected elsewhere — skip analysis for it
    }
  };

  // cleanup on unmount
  useEffect(() => {
    const els = elsRef.current;
    const analysers = analysersRef.current;
    return () => {
      els.forEach((el) => {
        el.pause();
        el.src = '';
      });
      els.clear();
      analysers.clear();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const ctx = audioCtxRef.current;
      if (ctx) void ctx.close().catch(() => undefined);
      audioCtxRef.current = null;
    };
  }, []);

  // lip-sync sampling loop while playing
  useEffect(() => {
    if (!isPlaying) {
      setLipSyncLevel(0);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    const sample = () => {
      let maxLevel = 0;
      analysersRef.current.forEach((entry) => {
        try {
          if (entry.audio.paused) return;
          entry.analyser.getByteTimeDomainData(entry.data);
          let sum = 0;
          for (let i = 0; i < entry.data.length; i++) {
            const v = (entry.data[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / entry.data.length);
          maxLevel = Math.max(maxLevel, rms);
        } catch {
          // ignore
        }
      });
      // scale: quiet speech ~0.05, loud ~0.5 → 0..1
      const level = Math.min(1, Math.max(0, (maxLevel - 0.03) * 2.6));
      setLipSyncLevel(level);
      rafRef.current = requestAnimationFrame(sample);
    };

    rafRef.current = requestAnimationFrame(sample);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [isPlaying, setLipSyncLevel]);

  // playback sync
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
        analysersRef.current.delete(clip.id); // force re-create analyser for new source
      }
      getAnalyser(clip.id, el);

      try {
        if (t >= clip.startTime && t < clip.endTime) {
          const localT = t - clip.startTime;
          const drift = Math.abs(el.currentTime - localT / 1000);
          if (el.paused || drift > 0.35) {
            el.currentTime = localT / 1000;
            void el.play().catch(() => undefined);
          }
        } else {
          if (!el.paused) el.pause();
        }
      } catch {
        // ignore
      }
    }

    if (currentTime >= sceneDuration) {
      elsRef.current.forEach((el) => {
        el.pause();
        el.currentTime = 0;
      });
    }
  }, [isPlaying, currentTime, clips, audioClips, currentSceneId, sceneDuration]);

  return null;
}
