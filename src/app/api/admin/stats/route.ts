import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';

// ---------------------------------------------------------------------------
// Admin: analytics overview (totals + top assets) + AI credits usage
// ---------------------------------------------------------------------------

function adminConfigured(): boolean {
  return !!(process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL);
}

export async function GET() {
  try {
    if (!adminConfigured()) {
      return NextResponse.json({
        totalUsers: 0,
        activeUsers: 0,
        totalProjects: 0,
        totalScenes: 0,
        totalExports: 0,
        aiUsage: 0,
        storageUsageMB: 0,
        topCharacters: [],
        topBackgrounds: [],
        topTemplates: [],
        creditUsage: [],
      });
    }

    const db = getAdminFirestore();

    const usersSnap = await db.collection('users').get();
    const totalUsers = usersSnap.size;

    let totalProjects = 0;
    let totalScenes = 0;
    let aiUsage = 0;
    let activeUsers = 0;
    const creditUsage: { userId: string; email: string; used: number; remaining: number }[] = [];
    const charCount = new Map<string, number>();
    const bgCount = new Map<string, number>();

    for (const userDoc of usersSnap.docs) {
      const data = userDoc.data();
      if (data.status !== 'suspended' && data.status !== 'banned') activeUsers++;
      aiUsage += typeof data.creditsUsed === 'number' ? data.creditsUsed : 0;
      creditUsage.push({
        userId: userDoc.id,
        email: data.email || '',
        used: typeof data.creditsUsed === 'number' ? data.creditsUsed : 0,
        remaining: Math.max(0, 10 - (typeof data.creditsUsed === 'number' ? data.creditsUsed : 0)),
      });

      try {
        const projectsSnap = await db.collection('users').doc(userDoc.id).collection('projects').get();
        for (const proj of projectsSnap.docs) {
          totalProjects++;
          const pData = proj.data();
          totalScenes += typeof pData.sceneCount === 'number' ? pData.sceneCount : 0;

          // count assets by name for top lists
          const scenesSnap = await db
            .collection('users')
            .doc(userDoc.id)
            .collection('projects')
            .doc(proj.id)
            .collection('scenes')
            .get();
          for (const sc of scenesSnap.docs) {
            const sData = sc.data();
            const objs = (sData.objects || []) as { type?: string; name?: string }[];
            for (const o of objs) {
              if (o.type === 'character' && o.name) {
                charCount.set(o.name, (charCount.get(o.name) || 0) + 1);
              }
              if (o.type === 'background' && o.name) {
                bgCount.set(o.name, (bgCount.get(o.name) || 0) + 1);
              }
            }
          }
        }
      } catch {
        // ignore per-user errors
      }
    }

    const top = (map: Map<string, number>) =>
      Array.from(map.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, count]) => ({ name, count }));

    return NextResponse.json({
      totalUsers,
      activeUsers,
      totalProjects,
      totalScenes,
      totalExports: 0, // exports are client-side (no server record yet)
      aiUsage,
      storageUsageMB: 0,
      topCharacters: top(charCount),
      topBackgrounds: top(bgCount),
      topTemplates: [],
      creditUsage: creditUsage.slice(0, 50),
    });
  } catch (error) {
    console.error('Failed to get admin stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
