"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import { supabase } from "@/lib/supabase";

interface PeriodAlert {
  friendId: string;
  friendEmail: string;
  friendName: string;
  currentMood: string;
  previousMood: string | null;
}

interface PeriodAlertContextType {
  currentAlert: PeriodAlert | null;
  dismissAlert: () => void;
}

const PeriodAlertContext = createContext<PeriodAlertContextType | undefined>(
  undefined
);

export function PeriodAlertProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [currentAlert, setCurrentAlert] = useState<PeriodAlert | null>(null);

  const dismissAlert = useCallback(() => {
    setCurrentAlert(null);
  }, []);

  // Poll for period mood changes every 30 seconds
  useEffect(() => {
    if (!user) return;

    const checkPeriodMoods = async () => {
      try {
        // Get list of friends with period alerts enabled
        const periodAlertFriendsList = JSON.parse(
          localStorage.getItem("periodAlertFriendsList") || "[]"
        );

        if (periodAlertFriendsList.length === 0) return;

        // Get shares where I'm the viewer
        const { data: shares } = await supabase
          .from("shares")
          .select("owner_id, activity_type_ids")
          .eq("viewer_id", user.id);

        if (!shares || shares.length === 0) return;

        const today = new Date().toISOString().split("T")[0];

        for (const share of shares) {
          const friendId = share.owner_id;

          // Skip if we don't have alerts enabled for this friend
          if (!periodAlertFriendsList.includes(friendId)) continue;

          // Get friend's activity types to find Period
          const { data: friendActivityTypes } = await supabase
            .from("activity_types")
            .select("id, name, value_type")
            .eq("user_id", friendId)
            .in("id", share.activity_type_ids || []);

          if (!friendActivityTypes) continue;

          // Find Period activity with mood type
          const periodActivity = friendActivityTypes.find(
            (at) =>
              at.name.toLowerCase() === "period" && at.value_type === "mood"
          );

          if (!periodActivity) continue;

          // Get today's Period entry for this friend
          const { data: periodEntry } = await supabase
            .from("log_entries")
            .select("value, updated_at")
            .eq("user_id", friendId)
            .eq("activity_type_id", periodActivity.id)
            .eq("date", today)
            .order("updated_at", { ascending: false })
            .limit(1)
            .single();

          if (!periodEntry) continue;

          const currentMood = String(periodEntry.value);
          const lastSeenKey = `periodMoodSeen_${friendId}`;
          const lastSeenData = localStorage.getItem(lastSeenKey);

          let lastSeenMood: string | null = null;
          let lastSeenTime: string | null = null;

          if (lastSeenData) {
            try {
              const parsed = JSON.parse(lastSeenData);
              lastSeenMood = parsed.mood;
              lastSeenTime = parsed.time;
            } catch {
              // Old format, just mood string
              lastSeenMood = lastSeenData;
            }
          }

          // Check if this is a new update (mood changed OR entry was updated after last check)
          const entryUpdatedAt = new Date(periodEntry.updated_at).getTime();
          const lastCheckTime = lastSeenTime
            ? new Date(lastSeenTime).getTime()
            : 0;

          const isNewUpdate =
            currentMood !== lastSeenMood || entryUpdatedAt > lastCheckTime;

          if (isNewUpdate && lastSeenMood !== null) {
            // Get friend's profile for their name
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name, email")
              .eq("user_id", friendId)
              .single();

            // Save new state
            localStorage.setItem(
              lastSeenKey,
              JSON.stringify({
                mood: currentMood,
                time: new Date().toISOString(),
              })
            );

            // Show alert
            setCurrentAlert({
              friendId,
              friendEmail: profile?.email || "Friend",
              friendName: profile?.full_name || profile?.email || "Friend",
              currentMood,
              previousMood: lastSeenMood,
            });

            // Only show one alert at a time
            return;
          } else if (lastSeenMood === null) {
            // First time seeing this friend's mood, just save without alerting
            localStorage.setItem(
              lastSeenKey,
              JSON.stringify({
                mood: currentMood,
                time: new Date().toISOString(),
              })
            );
          }
        }
      } catch (error) {
        console.error("Error checking period moods:", error);
      }
    };

    // Check immediately on mount
    checkPeriodMoods();

    // Then poll every 30 seconds
    const interval = setInterval(checkPeriodMoods, 30000);

    return () => clearInterval(interval);
  }, [user]);

  return (
    <PeriodAlertContext.Provider value={{ currentAlert, dismissAlert }}>
      {children}
    </PeriodAlertContext.Provider>
  );
}

export function usePeriodAlert() {
  const context = useContext(PeriodAlertContext);
  if (!context) {
    throw new Error("usePeriodAlert must be used within PeriodAlertProvider");
  }
  return context;
}
