'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';

const SECTION_TITLES = [
  { key: 'my_stats', title: 'My Stats', icon: '📊', desc: 'Basic info about you' },
  { key: 'my_lifestyle', title: 'My Lifestyle', icon: '🏃', desc: 'How you live and move' },
  { key: 'my_food_prefs', title: 'My Food Preferences', icon: '🍽️', desc: 'What you love (and hate) to eat' },
  { key: 'my_snack_habits', title: 'My Snack & Eating Habits', icon: '🍿', desc: 'Your current eating patterns' },
];

function IntakeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const profileId = searchParams.get('profileId');
  const [currentSection, setCurrentSection] = useState(0);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.push('/auth/login');
    if (!profileId) router.push('/profiles');
  }, [user, authLoading, router, profileId]);

  // Load existing responses
  useEffect(() => {
    if (!profileId || !user) return;
    apiFetch(`/profiles/${profileId}/intake`).then(async r => {
      if (r.ok) {
        const data = await r.json();
        const loaded: Record<string, any> = {};
        for (const s of data.sections) {
          loaded[s.section] = s.responses;
        }
        setResponses(loaded);
        // Jump to first incomplete section
        const idx = SECTION_TITLES.findIndex(st => !data.completedSections.includes(st.key));
        if (idx >= 0) setCurrentSection(idx);
        else if (data.isComplete) setCurrentSection(3); // All done
      }
    });
  }, [profileId, user]);

  function updateField(section: string, field: string, value: any) {
    setResponses(prev => ({
      ...prev,
      [section]: { ...(prev[section] || {}), [field]: value },
    }));
  }

  async function saveSection(sectionKey: string) {
    if (!profileId) return;
    setSaving(true); setError('');
    try {
      const res = await apiFetch(`/profiles/${profileId}/intake`, {
        method: 'POST',
        body: JSON.stringify({ section: sectionKey, responses: responses[sectionKey] || {} }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || 'Failed to save');
        return false;
      }
      return true;
    } catch {
      setError('Failed to save. Please try again.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleNext() {
    const sectionKey = SECTION_TITLES[currentSection].key;
    const saved = await saveSection(sectionKey);
    if (saved) {
      if (currentSection < 3) {
        setCurrentSection(currentSection + 1);
      } else {
        // All complete — return to profiles
        router.push(`/profiles`);
      }
    }
  }

  function handleBack() {
    if (currentSection > 0) setCurrentSection(currentSection - 1);
  }

  if (authLoading || !user) return <div className="min-h-screen flex items-center justify-center"><div className="spinner" style={{ width: 40, height: 40 }} /></div>;

  const sectionKey = SECTION_TITLES[currentSection].key;
  const sectionData = responses[sectionKey] || {};

  function renderField(label: string, field: string, type: string = 'text', options?: { placeholder?: string; min?: number; max?: number; choices?: string[]; multiline?: boolean }) {
    const val = sectionData[field] || '';

    if (options?.choices) {
      return (
        <div key={field} className="mb-5">
          <label className="input-label">{label}</label>
          <div className="flex flex-wrap gap-2">
            {options.choices.map(c => (
              <button key={c} type="button" onClick={() => updateField(sectionKey, field, c)}
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
            onChange={e => updateField(sectionKey, field, e.target.value)} />
        </div>
      );
    }

    return (
      <div key={field} className="mb-5">
        <label className="input-label">{label}</label>
        <input type={type} className="input-field" placeholder={options?.placeholder || ''} value={val}
          min={options?.min} max={options?.max}
          onChange={e => updateField(sectionKey, field, type === 'number' ? Number(e.target.value) : e.target.value)} />
      </div>
    );
  }

  function renderSection() {
    switch (sectionKey) {
      case 'my_stats':
        return (
          <>
            {renderField('Age', 'age', 'number', { placeholder: 'Your age', min: 13, max: 120 })}
            {renderField('Biological Sex', 'biologicalSex', 'text', { choices: ['male', 'female'] })}
            {renderField('Height (cm)', 'heightCm', 'number', { placeholder: 'e.g. 175', min: 100, max: 250 })}
            {renderField('Current Weight (kg)', 'weightKg', 'number', { placeholder: 'e.g. 80', min: 30, max: 300 })}
            {renderField('Goal Target or Feeling', 'goalTarget', 'text', { placeholder: 'e.g. "Feel healthier" or "Have more energy"', multiline: false })}
            {renderField('Preferred Plan Language', 'language', 'text', { choices: ['English', 'Português', 'Español', 'Français', 'Deutsch'] })}
            {renderField('Timeline Preference', 'timeline', 'text', { choices: ['Steady & sustainable', 'Moderately aggressive', 'No rush'] })}
          </>
        );

      case 'my_lifestyle':
        return (
          <>
            {renderField('Job Type', 'jobType', 'text', { choices: ['Desk job', 'On my feet', 'Manual labour', 'Hybrid', 'Stay-at-home parent', 'Student', 'Retired'] })}
            {renderField('Exercise Frequency & Type', 'exerciseFrequency', 'text', { placeholder: 'e.g. "3x/week strength training + 1 run" or "I don\'t exercise"', multiline: true })}
            {renderField('Hours of Exercise Per Week', 'hoursExercisePerWeek', 'number', { placeholder: '0', min: 0, max: 40 })}
            {renderField('Typical Sleep (hours/night)', 'sleepHours', 'number', { placeholder: '7', min: 2, max: 14 })}
            {renderField('Current Stress Levels', 'stressLevel', 'text', { choices: ['Low', 'Moderate', 'High', 'Extreme'] })}
            {renderField('Alcohol Consumption', 'alcohol', 'text', { choices: ['None', 'Rarely (1-2/month)', 'Moderate (3-7/week)', 'Heavy (8+/week)'] })}
            {renderField('Smoking / Nicotine Use', 'smoking', 'text', { choices: ['No', 'Occasionally', 'Yes, daily'] })}
          </>
        );

      case 'my_food_prefs':
        return (
          <>
            {renderField('Primary Regional Cuisine Focus', 'regionalCuisine', 'text', { choices: ['Global / Mixed', 'Brazilian', 'Mediterranean', 'Mexican', 'Asian', 'American'] })}
            {renderField('Specific Regional Dishes to Include', 'regionalDishes', 'text', { placeholder: 'e.g., traditional rice and beans, or specific dishes from Minas Gerais', multiline: true })}
            {renderField('Top 5 Favourite Meals or Dishes', 'favoriteMeals', 'text', { placeholder: 'e.g. Chicken tikka masala, tacos, pasta carbonara', multiline: true })}
            {renderField('Foods You HATE and Would Never Eat', 'hatedFoods', 'text', { placeholder: 'e.g. Olives, liver, blue cheese', multiline: true })}
            {renderField('Dietary Restrictions / Allergies', 'restrictions', 'text', { placeholder: 'e.g. Dairy-free, nut allergy, halal, vegetarian — or "none"', multiline: true })}
            {renderField('Cooking Style', 'cookingStyle', 'text', { choices: ['From scratch', 'Quick meals (<20 min)', 'Meal prepping', 'Mostly eat out / order in'] })}
            {renderField('Food Adventurousness (1–10)', 'adventurousness', 'number', { placeholder: '1 = very picky, 10 = will try anything', min: 1, max: 10 })}
            {renderField('Cultural / Traditional Foods to Include?', 'culturalFoods', 'text', { placeholder: 'Any specific cuisines or traditional dishes you love', multiline: true })}
          </>
        );

      case 'my_snack_habits':
        return (
          <>
            {renderField('Current Go-To Snacks', 'currentSnacks', 'text', { multiline: true, placeholder: 'e.g. Crisps, chocolate, fruit, protein bars, cheese and crackers' })}
            {renderField('Snacking Motivation', 'snackMotivation', 'text', { choices: ['Hunger', 'Boredom', 'Habit', 'Stress', 'Social', 'Mix of these'] })}
            {renderField('Sweet vs Savoury Preference', 'sweetOrSavory', 'text', { choices: ['Sweet', 'Savoury', 'Both equally'] })}
            {renderField('Late-Night Snacking?', 'lateNightSnacking', 'text', { choices: ['Yes, regularly', 'Sometimes', 'Rarely/never'] })}
            {renderField('Preferred Meal Frequency', 'mealFrequency', 'text', { choices: ['2 big meals', '3 standard meals', '5-6 small meals', 'Intermittent fasting', 'I graze all day'] })}
            {renderField('Biggest Eating Challenge', 'biggestChallenge', 'text', { multiline: true, placeholder: 'e.g. "I skip breakfast", "I binge on weekends", "I eat out of stress"' })}
          </>
        );

      default:
        return null;
    }
  }

  return (
    <div className="min-h-screen py-12 px-6">
      <div className="max-w-2xl mx-auto">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => router.push('/profiles')} className="btn-ghost text-sm">← Back to Profiles</button>
            <span className="text-sm text-slate-400">Step {currentSection + 1} of 4</span>
          </div>
          <div className="progress-bar">
            <div className="progress-bar-fill" style={{ width: `${((currentSection + 1) / 4) * 100}%` }} />
          </div>
          <div className="flex mt-3 gap-2">
            {SECTION_TITLES.map((s, i) => (
              <button key={s.key} onClick={() => setCurrentSection(i)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${i === currentSection ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : i < currentSection ? 'bg-white/5 text-emerald-400/60 border border-white/5' : 'bg-white/3 text-slate-500 border border-white/5'}`}>
                {s.icon} {s.title}
              </button>
            ))}
          </div>
        </div>

        {/* Section content */}
        <div className="glass-card-strong p-8 animate-fade-in" key={sectionKey}>
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-1">
              {SECTION_TITLES[currentSection].icon} {SECTION_TITLES[currentSection].title}
            </h2>
            <p className="text-slate-400">{SECTION_TITLES[currentSection].desc}</p>
          </div>

          {error && <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}

          {renderSection()}

          <div className="flex justify-between mt-8">
            <button onClick={handleBack} disabled={currentSection === 0} className="btn-secondary !px-8">
              ← Back
            </button>
            <button onClick={handleNext} disabled={saving} className="btn-primary !px-8">
              {saving ? <span className="spinner" /> : currentSection === 3 ? 'Generate My Plan 🚀' : 'Save & Continue →'}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          Your data is encrypted before storage. We never share your personal information.
        </p>
      </div>
    </div>
  );
}

export default function IntakePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="spinner" style={{ width: 40, height: 40 }} /></div>}>
      <IntakeContent />
    </Suspense>
  );
}
