import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';

// ---------------------------------------------------------------------------
// Admin: asset library management — review uploaded characters/backgrounds
// across all users + remove problematic assets.
// ---------------------------------------------------------------------------

function adminConfigured(): boolean {
  return !!(process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL);
}

export async function GET() {
  try {
    if (!adminConfigured()) {
      return NextResponse.json({ assets: [] });
    }

    const db = getAdminFirestore();
    const assets: {
      id: string;
      ownerId: string;
      email: string;
      kind: 'character' | 'background' | 'prop';
      name: string;
      imageUrl: string;
      status: string;
      createdAt: number;
    }[] = [];

    const usersSnap = await db.collection('users').get();
    for (const userDoc of usersSnap.docs) {
      const email = userDoc.data().email || '';
      for (const kind of ['characterLibrary', 'backgroundLibrary', 'propLibrary'] as const) {
        try {
          const snap = await db.collection('users').doc(userDoc.id).collection(kind).get();
          for (const doc of snap.docs) {
            const d = doc.data();
            assets.push({
              id: doc.id,
              ownerId: userDoc.id,
              email,
              kind: kind === 'characterLibrary' ? 'character' : kind === 'backgroundLibrary' ? 'background' : 'prop',
              name: d.name || 'Untitled',
              imageUrl: d.imageUrl || '',
              status: d.status || 'pending',
              createdAt: typeof d.createdAt === 'number' ? d.createdAt : 0,
            });
          }
        } catch {
          // ignore
        }
      }
    }

    assets.sort((a, b) => b.createdAt - a.createdAt);
    return NextResponse.json({ assets: assets.slice(0, 300) });
  } catch (error) {
    console.error('Failed to list assets:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { ownerId, assetId, status } = body as { ownerId: string; assetId: string; status: string };
    if (!ownerId || !assetId || !status) {
      return NextResponse.json({ error: 'Missing params' }, { status: 400 });
    }

    if (!adminConfigured()) {
      return NextResponse.json({ success: true, message: 'Admin SDK not configured — no-op' });
    }

    const db = getAdminFirestore();
    // find which sub-collection contains the asset
    for (const kind of ['characterLibrary', 'backgroundLibrary', 'propLibrary'] as const) {
      const ref = db.collection('users').doc(ownerId).collection(kind).doc(assetId);
      const snap = await ref.get();
      if (snap.exists) {
        await ref.set({ status }, { merge: true });
        return NextResponse.json({ success: true, kind });
      }
    }
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  } catch (error) {
    console.error('Failed to update asset:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const ownerId = searchParams.get('ownerId');
    const assetId = searchParams.get('assetId');
    if (!ownerId || !assetId) {
      return NextResponse.json({ error: 'Missing params' }, { status: 400 });
    }

    if (!adminConfigured()) {
      return NextResponse.json({ success: true, message: 'Admin SDK not configured — no-op' });
    }

    const db = getAdminFirestore();
    for (const kind of ['characterLibrary', 'backgroundLibrary', 'propLibrary'] as const) {
      const ref = db.collection('users').doc(ownerId).collection(kind).doc(assetId);
      const snap = await ref.get();
      if (snap.exists) {
        await ref.delete();
        return NextResponse.json({ success: true });
      }
    }
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  } catch (error) {
    console.error('Failed to delete asset:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
