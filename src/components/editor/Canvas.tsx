'use client';

import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { useProjectStore } from '@/store/project-store';
import {
  drawSceneContent,
  drawSelectionOverlay,
  getSelectionHandles,
  getImage,
  mixColors,
  transitionProgress,
} from '@/lib/editor/renderer';
import { applyKeyframes } from '@/lib/editor/keyframes';
import { PoseAnimator } from '@/lib/editor/animations';
import type { CharacterPose } from '@/lib/editor/renderer';
import type { CanvasObject } from '@/types/animation';

interface CanvasProps {
  /** Called when an object is double-clicked (e.g. open text editor). */
  onDoubleClickObject?: (obj: CanvasObject) => void;
  /** Called when a character is TAPPED (pointer down+up without drag). */
  onTapCharacter?: (obj: CanvasObject) => void;
}

interface Point {
  x: number;
  y: number;
}

type DragMode =
  | 'move'
  | 'scale-tool'
  | 'rotate-tool'
  | 'resize'
  | 'rotate-handle'
  | null;

interface DragState {
  mode: DragMode;
  pointerId: number;
  start: Point;
  objStarts: { id: string; x: number; y: number }[];
  objStart: {
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
    rotation: number;
    width: number;
    height: number;
  };
  handle?: { id: 'tl' | 'tr' | 'bl' | 'br' | 'n' | 's' | 'e' | 'w' };
  anchor?: Point;
  startAngle?: number;
}

const HANDLE_HIT_PX = 18; // generous touch target (>=24px on screen)

export function Canvas({ onDoubleClickObject, onTapCharacter }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<DragState | null>(null);
  const animClockRef = useRef(0);
  const lastFrameRef = useRef(0);
  // per-object PoseAnimators — smooth action transitions on the main canvas
  const animatorsRef = useRef(new Map<string, PoseAnimator>());
  // tap detection: pointer-down position + whether the down was a multi-select
  const downScreenRef = useRef<{ x: number; y: number } | null>(null);
  const downPointRef = useRef<Point | null>(null);
  const multiDownRef = useRef(false);
  const TAP_THRESHOLD_PX = 8;

  const {
    canvasObjects,
    clips,
    selectedObjectId,
    selectedObjectIds,
    selectObject,
    toggleMultiSelect,
    updateCanvasObject,
    commitTransform,
    activeTool,
    currentSceneId,
    scenes,
    currentTime,
    isPlaying,
    playbackRate,
    watermarkEnabled,
    watermarkText,
    lipSyncLevel,
  } = useEditorStore();

  const { currentProject } = useProjectStore();

  const currentScene = scenes.find((s) => s.id === currentSceneId);
  const sceneIndex = scenes.findIndex((s) => s.id === currentSceneId);
  const nextScene = sceneIndex >= 0 ? scenes[sceneIndex + 1] : undefined;
  const nextSceneObjects = useMemo(
    () => (nextScene ? canvasObjects.filter((o) => o.sceneId === nextScene.id) : []),
    [nextScene, canvasObjects]
  );

  // Objects scoped per scene
  const sceneObjects = canvasObjects.filter((o) => o.sceneId === currentSceneId);
  const selectedObject = sceneObjects.find((o) => o.id === selectedObjectId) || null;

  // Keyframe interpolation: applied while playing AND while scrubbing paused,
  // but skipped while the user is actively dragging an object so edits feel direct.
  const effectiveObjects = useMemo(() => {
    if (dragging) return sceneObjects;
    return sceneObjects.map((o) =>
      applyKeyframes(o, clips, currentTime, currentSceneId ?? undefined)
    );
  }, [sceneObjects, clips, currentTime, currentSceneId, dragging]);

  // -------------------------------------------------------------------------
  // Drawing
  // -------------------------------------------------------------------------

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentProject) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const t = isPlaying ? currentTime : 0;

    // Scene transition live preview: near the end of a scene, blend into next
    let bgOverride: string | undefined;
    let slideOffset = 0;
    if (isPlaying && currentScene && nextScene) {
      const tp = transitionProgress(t, currentScene.duration, currentScene.transition.duration);
      if (tp > 0) {
        bgOverride = mixColors(
          currentScene.backgroundColor,
          nextScene.backgroundColor,
          tp
        );
        if (currentScene.transition.type === 'slide') slideOffset = (1 - tp) * canvas.width * 0.35;
      }
    }

    // PoseAnimator: compute a blended pose for every character (transitions
    // between actions are smooth, and match the picker previews exactly).
    const poses: Record<string, CharacterPose> = {};
    for (const obj of effectiveObjects) {
      if (obj.type !== 'character') continue;
      let anim = animatorsRef.current.get(obj.id);
      if (!anim) {
        anim = new PoseAnimator();
        animatorsRef.current.set(obj.id, anim);
      }
      const now = performance.now();
      const action = obj.action || 'idle';
      const spd = obj.animSpeed || playbackRate;
      poses[obj.id] = anim.step(action, animClockRef.current, now, spd);
    }

    const drawOpts = {
      playback: isPlaying,
      sceneDuration: currentScene?.duration,
      lipSyncLevel,
      poses,
      watermark: { text: watermarkText, enabled: watermarkEnabled },
    };

    // Draw current scene content
    ctx.save();
    if (slideOffset) ctx.translate(-slideOffset, 0);
    drawSceneContent(
      ctx,
      effectiveObjects,
      currentScene ? { ...currentScene, backgroundColor: bgOverride || currentScene.backgroundColor } : currentScene,
      t,
      animClockRef.current,
      canvas.width,
      canvas.height,
      drawOpts
    );
    ctx.restore();

    // Transition: slide the next scene in
    if (isPlaying && currentScene && nextScene && currentScene.transition.type === 'slide') {
      const tp = transitionProgress(t, currentScene.duration, currentScene.transition.duration);
      if (tp > 0 && tp < 1) {
        ctx.save();
        ctx.translate(canvas.width * (1 - tp), 0);
        drawSceneContent(ctx, nextSceneObjects, nextScene, 0, animClockRef.current, canvas.width, canvas.height, {
          playback: true,
          sceneDuration: nextScene.duration,
          lipSyncLevel,
        });
        ctx.restore();
      }
    }

    // Selection overlays (multi)
    for (const o of sceneObjects) {
      if (selectedObjectIds.includes(o.id)) {
        if (o.id === selectedObjectId) {
          drawSelectionOverlay(ctx, o);
        } else {
          // light dashed outline for secondary selections
          ctx.save();
          ctx.strokeStyle = 'rgba(59,130,246,0.55)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([5, 5]);
          ctx.strokeRect(o.x, o.y, o.width * o.scaleX, o.height * o.scaleY);
          ctx.restore();
        }
      }
    }
  }, [
    effectiveObjects,
    nextSceneObjects,
    sceneObjects,
    selectedObjectIds,
    selectedObjectId,
    currentScene,
    nextScene,
    currentProject,
    isPlaying,
    currentTime,
    playbackRate,
    watermarkEnabled,
    watermarkText,
    lipSyncLevel,
  ]);

  // Animation loop
  useEffect(() => {
    let animationId: number;
    const animate = (now: number) => {
      const delta = lastFrameRef.current ? now - lastFrameRef.current : 16;
      lastFrameRef.current = now;
      animClockRef.current += delta;
      draw();
      animationId = requestAnimationFrame(animate);
    };
    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [draw]);

  // Load images for the current scene
  useEffect(() => {
    sceneObjects.forEach((obj) => {
      if (obj.imageUrl) getImage(obj.imageUrl).catch(() => null);
    });
  }, [sceneObjects]);

  // Handle resize
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas || !currentProject) return;

    const updateSize = () => {
      const containerRect = container.getBoundingClientRect();
      const aspectRatio = currentProject.width / currentProject.height;
      let width = containerRect.width;
      let height = width / aspectRatio;
      if (height > containerRect.height) {
        height = containerRect.height;
        width = height * aspectRatio;
      }
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvas.width = currentProject.width;
      canvas.height = currentProject.height;
      setScale(width / currentProject.width);
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [currentProject]);

  // -------------------------------------------------------------------------
  // Coordinate helpers
  // -------------------------------------------------------------------------

  const getCanvasCoords = useCallback(
    (clientX: number, clientY: number): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: (clientX - rect.left) / scale,
        y: (clientY - rect.top) / scale,
      };
    },
    [scale]
  );

  const findObjectAtPosition = useCallback(
    (x: number, y: number): CanvasObject | null => {
      const sorted = [...sceneObjects].sort((a, b) => b.zIndex - a.zIndex);
      for (const obj of sorted) {
        const w = obj.width * obj.scaleX;
        const h = obj.height * obj.scaleY;
        const cx = obj.x + w / 2;
        const cy = obj.y + h / 2;
        const rad = (-obj.rotation * Math.PI) / 180;
        const dx = x - cx;
        const dy = y - cy;
        const lx = dx * Math.cos(rad) - dy * Math.sin(rad) + cx;
        const ly = dx * Math.sin(rad) + dy * Math.cos(rad) + cy;
        if (lx >= obj.x && lx <= obj.x + w && ly >= obj.y && ly <= obj.y + h) {
          return obj;
        }
      }
      return null;
    },
    [sceneObjects]
  );

  const hitTestHandles = useCallback(
    (obj: CanvasObject, x: number, y: number): DragState['handle'] | 'rotate' | null => {
      const tol = HANDLE_HIT_PX / scale;
      const handles = getSelectionHandles(obj);
      if (Math.hypot(x - handles.rotate.x, y - handles.rotate.y) <= tol + 4) return 'rotate';
      for (const c of handles.corners) {
        if (Math.abs(x - c.x) <= tol && Math.abs(y - c.y) <= tol) return { id: c.id };
      }
      for (const e of handles.edges) {
        if (Math.abs(x - e.x) <= tol && Math.abs(y - e.y) <= tol) return { id: e.id };
      }
      return null;
    },
    [scale]
  );

  const getCursorForHandle = (handle: string | null) => {
    switch (handle) {
      case 'tl':
      case 'br':
        return 'nwse-resize';
      case 'tr':
      case 'bl':
        return 'nesw-resize';
      case 'n':
      case 's':
        return 'ns-resize';
      case 'e':
      case 'w':
        return 'ew-resize';
      case 'rotate':
        return 'grab';
      default:
        return activeTool === 'rotate' ? 'grab' : activeTool === 'scale' ? 'nwse-resize' : 'move';
    }
  };

  // -------------------------------------------------------------------------
  // Pointer handling
  // -------------------------------------------------------------------------

  const startDrag = (
    obj: CanvasObject,
    mode: DragMode,
    pointerId: number,
    point: Point,
    handle?: DragState['handle'],
    anchor?: Point
  ) => {
    // If keyframes exist, commit the interpolated position so dragging starts
    // exactly where the object is drawn (no jump).
    const eff = applyKeyframes(obj, clips, currentTime, currentSceneId ?? undefined);
    if (eff !== obj) {
      updateCanvasObject(obj.id, {
        x: eff.x,
        y: eff.y,
        scaleX: eff.scaleX,
        scaleY: eff.scaleY,
        rotation: eff.rotation,
        opacity: eff.opacity,
      });
      obj = eff;
    }

    const multiIds = selectedObjectIds.includes(obj.id) && selectedObjectIds.length > 1
      ? selectedObjectIds
      : [obj.id];
    const objStarts = multiIds
      .map((id) => sceneObjects.find((o) => o.id === id))
      .filter((o): o is CanvasObject => !!o)
      .map((o) => ({ id: o.id, x: o.x, y: o.y }));

    setDragging(true);
    dragRef.current = {
      mode,
      pointerId,
      start: point,
      objStarts,
      objStart: {
        x: obj.x,
        y: obj.y,
        scaleX: obj.scaleX,
        scaleY: obj.scaleY,
        rotation: obj.rotation,
        width: obj.width,
        height: obj.height,
      },
      handle,
      anchor,
      startAngle: Math.atan2(
        point.y - (obj.y + (obj.height * obj.scaleY) / 2),
        point.x - (obj.x + (obj.width * obj.scaleX) / 2)
      ),
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();

    const point = getCanvasCoords(e.clientX, e.clientY);
    const multi = e.shiftKey || e.metaKey || e.ctrlKey;

    // remember down-position for tap detection (drag = no popup)
    downScreenRef.current = { x: e.clientX, y: e.clientY };
    downPointRef.current = point;
    multiDownRef.current = multi;

    // 1) Handles of the primary selected object
    if (selectedObject && !multi) {
      const hit = hitTestHandles(selectedObject, point.x, point.y);
      if (hit === 'rotate') {
        startDrag(selectedObject, 'rotate-handle', e.pointerId, point);
        return;
      }
      if (hit && hit.id) {
        const w = selectedObject.width * selectedObject.scaleX;
        const h = selectedObject.height * selectedObject.scaleY;
        const anchor =
          hit.id === 'tl'
            ? { x: selectedObject.x + w, y: selectedObject.y + h }
            : hit.id === 'tr'
            ? { x: selectedObject.x, y: selectedObject.y + h }
            : hit.id === 'bl'
            ? { x: selectedObject.x + w, y: selectedObject.y }
            : hit.id === 'br'
            ? { x: selectedObject.x, y: selectedObject.y }
            : null;
        startDrag(selectedObject, 'resize', e.pointerId, point, hit, anchor || undefined);
        return;
      }
    }

    // 2) Object hit test
    const obj = findObjectAtPosition(point.x, point.y);
    if (obj) {
      if (multi) {
        toggleMultiSelect(obj.id);
      } else {
        selectObject(obj.id); // also resets multi-selection to [obj.id]
      }
      if (activeTool === 'scale') {
        startDrag(obj, 'scale-tool', e.pointerId, point);
      } else if (activeTool === 'rotate') {
        startDrag(obj, 'rotate-tool', e.pointerId, point);
      } else {
        startDrag(obj, 'move', e.pointerId, point);
      }
    } else {
      selectObject(null);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const point = getCanvasCoords(e.clientX, e.clientY);

    if (!dragRef.current) {
      let cursor: string | null = null;
      if (selectedObject) {
        const hit = hitTestHandles(selectedObject, point.x, point.y);
        if (hit) cursor = getCursorForHandle(typeof hit === 'string' ? hit : hit.id);
      }
      const canvas = canvasRef.current;
      if (canvas) canvas.style.cursor = cursor || getCursorForHandle(null);
      return;
    }

    const drag = dragRef.current;
    if (e.pointerId !== drag.pointerId || !selectedObject) return;

    const objStart = drag.objStart;
    const cx = objStart.x + (objStart.width * objStart.scaleX) / 2;
    const cy = objStart.y + (objStart.height * objStart.scaleY) / 2;

    switch (drag.mode) {
      case 'move': {
        const dx = point.x - drag.start.x;
        const dy = point.y - drag.start.y;
        // move every selected object together
        for (const s of drag.objStarts) {
          updateCanvasObject(s.id, { x: s.x + dx, y: s.y + dy });
        }
        break;
      }
      case 'scale-tool': {
        const startDist = Math.max(1, Math.hypot(drag.start.x - cx, drag.start.y - cy));
        const curDist = Math.hypot(point.x - cx, point.y - cy);
        const s = clamp(curDist / startDist, 0.02, 40);
        updateCanvasObject(selectedObject.id, {
          scaleX: objStart.scaleX * s,
          scaleY: objStart.scaleY * s,
        });
        break;
      }
      case 'rotate-tool':
      case 'rotate-handle': {
        const angle = Math.atan2(point.y - cy, point.x - cx);
        const delta = angle - (drag.startAngle || 0);
        const rot = normalizeDeg(objStart.rotation + (delta * 180) / Math.PI);
        updateCanvasObject(selectedObject.id, { rotation: rot });
        break;
      }
      case 'resize': {
        const handle = drag.handle?.id;
        if (!handle) break;
        const baseW = objStart.width;
        const baseH = objStart.height;

        if (handle === 'tl' || handle === 'tr' || handle === 'bl' || handle === 'br') {
          const anchor = drag.anchor || {
            x: objStart.x + (handle === 'tl' || handle === 'bl' ? baseW * objStart.scaleX : 0),
            y: objStart.y + (handle === 'tl' || handle === 'tr' ? baseH * objStart.scaleY : 0),
          };
          const w0 = baseW * objStart.scaleX;
          const h0 = baseH * objStart.scaleY;
          const diag = Math.hypot(w0, h0);
          const dir = { x: (cx - anchor.x) / diag, y: (cy - anchor.y) / diag };
          const proj = (point.x - anchor.x) * dir.x + (point.y - anchor.y) * dir.y;
          const s = clamp(proj / diag, 0.02, 40);

          let nx = objStart.x;
          let ny = objStart.y;
          const nw = baseW * s;
          const nh = baseH * s;
          if (handle === 'tl') {
            nx = anchor.x - nw;
            ny = anchor.y - nh;
          } else if (handle === 'tr') {
            nx = anchor.x;
            ny = anchor.y - nh;
          } else if (handle === 'bl') {
            nx = anchor.x - nw;
            ny = anchor.y;
          } else {
            nx = anchor.x;
            ny = anchor.y;
          }

          updateCanvasObject(selectedObject.id, { scaleX: s, scaleY: s, x: nx, y: ny });
        } else {
          if (handle === 'e' || handle === 'w') {
            const w0 = baseW * objStart.scaleX;
            const factor =
              handle === 'e'
                ? (point.x - objStart.x) / w0
                : (objStart.x + w0 - point.x) / w0;
            const s = clamp(factor, 0.02, 40);
            updateCanvasObject(selectedObject.id, {
              scaleX: s,
              x: handle === 'w' ? objStart.x + w0 - baseW * s : objStart.x,
            });
          } else {
            const h0 = baseH * objStart.scaleY;
            const factor =
              handle === 's'
                ? (point.y - objStart.y) / h0
                : (objStart.y + h0 - point.y) / h0;
            const s = clamp(factor, 0.02, 40);
            updateCanvasObject(selectedObject.id, {
              scaleY: s,
              y: handle === 'n' ? objStart.y + h0 - baseH * s : objStart.y,
            });
          }
        }
        break;
      }
      default:
        break;
    }
  };

  const endDrag = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current && dragRef.current.pointerId === e.pointerId) {
      dragRef.current = null;
      setDragging(false);
      commitTransform();
    }

    // TAP detection: pointer went down & up with almost no movement and no
    // multi-select → treat as a tap. If a character was tapped, open the
    // Action Picker (same motion source as the previews).
    const downScreen = downScreenRef.current;
    const downPoint = downPointRef.current;
    const wasMulti = multiDownRef.current;
    downScreenRef.current = null;
    downPointRef.current = null;
    multiDownRef.current = false;
    if (!wasMulti && downScreen && downPoint && onTapCharacter) {
      const dist = Math.hypot(e.clientX - downScreen.x, e.clientY - downScreen.y);
      if (dist <= TAP_THRESHOLD_PX) {
        const obj = findObjectAtPosition(downPoint.x, downPoint.y);
        if (obj && obj.type === 'character') {
          onTapCharacter(obj);
        }
      }
    }
  };

  const cancelDrag = () => {
    if (dragRef.current) {
      dragRef.current = null;
      setDragging(false);
      commitTransform();
    }
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getCanvasCoords(e.clientX, e.clientY);
    const obj = findObjectAtPosition(point.x, point.y);
    if (obj) {
      selectObject(obj.id);
      onDoubleClickObject?.(obj);
    }
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 editor-surface flex items-center justify-center overflow-hidden"
      style={{ touchAction: 'none' }}
    >
      <canvas
        ref={canvasRef}
        className="bg-white shadow-2xl cursor-move select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={cancelDrag}
        onDoubleClick={handleDoubleClick}
        onPointerLeave={() => {
          if (!dragRef.current) {
            const canvas = canvasRef.current;
            if (canvas) canvas.style.cursor = getCursorForHandle(null);
          }
        }}
      />
    </div>
  );
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function normalizeDeg(deg: number) {
  return ((deg % 360) + 360) % 360;
}
