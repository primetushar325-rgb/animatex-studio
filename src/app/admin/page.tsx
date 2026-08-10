'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Users as UsersIcon,
  Coins,
  Image as ImageIcon,
  Flag,
  ArrowLeft,
  Search,
  ShieldCheck,
  ShieldOff,
  Crown,
  Ban,
  CheckCircle2,
  Trash2,
  Loader2,
  BarChart3,
  Activity,
  Plus,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { ACTION_REGISTRY, ACTION_CATEGORIES, type ActionClip, type ActionCategory } from '@/lib/editor/animations';
import type { CharacterAction } from '@/types/animation';
import { Logo } from '@/components/brand/Logo';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalProjects: number;
  totalScenes: number;
  totalExports: number;
  aiUsage: number;
  storageUsageMB: number;
  topCharacters: { name: string; count: number }[];
  topBackgrounds: { name: string; count: number }[];
  topTemplates: { name: string; count: number }[];
  creditUsage: { userId: string; email: string; used: number; remaining: number }[];
}

interface UserRow {
  id: string;
  email: string;
  displayName: string;
  role: string;
  plan: 'free' | 'pro';
  status: 'active' | 'suspended' | 'banned';
  creditsUsed: number;
  creditsRemaining: number;
  projectCount: number;
  createdAt: number;
  lastActiveAt: number;
}

interface AssetRow {
  id: string;
  ownerId: string;
  email: string;
  kind: 'character' | 'background' | 'prop';
  name: string;
  imageUrl: string;
  status: string;
  createdAt: number;
}

type Tab = 'dashboard' | 'users' | 'credits' | 'assets' | 'flags' | 'animations';

const EMPTY_STATS: AdminStats = {
  totalUsers: 0, activeUsers: 0, totalProjects: 0, totalScenes: 0,
  totalExports: 0, aiUsage: 0, storageUsageMB: 0,
  topCharacters: [], topBackgrounds: [], topTemplates: [], creditUsage: [],
};

export default function AdminPage() {
  const router = useRouter();
  const { user, loading, initialized, initialize } = useAuthStore();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [stats, setStats] = useState<AdminStats>(EMPTY_STATS);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [animOverrides, setAnimOverrides] = useState<Record<string, Partial<ActionClip>>>({});
  const [newAction, setNewAction] = useState({ id: '', label: '', category: 'basic' as ActionCategory, action: 'idle' as CharacterAction, speed: 1, loop: true });
  const [loadingData, setLoadingData] = useState(true);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<'all' | 'free' | 'pro'>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3000);
  };

  const loadAdminData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [statsRes, usersRes, assetsRes, flagsRes, animRes] = await Promise.all([
        fetch('/api/admin/stats').then((r) => r.json()),
        fetch('/api/admin/users').then((r) => r.json()),
        fetch('/api/admin/assets').then((r) => r.json()),
        fetch('/api/admin/flags').then((r) => r.json()),
        fetch('/api/admin/animations').then((r) => r.json()),
      ]);
      setStats(statsRes || EMPTY_STATS);
      setUsers(usersRes.users || []);
      setAssets(assetsRes.assets || []);
      setFlags(flagsRes.flags || {});
      setAnimOverrides(animRes.overrides || {});
    } catch {
      // keep empty state
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (initialized && !loading) {
      if (!user) {
        router.push('/auth/login?redirect=/admin');
        return;
      }
      if (!user.isAdmin) return; // access denied shown below
      void loadAdminData();
    }
  }, [initialized, loading, user, router, loadAdminData]);

  // actions ----------------------------------------------------------------

  const userAction = async (id: string, action: string, value?: boolean) => {
    setBusy(id);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: id, action, value }),
      });
      const data = await res.json();
      if (data.success) {
        await loadAdminData();
        showNotice('User updated ✓');
      }
    } catch {
      showNotice('Action failed');
    } finally {
      setBusy(null);
    }
  };

  const assetAction = async (ownerId: string, assetId: string, action: 'approve' | 'remove') => {
    setBusy(assetId);
    try {
      if (action === 'remove') {
        await fetch(`/api/admin/assets?ownerId=${ownerId}&assetId=${assetId}`, { method: 'DELETE' });
      } else {
        await fetch('/api/admin/assets', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ownerId, assetId, status: 'approved' }),
        });
      }
      await loadAdminData();
      showNotice(action === 'remove' ? 'Asset removed' : 'Asset approved');
    } catch {
      showNotice('Action failed');
    } finally {
      setBusy(null);
    }
  };

  const saveAnimOverrides = async () => {
    try {
      await fetch('/api/admin/animations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overrides: animOverrides }),
      });
      showNotice('Animation settings saved ✓');
    } catch {
      showNotice('Save failed (kept locally)');
    }
  };

  const patchAnim = (id: string, patch: Partial<ActionClip>) => {
    setAnimOverrides((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), ...patch },
    }));
  };

  const addNewAction = () => {
    if (!newAction.id.trim() || !newAction.label.trim()) {
      showNotice('Name + label required');
      return;
    }
    const id = newAction.id.trim().toLowerCase().replace(/\s+/g, '-');
    setAnimOverrides((prev) => ({
      ...prev,
      [id]: {
        id,
        label: newAction.label.trim(),
        category: newAction.category,
        action: newAction.action,
        speed: newAction.speed,
        loop: newAction.loop,
        duration: 1200,
        fps: 30,
        enabled: true,
      },
    }));
    setNewAction({ id: '', label: '', category: 'basic', action: 'idle', speed: 1, loop: true });
    showNotice('Action added — Save চাপলে কার্যকর হবে');
  };

  const toggleFlag = async (key: string) => {
    const next = { ...flags, [key]: !flags[key] };
    setFlags(next);
    try {
      await fetch('/api/admin/flags', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flags: next }),
      });
      showNotice('Flag updated ✓');
    } catch {
      showNotice('Flag update failed (stored locally)');
    }
  };

  // -------------------------------------------------------------------------
  // Access control
  // -------------------------------------------------------------------------

  if (!initialized || loading) {
    return (
      <div className="min-h-screen editor-surface flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--editor-accent)]" />
      </div>
    );
  }

  if (!user) return null;

  if (!user.isAdmin) {
    return (
      <div className="min-h-screen editor-surface flex items-center justify-center p-6">
        <div className="editor-panel border border-[var(--editor-border)] rounded-2xl p-10 text-center max-w-sm">
          <ShieldOff size={40} className="mx-auto mb-4 text-red-400" />
          <h1 className="text-white font-bold text-xl mb-2">Access Denied</h1>
          <p className="text-[var(--editor-text-2)] text-sm mb-6">
            This area is restricted to administrators.
          </p>
          <Link href="/studio" className="inline-block px-5 py-2.5 editor-gradient text-white text-sm font-medium rounded-xl">
            Back to Studio
          </Link>
        </div>
      </div>
    );
  }

  const filteredUsers = users.filter((u) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q || u.email.toLowerCase().includes(q) || u.displayName.toLowerCase().includes(q);
    const matchesPlan = planFilter === 'all' || u.plan === planFilter;
    return matchesSearch && matchesPlan;
  });

  const statCard = (label: string, value: string | number, icon: React.ReactNode) => (
    <div className="editor-panel-2 border border-[var(--editor-border)] rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[var(--editor-text-2)] text-xs">{label}</span>
        <span className="text-[var(--editor-accent)]">{icon}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );

  const tabBtn = (t: Tab, label: string, icon: React.ReactNode) => (
    <button
      onClick={() => setTab(t)}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm whitespace-nowrap transition-colors ${
        tab === t
          ? 'editor-gradient text-white font-medium'
          : 'editor-panel-2 text-[var(--editor-text-2)] hover:text-white'
      }`}
    >
      {icon} {label}
    </button>
  );

  return (
    <div className="min-h-screen editor-surface">
      {/* Top bar */}
      <div className="border-b border-[var(--editor-border)] px-4 py-3 flex items-center gap-3 sticky top-0 editor-surface z-20">
        <Link href="/" className="flex items-center gap-2 text-[var(--editor-text-2)] hover:text-white">
          <ArrowLeft size={18} />
        </Link>
        <Logo size={28} />
        <span className="font-bold text-white">Admin Panel</span>
        <span className="ml-auto text-[10px] px-2 py-1 rounded-full editor-gradient text-white font-semibold">
          {user.email}
        </span>
      </div>

      {notice && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-green-500/20 border border-green-500/40 text-green-300 text-sm">
          {notice}
        </div>
      )}

      <div className="max-w-6xl mx-auto p-4">
        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto editor-scroll pb-4">
          {tabBtn('dashboard', 'Dashboard', <LayoutDashboard size={15} />)}
          {tabBtn('users', 'Users', <UsersIcon size={15} />)}
          {tabBtn('credits', 'Credits', <Coins size={15} />)}
          {tabBtn('assets', 'Assets', <ImageIcon size={15} />)}
          {tabBtn('flags', 'Feature Flags', <Flag size={15} />)}
          {tabBtn('animations', 'Animations', <Activity size={15} />)}
        </div>

        {loadingData ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--editor-accent)]" />
          </div>
        ) : (
          <>
            {/* ============ DASHBOARD ============ */}
            {tab === 'dashboard' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {statCard('Total Users', stats.totalUsers, <UsersIcon size={16} />)}
                  {statCard('Active Users', stats.activeUsers, <ShieldCheck size={16} />)}
                  {statCard('Projects', stats.totalProjects, <BarChart3 size={16} />)}
                  {statCard('AI Usage', stats.aiUsage, <Coins size={16} />)}
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="editor-panel-2 border border-[var(--editor-border)] rounded-2xl p-4">
                    <h3 className="text-white font-semibold text-sm mb-3">Most-used Characters</h3>
                    {stats.topCharacters.length === 0 ? (
                      <p className="text-xs text-[var(--editor-text-2)]">No data yet</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {stats.topCharacters.map((c) => (
                          <li key={c.name} className="flex justify-between text-xs text-[var(--editor-text-2)]">
                            <span>{c.name}</span>
                            <span className="text-white font-medium">{c.count}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="editor-panel-2 border border-[var(--editor-border)] rounded-2xl p-4">
                    <h3 className="text-white font-semibold text-sm mb-3">Most-used Backgrounds</h3>
                    {stats.topBackgrounds.length === 0 ? (
                      <p className="text-xs text-[var(--editor-text-2)]">No data yet</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {stats.topBackgrounds.map((b) => (
                          <li key={b.name} className="flex justify-between text-xs text-[var(--editor-text-2)]">
                            <span>{b.name}</span>
                            <span className="text-white font-medium">{b.count}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <p className="text-[10px] text-[var(--editor-text-2)]">
                  Note: Firebase Admin SDK env vars সেট না থাকলে এখানে খালি/০ দেখাবে — Vercel-এ FIREBASE_ADMIN_* যোগ করলে real data আসবে।
                </p>
              </div>
            )}

            {/* ============ USERS ============ */}
            {tab === 'users' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--editor-text-2)]" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search by email or name…"
                      className="editor-input w-full pl-9 pr-3 py-2.5 text-sm"
                    />
                  </div>
                  <div className="flex gap-1.5">
                    {(['all', 'free', 'pro'] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => setPlanFilter(p)}
                        className={`px-3 py-2 rounded-lg text-xs capitalize transition-colors ${
                          planFilter === p ? 'editor-gradient text-white' : 'editor-panel-2 text-[var(--editor-text-2)]'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="editor-panel-2 border border-[var(--editor-border)] rounded-2xl overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[640px]">
                    <thead className="text-[var(--editor-text-2)] border-b border-[var(--editor-border)]">
                      <tr>
                        <th className="px-3 py-2.5 font-medium">User</th>
                        <th className="px-3 py-2.5 font-medium">Plan</th>
                        <th className="px-3 py-2.5 font-medium">Status</th>
                        <th className="px-3 py-2.5 font-medium">Projects</th>
                        <th className="px-3 py-2.5 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((u) => (
                        <tr key={u.id} className="border-b border-[var(--editor-border)] last:border-0">
                          <td className="px-3 py-2.5">
                            <p className="text-white font-medium">{u.displayName || '—'}</p>
                            <p className="text-[var(--editor-text-2)] text-[10px]">{u.email}</p>
                            {u.role === 'admin' && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--editor-accent)]/20 text-[var(--editor-accent)]">ADMIN</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${u.plan === 'pro' ? 'bg-[var(--editor-accent)]/20 text-[var(--editor-accent)]' : 'bg-[#33333F] text-[var(--editor-text-2)]'}`}>
                              {u.plan === 'pro' ? 'PRO' : 'Free'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`${u.status === 'active' ? 'text-green-400' : 'text-red-400'}`}>
                              {u.status}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-white">{u.projectCount}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex gap-1">
                              {u.plan === 'pro' ? (
                                <button
                                  onClick={() => void userAction(u.id, 'downgrade')}
                                  disabled={busy === u.id}
                                  className="px-2 py-1 rounded-lg bg-[#33333F] hover:bg-[#44444F] text-white text-[10px] disabled:opacity-40"
                                  title="Downgrade to Free"
                                >
                                  <Crown size={12} /> Free
                                </button>
                              ) : (
                                <button
                                  onClick={() => void userAction(u.id, 'upgrade')}
                                  disabled={busy === u.id}
                                  className="px-2 py-1 rounded-lg bg-[var(--editor-accent)]/20 hover:bg-[var(--editor-accent)]/30 text-[var(--editor-accent)] text-[10px] disabled:opacity-40"
                                  title="Upgrade to Pro"
                                >
                                  <Crown size={12} /> Pro
                                </button>
                              )}
                              {u.status === 'active' ? (
                                <button
                                  onClick={() => void userAction(u.id, 'suspend')}
                                  disabled={busy === u.id}
                                  className="px-2 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-[10px] disabled:opacity-40"
                                  title="Suspend"
                                >
                                  <Ban size={12} />
                                </button>
                              ) : (
                                <button
                                  onClick={() => void userAction(u.id, 'unsuspend')}
                                  disabled={busy === u.id}
                                  className="px-2 py-1 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 text-[10px] disabled:opacity-40"
                                  title="Restore"
                                >
                                  <CheckCircle2 size={12} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredUsers.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-3 py-8 text-center text-[var(--editor-text-2)]">
                            No users {adminConfiguredHint()}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ============ CREDITS ============ */}
            {tab === 'credits' && (
              <div className="editor-panel-2 border border-[var(--editor-border)] rounded-2xl p-4">
                <h3 className="text-white font-semibold text-sm mb-3">AI Credits Usage (free tier = 10 credits)</h3>
                {stats.creditUsage.length === 0 ? (
                  <p className="text-xs text-[var(--editor-text-2)]">No usage data yet — Firebase Admin SDK সেট করলে real data আসবে।</p>
                ) : (
                  <div className="space-y-2">
                    {stats.creditUsage.map((c) => (
                      <div key={c.userId} className="flex items-center justify-between text-xs">
                        <span className="text-[var(--editor-text-2)] truncate max-w-[40%]">{c.email || c.userId}</span>
                        <div className="flex-1 mx-3 h-2 rounded-full bg-[#22222C] overflow-hidden">
                          <div
                            className="h-full editor-gradient"
                            style={{ width: `${(c.used / 10) * 100}%` }}
                          />
                        </div>
                        <span className="text-white whitespace-nowrap">{c.used} used / {c.remaining} left</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ============ ASSETS ============ */}
            {tab === 'assets' && (
              <div className="space-y-3">
                <p className="text-xs text-[var(--editor-text-2)]">
                  Bulk-imported & uploaded characters/backgrounds — review, approve, or remove.
                </p>
                {assets.length === 0 ? (
                  <div className="editor-panel-2 border border-[var(--editor-border)] rounded-2xl p-10 text-center">
                    <ImageIcon size={32} className="mx-auto mb-3 text-[var(--editor-text-2)]" />
                    <p className="text-xs text-[var(--editor-text-2)]">
                      No assets yet. Firebase Admin SDK সেট করলে user-uploaded library assets এখানে দেখা যাবে।
                    </p>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {assets.map((a) => (
                      <div key={a.id} className="editor-panel-2 border border-[var(--editor-border)] rounded-2xl p-3">
                        <div className="flex items-center gap-3 mb-2">
                          {a.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={a.imageUrl} alt={a.name} className="w-12 h-14 object-contain rounded-lg bg-[#22222C]" />
                          ) : (
                            <div className="w-12 h-14 rounded-lg bg-[#22222C] flex items-center justify-center">
                              <ImageIcon size={18} className="text-[var(--editor-text-2)]" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-white text-sm font-medium truncate">{a.name}</p>
                            <p className="text-[10px] text-[var(--editor-text-2)]">
                              {a.kind} · {a.email}
                            </p>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded ${a.status === 'approved' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-300'}`}>
                              {a.status}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => void assetAction(a.ownerId, a.id, 'approve')}
                            disabled={busy === a.id}
                            className="flex-1 py-1.5 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 text-[10px] font-medium disabled:opacity-40"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => void assetAction(a.ownerId, a.id, 'remove')}
                            disabled={busy === a.id}
                            className="flex-1 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-[10px] font-medium disabled:opacity-40"
                          >
                            <Trash2 size={11} className="inline mr-1" /> Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ============ ANIMATIONS ============ */}
            {tab === 'animations' && (
              <div className="space-y-4">
                <div className="editor-panel-2 border border-[var(--editor-border)] rounded-2xl p-4">
                  <h3 className="text-white font-semibold text-sm mb-1">Animation Library ({ACTION_REGISTRY.length} actions)</h3>
                  <p className="text-xs text-[var(--editor-text-2)] mb-4">
                    Clip properties (speed/loop/duration/fps) + enable/disable — redeploy ছাড়া সেভ হয়। নতুন action যোগ করতে নিচের ফর্ম।
                  </p>

                  {/* Add new action */}
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-4">
                    <input value={newAction.id} onChange={(e) => setNewAction((n) => ({ ...n, id: e.target.value }))} placeholder="id (walk-slow)" className="editor-input px-2 py-1.5 text-xs" />
                    <input value={newAction.label} onChange={(e) => setNewAction((n) => ({ ...n, label: e.target.value }))} placeholder="Label" className="editor-input px-2 py-1.5 text-xs" />
                    <select value={newAction.category} onChange={(e) => setNewAction((n) => ({ ...n, category: e.target.value as ActionCategory }))} className="editor-input px-2 py-1.5 text-xs">
                      {ACTION_CATEGORIES.filter((c) => c.id !== 'all').map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                    <select value={newAction.action} onChange={(e) => setNewAction((n) => ({ ...n, action: e.target.value as CharacterAction }))} className="editor-input px-2 py-1.5 text-xs">
                      {Array.from(new Set(ACTION_REGISTRY.map((a) => a.action))).map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                    <input type="number" step="0.25" value={newAction.speed} onChange={(e) => setNewAction((n) => ({ ...n, speed: parseFloat(e.target.value) || 1 }))} placeholder="Speed" className="editor-input px-2 py-1.5 text-xs" />
                    <button onClick={addNewAction} className="px-2 py-1.5 rounded-lg editor-gradient text-white text-xs font-medium flex items-center justify-center gap-1">
                      <Plus size={13} /> Add
                    </button>
                  </div>

                  <div className="max-h-[50vh] overflow-y-auto editor-scroll">
                    {ACTION_REGISTRY.map((clip) => {
                      const ov = animOverrides[clip.id] || {};
                      const speed = ov.speed ?? clip.speed;
                      const loop = ov.loop ?? clip.loop;
                      const duration = ov.duration ?? clip.duration;
                      const fps = ov.fps ?? clip.fps;
                      const enabled = ov.enabled ?? clip.enabled;
                      const cat = ACTION_CATEGORIES.find((c) => c.id === clip.category);
                      return (
                        <div key={clip.id} className="flex flex-wrap items-center gap-2 py-2 border-b border-[var(--editor-border)] last:border-0">
                          <div className="w-40 min-w-0">
                            <p className="text-sm text-white truncate">{clip.label}</p>
                            <p className="text-[10px] text-[var(--editor-text-2)]">{clip.id} · {cat?.label}</p>
                          </div>
                          <input type="number" step="0.25" value={speed} onChange={(e) => patchAnim(clip.id, { speed: parseFloat(e.target.value) || 1 })} className="editor-input w-16 px-1.5 py-1 text-xs" title="Speed" />
                          <input type="number" value={duration} onChange={(e) => patchAnim(clip.id, { duration: parseInt(e.target.value, 10) || 1000 })} className="editor-input w-20 px-1.5 py-1 text-xs" title="Duration (ms)" />
                          <input type="number" value={fps} onChange={(e) => patchAnim(clip.id, { fps: parseInt(e.target.value, 10) || 30 })} className="editor-input w-14 px-1.5 py-1 text-xs" title="FPS" />
                          <button onClick={() => patchAnim(clip.id, { loop: !loop })} className={`px-2 py-1 rounded-lg text-[10px] font-medium ${loop ? 'bg-green-500/20 text-green-400' : 'bg-[#33333F] text-[var(--editor-text-2)]'}`}>
                            {loop ? 'LOOP' : 'ONCE'}
                          </button>
                          <button onClick={() => patchAnim(clip.id, { enabled: !enabled })} className={`px-2 py-1 rounded-lg text-[10px] font-medium ${enabled ? 'bg-[var(--editor-accent)]/20 text-[var(--editor-accent)]' : 'bg-red-500/20 text-red-400'}`}>
                            {enabled ? 'ON' : 'OFF'}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <button onClick={saveAnimOverrides} className="mt-4 w-full py-2.5 rounded-xl editor-gradient text-white text-sm font-semibold">
                    💾 Save Animation Settings
                  </button>
                </div>
              </div>
            )}

            {/* ============ FLAGS ============ */}
            {tab === 'flags' && (
              <div className="editor-panel-2 border border-[var(--editor-border)] rounded-2xl p-4">
                <h3 className="text-white font-semibold text-sm mb-1">Site-wide Feature Flags</h3>
                <p className="text-xs text-[var(--editor-text-2)] mb-4">
                  Toggle features without redeploy (Firestore-এ সেভ হয়; API না থাকলে localStorage-এ)।
                </p>
                <div className="space-y-2">
                  {Object.entries(flags).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between py-2 border-b border-[var(--editor-border)] last:border-0">
                      <span className="text-sm text-white capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                      <button
                        onClick={() => void toggleFlag(key)}
                        className="relative w-12 h-6 rounded-full transition-colors"
                        style={{ background: value ? 'linear-gradient(135deg,#5B8DEF,#8B5CF6)' : '#33333F' }}
                      >
                        <span
                          className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all"
                          style={{ left: value ? 28 : 4 }}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  function adminConfiguredHint(): string {
    return process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? '' : '(Firebase Admin SDK সেট করুন)';
  }
}
