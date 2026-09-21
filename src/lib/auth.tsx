import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import * as Linking from 'expo-linking';
import type { Session } from '@supabase/supabase-js';
import { AUTH_REDIRECT_URL, supabase } from './supabase';

interface AuthValue {
  session: Session | null;
  initializing: boolean;
  // True while the user is here via a "reset your password" email link —
  // Supabase hands them a temporary session just for setting a new password,
  // so the app should show that screen instead of the normal app.
  passwordRecovery: boolean;
  signUpWithPassword: (email: string, password: string) => Promise<string | null>;
  signInWithPassword: (email: string, password: string) => Promise<string | null>;
  sendMagicLink: (email: string) => Promise<string | null>;
  sendPasswordReset: (email: string) => Promise<string | null>;
  updatePassword: (newPassword: string) => Promise<string | null>;
  cancelPasswordRecovery: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

async function handleAuthUrl(url: string) {
  try {
    if (!url.includes('access_token') && !url.includes('code=')) return;
    const { error } = await supabase.auth.exchangeCodeForSession(url);
    if (error) {
      // Some magic-link emails still use the implicit (#access_token) format; handle that too.
      const hashPart = url.split('#')[1];
      if (hashPart) {
        const params = new URLSearchParams(hashPart);
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        if (access_token && refresh_token) {
          await supabase.auth.setSession({ access_token, refresh_token });
        }
      }
    }
  } catch (e) {
    // best-effort — if this fails the user just stays on the sign-in screen
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const handledInitialUrl = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setInitializing(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      setSession(sess);
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
    });

    if (!handledInitialUrl.current) {
      handledInitialUrl.current = true;
      Linking.getInitialURL().then((url) => {
        if (url) handleAuthUrl(url);
      });
    }

    const linkSub = Linking.addEventListener('url', ({ url }) => {
      handleAuthUrl(url);
    });

    return () => {
      sub.subscription.unsubscribe();
      linkSub.remove();
    };
  }, []);

  const value: AuthValue = {
    session,
    initializing,
    passwordRecovery,
    signUpWithPassword: async (email, password) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: AUTH_REDIRECT_URL },
      });
      return error ? error.message : null;
    },
    signInWithPassword: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error ? error.message : null;
    },
    sendMagicLink: async (email) => {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: AUTH_REDIRECT_URL },
      });
      return error ? error.message : null;
    },
    sendPasswordReset: async (email) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: AUTH_REDIRECT_URL,
      });
      return error ? error.message : null;
    },
    updatePassword: async (newPassword) => {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (!error) setPasswordRecovery(false);
      return error ? error.message : null;
    },
    cancelPasswordRecovery: () => {
      setPasswordRecovery(false);
      supabase.auth.signOut();
    },
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
