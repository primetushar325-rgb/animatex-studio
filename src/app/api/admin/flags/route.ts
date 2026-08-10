import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';

// ---------------------------------------------------------------------------
// Admin: site-wide feature flags (toggle without redeploy).
// Stored in Firestore `settings/flags`; client falls back to localStorage
// when the API is unreachable / not configured.
// ---------------------------------------------------------------------------

const DEFAULT_FLAGS: Record<string, boolean> = {
  aiTools: true,
  voiceRecording: true,
  gifExport: true,
  webmExport: true,
  lipSync: true,
  templates: true,
  characterLibrary: true,
  smartStory: true,
};

function adminConfigured(): boolean {
  return !!(process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL);
}

export async function GET() {
  try {
    if (!adminConfigured()) {
      return NextResponse.json({ flags: DEFAULT_FLAGS });
    }
    const db = getAdminFirestore();
    const doc = await db.collection('settings').doc('flags').get();
    const stored = doc.exists ? (doc.data() as Record<string, boolean>) : {};
    return NextResponse.json({ flags: { ...DEFAULT_FLAGS, ...stored } });
  } catch (error) {
    console.error('Failed to get flags:', error);
    return NextResponse.json({ flags: DEFAULT_FLAGS });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { flags } = body as { flags: Record<string, boolean> };
    if (!flags) {
      return NextResponse.json({ error: 'Missing flags' }, { status: 400 });
    }

    if (!adminConfigured()) {
      return NextResponse.json({ success: true, flags });
    }

    const db = getAdminFirestore();
    await db.collection('settings').doc('flags').set(flags, { merge: true });
    return NextResponse.json({ success: true, flags });
  } catch (error) {
    console.error('Failed to update flags:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
