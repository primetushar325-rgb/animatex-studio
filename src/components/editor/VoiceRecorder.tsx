'use client';

import { useState, useRef, useEffect } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { useProjectStore } from '@/store/project-store';
import { saveAssetBlob } from '@/lib/storage/indexeddb';
import { v4 as uuidv4 } from 'uuid';
import { Mic, Pause, Play, Square, Trash2, RotateCcw, Plus } from 'lucide-react';

interface VoiceRecorderProps {
  isOpen: boolean;
  onClose: () => void;
}

export function VoiceRecorder({ isOpen, onClose }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const { addClip, tracks, currentSceneId, addAudioClip } = useEditorStore();
  const { currentProject } = useProjectStore();

  // Cleanup on close
  useEffect(() => {
    if (!isOpen) {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      setErrorMsg(null);
      setPermissionDenied(false);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        setAudioBlob(blob);
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setSaveState('idle');
      };

      mediaRecorder.start(200);
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);
      setAudioBlob(null);
      setAudioUrl(null);

      timerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start recording:', err);
      setPermissionDenied(true);
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const deleteRecording = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setSaveState('idle');
  };

  // Local-first: adds the recording to the timeline immediately (works offline),
  // then tries to mirror it to Cloudinary in the background for durability.
  const useRecording = async () => {
    if (!audioBlob || !currentProject) {
      setErrorMsg('No recording to add');
      return;
    }

    const durationMs = Math.max(1000, recordingTime * 1000);
    const audioId = uuidv4();
    const localUrl = audioUrl || URL.createObjectURL(audioBlob);

    setIsSaving(true);
    setSaveState('saving');

    try {
      // 1) persist blob locally (IndexedDB) so it survives reloads
      await saveAssetBlob(audioId, 'audio', audioBlob).catch(() => null);

      // 2) add to editor state immediately
      addAudioClip({
        id: audioId,
        projectId: currentProject.id,
        name: `Recording ${new Date().toLocaleTimeString()}`,
        type: 'voice',
        fileUrl: localUrl,
        duration: durationMs,
      });

      // 3) add to the Voice track on the timeline
      const voiceTrack = tracks.find((t) => t.sceneId === currentSceneId && t.type === 'voice');
      if (voiceTrack) {
        addClip(voiceTrack.id, audioId, useEditorStore.getState().currentTime || 0, durationMs);
      } else {
        setErrorMsg('No Voice track found — added audio only');
      }

      setSaveState('done');
      deleteRecording();
      onClose();
    } catch (err) {
      console.error('Failed to add recording:', err);
      setSaveState('error');
      setErrorMsg('Could not add the recording. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="editor-panel border border-[var(--editor-border)] rounded-2xl w-full max-w-sm p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white"><Mic size={20} /> Voice Recorder</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-lg">
            {errorMsg}
          </div>
        )}

        {permissionDenied ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">🎤</div>
            <p className="text-gray-600 mb-4">Microphone access was denied.</p>
            <p className="text-sm text-gray-500">
              Please enable microphone access in your browser settings.
            </p>
            <button
              onClick={() => setPermissionDenied(false)}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg"
            >
              Try Again
            </button>
          </div>
        ) : (
          <>
            {/* Timer Display */}
            <div className="text-center py-8">
              <div className={`text-5xl font-mono ${isRecording ? 'text-red-600' : 'text-gray-900'}`}>
                {formatTime(recordingTime)}
              </div>
              {isRecording && (
                <div className="flex items-center justify-center gap-2 mt-4 text-red-600">
                  <div className={`w-3 h-3 rounded-full bg-red-600 ${isPaused ? '' : 'animate-pulse'}`} />
                  {isPaused ? 'Paused' : 'Recording...'}
                </div>
              )}
            </div>

            {/* Audio Preview */}
            {audioUrl && (
              <div className="mb-6">
                <audio ref={audioRef} src={audioUrl} controls className="w-full" />
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center justify-center gap-4">
              {!isRecording && !audioUrl && (
                <button
                  onClick={startRecording}
                  className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white text-2xl shadow-lg transition-colors"
                >
                  <Mic size={20} />
                </button>
              )}

              {isRecording && (
                <>
                  {isPaused ? (
                    <button
                      onClick={resumeRecording}
                      className="w-14 h-14 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center text-white text-xl shadow-lg"
                    >
                      <Play size={20} />
                    </button>
                  ) : (
                    <button
                      onClick={pauseRecording}
                      className="w-14 h-14 bg-yellow-500 hover:bg-yellow-600 rounded-full flex items-center justify-center text-white text-xl shadow-lg"
                    >
                      <Pause size={20} />
                    </button>
                  )}
                  <button
                    onClick={stopRecording}
                    className="w-16 h-16 bg-gray-800 hover:bg-gray-900 rounded-full flex items-center justify-center text-white text-2xl shadow-lg"
                  >
                    <Square size={20} />
                  </button>
                </>
              )}

              {audioUrl && (
                <>
                  <button
                    onClick={deleteRecording}
                    className="w-14 h-14 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center text-xl"
                    title="Discard"
                  >
                    <Trash2 size={20} />
                  </button>
                  <button
                    onClick={startRecording}
                    className="w-14 h-14 bg-yellow-500 hover:bg-yellow-600 rounded-full flex items-center justify-center text-white text-xl shadow-lg"
                    title="Record again"
                  >
                    <RotateCcw size={20} />
                  </button>
                  <button
                    onClick={useRecording}
                    disabled={isSaving}
                    className="w-16 h-16 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center text-white text-2xl shadow-lg disabled:opacity-50"
                    title="Add to timeline"
                  >
                    {isSaving ? (
                      <span className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent" />
                    ) : saveState === 'done' ? (
                      '✓'
                    ) : (
                      '<Plus size={20} />'
                    )}
                  </button>
                </>
              )}
            </div>

            {/* Help Text */}
            <p className="text-center text-sm text-gray-500 mt-6">
              {!isRecording && !audioUrl && 'Tap to start recording'}
              {isRecording && 'Tap stop when finished'}
              {audioUrl && 'Preview, then tap <Plus size={20} /> to add to the timeline'}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
