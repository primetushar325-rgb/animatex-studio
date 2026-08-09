'use client';

import { use, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { Editor } from '@/components/editor/Editor';
import { Logo } from '@/components/brand/Logo';

interface EditorPageProps {
  params: Promise<{ id: string }>;
}

function EditorContent({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoExport = searchParams.get('export') === 'true';
  
  const { user, loading, initialized, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (initialized && !loading && !user) {
      router.push(`/auth/login?redirect=/editor/${id}`);
    }
  }, [initialized, loading, user, router, id]);

  if (!initialized || loading) {
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

  return <Editor projectId={id} autoExport={autoExport} />;
}

export default function EditorPage({ params }: EditorPageProps) {
  const { id } = use(params);
  
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Logo size={64} />
      </div>
    }>
      <EditorContent id={id} />
    </Suspense>
  );
}
