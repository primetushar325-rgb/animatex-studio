'use client';

// ============================================================================
// IconButton — the single premium icon-button used across the editor.
// Variants:
//   default  — icon only, transparent bg, hover tint
//   active   — accent background chip (rounded-xl), for selected tool/tab
//   premium  — gradient blue→violet chip + optional "AI"/"PRO" badge
//   locked   — dimmed + small lock overlay (Pro-only on Free tier)
// Inherits color from theme via currentColor, strokeWidth consistent.
// ============================================================================

import type { LucideIcon } from 'lucide-react';
import { Lock } from 'lucide-react';

export type IconButtonVariant = 'default' | 'active' | 'premium' | 'locked';

interface IconButtonProps {
  icon: LucideIcon;
  label: string;
  variant?: IconButtonVariant;
  onClick?: () => void;
  disabled?: boolean;
  size?: number;
  badge?: 'AI' | 'PRO' | null;
  className?: string;
}

const variantClasses: Record<IconButtonVariant, string> = {
  default:
    'text-[var(--editor-text-2)] hover:text-white hover:bg-[var(--editor-panel-2)]',
  active:
    'editor-gradient text-white shadow-lg shadow-black/40',
  premium:
    'editor-gradient text-white shadow-lg shadow-black/40',
  locked:
    'text-[var(--editor-text-2)] opacity-60 hover:opacity-80 hover:bg-[var(--editor-panel-2)] cursor-not-allowed',
};

export function IconButton({
  icon: Icon,
  label,
  variant = 'default',
  onClick,
  disabled,
  size = 20,
  badge,
  className = '',
}: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`relative w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-150 active:scale-95 ${
        variantClasses[variant]
      } ${disabled && variant !== 'locked' ? 'opacity-40 cursor-not-allowed' : ''} ${className}`}
    >
      <Icon size={size} strokeWidth={2} />

      {variant === 'premium' && badge && (
        <span className="absolute -top-1 -right-1 px-1 rounded-md bg-black/80 text-white text-[8px] font-bold leading-[12px]">
          {badge}
        </span>
      )}

      {variant === 'locked' && (
        <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-black/70 flex items-center justify-center">
          <Lock size={9} strokeWidth={2.5} className="text-[var(--editor-text-2)]" />
        </span>
      )}
    </button>
  );
}

/** Small pill button (for labels like "Edit", chips). */
export function PillButton({
  children,
  onClick,
  variant = 'default',
  className = '',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'accent' | 'gradient';
  className?: string;
}) {
  const styles =
    variant === 'gradient'
      ? 'editor-gradient text-white'
      : variant === 'accent'
      ? 'text-[var(--editor-accent)] bg-[var(--editor-accent)]/15 hover:bg-[var(--editor-accent)]/25'
      : 'editor-panel-2 text-[var(--editor-text-2)] hover:text-white';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}
