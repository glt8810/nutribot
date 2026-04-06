'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { apiFetch, setAccessToken, apiLogout } from './api';

interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  fullName: string;
  dateOfBirth: string;
  mfaEnabled: boolean;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (accessToken: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const res = await apiFetch('/auth/profile');
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        setUser(null);
        setAccessToken(null);
      }
    } catch {
      setUser(null);
    }
  }, []);

  // Try to refresh on mount
  useEffect(() => {
    async function init() {
      try {
        // Try refreshing with cookie
        const res = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setAccessToken(data.accessToken);
          await fetchUser();
        }
      } catch {
        // Not logged in
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [fetchUser]);

  const login = useCallback(async (accessToken: string) => {
    setAccessToken(accessToken);
    await fetchUser();
  }, [fetchUser]);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
    setAccessToken(null);
  }, []);

  const refreshUser = useCallback(async () => {
    await fetchUser();
  }, [fetchUser]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
