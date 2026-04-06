'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiCompleteProfile } from '@/lib/api';

export default function CompleteProfilePage() {
  const router = useRouter();
  const { user, loading, refreshUser } = useAuth();
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Redirect if not logged in or profile already complete
  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/auth/login');
      } else if (!user.needsProfileCompletion) {
        router.push('/dashboard');
      }
    }
  }, [user, loading, router]);

  const dob = dateOfBirth ? new Date(dateOfBirth) : null;
  const age = dob
    ? Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setError('');

    if (!dateOfBirth) {
      setError('Please enter your date of birth.');
      return;
    }

    if (age !== null && age < 13) {
      setError('You must be at least 13 years old to use NutriBot.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await apiCompleteProfile(dateOfBirth);
      if (result.ok) {
        await refreshUser();
        router.push('/dashboard');
      } else {
        setError(result.data.error || 'Failed to save profile.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="glass-card-strong p-10 max-w-md w-full text-center animate-fade-in">
          <span className="spinner-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="glass-card-strong p-8 md:p-10 max-w-md w-full animate-fade-in">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold">Welcome to NutriBot!</h1>
          <p className="text-slate-400 text-sm mt-2">
            Hi <strong className="text-white">{user.fullName}</strong>! Just one more thing to get you started.
          </p>
        </div>

        {/* Info Box */}
        <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm">
          <div className="flex items-start gap-2">
            <span className="text-base mt-0.5">ℹ️</span>
            <span>We need your date of birth to verify you meet the minimum age requirement (13+). This information is encrypted and never shared.</span>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="input-label" htmlFor="profile-dob">Date of Birth</label>
            <input
              id="profile-dob"
              type="date"
              className={`input-field ${error ? 'error' : ''}`}
              value={dateOfBirth}
              onChange={e => setDateOfBirth(e.target.value)}
              autoFocus
            />
            {age !== null && age < 18 && age >= 13 && (
              <p className="text-xs text-amber-400 mt-1">⚠️ Under 18: parental consent may be required per your jurisdiction.</p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting || !dateOfBirth}
            className="btn-primary w-full !py-3.5 text-base"
          >
            {submitting ? <span className="spinner" /> : 'Complete Setup'}
          </button>
        </form>
      </div>
    </div>
  );
}
