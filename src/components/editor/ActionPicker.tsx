'use client';

// ============================================================================
// ActionPicker — bottom sheet that appears when a character is selected.
// Shows the character + search + angle tabs + a grid of pose/action tiles.
// EVERY tile renders a small LOOPING PREVIEW of the actual motion on a mini
// canvas (not a static image). Tapping applies the action to the character
// on the canvas and records a keyframe on its timeline clip.
// ============================================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Check, Sparkles } from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
import { drawSceneContent } from '@/lib/editor/renderer';
import type { CanvasObject, CharacterAction, CharacterExpression } from '@/types/animation';

type Angle = 'FRONT' | '3/4 FRONT' | '3/4 BACK';
const ANGLES: Angle[] = ['FRONT', '3/4 FRONT', '3/4 BACK'];

interface ActionTile {
  id: string;
  label: string;
  action: CharacterAction;
  expression?: CharacterExpression;
  soon?: boolean;
}

// The reference pose set (extend later as more get added)
const ACTION_TILES: ActionTile[] = [
  { id: 'idle', label: 'Idle', action: 'idle' },
  { id: 'walk', label: 'Walk', action: 'walk' },
  { id: 'talk', label: 'Talking', action: 'talk' },
  { id: 'sit', label: 'Sitting', action: 'sit' },
  { id: 'idle-happy', label: 'Idle Happy', action: 'idle', expression: 'happy' },
  { id: 'run', label: 'Run', action: 'run' },
  { id: 'sit-kneel', label: 'Sitting On Knees', action: 'sit-kneel' },
  { id: 'namaskar', label: 'Namaskar Sitting', action: 'namaskar' },
  { id: 'give', label: 'Giving Things', action: 'give' },
  { id: 'sweep', label: 'Dust Collect Karna', action: 'sweep' },
  { id: 'wash', label: 'Bartan Dhona Loop', action: 'wash' },
  { id: 'sit-floor', label: 'Sitting On Floor', action: 'sit' },
  { id: 'jog', label: 'Jogging', action: 'jog' },
  { id: 'sit-crossed', label: 'Sitting Crossed Leg', action: 'sit-crossed' },
  { id: 'sit-floor-idle', label: 'Sitting Floor Idle', action: 'sit' },
  { id: 'sleep-stomach', label: 'Sleeping On Stomach', action: 'sleep-stomach' },
  { id: 'sit-idle', label: 'Sitting Idle', action: 'sit' },
  { id: 'cook', label: 'Cooking', action: 'cook' },
  { id: 'fly', label: 'Flying Idle', action: 'fly' },
  { id: 'sleep-back', label: 'Sleeping On Back', action: 'sleep-back' },
];

// lightweight scene for preview rendering
const PREVIEW_SCENE = {
  id: 'preview',
  projectId: '',
  name: 'Preview',
  order: 0,
  duration: 5000,
  backgroundColor: 'transparent',
  cameraSettings: { x: 0, y: 0, zoom: 1, rotation: 0, keyframes: [] },
  transition: { type: 'none' as const, duration: 0 },
};

interface ActionPickerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ActionPicker({ isOpen, onClose }: ActionPickerProps) {
  const [search, setSearch] = useState('');
  const [angle, setAngle] = useState<Angle>('FRONT');

  const { canvasObjects, selectedObjectId, scenes, currentSceneId, tracks, clips, setObjectAction, setObjectExpression, addKeyframe } = useEditorStore();

  const selectedObject = canvasObjects.find((o) => o.id === selectedObjectId) || null;
  const isCharacter = selectedObject?.type === 'character';

  // reset search when closed (deferred so it never runs mid-render)
  useEffect(() => {
    if (isOpen) return;
    const t = setTimeout(() => {
      setSearch('');
      setAngle('FRONT');
    }, 0);
    return () => clearTimeout(t);
  }, [isOpen]);

  const filtered = ACTION_TILES.filter((t) =>
    t.label.toLowerCase().includes(search.trim().toLowerCase())
  );

  const applyAction = (tile: ActionTile) => {
    if (!selectedObject || tile.soon) return;
    setObjectAction(selectedObject.id, tile.action);
    if (tile.expression) setObjectExpression(selectedObject.id, tile.expression);

    // record a keyframe on the character's clip at the current playhead so the
    // timeline reflects the action too
    const clip = clips.find(
      (c) =>
        c.assetId === selectedObject.assetId &&
        c.assetId != null &&
        c.sceneId === currentSceneId
    );
    if (clip) {
      const st = useEditorStore.getState();
      const clipTime = st.currentTime - clip.startTime;
      if (clipTime >= 0) {
        addKeyframe(clip.id, clipTime, {
          action: tile.action,
          ...(tile.expression ? { expression: tile.expression } : {}),
        });
      }
    }
    onClose();
  };

  if (!isOpen) return null;

  const currentAction = selectedObject?.action || 'idle';
  const currentExpression = selectedObject?.expression || 'neutral';

  return (
    <div className="fixed inset-0 z-[65] flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative editor-panel border-t border-[var(--editor-border)] rounded-t-3xl shadow-2xl max-h-[82vh] flex flex-col animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* grab handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[#33333F]" />
        </div>

        {/* Header: selected character */}
        <div className="px-4 py-3 flex items-center gap-3 border-b border-[var(--editor-border)]">
          <SelectedThumb obj={selectedObject} />
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm truncate">
              {selectedObject?.name || 'Character'}
            </p>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--editor-accent)]/15 text-[var(--editor-accent)] text-[10px] font-semibold">
              <Check size={10} /> Selected
            </span>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full editor-panel-2 text-[var(--editor-text-2)] hover:text-white">
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pt-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--editor-text-2)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Animations"
              className="editor-input w-full pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--editor-accent)]"
            />
          </div>
        </div>

        {/* Angle tabs */}
        <div className="px-4 pt-3">
          <div className="grid grid-cols-3 gap-1.5">
            {ANGLES.map((a) => (
              <button
                key={a}
                onClick={() => setAngle(a)}
                className={`py-2 rounded-lg text-[11px] font-semibold transition-colors ${
                  angle === a
                    ? 'editor-gradient text-white'
                    : 'editor-panel-2 text-[var(--editor-text-2)] hover:text-white'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* Pose grid */}
        <div className="flex-1 overflow-y-auto editor-scroll px-4 py-4">
          <p className="text-[10px] uppercase tracking-wider text-[var(--editor-text-2)] mb-2 flex items-center gap-1">
            <Sparkles size={11} className="text-[var(--editor-accent-2)]" /> Animations
          </p>
          <div className="grid grid-cols-3 gap-2.5">
            {filtered.map((tile) => {
              const isActive =
                !tile.soon &&
                tile.action === currentAction &&
                (!tile.expression || tile.expression === currentExpression);
              return (
                <ActionTileCard
                  key={tile.id}
                  tile={tile}
                  active={isActive}
                  angle={angle}
                  characterType={selectedObject?.characterType || 'boy'}
                  color={selectedObject?.color}
                  onTap={() => applyAction(tile)}
                />
              );
            })}
          </div>

          {filtered.length === 0 && (
            <p className="text-center text-xs text-[var(--editor-text-2)] py-8">No animation found</p>
          )}

          <p className="text-center text-[10px] text-[var(--editor-text-2)] mt-4">
            Tile-এ ক্লিক করলেই character-এ প্রয়োগ হয় — আরো animation আসছে
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Selected character thumbnail (static preview)
// ---------------------------------------------------------------------------

function SelectedThumb({ obj }: { obj: CanvasObject | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const w = 56;
    const h = 64;
    const o: CanvasObject = {
      ...(obj || { id: 'x', type: 'character', x: 0, y: 0, width: 44, height: 56, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, zIndex: 1 }),
      x: 4,
      y: 4,
      width: 48,
      height: 56,
      action: obj?.action || 'idle',
      expression: obj?.expression || 'neutral',
    };
    drawSceneContent(ctx, [o], PREVIEW_SCENE, 0, 0, w, h, { playback: false });
  }, [obj]);
  return (
    <canvas ref={ref} width={56} height={64} className="w-14 h-16 rounded-xl bg-[var(--editor-panel-2)] shrink-0" />
  );
}

// ---------------------------------------------------------------------------
// Action tile with LIVE looping preview
// ---------------------------------------------------------------------------

function ActionTileCard({
  tile,
  active,
  angle,
  characterType,
  color,
  onTap,
}: {
  tile: ActionTile;
  active: boolean;
  angle: Angle;
  characterType: CanvasObject['characterType'];
  color?: string;
  onTap: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const clockRef = useRef(0);

  // loop the preview at ~12fps using wall-clock delta (cheap, smooth enough)
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    let raf: number;
    let last = performance.now();
    const draw = (now: number) => {
      const delta = now - last;
      last = now;
      clockRef.current += delta;

      const w = c.width;
      const h = c.height;
      ctx.clearRect(0, 0, w, h);

      const o: CanvasObject = {
        id: 'prev',
        type: 'character',
        x: 4,
        y: 4,
        width: w - 8,
        height: h - 8,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        opacity: 1,
        zIndex: 1,
        characterType,
        color,
        action: tile.soon ? 'idle' : tile.action,
        expression: tile.expression || 'neutral',
      };
      drawSceneContent(ctx, [o], PREVIEW_SCENE, 0, clockRef.current, w, h, {
        playback: true,
      });

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [tile, characterType, color]);

  const tilt =
    angle === '3/4 FRONT' ? 'scaleX(0.92)' : angle === '3/4 BACK' ? 'scaleX(-0.92)' : 'none';

  return (
    <button
      onClick={onTap}
      className={`relative rounded-2xl overflow-hidden editor-panel-2 border transition-all active:scale-95 ${
        active
          ? 'border-[var(--editor-accent)] ring-2 ring-[var(--editor-accent)]/40'
          : 'border-[var(--editor-border)] hover:border-[var(--editor-accent)]/60'
      } ${tile.soon ? 'opacity-55' : ''}`}
    >
      {/* live preview canvas */}
      <div className="w-full aspect-[4/5] flex items-center justify-center bg-gradient-to-b from-[#1E1E28] to-[#16161C]">
        <canvas
          ref={ref}
          width={72}
          height={90}
          className="w-[62%] h-[86%]"
          style={{ transform: tilt }}
        />
      </div>

      {/* active check badge */}
      {active && (
        <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full editor-gradient flex items-center justify-center text-white">
          <Check size={12} />
        </span>
      )}

      {/* soon tag */}
      {tile.soon && (
        <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 text-white text-[8px] font-semibold">
          Soon
        </span>
      )}

      <p className="px-1.5 py-1.5 text-[10px] text-white truncate text-center font-medium">
        {tile.label}
      </p>
    </button>
  );
}
