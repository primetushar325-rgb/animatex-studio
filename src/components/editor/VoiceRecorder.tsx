'use client';

import { useState, useRef, useEffect } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirebaseStorage } from '@/lib/firebase/client';
import { useAuthStore } from '@/store/auth-store';
import { useEditorStore } from '@/store/editor-store';
import { useProjectStore } from '@/store/project-store';
import { v4 as uuidv4 } from 'uuid';

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
  const [isUploading, setIsUploading] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { user } = useAuthStore();
  const { addClip, tracks, currentSceneId, addAudioClip } = useEditorStore();
  const { currentProject } = useProjectStore();

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(100);
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
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const deleteRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
  };

  const useRecording = async () => {
    if (!audioBlob || !user || !currentProject) return;

    setIsUploading(true);

    try {
      const storage = getFirebaseStorage();
      const audioId = uuidv4();
      const audioRef = ref(storage, `users/${user.uid}/audio/${currentProject.id}/${audioId}.webm`);
      
      await uploadBytes(audioRef, audioBlob);
      const downloadUrl = await getDownloadURL(audioRef);

      // Add to editor state
      addAudioClip({
        id: audioId,
        projectId: currentProject.id,
        name: `Recording ${new Date().toLocaleTimeString()}`,
        type: 'voice',
        fileUrl: downloadUrl,
        duration: recordingTime * 1000,
      });

      // Add to timeline
      const voiceTrack = tracks.find((t) => t.sceneId === currentSceneId && t.type === 'voice');
      if (voiceTrack) {
        addClip(voiceTrack.id, audioId, 0, recordingTime * 1000);
      }

      deleteRecording();
      onClose();
    } catch (err) {
      console.error('Failed to upload recording:', err);
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">🎙️ Voice Recorder</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        {permissionDenied ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">🎤</div>
            <p className="text-gray-600 mb-4">Microphone access was denied.</p>
            <p className="text-sm text-gray-500">
              Please enable microphone access in your browser settings.
            </p>
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
                <audio
                  ref={audioRef}
                  src={audioUrl}
                  controls
                  className="w-full"
                />
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center justify-center gap-4">
              {!isRecording && !audioUrl && (
                <button
                  onClick={startRecording}
                  className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white text-2xl shadow-lg transition-colors"
                >
                  🎙️
                </button>
              )}

              {isRecording && (
                <>
                  {isPaused ? (
                    <button
                      onClick={resumeRecording}
                      className="w-14 h-14 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center text-white text-xl shadow-lg"
                    >
                      ▶️
                    </button>
                  ) : (
                    <button
                      onClick={pauseRecording}
                      className="w-14 h-14 bg-yellow-500 hover:bg-yellow-600 rounded-full flex items-center justify-center text-white text-xl shadow-lg"
                    >
                      ⏸️
                    </button>
                  )}
                  <button
                    onClick={stopRecording}
                    className="w-16 h-16 bg-gray-800 hover:bg-gray-900 rounded-full flex items-center justify-center text-white text-2xl shadow-lg"
                  >
                    ⏹️
                  </button>
                </>
              )}

              {audioUrl && (
                <>
                  <button
                    onClick={deleteRecording}
                    className="w-14 h-14 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center text-xl"
                  >
                    🗑️
                  </button>
                  <button
                    onClick={startRecording}
                    className="w-14 h-14 bg-yellow-500 hover:bg-yellow-600 rounded-full flex items-center justify-center text-white text-xl shadow-lg"
                  >
                    🔄
                  </button>
                  <button
                    onClick={useRecording}
                    disabled={isUploading}
                    className="w-16 h-16 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center text-white text-2xl shadow-lg disabled:opacity-50"
                  >
                    {isUploading ? '...' : '✓'}
                  </button>
                </>
              )}
            </div>

            {/* Help Text */}
            <p className="text-center text-sm text-gray-500 mt-6">
              {!isRecording && !audioUrl && 'Tap to start recording'}
              {isRecording && 'Tap stop when finished'}
              {audioUrl && 'Preview and use your recording'}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
