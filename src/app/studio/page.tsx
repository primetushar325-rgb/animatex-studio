'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth-store';
import { useProjectStore } from '@/store/project-store';
import { ProjectCard } from '@/components/dashboard/ProjectCard';
import { CreateProjectModal } from '@/components/dashboard/CreateProjectModal';
import { Logo } from '@/components/brand/Logo';

function StudioContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const action = searchParams.get('action');

  const { user, logout, loading: authLoading, initialized, initialize } = useAuthStore();
  const { projects, loadProjects, deleteProject, duplicateProject, renameProject, loading } = useProjectStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (initialized && !authLoading && !user) {
      router.push('/auth/login?redirect=/studio');
    }
  }, [initialized, authLoading, user, router]);

  useEffect(() => {
    if (user?.uid) {
      loadProjects(user.uid);
    }
  }, [user?.uid, loadProjects]);

  // Auto-open create modal if action=new (using setTimeout to avoid setState in effect warning)
  useEffect(() => {
    if (action === 'new' && user) {
      const timer = setTimeout(() => setShowCreateModal(true), 0);
      return () => clearTimeout(timer);
    }
  }, [action, user]);

  const handleProjectCreated = (projectId: string) => {
    router.push(`/editor/${projectId}`);
  };

  const handleOpenProject = (projectId: string) => {
    router.push(`/editor/${projectId}`);
  };

  const handleDuplicate = async (projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    if (project) {
      await duplicateProject(projectId, `${project.name} (Copy)`);
    }
  };

  const handleDelete = async (projectId: string) => {
    await deleteProject(projectId);
    setShowDeleteConfirm(null);
  };

  const handleExport = (projectId: string) => {
    router.push(`/editor/${projectId}?export=true`);
  };

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  if (!initialized || authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Logo size={64} />
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mt-4"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="bg-slate-800/80 backdrop-blur-lg border-b border-slate-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3">
              <Logo size={36} />
              <span className="text-xl font-bold text-white hidden sm:block">AnimateX</span>
            </Link>

            <div className="flex items-center gap-4">
              {user?.isAdmin && (
                <Link
                  href="/admin"
                  className="px-3 py-1.5 text-sm font-medium text-slate-400 hover:text-white flex items-center gap-1"
                >
                  ⚙️ Admin
                </Link>
              )}
              <div className="flex items-center gap-2">
                {user.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full" />
                ) : (
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-medium text-sm">
                      {user.displayName?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
                    </span>
                  </div>
                )}
                <span className="text-sm text-slate-300 hidden sm:block">
                  {user.displayName || user.email}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="text-sm text-slate-500 hover:text-slate-300"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">My Projects</h1>
            <p className="text-slate-400 mt-1">
              {projects.length} project{projects.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/templates"
              className="px-4 py-2 bg-slate-800 border border-slate-700 text-white font-medium rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-2"
            >
              <span>📋</span> Templates
            </Link>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all flex items-center gap-2"
            >
              <span>+</span> New Project
            </button>
          </div>
        </div>

        {/* Projects Grid */}
        {loading && projects.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🎬</div>
            <h3 className="text-xl font-semibold text-white mb-2">No projects yet</h3>
            <p className="text-slate-400 mb-6">Create your first animation project to get started</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all"
            >
              + Create New Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={() => handleOpenProject(project.id)}
                onDuplicate={() => handleDuplicate(project.id)}
                onRename={(newName) => renameProject(project.id, newName)}
                onDelete={() => setShowDeleteConfirm(project.id)}
                onExport={() => handleExport(project.id)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onProjectCreated={handleProjectCreated}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-2">Delete Project?</h3>
            <p className="text-slate-400 mb-6">
              This action cannot be undone. All project data will be permanently deleted.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 py-2 bg-slate-700 text-white font-medium rounded-lg hover:bg-slate-600"
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

export default function StudioPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    }>
      <StudioContent />
    </Suspense>
  );
}
