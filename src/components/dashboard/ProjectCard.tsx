'use client';

import { useState } from 'react';
import type { Project } from '@/types/animation';

interface ProjectCardProps {
  project: Project;
  onOpen: () => void;
  onDuplicate: () => void;
  onRename: (newName: string) => void;
  onDelete: () => void;
  onExport: () => void;
}

export function ProjectCard({
  project,
  onOpen,
  onDuplicate,
  onRename,
  onDelete,
  onExport,
}: ProjectCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(project.name);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return 'Today';
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return `${days} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleRename = () => {
    if (newName.trim() && newName !== project.name) {
      onRename(newName.trim());
    }
    setIsRenaming(false);
    setShowMenu(false);
  };

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden hover:border-slate-600 transition-colors">
      {/* Thumbnail */}
      <div
        className="aspect-video bg-gradient-to-br from-slate-700 to-slate-800 relative cursor-pointer"
        onClick={onOpen}
      >
        {project.thumbnail ? (
          <img
            src={project.thumbnail}
            alt={project.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-4xl">🎬</span>
          </div>
        )}

        {/* Ratio Badge */}
        <div className="absolute top-2 left-2 px-2 py-1 bg-black/50 rounded text-white text-xs">
          {project.canvasRatio}
        </div>

        {/* Duration */}
        <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/50 rounded text-white text-xs">
          {formatDuration(project.duration)}
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-start justify-between">
          {isRenaming ? (
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename();
                if (e.key === 'Escape') {
                  setNewName(project.name);
                  setIsRenaming(false);
                }
              }}
              className="flex-1 px-2 py-1 bg-slate-700 border border-blue-500 rounded text-white focus:outline-none"
              autoFocus
            />
          ) : (
            <h3 className="font-semibold text-white truncate flex-1">
              {project.name}
            </h3>
          )}

          {/* Menu Button */}
          <div className="relative ml-2">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-8 w-48 bg-slate-700 rounded-lg shadow-lg border border-slate-600 z-20 py-1">
                  <button
                    onClick={() => {
                      onOpen();
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-white hover:bg-slate-600 flex items-center gap-2"
                  >
                    <span>✏️</span> Continue Editing
                  </button>
                  <button
                    onClick={() => {
                      setIsRenaming(true);
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-white hover:bg-slate-600 flex items-center gap-2"
                  >
                    <span>📝</span> Rename
                  </button>
                  <button
                    onClick={() => {
                      onDuplicate();
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-white hover:bg-slate-600 flex items-center gap-2"
                  >
                    <span>📋</span> Duplicate
                  </button>
                  <button
                    onClick={() => {
                      onExport();
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-white hover:bg-slate-600 flex items-center gap-2"
                  >
                    <span>📤</span> Export
                  </button>
                  <hr className="my-1 border-slate-600" />
                  <button
                    onClick={() => {
                      onDelete();
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-slate-600 flex items-center gap-2"
                  >
                    <span>🗑️</span> Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
          <span>{formatDate(project.updatedAt)}</span>
          <span>•</span>
          <span>{project.sceneCount} scene{project.sceneCount !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4 pb-4">
        <button
          onClick={onOpen}
          className="w-full py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all"
        >
          Continue Editing
        </button>
      </div>
    </div>
  );
}
