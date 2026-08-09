'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { useEffect } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/brand/Logo';

export default function HomePage() {
  const router = useRouter();
  const { user, initialize, initialized } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  const handleGetStarted = () => {
    if (user) {
      router.push('/studio');
    } else {
      router.push('/auth/login?redirect=/studio');
    }
  };

  const handleCreateAnimation = () => {
    if (user) {
      router.push('/studio?action=new');
    } else {
      router.push('/auth/login?redirect=/studio&action=new');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-lg border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3">
              <Logo size={40} />
              <span className="text-xl font-bold text-white hidden sm:block">AnimateX</span>
            </Link>

            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-slate-300 hover:text-white transition-colors">Features</a>
              <a href="#templates" className="text-slate-300 hover:text-white transition-colors">Templates</a>
              <a href="#demo" className="text-slate-300 hover:text-white transition-colors">Demo</a>
            </div>

            <div className="flex items-center gap-3">
              {initialized && user ? (
                <>
                  <Link
                    href="/studio"
                    className="px-4 py-2 text-white font-medium hover:text-blue-400 transition-colors"
                  >
                    My Studio
                  </Link>
                  <Link
                    href="/studio"
                    className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Open Studio
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/auth/login"
                    className="px-4 py-2 text-white font-medium hover:text-blue-400 transition-colors"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/auth/signup"
                    className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-sm mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            Mobile-First Animation Studio
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
            Create Stunning<br />
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              2D Animations
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10">
            The most powerful mobile-first animation studio. Create professional cartoon animations 
            with voice recording, lip sync, and AI-powered features — right from your phone.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={handleCreateAnimation}
              className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2"
            >
              <span>✨</span> Start Creating Free
            </button>
            <a
              href="#demo"
              className="w-full sm:w-auto px-8 py-4 bg-slate-800 text-white font-semibold rounded-xl hover:bg-slate-700 transition-colors border border-slate-700 flex items-center justify-center gap-2"
            >
              <span>▶️</span> Watch Demo
            </a>
          </div>

          {/* Hero Visual */}
          <div className="mt-16 relative">
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent z-10"></div>
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-slate-700 p-4 sm:p-8 shadow-2xl">
              <div className="aspect-video bg-slate-900 rounded-xl flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10"></div>
                <div className="relative z-10 text-center">
                  <div className="text-6xl sm:text-8xl mb-4">🎬</div>
                  <p className="text-slate-400">Animation Studio Preview</p>
                </div>
                {/* Floating elements */}
                <div className="absolute top-4 left-4 px-3 py-1 bg-green-500/20 border border-green-500/30 rounded-full text-green-400 text-xs">
                  🎙️ Voice Recording
                </div>
                <div className="absolute top-4 right-4 px-3 py-1 bg-purple-500/20 border border-purple-500/30 rounded-full text-purple-400 text-xs">
                  ✨ AI Powered
                </div>
                <div className="absolute bottom-4 left-4 px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-full text-blue-400 text-xs">
                  👄 Lip Sync
                </div>
                <div className="absolute bottom-4 right-4 px-3 py-1 bg-pink-500/20 border border-pink-500/30 rounded-full text-pink-400 text-xs">
                  📱 Mobile First
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Everything You Need to Create
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Professional animation tools designed for mobile, with powerful features for creators of all levels.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: '🎨', title: 'Canvas Editor', desc: 'Intuitive touch-based canvas with move, scale, rotate, and layer controls.' },
              { icon: '⏱️', title: 'Timeline Editor', desc: 'CapCut-style timeline with multi-track support for characters, audio, and effects.' },
              { icon: '🎭', title: 'Character Library', desc: 'Built-in characters with expressions and animations, or upload your own.' },
              { icon: '🎙️', title: 'Voice Recording', desc: 'Record voice directly in the app with pause, resume, and preview.' },
              { icon: '👄', title: 'Auto Lip Sync', desc: 'Automatic lip sync that matches character mouth movements to your audio.' },
              { icon: '✨', title: 'AI Animation', desc: 'Generate scenes from text descriptions with AI-powered story creation.' },
              { icon: '🎬', title: 'Scene Management', desc: 'Create multiple scenes with transitions like fade, slide, and zoom.' },
              { icon: '🔑', title: 'Keyframe Animation', desc: 'Animate position, scale, rotation, and opacity with smooth interpolation.' },
              { icon: '📤', title: 'Video Export', desc: 'Export your animations in multiple resolutions and share anywhere.' },
            ].map((feature, i) => (
              <div
                key={i}
                className="p-6 bg-slate-800/50 border border-slate-700/50 rounded-xl hover:border-slate-600 transition-colors"
              >
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-slate-400">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Templates Section */}
      <section id="templates" className="py-20 px-4 bg-slate-800/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Start with Templates
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Jump-start your animation with professionally designed templates for every occasion.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: '🏘️', name: 'Village Story', color: 'from-green-500 to-emerald-600' },
              { icon: '🧒', name: 'Kids Cartoon', color: 'from-pink-500 to-rose-600' },
              { icon: '😂', name: 'Comedy Shorts', color: 'from-yellow-500 to-orange-600' },
              { icon: '📚', name: 'Educational', color: 'from-blue-500 to-indigo-600' },
              { icon: '🐕', name: 'Animal Tales', color: 'from-amber-500 to-orange-600' },
              { icon: '😢', name: 'Emotional', color: 'from-purple-500 to-violet-600' },
              { icon: '⚡', name: 'Quick Shorts', color: 'from-cyan-500 to-blue-600' },
              { icon: '🎙️', name: 'Narrator', color: 'from-rose-500 to-pink-600' },
            ].map((template, i) => (
              <button
                key={i}
                onClick={handleGetStarted}
                className={`aspect-square bg-gradient-to-br ${template.color} rounded-xl p-4 flex flex-col items-center justify-center hover:scale-105 transition-transform`}
              >
                <span className="text-4xl mb-2">{template.icon}</span>
                <span className="text-white font-medium text-sm">{template.name}</span>
              </button>
            ))}
          </div>

          <div className="text-center mt-10">
            <button
              onClick={handleGetStarted}
              className="px-6 py-3 bg-slate-700 text-white font-medium rounded-lg hover:bg-slate-600 transition-colors"
            >
              View All Templates →
            </button>
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section id="demo" className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              See It In Action
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Watch how easy it is to create professional animations with AnimateX.
            </p>
          </div>

          <div className="aspect-video bg-slate-800 rounded-2xl border border-slate-700 flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 cursor-pointer hover:bg-white/20 transition-colors">
                <span className="text-4xl ml-1">▶️</span>
              </div>
              <p className="text-slate-400">Demo Video Coming Soon</p>
            </div>
          </div>
        </div>
      </section>

      {/* Language Support */}
      <section className="py-20 px-4 bg-slate-800/30">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            🌍 Multi-Language Support
          </h2>
          <p className="text-slate-400 mb-8">
            Create animations in any language. Full support for Bangla, English, and mixed text.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <div className="px-6 py-3 bg-slate-800 rounded-lg border border-slate-700">
              <span className="text-lg">🇧🇩 বাংলা</span>
            </div>
            <div className="px-6 py-3 bg-slate-800 rounded-lg border border-slate-700">
              <span className="text-lg">🇺🇸 English</span>
            </div>
            <div className="px-6 py-3 bg-slate-800 rounded-lg border border-slate-700">
              <span className="text-lg">🔤 Mixed Text</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Ready to Create Your First Animation?
          </h2>
          <p className="text-slate-400 mb-8">
            Join thousands of creators making amazing animations with AnimateX. It&apos;s free to start.
          </p>
          <button
            onClick={handleCreateAnimation}
            className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg shadow-blue-500/25 text-lg"
          >
            Start Creating — It&apos;s Free ✨
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-slate-800">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <Logo size={32} />
              <span className="text-lg font-bold text-white">AnimateX</span>
            </div>
            <div className="flex items-center gap-6 text-slate-400">
              <a href="#features" className="hover:text-white transition-colors">Features</a>
              <a href="#templates" className="hover:text-white transition-colors">Templates</a>
              <a href="#demo" className="hover:text-white transition-colors">Demo</a>
            </div>
            <p className="text-slate-500 text-sm">
              © 2024 AnimateX. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
