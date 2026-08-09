'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { useProjectStore } from '@/store/project-store';
import { drawSceneContent, preloadImages } from '@/lib/editor/renderer';
import { encodeGIF } from '@/lib/editor/gif';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Resolution = '480p' | '720p' | '1080p';
type Quality = 'low' | 'medium' | 'high';
type Format = 'webm' | 'gif' | 'png';

export function ExportModal({ isOpen, onClose }: ExportModalProps) {
  const [resolution, setResolution] = useState<Resolution>('720p');
  const [fps, setFps] = useState<24 | 30 | 60>(30);
  const [quality, setQuality] = useState<Quality>('medium');
  const [format, setFormat] = useState<Format>('webm');
  const [includeWatermark, setIncludeWatermark] = useState(true);
  const [watermarkText, setWatermarkText] = useState('AnimateX Studio');
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<string>('');
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [exportName, setExportName] = useState('animation');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const frameTokenRef = useRef(0);

  const { scenes, canvasObjects } = useEditorStore();
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
      setErrorMsg(null);
      setWatermarkText(useEditorStore.getState().watermarkText || 'AnimateX Studio');
      setIncludeWatermark(useEditorStore.getState().watermarkEnabled);
    }
  }, [isOpen]);

  const getResolutionDimensions = useCallback(
    (res: Resolution) => {
      const baseWidth = res === '480p' ? 480 : res === '720p' ? 720 : 1080;
      return {
        width: baseWidth,
        height: Math.round((baseWidth * projectH) / projectW),
      };
    },
    [projectW, projectH]
  );

  const canRecordVideo =
    typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function';

  const cleanupBlob = () => {
    if (exportUrl) {
      URL.revokeObjectURL(exportUrl);
      setExportUrl(null);
    }
  };

  const triggerDownload = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    setExportUrl(url); // keep for share
    setExportName(name);
  };

  // -------------------------------------------------------------------------
  // Frame rendering helpers
  // -------------------------------------------------------------------------

  const prepareCanvas = (width: number, height: number) => {
    const canvas = canvasRef.current;
    if (!canvas) throw new Error('Canvas not available');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context not available');
    return { canvas, ctx };
  };

  const renderOneFrame = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    frameTime: number
  ) => {
    // find scene for this frame
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
    const sceneObjects = canvasObjects.filter((o) => o.sceneId === scene?.id);

    ctx.save();
    ctx.scale(width / projectW, height / projectH);
    drawSceneContent(ctx, sceneObjects, scene, timeInScene, timeInScene, projectW, projectH, {
      playback: true,
      sceneDuration: scene?.duration,
      watermark: { text: watermarkText, enabled: includeWatermark },
    });
    ctx.restore();
  };

  // -------------------------------------------------------------------------
  // Export: GIF (universal — plays on iOS/Android gallery)
  // -------------------------------------------------------------------------

  const handleExportGif = async () => {
    const { width, height } = getResolutionDimensions(resolution);
    const gifFps = Math.min(fps, 12); // keep file size sane
    const totalDuration = scenes.reduce((t, s) => t + s.duration, 0);
    const totalFrames = Math.max(1, Math.ceil((totalDuration / 1000) * gifFps));
    const delayMs = 1000 / gifFps;

    const { canvas, ctx } = prepareCanvas(width, height);
    setStage('Rendering GIF…');
    const frames: { width: number; height: number; data: Uint8ClampedArray; delayMs: number }[] = [];

    for (let f = 0; f < totalFrames; f++) {
      const frameTime = (f / gifFps) * 1000;
      renderOneFrame(ctx, width, height, frameTime);
      const image = ctx.getImageData(0, 0, width, height);
      frames.push({ width, height, data: new Uint8ClampedArray(image.data), delayMs });
      setProgress(Math.round((f / totalFrames) * 100));
      setStage(`Rendering GIF… ${f + 1}/${totalFrames}`);
      // let the UI breathe
      if (f % 8 === 0) await new Promise((r) => setTimeout(r, 0));
    }

    setStage('Encoding GIF…');
    const gif = encodeGIF(frames);
    const blob = new Blob([gif as unknown as BlobPart], { type: 'image/gif' });
    setStage('Done');
    setProgress(100);
    triggerDownload(blob, `${currentProject?.name || 'animation'}.gif`);
  };

  // -------------------------------------------------------------------------
  // Export: WebM video (best quality, desktop-friendly)
  // -------------------------------------------------------------------------

  const handleExportWebm = async () => {
    const { width, height } = getResolutionDimensions(resolution);
    const { canvas, ctx } = prepareCanvas(width, height);

    await preloadImages(canvasObjects);

    const stream = canvas.captureStream(fps);
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: quality === 'high' ? 8000000 : quality === 'medium' ? 4000000 : 2000000,
    });
    mediaRecorderRef.current = mediaRecorder;
    chunksRef.current = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    const totalDuration = scenes.reduce((t, s) => t + s.duration, 0);
    const totalFrames = Math.max(1, Math.ceil((totalDuration / 1000) * fps));
    let currentFrame = 0;

    await new Promise<void>((resolve, reject) => {
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setStage('Export Complete');
        setProgress(100);
        triggerDownload(blob, `${currentProject?.name || 'animation'}.webm`);
        resolve();
      };
      mediaRecorder.onerror = () => reject(new Error('Video recording failed'));

      mediaRecorder.start(100);

      const renderFrame = () => {
        if (currentFrame >= totalFrames) {
          mediaRecorder.stop();
          return;
        }
        const frameTime = (currentFrame / fps) * 1000;
        renderOneFrame(ctx, width, height, frameTime);
        setStage(
          `Rendering Scene ${Math.min(scenes.length, Math.floor(frameTime / 1000) + 1)}/${scenes.length}`
        );
        setProgress(Math.round((currentFrame / totalFrames) * 100));
        currentFrame++;
        requestAnimationFrame(renderFrame);
      };

      renderFrame();
    });
  };

  // -------------------------------------------------------------------------
  // Export: PNG snapshot of current frame
  // -------------------------------------------------------------------------

  const handleExportPng = async () => {
    const { width, height } = getResolutionDimensions(resolution);
    const { canvas, ctx } = prepareCanvas(width, height);
    const currentTime = useEditorStore.getState().currentTime;
    renderOneFrame(ctx, width, height, currentTime);
    setStage('Export Complete');
    setProgress(100);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/png')
    );
    if (blob) triggerDownload(blob, `${currentProject?.name || 'animation'}-frame.png`);
  };

  // -------------------------------------------------------------------------

  const handleExport = async () => {
    if (!currentProject) return;
    setExporting(true);
    setProgress(0);
    setStage('Preparing…');
    setErrorMsg(null);

    const token = ++frameTokenRef.current;

    try {
      if (format === 'gif') {
        await handleExportGif();
      } else if (format === 'png') {
        await handleExportPng();
      } else {
        if (!canRecordVideo) {
          setErrorMsg(
            'Video recording is not supported in this browser — try GIF instead (plays everywhere).'
          );
          setExporting(false);
          return;
        }
        await handleExportWebm();
      }
    } catch (err) {
      console.error('Export failed:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Export failed');
      setStage('Export failed');
    } finally {
      if (frameTokenRef.current === token) {
        setExporting(false);
      }
    }
  };

  const handleShare = async () => {
    if (!exportUrl) return;
    try {
      const response = await fetch(exportUrl);
      const blob = await response.blob();
      const file = new File([blob], exportName, { type: blob.type });
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: exportName });
      } else {
        const a = document.createElement('a');
        a.href = exportUrl;
        a.download = exportName;
        a.click();
      }
    } catch {
      const a = document.createElement('a');
      a.href = exportUrl;
      a.download = exportName;
      a.click();
    }
  };

  const handleClose = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    cleanupBlob();
    setExporting(false);
    setProgress(0);
    setStage('');
    onClose();
  };

  if (!isOpen) return null;

  const btn = (active: boolean) =>
    `py-2 rounded-lg border-2 transition-colors ${
      active ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 hover:border-gray-300'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={handleClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">📤 Export</h2>
          <button onClick={handleClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>

        {errorMsg && (
          <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg">
            {errorMsg}
          </div>
        )}

        {!exporting && !exportUrl && (
          <div className="space-y-5">
            {/* Format */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Format</label>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => setFormat('webm')} className={btn(format === 'webm')}>
                  🎥 Video
                </button>
                <button onClick={() => setFormat('gif')} className={btn(format === 'gif')}>
                  🖼️ GIF
                </button>
                <button onClick={() => setFormat('png')} className={btn(format === 'png')}>
                  📸 PNG
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {format === 'gif' && 'GIF চলে সব ফোনে — iOS/Android gallery-তে সরাসরি সেভ হয়।'}
                {format === 'webm' && 'সবচেয়ে ভালো কোয়ালিটির ভিডিও (ডেস্কটপ ব্রাউজারে)।'}
                {format === 'png' && 'কারেন্ট ফ্রেমের স্ক্রিনশট ডাউনলোড।'}
              </p>
            </div>

            {/* Resolution */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Resolution</label>
              <div className="grid grid-cols-3 gap-2">
                {(['480p', '720p', '1080p'] as Resolution[]).map((res) => (
                  <button key={res} onClick={() => setResolution(res)} className={btn(resolution === res)}>
                    {res}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {getResolutionDimensions(resolution).width}×{getResolutionDimensions(resolution).height}{' '}
                ({currentProject?.canvasRatio})
              </p>
            </div>

            {/* FPS */}
            {format !== 'png' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Frame Rate</label>
                <div className="grid grid-cols-3 gap-2">
                  {([24, 30, 60] as const).map((f) => (
                    <button key={f} onClick={() => setFps(f)} className={btn(fps === f)}>
                      {f} FPS
                    </button>
                  ))}
                </div>
                {format === 'gif' && (
                  <p className="text-xs text-gray-400 mt-1">GIF-এর জন্য ফাইল সাইজ ঠিক রাখতে 12 FPS-এ সীমিত।</p>
                )}
              </div>
            )}

            {/* Quality (video only) */}
            {format === 'webm' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Quality</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['low', 'medium', 'high'] as Quality[]).map((q) => (
                    <button key={q} onClick={() => setQuality(q)} className={btn(quality === q)}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Watermark */}
            <div className="rounded-xl border border-gray-200 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-700 text-sm">💧 Watermark</span>
                <button
                  onClick={() => setIncludeWatermark(!includeWatermark)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    includeWatermark ? 'bg-blue-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      includeWatermark ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>
              <input
                type="text"
                value={watermarkText}
                onChange={(e) => setWatermarkText(e.target.value)}
                placeholder="AnimateX Studio"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">কোণায় ছোট করে ব্যাজ আকারে দেখাবে।</p>
            </div>

            <button
              onClick={handleExport}
              className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              Export Now
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
              <div className="bg-blue-600 h-3 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-center text-sm text-gray-500">{progress}%</p>
          </div>
        )}

        {exportUrl && !exporting && (
          <div className="py-8 text-center">
            <div className="text-6xl mb-4">✅</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Export Complete!</h3>
            <p className="text-gray-600 mb-6">
              {exportName} ডাউনলোড শুরু হয়েছে। ফাইলটা না পাওয়া গেলে আবার Download চাপো।
            </p>
            <div className="flex gap-3">
              <button onClick={handleShare} className="flex-1 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700">
                Share
              </button>
              <button
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = exportUrl;
                  a.download = exportName;
                  a.click();
                }}
                className="flex-1 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
              >
                Download Again
              </button>
            </div>
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}
