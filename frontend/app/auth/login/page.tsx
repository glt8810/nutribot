'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiLogin, apiMfaVerify, getGoogleAuthUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
  google_denied: 'Google sign-in was cancelled.',
  google_no_code: 'Google sign-in failed. Please try again.',
  google_csrf: 'Security verification failed. Please try again.',
  google_failed: 'Google sign-in failed. Please try again.',
  account_exists_link_required: 'An account with this email already exists. Please sign in with your password first, then link Google from your profile.',
  account_deleted: 'This account has been deleted.',
};

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // MFA state
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaUserId, setMfaUserId] = useState('');
  const [mfaCode, setMfaCode] = useState('');

  // Check for OAuth error in URL params
  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam && GOOGLE_ERROR_MESSAGES[errorParam]) {
      setError(GOOGLE_ERROR_MESSAGES[errorParam]);
      // Clean up the URL
      window.history.replaceState({}, '', '/auth/login');
    }
  }, [searchParams]);

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

  function handleGoogleSignIn() {
    window.location.href = getGoogleAuthUrl();
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

        {/* Google Sign-In Button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="w-full flex items-center justify-center gap-3 px-4 py-3.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all duration-200 text-white font-medium text-base mb-6 hover:border-white/20 active:scale-[0.98]"
          id="google-signin-btn"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 h-px bg-white/10"></div>
          <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">or</span>
          <div className="flex-1 h-px bg-white/10"></div>
        </div>

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
