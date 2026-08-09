'use client';

interface LogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
}

export function Logo({ size = 40, className = '' }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Background circle with gradient */}
      <defs>
        <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="50%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#EC4899" />
        </linearGradient>
        <linearGradient id="playGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#E0E7FF" />
        </linearGradient>
      </defs>
      
      {/* Main circle */}
      <circle cx="50" cy="50" r="46" fill="url(#logoGradient)" />
      
      {/* Inner shadow ring */}
      <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
      
      {/* Film strip decoration - left */}
      <rect x="12" y="30" width="8" height="8" rx="1" fill="rgba(255,255,255,0.3)" />
      <rect x="12" y="42" width="8" height="8" rx="1" fill="rgba(255,255,255,0.3)" />
      <rect x="12" y="54" width="8" height="8" rx="1" fill="rgba(255,255,255,0.3)" />
      
      {/* Film strip decoration - right */}
      <rect x="80" y="30" width="8" height="8" rx="1" fill="rgba(255,255,255,0.3)" />
      <rect x="80" y="42" width="8" height="8" rx="1" fill="rgba(255,255,255,0.3)" />
      <rect x="80" y="54" width="8" height="8" rx="1" fill="rgba(255,255,255,0.3)" />
      
      {/* Play button triangle */}
      <path
        d="M42 32 L42 68 L72 50 Z"
        fill="url(#playGradient)"
        filter="drop-shadow(2px 2px 4px rgba(0,0,0,0.2))"
      />
      
      {/* Sparkle effects */}
      <circle cx="30" cy="22" r="3" fill="white" opacity="0.8" />
      <circle cx="75" cy="75" r="2" fill="white" opacity="0.6" />
      <circle cx="78" cy="25" r="2.5" fill="white" opacity="0.7" />
    </svg>
  );
}

// Icon only version for favicon/app icon
export function LogoIcon({ size = 40 }: { size?: number }) {
  return <Logo size={size} />;
}

// Full logo with text
export function LogoWithText({ size = 40, className = '' }: LogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Logo size={size} />
      <span 
        className="font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent"
        style={{ fontSize: size * 0.5 }}
      >
        AnimateX
      </span>
    </div>
  );
}
