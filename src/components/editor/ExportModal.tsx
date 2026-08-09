'use client';

import { useState, useRef, useEffect } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { useProjectStore } from '@/store/project-store';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Resolution = '480p' | '720p' | '1080p';
type Quality = 'low' | 'medium' | 'high';

export function ExportModal({ isOpen, onClose }: ExportModalProps) {
  const [resolution, setResolution] = useState<Resolution>('720p');
  const [fps, setFps] = useState<24 | 30 | 60>(30);
  const [quality, setQuality] = useState<Quality>('medium');
  const [includeAudio, setIncludeAudio] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<string>('');
  const [exportUrl, setExportUrl] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const { scenes, canvasObjects } = useEditorStore();
  const { currentProject } = useProjectStore();

  const getResolutionDimensions = (res: Resolution) => {
    switch (res) {
      case '480p':
        return { width: 480, height: 854 };
      case '720p':
        return { width: 720, height: 1280 };
      case '1080p':
        return { width: 1080, height: 1920 };
    }
  };

  const handleExport = async () => {
    if (!currentProject) return;

    setExporting(true);
    setProgress(0);
    setStage('Preparing...');
    chunksRef.current = [];

    try {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error('Canvas not available');

      const { width, height } = getResolutionDimensions(resolution);
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');

      // Get canvas stream
      const stream = canvas.captureStream(fps);

      // Create MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: quality === 'high' ? 8000000 : quality === 'medium' ? 4000000 : 2000000,
      });

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setExportUrl(url);
        setStage('Export Complete');
        setProgress(100);
      };

      mediaRecorder.start(100);

      // Render frames
      const totalDuration = scenes.reduce((t, s) => t + s.duration, 0);
      const totalFrames = Math.ceil((totalDuration / 1000) * fps);
      let currentFrame = 0;
      let currentSceneIndex = 0;
      let sceneStartFrame = 0;

      const renderFrame = () => {
        if (currentFrame >= totalFrames) {
          mediaRecorder.stop();
          return;
        }

        const frameTime = (currentFrame / fps) * 1000;
        
        // Find current scene
        let accumulatedDuration = 0;
        for (let i = 0; i < scenes.length; i++) {
          if (frameTime < accumulatedDuration + scenes[i].duration) {
            currentSceneIndex = i;
            sceneStartFrame = Math.floor((accumulatedDuration / 1000) * fps);
            break;
          }
          accumulatedDuration += scenes[i].duration;
        }

        const scene = scenes[currentSceneIndex];
        setStage(`Rendering Scene ${currentSceneIndex + 1}/${scenes.length}`);
        setProgress(Math.round((currentFrame / totalFrames) * 100));

        // Clear canvas
        ctx.fillStyle = scene?.backgroundColor || '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        // Draw objects (simplified)
        const sortedObjects = [...canvasObjects].sort((a, b) => a.zIndex - b.zIndex);
        
        for (const obj of sortedObjects) {
          ctx.save();
          ctx.globalAlpha = obj.opacity;

          // Scale to export resolution
          const scaleX = width / (currentProject?.width || 1080);
          const scaleY = height / (currentProject?.height || 1920);

          const drawX = obj.x * scaleX;
          const drawY = obj.y * scaleY;
          const drawWidth = obj.width * obj.scaleX * scaleX;
          const drawHeight = obj.height * obj.scaleY * scaleY;

          // Draw placeholder shapes
          if (obj.type === 'character') {
            ctx.fillStyle = '#FF69B4';
          } else if (obj.type === 'background') {
            ctx.fillStyle = '#32CD32';
          } else if (obj.type === 'prop') {
            ctx.fillStyle = '#4169E1';
          } else {
            ctx.fillStyle = '#FFD700';
          }

          ctx.fillRect(drawX, drawY, drawWidth, drawHeight);
          ctx.restore();
        }

        currentFrame++;
        requestAnimationFrame(renderFrame);
      };

      renderFrame();
    } catch (error) {
      console.error('Export failed:', error);
      setExporting(false);
      setStage('Export failed');
    }
  };

  const handleDownload = () => {
    if (!exportUrl) return;

    const a = document.createElement('a');
    a.href = exportUrl;
    a.download = `${currentProject?.name || 'animation'}.webm`;
    a.click();
  };

  const handleShare = async () => {
    if (!exportUrl) return;

    try {
      const response = await fetch(exportUrl);
      const blob = await response.blob();
      const file = new File([blob], `${currentProject?.name || 'animation'}.webm`, { type: 'video/webm' });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: currentProject?.name || 'My Animation',
        });
      } else {
        handleDownload();
      }
    } catch {
      handleDownload();
    }
  };

  const handleClose = () => {
    if (exportUrl) {
      URL.revokeObjectURL(exportUrl);
      setExportUrl(null);
    }
    setExporting(false);
    setProgress(0);
    setStage('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={handleClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">📤 Export Video</h2>
          <button onClick={handleClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        {!exporting && !exportUrl && (
          <div className="space-y-6">
            {/* Resolution */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Resolution</label>
              <div className="grid grid-cols-3 gap-2">
                {(['480p', '720p', '1080p'] as Resolution[]).map((res) => (
                  <button
                    key={res}
                    onClick={() => setResolution(res)}
                    className={`py-2 rounded-lg border-2 transition-colors ${
                      resolution === res
                        ? 'border-blue-500 bg-blue-50 text-blue-600'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {res}
                  </button>
                ))}
              </div>
            </div>

            {/* FPS */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Frame Rate</label>
              <div className="grid grid-cols-3 gap-2">
                {([24, 30, 60] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFps(f)}
                    className={`py-2 rounded-lg border-2 transition-colors ${
                      fps === f
                        ? 'border-blue-500 bg-blue-50 text-blue-600'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {f} FPS
                  </button>
                ))}
              </div>
            </div>

            {/* Quality */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Quality</label>
              <div className="grid grid-cols-3 gap-2">
                {(['low', 'medium', 'high'] as Quality[]).map((q) => (
                  <button
                    key={q}
                    onClick={() => setQuality(q)}
                    className={`py-2 rounded-lg border-2 capitalize transition-colors ${
                      quality === q
                        ? 'border-blue-500 bg-blue-50 text-blue-600'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Audio Toggle */}
            <div className="flex items-center justify-between py-2">
              <span className="font-medium text-gray-700">Include Audio</span>
              <button
                onClick={() => setIncludeAudio(!includeAudio)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  includeAudio ? 'bg-blue-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    includeAudio ? 'left-7' : 'left-1'
                  }`}
                />
              </button>
            </div>

            <button
              onClick={handleExport}
              className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              Start Export
            </button>
          </div>
        )}

        {exporting && !exportUrl && (
          <div className="py-8">
            <div className="text-center mb-6">
              <div className="text-4xl mb-2">🎬</div>
              <p className="text-gray-600">{stage}</p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-center text-sm text-gray-500">{progress}%</p>
          </div>
        )}

        {exportUrl && (
          <div className="py-8 text-center">
            <div className="text-6xl mb-4">✅</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Export Complete!</h3>
            <p className="text-gray-600 mb-6">Your video is ready to download or share.</p>
            
            <div className="flex gap-3">
              <button
                onClick={handleDownload}
                className="flex-1 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
              >
                Download
              </button>
              <button
                onClick={handleShare}
                className="flex-1 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700"
              >
                Share
              </button>
            </div>
          </div>
        )}

        {/* Hidden canvas for rendering */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}
