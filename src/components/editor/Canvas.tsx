'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { useProjectStore } from '@/store/project-store';
import {
  drawSceneContent,
  drawSelectionOverlay,
  getSelectionHandles,
  getImage,
} from '@/lib/editor/renderer';
import type { CanvasObject } from '@/types/animation';

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

const HANDLE_HIT_PX = 12;

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const dragRef = useRef<DragState | null>(null);
  const animClockRef = useRef(0);
  const lastFrameRef = useRef(0);

  const {
    canvasObjects,
    selectedObjectId,
    selectObject,
    updateCanvasObject,
    commitTransform,
    activeTool,
    currentSceneId,
    scenes,
    currentTime,
    isPlaying,
  } = useEditorStore();

  const { currentProject } = useProjectStore();

  const currentScene = scenes.find((s) => s.id === currentSceneId);
  // Objects are scoped per scene
  const sceneObjects = canvasObjects.filter((o) => o.sceneId === currentSceneId);
  const selectedObject = sceneObjects.find((o) => o.id === selectedObjectId) || null;

  // -------------------------------------------------------------------------
  // Drawing
  // -------------------------------------------------------------------------

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentProject) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const t = isPlaying ? currentTime : 0;
    drawSceneContent(
      ctx,
      sceneObjects,
      currentScene,
      t,
      animClockRef.current,
      canvas.width,
      canvas.height
    );

    // Selection overlay (always on top, outside rotation)
    if (selectedObject) {
      drawSelectionOverlay(ctx, selectedObject);
    }
  }, [sceneObjects, selectedObject, currentScene, currentProject, isPlaying, currentTime]);

  // Animation loop — also advances the "life" clock for idle breathing
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

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [draw]);

  // Load images for the current scene (custom uploads)
  useEffect(() => {
    sceneObjects.forEach((obj) => {
      if (obj.imageUrl) {
        getImage(obj.imageUrl).catch(() => null);
      }
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
        // rotate hit-testing: rotate the point into object space
        const cx = obj.x + w / 2;
        const cy = obj.y + h / 2;
        const rad = (-obj.rotation * Math.PI) / 180;
        const dx = x - cx;
        const dy = y - cy;
        const lx = dx * Math.cos(rad) - dy * Math.sin(rad) + cx;
        const ly = dx * Math.sin(rad) + dy * Math.cos(rad) + cy;
        if (
          lx >= obj.x &&
          lx <= obj.x + w &&
          ly >= obj.y &&
          ly <= obj.y + h
        ) {
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

      if (Math.hypot(x - handles.rotate.x, y - handles.rotate.y) <= tol + 4) {
        return 'rotate';
      }
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
  // Pointer handling (mouse + touch unified)
  // -------------------------------------------------------------------------

  const startDrag = (
    obj: CanvasObject,
    mode: DragMode,
    pointerId: number,
    point: Point,
    handle?: DragState['handle'],
    anchor?: Point
  ) => {
    dragRef.current = {
      mode,
      pointerId,
      start: point,
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

    // 1) Handles of the currently selected object win over everything
    if (selectedObject) {
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
      if (obj.id !== selectedObjectId) {
        selectObject(obj.id);
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

    // Hover cursor feedback
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
        updateCanvasObject(selectedObject.id, {
          x: objStart.x + dx,
          y: objStart.y + dy,
        });
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
          // Uniform scale from the opposite (anchor) corner — aspect locked
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

          updateCanvasObject(selectedObject.id, {
            scaleX: s,
            scaleY: s,
            x: nx,
            y: ny,
          });
        } else {
          // Edge handles — single axis scaling
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
      commitTransform(); // snapshot for undo
    }
  };

  const cancelDrag = () => {
    if (dragRef.current) {
      dragRef.current = null;
      commitTransform();
    }
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 bg-slate-900 flex items-center justify-center overflow-hidden"
      style={{ touchAction: 'none' }}
    >
      <canvas
        ref={canvasRef}
        className="bg-white shadow-2xl cursor-move select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={cancelDrag}
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
