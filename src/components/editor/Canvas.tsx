'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { useProjectStore } from '@/store/project-store';

interface Point {
  x: number;
  y: number;
}

// Draws a simple stick-figure style character inside the given box
function drawCharacter(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const skin = '#F4C2A1';
  const shirt = '#4A90D9';
  const pants = '#3B4A6B';
  const cx = x + w / 2;

  const headR = w * 0.18;
  const headCY = y + headR + h * 0.02;
  const neckY = headCY + headR;
  const shoulderY = neckY + h * 0.02;
  const hipY = y + h * 0.58;
  const handY = hipY - h * 0.02;
  const footY = y + h * 0.98;

  const shoulderW = w * 0.34;
  const hipW = w * 0.24;

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Legs
  ctx.strokeStyle = pants;
  ctx.lineWidth = w * 0.14;
  ctx.beginPath();
  ctx.moveTo(cx - hipW / 2, hipY);
  ctx.lineTo(cx - hipW / 2, footY);
  ctx.moveTo(cx + hipW / 2, hipY);
  ctx.lineTo(cx + hipW / 2, footY);
  ctx.stroke();

  // Arms
  ctx.strokeStyle = skin;
  ctx.lineWidth = w * 0.1;
  ctx.beginPath();
  ctx.moveTo(cx - shoulderW / 2, shoulderY);
  ctx.lineTo(cx - shoulderW / 2 - w * 0.06, handY);
  ctx.moveTo(cx + shoulderW / 2, shoulderY);
  ctx.lineTo(cx + shoulderW / 2 + w * 0.06, handY);
  ctx.stroke();

  // Body (torso)
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.moveTo(cx - shoulderW / 2, shoulderY);
  ctx.lineTo(cx + shoulderW / 2, shoulderY);
  ctx.lineTo(cx + hipW / 2, hipY);
  ctx.lineTo(cx - hipW / 2, hipY);
  ctx.closePath();
  ctx.fill();

  // Head
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(cx, headCY, headR, 0, Math.PI * 2);
  ctx.fill();

  // Simple face
  ctx.fillStyle = '#333';
  const eyeOffset = headR * 0.35;
  const eyeR = headR * 0.08;
  ctx.beginPath();
  ctx.arc(cx - eyeOffset, headCY - headR * 0.05, eyeR, 0, Math.PI * 2);
  ctx.arc(cx + eyeOffset, headCY - headR * 0.05, eyeR, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#333';
  ctx.lineWidth = Math.max(1, headR * 0.06);
  ctx.beginPath();
  ctx.arc(cx, headCY + headR * 0.15, headR * 0.3, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
}

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Point>({ x: 0, y: 0 });
  const [objectDragStart, setObjectDragStart] = useState<Point | null>(null);

  const {
    canvasObjects,
    selectedObjectId,
    selectObject,
    updateCanvasObject,
    activeTool,
    currentSceneId,
    scenes,
  } = useEditorStore();

  const { currentProject } = useProjectStore();

  const currentScene = scenes.find((s) => s.id === currentSceneId);

  // Draw canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentProject) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background
    ctx.fillStyle = currentScene?.backgroundColor || '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Sort objects by z-index
    const sortedObjects = [...canvasObjects].sort((a, b) => a.zIndex - b.zIndex);

    // Draw each object
    for (const obj of sortedObjects) {
      ctx.save();

      // Apply transformations
      const centerX = obj.x + (obj.width * obj.scaleX) / 2;
      const centerY = obj.y + (obj.height * obj.scaleY) / 2;
      ctx.translate(centerX, centerY);
      ctx.rotate((obj.rotation * Math.PI) / 180);
      ctx.globalAlpha = obj.opacity;
      ctx.translate(-centerX, -centerY);

      // Draw based on type
      if (obj.type === 'character') {
        drawCharacter(ctx, obj.x, obj.y, obj.width * obj.scaleX, obj.height * obj.scaleY);
      } else if (obj.type === 'background' || obj.type === 'prop') {
        const gradient = ctx.createLinearGradient(obj.x, obj.y, obj.x + obj.width * obj.scaleX, obj.y + obj.height * obj.scaleY);

        if (obj.type === 'background') {
          gradient.addColorStop(0, '#98FB98');
          gradient.addColorStop(1, '#32CD32');
        } else {
          gradient.addColorStop(0, '#87CEEB');
          gradient.addColorStop(1, '#4169E1');
        }

        ctx.fillStyle = gradient;
        ctx.fillRect(obj.x, obj.y, obj.width * obj.scaleX, obj.height * obj.scaleY);

        // Draw icon
        ctx.fillStyle = 'white';
        ctx.font = `${Math.min(obj.width * obj.scaleX, obj.height * obj.scaleY) * 0.3}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const icon = obj.type === 'background' ? '🏞️' : '📦';
        ctx.fillText(icon, centerX, centerY);
      } else if (obj.type === 'text' && obj.content) {
        ctx.font = '24px sans-serif';
        ctx.fillStyle = '#333';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(obj.content, obj.x, obj.y);
      }

      // Draw selection border
      if (selectedObjectId === obj.id) {
        ctx.strokeStyle = '#3B82F6';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(
          obj.x - 2,
          obj.y - 2,
          obj.width * obj.scaleX + 4,
          obj.height * obj.scaleY + 4
        );

        // Draw resize handles
        const handleSize = 8;
        ctx.fillStyle = '#3B82F6';
        ctx.setLineDash([]);

        // Corner handles
        const corners = [
          { x: obj.x - handleSize / 2, y: obj.y - handleSize / 2 },
          { x: obj.x + obj.width * obj.scaleX - handleSize / 2, y: obj.y - handleSize / 2 },
          { x: obj.x - handleSize / 2, y: obj.y + obj.height * obj.scaleY - handleSize / 2 },
          { x: obj.x + obj.width * obj.scaleX - handleSize / 2, y: obj.y + obj.height * obj.scaleY - handleSize / 2 },
        ];

        corners.forEach((corner) => {
          ctx.fillRect(corner.x, corner.y, handleSize, handleSize);
        });
      }

      ctx.restore();
    }
  }, [canvasObjects, selectedObjectId, currentProject, currentScene]);

  // Animation loop
  useEffect(() => {
    let animationId: number;

    const animate = () => {
      draw();
      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [draw]);

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

  // Get canvas coordinates from mouse/touch event
  const getCanvasCoords = (clientX: number, clientY: number): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / scale,
      y: (clientY - rect.top) / scale,
    };
  };

  // Find object at position
  const findObjectAtPosition = (x: number, y: number) => {
    const sortedObjects = [...canvasObjects].sort((a, b) => b.zIndex - a.zIndex);

    for (const obj of sortedObjects) {
      if (
        x >= obj.x &&
        x <= obj.x + obj.width * obj.scaleX &&
        y >= obj.y &&
        y <= obj.y + obj.height * obj.scaleY
      ) {
        return obj;
      }
    }
    return null;
  };

  // Mouse handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    const coords = getCanvasCoords(e.clientX, e.clientY);
    const obj = findObjectAtPosition(coords.x, coords.y);

    if (obj) {
      selectObject(obj.id);
      setObjectDragStart(coords);
    } else {
      selectObject(null);
    }

    setIsDragging(true);
    setDragStart(coords);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !selectedObjectId || !objectDragStart) return;
    const coords = getCanvasCoords(e.clientX, e.clientY);
    const obj = canvasObjects.find((o) => o.id === selectedObjectId);
    if (!obj) return;

    if (activeTool === 'select' || activeTool === 'move') {
      const deltaX = coords.x - objectDragStart.x;
      const deltaY = coords.y - objectDragStart.y;

      updateCanvasObject(selectedObjectId, {
        x: obj.x + deltaX,
        y: obj.y + deltaY,
      });

      setObjectDragStart(coords);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setObjectDragStart(null);
  };

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const coords = getCanvasCoords(touch.clientX, touch.clientY);
      const obj = findObjectAtPosition(coords.x, coords.y);
      if (obj) {
        selectObject(obj.id);
        setObjectDragStart(coords);
      } else {
        selectObject(null);
      }

      setIsDragging(true);
      setDragStart(coords);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging && selectedObjectId && objectDragStart) {
      e.preventDefault();
      const touch = e.touches[0];
      const coords = getCanvasCoords(touch.clientX, touch.clientY);
      const obj = canvasObjects.find((o) => o.id === selectedObjectId);
      if (!obj) return;

      const deltaX = coords.x - objectDragStart.x;
      const deltaY = coords.y - objectDragStart.y;

      updateCanvasObject(selectedObjectId, {
        x: obj.x + deltaX,
        y: obj.y + deltaY,
      });

      setObjectDragStart(coords);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setObjectDragStart(null);
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 bg-gray-900 flex items-center justify-center overflow-hidden"
    >
      <canvas
        ref={canvasRef}
        className="bg-white shadow-2xl cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
    </div>
  );
}
