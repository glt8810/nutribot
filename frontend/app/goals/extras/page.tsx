'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';

function ExtrasContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  const goalId = searchParams.get('goalId');
  const goalType = searchParams.get('goalType') || '';
  
  const [extras, setExtras] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.push('/auth/login');
    if (!goalId) router.push('/profiles');
  }, [user, authLoading, router, goalId]);

  function updateField(field: string, value: any) {
    setExtras(prev => ({ ...prev, [field]: value }));
  }

  async function handleNext() {
    if (!goalId) return;
    setSaving(true);
    setError('');

    try {
      const res = await apiFetch(`/goals/${goalId}/extras`, {
        method: 'POST',
        body: JSON.stringify({ extras }),
      });
      if (res.ok) {
        router.push(`/generating?goalId=${goalId}&goalType=${goalType}`);
      } else {
        const d = await res.json();
        setError(d.error || 'Failed to save information.');
      }
    } catch {
      setError('Something went wrong.');
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || !user) return <div className="min-h-screen flex items-center justify-center"><div className="spinner" style={{ width: 40, height: 40 }}/></div>;

  function renderField(label: string, field: string, type: string = 'text', options?: { placeholder?: string; min?: number; max?: number; choices?: string[]; multiline?: boolean }) {
    const val = extras[field] || '';
    if (options?.choices) {
      return (
        <div key={field} className="mb-5">
          <label className="input-label">{label}</label>
          <div className="flex flex-wrap gap-2">
            {options.choices.map(c => (
              <button key={c} type="button" onClick={() => updateField(field, c)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${val === c ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'}`}
                style={{ border: `1px solid ${val === c ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.1)'}` }}>
                {c}
              </button>
            ))}
          </div>
        </div>
      );
    }
    if (options?.multiline) {
      return (
        <div key={field} className="mb-5">
          <label className="input-label">{label}</label>
          <textarea className="input-field min-h-[80px] resize-y" placeholder={options?.placeholder || ''} value={val}
            onChange={e => updateField(field, e.target.value)} />
        </div>
      );
    }
    return (
      <div key={field} className="mb-5">
        <label className="input-label">{label}</label>
        <input type={type} className="input-field" placeholder={options?.placeholder || ''} value={val}
          min={options?.min} max={options?.max}
          onChange={e => updateField(field, type === 'number' ? Number(e.target.value) : e.target.value)} />
      </div>
    );
  }

  function renderGoalSpecificExtras() {
    switch (goalType) {
      case 'pregnancy':
        return (
          <>
            {renderField('Current Trimester / Postpartum Week', 'trimester', 'text', { choices: ['1st trimester', '2nd trimester', '3rd trimester', 'Postpartum'] })}
            {renderField('Are you breastfeeding?', 'breastfeeding', 'text', { choices: ['Yes', 'No'] })}
            {renderField('Food aversions or nausea triggers?', 'aversions', 'text', { placeholder: 'e.g. "can\'t stand the smell of fish"', multiline: true })}
          </>
        );
      case 'medical':
        return (
          <>
            {renderField('Which condition(s)?', 'conditions', 'text', { placeholder: 'e.g. Type 2 diabetes, PCOS, IBS', multiline: true })}
            {renderField('Medications affecting appetite/weight/absorption?', 'medications', 'text', { placeholder: 'List any relevant medications', multiline: true })}
            {renderField('Are you working with a doctor?', 'workingWithDoctor', 'text', { choices: ['Yes', 'No', 'Planning to'] })}
            <div className="banner banner-warning mb-5">⚠️ This app does not replace medical advice. Always consult your healthcare provider.</div>
          </>
        );
      case 'sports':
        return (
          <>
            {renderField('Sport / Discipline', 'sport', 'text', { placeholder: 'e.g. Marathon running, CrossFit, Boxing' })}
            {renderField('Competition Schedule', 'competitionSchedule', 'text', { choices: ['Offseason', 'Pre-competition', 'In-season', 'Peaking'] })}
            {renderField('Training Volume', 'trainingVolume', 'text', { placeholder: 'e.g. "10 hours/week, 5 sessions"' })}
          </>
        );
      case 'family':
        return (
          <>
            {renderField('Household Size & Ages', 'householdSize', 'text', { placeholder: 'e.g. "2 adults, 1 teenager (15), 1 child (7)"' })}
            {renderField('Who does the cooking?', 'whoCooks', 'text', { placeholder: 'e.g. "Mostly me", "We share"' })}
            {renderField('Weekly Grocery Budget', 'groceryBudget', 'text', { choices: ['Under $75', '$75-$125', '$125-$200', '$200+', 'Flexible'] })}
            {renderField('Biggest Meal Planning Pain Point', 'painPoint', 'text', { choices: ['Picky eaters', 'Time', 'Cost', 'Variety', 'Healthy options kids will eat'] })}
          </>
        );
      case 'plant_based':
        return (
          <>
            {renderField('Current Level', 'currentLevel', 'text', { choices: ['Omnivore', 'Flexitarian', 'Pescatarian', 'Vegetarian', 'Mostly vegan'] })}
            {renderField('Target Level', 'targetLevel', 'text', { choices: ['Flexitarian', 'Vegetarian', 'Vegan', 'Not sure yet'] })}
            {renderField('Plant-Based Foods You Already Enjoy', 'plantFoodsLiked', 'text', { multiline: true, placeholder: 'e.g. Chickpeas, tofu, lentils, avocado' })}
            {renderField('Animal Products Hardest to Give Up?', 'hardestToGiveUp', 'text', { multiline: true, placeholder: 'e.g. Cheese, eggs, steak' })}
          </>
        );
      case 'gut_health':
        return (
          <>
            {renderField('Current Digestive Symptoms', 'digestiveSymptoms', 'text', { multiline: true, placeholder: 'e.g. Bloating after meals, irregular bowel movements' })}
            {renderField('Known Trigger Foods', 'triggerFoods', 'text', { multiline: true, placeholder: 'e.g. Garlic, onion, dairy, spicy food' })}
            {renderField('Tested for Intolerances?', 'intoleranceTested', 'text', { choices: ['Yes', 'No', 'Planning to'] })}
            {renderField('Current Probiotic/Prebiotic Use?', 'probioticUse', 'text', { multiline: true, placeholder: 'e.g. "Daily probiotic capsule" or "None"' })}
          </>
        );
      case 'ed_recovery':
        return (
          <div className="banner banner-warning mb-5">
            ⚠️ This platform provides generic meal structuring and does not replace working with a registered dietitian or therapist. Focus on what feels good today.
          </div>
        );
      default:
        return (
          <div className="text-center text-slate-400 py-8">
            <p>No additional details needed for this goal!</p>
          </div>
        );
    }
  }

  const hasContent = !['fat_loss', 'muscle_gain', 'recomp', 'general_health', 'energy'].includes(goalType);

  return (
    <div className="min-h-screen py-12 px-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => router.push('/goals')} className="btn-ghost text-sm">← Back to Goals</button>
            <span className="text-sm text-slate-400">Final Step</span>
          </div>
        </div>

        <div className="glass-card-strong p-8 animate-fade-in">
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-1">
              ✨ Almost there...
            </h2>
            <p className="text-slate-400">
              {hasContent ? 'Just a few more details to hyper-personalize this plan to your chosen goal.' : 'You are all set to generate your plan!'}
            </p>
          </div>

          {error && <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}

          {renderGoalSpecificExtras()}

          <div className="flex justify-end mt-8">
            <button onClick={handleNext} disabled={saving} className="btn-primary !px-8 text-lg py-4 w-full">
              {saving ? <span className="spinner"/> : 'Generate My Plan 🚀'}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          Your data is encrypted before storage.
        </p>
      </div>
    </div>
  );
}

export default function ExtrasPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="spinner" style={{ width: 40, height: 40 }} /></div>}>
      <ExtrasContent />
    </Suspense>
  );
}
