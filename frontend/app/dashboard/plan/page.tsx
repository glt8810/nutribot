'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';

const MODULE_META: Record<string, { icon: string; label: string; order: number }> = {
  calorie_calc: { icon: '🔢', label: 'Calorie Calculation', order: 1 },
  macros: { icon: '📊', label: 'Macro Targets', order: 2 },
  meal_plan: { icon: '🍽️', label: '7-Day Meal Plan', order: 3 },
  snack_swaps: { icon: '🍿', label: 'Snack Swaps', order: 4 },
  rules: { icon: '📋', label: 'Personal Rules', order: 5 },
  timeline: { icon: '📅', label: 'Timeline & Expectations', order: 6 },
  hydration: { icon: '💧', label: 'Hydration', order: 7 },
  supplements: { icon: '💊', label: 'Supplements', order: 8 },
  grocery_list: { icon: '🛒', label: 'Grocery List', order: 9 },
  progress_tracking: { icon: '📈', label: 'Progress Tracking', order: 10 },
};

function PlanContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const planId = searchParams.get('planId');
  const [plan, setPlan] = useState<any>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [activeTab, setActiveTab] = useState('');
  const [mealDay, setMealDay] = useState(0);
  const [checkedGroceries, setCheckedGroceries] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!authLoading && !user) router.push('/auth/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!planId || !user) return;
    apiFetch(`/plans/${planId}`).then(async r => {
      if (r.ok) {
        const data = await r.json();
        setPlan(data);
        if (data.modules?.length > 0) {
          const sorted = [...data.modules].sort((a: any, b: any) => (MODULE_META[a.moduleType]?.order || 99) - (MODULE_META[b.moduleType]?.order || 99));
          setActiveTab(sorted[0].moduleType);
        }
      }
      setLoadingPlan(false);
    }).catch(() => setLoadingPlan(false));
  }, [planId, user]);

  if (authLoading || !user || loadingPlan) return <div className="min-h-screen flex items-center justify-center"><div className="spinner" style={{ width: 40, height: 40 }} /></div>;
  if (!plan) return <div className="min-h-screen flex items-center justify-center"><div className="glass-card-strong p-10 text-center"><div className="text-5xl mb-4">❌</div><h1 className="text-xl font-bold">Plan not found</h1><Link href="/dashboard" className="btn-primary mt-4 inline-block">Dashboard</Link></div></div>;

  const modules = [...(plan.modules || [])].sort((a: any, b: any) => (MODULE_META[a.moduleType]?.order || 99) - (MODULE_META[b.moduleType]?.order || 99));
  const activeModule = modules.find((m: any) => m.moduleType === activeTab);
  const data = activeModule?.moduleData || {};

  function toggleGrocery(item: string) {
    setCheckedGroceries(prev => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item); else next.add(item);
      return next;
    });
  }

  function renderModuleContent() {
    if (!activeModule || data.error) {
      return <div className="p-8 text-center text-slate-400"><p>This module failed to generate. Try regenerating it.</p></div>;
    }

    switch (activeTab) {
      case 'calorie_calc':
        return (
          <div className="p-6 md:p-8 space-y-6">
            {data.disclaimer && <div className="banner banner-info">{data.disclaimer}</div>}
            <h3 className="text-xl font-bold">{data.title || 'Calorie Breakdown'}</h3>
            {data.stepByStep?.map((step: string, i: number) => (
              <div key={i} className="flex gap-3"><span className="text-emerald-400 font-bold">{i + 1}.</span><span className="text-slate-300">{step}</span></div>
            ))}
            {data.recommendation && <div className="glass-card p-4 border-l-4 border-emerald-500"><p className="text-sm">{data.recommendation}</p></div>}
            {data.adjustmentTips?.map((tip: string, i: number) => (
              <div key={i} className="flex items-start gap-2 text-sm"><span className="text-emerald-400">💡</span><span className="text-slate-300">{tip}</span></div>
            ))}
          </div>
        );

      case 'macros':
        return (
          <div className="p-6 md:p-8 space-y-6">
            <h3 className="text-xl font-bold">{data.title || 'Macro Targets'}</h3>
            <div className="grid grid-cols-3 gap-4">
              {[{ label: 'Protein', val: data.proteinExplanation, color: '#ef4444' }, { label: 'Carbs', val: data.carbsExplanation, color: '#3b82f6' }, { label: 'Fat', val: data.fatExplanation, color: '#f59e0b' }].map(m => (
                <div key={m.label} className="glass-card p-4 text-center">
                  <div className="text-lg font-bold" style={{ color: m.color }}>{m.label}</div>
                  <p className="text-xs text-slate-400 mt-2">{m.val}</p>
                </div>
              ))}
            </div>
            {data.practicalTips?.map((tip: string, i: number) => (
              <div key={i} className="flex gap-2 text-sm"><span className="text-emerald-400">✅</span><span>{tip}</span></div>
            ))}
          </div>
        );

      case 'meal_plan':
        const days = data.days || [];
        const day = days[mealDay] || {};
        return (
          <div className="p-6 md:p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">🍽️ {day.theme || `Day ${mealDay + 1}`}</h3>
            </div>
            <div className="flex gap-2 mb-6 overflow-x-auto">
              {days.map((_: any, i: number) => (
                <button key={i} onClick={() => setMealDay(i)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${i === mealDay ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
                  style={{ border: `1px solid ${i === mealDay ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.1)'}` }}>
                  Day {i + 1}
                </button>
              ))}
            </div>
            {['breakfast', 'lunch', 'dinner', 'snack'].map(mealType => {
              const meal = day[mealType];
              if (!meal) return null;
              return (
                <div key={mealType} className="glass-card p-5 mb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">{mealType}</span>
                      <h4 className="text-lg font-semibold mt-1">{meal.name || mealType}</h4>
                      {meal.description && <p className="text-sm text-slate-400 mt-1">{meal.description}</p>}
                      {meal.prepTime && <span className="text-xs text-slate-500">⏱ {meal.prepTime}</span>}
                      {(meal.calories || meal.protein) && (
                        <div className="flex gap-3 mt-2 text-xs">
                          {meal.calories && <span className="text-slate-300">{meal.calories} kcal</span>}
                          {meal.protein && <span className="text-red-400">{meal.protein}g protein</span>}
                          {meal.carbs && <span className="text-blue-400">{meal.carbs}g carbs</span>}
                          {meal.fat && <span className="text-yellow-400">{meal.fat}g fat</span>}
                        </div>
                      )}
                      {meal.portionGuide && <p className="text-xs text-emerald-400 mt-2">📏 {meal.portionGuide}</p>}
                      {meal.tags?.length > 0 && (
                        <div className="flex gap-1 mt-2">{meal.tags.map((t: string) => <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-slate-400">{t}</span>)}</div>
                      )}
                    </div>
                  </div>
                  {meal.ingredients && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-slate-400 mb-1">Ingredients:</p>
                      <p className="text-xs text-slate-300">{Array.isArray(meal.ingredients) ? meal.ingredients.join(', ') : meal.ingredients}</p>
                    </div>
                  )}
                  {meal.instructions && (
                    <div className="mt-2">
                      <p className="text-xs font-semibold text-slate-400 mb-1">Instructions:</p>
                      <p className="text-xs text-slate-300">{meal.instructions}</p>
                    </div>
                  )}
                </div>
              );
            })}
            {day.dailyTotals && (
              <div className="glass-card p-4 mt-4 border-t-2 border-emerald-500/30">
                <div className="flex justify-around text-center text-sm">
                  <div><div className="font-bold text-emerald-400">{day.dailyTotals.calories}</div><div className="text-xs text-slate-500">kcal</div></div>
                  <div><div className="font-bold text-red-400">{day.dailyTotals.protein}g</div><div className="text-xs text-slate-500">protein</div></div>
                  <div><div className="font-bold text-blue-400">{day.dailyTotals.carbs}g</div><div className="text-xs text-slate-500">carbs</div></div>
                  <div><div className="font-bold text-yellow-400">{day.dailyTotals.fat}g</div><div className="text-xs text-slate-500">fat</div></div>
                </div>
              </div>
            )}
          </div>
        );

      case 'snack_swaps':
        return (
          <div className="p-6 md:p-8 space-y-4">
            <h3 className="text-xl font-bold">{data.title || 'Snack Swaps'}</h3>
            {data.items?.map((item: any, i: number) => (
              <div key={i} className="glass-card p-5">
                {item.current ? (
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <p className="text-sm text-slate-400 line-through">{item.current} {item.currentCalories && `(${item.currentCalories} kcal)`}</p>
                      <p className="text-base font-semibold text-emerald-400">→ {item.swap} {item.swapCalories && `(${item.swapCalories} kcal)`}</p>
                      <p className="text-xs text-slate-400 mt-1">{item.why}</p>
                    </div>
                    <span className="text-2xl">{item.craving === 'sweet' ? '🍬' : item.craving === 'salty' ? '🧂' : '🍿'}</span>
                  </div>
                ) : (
                  <div>
                    <span className="text-xs font-semibold uppercase text-emerald-400">{item.category}</span>
                    <p className="font-semibold mt-1">{item.name}</p>
                    <p className="text-sm text-slate-400 mt-1">{item.description || item.why}</p>
                  </div>
                )}
              </div>
            ))}
            {data.bonusTip && <div className="glass-card p-4 border-l-4 border-emerald-500"><p className="text-sm">💡 {data.bonusTip}</p></div>}
          </div>
        );

      case 'rules':
        return (
          <div className="p-6 md:p-8 space-y-4">
            <h3 className="text-xl font-bold">{data.title || 'Your Personal Rules'}</h3>
            {data.rules?.map((rule: any, i: number) => (
              <div key={i} className="glass-card p-5">
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold bg-emerald-500/15 text-emerald-400">{rule.number || i + 1}</span>
                  <div>
                    <h4 className="font-semibold">{rule.rule}</h4>
                    <p className="text-sm text-slate-400 mt-1">{rule.why}</p>
                    {rule.howTo && <p className="text-sm text-emerald-400 mt-2">→ {rule.howTo}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        );

      case 'timeline':
        return (
          <div className="p-6 md:p-8 space-y-4">
            <h3 className="text-xl font-bold">{data.title || 'What to Expect'}</h3>
            {data.milestones?.map((m: any, i: number) => (
              <div key={i} className="glass-card p-5 border-l-4" style={{ borderLeftColor: `hsl(${160 + i * 15}, 70%, 50%)` }}>
                <span className="text-xs font-semibold uppercase text-emerald-400">{m.timeframe}</span>
                <h4 className="font-semibold mt-1">{m.title}</h4>
                <p className="text-sm text-slate-400 mt-1">{m.description}</p>
                {m.encouragement && <p className="text-sm text-emerald-400 mt-2 italic">{m.encouragement}</p>}
              </div>
            ))}
            {data.importantNote && <div className="banner banner-info">{data.importantNote}</div>}
          </div>
        );

      case 'hydration':
        return (
          <div className="p-6 md:p-8 space-y-6">
            <h3 className="text-xl font-bold">{data.title || 'Hydration'}</h3>
            <div className="glass-card p-6 text-center">
              <div className="text-5xl mb-2">💧</div>
              <div className="text-4xl font-bold text-blue-400">{data.dailyTarget?.litres}L</div>
              <div className="text-sm text-slate-400">({data.dailyTarget?.oz} oz) per day</div>
            </div>
            {data.breakdown && <p className="text-sm text-slate-300">{data.breakdown}</p>}
            {data.tips?.map((tip: string, i: number) => (
              <div key={i} className="flex gap-2 text-sm"><span className="text-blue-400">💧</span><span>{tip}</span></div>
            ))}
            {data.whyItMatters && <div className="glass-card p-4 border-l-4 border-blue-500"><p className="text-sm">{data.whyItMatters}</p></div>}
          </div>
        );

      case 'supplements':
        return (
          <div className="p-6 md:p-8 space-y-4">
            <h3 className="text-xl font-bold">{data.title || 'Supplements'}</h3>
            {data.recommendations?.map((s: any, i: number) => (
              <div key={i} className="glass-card p-5">
                <h4 className="font-semibold text-emerald-400">{s.name}</h4>
                <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                  <div><span className="text-slate-500">Dose:</span> {s.dose}</div>
                  <div><span className="text-slate-500">When:</span> {s.timing}</div>
                </div>
                <p className="text-sm text-slate-300 mt-2">{s.why}</p>
                {s.budgetTip && <p className="text-xs text-emerald-400 mt-1">💰 {s.budgetTip}</p>}
              </div>
            ))}
            {data.closingNote && <div className="banner banner-info">💊 {data.closingNote}</div>}
          </div>
        );

      case 'grocery_list':
        return (
          <div className="p-6 md:p-8 space-y-4">
            <h3 className="text-xl font-bold">{data.title || 'Grocery List'}</h3>
            {data.sections?.map((section: any, si: number) => (
              <div key={si}>
                <h4 className="font-semibold text-slate-300 text-sm uppercase tracking-wide mb-2">{section.name}</h4>
                <div className="space-y-1 mb-4">
                  {section.items?.map((item: any, ii: number) => {
                    const key = `${si}-${ii}`;
                    const checked = checkedGroceries.has(key);
                    return (
                      <button key={key} onClick={() => toggleGrocery(key)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${checked ? 'opacity-40' : 'hover:bg-white/5'}`}
                        style={{ background: checked ? 'rgba(16,185,129,0.05)' : 'transparent' }}>
                        <div className={`checkbox-custom ${checked ? 'checked' : ''}`}>
                          {checked && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                        </div>
                        <span className={`flex-1 text-sm ${checked ? 'line-through' : ''}`}>{item.item}</span>
                        <span className="text-xs text-slate-500">{item.quantity}</span>
                        {item.isPantryStaple && <span className="text-xs text-amber-400">pantry</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {data.savingTips?.map((tip: string, i: number) => (
              <div key={i} className="flex gap-2 text-sm"><span className="text-emerald-400">💰</span><span>{tip}</span></div>
            ))}
          </div>
        );

      case 'progress_tracking':
        return (
          <div className="p-6 md:p-8 space-y-4">
            <h3 className="text-xl font-bold">{data.title || 'Progress Tracking'}</h3>
            {data.methods?.map((m: any, i: number) => (
              <div key={i} className="glass-card p-5">
                <h4 className="font-semibold text-emerald-400">{m.method}</h4>
                <p className="text-sm text-slate-400 mt-1">📆 {m.frequency}</p>
                <p className="text-sm text-slate-300 mt-2">{m.howTo}</p>
                {m.whyItWorks && <p className="text-xs text-slate-400 mt-1 italic">{m.whyItWorks}</p>}
              </div>
            ))}
            {data.mindsetNote && <div className="glass-card p-4 border-l-4 border-emerald-500"><p className="text-sm italic">{data.mindsetNote}</p></div>}
          </div>
        );

      default:
        return <div className="p-8"><pre className="text-xs text-slate-400 overflow-x-auto">{JSON.stringify(data, null, 2)}</pre></div>;
    }
  }

  return (
    <div className="min-h-screen">
      <nav className="border-b px-6 py-4" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/dashboard" className="btn-ghost text-sm">← Dashboard</Link>
          <div className="flex items-center space-x-2">
            <span className="text-xl">🥗</span>
            <span className="font-bold gradient-text">NutriBot</span>
          </div>
          <div className="text-sm text-slate-400">
            {plan.isActive && <span className="text-emerald-400">● Active Plan</span>}
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar tabs */}
          <div className="lg:w-64 flex-shrink-0">
            <div className="glass-card-strong p-3 lg:sticky lg:top-20">
              <div className="flex lg:flex-col gap-1 overflow-x-auto">
                {modules.map((m: any) => {
                  const meta = MODULE_META[m.moduleType] || { icon: '📄', label: m.moduleType };
                  const isActive = activeTab === m.moduleType;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setActiveTab(m.moduleType)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all w-full text-left ${isActive ? 'tab-active' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                    >
                      <span>{meta.icon}</span>
                      <span className="hidden lg:inline">{meta.label}</span>
                      {m.moduleData?.error && <span className="text-red-400 text-xs">⚠</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1">
            <div className="glass-card-strong overflow-hidden">
              <div className="border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                <h2 className="text-lg font-bold">
                  {MODULE_META[activeTab]?.icon} {MODULE_META[activeTab]?.label || activeTab}
                </h2>
              </div>
              {renderModuleContent()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PlanPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="spinner" style={{ width: 40, height: 40 }} /></div>}>
      <PlanContent />
    </Suspense>
  );
}
