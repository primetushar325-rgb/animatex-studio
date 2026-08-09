'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { useProjectStore } from '@/store/project-store';
import {
  drawSceneContent,
  preloadImages,
  transitionProgress,
  mixColors,
} from '@/lib/editor/renderer';
import { applyKeyframes } from '@/lib/editor/keyframes';
import { encodeGIF } from '@/lib/editor/gif';
import { useFeatureGate } from '@/lib/editor/featureGate';
import { Download, FileJson, Image as ImageIcon, Film, Lock } from 'lucide-react';
import type { Scene } from '@/types/animation';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Resolution = '480p' | '720p' | '1080p';
type Quality = 'low' | 'medium' | 'high';
type Format = 'webm' | 'gif' | 'png' | 'project';

const isTouchDevice =
  typeof window !== 'undefined' &&
  ('ontouchstart' in window || navigator.maxTouchPoints > 0);

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function ExportModal({ isOpen, onClose }: ExportModalProps) {
  const [resolution, setResolution] = useState<Resolution>('720p');
  const [fps, setFps] = useState<24 | 30 | 60>(30);
  const [quality, setQuality] = useState<Quality>('medium');
  const [format, setFormat] = useState<Format>(isTouchDevice ? 'gif' : 'webm');
  const [aspect, setAspect] = useState<'auto' | '16:9' | '9:16' | '1:1'>('auto');
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
  const cancelledRef = useRef(false);

  const { scenes, canvasObjects, clips, getEditorState } = useEditorStore();
  const { currentProject } = useProjectStore();
  const gate = useFeatureGate();

  const projectW = currentProject?.width || 1080;
  const projectH = currentProject?.height || 1920;

  // Reset state when reopened (deferred so it never runs during render commit)
  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => {
      setExporting(false);
      setProgress(0);
      setStage('');
      setExportUrl(null);
      setErrorMsg(null);
      cancelledRef.current = false;
      setWatermarkText(useEditorStore.getState().watermarkText || 'AnimateX Studio');
      setIncludeWatermark(useEditorStore.getState().watermarkEnabled);
    }, 0);
    return () => clearTimeout(t);
  }, [isOpen]);

  const getResolutionDimensions = useCallback(
    (res: Resolution) => {
      // Free tier is capped at 720p
      const effective: Resolution = gate.plan === 'pro' ? res : res === '1080p' ? '720p' : res;
      const baseWidth = effective === '480p' ? 480 : effective === '720p' ? 720 : 1080;
      let w = baseWidth;
      let h = Math.round((baseWidth * projectH) / projectW);
      if (aspect === '16:9') {
        w = baseWidth;
        h = Math.round((baseWidth * 9) / 16);
      } else if (aspect === '9:16') {
        h = baseWidth;
        w = Math.round((baseWidth * 9) / 16);
      } else if (aspect === '1:1') {
        w = baseWidth;
        h = baseWidth;
      }
      return { width: w, height: h };
    },
    [projectW, projectH, aspect, gate.plan]
  );

  const canRecordVideo =
    typeof MediaRecorder !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.captureStream === 'function';

  const triggerDownload = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    setExportUrl(url);
    setExportName(name);
  };

  // -------------------------------------------------------------------------
  // Frame rendering
  // -------------------------------------------------------------------------

  const renderOneFrame = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    frameTime: number
  ) => {
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
    const next = scenes[sceneIndex + 1];
    const sceneObjects = canvasObjects
      .filter((o) => o.sceneId === scene?.id)
      .map((o) => applyKeyframes(o, clips, timeInScene, scene?.id));
    const nextObjects = next
      ? canvasObjects
          .filter((o) => o.sceneId === next.id)
          .map((o) => applyKeyframes(o, clips, 0, next.id))
      : [];

    const baseOpts = {
      playback: true,
      sceneDuration: scene?.duration,
      watermark: { text: watermarkText, enabled: includeWatermark },
    };

    ctx.save();
    ctx.scale(width / projectW, height / projectH);

    const tp = scene
      ? transitionProgress(timeInScene, scene.duration, scene.transition.duration)
      : 0;
    const type = scene?.transition.type || 'none';
    const doTransition = tp > 0 && tp < 1 && next && type !== 'none';

    if (doTransition) {
      const blendedScene: Scene | undefined = scene
        ? { ...scene, backgroundColor: mixColors(scene.backgroundColor, next!.backgroundColor, tp) }
        : scene;
      drawSceneContent(ctx, sceneObjects, blendedScene, timeInScene, timeInScene, projectW, projectH, baseOpts);

      ctx.save();
      if (type === 'slide') {
        ctx.translate(projectW * (1 - tp), 0);
      } else if (type === 'zoom') {
        const s = 0.86 + 0.14 * tp;
        ctx.translate(projectW / 2, projectH / 2);
        ctx.scale(s, s);
        ctx.translate(-projectW / 2, -projectH / 2);
      } else {
        ctx.globalAlpha = tp;
      }
      drawSceneContent(ctx, nextObjects, next, 0, timeInScene, projectW, projectH, {
        playback: true,
        sceneDuration: next.duration,
      });
      ctx.restore();
    } else {
      drawSceneContent(ctx, sceneObjects, scene, timeInScene, timeInScene, projectW, projectH, baseOpts);
    }

    ctx.restore();
  };

  // -------------------------------------------------------------------------
  // Export: GIF (universal — recommended on mobile)
  // -------------------------------------------------------------------------

  const handleExportGif = async () => {
    const { width, height } = getResolutionDimensions(resolution);
    const gifFps = Math.min(fps, 12);
    const totalDuration = scenes.reduce((t, s) => t + s.duration, 0);
    const totalFrames = Math.max(1, Math.ceil((totalDuration / 1000) * gifFps));
    const delayMs = 1000 / gifFps;

    const canvas = canvasRef.current;
    if (!canvas) throw new Error('Canvas not available');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context not available');

    setStage('Rendering GIF…');
    const frames: { width: number; height: number; data: Uint8ClampedArray; delayMs: number }[] = [];

    for (let f = 0; f < totalFrames; f++) {
      if (cancelledRef.current) throw new Error('cancelled');
      const frameTime = (f / gifFps) * 1000;
      renderOneFrame(ctx, width, height, frameTime);
      const image = ctx.getImageData(0, 0, width, height);
      frames.push({ width, height, data: new Uint8ClampedArray(image.data), delayMs });
      setProgress(Math.round((f / totalFrames) * 100));
      if (f % 6 === 0) await wait(0);
    }

    setStage('Encoding GIF…');
    const gif = encodeGIF(frames);
    const blob = new Blob([gif as unknown as BlobPart], { type: 'image/gif' });
    setStage('Done');
    setProgress(100);
    triggerDownload(blob, `${currentProject?.name || 'animation'}.gif`);
  };

  // -------------------------------------------------------------------------
  // Export: PNG frame
  // -------------------------------------------------------------------------

  const handleExportPng = async () => {
    const { width, height } = getResolutionDimensions(resolution);
    const canvas = canvasRef.current;
    if (!canvas) throw new Error('Canvas not available');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context not available');

    const currentTime = useEditorStore.getState().currentTime;
    renderOneFrame(ctx, width, height, currentTime);
    setStage('Export Complete');
    setProgress(100);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
    if (blob) triggerDownload(blob, `${currentProject?.name || 'animation'}-frame.png`);
  };

  // -------------------------------------------------------------------------
  // Export: WebM video — deterministic frame stepping + manual frame capture
  // -------------------------------------------------------------------------

  const handleExportWebm = async () => {
    const { width, height } = getResolutionDimensions(resolution);
    const canvas = canvasRef.current;
    if (!canvas) throw new Error('Canvas not available');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context not available');

    await preloadImages(canvasObjects);

    const stream = canvas.captureStream(0); // 0 = we push frames manually
    const track = stream.getVideoTracks()[0] as
      | (MediaStreamTrack & { requestFrame?: () => void })
      | undefined;
    if (!track) {
      throw new Error('Video capture is not supported in this browser — use GIF instead.');
    }

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
    const frameMs = 1000 / fps;

    const done = new Promise<Blob>((resolve, reject) => {
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size === 0) {
          reject(new Error('Recording produced an empty file — try GIF instead.'));
          return;
        }
        resolve(blob);
      };
      mediaRecorder.onerror = () => reject(new Error('Video recording failed — try GIF instead.'));
      mediaRecorder.start(100);
    });

    // draw the first frame immediately so the stream isn't blank
    renderOneFrame(ctx, width, height, 0);
    track.requestFrame?.();

    for (let f = 1; f <= totalFrames; f++) {
      if (cancelledRef.current) {
        try {
          mediaRecorder.stop();
        } catch {
          /* ignore */
        }
        throw new Error('cancelled');
      }
      const t0 = performance.now();
      renderOneFrame(ctx, width, height, (f / fps) * 1000);
      track.requestFrame?.();
      setProgress(Math.round((f / totalFrames) * 100));
      setStage(`Rendering frame ${f}/${totalFrames}`);

      // sleep until the next frame slot (wall-clock pacing)
      const elapsed = performance.now() - t0;
      await wait(Math.max(0, frameMs - elapsed));
    }

    try {
      mediaRecorder.stop();
    } catch {
      /* already stopped */
    }
    const blob = await done;
    setStage('Export Complete');
    setProgress(100);
    triggerDownload(blob, `${currentProject?.name || 'animation'}.webm`);
  };

  // -------------------------------------------------------------------------

  const handleExportProject = () => {
    const state = getEditorState();
    const payload = {
      app: 'animatex',
      version: 1,
      exportedAt: Date.now(),
      project: {
        name: currentProject?.name || 'Untitled',
        canvasRatio: currentProject?.canvasRatio || '9:16',
      },
      ...state,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    triggerDownload(blob, `${currentProject?.name || 'animation'}.animatex`);
    setStage('Project file saved');
    setProgress(100);
  };

  const handleExport = async () => {
    if (!currentProject) return;
    setExporting(true);
    setProgress(0);
    setStage('Preparing…');
    setErrorMsg(null);
    cancelledRef.current = false;

    try {
      if (format === 'project') {
        handleExportProject();
      } else if (format === 'gif') {
        await handleExportGif();
      } else if (format === 'png') {
        await handleExportPng();
      } else {
        if (!canRecordVideo) {
          setErrorMsg('এই ব্রাউজারে ভিডিও রেকর্ডিং চলে না — GIF বেছে নাও (সব ফোনে চলে)।');
          setFormat('gif');
          setExporting(false);
          return;
        }
        await handleExportWebm();
      }
    } catch (err) {
      console.error('Export failed:', err);
      const msg = err instanceof Error ? err.message : 'Export failed';
      setErrorMsg(msg);
      // if video failed, guide to GIF
      if (format === 'webm' && !msg.includes('cancelled')) {
        setErrorMsg(`${msg} — GIF ফরম্যাটে চেষ্টা করো, সব ফোনে খোলে।`);
        setFormat('gif');
      }
      setStage('Export failed');
      setExporting(false);
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
    cancelledRef.current = true;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        /* ignore */
      }
    }
    if (exportUrl) URL.revokeObjectURL(exportUrl);
    setExportUrl(null);
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
        className="editor-panel border border-[var(--editor-border)] rounded-2xl w-full max-w-md p-6 shadow-xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">📤 Export</h2>
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
              <div className="grid grid-cols-4 gap-1.5">
                <button onClick={() => setFormat('webm')} className={btn(format === 'webm')}>
                  <Film size={14} className="mx-auto mb-0.5" /> Video
                </button>
                <button onClick={() => setFormat('gif')} className={btn(format === 'gif')}>
                  <ImageIcon size={14} className="mx-auto mb-0.5" /> GIF
                </button>
                <button onClick={() => setFormat('png')} className={btn(format === 'png')}>
                  <ImageIcon size={14} className="mx-auto mb-0.5" /> PNG
                </button>
                <button onClick={() => setFormat('project')} className={btn(format === 'project')}>
                  <FileJson size={14} className="mx-auto mb-0.5" /> File
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {format === 'gif' && '✅ ফোনের জন্য সেরা — GIF সব জায়গায় খোলে।'}
                {format === 'webm' && 'ভালো কোয়ালিটির ভিডিও (ডেস্কটপ ব্রাউজারে)। ফোনে না খুললে GIF ব্যবহার করো।'}
                {format === 'png' && 'কারেন্ট ফ্রেমের স্ক্রিনশট ডাউনলোড।'}
              </p>
            </div>

            {/* Aspect ratio presets */}
            {format !== 'project' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Aspect Ratio</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['auto', '16:9', '9:16', '1:1'] as const).map((a) => (
                    <button key={a} onClick={() => setAspect(a)} className={btn(aspect === a)}>
                      {a === 'auto' ? 'Auto' : a}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {aspect === '16:9' && 'YouTube/desktop'}
                  {aspect === '9:16' && 'Reels / Shorts / TikTok'}
                  {aspect === '1:1' && 'Square (Instagram)'}
                </p>
              </div>
            )}

            {/* Resolution */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Resolution</label>
              <div className="grid grid-cols-3 gap-2">
                {(['480p', '720p', '1080p'] as Resolution[]).map((res) => {
                  const locked = res === '1080p' && gate.plan !== 'pro';
                  return (
                    <button
                      key={res}
                      onClick={() => !locked && setResolution(res)}
                      className={`${btn(resolution === res && !locked)} ${locked ? 'opacity-50' : ''} relative`}
                      title={locked ? 'Pro feature' : `${res}`}
                    >
                      {res}
                      {locked && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-black/70 text-white flex items-center justify-center"><Lock size={8} /></span>}
                    </button>
                  );
                })}
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
                  onClick={() => gate.plan === 'pro' && setIncludeWatermark(!includeWatermark)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    includeWatermark ? 'bg-blue-500' : 'bg-gray-300'
                  } ${gate.plan !== 'pro' ? 'opacity-70' : ''}`}
                  title={gate.plan === 'pro' ? 'Toggle watermark' : 'Free tier: watermark fixed'}
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
              <p className="text-xs text-gray-400 mt-1">
                {gate.plan === 'pro'
                  ? 'Pro — watermark বন্ধ করা যাবে।'
                  : 'Free tier-এ watermark থাকে — Pro-তে বন্ধ হবে।'}
              </p>
            </div>

            <button
              onClick={handleExport}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-lg transition-all shadow-lg"
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
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 h-3 rounded-full transition-all duration-200" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-center text-sm text-gray-500">{progress}%</p>
            <p className="text-center text-xs text-gray-400 mt-3">এই সময়ে পেজ ছেড়ে যেও না — এক্সপোর্ট বন্ধ হয়ে যাবে।</p>
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

        {/* Off-screen but rendered canvas (NOT display:none — captureStream needs it rasterized) */}
        <canvas
          ref={canvasRef}
          style={{ position: 'fixed', left: '-10000px', top: 0, pointerEvents: 'none' }}
          aria-hidden
        />
      </div>
    </div>
  );
}
