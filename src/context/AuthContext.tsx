"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase, DbProfile } from "@/lib/supabase";

export interface Profile {
  id: string;
  userId: string;
  fullName: string;
  avatar: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  needsProfileSetup: boolean;
  signInWithEmail: (
    email: string,
    password: string
  ) => Promise<{ error: Error | null }>;
  signUpWithEmail: (
    email: string,
    password: string
  ) => Promise<{
    error: Error | null;
    needsConfirmation?: boolean;
    user?: User | null;
  }>;
  signInWithMagicLink: (email: string) => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  createProfile: (
    fullName: string,
    avatar: string | null
  ) => Promise<{ error: Error | null }>;
  updateProfile: (
    fullName: string,
    avatar: string | null
  ) => Promise<{ error: Error | null }>;
  getProfileByUserId: (userId: string) => Promise<Profile | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);

  const loadProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      setNeedsProfileSetup(true);
      setProfile(null);
      return;
    }

    const dbProfile = data as DbProfile;
    setProfile({
      id: dbProfile.id,
      userId: dbProfile.user_id,
      fullName: dbProfile.full_name,
      avatar: dbProfile.avatar,
    });
    setNeedsProfileSetup(false);
  }, []);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      }
      setIsLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
        setNeedsProfileSetup(false);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error: error as Error | null };
    },
    []
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // Skip email confirmation for PWA usage
          emailRedirectTo:
            typeof window !== "undefined" ? window.location.origin : undefined,
        },
      });

      // If signup succeeded but user needs to confirm email
      const needsConfirmation = data?.user && !data?.session;

      return {
        error: error as Error | null,
        needsConfirmation,
        user: data?.user,
      };
    },
    []
  );

  const signInWithMagicLink = useCallback(async (email: string) => {
    const redirectUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/auth/callback`
        : undefined;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });
    return { error: error as Error | null };
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const redirectUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/auth/callback`
        : undefined;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    return { error: error as Error | null };
  }, []);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error("Supabase signOut error:", e);
    }
    // Clear auth storage manually to ensure sign out works
    if (typeof window !== "undefined") {
      localStorage.removeItem("daytracker-auth");
      // Clear any other Supabase storage keys
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("sb-") || key.includes("supabase")) {
          localStorage.removeItem(key);
        }
      });
    }
    // Update state immediately
    setUser(null);
    setSession(null);
    setProfile(null);
  }, []);

  const createProfile = useCallback(
    async (fullName: string, avatar: string | null) => {
      if (!user) return { error: new Error("Not logged in") };

      const { error } = await supabase.from("profiles").insert({
        user_id: user.id,
        full_name: fullName,
        avatar: avatar,
      });

      if (!error) {
        await loadProfile(user.id);
      }

      return { error: error as Error | null };
    },
    [user, loadProfile]
  );

  const updateProfile = useCallback(
    async (fullName: string, avatar: string | null) => {
      if (!user) return { error: new Error("Not logged in") };

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          avatar: avatar,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (!error) {
        await loadProfile(user.id);
      }

      return { error: error as Error | null };
    },
    [user, loadProfile]
  );

  const getProfileByUserId = useCallback(
    async (userId: string): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error || !data) return null;

      const dbProfile = data as DbProfile;
      return {
        id: dbProfile.id,
        userId: dbProfile.user_id,
        fullName: dbProfile.full_name,
        avatar: dbProfile.avatar,
      };
    },
    []
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isLoading,
        needsProfileSetup,
        signInWithEmail,
        signUpWithEmail,
        signInWithMagicLink,
        resetPassword,
        signOut,
        createProfile,
        updateProfile,
        getProfileByUserId,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
