'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';

const GOAL_LABELS: Record<string, string> = {
  fat_loss: '🔥 Fat Loss', muscle_gain: '💪 Muscle Gain', recomp: '⚡ Body Recomp',
  sports: '🏃 Sports Performance', general_health: '💚 General Health', medical: '🏥 Medical Support',
  pregnancy: '🤰 Pregnancy', plant_based: '🌱 Plant-Based', gut_health: '🧬 Gut Health',
  energy: '⚡ Energy & Focus', family: '👨‍👩‍👧‍👦 Family Nutrition', ed_recovery: '💜 ED Recovery',
};

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [plans, setPlans] = useState<any[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    apiFetch('/plans').then(async r => {
      if (r.ok) setPlans(await r.json());
      setLoadingPlans(false);
    }).catch(() => setLoadingPlans(false));
  }, [user]);

  async function handleLogout() {
    await logout();
    router.push('/');
  }

  if (loading || !user) return <div className="min-h-screen flex items-center justify-center"><div className="spinner" style={{ width: 40, height: 40 }} /></div>;

  const activePlan = plans.find(p => p.isActive);

  return (
    <div className="min-h-screen">
      {/* Top nav */}
      <nav className="border-b px-6 py-4" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xl">🥗</span>
            <span className="font-bold gradient-text">NutriBot</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/dashboard/settings" className="btn-ghost text-sm">⚙️ Settings</Link>
            <button onClick={handleLogout} className="btn-ghost text-sm text-slate-400">Sign Out</button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Email verification banner */}
        {!user.emailVerified && (
          <div className="banner banner-warning mb-6">
            📧 Please verify your email to unlock plan generation. Check your inbox!
          </div>
        )}

        {/* Welcome */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold mb-2">Welcome back, {user.fullName.split(' ')[0]}! 👋</h1>
          <p className="text-slate-400">Here&apos;s your nutrition dashboard.</p>
        </div>

        {/* Quick actions */}
        <div className="grid md:grid-cols-3 gap-4 mb-10">
          <Link href="/profiles" className="glass-card p-6 hover:border-emerald-500/20 transition-all group">
            <div className="text-3xl mb-3">🎯</div>
            <h3 className="font-semibold mb-1 group-hover:text-emerald-400 transition-colors">New Plan</h3>
            <p className="text-sm text-slate-400">Start a new nutrition plan for any goal</p>
          </Link>
          {activePlan && (
            <Link href={`/dashboard/plan?planId=${activePlan.id}`} className="glass-card p-6 hover:border-emerald-500/20 transition-all group animate-pulse-glow">
              <div className="text-3xl mb-3">📋</div>
              <h3 className="font-semibold mb-1 group-hover:text-emerald-400 transition-colors">Active Plan</h3>
              <p className="text-sm text-slate-400">{GOAL_LABELS[activePlan.goal?.goalType] || activePlan.goal?.goalType}</p>
            </Link>
          )}
          <Link href="/dashboard/settings" className="glass-card p-6 hover:border-emerald-500/20 transition-all group">
            <div className="text-3xl mb-3">👤</div>
            <h3 className="font-semibold mb-1 group-hover:text-emerald-400 transition-colors">Account</h3>
            <p className="text-sm text-slate-400">Manage settings, MFA, and privacy</p>
          </Link>
        </div>

        {/* Plan history */}
        <div>
          <h2 className="text-xl font-bold mb-4">Plan History</h2>
          {loadingPlans ? (
            <div className="flex justify-center py-10"><div className="spinner" style={{ width: 30, height: 30 }} /></div>
          ) : plans.length === 0 ? (
            <div className="glass-card p-10 text-center">
              <div className="text-5xl mb-4">🌟</div>
              <h3 className="text-xl font-semibold mb-2">No plans yet</h3>
              <p className="text-slate-400 mb-6">Create your first nutrition plan to get started!</p>
              <Link href="/profiles" className="btn-primary">Create Your First Plan →</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {plans.map(plan => (
                <Link
                  key={plan.id}
                  href={`/dashboard/plan?planId=${plan.id}`}
                  className="glass-card p-5 flex items-center justify-between hover:border-emerald-500/15 transition-all group block"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">{GOAL_LABELS[plan.goal?.goalType]?.charAt(0) || '📋'}</span>
                    <div>
                      <h3 className="font-semibold group-hover:text-emerald-400 transition-colors">
                        {GOAL_LABELS[plan.goal?.goalType] || plan.goal?.goalType}
                      </h3>
                      <p className="text-sm text-slate-400">
                        Created {new Date(plan.createdAt).toLocaleDateString()}
                        {plan.isActive && <span className="ml-2 text-emerald-400 text-xs font-medium">● Active</span>}
                      </p>
                    </div>
                  </div>
                  <span className="text-slate-500 group-hover:text-slate-300 transition-colors">View →</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Disclaimer */}
        <div className="mt-16 text-center">
          <p className="text-xs text-slate-500 max-w-2xl mx-auto">
            This app provides general nutrition guidance. It is not a substitute for professional medical advice.
            Consult a healthcare provider before making significant dietary changes, especially if you have a medical condition,
            are pregnant, or are recovering from an eating disorder.
          </p>
        </div>
      </div>
    </div>
  );
}
