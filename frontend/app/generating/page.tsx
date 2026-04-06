'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';

const MODULE_LABELS: Record<string, { icon: string; label: string }> = {
  calorie_calc: { icon: '🔢', label: 'Calorie Calculation' },
  macros: { icon: '📊', label: 'Macro Targets' },
  meal_plan: { icon: '🍽️', label: '7-Day Meal Plan' },
  snack_swaps: { icon: '🍿', label: 'Snack Swaps' },
  rules: { icon: '📋', label: 'Personal Rules' },
  timeline: { icon: '📅', label: 'Timeline & Expectations' },
  hydration: { icon: '💧', label: 'Hydration Target' },
  supplements: { icon: '💊', label: 'Supplements' },
  grocery_list: { icon: '🛒', label: 'Grocery List' },
  progress_tracking: { icon: '📈', label: 'Progress Tracking' },
};

function GeneratingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const goalId = searchParams.get('goalId');
  const [status, setStatus] = useState<'generating' | 'done' | 'error'>('generating');
  const [modules, setModules] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [planId, setPlanId] = useState('');
  const [currentModule, setCurrentModule] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) router.push('/auth/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!goalId || !user) return;
    let mounted = true;

    async function generate() {
      try {
        const res = await apiFetch(`/plans/generate/${goalId}`, { method: 'POST' });
        if (!mounted) return;
        if (!res.ok) {
          const d = await res.json();
          setError(d.error || 'Plan generation failed');
          setStatus('error');
          return;
        }
        const data = await res.json();
        setPlanId(data.planId);
        setModules(data.modules);
        setStatus('done');
      } catch (err) {
        if (!mounted) return;
        setError('Something went wrong during plan generation.');
        setStatus('error');
      }
    }

    generate();
    return () => { mounted = false; };
  }, [goalId, user]);

  // Simulate progress animation
  useEffect(() => {
    if (status !== 'generating') return;
    const maxModules = 10;
    const interval = setInterval(() => {
      setCurrentModule(prev => prev < maxModules - 1 ? prev + 1 : prev);
    }, 3000);
    return () => clearInterval(interval);
  }, [status]);

  if (authLoading || !user) return <div className="min-h-screen flex items-center justify-center"><div className="spinner" style={{ width: 40, height: 40 }} /></div>;

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="glass-card-strong p-10 max-w-md w-full text-center animate-fade-in">
          <div className="text-5xl mb-4">😔</div>
          <h1 className="text-2xl font-bold mb-3">Generation Failed</h1>
          <p className="text-slate-400 mb-6">{error}</p>
          <button onClick={() => router.push('/goals')} className="btn-primary">Try Again</button>
        </div>
      </div>
    );
  }

  if (status === 'done') {
    const successful = modules.filter(m => m.status === 'completed').length;
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="glass-card-strong p-10 max-w-md w-full text-center animate-fade-in">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold mb-3">Your plan is ready!</h1>
          <p className="text-slate-400 mb-6">{successful} modules generated successfully.</p>
          <button onClick={() => router.push(`/dashboard/plan?planId=${planId}`)} className="btn-primary text-lg !px-8 !py-4">
            View My Plan →
          </button>
        </div>
      </div>
    );
  }

  const moduleKeys = Object.keys(MODULE_LABELS);

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-lg w-full">
        <div className="text-center mb-12">
          <div className="text-5xl mb-4 animate-bounce">🧠</div>
          <h1 className="text-3xl font-bold mb-3">Building your plan...</h1>
          <p className="text-slate-400">Our AI nutritionist is crafting your personalized plan. This may take a minute.</p>
        </div>

        <div className="glass-card-strong p-8 space-y-3">
          {moduleKeys.map((key, i) => {
            const mod = MODULE_LABELS[key];
            const isDone = i < currentModule;
            const isCurrent = i === currentModule;
            return (
              <div
                key={key}
                className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-500 ${
                  isDone ? 'opacity-100' : isCurrent ? 'opacity-100' : 'opacity-30'
                }`}
                style={isCurrent ? { background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)' } : {}}
              >
                <span className="text-xl">{mod.icon}</span>
                <span className="flex-1 text-sm font-medium">{mod.label}</span>
                {isDone && <span className="text-emerald-400 text-sm">✓</span>}
                {isCurrent && <div className="spinner" />}
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          Please don&apos;t close this page while your plan is being generated.
        </p>
      </div>
    </div>
  );
}

export default function GeneratingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="spinner" style={{ width: 40, height: 40 }} /></div>}>
      <GeneratingContent />
    </Suspense>
  );
}
