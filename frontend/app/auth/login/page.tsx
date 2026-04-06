'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiLogin, apiMfaVerify } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // MFA state
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaUserId, setMfaUserId] = useState('');
  const [mfaCode, setMfaCode] = useState('');

  async function handleLogin(ev: React.FormEvent) {
    ev.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await apiLogin(email, password);
      if (result.ok) {
        if (result.data.requireMfa) {
          setMfaRequired(true);
          setMfaUserId(result.data.userId);
        } else {
          await login(result.data.accessToken);
          router.push('/dashboard');
        }
      } else {
        setError(result.data.error || 'Login failed');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleMfa(ev: React.FormEvent) {
    ev.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await apiMfaVerify(mfaUserId, mfaCode);
      if (result.ok) {
        await login(result.data.accessToken);
        router.push('/dashboard');
      } else {
        setError(result.data.error || 'Invalid MFA code');
      }
    } catch {
      setError('MFA verification failed.');
    } finally {
      setLoading(false);
    }
  }

  if (mfaRequired) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="glass-card-strong p-8 md:p-10 max-w-md w-full animate-fade-in">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">🔐</div>
            <h1 className="text-2xl font-bold">Two-Factor Authentication</h1>
            <p className="text-slate-400 text-sm mt-2">Enter the 6-digit code from your authenticator app, or an 8-character backup code.</p>
          </div>
          {error && <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}
          <form onSubmit={handleMfa} className="space-y-5">
            <div>
              <label className="input-label" htmlFor="mfa-code">Authentication Code</label>
              <input id="mfa-code" className="input-field text-center text-2xl tracking-widest" placeholder="000000" value={mfaCode} onChange={e => setMfaCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8))} autoFocus autoComplete="one-time-code" />
            </div>
            <button type="submit" disabled={loading || mfaCode.length < 6} className="btn-primary w-full !py-3.5">
              {loading ? <span className="spinner" /> : 'Verify'}
            </button>
          </form>
          <button onClick={() => { setMfaRequired(false); setMfaCode(''); setError(''); }} className="btn-ghost w-full mt-4 text-sm">← Back to login</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="glass-card-strong p-8 md:p-10 max-w-md w-full animate-fade-in">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center space-x-2 mb-4">
            <span className="text-3xl">🥗</span>
            <span className="text-2xl font-bold gradient-text">NutriBot</span>
          </Link>
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="text-slate-400 text-sm mt-1">Sign in to your account</p>
        </div>

        {error && <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="input-label" htmlFor="login-email">Email Address</label>
            <input id="login-email" type="email" className="input-field" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="input-label" htmlFor="login-password">Password</label>
            <input id="login-password" type="password" className="input-field" placeholder="Enter password" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <div className="flex justify-end">
            <Link href="/auth/forgot-password" className="text-sm text-emerald-400 hover:underline">Forgot password?</Link>
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full !py-3.5 text-base">
            {loading ? <span className="spinner" /> : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-400 mt-6">
          Don&apos;t have an account? <Link href="/auth/register" className="text-emerald-400 hover:underline font-medium">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
