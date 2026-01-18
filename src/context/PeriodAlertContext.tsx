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
import { getSharedEntries } from "@/lib/sharing";

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
  triggerTestAlert: () => void;
  checkNow: (forceAlertFriendId?: string) => Promise<void>;
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

  // Test function to trigger a sample alert
  const triggerTestAlert = useCallback(() => {
    setCurrentAlert({
      friendId: "test-123",
      friendEmail: "test@example.com",
      friendName: "Test Friend",
      currentMood: "sad",
      previousMood: "happy",
    });
  }, []);

  // Function to check period moods - extracted so it can be called manually
  const checkPeriodMoods = useCallback(
    async (forceAlert?: string) => {
      if (!user) return;

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

        // Get entries from last 30 days to find most recent mood
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const startDate = thirtyDaysAgo.toISOString().split("T")[0];
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

          // Get Period entries for this friend from last 30 days
          try {
            const entries = await getSharedEntries(
              friendId,
              [periodActivity.id],
              startDate,
              today
            );

            // Filter to only period entries and sort by date descending
            const periodEntries = entries
              .filter((e) => e.activityTypeId === periodActivity.id)
              .sort((a, b) => b.date.localeCompare(a.date));

            if (periodEntries.length === 0) continue;

            // Get the most recent entry
            const latestEntry = periodEntries[0];
            const currentMood = String(latestEntry.value);
            const latestDate = latestEntry.date;

            const lastSeenKey = `periodMoodSeen_${friendId}`;
            const lastSeenData = localStorage.getItem(lastSeenKey);

            let lastSeenMood: string | null = null;
            let lastSeenDate: string | null = null;

            if (lastSeenData) {
              try {
                const parsed = JSON.parse(lastSeenData);
                lastSeenMood = parsed.mood;
                lastSeenDate = parsed.date;
              } catch {
                // Old format, just mood string
                lastSeenMood = lastSeenData;
              }
            }

            // Check if mood has changed from what we last saw
            // Alert when: mood is different OR it's a new entry on a new date with different mood
            const moodChanged = currentMood !== lastSeenMood;

            // Force alert when first enabling (forceAlert = friendId)
            const shouldForceAlert = forceAlert === friendId;

            if ((moodChanged && lastSeenMood !== null) || shouldForceAlert) {
              // Get friend's profile for their name
              const { data: profile } = await supabase
                .from("profiles")
                .select("full_name, email")
                .eq("user_id", friendId)
                .single();

              // Save new state with date instead of time
              localStorage.setItem(
                lastSeenKey,
                JSON.stringify({
                  mood: currentMood,
                  date: latestDate,
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
            } else if (lastSeenMood === null || lastSeenDate !== latestDate) {
              // First time seeing this friend's mood OR new date with same mood
              // Just save without alerting
              localStorage.setItem(
                lastSeenKey,
                JSON.stringify({
                  mood: currentMood,
                  date: latestDate,
                })
              );
            }
          } catch {
            // Could not get entries for friend
          }
        }
      } catch (error) {
        console.error("[PeriodAlert] Error checking period moods:", error);
      }
    },
    [user]
  );

  // Expose checkNow for manual triggering (with optional forceAlert for friend)
  const checkNow = useCallback(
    async (forceAlertFriendId?: string) => {
      await checkPeriodMoods(forceAlertFriendId);
    },
    [checkPeriodMoods]
  );

  // Poll for period mood changes every 10 seconds
  useEffect(() => {
    if (!user) return;

    // Check immediately on mount
    checkPeriodMoods();

    // Then poll every 10 seconds
    const interval = setInterval(() => {
      checkPeriodMoods();
    }, 10000);

    return () => {
      clearInterval(interval);
    };
  }, [user, checkPeriodMoods]);

  return (
    <PeriodAlertContext.Provider
      value={{ currentAlert, dismissAlert, triggerTestAlert, checkNow }}>
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
