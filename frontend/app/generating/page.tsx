'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
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

function formatSeconds(ms: number) {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

interface ModuleEstimate {
  avgMs: number;
  sampleCount: number;
}

interface ActiveModule {
  moduleType: string;
  startedAt: string; // ISO string
}

interface CompletedModule {
  id: string;
  moduleType: string;
  generationMs: number | null;
}

function GeneratingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const goalId = searchParams.get('goalId');

  const [status, setStatus] = useState<'generating' | 'done' | 'error'>('generating');
  const [completedModules, setCompletedModules] = useState<CompletedModule[]>([]);
  const [activeModule, setActiveModule] = useState<ActiveModule | null>(null);
  const [expectedModuleTypes, setExpectedModuleTypes] = useState<string[]>([]);
  const [totalModules, setTotalModules] = useState(10);
  const [moduleEstimates, setModuleEstimates] = useState<Record<string, ModuleEstimate>>({});
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState('');
  const [planId, setPlanId] = useState('');

  // Tick elapsed time for the active module every second
  useEffect(() => {
    if (!activeModule) { setElapsedMs(0); return; }
    const startTime = new Date(activeModule.startedAt).getTime();
    setElapsedMs(Date.now() - startTime);
    const interval = setInterval(() => setElapsedMs(Date.now() - startTime), 1000);
    return () => clearInterval(interval);
  }, [activeModule?.moduleType, activeModule?.startedAt]);

  useEffect(() => {
    if (!authLoading && !user) router.push('/auth/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!goalId || !user) return;
    let mounted = true;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    async function startGeneration() {
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
        pollStatus(data.planId);
      } catch {
        if (!mounted) return;
        setError('Something went wrong during plan generation.');
        setStatus('error');
      }
    }

    async function pollStatus(id: string) {
      if (!mounted) return;
      try {
        const res = await apiFetch(`/plans/${id}/status`);
        if (!mounted) return;
        if (!res.ok) { setError('Failed to check plan status.'); setStatus('error'); return; }
        const data = await res.json();

        setCompletedModules(data.completedModules || []);
        setActiveModule(data.activeModule || null);
        if (data.expectedModuleTypes?.length) setExpectedModuleTypes(data.expectedModuleTypes);
        if (data.totalModules) setTotalModules(data.totalModules);
        if (data.moduleEstimates) setModuleEstimates(data.moduleEstimates);

        if (data.status === 'complete') {
          setStatus('done');
        } else if (data.status === 'failed') {
          setError('Plan generation failed. Please try again.');
          setStatus('error');
        } else {
          pollTimer = setTimeout(() => pollStatus(id), 2000);
        }
      } catch {
        if (!mounted) return;
        pollTimer = setTimeout(() => pollStatus(id), 5000);
      }
    }

    startGeneration();
    return () => { mounted = false; if (pollTimer) clearTimeout(pollTimer); };
  }, [goalId, user]);

  if (authLoading || !user) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="spinner" style={{ width: 40, height: 40 }} />
    </div>
  );

  if (status === 'error') return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="glass-card-strong p-10 max-w-md w-full text-center animate-fade-in">
        <div className="text-5xl mb-4">😔</div>
        <h1 className="text-2xl font-bold mb-3">Generation Failed</h1>
        <p className="text-slate-400 mb-6">{error}</p>
        <button onClick={() => router.push('/goals')} className="btn-primary">Try Again</button>
      </div>
    </div>
  );

  if (status === 'done') return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="glass-card-strong p-10 max-w-md w-full text-center animate-fade-in">
        <div className="text-5xl mb-4">🎉</div>
        <h1 className="text-2xl font-bold mb-3">Your plan is ready!</h1>
        <p className="text-slate-400 mb-6">{completedModules.length} modules generated successfully.</p>
        <button onClick={() => router.push(`/dashboard/plan?planId=${planId}`)} className="btn-primary text-lg !px-8 !py-4">
          View My Plan →
        </button>
      </div>
    </div>
  );

  const completedSet = new Set(completedModules.map(m => m.moduleType));
  const completedMap = Object.fromEntries(completedModules.map(m => [m.moduleType, m]));
  const moduleKeys = expectedModuleTypes.length > 0 ? expectedModuleTypes : Object.keys(MODULE_LABELS);
  const completedCount = completedModules.length;
  const overallPct = totalModules > 0 ? Math.round((completedCount / totalModules) * 100) : 0;

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4 animate-bounce">🧠</div>
          <h1 className="text-3xl font-bold mb-3">Building your plan...</h1>
          <p className="text-slate-400">Our AI nutritionist is crafting your personalized plan. This may take a minute.</p>
        </div>

        {/* Overall progress bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-400">{completedCount} of {totalModules} modules</span>
            <span className="text-emerald-400 font-semibold">{overallPct}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-700 ease-out"
              style={{ width: `${overallPct}%` }}
            />
          </div>
        </div>

        <div className="glass-card-strong p-6 space-y-2">
          {moduleKeys.map((key) => {
            const mod = MODULE_LABELS[key];
            if (!mod) return null;
            const isDone = completedSet.has(key);
            const isActive = activeModule?.moduleType === key;
            const isPending = !isDone && !isActive;
            const completed = completedMap[key];
            const estimate = moduleEstimates[key];

            // Per-module progress bar for the active module
            let activeBarPct = 0;
            if (isActive && estimate) {
              activeBarPct = Math.min(95, Math.round((elapsedMs / estimate.avgMs) * 100));
            }

            return (
              <div
                key={key}
                className={`rounded-xl transition-all duration-500 ${isPending ? 'opacity-30' : 'opacity-100'}`}
              >
                <div
                  className="flex items-center gap-3 p-3"
                  style={isActive ? { background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '0.75rem 0.75rem 0 0' } : { borderRadius: '0.75rem' }}
                >
                  <span className="text-xl">{mod.icon}</span>
                  <span className="flex-1 text-sm font-medium">{mod.label}</span>

                  {isDone && completed?.generationMs != null && (
                    <span className="text-slate-500 text-xs">{formatSeconds(completed.generationMs)}</span>
                  )}
                  {isDone && <span className="text-emerald-400 text-sm ml-1">✓</span>}

                  {isActive && (
                    <span className="text-emerald-400 text-xs">
                      {formatSeconds(elapsedMs)}
                      {estimate ? ` / ~${formatSeconds(estimate.avgMs)}` : ''}
                    </span>
                  )}
                  {isActive && <div className="spinner ml-1" />}

                  {isPending && estimate && (
                    <span className="text-slate-500 text-xs">~{formatSeconds(estimate.avgMs)}</span>
                  )}
                </div>

                {/* Per-module progress bar shown only while active */}
                {isActive && (
                  <div className="h-1 rounded-b-xl bg-slate-700 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-1000 ease-linear"
                      style={{ width: `${activeBarPct}%` }}
                    />
                  </div>
                )}
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
