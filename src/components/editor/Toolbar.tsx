'use client';

import { useEditorStore } from '@/store/editor-store';
import { useProjectStore } from '@/store/project-store';

interface ToolbarProps {
  onBack: () => void;
}

export function Toolbar({ onBack }: ToolbarProps) {
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
  } = useEditorStore();

  const { saveStatus } = useProjectStore();

  const selectedObject = canvasObjects.find((o) => o.id === selectedObjectId);

  const tools = [
    { id: 'select', icon: '👆', label: 'Select' },
    { id: 'move', icon: '✋', label: 'Move' },
    { id: 'scale', icon: '📐', label: 'Scale' },
    { id: 'rotate', icon: '🔄', label: 'Rotate' },
    { id: 'text', icon: '📝', label: 'Text' },
  ] as const;

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-4">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-gray-600 hover:text-gray-900"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        <span className="hidden sm:inline">Back</span>
      </button>

      {/* Divider */}
      <div className="h-6 w-px bg-gray-200" />

      {/* Tools */}
      <div className="flex items-center gap-1">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => setTool(tool.id)}
            className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${
              activeTool === tool.id
                ? 'bg-blue-100 text-blue-600'
                : 'hover:bg-gray-100 text-gray-600'
            }`}
            title={tool.label}
          >
            {tool.icon}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="h-6 w-px bg-gray-200" />

      {/* Undo/Redo */}
      <div className="flex items-center gap-1">
        <button
          onClick={undo}
          disabled={history.past.length === 0}
          className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Undo"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
        </button>
        <button
          onClick={redo}
          disabled={history.future.length === 0}
          className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Redo"
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
            title="Delete"
          >
            🗑️
          </button>
        </>
      )}

      {/* Object Properties */}
      {selectedObject && (
        <>
          <div className="h-6 w-px bg-gray-200" />
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <label>Opacity:</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={selectedObject.opacity}
              onChange={(e) => updateCanvasObject(selectedObject.id, { opacity: parseFloat(e.target.value) })}
              className="w-20"
            />
          </div>
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Save Status */}
      <div className="text-sm text-gray-500 flex items-center gap-2">
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
  );
}
