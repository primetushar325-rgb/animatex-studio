'use client';

import { useState, useRef, useEffect } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { useProjectStore } from '@/store/project-store';
import { drawSceneContent, preloadImages } from '@/lib/editor/renderer';

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
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<string>('');
  const [exportUrl, setExportUrl] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const { scenes, canvasObjects, characters } = useEditorStore();
  const { currentProject } = useProjectStore();

  const projectW = currentProject?.width || 1080;
  const projectH = currentProject?.height || 1920;

  // Reset state when reopened
  useEffect(() => {
    if (isOpen) {
      setExporting(false);
      setProgress(0);
      setStage('');
      setExportUrl(null);
    }
  }, [isOpen]);

  const getResolutionDimensions = (res: Resolution) => {
    const baseWidth = res === '480p' ? 480 : res === '720p' ? 720 : 1080;
    return {
      width: baseWidth,
      height: Math.round((baseWidth * projectH) / projectW),
    };
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

      // Load every custom image before recording starts
      setStage('Loading assets...');
      await preloadImages(canvasObjects);

      // Get canvas stream
      const stream = canvas.captureStream(fps);

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

      // Render frames — real characters, images, text via the shared renderer
      const totalDuration = scenes.reduce((t, s) => t + s.duration, 0);
      const totalFrames = Math.max(1, Math.ceil((totalDuration / 1000) * fps));
      let currentFrame = 0;

      const renderFrame = () => {
        if (currentFrame >= totalFrames) {
          mediaRecorder.stop();
          return;
        }

        const frameTime = (currentFrame / fps) * 1000;

        // Find the scene for this frame
        let accumulated = 0;
        let sceneIndex = 0;
        let timeInScene = 0;
        for (let i = 0; i < scenes.length; i++) {
          const dur = scenes[i].duration;
          if (frameTime < accumulated + dur) {
            sceneIndex = i;
            timeInScene = frameTime - accumulated;
            break;
          }
          accumulated += dur;
          sceneIndex = i;
          timeInScene = Math.min(frameTime - accumulated, scenes[i].duration);
        }

        const scene = scenes[sceneIndex];
        setStage(`Rendering Scene ${sceneIndex + 1}/${scenes.length}`);
        setProgress(Math.round((currentFrame / totalFrames) * 100));

        // Scale from project space to export resolution
        ctx.save();
        ctx.scale(width / projectW, height / projectH);

        const sceneObjects = canvasObjects.filter((o) => o.sceneId === scene?.id);
        drawSceneContent(ctx, sceneObjects, scene, timeInScene, timeInScene, projectW, projectH);

        ctx.restore();

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
        className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl max-h-[90vh] overflow-y-auto"
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
              <p className="text-xs text-gray-400 mt-1">
                {getResolutionDimensions(resolution).width}×
                {getResolutionDimensions(resolution).height} ({currentProject?.canvasRatio})
              </p>
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

            {/* Scenes info */}
            <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg text-sm text-gray-600">
              <span>Scenes</span>
              <span className="font-medium">{scenes.length}</span>
              <span>Characters</span>
              <span className="font-medium">{characters.length}</span>
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
