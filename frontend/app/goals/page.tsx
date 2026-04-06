'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';

const GOALS = [
  { id: 'fat_loss', emoji: '🔥', title: 'Fat Loss', desc: 'Lose body fat while preserving muscle, without miserable restriction' },
  { id: 'muscle_gain', emoji: '💪', title: 'Muscle Gain / Bulking', desc: 'Build lean mass with a structured caloric surplus and high-protein plan' },
  { id: 'recomp', emoji: '⚡', title: 'Body Recomposition', desc: 'Lose fat and build muscle simultaneously — eat at or near maintenance with optimized macros' },
  { id: 'sports', emoji: '🏃', title: 'Sports & Athletic Performance', desc: 'Fuel training, optimize recovery, and peak for competition' },
  { id: 'general_health', emoji: '💚', title: 'General Health & Longevity', desc: 'Eat for energy, disease prevention, gut health, and long-term wellbeing' },
  { id: 'medical', emoji: '🏥', title: 'Medical / Condition-Specific', desc: 'Nutrition strategies for managing conditions like diabetes, PCOS, IBS, and more' },
  { id: 'pregnancy', emoji: '🤰', title: 'Pregnancy & Postpartum', desc: 'Nourish yourself and baby through each trimester and into recovery' },
  { id: 'plant_based', emoji: '🌱', title: 'Plant-Based Transition', desc: 'Move toward vegetarian, vegan, or flexitarian eating without nutrient gaps' },
  { id: 'gut_health', emoji: '🧬', title: 'Gut Health & Digestion', desc: 'Improve digestion, reduce bloating, support microbiome diversity' },
  { id: 'energy', emoji: '⚡', title: 'Energy & Mental Performance', desc: 'Optimize nutrition for sustained energy, focus, productivity, and mood stability' },
  { id: 'family', emoji: '👨‍👩‍👧‍👦', title: 'Family & Household Nutrition', desc: 'Practical, budget-friendly meal plans that work for the whole family' },
  { id: 'ed_recovery', emoji: '💜', title: 'Eating Disorder Recovery Support', desc: 'Gentle, non-restrictive guidance focused on rebuilding a healthy relationship with food' },
];

export default function GoalsPage() {
  const { user, loading } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const profileId = searchParams.get('profileId');
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login');
    if (!profileId) router.push('/profiles');
  }, [user, loading, router, profileId]);

  async function handleContinue() {
    if (!selected || !profileId) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await apiFetch('/goals', {
        method: 'POST',
        body: JSON.stringify({ goalType: selected, profileId }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/goals/extras?goalId=${data.id}&goalType=${selected}`);
      } else {
        const d = await res.json();
        setError(d.error || 'Failed to create goal');
      }
    } catch {
      setError('Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user) return <div className="min-h-screen flex items-center justify-center"><div className="spinner" style={{ width: 40, height: 40 }} /></div>;

  return (
    <div className="min-h-screen py-12 px-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/profiles" className="btn-ghost text-sm">← Profiles</Link>
          <div className="flex items-center space-x-2">
            <span className="text-xl">🥗</span>
            <span className="font-bold gradient-text">NutriBot</span>
          </div>
        </div>

        {!user.emailVerified && (
          <div className="banner banner-warning mb-6">
            📧 Please verify your email to unlock plan generation. Check your inbox!
          </div>
        )}

        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">What&apos;s your nutrition goal?</h1>
          <p className="text-slate-400 text-lg">Pick the one that matters most to you right now. You can always create plans for other goals later.</p>
        </div>

        {error && <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">{error}</div>}

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
          {GOALS.map((g, i) => (
            <button
              key={g.id}
              onClick={() => setSelected(g.id)}
              className={`goal-card text-left ${selected === g.id ? 'selected' : ''}`}
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <div className="text-3xl mb-3">{g.emoji}</div>
              <h3 className="text-lg font-semibold mb-1">{g.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{g.desc}</p>
              {g.id === 'ed_recovery' && (
                <p className="text-xs text-amber-400 mt-2">⚠️ This does not replace working with a therapist or specialist.</p>
              )}
              {selected === g.id && (
                <div className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'var(--emerald-500)' }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7L6 10L11 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
              )}
            </button>
          ))}
        </div>

        <div className="text-center">
          <button
            onClick={handleContinue}
            disabled={!selected || submitting}
            className="btn-primary text-lg !px-12 !py-4"
          >
            {submitting ? <span className="spinner" /> : 'Continue to Details →'}
          </button>
        </div>
      </div>
    </div>
  );
}
