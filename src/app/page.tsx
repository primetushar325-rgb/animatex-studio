'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Palette,
  Timer,
  Users,
  Mic,
  AudioWaveform,
  Sparkles,
  Film,
  KeyRound,
  Download,
  Home,
  Baby,
  Laugh,
  BookOpen,
  PawPrint,
  Heart,
  Zap,
  Radio,
  Languages,
  Check,
  Crown,
  Star,
  Play,
  ArrowRight,
  Globe,
  Video,
  Type,
  ArrowUp,
} from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { drawSceneContent } from '@/lib/editor/renderer';
import type { CanvasObject } from '@/types/animation';

// ---------------------------------------------------------------------------
// Scroll fade-in wrapper (IntersectionObserver, subtle)
// ---------------------------------------------------------------------------

function FadeIn({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Animated hero visual — a real looping character walking on a mini canvas
// ---------------------------------------------------------------------------

function HeroVisual() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    const W = 640;
    const H = 360;
    let raf = 0;
    let clock = 0;
    let last = performance.now();

    const draw = (now: number) => {
      clock += now - last;
      last = now;

      const boy: CanvasObject = {
        id: 'hero-boy', type: 'character', x: 180, y: 90, width: 150, height: 220,
        rotation: 0, scaleX: 1.1, scaleY: 1.1, opacity: 1, zIndex: 2,
        characterType: 'boy', expression: 'happy', action: 'walk',
      };
      const dog: CanvasObject = {
        id: 'hero-dog', type: 'character', x: 330, y: 160, width: 130, height: 130,
        rotation: 0, scaleX: 1.1, scaleY: 1.1, opacity: 1, zIndex: 2,
        characterType: 'dog', expression: 'happy', action: 'walk',
      };
      const text: CanvasObject = {
        id: 'hero-text', type: 'text', x: 60, y: 40, width: 520, height: 50,
        rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, zIndex: 3,
        content: 'AnimateX', fontSize: 40, fontColor: '#FFFFFF', fontWeight: 'bold',
      };
      const scene = {
        id: 'hero-scene', projectId: '', name: 'Hero', order: 0, duration: 5000,
        backgroundColor: '#0B0B10',
        cameraSettings: { x: 0, y: 0, zoom: 1, rotation: 0, keyframes: [] },
        transition: { type: 'none' as const, duration: 0 },
      };
      drawSceneContent(ctx, [boy, dog, text], scene, 0, clock, W, H, { playback: true });
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={ref}
      width={640}
      height={360}
      className="w-full h-auto rounded-2xl"
      aria-label="AnimateX animated preview"
    />
  );
}

// ---------------------------------------------------------------------------
// Feature data (icons from lucide — no emoji)
// ---------------------------------------------------------------------------

const FEATURES = [
  { icon: Palette, title: 'Canvas Editor', desc: 'Intuitive touch-based canvas with move, scale, rotate, and layer controls.', color: 'from-blue-500 to-indigo-600' },
  { icon: Timer, title: 'Timeline Editor', desc: 'CapCut-style timeline with multi-track support for characters, audio, and effects.', color: 'from-cyan-500 to-blue-600' },
  { icon: Users, title: 'Character Library', desc: 'Built-in characters with expressions and animations, or upload your own PNGs.', color: 'from-pink-500 to-rose-600' },
  { icon: Mic, title: 'Voice Recording', desc: 'Record voice directly in the app with pause, resume, and preview.', color: 'from-red-500 to-orange-600' },
  { icon: AudioWaveform, title: 'Auto Lip Sync', desc: 'Automatic lip sync that matches character mouth movements to your audio.', color: 'from-purple-500 to-fuchsia-600' },
  { icon: Sparkles, title: 'AI Animation', desc: 'Generate scenes from text descriptions — Bangla & English, fully offline.', color: 'from-violet-500 to-purple-600' },
  { icon: Film, title: 'Scene Management', desc: 'Create multiple scenes with transitions like fade, slide, and zoom.', color: 'from-emerald-500 to-green-600' },
  { icon: KeyRound, title: 'Keyframe Animation', desc: 'Animate position, scale, rotation, and opacity with smooth interpolation.', color: 'from-amber-500 to-yellow-600' },
  { icon: Download, title: 'Video Export', desc: 'Export as WebM, GIF (plays on every phone), or PNG — with watermark control.', color: 'from-blue-500 to-cyan-600' },
];

const TEMPLATES = [
  { icon: Home, name: 'Village Story', color: 'from-green-500 to-emerald-600' },
  { icon: Baby, name: 'Kids Cartoon', color: 'from-pink-500 to-rose-600' },
  { icon: Laugh, name: 'Comedy Shorts', color: 'from-yellow-500 to-orange-600' },
  { icon: BookOpen, name: 'Educational', color: 'from-blue-500 to-indigo-600' },
  { icon: PawPrint, name: 'Animal Tales', color: 'from-amber-500 to-orange-600' },
  { icon: Heart, name: 'Emotional', color: 'from-purple-500 to-violet-600' },
  { icon: Zap, name: 'Quick Shorts', color: 'from-cyan-500 to-blue-600' },
  { icon: Radio, name: 'Narrator', color: 'from-rose-500 to-pink-600' },
];

const LANGUAGES = [
  { icon: Globe, label: 'বাংলা', sub: 'Bangla' },
  { icon: Type, label: 'English', sub: 'English' },
  { icon: Languages, label: 'Mixed Text', sub: 'বাংলা + English' },
];

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    tagline: 'Perfect for trying it out',
    icon: Star,
    features: [
      'Unlimited projects',
      'All built-in characters & backgrounds',
      'GIF & PNG export (720p)',
      '10 AI credits / day',
      'Watermark included',
    ],
    cta: 'Start Free',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$4.99/mo',
    tagline: 'For serious creators',
    icon: Crown,
    features: [
      'Everything in Free',
      '1080p video export',
      'No watermark',
      'Unlimited AI generation',
      'Priority new characters & templates',
    ],
    cta: 'Go Pro',
    highlight: true,
  },
];

export default function HomePage() {
  const router = useRouter();
  const { user, initialize, initialized } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  const handleGetStarted = useCallback(() => {
    router.push(user ? '/studio' : '/auth/login?redirect=/studio');
  }, [router, user]);

  const handleCreateAnimation = useCallback(() => {
    router.push(user ? '/studio?action=new' : '/auth/login?redirect=/studio&action=new');
  }, [router, user]);

  return (
    <div className="min-h-screen editor-surface text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0B0B10]/85 backdrop-blur-lg border-b border-[#2A2A38]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3">
              <Logo size={40} />
              <span className="text-xl font-bold text-white hidden sm:block">AnimateX</span>
            </Link>

            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-[#9CA3AF] hover:text-white transition-colors">Features</a>
              <a href="#templates" className="text-[#9CA3AF] hover:text-white transition-colors">Templates</a>
              <a href="#demo" className="text-[#9CA3AF] hover:text-white transition-colors">Demo</a>
              <a href="#pricing" className="text-[#9CA3AF] hover:text-white transition-colors">Pricing</a>
            </div>

            <div className="flex items-center gap-3">
              {initialized && user ? (
                <>
                  <Link href="/studio" className="px-4 py-2 text-white font-medium hover:text-[#5B8DEF] transition-colors">
                    My Studio
                  </Link>
                  <Link href="/studio" className="px-4 py-2 editor-gradient text-white font-medium rounded-xl transition-all hover:opacity-90">
                    Open Studio
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/auth/login" className="px-4 py-2 text-white font-medium hover:text-[#5B8DEF] transition-colors">
                    Sign In
                  </Link>
                  <Link href="/auth/signup" className="px-4 py-2 editor-gradient text-white font-medium rounded-xl transition-all hover:opacity-90">
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <FadeIn>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#5B8DEF]/10 border border-[#5B8DEF]/20 rounded-full text-[#5B8DEF] text-sm mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#5B8DEF] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#5B8DEF]"></span>
              </span>
              Mobile-First Animation Studio
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
              Create Stunning<br />
              <span className="bg-gradient-to-r from-[#5B8DEF] via-[#8B5CF6] to-[#A78BFA] bg-clip-text text-transparent">
                2D Animations
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-[#9CA3AF] max-w-2xl mx-auto mb-10">
              The most powerful mobile-first animation studio. Create professional cartoon animations
              with voice recording, lip sync, and AI-powered features — right from your phone.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={handleCreateAnimation}
                className="w-full sm:w-auto px-8 py-4 editor-gradient text-white font-semibold rounded-xl transition-all hover:opacity-90 shadow-lg shadow-[#5B8DEF]/25 flex items-center justify-center gap-2"
              >
                <Sparkles size={18} /> Start Creating Free
              </button>
              <a
                href="#demo"
                className="w-full sm:w-auto px-8 py-4 bg-[#16161C] text-white font-semibold rounded-xl hover:bg-[#1E1E28] transition-colors border border-[#2A2A38] flex items-center justify-center gap-2"
              >
                <Play size={18} /> Watch Demo
              </a>
            </div>
          </FadeIn>

          {/* Hero visual: real looping animation */}
          <FadeIn delay={150} className="mt-16">
            <div className="relative mx-auto max-w-3xl">
              <div className="absolute -inset-3 bg-gradient-to-r from-[#5B8DEF]/30 to-[#8B5CF6]/30 blur-2xl rounded-3xl" />
              <div className="relative bg-gradient-to-br from-[#16161C] to-[#0B0B10] rounded-2xl border border-[#2A2A38] p-3 sm:p-4 shadow-2xl overflow-hidden">
                <HeroVisual />
                {/* floating feature badges */}
                <div className="absolute top-4 left-4 px-3 py-1 bg-green-500/20 border border-green-500/30 rounded-full text-green-400 text-xs flex items-center gap-1.5">
                  <Mic size={12} /> Voice Recording
                </div>
                <div className="absolute top-4 right-4 px-3 py-1 bg-purple-500/20 border border-purple-500/30 rounded-full text-purple-400 text-xs flex items-center gap-1.5">
                  <Sparkles size={12} /> AI Powered
                </div>
                <div className="absolute bottom-4 left-4 px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-full text-blue-400 text-xs flex items-center gap-1.5">
                  <AudioWaveform size={12} /> Lip Sync
                </div>
                <div className="absolute bottom-4 right-4 px-3 py-1 bg-pink-500/20 border border-pink-500/30 rounded-full text-pink-400 text-xs flex items-center gap-1.5">
                  <Video size={12} /> Mobile First
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <FadeIn className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Everything You Need to Create
            </h2>
            <p className="text-[#9CA3AF] max-w-2xl mx-auto">
              Professional animation tools designed for mobile, with powerful features for creators of all levels.
            </p>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature, i) => (
              <FadeIn key={feature.title} delay={(i % 3) * 80}>
                <div className="p-6 bg-[#16161C] border border-[#2A2A38] rounded-2xl hover:border-[#5B8DEF]/50 hover:shadow-lg hover:shadow-[#5B8DEF]/10 hover:-translate-y-1 transition-all duration-300">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 shadow-lg`}>
                    <feature.icon size={22} className="text-white" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-[#9CA3AF]">{feature.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Templates */}
      <section id="templates" className="py-20 px-4 bg-[#0F0F15]">
        <div className="max-w-7xl mx-auto">
          <FadeIn className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Start with Templates</h2>
            <p className="text-[#9CA3AF] max-w-2xl mx-auto">
              Jump-start your animation with professionally designed templates for every occasion.
            </p>
          </FadeIn>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {TEMPLATES.map((template, i) => (
              <FadeIn key={template.name} delay={(i % 4) * 60}>
                <button
                  onClick={handleGetStarted}
                  className={`w-full aspect-square bg-gradient-to-br ${template.color} rounded-2xl p-4 flex flex-col items-center justify-center hover:scale-[1.04] hover:shadow-xl transition-all duration-300`}
                >
                  <template.icon size={36} className="mb-2 text-white drop-shadow" />
                  <span className="text-white font-medium text-sm">{template.name}</span>
                </button>
              </FadeIn>
            ))}
          </div>

          <FadeIn className="text-center mt-10">
            <button
              onClick={handleGetStarted}
              className="px-6 py-3 bg-[#1E1E28] text-white font-medium rounded-xl hover:bg-[#262634] transition-colors border border-[#2A2A38] inline-flex items-center gap-2"
            >
              View All Templates <ArrowRight size={16} />
            </button>
          </FadeIn>
        </div>
      </section>

      {/* Demo */}
      <section id="demo" className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <FadeIn className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">See It In Action</h2>
            <p className="text-[#9CA3AF] max-w-2xl mx-auto">
              Watch how easy it is to create professional animations with AnimateX.
            </p>
          </FadeIn>

          <FadeIn>
            <div className="relative aspect-video rounded-2xl border border-[#2A2A38] overflow-hidden group">
              {/* blurred background preview */}
              <div className="absolute inset-0 scale-110 blur-sm bg-gradient-to-br from-[#1E1E28] via-[#16161C] to-[#0B0B10]">
                <div className="absolute inset-0 flex items-center justify-center opacity-40">
                  <HeroVisual />
                </div>
              </div>
              <div className="absolute inset-0 bg-black/50" />

              {/* play button overlay */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                <div className="w-20 h-20 bg-white/10 backdrop-blur rounded-full flex items-center justify-center cursor-pointer hover:bg-white/20 hover:scale-110 transition-all border border-white/20 shadow-xl">
                  <Play size={32} className="ml-1 text-white" />
                </div>
                <p className="text-white font-medium bg-black/40 px-4 py-1.5 rounded-full text-sm">
                  Demo video coming soon — try the live preview above <ArrowUp size={14} className="inline" />
                </p>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Language Support */}
      <section className="py-20 px-4 bg-[#0F0F15]">
        <div className="max-w-4xl mx-auto text-center">
          <FadeIn>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 flex items-center justify-center gap-2">
              <Languages size={32} className="text-[#5B8DEF]" /> Multi-Language Support
            </h2>
            <p className="text-[#9CA3AF] mb-8">
              Create animations in any language. Full support for Bangla, English, and mixed text.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              {LANGUAGES.map((lang) => (
                <div key={lang.label} className="px-6 py-3 bg-[#16161C] rounded-xl border border-[#2A2A38] flex items-center gap-2.5">
                  <lang.icon size={18} className="text-[#5B8DEF]" />
                  <span className="font-medium">{lang.label}</span>
                  <span className="text-[#9CA3AF] text-sm">· {lang.sub}</span>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <FadeIn className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Simple Pricing</h2>
            <p className="text-[#9CA3AF] max-w-2xl mx-auto">
              Start free, upgrade when you need pro tools. No hidden fees.
            </p>
          </FadeIn>

          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {PLANS.map((plan, i) => (
              <FadeIn key={plan.name} delay={i * 100}>
                <div
                  className={`rounded-2xl p-7 border transition-all ${
                    plan.highlight
                      ? 'bg-gradient-to-b from-[#16161C] to-[#0F0F15] border-[#8B5CF6]/50 shadow-xl shadow-[#8B5CF6]/10'
                      : 'bg-[#16161C] border-[#2A2A38]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <plan.icon size={20} className={plan.highlight ? 'text-[#8B5CF6]' : 'text-[#5B8DEF]'} />
                      <h3 className="text-lg font-bold">{plan.name}</h3>
                    </div>
                    {plan.highlight && (
                      <span className="text-[10px] px-2 py-1 rounded-full editor-gradient text-white font-semibold">POPULAR</span>
                    )}
                  </div>
                  <p className="text-3xl font-bold mb-1">{plan.price}</p>
                  <p className="text-[#9CA3AF] text-sm mb-5">{plan.tagline}</p>
                  <ul className="space-y-2.5 mb-7">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-[#D1D5DB]">
                        <Check size={16} className="text-green-400 shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={handleGetStarted}
                    className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
                      plan.highlight
                        ? 'editor-gradient text-white hover:opacity-90 shadow-lg'
                        : 'bg-[#1E1E28] text-white hover:bg-[#262634] border border-[#2A2A38]'
                    }`}
                  >
                    {plan.cta}
                  </button>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-[#0F0F15]">
        <div className="max-w-4xl mx-auto text-center">
          <FadeIn>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to Create Your First Animation?</h2>
            <p className="text-[#9CA3AF] mb-8">
              Join creators making amazing animations with AnimateX. It&apos;s free to start.
            </p>
            <button
              onClick={handleCreateAnimation}
              className="px-8 py-4 editor-gradient text-white font-semibold rounded-xl hover:opacity-90 transition-all shadow-lg shadow-[#5B8DEF]/25 text-lg inline-flex items-center gap-2"
            >
              Start Creating — It&apos;s Free <Sparkles size={18} />
            </button>
          </FadeIn>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-[#2A2A38]">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <Logo size={32} />
              <span className="text-lg font-bold">AnimateX</span>
            </div>
            <div className="flex items-center gap-6 text-[#9CA3AF]">
              <a href="#features" className="hover:text-white transition-colors">Features</a>
              <a href="#templates" className="hover:text-white transition-colors">Templates</a>
              <a href="#demo" className="hover:text-white transition-colors">Demo</a>
              <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            </div>
            <p className="text-[#6B7280] text-sm">
              © {new Date().getFullYear()} AnimateX. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
