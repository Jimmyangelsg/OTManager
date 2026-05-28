import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import api from '@/lib/api';

const AuthContext = createContext(null);

const isDev = process.env.NODE_ENV === 'development';

export function AuthProvider({ children }) {
  // null = loading, false = unauthenticated, object = authenticated
  const [user, setUser] = useState(null);

  const fetchMe = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser(data);
      return data;
    } catch (err) {
      // Not authenticated or token expired - treat as logged out
      if (isDev) console.warn('[Auth] /me failed (not logged in or expired):', err?.response?.status);
      setUser(false);
      return null;
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    setUser(data);
    return data;
  }, []);

  const register = useCallback(async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    setUser(data);
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      // Network error or session already gone — proceed to clear local state anyway
      if (isDev) console.warn('[Auth] logout request failed:', err?.message);
    }
    setUser(false);
  }, []);

  const value = useMemo(
    () => ({ user, setUser, login, register, logout, refresh: fetchMe }),
    [user, login, register, logout, fetchMe]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
