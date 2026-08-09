'use client';

import { useState } from 'react';
import { useEditorStore } from '@/store/editor-store';

interface ScenePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ScenePanel({ isOpen, onClose }: ScenePanelProps) {
  const {
    scenes,
    currentSceneId,
    addScene,
    deleteScene,
    duplicateScene,
    renameScene,
    setCurrentScene,
    reorderScenes,
  } = useEditorStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const handleStartRename = (sceneId: string, currentName: string) => {
    setEditingId(sceneId);
    setEditName(currentName);
  };

  const handleSaveRename = () => {
    if (editingId && editName.trim()) {
      renameScene(editingId, editName.trim());
    }
    setEditingId(null);
    setEditName('');
  };

  const handleDelete = (sceneId: string) => {
    deleteScene(sceneId);
    setShowDeleteConfirm(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      {/* Panel */}
      <div
        className="w-72 bg-white h-full shadow-xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Scenes</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        {/* Scene List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {scenes
            .sort((a, b) => a.order - b.order)
            .map((scene, index) => (
              <div
                key={scene.id}
                className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  currentSceneId === scene.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
                onClick={() => setCurrentScene(scene.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium">
                      {index + 1}
                    </span>
                    {editingId === scene.id ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={handleSaveRename}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveRename();
                          if (e.key === 'Escape') {
                            setEditingId(null);
                            setEditName('');
                          }
                        }}
                        className="flex-1 px-2 py-1 border border-blue-500 rounded text-sm focus:outline-none"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="font-medium text-sm truncate">{scene.name}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartRename(scene.id, scene.name);
                      }}
                      className="p-1 hover:bg-gray-200 rounded"
                      title="Rename"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        duplicateScene(scene.id);
                      }}
                      className="p-1 hover:bg-gray-200 rounded"
                      title="Duplicate"
                    >
                      📋
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDeleteConfirm(scene.id);
                      }}
                      className="p-1 hover:bg-red-100 rounded text-red-600"
                      title="Delete"
                      disabled={scenes.length <= 1}
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                  <span>Duration: {(scene.duration / 1000).toFixed(1)}s</span>
                  <span className="w-3 h-3 rounded" style={{ backgroundColor: scene.backgroundColor }}></span>
                </div>
              </div>
            ))}
        </div>

        {/* Add Scene Button */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={() => addScene()}
            className="w-full py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <span>+</span> Add Scene
          </button>
        </div>
      </div>

      {/* Backdrop */}
      <div className="flex-1 bg-black/50" />

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
          <div
            className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-2">Delete Scene?</h3>
            <p className="text-gray-600 mb-6">
              This action cannot be undone. All elements in this scene will be deleted.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="flex-1 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
