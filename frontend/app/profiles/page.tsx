'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';

export default function ProfilesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      apiFetch('/profiles')
        .then(res => res.json())
        .then(data => {
          setProfiles(Array.isArray(data) ? data : []);
          setLoadingProfiles(false);
        })
        .catch(() => setLoadingProfiles(false));
    }
  }, [user]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSubmitting(true);
    setError('');

    try {
      const res = await apiFetch('/profiles', {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/intake?profileId=${data.id}`);
      } else {
        const d = await res.json();
        setError(d.error || 'Failed to create profile');
      }
    } catch {
      setError('Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user || loadingProfiles) {
    return <div className="min-h-screen flex items-center justify-center"><div className="spinner" style={{ width: 40, height: 40 }} /></div>;
  }

  return (
    <div className="min-h-screen py-12 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Link href="/dashboard" className="btn-ghost text-sm">← Dashboard</Link>
          <div className="flex items-center space-x-2">
            <span className="text-xl">🥗</span>
            <span className="font-bold gradient-text">NutriBot</span>
          </div>
        </div>

        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">Who is the plan for?</h1>
          <p className="text-slate-400 text-lg">Select a profile or create a new one. A profile saves your lifestyle and preferences so you don't have to enter them again.</p>
        </div>

        {error && <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">{error}</div>}

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          {profiles.map(profile => (
            <div key={profile.id} className="glass-card-strong p-6 flex flex-col h-full rounded-2xl relative">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold truncate pr-3">{profile.name}</h3>
                {profile.intakeComplete ? (
                   <span className="text-xs font-semibold bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full whitespace-nowrap border border-emerald-500/20">Ready</span>
                ) : (
                   <span className="text-xs font-semibold bg-amber-500/20 text-amber-400 px-2 py-1 rounded-full whitespace-nowrap border border-amber-500/20">Incomplete</span>
                )}
              </div>
              <div className="text-sm text-slate-400 mb-6 flex-grow">
                Created {new Date(profile.createdAt).toLocaleDateString()}
              </div>
              <button
                onClick={() => router.push(profile.intakeComplete ? `/goals?profileId=${profile.id}` : `/intake?profileId=${profile.id}`)}
                className="btn-primary w-full py-3"
              >
                {profile.intakeComplete ? 'Choose Goal →' : 'Complete Intake →'}
              </button>
            </div>
          ))}

          {/* New Profile Card / Form */}
          {!showCreate ? (
            <button
              onClick={() => setShowCreate(true)}
              className="glass-card p-6 flex flex-col items-center justify-center h-full rounded-2xl border-dashed border-2 border-slate-700 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all outline-none"
              style={{ minHeight: '200px' }}
            >
              <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-xl mb-3 text-emerald-400">+</div>
              <span className="font-semibold">Create New Profile</span>
            </button>
          ) : (
            <form onSubmit={handleCreate} className="glass-card-strong p-6 flex flex-col h-full rounded-2xl border-emerald-500/30 border">
              <h3 className="text-lg font-bold mb-4">New Profile Name</h3>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g. My Profile, Maria, etc."
                className="input-field mb-4"
                autoFocus
                maxLength={50}
              />
              <div className="mt-auto flex gap-2">
                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary flex-1 py-2 text-sm">Cancel</button>
                <button type="submit" disabled={!newName.trim() || submitting} className="btn-primary flex-1 py-2 text-sm">
                  {submitting ? <span className="spinner" style={{ width: 16, height: 16 }} /> : 'Start Intake'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
