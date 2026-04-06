'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiVerifyEmail } from '@/lib/api';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) { setStatus('error'); setMessage('No verification token provided.'); return; }
    apiVerifyEmail(token).then(r => {
      if (r.ok) { setStatus('success'); setMessage('Email verified!'); }
      else { setStatus('error'); setMessage(r.data.error || 'Verification failed.'); }
    }).catch(() => { setStatus('error'); setMessage('Something went wrong.'); });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="glass-card-strong p-10 max-w-md w-full text-center animate-fade-in">
        {status === 'verifying' && <><div className="spinner mx-auto mb-4" style={{ width: 40, height: 40 }} /><h1 className="text-xl font-bold">Verifying your email...</h1></>}
        {status === 'success' && <><div className="text-5xl mb-4">✅</div><h1 className="text-2xl font-bold mb-3">{message}</h1><p className="text-slate-400 mb-6">Your account is now fully activated. You can generate plans!</p><Link href="/auth/login" className="btn-primary">Sign In</Link></>}
        {status === 'error' && <><div className="text-5xl mb-4">❌</div><h1 className="text-2xl font-bold mb-3">Verification Failed</h1><p className="text-slate-400 mb-6">{message}</p><Link href="/auth/login" className="btn-secondary">Back to Login</Link></>}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="spinner" style={{width:40,height:40}}/></div>}><VerifyEmailContent /></Suspense>;
}
