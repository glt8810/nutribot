'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import zxcvbn from 'zxcvbn';
import { useAuth } from '@/lib/auth-context';
import Image from 'next/image';
import { apiFetch } from '@/lib/api';

export default function SettingsPage() {
  const { user, loading, logout, refreshUser } = useAuth();
  const router = useRouter();
  const [activeSection, setActiveSection] = useState('profile');
  const [sessions, setSessions] = useState<any[]>([]);
  const [mfaSetup, setMfaSetup] = useState<any>(null);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Password form
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [deletePw, setDeletePw] = useState('');
  const [actionLoading, setActionLoading] = useState('');

  const pwResult = newPw ? zxcvbn(newPw) : null;

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    if (activeSection === 'sessions') {
      apiFetch('/auth/sessions').then(async r => {
        if (r.ok) setSessions(await r.json());
      });
    }
  }, [user, activeSection]);

  function showMessage(type: string, text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  }

  async function handleChangePassword(ev: React.FormEvent) {
    ev.preventDefault();
    if (newPw !== confirmPw) return showMessage('error', 'Passwords do not match');
    if (!pwResult || pwResult.score < 3) return showMessage('error', 'Password must be Strong or better');
    setActionLoading('password');
    const res = await apiFetch('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw, confirmNewPassword: confirmPw }),
    });
    if (res.ok) {
      showMessage('success', 'Password changed! Other sessions logged out.');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } else {
      const d = await res.json();
      showMessage('error', d.error || 'Failed to change password');
    }
    setActionLoading('');
  }

  async function handleSetupMfa() {
    setActionLoading('mfa-setup');
    const res = await apiFetch('/auth/mfa/setup');
    if (res.ok) {
      const data = await res.json();
      setMfaSetup(data);
    } else {
      showMessage('error', 'Failed to start MFA setup');
    }
    setActionLoading('');
  }

  async function handleConfirmMfa(ev: React.FormEvent) {
    ev.preventDefault();
    setActionLoading('mfa-confirm');
    const res = await apiFetch('/auth/mfa/confirm', {
      method: 'POST',
      body: JSON.stringify({ code: mfaCode }),
    });
    if (res.ok) {
      showMessage('success', 'MFA enabled!');
      setMfaSetup(null);
      setMfaCode('');
      await refreshUser();
    } else {
      const d = await res.json();
      showMessage('error', d.error || 'Invalid code');
    }
    setActionLoading('');
  }

  async function handleDisableMfa() {
    const pw = prompt('Enter your password to disable MFA:');
    if (!pw) return;
    const res = await apiFetch('/auth/mfa/disable', {
      method: 'POST',
      body: JSON.stringify({ password: pw }),
    });
    if (res.ok) {
      showMessage('success', 'MFA disabled');
      await refreshUser();
    } else {
      const d = await res.json();
      showMessage('error', d.error || 'Failed');
    }
  }

  async function handleRevokeSession(sessionId: string) {
    await apiFetch(`/auth/sessions/${sessionId}`, { method: 'DELETE' });
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    showMessage('success', 'Session revoked');
  }

  async function handleExportData() {
    setActionLoading('export');
    const res = await apiFetch('/auth/export-data');
    if (res.ok) {
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'nutribot-data-export.json'; a.click();
      URL.revokeObjectURL(url);
      showMessage('success', 'Data exported!');
    } else {
      showMessage('error', 'Export failed');
    }
    setActionLoading('');
  }

  async function handleDeleteAccount(ev: React.FormEvent) {
    ev.preventDefault();
    if (!confirm('Are you sure? Your account will be permanently deleted after 30 days.')) return;
    setActionLoading('delete');
    const res = await apiFetch('/auth/delete-account', {
      method: 'POST',
      body: JSON.stringify({ password: deletePw }),
    });
    if (res.ok) {
      await logout();
      router.push('/');
    } else {
      const d = await res.json();
      showMessage('error', d.error || 'Failed');
    }
    setActionLoading('');
  }

  if (loading || !user) return <div className="min-h-screen flex items-center justify-center"><div className="spinner" style={{ width: 40, height: 40 }} /></div>;

  const sections = [
    { key: 'profile', icon: '👤', label: 'Profile' },
    { key: 'security', icon: '🔒', label: 'Security' },
    { key: 'mfa', icon: '🔐', label: 'MFA' },
    { key: 'sessions', icon: '📱', label: 'Sessions' },
    { key: 'privacy', icon: '🛡️', label: 'Privacy & Data' },
  ];

  return (
    <div className="min-h-screen">
      <nav className="border-b px-6 py-4" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/dashboard" className="btn-ghost text-sm">← Dashboard</Link>
          <div className="flex items-center space-x-2">
            <span className="text-xl">🥗</span>
            <span className="font-bold gradient-text">NutriBot</span>
          </div>
          <div />
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold mb-8">Account Settings</h1>

        {message.text && (
          <div className={`mb-6 p-4 rounded-xl text-sm ${message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
            {message.text}
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar */}
          <div className="md:w-48 flex-shrink-0">
            <div className="flex md:flex-col gap-1 overflow-x-auto">
              {sections.map(s => (
                <button key={s.key} onClick={() => setActiveSection(s.key)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${activeSection === s.key ? 'tab-active' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                  <span>{s.icon}</span> {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 glass-card-strong p-6 md:p-8">
            {activeSection === 'profile' && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold">Profile</h2>
                <div className="space-y-4">
                  <div><span className="input-label">Name</span><p className="text-white">{user.fullName}</p></div>
                  <div><span className="input-label">Email</span><p className="text-white">{user.email} {user.emailVerified ? <span className="text-emerald-400 text-xs">✓ Verified</span> : <span className="text-amber-400 text-xs">⚠ Not verified</span>}</p></div>
                  <div><span className="input-label">Member since</span><p className="text-slate-300">{new Date(user.createdAt).toLocaleDateString()}</p></div>
                </div>
              </div>
            )}

            {activeSection === 'security' && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold">Change Password</h2>
                <form onSubmit={handleChangePassword} className="space-y-4 max-w-sm">
                  <div><label className="input-label">Current Password</label><input type="password" className="input-field" value={currentPw} onChange={e => setCurrentPw(e.target.value)} /></div>
                  <div>
                    <label className="input-label">New Password</label><input type="password" className="input-field" value={newPw} onChange={e => setNewPw(e.target.value)} />
                    {newPw && <div className="mt-1"><div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}><div className={`strength-meter strength-${pwResult?.score || 0}`} /></div></div>}
                  </div>
                  <div><label className="input-label">Confirm New Password</label><input type="password" className="input-field" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} /></div>
                  <button type="submit" disabled={actionLoading === 'password'} className="btn-primary">
                    {actionLoading === 'password' ? <span className="spinner" /> : 'Change Password'}
                  </button>
                </form>
              </div>
            )}

            {activeSection === 'mfa' && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold">Two-Factor Authentication</h2>
                {user.mfaEnabled ? (
                  <div>
                    <div className="banner banner-success mb-4">✅ MFA is currently enabled</div>
                    <button onClick={handleDisableMfa} className="btn-danger">Disable MFA</button>
                  </div>
                ) : mfaSetup ? (
                  <div className="space-y-4">
                    <p className="text-slate-400 text-sm">Scan this QR code with your authenticator app:</p>
                    <div className="flex justify-center">
                      <Image src={mfaSetup.qrCode} alt="MFA QR Code" className="rounded-xl" width={200} height={200} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-amber-400 mb-2">⚠️ Save these backup codes — you won&apos;t see them again:</p>
                      <div className="grid grid-cols-2 gap-2">{mfaSetup.backupCodes.map((c: string) => <code key={c} className="text-sm bg-white/5 p-2 rounded text-center">{c}</code>)}</div>
                    </div>
                    <form onSubmit={handleConfirmMfa} className="flex gap-2">
                      <input className="input-field flex-1" placeholder="Enter 6-digit code" value={mfaCode} onChange={e => setMfaCode(e.target.value)} />
                      <button type="submit" disabled={actionLoading === 'mfa-confirm'} className="btn-primary">{actionLoading === 'mfa-confirm' ? <span className="spinner" /> : 'Verify'}</button>
                    </form>
                  </div>
                ) : (
                  <div>
                    <p className="text-slate-400 text-sm mb-4">Add an extra layer of security with TOTP-based two-factor authentication.</p>
                    <button onClick={handleSetupMfa} disabled={actionLoading === 'mfa-setup'} className="btn-primary">{actionLoading === 'mfa-setup' ? <span className="spinner" /> : 'Set Up MFA'}</button>
                  </div>
                )}
              </div>
            )}

            {activeSection === 'sessions' && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold">Active Sessions</h2>
                {sessions.length === 0 ? <p className="text-slate-400">No active sessions found.</p> : sessions.map(s => (
                  <div key={s.id} className="glass-card p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{s.userAgent?.substring(0, 50) || 'Unknown device'}...</p>
                      <p className="text-xs text-slate-500">IP: {s.ipAddress || 'any'} · Created: {new Date(s.createdAt).toLocaleString()}</p>
                    </div>
                    <button onClick={() => handleRevokeSession(s.id)} className="btn-ghost text-xs text-red-400 hover:text-red-300">Revoke</button>
                  </div>
                ))}
              </div>
            )}

            {activeSection === 'privacy' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-xl font-bold mb-4">Data Export</h2>
                  <p className="text-sm text-slate-400 mb-4">Download all your data (profile, goals, plans, intake responses) as a JSON file.</p>
                  <button onClick={handleExportData} disabled={actionLoading === 'export'} className="btn-secondary">
                    {actionLoading === 'export' ? <span className="spinner" /> : '📥 Download My Data'}
                  </button>
                </div>
                <hr style={{ borderColor: 'rgba(255,255,255,0.05)' }} />
                <div>
                  <h2 className="text-xl font-bold mb-4 text-red-400">Delete Account</h2>
                  <p className="text-sm text-slate-400 mb-4">This will soft-delete your account. After 30 days, all data will be permanently erased. You can cancel by logging in within that window.</p>
                  <form onSubmit={handleDeleteAccount} className="flex gap-2 max-w-sm">
                    <input type="password" className="input-field flex-1" placeholder="Enter password to confirm" value={deletePw} onChange={e => setDeletePw(e.target.value)} />
                    <button type="submit" disabled={actionLoading === 'delete' || !deletePw} className="btn-danger">
                      {actionLoading === 'delete' ? <span className="spinner" /> : 'Delete'}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
