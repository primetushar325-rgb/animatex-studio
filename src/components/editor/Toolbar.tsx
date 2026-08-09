'use client';

import { useEditorStore } from '@/store/editor-store';
import { useProjectStore } from '@/store/project-store';

interface ToolbarProps {
  onBack: () => void;
  onAddText?: () => void;
}

export function Toolbar({ onBack, onAddText }: ToolbarProps) {
  const {
    activeTool,
    setTool,
    selectedObjectId,
    deleteCanvasObject,
    undo,
    redo,
    history,
    canvasObjects,
    updateCanvasObject,
    bringForward,
    sendBackward,
  } = useEditorStore();

  const { saveStatus } = useProjectStore();

  const selectedObject = canvasObjects.find((o) => o.id === selectedObjectId);

  const tools = [
    { id: 'select', icon: '👆', label: 'Select / Move' },
    { id: 'scale', icon: '📐', label: 'Scale' },
    { id: 'rotate', icon: '🔄', label: 'Rotate' },
  ] as const;

  const handleTool = (id: (typeof tools)[number]['id'] | 'text') => {
    if (id === 'text') {
      onAddText?.();
    } else {
      setTool(id);
    }
  };

  const setProp = (patch: Record<string, number>) => {
    if (!selectedObject) return;
    updateCanvasObject(selectedObject.id, patch);
  };

  const displayWidth = selectedObject ? Math.round(selectedObject.width * selectedObject.scaleX) : 0;
  const displayHeight = selectedObject ? Math.round(selectedObject.height * selectedObject.scaleY) : 0;

  return (
    <div className="bg-white border-b border-gray-200">
      {/* Main toolbar row */}
      <div className="px-4 py-2 flex items-center gap-3 overflow-x-auto">
        {/* Back Button */}
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-gray-600 hover:text-gray-900 whitespace-nowrap"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="hidden sm:inline">Back</span>
        </button>

        <div className="h-6 w-px bg-gray-200" />

        {/* Tools */}
        <div className="flex items-center gap-1">
          {tools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => handleTool(tool.id)}
              className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${
                activeTool === tool.id
                  ? 'bg-blue-100 text-blue-600 ring-1 ring-blue-300'
                  : 'hover:bg-gray-100 text-gray-600'
              }`}
              title={tool.label}
            >
              {tool.icon}
            </button>
          ))}
          <button
            onClick={() => handleTool('text')}
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600"
            title="Add Text"
          >
            📝
          </button>
        </div>

        <div className="h-6 w-px bg-gray-200" />

        {/* Undo/Redo */}
        <div className="flex items-center gap-1">
          <button
            onClick={undo}
            disabled={history.past.length === 0}
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Undo (Ctrl+Z)"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          </button>
          <button
            onClick={redo}
            disabled={history.future.length === 0}
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Redo (Ctrl+Shift+Z)"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
            </svg>
          </button>
        </div>

        {/* Delete Selected */}
        {selectedObjectId && (
          <>
            <div className="h-6 w-px bg-gray-200" />
            <button
              onClick={() => deleteCanvasObject(selectedObjectId)}
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-red-100 text-red-600"
              title="Delete (Del)"
            >
              🗑️
            </button>
            <button
              onClick={() => selectedObject && bringForward(selectedObject.id)}
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600"
              title="Bring Forward"
            >
              ⬆️
            </button>
            <button
              onClick={() => selectedObject && sendBackward(selectedObject.id)}
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600"
              title="Send Backward"
            >
              ⬇️
            </button>
          </>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Save Status */}
        <div className="text-sm text-gray-500 flex items-center gap-2 whitespace-nowrap">
          {saveStatus === 'saving' && (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
              Saving...
            </>
          )}
          {saveStatus === 'saved' && (
            <>
              <span className="text-green-500">✓</span>
              Saved
            </>
          )}
          {saveStatus === 'error' && (
            <>
              <span className="text-red-500">✗</span>
              Error saving
            </>
          )}
        </div>
      </div>

      {/* Properties strip (visible when an object is selected) */}
      {selectedObject && (
        <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-3 overflow-x-auto text-sm bg-gray-50">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
            Properties
          </span>

          <label className="flex items-center gap-1 whitespace-nowrap">
            <span className="text-gray-500 text-xs">X</span>
            <input
              type="number"
              value={Math.round(selectedObject.x)}
              onChange={(e) => setProp({ x: parseInt(e.target.value, 10) || 0 })}
              className="w-16 px-1.5 py-1 border border-gray-300 rounded text-xs"
            />
          </label>

          <label className="flex items-center gap-1 whitespace-nowrap">
            <span className="text-gray-500 text-xs">Y</span>
            <input
              type="number"
              value={Math.round(selectedObject.y)}
              onChange={(e) => setProp({ y: parseInt(e.target.value, 10) || 0 })}
              className="w-16 px-1.5 py-1 border border-gray-300 rounded text-xs"
            />
          </label>

          <label className="flex items-center gap-1 whitespace-nowrap">
            <span className="text-gray-500 text-xs">W</span>
            <input
              type="number"
              value={displayWidth}
              min={1}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (val > 0) {
                  setProp({ scaleX: val / selectedObject.width });
                }
              }}
              className="w-16 px-1.5 py-1 border border-gray-300 rounded text-xs"
            />
          </label>

          <label className="flex items-center gap-1 whitespace-nowrap">
            <span className="text-gray-500 text-xs">H</span>
            <input
              type="number"
              value={displayHeight}
              min={1}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (val > 0) {
                  setProp({ scaleY: val / selectedObject.height });
                }
              }}
              className="w-16 px-1.5 py-1 border border-gray-300 rounded text-xs"
            />
          </label>

          <label className="flex items-center gap-1 whitespace-nowrap">
            <span className="text-gray-500 text-xs">Rot</span>
            <input
              type="number"
              value={Math.round(selectedObject.rotation)}
              onChange={(e) => setProp({ rotation: parseInt(e.target.value, 10) || 0 })}
              className="w-16 px-1.5 py-1 border border-gray-300 rounded text-xs"
            />
          </label>

          <label className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-gray-500 text-xs">Opacity</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={selectedObject.opacity}
              onChange={(e) => setProp({ opacity: parseFloat(e.target.value) })}
              className="w-20"
            />
            <span className="text-xs text-gray-500 w-8">
              {Math.round(selectedObject.opacity * 100)}%
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
