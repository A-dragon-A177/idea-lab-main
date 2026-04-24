import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import apiClient from "@/lib/api";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<{ error: any }>;
  signUp: (email: string, password: string) => Promise<{ data: any; error: any }>;
  signIn: (email: string, password: string) => Promise<{ data: any; error: any }>;
  signInWithGoogle: () => Promise<{ data: any; error: any }>;
  signInWithGithub: () => Promise<{ data: any; error: any }>;
  syncWithBackend: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const syncWithBackend = useCallback(async () => {
    try {
      // Double-check we actually have a session
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession?.access_token) {
        console.log('[AuthContext] Skipping backend sync - no active session');
        return;
      }

      console.log('[AuthContext] Syncing user with backend...');
      await apiClient.get('/api/users/me');
      console.log('[AuthContext] User synced with backend successfully');
    } catch (error) {
      console.warn('[AuthContext] Backend sync failed:', error);
    }
  }, []);

  useEffect(() => {
    console.log('[AuthContext] Initializing provider...');

    // 1. Check for initial session
    const initializeAuth = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
      } catch (error) {
        console.error('[AuthContext] Error getting initial session:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // 2. Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        console.log('[AuthContext] Auth state changed:', event);
        
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setLoading(false);

        if (event === 'SIGNED_IN' && currentSession?.access_token) {
          syncWithBackend();
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [syncWithBackend]);

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/dashboard`;
    return await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectUrl }
    });
  };

  const signIn = async (email: string, password: string) => {
    return await supabase.auth.signInWithPassword({ email, password });
  };

  const signInWithGoogle = async () => {
    return await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
  };

  const signInWithGithub = async () => {
    return await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      return { error };
    } catch (error) {
      console.error('[AuthContext] signOut exception:', error);
      setSession(null);
      setUser(null);
      return { error: null };
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      loading, 
      signOut, 
      signUp, 
      signIn, 
      signInWithGoogle, 
      signInWithGithub, 
      syncWithBackend 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
};
