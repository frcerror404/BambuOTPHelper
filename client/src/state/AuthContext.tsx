import React, { createContext, useContext, useMemo, useState } from 'react';

interface AuthState {
  token?: string;
  expiresAt?: string;
}

interface AuthContextValue extends AuthState {
  setAuth: (value?: AuthState) => void;
}

const STORAGE_KEY = 'otp-helper-auth';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function loadStoredAuth(): AuthState | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as AuthState;
    if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() > Date.now()) {
      return parsed;
    }
  } catch (error) {
    console.warn('Unable to read stored auth', error);
  }
  localStorage.removeItem(STORAGE_KEY);
  return undefined;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuthState] = useState<AuthState>(() => loadStoredAuth() || {});

  const setAuth = (value?: AuthState) => {
    if (value?.token && value.expiresAt) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      setAuthState(value);
    } else {
      localStorage.removeItem(STORAGE_KEY);
      setAuthState({});
    }
  };

  const value = useMemo(() => ({ ...auth, setAuth }), [auth.token, auth.expiresAt]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
