import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    // In production, verify admin token here
    // const token = (await cookies()).get('__session')?.value;
    // if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // const isAdmin = await verifyAdmin(token);
    // if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Return mock stats for now
    // In production, aggregate from Firestore
    const stats = {
      totalUsers: 0,
      activeUsers: 0,
      totalProjects: 0,
      totalScenes: 0,
      totalExports: 0,
      aiUsage: 0,
      storageUsageMB: 0,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Failed to get admin stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
