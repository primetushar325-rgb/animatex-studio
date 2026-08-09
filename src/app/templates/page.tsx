'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { useProjectStore } from '@/store/project-store';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { CanvasRatio } from '@/types/animation';
import { Logo } from '@/components/brand/Logo';

interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  canvasRatio: CanvasRatio;
  duration: number;
  sceneCount: number;
}

const templates: Template[] = [
  {
    id: 'village-story',
    name: 'Village Story',
    description: 'A heartwarming tale set in a peaceful village',
    icon: '🏘️',
    category: 'Story',
    canvasRatio: '9:16',
    duration: 60000,
    sceneCount: 5,
  },
  {
    id: 'kids-cartoon',
    name: 'Kids Cartoon',
    description: 'Fun and colorful cartoon for children',
    icon: '🧒',
    category: 'Kids',
    canvasRatio: '9:16',
    duration: 45000,
    sceneCount: 4,
  },
  {
    id: 'funny-cartoon',
    name: 'Funny Cartoon',
    description: 'Hilarious comedy sketches',
    icon: '😂',
    category: 'Comedy',
    canvasRatio: '9:16',
    duration: 30000,
    sceneCount: 3,
  },
  {
    id: 'emotional-story',
    name: 'Emotional Story',
    description: 'Moving stories that touch the heart',
    icon: '😢',
    category: 'Drama',
    canvasRatio: '9:16',
    duration: 90000,
    sceneCount: 6,
  },
  {
    id: 'animal-story',
    name: 'Animal Story',
    description: 'Adventures with adorable animals',
    icon: '🐕',
    category: 'Animals',
    canvasRatio: '9:16',
    duration: 45000,
    sceneCount: 4,
  },
  {
    id: 'educational',
    name: 'Educational',
    description: 'Learn while having fun',
    icon: '📚',
    category: 'Education',
    canvasRatio: '16:9',
    duration: 120000,
    sceneCount: 8,
  },
  {
    id: 'shorts',
    name: 'Quick Shorts',
    description: 'Short and snappy content',
    icon: '⚡',
    category: 'Shorts',
    canvasRatio: '9:16',
    duration: 15000,
    sceneCount: 2,
  },
  {
    id: 'narrator',
    name: 'Narrator Story',
    description: 'Narrated storytelling with visuals',
    icon: '🎙️',
    category: 'Narration',
    canvasRatio: '16:9',
    duration: 180000,
    sceneCount: 10,
  },
];

export default function TemplatesPage() {
  const router = useRouter();
  const { user, loading, initialized, initialize } = useAuthStore();
  const { createProject } = useProjectStore();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [creating, setCreating] = useState<string | null>(null);

  useEffect(() => {
    initialize();
  }, [initialize]);

  const categories = Array.from(new Set(templates.map((t) => t.category)));
  const filteredTemplates = selectedCategory
    ? templates.filter((t) => t.category === selectedCategory)
    : templates;

  const handleUseTemplate = async (template: Template) => {
    if (!user) {
      router.push(`/auth/login?redirect=/templates`);
      return;
    }

    setCreating(template.id);
    try {
      const project = await createProject(user.uid, template.name, template.canvasRatio);
      router.push(`/editor/${project.id}`);
    } catch {
      setCreating(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="bg-slate-800/80 backdrop-blur-lg border-b border-slate-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Link href="/" className="flex items-center gap-3">
              <Logo size={36} />
              <span className="text-xl font-bold text-white hidden sm:block">AnimateX</span>
            </Link>
            <div className="ml-auto flex items-center gap-4">
              {initialized && user ? (
                <Link
                  href="/studio"
                  className="px-4 py-2 bg-slate-700 text-white font-medium rounded-lg hover:bg-slate-600 transition-colors"
                >
                  My Studio
                </Link>
              ) : (
                <Link
                  href="/auth/login"
                  className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">Project Templates</h1>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Start with a professionally designed template and customize it to create your own unique animation.
          </p>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-full font-medium transition-colors ${
              selectedCategory === null
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-full font-medium transition-colors ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredTemplates.map((template) => (
            <div
              key={template.id}
              className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden hover:border-slate-600 transition-colors"
            >
              <div className="aspect-video bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center">
                <span className="text-6xl">{template.icon}</span>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 bg-slate-700 text-slate-300 rounded text-xs">
                    {template.canvasRatio}
                  </span>
                  <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs">
                    {template.category}
                  </span>
                </div>
                <h3 className="font-semibold text-white">{template.name}</h3>
                <p className="text-sm text-slate-400 mt-1">{template.description}</p>
                <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                  <span>{template.sceneCount} scenes</span>
                  <span>{Math.round(template.duration / 1000)}s</span>
                </div>
                <button
                  onClick={() => handleUseTemplate(template)}
                  disabled={creating === template.id}
                  className="w-full mt-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 transition-all"
                >
                  {creating === template.id ? 'Creating...' : 'Use Template'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
