'use client';
import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import zxcvbn from 'zxcvbn';
import { apiResetPassword } from '@/lib/api';

function ResetPasswordContent() {
  const searchParams = useSearchParams();

  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const pw = password ? zxcvbn(password) : null;
  const strengthLabels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!token) return;
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (!pw || pw.score < 3) { setError('Password must be at least "Strong"'); return; }
    setError(''); setLoading(true);
    const result = await apiResetPassword(token, password, confirmPassword);
    if (result.ok) { setSuccess(true); }
    else { setError(result.data.error || 'Reset failed'); }
    setLoading(false);
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="glass-card-strong p-10 max-w-md w-full text-center animate-fade-in">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-2xl font-bold mb-3">Password reset!</h1>
          <p className="text-slate-400 mb-6">Your password has been changed. All sessions have been logged out.</p>
          <Link href="/auth/login" className="btn-primary w-full">Sign In</Link>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="glass-card-strong p-10 max-w-md w-full text-center">
          <div className="text-5xl mb-4">❌</div>
          <h1 className="text-2xl font-bold mb-3">Invalid reset link</h1>
          <Link href="/auth/forgot-password" className="btn-primary">Request a new link</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="glass-card-strong p-8 md:p-10 max-w-md w-full animate-fade-in">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🔐</div>
          <h1 className="text-2xl font-bold">Set new password</h1>
        </div>
        {error && <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="input-label">New Password</label>
            <input type="password" className="input-field" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 12 chars, mixed case, number, special" />
            {password && (
              <div className="mt-2">
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <div className={`strength-meter strength-${pw?.score || 0}`} />
                </div>
                <p className="text-xs mt-1" style={{ color: ['#ef4444','#ef4444','#f59e0b','#eab308','#10b981'][pw?.score || 0] }}>{strengthLabels[pw?.score || 0]}</p>
              </div>
            )}
          </div>
          <div>
            <label className="input-label">Confirm Password</label>
            <input type="password" className="input-field" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter password" />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full !py-3.5">{loading ? <span className="spinner" /> : 'Reset Password'}</button>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="spinner" style={{width:40,height:40}}/></div>}><ResetPasswordContent /></Suspense>;
}
