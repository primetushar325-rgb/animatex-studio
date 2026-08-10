'use client';

// ============================================================================
// ActionPicker — character action + angle animation popup.
// Fully data-driven via the Action Registry (src/lib/editor/animations.ts):
//   - categories, search, view (angle) tabs
//   - each tile renders a LIVE looping preview of the actual motion at the
//     selected angle, using the SAME engine as the main canvas (PoseAnimator
//     + renderer) so preview and applied motion can never drift
//   - smooth transitions between actions via pose blending (no teleporting)
//   - speed control + fallback handling for missing angle/action combos
// ============================================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Check, Sparkles, Gauge } from 'lucide-react';
import { charMotionClass } from '@/lib/editor/characterLibrary15';
import { useEditorStore } from '@/store/editor-store';
import { drawSceneContent } from '@/lib/editor/renderer';
import { getActionPose } from '@/lib/editor/renderer';
import {
  ACTION_CATEGORIES,
  ACTION_REGISTRY,
  VIEW_LABELS,
  searchActions,
  resolveClip,
  PoseAnimator,
  setActionOverrides,
  type ActionClip,
  type AnimationView,
} from '@/lib/editor/animations';
import type { CanvasObject, CharacterType } from '@/types/animation';

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

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
  const [category, setCategory] = useState<(typeof ACTION_CATEGORIES)[number]['id']>('all');
  const [view, setView] = useState<AnimationView>('front');
  const [speed, setSpeed] = useState(1);

  const { canvasObjects, selectedObjectId, currentSceneId, clips, setObjectAction, setObjectExpression, setPlaybackRate, addKeyframe } = useEditorStore();

  const selectedObject = canvasObjects.find((o) => o.id === selectedObjectId) || null;
  const isCharacter = selectedObject?.type === 'character';

  // reset search/category when closed + load admin overrides once
  useEffect(() => {
    if (isOpen) return;
    const t = setTimeout(() => {
      setSearch('');
      setCategory('all');
    }, 0);
    return () => clearTimeout(t);
  }, [isOpen]);

  // pull admin-managed animation overrides (speed/loop/new actions) once
  useEffect(() => {
    let alive = true;
    fetch('/api/admin/animations')
      .then((r) => r.json())
      .then((data) => {
        if (alive && data.overrides) setActionOverrides(data.overrides);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const clipsForCategory = searchActions(search, category);

  const applyAction = (clip: ActionClip) => {
    if (!selectedObject || !isCharacter) return;
    setObjectAction(selectedObject.id, clip.action);
    if (clip.expression) setObjectExpression(selectedObject.id, clip.expression);
    // apply the selected view to the object so canvas renders at this angle
    if (view !== 'front') {
      useEditorStore.getState().updateCanvasObject(selectedObject.id, { view });
    }
    // record a keyframe on the character's clip at the current playhead
    const clipRow = clips.find(
      (c) =>
        c.assetId === selectedObject.assetId &&
        c.assetId != null &&
        c.sceneId === currentSceneId
    );
    if (clipRow) {
      const st = useEditorStore.getState();
      const clipTime = st.currentTime - clipRow.startTime;
      if (clipTime >= 0) {
        addKeyframe(clipRow.id, clipTime, {
          action: clip.action,
          ...(clip.expression ? { expression: clip.expression } : {}),
        });
      }
    }
    onClose();
  };

  const changeSpeed = (s: number) => {
    setSpeed(s);
    setPlaybackRate(s); // sync timeline playback so canvas matches previews
  };

  if (!isOpen) return null;

  const currentAction = selectedObject?.action || 'idle';
  const currentExpression = selectedObject?.expression || 'neutral';
  const currentView = (selectedObject?.view as AnimationView) || 'front';

  return (
    <div className="fixed inset-0 z-[65] flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative editor-panel border-t border-[var(--editor-border)] rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* grab handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[#33333F]" />
        </div>

        {/* Header: selected character */}
        <div className="px-4 py-3 flex items-center gap-3 border-b border-[var(--editor-border)]">
          <SelectedThumb obj={selectedObject} view={currentView} />
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm truncate">
              {selectedObject?.name || 'Character'}
            </p>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--editor-accent)]/15 text-[var(--editor-accent)] text-[10px] font-semibold">
              <Check size={10} /> Selected
            </span>
          </div>

          {/* playback speed */}
          <div className="flex items-center gap-1 editor-panel-2 rounded-xl px-1.5 py-1">
            <Gauge size={13} className="text-[var(--editor-text-2)]" />
            <select
              value={speed}
              onChange={(e) => changeSpeed(parseFloat(e.target.value))}
              className="bg-transparent text-white text-[11px] focus:outline-none"
              title="Animation speed"
            >
              {SPEEDS.map((s) => (
                <option key={s} value={s} className="bg-[#16161C]">
                  {s}x
                </option>
              ))}
            </select>
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

        {/* Category chips */}
        <div className="px-4 pt-2.5 editor-scroll overflow-x-auto flex gap-1.5">
          {ACTION_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`px-3 py-1.5 rounded-full text-[11px] whitespace-nowrap transition-colors ${
                category === cat.id
                  ? 'editor-gradient text-white font-medium'
                  : 'editor-panel-2 text-[var(--editor-text-2)] hover:text-white'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Angle (view) tabs */}
        <div className="px-4 pt-2.5">
          <div className="grid grid-cols-5 gap-1">
            {(Object.keys(VIEW_LABELS) as AnimationView[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`py-2 rounded-lg text-[11px] font-semibold transition-colors ${
                  view === v
                    ? 'editor-gradient text-white'
                    : 'editor-panel-2 text-[var(--editor-text-2)] hover:text-white'
                }`}
              >
                {VIEW_LABELS[v]}
              </button>
            ))}
          </div>
        </div>

        {/* Action grid */}
        <div className="flex-1 overflow-y-auto editor-scroll px-4 py-4">
          <p className="text-[10px] uppercase tracking-wider text-[var(--editor-text-2)] mb-2 flex items-center gap-1">
            <Sparkles size={11} className="text-[var(--editor-accent-2)]" /> Animations · {VIEW_LABELS[view]}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {clipsForCategory.map((clip) => {
              const resolved = resolveClip(clip.id, view, selectedObject?.characterType);
              const isActive =
                clip.action === currentAction &&
                (!clip.expression || clip.expression === currentExpression);
              const fallbackUsed = resolved && resolved.id !== clip.id;
              return (
                <ActionTileCard
                  key={clip.id}
                  clip={clip}
                  active={isActive}
                  view={view}
                  speed={speed}
                  fallbackLabel={fallbackUsed ? resolved?.label : undefined}
                  characterType={selectedObject?.characterType || 'boy'}
                  imageUrl={selectedObject?.imageUrl}
                  onTap={() => applyAction(clip)}
                />
              );
            })}
          </div>

          {clipsForCategory.length === 0 && (
            <p className="text-center text-xs text-[var(--editor-text-2)] py-8">No animation found</p>
          )}

          <p className="text-center text-[10px] text-[var(--editor-text-2)] mt-4">
            প্রতিটা tile-এ আসল motion loop হয় — ট্যাপ করলেই character-এ প্রয়োগ
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Selected character thumbnail (live, at current view)
// ---------------------------------------------------------------------------

function SelectedThumb({ obj, view }: { obj: CanvasObject | null; view: AnimationView }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(new PoseAnimator());
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let clock = 0;
    let last = performance.now();
    const draw = (now: number) => {
      clock += now - last;
      last = now;
      const action = (obj?.action as never) || 'idle';
      const pose = animRef.current.step(action, clock, now);
      const o: CanvasObject = {
        ...(obj || { id: 'x', type: 'character', x: 0, y: 0, width: 44, height: 56, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, zIndex: 1 }),
        x: 2, y: 2, width: 52, height: 60,
        action, expression: obj?.expression || 'neutral', view,
      };
      ctx.clearRect(0, 0, c.width, c.height);
      drawSceneContent(ctx, [o], PREVIEW_SCENE, 0, clock, c.width, c.height, { playback: true });
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obj?.id, obj?.action, obj?.expression, view]);
  return <canvas ref={ref} width={56} height={64} className="w-14 h-16 rounded-xl bg-[var(--editor-panel-2)] shrink-0" />;
}

// ---------------------------------------------------------------------------
// Action tile with LIVE looping preview at the selected view angle
// ---------------------------------------------------------------------------

function ActionTileCard({
  clip,
  active,
  view,
  speed,
  fallbackLabel,
  characterType,
  imageUrl,
  onTap,
}: {
  clip: ActionClip;
  active: boolean;
  view: AnimationView;
  speed: number;
  fallbackLabel?: string;
  characterType: CanvasObject['characterType'];
  imageUrl?: string;
  onTap: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<PoseAnimator | null>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    if (!animRef.current) animRef.current = new PoseAnimator();

    let raf = 0;
    let clock = 0;
    let last = performance.now();

    const draw = (now: number) => {
      const delta = now - last;
      last = now;
      clock += delta;

      const pose = animRef.current!.step(clip.action, clock, now, speed);

      const o: CanvasObject = {
        id: 'prev',
        type: 'character',
        x: 4,
        y: 4,
        width: c.width - 8,
        height: c.height - 8,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        opacity: 1,
        zIndex: 1,
        characterType,
        action: clip.action,
        expression: clip.expression || 'neutral',
        view,
      };
      ctx.clearRect(0, 0, c.width, c.height);
      drawSceneContent(ctx, [o], PREVIEW_SCENE, 0, clock, c.width, c.height, { playback: true });

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [clip, view, speed, characterType]);

  // Angle visual transform: 3/4 views get a slight horizontal squeeze.
  const tilt =
    view === '3-4-front' ? 'scaleX(0.94)' : view === '3-4-back' ? 'scaleX(-0.94)' : view === 'back' ? 'scaleX(-1)' : 'none';

  return (
    <button
      onClick={onTap}
      className={`relative rounded-2xl overflow-hidden editor-panel-2 border transition-all active:scale-95 ${
        active
          ? 'border-[var(--editor-accent)] ring-2 ring-[var(--editor-accent)]/40'
          : 'border-[var(--editor-border)] hover:border-[var(--editor-accent)]/60'
      }`}
    >
      {/* live preview — canvas loop for procedural, CSS motion for flat PNGs */}
      <div className="w-full aspect-[4/5] flex items-center justify-center bg-gradient-to-b from-[#1E1E28] to-[#16161C] overflow-hidden">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={clip.label}
            className={`w-[62%] h-[86%] object-contain ${charMotionClass(clip.action)}`}
            style={{
              animationDuration:
                clip.action === 'run'
                  ? `${0.45 / speed}s`
                  : clip.action === 'walk' || clip.action === 'jog'
                  ? `${0.9 / speed}s`
                  : `${2.2 / speed}s`,
            }}
            draggable={false}
          />
        ) : (
          <canvas
            ref={ref}
            width={72}
            height={90}
            className="w-[62%] h-[86%]"
            style={{ transform: tilt }}
          />
        )}
      </div>

      {/* active check badge */}
      {active && (
        <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full editor-gradient flex items-center justify-center text-white">
          <Check size={12} />
        </span>
      )}

      {/* fallback badge — animation resolved from a compatible clip */}
      {fallbackLabel && (
        <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-[#8B5CF6]/30 text-[#A78BFA] text-[8px] font-semibold">
          ≈ {fallbackLabel}
        </span>
      )}

      <p className="px-1.5 py-1.5 text-[10px] text-white truncate text-center font-medium">
        {clip.label}
      </p>
    </button>
  );
}
