'use client';

// ============================================================================
// TutorialOverlay — one-time dismissible hint for each panel (character,
// templates, timeline, AI). Shows only once per id (localStorage).
// ============================================================================

import { useState } from 'react';
import { X, Lightbulb } from 'lucide-react';
import { shouldShowTutorial, dismissTutorial } from '@/lib/editor/useEditorUI';

interface TutorialOverlayProps {
  id: string;
  title: string;
  body: string;
  anchor?: 'top' | 'bottom';
}

export function TutorialOverlay({ id, title, body, anchor = 'top' }: TutorialOverlayProps) {
  const [show, setShow] = useState(() => shouldShowTutorial(id));
  if (!show) return null;

  const dismiss = () => {
    dismissTutorial(id);
    setShow(false);
  };

  return (
    <div
      className={`absolute ${anchor === 'top' ? 'top-14' : 'bottom-20'} left-1/2 -translate-x-1/2 z-[60] w-[92%] max-w-sm animate-slideDown`}
    >
      <div className="editor-panel-2 border border-[var(--editor-accent)]/40 rounded-2xl p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className="w-8 h-8 shrink-0 rounded-full editor-gradient flex items-center justify-center text-white">
            <Lightbulb size={16} />
          </span>
          <div className="flex-1">
            <p className="text-white font-semibold text-sm mb-1">{title}</p>
            <p className="text-[var(--editor-text-2)] text-xs leading-relaxed">{body}</p>
          </div>
          <button onClick={dismiss} className="text-[var(--editor-text-2)] hover:text-white shrink-0">
            <X size={16} />
          </button>
        </div>
        <button
          onClick={dismiss}
          className="mt-3 w-full py-2 rounded-xl editor-gradient text-white text-xs font-medium active:scale-[0.98] transition-transform"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
