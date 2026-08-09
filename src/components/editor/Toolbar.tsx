'use client';

import { useState, useRef } from 'react';
import {
  ArrowLeft,
  Undo2,
  Redo2,
  Settings,
  Bell,
  History,
  Image as ImageIcon,
  Save,
  Download,
  Search,
  Copy,
  Trash2,
  ArrowUp,
  ArrowDown,
  FlipHorizontal2,
  Languages,
  Upload,
  MousePointer2,
  Scaling,
  RotateCw,
  Type,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  Diamond,
} from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
import { useProjectStore } from '@/store/project-store';
import { MOTION_PRESETS } from '@/lib/editor/renderer';
import { objectToKeyframeProperties, findClipForObject } from '@/lib/editor/keyframes';
import { setLang, type Lang } from '@/lib/editor/i18n';
import type { MotionPreset } from '@/types/animation';

interface ToolbarProps {
  onBack: () => void;
  onAddText?: () => void;
  onSave?: () => void;
  onEditText?: () => void;
  onExport?: () => void;
  onSearch?: () => void;
  lang?: Lang;
}

export function Toolbar({ onBack, onAddText, onSave, onEditText, onExport, onSearch, lang = 'en' }: ToolbarProps) {
  const [openMenu, setOpenMenu] = useState<'settings' | 'notifications' | 'history' | null>(null);
  const projectFileRef = useRef<HTMLInputElement>(null);

  const {
    activeTool,
    setTool,
    selectedObjectId,
    selectedObjectIds,
    deleteCanvasObject,
    deleteCanvasObjects,
    duplicateCanvasObject,
    undo,
    redo,
    history,
    canvasObjects,
    clips,
    updateCanvasObject,
    bringForward,
    sendBackward,
    currentTime,
    addKeyframe,
    watermarkEnabled,
    setWatermark,
    toggleTimeline,
    showTimeline,
    loadEditorState,
  } = useEditorStore();

  const { saveStatus, currentProject } = useProjectStore();

  const selectedObject = canvasObjects.find((o) => o.id === selectedObjectId);
  const isTextObject = selectedObject?.type === 'text';
  const multiCount = selectedObjectIds.length;

  const handleTool = (id: 'select' | 'scale' | 'rotate' | 'text') => {
    if (id === 'text') onAddText?.();
    else setTool(id);
  };

  const setProp = (patch: Record<string, number | string>) => {
    if (!selectedObject) return;
    updateCanvasObject(selectedObject.id, patch);
  };

  const applyMotion = (motion: string) => {
    if (!selectedObject) return;
    updateCanvasObject(selectedObject.id, {
      motion: motion as MotionPreset,
      motionStart: currentTime,
    });
  };

  const handleAddKeyframe = () => {
    if (!selectedObject || !selectedObject.assetId) return;
    const clip = findClipForObject(clips, selectedObject, selectedObject.sceneId);
    if (!clip) return;
    const clipTime = currentTime - clip.startTime;
    if (clipTime < 0) return;
    addKeyframe(clip.id, clipTime, objectToKeyframeProperties(selectedObject));
  };

  const alignCenterH = () => {
    if (!selectedObject || !currentProject) return;
    const w = selectedObject.width * selectedObject.scaleX;
    updateCanvasObject(selectedObject.id, { x: (currentProject.width - w) / 2 });
  };

  const alignCenterV = () => {
    if (!selectedObject || !currentProject) return;
    const h = selectedObject.height * selectedObject.scaleY;
    updateCanvasObject(selectedObject.id, { y: (currentProject.height - h) / 2 });
  };

  const displayWidth = selectedObject ? Math.round(selectedObject.width * selectedObject.scaleX) : 0;
  const displayHeight = selectedObject ? Math.round(selectedObject.height * selectedObject.scaleY) : 0;

  const iconBtn = (extra = '') =>
    `w-9 h-9 flex items-center justify-center rounded-lg editor-panel-2 text-[var(--editor-text-2)] hover:text-white transition-colors ${extra}`;

  const toolBtn = (active: boolean) =>
    `w-10 h-10 flex items-center justify-center rounded-xl transition-all ${
      active
        ? 'editor-gradient text-white shadow-lg shadow-black/40'
        : 'editor-panel-2 hover:editor-panel-3 text-[var(--editor-text-2)]'
    }`;

  const darkInput =
    'w-16 px-1.5 py-1 editor-input text-xs focus:ring-1 focus:ring-[var(--editor-accent)] focus:outline-none';

  return (
    <div className="editor-surface border-b border-[var(--editor-border)]">
      {/* Main toolbar row */}
      <div className="px-3 py-2 flex items-center gap-1.5 sm:gap-2 overflow-x-auto">
        {/* Back */}
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-[var(--editor-text-2)] hover:text-white whitespace-nowrap px-1 py-1.5 rounded-lg hover:bg-[var(--editor-panel-2)] transition-colors"
        >
          <ArrowLeft size={20} />
          <span className="hidden sm:inline">Back</span>
        </button>

        <div className="h-6 w-px bg-[var(--editor-border)]" />

        {/* Tools */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleTool('select')}
            className={toolBtn(activeTool === 'select')}
            title="Select / Move"
          >
            <MousePointer2 size={18} />
          </button>
          <button
            onClick={() => handleTool('scale')}
            className={toolBtn(activeTool === 'scale')}
            title="Scale"
          >
            <Scaling size={18} />
          </button>
          <button
            onClick={() => handleTool('rotate')}
            className={toolBtn(activeTool === 'rotate')}
            title="Rotate"
          >
            <RotateCw size={18} />
          </button>
          <button
            onClick={() => handleTool('text')}
            className="w-10 h-10 flex items-center justify-center rounded-xl editor-panel-2 hover:editor-panel-3 text-[var(--editor-text-2)] transition-all"
            title="Add Text"
          >
            <Type size={18} />
          </button>
        </div>

        <div className="h-6 w-px bg-[var(--editor-border)]" />

        {/* Undo/Redo */}
        <div className="flex items-center gap-1">
          <button
            onClick={undo}
            disabled={history.past.length === 0}
            className="w-10 h-10 flex items-center justify-center rounded-xl editor-panel-2 hover:editor-panel-3 text-[var(--editor-text-2)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={18} />
          </button>
          <button
            onClick={redo}
            disabled={history.future.length === 0}
            className="w-10 h-10 flex items-center justify-center rounded-xl editor-panel-2 hover:editor-panel-3 text-[var(--editor-text-2)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 size={18} />
          </button>
        </div>

        {/* Selected actions */}
        {selectedObjectId && (
          <>
            <div className="h-6 w-px bg-[var(--editor-border)]" />
            <button onClick={() => duplicateCanvasObject(selectedObjectId)} className={iconBtn()} title="Duplicate (Ctrl+D)">
              <Copy size={18} />
            </button>
            <button
              onClick={() =>
                multiCount > 1 ? deleteCanvasObjects(selectedObjectIds) : deleteCanvasObject(selectedObjectId)
              }
              className={`${iconBtn()} hover:bg-red-500/30 text-red-400`}
              title={`Delete ${multiCount > 1 ? `${multiCount} objects` : '(Del)'}`}
            >
              <Trash2 size={18} />
            </button>
            <button onClick={() => selectedObject && bringForward(selectedObject.id)} className={iconBtn()} title="Bring Forward">
              <ArrowUp size={18} />
            </button>
            <button onClick={() => selectedObject && sendBackward(selectedObject.id)} className={iconBtn()} title="Send Backward">
              <ArrowDown size={18} />
            </button>
            {selectedObject && (
              <button
                onClick={() => updateCanvasObject(selectedObject.id, { flipX: !selectedObject.flipX })}
                className={iconBtn(selectedObject.flipX ? 'editor-gradient text-white' : '')}
                title="Flip horizontal"
              >
                <FlipHorizontal2 size={18} />
              </button>
            )}
            {selectedObject?.assetId && (
              <button
                onClick={handleAddKeyframe}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-yellow-500/15 hover:bg-yellow-500/25 text-yellow-300 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap"
                title="Add keyframe at playhead"
              >
                <Diamond size={12} className="mr-1" /> Keyframe
              </button>
            )}
          </>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {multiCount > 1 && (
          <span className="text-xs text-[var(--editor-accent)] bg-[var(--editor-accent)]/15 px-2 py-1 rounded-full whitespace-nowrap">
            {multiCount} selected
          </span>
        )}

        {/* Save (disk) */}
        <button
          onClick={onSave}
          className="w-9 h-9 flex items-center justify-center rounded-lg editor-panel-2 text-[var(--editor-text-2)] hover:text-white transition-colors"
          title="Save project"
        >
          <Save size={18} />
        </button>

        {/* Save status */}
        {saveStatus === 'saving' && (
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-[var(--editor-accent)] border-t-transparent" />
        )}
        {saveStatus === 'saved' && <span className="text-green-400 text-sm">✓</span>}

        {/* Search */}
        <button onClick={onSearch} className={iconBtn()} title="Search everything (Ctrl+K)">
          <Search size={18} />
        </button>

        {/* Settings */}
        <div className="relative">
          <button
            onClick={() => setOpenMenu(openMenu === 'settings' ? null : 'settings')}
            className={iconBtn()}
            title="Settings"
          >
            <Settings size={18} />
          </button>
          {openMenu === 'settings' && (
            <div className="absolute right-0 top-10 z-30 editor-panel-2 border border-[var(--editor-border)] rounded-xl shadow-2xl p-2 w-60">
              <button
                onClick={() => setWatermark(!watermarkEnabled, useEditorStore.getState().watermarkText)}
                className="w-full flex items-center justify-between px-2.5 py-2 text-xs text-white hover:bg-[var(--editor-panel-3)] rounded-lg"
              >
                Watermark
                <span className={`block rounded-full transition-colors ${watermarkEnabled ? 'editor-gradient' : 'bg-[#33333F]'}`} style={{ width: 32, height: 18 }}>
                  <span className="block w-3.5 h-3.5 rounded-full bg-white" style={{ transform: watermarkEnabled ? 'translateX(14px)' : 'translateX(2px)', margin: 1.5 }} />
                </span>
              </button>
              <button
                onClick={toggleTimeline}
                className="w-full flex items-center justify-between px-2.5 py-2 text-xs text-white hover:bg-[var(--editor-panel-3)] rounded-lg"
              >
                Timeline
                <span className={`text-[10px] ${showTimeline ? 'text-green-400' : 'text-[var(--editor-text-2)]'}`}>
                  {showTimeline ? 'ON' : 'OFF'}
                </span>
              </button>
              <button
                onClick={() => setLang(lang === 'bn' ? 'en' : 'bn')}
                className="w-full flex items-center gap-2 px-2.5 py-2 text-xs text-white hover:bg-[var(--editor-panel-3)] rounded-lg"
              >
                <Languages size={14} /> Language: {lang === 'bn' ? 'বাংলা' : 'English'}
              </button>
              <button
                onClick={() => projectFileRef.current?.click()}
                className="w-full flex items-center gap-2 px-2.5 py-2 text-xs text-white hover:bg-[var(--editor-panel-3)] rounded-lg"
              >
                <Upload size={14} /> Import project (.animatex)
              </button>
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setOpenMenu(openMenu === 'notifications' ? null : 'notifications')}
            className={iconBtn()}
            title="Notifications"
          >
            <Bell size={18} />
          </button>
          {openMenu === 'notifications' && (
            <div className="absolute right-0 top-10 z-30 editor-panel-2 border border-[var(--editor-border)] rounded-xl shadow-2xl p-3 w-56">
              <p className="text-xs text-[var(--editor-text-2)]">No new notifications</p>
            </div>
          )}
        </div>

        {/* History */}
        <div className="relative">
          <button
            onClick={() => setOpenMenu(openMenu === 'history' ? null : 'history')}
            className={iconBtn()}
            title="History"
          >
            <History size={18} />
          </button>
          {openMenu === 'history' && (
            <div className="absolute right-0 top-10 z-30 editor-panel-2 border border-[var(--editor-border)] rounded-xl shadow-2xl p-2 w-56">
              <p className="px-2.5 pt-1 pb-2 text-[10px] text-[var(--editor-text-2)]">
                Undo steps: {history.past.length} · Redo: {history.future.length}
              </p>
              <button onClick={undo} disabled={history.past.length === 0} className="w-full text-left px-2.5 py-1.5 text-xs text-white hover:bg-[var(--editor-panel-3)] rounded-lg disabled:opacity-40">
                <Undo2 size={12} className="inline mr-1" /> Undo (Ctrl+Z)
              </button>
              <button onClick={redo} disabled={history.future.length === 0} className="w-full text-left px-2.5 py-1.5 text-xs text-white hover:bg-[var(--editor-panel-3)] rounded-lg disabled:opacity-40">
                <Redo2 size={12} className="inline mr-1" /> Redo
              </button>
            </div>
          )}
        </div>

        {/* Export image icon */}
        <button onClick={onExport} className={iconBtn()} title="Export">
          <ImageIcon size={18} />
        </button>

        {/* Download pill — prominent accent CTA */}
        <button
          onClick={onExport}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full editor-gradient text-white text-sm font-semibold shadow-lg shadow-black/40 transition-transform active:scale-95 whitespace-nowrap"
          title="Download / export video"
        >
          <Download size={16} /> <span className="hidden sm:inline">Download</span>
        </button>
      </div>

      {/* hidden project import input */}
      <input
        ref={projectFileRef}
        type="file"
        accept=".animatex,application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            try {
              const data = JSON.parse(String(reader.result));
              if (data.canvasObjects && data.scenes) {
                loadEditorState(data as Parameters<typeof loadEditorState>[0]);
                void onSave?.();
              }
            } catch {
              // invalid file
            }
          };
          reader.readAsText(file);
          e.target.value = '';
        }}
      />

      {/* Subtext row: version / build / project id */}
      <div className="px-3 py-1 border-t border-[var(--editor-border)] flex items-center gap-2 overflow-x-auto">
        <span className="text-[9px] text-[var(--editor-text-2)] bg-[var(--editor-panel-2)] px-1.5 py-0.5 rounded">
          v4.0
        </span>
        <span className="text-[9px] text-[var(--editor-text-2)] bg-[var(--editor-panel-2)] px-1.5 py-0.5 rounded">
          build {typeof window !== 'undefined' ? navigator.onLine ? 'stable' : 'offline' : 'stable'}
        </span>
        {currentProject && (
          <span className="text-[9px] text-[var(--editor-text-2)] bg-[var(--editor-panel-2)] px-1.5 py-0.5 rounded font-mono">
            id: {currentProject.id.slice(0, 8)}
          </span>
        )}
        <span className="text-[9px] text-[var(--editor-text-2)] bg-[var(--editor-panel-2)] px-1.5 py-0.5 rounded">
          {currentProject?.canvasRatio || '9:16'}
        </span>
      </div>

      {/* Properties strip */}
      {selectedObject && (
        <div className="px-3 py-2 border-t border-[var(--editor-border)] bg-[var(--editor-panel)]/60 flex items-center gap-3 overflow-x-auto text-sm">
          <span className="text-[10px] font-semibold text-[var(--editor-text-2)] uppercase tracking-wider whitespace-nowrap">
            Properties
          </span>

          <label className="flex items-center gap-1 whitespace-nowrap">
            <span className="text-[var(--editor-text-2)] text-xs">X</span>
            <input
              type="number"
              value={Math.round(selectedObject.x)}
              onChange={(e) => setProp({ x: parseInt(e.target.value, 10) || 0 })}
              className={darkInput}
            />
          </label>

          <label className="flex items-center gap-1 whitespace-nowrap">
            <span className="text-[var(--editor-text-2)] text-xs">Y</span>
            <input
              type="number"
              value={Math.round(selectedObject.y)}
              onChange={(e) => setProp({ y: parseInt(e.target.value, 10) || 0 })}
              className={darkInput}
            />
          </label>

          <label className="flex items-center gap-1 whitespace-nowrap">
            <span className="text-[var(--editor-text-2)] text-xs">W</span>
            <input
              type="number"
              value={displayWidth}
              min={1}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (val > 0) setProp({ scaleX: val / selectedObject.width });
              }}
              className={darkInput}
            />
          </label>

          <label className="flex items-center gap-1 whitespace-nowrap">
            <span className="text-[var(--editor-text-2)] text-xs">H</span>
            <input
              type="number"
              value={displayHeight}
              min={1}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (val > 0) setProp({ scaleY: val / selectedObject.height });
              }}
              className={darkInput}
            />
          </label>

          <label className="flex items-center gap-1 whitespace-nowrap">
            <span className="text-[var(--editor-text-2)] text-xs">Rot</span>
            <input
              type="number"
              value={Math.round(selectedObject.rotation)}
              onChange={(e) => setProp({ rotation: parseInt(e.target.value, 10) || 0 })}
              className={darkInput}
            />
          </label>

          <label className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-[var(--editor-text-2)] text-xs">Opacity</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={selectedObject.opacity}
              onChange={(e) => setProp({ opacity: parseFloat(e.target.value) })}
              className="w-20 accent-[var(--editor-accent)]"
            />
            <span className="text-xs text-[var(--editor-text-2)] w-8">{Math.round(selectedObject.opacity * 100)}%</span>
          </label>

          <button onClick={alignCenterH} className={`${iconBtn()} border border-[var(--editor-border)]`} title="Center horizontally">
            <AlignHorizontalDistributeCenter size={16} />
          </button>
          <button onClick={alignCenterV} className={`${iconBtn()} border border-[var(--editor-border)]`} title="Center vertically">
            <AlignVerticalDistributeCenter size={16} />
          </button>

          {/* Motion preset */}
          <label className="flex items-center gap-1 whitespace-nowrap">
            <span className="text-[var(--editor-text-2)] text-xs">Motion</span>
            <select
              value={selectedObject.motion || 'none'}
              onChange={(e) => applyMotion(e.target.value)}
              className="px-2 py-1 editor-input text-xs"
            >
              {MOTION_PRESETS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.icon} {m.label}
                </option>
              ))}
            </select>
          </label>

          {/* Background variant (day/night/weather) */}
          {selectedObject.type === 'background' && (
            <label className="flex items-center gap-1 whitespace-nowrap">
              <span className="text-[var(--editor-text-2)] text-xs">Variant</span>
              <select
                value={selectedObject.variant || 'day'}
                onChange={(e) => {
                  const v = e.target.value;
                  updateCanvasObject(selectedObject.id, {
                    variant: v === 'day' ? undefined : (v as 'night' | 'rain' | 'cloudy' | 'sunset'),
                  });
                }}
                className="px-2 py-1 editor-input text-xs"
              >
                <option value="day">☀️ Day</option>
                <option value="night">🌙 Night</option>
                <option value="sunset">🌇 Sunset</option>
                <option value="rain">🌧️ Rain</option>
                <option value="cloudy">☁️ Cloudy</option>
              </select>
            </label>
          )}

          {/* Text style controls */}
          {isTextObject && (
            <>
              <label className="flex items-center gap-1 whitespace-nowrap">
                <span className="text-[var(--editor-text-2)] text-xs">Outline</span>
                <input
                  type="color"
                  value={selectedObject.strokeColor || '#000000'}
                  onChange={(e) => setProp({ strokeColor: e.target.value, strokeWidth: selectedObject.strokeWidth || 3 })}
                  className="w-7 h-7 rounded border border-[var(--editor-border)] cursor-pointer bg-[var(--editor-panel-2)]"
                  title="Outline color"
                />
                <input
                  type="range"
                  min="0"
                  max="8"
                  value={selectedObject.strokeWidth || 0}
                  onChange={(e) =>
                    setProp({
                      strokeWidth: parseInt(e.target.value, 10),
                      strokeColor: selectedObject.strokeColor || '#000000',
                    })
                  }
                  className="w-14 accent-[var(--editor-accent)]"
                  title="Outline width"
                />
              </label>

              <label className="flex items-center gap-1 whitespace-nowrap">
                <span className="text-[var(--editor-text-2)] text-xs">Shadow</span>
                <input
                  type="color"
                  value={selectedObject.shadowColor || '#000000'}
                  onChange={(e) => setProp({ shadowColor: e.target.value, shadowBlur: selectedObject.shadowBlur || 8 })}
                  className="w-7 h-7 rounded border border-[var(--editor-border)] cursor-pointer bg-[var(--editor-panel-2)]"
                  title="Shadow color"
                />
                <input
                  type="range"
                  min="0"
                  max="24"
                  value={selectedObject.shadowBlur || 0}
                  onChange={(e) =>
                    setProp({
                      shadowBlur: parseInt(e.target.value, 10),
                      shadowColor: selectedObject.shadowColor || '#000000',
                    })
                  }
                  className="w-14 accent-[var(--editor-accent)]"
                  title="Shadow blur"
                />
              </label>

              <button
                onClick={onEditText}
                className="px-3 py-1.5 editor-gradient text-white text-xs font-medium rounded-lg whitespace-nowrap transition-all"
              >
                ✏️ Edit Text
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
