"use client";
import { createContext, useContext, useState, useEffect, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,  setUser]  = useState(null);
  const [token, setToken] = useState(null);
  const [ready, setReady] = useState(false);

  const setSession = useCallback((t, u) => {
    setToken(t);
    setUser(u);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (!r.ok) return null;
      const d = await r.json();
      setSession(d.accessToken, d.user);
      return d.accessToken;
    } catch {
      return null;
    }
  }, [setSession]);

  useEffect(() => {
    refresh().finally(() => setReady(true));
  }, []);

  const authFetch = useCallback(async (url, opts = {}) => {
    const go = (tk) =>
      fetch(url, {
        ...opts,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...opts.headers,
          ...(tk ? { Authorization: `Bearer ${tk}` } : {}),
        },
      });

    let res = await go(token);
    if (res.status === 401) {
      const nt = await refresh();
      if (!nt) {
        setUser(null);
        setToken(null);
        return res;
      }
      res = await go(nt);
    }
    return res;
  }, [token, refresh]);

  const login = useCallback(async (email, senha) => {
    const r = await fetch(`${API}/api/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha }),
    });
    if (!r.ok) {
      const e = await r.json();
      throw new Error(e.message || "Credenciais inválidas");
    }
    const d = await r.json();
    setSession(d.accessToken, d.user);
    return d.user;
  }, [setSession]);

  const register = useCallback(async (nome, email, senha) => {
    const r = await fetch(`${API}/api/auth/register`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, email, senha }),
    });
    if (!r.ok) {
      const e = await r.json();
      throw new Error(e.message || "Erro ao criar conta");
    }
    const d = await r.json();
    setSession(d.accessToken, d.user);
    return d.user;
  }, [setSession]);

  const logout = useCallback(async () => {
    await fetch(`${API}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    }).catch(() => {});
    setUser(null);
    setToken(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      ready,
      login,
      register,
      logout,
      authFetch,
      isPremium: user?.tier === "premium" || user?.tier === "admin",
      isAdmin:   user?.tier === "admin",
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
