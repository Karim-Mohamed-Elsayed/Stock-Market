"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { ApiError, getCurrentProfile, logoutUser, type ProfileOut } from "@/lib/api";

interface AuthContextValue {
  profile: ProfileOut | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<ProfileOut | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const current = await getCurrentProfile();
      setProfile(current);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setProfile(null);
      } else {
        // Backend unreachable or other transient error: treat as signed out
        // rather than blocking the page from rendering.
        setProfile(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fetch-on-mount: refresh() is async, so its setState calls happen in a
    // later microtask, not synchronously within this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await logoutUser();
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider value={{ profile, isLoading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
