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
  deleteAccount: () => Promise<{ error: Error | null }>;
  deleteAllData: () => Promise<{ error: Error | null }>;
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
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      // Handle invalid refresh token error
      if (
        error?.message?.includes("Refresh Token") ||
        error?.message?.includes("refresh_token")
      ) {
        console.warn("Invalid refresh token, clearing session");
        supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setProfile(null);
        setNeedsProfileSetup(false);
        setIsLoading(false);
        return;
      }

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
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Handle token refresh errors
      if (event === "TOKEN_REFRESHED" && !session) {
        console.warn("Token refresh failed, signing out");
        supabase.auth.signOut();
        return;
      }

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

  // Delete all user data but keep the account
  const deleteAllData = useCallback(async () => {
    if (!user) return { error: new Error("Not logged in") };

    try {
      const userId = user.id;

      // Delete all user data from Supabase tables in order
      // 1. Delete shares (both as owner and viewer)
      await supabase.from("shares").delete().eq("owner_id", userId);
      await supabase.from("shares").delete().eq("viewer_id", userId);

      // 2. Delete share requests (both sent and received)
      await supabase.from("share_requests").delete().eq("from_user_id", userId);
      await supabase.from("share_requests").delete().eq("to_user_id", userId);

      // 3. Delete locked days
      await supabase.from("locked_days").delete().eq("user_id", userId);

      // 4. Delete suggestions
      await supabase.from("suggestions").delete().eq("user_id", userId);

      // 5. Delete log entries
      await supabase.from("log_entries").delete().eq("user_id", userId);

      // 6. Delete activity types
      await supabase.from("activity_types").delete().eq("user_id", userId);

      // Clear local storage (but preserve auth tokens)
      if (typeof window !== "undefined") {
        // Save auth-related keys
        const authKeys: Record<string, string | null> = {};
        Object.keys(localStorage).forEach((key) => {
          if (
            key.startsWith("sb-") ||
            key.includes("supabase") ||
            key === "daytracker-auth"
          ) {
            authKeys[key] = localStorage.getItem(key);
          }
        });

        // Clear all localStorage
        localStorage.clear();

        // Restore auth keys
        Object.entries(authKeys).forEach(([key, value]) => {
          if (value) localStorage.setItem(key, value);
        });

        // Clear IndexedDB
        indexedDB.deleteDatabase("daytracker-db");
      }

      return { error: null };
    } catch (e) {
      console.error("Delete all data error:", e);
      return { error: e as Error };
    }
  }, [user]);

  const deleteAccount = useCallback(async () => {
    if (!user) return { error: new Error("Not logged in") };

    try {
      const userId = user.id;

      // Delete all user data from Supabase tables in order
      // 1. Delete shares (both as owner and viewer)
      await supabase.from("shares").delete().eq("owner_id", userId);
      await supabase.from("shares").delete().eq("viewer_id", userId);

      // 2. Delete share requests (both sent and received)
      await supabase.from("share_requests").delete().eq("from_user_id", userId);
      await supabase.from("share_requests").delete().eq("to_user_id", userId);

      // 3. Delete locked days
      await supabase.from("locked_days").delete().eq("user_id", userId);

      // 4. Delete suggestions
      await supabase.from("suggestions").delete().eq("user_id", userId);

      // 5. Delete log entries
      await supabase.from("log_entries").delete().eq("user_id", userId);

      // 6. Delete activity types
      await supabase.from("activity_types").delete().eq("user_id", userId);

      // 7. Delete profile
      await supabase.from("profiles").delete().eq("user_id", userId);

      // 8. Delete the auth user account using RPC function
      // Note: This requires creating the following function in Supabase SQL Editor:
      /*
        CREATE OR REPLACE FUNCTION delete_user_account()
        RETURNS void
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        BEGIN
          DELETE FROM auth.users WHERE id = auth.uid();
        END;
        $$;
      */
      const { error: deleteError } = await supabase.rpc("delete_user_account");

      if (deleteError) {
        console.error("Could not delete auth user:", deleteError.message);
        // Data is already deleted, user can still be removed manually from Supabase dashboard
      }

      // Clear all local storage
      if (typeof window !== "undefined") {
        localStorage.clear();
        // Clear IndexedDB
        const databases = await indexedDB.databases();
        for (const db of databases) {
          if (db.name) {
            indexedDB.deleteDatabase(db.name);
          }
        }
      }

      // Sign out
      await supabase.auth.signOut();

      // Update state
      setUser(null);
      setSession(null);
      setProfile(null);
      setNeedsProfileSetup(false);

      return { error: null };
    } catch (e) {
      console.error("Delete account error:", e);
      return { error: e as Error };
    }
  }, [user]);

  const createProfile = useCallback(
    async (fullName: string, avatar: string | null) => {
      if (!user) return { error: new Error("Not logged in") };

      const { error } = await supabase.from("profiles").insert({
        user_id: user.id,
        full_name: fullName,
        email: user.email,
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
        deleteAccount,
        deleteAllData,
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
