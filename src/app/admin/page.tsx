'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth-store';
import { Logo } from '@/components/brand/Logo';

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalProjects: number;
  totalScenes: number;
  totalExports: number;
  aiUsage: number;
  storageUsageMB: number;
}

interface UserData {
  id: string;
  email: string;
  displayName: string;
  role: string;
  status: string;
  createdAt: number;
  lastActiveAt: number;
  projectCount: number;
  storageUsed: number;
}

export default function AdminPage() {
  const router = useRouter();
  const { user, loading, initialized, initialize } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'projects' | 'activity' | 'features' | 'announcements'>('dashboard');
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    activeUsers: 0,
    totalProjects: 0,
    totalScenes: 0,
    totalExports: 0,
    aiUsage: 0,
    storageUsageMB: 0,
  });
  const [users, setUsers] = useState<UserData[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (initialized && !loading) {
      if (!user) {
        router.push('/auth/login?redirect=/admin');
        return;
      }

      if (!user.isAdmin) {
        // Not admin - show access denied
        return;
      }

      loadAdminData();
    }
  }, [initialized, loading, user, router]);

  const loadAdminData = async () => {
    setLoadingData(true);
    try {
      const res = await fetch('/api/admin/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }

      const usersRes = await fetch('/api/admin/users');
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData.users || []);
      }
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  if (!initialized || loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Logo size={64} />
      </div>
    );
  }

  if (!user?.isAdmin) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-slate-400 mb-4">You do not have permission to access this page.</p>
          <Link
            href="/"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'users', label: 'Users', icon: '👥' },
    { id: 'projects', label: 'Projects', icon: '🎬' },
    { id: 'activity', label: 'Activity', icon: '📝' },
    { id: 'features', label: 'Features', icon: '⚙️' },
    { id: 'announcements', label: 'Announcements', icon: '📢' },
  ] as const;

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="bg-slate-800/80 backdrop-blur-lg border-b border-slate-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/studio" className="text-slate-400 hover:text-white">
                ←
              </Link>
              <Logo size={36} />
              <div>
                <h1 className="text-lg font-bold text-white">Admin Panel</h1>
                <p className="text-xs text-slate-400">AnimateX Administration</p>
              </div>
            </div>
            <div className="text-sm text-slate-400">
              {user.email}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <div className="lg:w-64 flex-shrink-0">
            <nav className="bg-slate-800 border border-slate-700 rounded-xl p-2 space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span className="font-medium">{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1">
            {loadingData ? (
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <>
                {/* Dashboard */}
                {activeTab === 'dashboard' && (
                  <div className="space-y-6">
                    <h2 className="text-2xl font-bold text-white">Dashboard</h2>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[
                        { icon: '👥', value: stats.totalUsers, label: 'Total Users' },
                        { icon: '🟢', value: stats.activeUsers, label: 'Active Users' },
                        { icon: '🎬', value: stats.totalProjects, label: 'Total Projects' },
                        { icon: '📤', value: stats.totalExports, label: 'Total Exports' },
                      ].map((stat, i) => (
                        <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                          <div className="text-3xl mb-2">{stat.icon}</div>
                          <div className="text-2xl font-bold text-white">{stat.value}</div>
                          <div className="text-sm text-slate-400">{stat.label}</div>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                        <h3 className="font-semibold text-white mb-4">AI Usage</h3>
                        <div className="text-3xl font-bold text-purple-400">{stats.aiUsage}</div>
                        <div className="text-sm text-slate-400">Requests this month</div>
                      </div>
                      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                        <h3 className="font-semibold text-white mb-4">Storage</h3>
                        <div className="text-3xl font-bold text-blue-400">{stats.storageUsageMB} MB</div>
                        <div className="text-sm text-slate-400">Total storage used</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Users */}
                {activeTab === 'users' && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-2xl font-bold text-white">Users</h2>
                      <span className="text-sm text-slate-400">{users.length} users</span>
                    </div>

                    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-slate-700/50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">User</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Role</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Projects</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                          {users.map((u) => (
                            <tr key={u.id}>
                              <td className="px-6 py-4">
                                <div>
                                  <div className="font-medium text-white">{u.displayName || 'No name'}</div>
                                  <div className="text-sm text-slate-400">{u.email}</div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  u.role === 'admin' ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-600 text-slate-300'
                                }`}>
                                  {u.role}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  u.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                }`}>
                                  {u.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-400">
                                {u.projectCount}
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex gap-2">
                                  <button className="text-blue-400 hover:text-blue-300 text-sm">View</button>
                                  <button className="text-yellow-400 hover:text-yellow-300 text-sm">
                                    {u.status === 'active' ? 'Suspend' : 'Restore'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {users.length === 0 && (
                            <tr>
                              <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                                No users found
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Features */}
                {activeTab === 'features' && (
                  <div className="space-y-6">
                    <h2 className="text-2xl font-bold text-white">Feature Flags</h2>

                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
                      {[
                        { id: 'aiAnimation', name: 'AI Animation', enabled: true },
                        { id: 'aiVoice', name: 'AI Voice', enabled: true },
                        { id: 'aiCharacter', name: 'AI Character Generation', enabled: false },
                        { id: 'aiBackground', name: 'AI Background Generation', enabled: false },
                        { id: 'lipSync', name: 'Lip Sync', enabled: true },
                        { id: 'export', name: 'Video Export', enabled: true },
                        { id: 'voiceRecording', name: 'Voice Recording', enabled: true },
                      ].map((feature) => (
                        <div key={feature.id} className="flex items-center justify-between py-2">
                          <span className="font-medium text-white">{feature.name}</span>
                          <button
                            className={`relative w-12 h-6 rounded-full transition-colors ${
                              feature.enabled ? 'bg-green-500' : 'bg-slate-600'
                            }`}
                          >
                            <span
                              className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                                feature.enabled ? 'left-7' : 'left-1'
                              }`}
                            />
                          </button>
                        </div>
                      ))}
                    </div>

                    <h3 className="text-xl font-bold text-white mt-8">Usage Limits</h3>
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        {[
                          { label: 'Max Projects (Free)', value: 20 },
                          { label: 'AI Requests/Day (Free)', value: 10 },
                          { label: 'Exports/Day (Free)', value: 5 },
                          { label: 'Storage MB (Free)', value: 500 },
                        ].map((limit, i) => (
                          <div key={i}>
                            <label className="block text-sm font-medium text-slate-300 mb-1">{limit.label}</label>
                            <input
                              type="number"
                              defaultValue={limit.value}
                              className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white"
                            />
                          </div>
                        ))}
                      </div>
                      <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                        Save Changes
                      </button>
                    </div>
                  </div>
                )}

                {/* Other tabs placeholder */}
                {(activeTab === 'projects' || activeTab === 'activity' || activeTab === 'announcements') && (
                  <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center text-slate-400">
                    <div className="text-4xl mb-4">🚧</div>
                    <p>This section is under development</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
