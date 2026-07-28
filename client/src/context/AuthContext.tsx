import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, clearToken, getToken, setToken } from '../lib/api';
import type { Role, User } from '../types';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  can: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // On boot, exchange a stored token for the current user so a refresh keeps you signed in.
  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api<User>('/api/auth/me')
      .then(setUser)
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    setToken(result.token);
    setUser(result.user);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  // ADMIN passes every gate — mirrors the rule enforced on the server.
  const can = useCallback(
    (...roles: Role[]) => !!user && (user.role === 'ADMIN' || roles.includes(user.role)),
    [user],
  );

  const value = useMemo(
    () => ({ user, loading, login, logout, can }),
    [user, loading, login, logout, can],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
