import { NextResponse } from 'next/server';
import { getAdminFirestore, getAdminAuth } from '@/lib/firebase/admin';

// ---------------------------------------------------------------------------
// Admin: user management (list, upgrade/downgrade plan, ban/suspend)
// Real Firestore/Auth-backed when Firebase Admin env is configured; otherwise
// returns an empty list gracefully (never throws).
// ---------------------------------------------------------------------------

interface UserRow {
  id: string;
  email: string;
  displayName: string;
  role: string; // 'admin' | 'user'
  plan: 'free' | 'pro';
  status: 'active' | 'suspended' | 'banned';
  creditsUsed: number;
  creditsRemaining: number;
  projectCount: number;
  createdAt: number;
  lastActiveAt: number;
}

function adminConfigured(): boolean {
  return !!(process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL);
}

export async function GET() {
  try {
    if (!adminConfigured()) {
      return NextResponse.json({ users: [] });
    }

    const db = getAdminFirestore();
    const usersSnap = await db.collection('users').limit(500).get();

    const users: UserRow[] = await Promise.all(
      usersSnap.docs.map(async (doc) => {
        const data = doc.data();
        let role = 'user';
        try {
          const authUser = await getAdminAuth().getUser(doc.id);
          if (authUser.customClaims?.admin === true) role = 'admin';
        } catch {
          // auth record may not exist
        }

        // count projects
        let projectCount = 0;
        try {
          const projectsSnap = await db.collection('users').doc(doc.id).collection('projects').count().get();
          projectCount = projectsSnap.data().count ?? 0;
        } catch {
          // ignore
        }

        const creditsTotal = 10;
        const creditsUsed = typeof data.creditsUsed === 'number' ? data.creditsUsed : 0;

        return {
          id: doc.id,
          email: data.email || '',
          displayName: data.displayName || data.name || '',
          role,
          plan: data.plan === 'pro' ? 'pro' : 'free',
          status: ['suspended', 'banned'].includes(data.status) ? data.status : 'active',
          creditsUsed,
          creditsRemaining: Math.max(0, creditsTotal - creditsUsed),
          projectCount,
          createdAt: typeof data.createdAt === 'number' ? data.createdAt : 0,
          lastActiveAt: typeof data.lastActiveAt === 'number' ? data.lastActiveAt : 0,
        };
      })
    );

    users.sort((a, b) => b.createdAt - a.createdAt);
    return NextResponse.json({ users });
  } catch (error) {
    console.error('Failed to get admin users:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { userId, action, value } = body as {
      userId: string;
      action: 'upgrade' | 'downgrade' | 'suspend' | 'unsuspend' | 'ban' | 'unban' | 'grant-admin';
      value?: boolean;
    };

    if (!userId || !action) {
      return NextResponse.json({ error: 'Missing userId or action' }, { status: 400 });
    }

    if (!adminConfigured()) {
      return NextResponse.json({ success: true, message: 'Admin SDK not configured — no-op' });
    }

    const db = getAdminFirestore();
    const auth = getAdminAuth();
    const userDoc = db.collection('users').doc(userId);

    switch (action) {
      case 'upgrade':
        await userDoc.set({ plan: 'pro' }, { merge: true });
        break;
      case 'downgrade':
        await userDoc.set({ plan: 'free' }, { merge: true });
        break;
      case 'suspend':
        await userDoc.set({ status: 'suspended' }, { merge: true });
        await auth.updateUser(userId, { disabled: true }).catch(() => undefined);
        break;
      case 'unsuspend':
        await userDoc.set({ status: 'active' }, { merge: true });
        await auth.updateUser(userId, { disabled: false }).catch(() => undefined);
        break;
      case 'ban':
        await userDoc.set({ status: 'banned' }, { merge: true });
        await auth.updateUser(userId, { disabled: true }).catch(() => undefined);
        break;
      case 'unban':
        await userDoc.set({ status: 'active' }, { merge: true });
        await auth.updateUser(userId, { disabled: false }).catch(() => undefined);
        break;
      case 'grant-admin':
        await auth.setCustomUserClaims(userId, { admin: value !== false });
        break;
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
