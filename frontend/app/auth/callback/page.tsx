'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    async function handleCallback() {
      const token = searchParams.get('token');
      const needsProfile = searchParams.get('needsProfile');

      if (!token) {
        setError('Authentication failed. No token received.');
        setTimeout(() => router.push('/auth/login'), 3000);
        return;
      }

      try {
        // Set the access token and fetch user profile
        await login(token);

        // Redirect based on whether profile completion is needed
        if (needsProfile === '1') {
          router.push('/auth/complete-profile');
        } else {
          router.push('/dashboard');
        }
      } catch {
        setError('Authentication failed. Please try again.');
        setTimeout(() => router.push('/auth/login'), 3000);
      }
    }

    handleCallback();
  }, [searchParams, login, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="glass-card-strong p-10 max-w-md w-full text-center animate-fade-in">
          <div className="text-5xl mb-4">❌</div>
          <h1 className="text-2xl font-bold mb-3">Sign-in Failed</h1>
          <p className="text-slate-400">{error}</p>
          <p className="text-slate-500 text-sm mt-4">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="glass-card-strong p-10 max-w-md w-full text-center animate-fade-in">
        <div className="text-5xl mb-4">
          <span className="spinner-lg" />
        </div>
        <h1 className="text-2xl font-bold mb-3">Signing you in...</h1>
        <p className="text-slate-400">Please wait while we complete authentication.</p>
      </div>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="glass-card-strong p-10 max-w-md w-full text-center animate-fade-in">
          <div className="text-5xl mb-4">
            <span className="spinner-lg" />
          </div>
          <h1 className="text-2xl font-bold mb-3">Loading...</h1>
        </div>
      </div>
    }>
      <CallbackContent />
    </Suspense>
  );
}
