import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';

// ---------------------------------------------------------------------------
// Admin: animation registry overrides (edit clip properties + add actions
// without touching the engine). Stored in Firestore `settings/animations`;
// the client merges these over ACTION_REGISTRY. localStorage fallback when
// the API/Firestore isn't configured.
// ---------------------------------------------------------------------------

function adminConfigured(): boolean {
  return !!(process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL);
}

const LOCAL_KEY = 'animatex-anim-overrides';

function localGet(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function GET() {
  try {
    if (!adminConfigured()) {
      return NextResponse.json({ overrides: {} });
    }
    const db = getAdminFirestore();
    const doc = await db.collection('settings').doc('animations').get();
    return NextResponse.json({ overrides: doc.exists ? (doc.data()?.overrides || {}) : {} });
  } catch (error) {
    console.error('Failed to get animation overrides:', error);
    return NextResponse.json({ overrides: {} });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { overrides } = body as { overrides: Record<string, unknown> };
    if (!overrides) {
      return NextResponse.json({ error: 'Missing overrides' }, { status: 400 });
    }

    if (!adminConfigured()) {
      // store locally so the flow still works in dev / without admin env
      try {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(overrides));
      } catch {
        // ignore
      }
      return NextResponse.json({ success: true, overrides });
    }

    const db = getAdminFirestore();
    await db.collection('settings').doc('animations').set({ overrides }, { merge: true });
    return NextResponse.json({ success: true, overrides });
  } catch (error) {
    console.error('Failed to update animation overrides:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
