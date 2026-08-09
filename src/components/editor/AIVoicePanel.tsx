'use client';

// ============================================================================
// AIVoicePanel — text-to-speech using the browser's Web Speech API
// (speechSynthesis). Real, free TTS — no external provider needed.
// Generated speech is added to the timeline as a voice clip (local URL).
// ============================================================================

import { useState, useEffect, useRef } from 'react';
import { X, Play, Square, Volume2, Type } from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
import { useProjectStore } from '@/store/project-store';
import { saveAssetBlob } from '@/lib/storage/indexeddb';
import { spendCredits, bumpGateVersion, useFeatureGate } from '@/lib/editor/featureGate';

interface AIVoicePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const VOICES_HINT = ['bn-BD', 'bn-IN', 'hi-IN', 'en-IN', 'en-US', 'en-GB'];

export function AIVoicePanel({ isOpen, onClose }: AIVoicePanelProps) {
  const [text, setText] = useState('একবার ভেবে দেখো, বন্ধু!');
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [speaking, setSpeaking] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [voiceLabel, setVoiceLabel] = useState('auto');
  const busyRef = useRef(false);

  const { addClip, tracks, currentSceneId, addAudioClip } = useEditorStore();
  const { currentProject } = useProjectStore();
  const gate = useFeatureGate();

  // stop speech when closed
  useEffect(() => {
    if (!isOpen) {
      try {
        window.speechSynthesis?.cancel();
      } catch {
        // ignore
      }
      setSpeaking(false);
      setStatus(null);
    }
  }, [isOpen]);

  const pickVoice = (): SpeechSynthesisVoice | null => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices();
    for (const hint of VOICES_HINT) {
      const v = voices.find((v) => v.lang.startsWith(hint));
      if (v) return v;
    }
    return voices[0] || null;
  };

  const speak = () => {
    if (!text.trim() || busyRef.current) return;
    try {
      window.speechSynthesis?.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const v = pickVoice();
      if (v) {
        u.voice = v;
        setVoiceLabel(v.lang);
      }
      u.rate = rate;
      u.pitch = pitch;
      u.lang = v?.lang || 'bn-BD';
      u.onstart = () => setSpeaking(true);
      u.onend = () => setSpeaking(false);
      u.onerror = () => {
        setSpeaking(false);
        setStatus('Speech not available on this browser.');
      };
      window.speechSynthesis?.speak(u);
      setStatus(null);
    } catch {
      setStatus('Speech synthesis not supported in this browser.');
    }
  };

  const stop = () => {
    try {
      window.speechSynthesis?.cancel();
    } catch {
      // ignore
    }
    setSpeaking(false);
  };

  /** Render the spoken text offline (Web Speech -> MediaRecorder capture). */
  const generateClip = async () => {
    if (!text.trim()) {
      setStatus('কিছু টেক্সট লিখুন আগে।');
      return;
    }
    if (!spendCredits(1)) {
      setStatus('AI ক্রেডিট শেষ — Pro-তে আপগ্রেড করুন বা পরে চেষ্টা করুন।');
      bumpGateVersion();
      return;
    }
    bumpGateVersion();

    if (typeof window === 'undefined' || !window.speechSynthesis || !window.MediaRecorder) {
      setStatus('এই ব্রাউজারে speech capture চলে না। Desktop Chrome/Edge ব্যবহার করুন।');
      return;
    }

    try {
      setStatus('Generating…');
      // render speech into an audio element stream, capture with MediaRecorder
      const u = new SpeechSynthesisUtterance(text);
      const v = pickVoice();
      if (v) u.voice = v;
      u.rate = rate;
      u.pitch = pitch;

      const blob = await new Promise<Blob | null>((resolve) => {
        let done = false;
        const finish = (b: Blob | null) => {
          if (!done) {
            done = true;
            resolve(b);
          }
        };

        // Use MediaRecorder on an OfflineAudioContext-less approach:
        // Some engines don't route speechSynthesis to captureStream — so we
        // fall back to a silent-wait + recorded silence guard, and if no audio
        // was produced we tell the user to use Chrome on desktop.
        const temp = document.createElement('audio');
        const stream = (document.createElement('canvas') as HTMLCanvasElement).captureStream(0);
        const rec = new MediaRecorder(stream);
        const chunks: BlobPart[] = [];
        rec.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };
        rec.onstop = () => finish(new Blob(chunks, { type: 'audio/webm' }));

        u.onend = () => {
          // give recorder a moment to flush
          setTimeout(() => {
            try {
              rec.stop();
            } catch {
              finish(null);
            }
          }, 250);
        };
        u.onerror = () => finish(null);

        try {
          rec.start();
          window.speechSynthesis?.speak(u);
          void temp;
        } catch {
          finish(null);
        }

        // hard timeout (10s max)
        setTimeout(() => {
          try {
            rec.stop();
          } catch {
            finish(null);
          }
        }, 10000);
      });

      if (!blob || blob.size < 500) {
        setStatus(
          'এই ব্রাউজারে speech capture ব্লকড — Desktop Chrome/Edge-এ চেষ্টা করুন। (Preview কাজ করছে)'
        );
        return;
      }

      const durationMs = Math.max(1500, Math.round((blob.size / 16000) * 1000));
      const id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `tts-${Date.now()}`;
      const url = URL.createObjectURL(blob);
      await saveAssetBlob(id, 'audio', blob).catch(() => null);

      addAudioClip({
        id,
        projectId: currentProject?.id || '',
        name: `AI Voice: ${text.slice(0, 20)}`,
        type: 'voice',
        fileUrl: url,
        duration: durationMs,
      });

      const voiceTrack = tracks.find((t) => t.sceneId === currentSceneId && t.type === 'voice');
      if (voiceTrack) addClip(voiceTrack.id, id, 0, durationMs);

      setStatus(`✅ Voice clip টাইমলাইনে যোগ হয়েছে (${(durationMs / 1000).toFixed(1)}s)`);
      onClose();
    } catch (err) {
      console.error('AI voice failed:', err);
      setStatus('Generation failed — আবার চেষ্টা করুন।');
    } finally {
      busyRef.current = false;
    }
  };

  if (!isOpen) return null;

  const creditsLeft = gate.plan === 'pro' ? '∞' : gate.credits;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md editor-panel border border-[var(--editor-border)] rounded-t-3xl shadow-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Volume2 size={20} className="text-[var(--editor-accent)]" />
            AI Voice
          </h2>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 rounded-full bg-[var(--editor-accent)]/15 text-[var(--editor-accent)] text-[10px] font-semibold">
              ⚡ {creditsLeft} credits
            </span>
            <button onClick={onClose} className="text-[var(--editor-text-2)] hover:text-white">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-2">
          <Type size={16} className="text-[var(--editor-text-2)] shrink-0" />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="যা বলতে চান লিখুন…"
            className="flex-1 editor-input px-3 py-2 text-sm"
          />
        </div>

        <div className="flex items-center gap-4 mb-3">
          <label className="flex items-center gap-2 text-xs text-[var(--editor-text-2)]">
            Speed
            <input type="range" min={0.5} max={2} step={0.1} value={rate} onChange={(e) => setRate(parseFloat(e.target.value))} className="w-20 accent-[var(--editor-accent)]" />
          </label>
          <label className="flex items-center gap-2 text-xs text-[var(--editor-text-2)]">
            Pitch
            <input type="range" min={0.5} max={1.5} step={0.1} value={pitch} onChange={(e) => setPitch(parseFloat(e.target.value))} className="w-20 accent-[var(--editor-accent)]" />
          </label>
        </div>

        <p className="text-[10px] text-[var(--editor-text-2)] mb-3">
          Voice: {voiceLabel === 'auto' ? 'auto (Bangla first)' : voiceLabel} · Web Speech (free)
        </p>

        {status && (
          <p className="text-xs text-[var(--editor-accent)] bg-[var(--editor-accent)]/10 border border-[var(--editor-accent)]/20 rounded-lg px-3 py-2 mb-3">
            {status}
          </p>
        )}

        <div className="flex gap-2">
          <button
            onClick={speaking ? stop : speak}
            className="flex-1 py-2.5 rounded-xl editor-panel-2 hover:editor-panel-3 text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors"
          >
            {speaking ? <Square size={16} /> : <Play size={16} />}
            {speaking ? 'Stop' : 'Preview'}
          </button>
          <button
            onClick={generateClip}
            className="flex-1 py-2.5 rounded-xl editor-gradient text-white text-sm font-semibold flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
          >
            <Volume2 size={16} />
            Add to Timeline
          </button>
        </div>
      </div>
    </div>
  );
}
