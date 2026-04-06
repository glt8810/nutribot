'use client';
import { useState } from 'react';
import Link from 'next/link';
import { apiForgotPassword } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setLoading(true);
    await apiForgotPassword(email);
    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="glass-card-strong p-10 max-w-md w-full text-center animate-fade-in">
          <div className="text-5xl mb-4">📧</div>
          <h1 className="text-2xl font-bold mb-3">Check your email</h1>
          <p className="text-slate-400 mb-6">If an account exists with that email, we&apos;ve sent a password reset link.</p>
          <Link href="/auth/login" className="btn-primary w-full">Back to Login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="glass-card-strong p-8 md:p-10 max-w-md w-full animate-fade-in">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🔑</div>
          <h1 className="text-2xl font-bold">Forgot your password?</h1>
          <p className="text-slate-400 text-sm mt-2">Enter your email and we&apos;ll send a reset link.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="input-label" htmlFor="reset-email">Email Address</label>
            <input id="reset-email" type="email" className="input-field" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} autoFocus required />
          </div>
          <button type="submit" disabled={loading || !email} className="btn-primary w-full !py-3.5">
            {loading ? <span className="spinner" /> : 'Send Reset Link'}
          </button>
        </form>
        <p className="text-center text-sm text-slate-400 mt-6">
          <Link href="/auth/login" className="text-emerald-400 hover:underline">← Back to login</Link>
        </p>
      </div>
    </div>
  );
}
