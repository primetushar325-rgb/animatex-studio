'use client';

import { useState } from 'react';
import { useProjectStore } from '@/store/project-store';
import { useAuthStore } from '@/store/auth-store';
import type { CanvasRatio } from '@/types/animation';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated: (projectId: string) => void;
}

const ratioOptions: { value: CanvasRatio; label: string; icon: string; desc: string }[] = [
  { value: '9:16', label: 'Portrait', icon: '📱', desc: 'TikTok, Reels, Shorts' },
  { value: '16:9', label: 'Landscape', icon: '🖥️', desc: 'YouTube, TV' },
  { value: '1:1', label: 'Square', icon: '⬜', desc: 'Instagram, Facebook' },
];

export function CreateProjectModal({ isOpen, onClose, onProjectCreated }: CreateProjectModalProps) {
  const [name, setName] = useState('');
  const [ratio, setRatio] = useState<CanvasRatio>('9:16');
  const { createProject, loading } = useProjectStore();
  const { user } = useAuthStore();

  const handleCreate = async () => {
    if (!name.trim() || !user) return;

    try {
      const project = await createProject(user.uid, name.trim(), ratio);
      onProjectCreated(project.id);
      setName('');
      setRatio('9:16');
      onClose();
    } catch {
      // Error handled by store
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold text-white mb-6">Create New Project</h2>

        <div className="space-y-6">
          {/* Project Name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Project Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Animation"
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
          </div>

          {/* Canvas Ratio */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Canvas Ratio
            </label>
            <div className="grid grid-cols-3 gap-3">
              {ratioOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setRatio(option.value)}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    ratio === option.value
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-slate-700 hover:border-slate-600 bg-slate-900/50'
                  }`}
                >
                  <div className="text-2xl mb-1">{option.icon}</div>
                  <div className="font-semibold text-white">{option.value}</div>
                  <div className="text-xs text-slate-400">{option.label}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-8">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-slate-700 text-white font-semibold rounded-lg hover:bg-slate-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || loading}
            className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  );
}
