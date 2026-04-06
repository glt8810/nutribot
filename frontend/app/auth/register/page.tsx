'use client';

import { useState } from 'react';
import Link from 'next/link';
import zxcvbn from 'zxcvbn';
import { apiRegister } from '@/lib/api';

export default function RegisterPage() {

  const [form, setForm] = useState({
    fullName: '', email: '', password: '', confirmPassword: '',
    dateOfBirth: '', consent: false, referralSource: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const [success, setSuccess] = useState(false);

  const passwordResult = form.password ? zxcvbn(form.password, [form.fullName, form.email.split('@')[0]]) : null;
  const strengthLabels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];

  function validate() {
    const e: Record<string, string> = {};
    if (!form.fullName.trim()) e.fullName = 'Name is required';
    if (!form.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) e.email = 'Invalid email address';
    if (form.password.length < 12) e.password = 'Must be at least 12 characters';
    else if (!/[A-Z]/.test(form.password)) e.password = 'Must contain an uppercase letter';
    else if (!/[a-z]/.test(form.password)) e.password = 'Must contain a lowercase letter';
    else if (!/[0-9]/.test(form.password)) e.password = 'Must contain a digit';
    else if (!/[^A-Za-z0-9]/.test(form.password)) e.password = 'Must contain a special character';
    else if (passwordResult && passwordResult.score < 3) e.password = 'Password must be at least "Strong"';
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
    if (!form.dateOfBirth) e.dateOfBirth = 'Date of birth is required';
    else {
      const age = Math.floor((Date.now() - new Date(form.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      if (age < 13) e.dateOfBirth = 'You must be at least 13 years old';
    }
    if (!form.consent) e.consent = 'You must accept the Terms of Service';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setServerError('');
    if (!validate()) return;
    setLoading(true);
    try {
      const result = await apiRegister({
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        confirmPassword: form.confirmPassword,
        dateOfBirth: form.dateOfBirth,
        consentVersion: '1.0',
        referralSource: form.referralSource || undefined,
      });
      if (result.ok) {
        setSuccess(true);
      } else {
        setServerError(result.data.error || 'Registration failed');
      }
    } catch {
      setServerError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const dob = form.dateOfBirth ? new Date(form.dateOfBirth) : null;
  const age = dob ? Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="glass-card-strong p-10 max-w-md w-full text-center animate-fade-in">
          <div className="text-5xl mb-4">📧</div>
          <h1 className="text-2xl font-bold mb-3">Check your email!</h1>
          <p className="text-slate-400 mb-6">
            We&apos;ve sent a verification link to <strong className="text-white">{form.email}</strong>.
            Click it to activate your account.
          </p>
          <Link href="/auth/login" className="btn-primary w-full">Continue to Sign In</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="glass-card-strong p-8 md:p-10 max-w-lg w-full animate-fade-in">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center space-x-2 mb-4">
            <span className="text-3xl">🥗</span>
            <span className="text-2xl font-bold gradient-text">NutriBot</span>
          </Link>
          <h1 className="text-2xl font-bold">Create your account</h1>
          <p className="text-slate-400 text-sm mt-1">Start your personalized nutrition journey</p>
        </div>

        {serverError && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="input-label" htmlFor="reg-name">Full Name</label>
            <input id="reg-name" className={`input-field ${errors.fullName ? 'error' : ''}`} placeholder="Your name" value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} />
            {errors.fullName && <p className="error-text">{errors.fullName}</p>}
          </div>

          <div>
            <label className="input-label" htmlFor="reg-email">Email Address</label>
            <input id="reg-email" type="email" className={`input-field ${errors.email ? 'error' : ''}`} placeholder="you@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            {errors.email && <p className="error-text">{errors.email}</p>}
          </div>

          <div>
            <label className="input-label" htmlFor="reg-password">Password</label>
            <input id="reg-password" type="password" className={`input-field ${errors.password ? 'error' : ''}`} placeholder="Min 12 chars, mixed case, number, special" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
            {form.password && (
              <div className="mt-2">
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <div className={`strength-meter strength-${passwordResult?.score || 0}`} />
                </div>
                <p className="text-xs mt-1" style={{ color: ['#ef4444','#ef4444','#f59e0b','#eab308','#10b981'][passwordResult?.score || 0] }}>
                  {strengthLabels[passwordResult?.score || 0]}
                  {passwordResult?.feedback.warning && ` — ${passwordResult.feedback.warning}`}
                </p>
              </div>
            )}
            {errors.password && <p className="error-text">{errors.password}</p>}
          </div>

          <div>
            <label className="input-label" htmlFor="reg-confirm">Confirm Password</label>
            <input id="reg-confirm" type="password" className={`input-field ${errors.confirmPassword ? 'error' : ''}`} placeholder="Re-enter password" value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })} />
            {errors.confirmPassword && <p className="error-text">{errors.confirmPassword}</p>}
          </div>

          <div>
            <label className="input-label" htmlFor="reg-dob">Date of Birth</label>
            <input id="reg-dob" type="date" className={`input-field ${errors.dateOfBirth ? 'error' : ''}`} value={form.dateOfBirth} onChange={e => setForm({ ...form, dateOfBirth: e.target.value })} />
            {age !== null && age < 18 && age >= 13 && (
              <p className="text-xs text-amber-400 mt-1">⚠️ Under 18: parental consent may be required per your jurisdiction.</p>
            )}
            {errors.dateOfBirth && <p className="error-text">{errors.dateOfBirth}</p>}
          </div>

          <div>
            <label className="input-label" htmlFor="reg-referral">How did you hear about us? (optional)</label>
            <input id="reg-referral" className="input-field" placeholder="Friend, social media, search..." value={form.referralSource} onChange={e => setForm({ ...form, referralSource: e.target.value })} />
          </div>

          <div className="flex items-start gap-3">
            <button type="button" onClick={() => setForm({ ...form, consent: !form.consent })} className={`checkbox-custom flex-shrink-0 mt-0.5 ${form.consent ? 'checked' : ''}`}>
              {form.consent && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </button>
            <label className="text-sm text-slate-400 cursor-pointer" onClick={() => setForm({ ...form, consent: !form.consent })}>
              I agree to the <span className="text-emerald-400 hover:underline">Terms of Service</span> and <span className="text-emerald-400 hover:underline">Privacy Policy</span>
            </label>
          </div>
          {errors.consent && <p className="error-text">{errors.consent}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full !py-3.5 text-base">
            {loading ? <span className="spinner" /> : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-400 mt-6">
          Already have an account? <Link href="/auth/login" className="text-emerald-400 hover:underline font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
