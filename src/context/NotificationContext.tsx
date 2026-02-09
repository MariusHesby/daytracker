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

// Types for activity notifications
export interface ActivityNotification {
  id: string;
  friendId: string;
  friendName: string;
  friendAvatar: string | null;
  activityId: string;
  activityName: string;
  activityIcon: string;
  value: string;
  date: string;
  createdAt: string;
  read: boolean;
}

export interface NotificationSubscription {
  friendId: string;
  activityId: string;
}

interface NotificationContextType {
  notifications: ActivityNotification[];
  unreadCount: number;
  subscriptions: NotificationSubscription[];
  addSubscription: (friendId: string, activityId: string) => void;
  removeSubscription: (friendId: string, activityId: string) => void;
  isSubscribed: (friendId: string, activityId: string) => boolean;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  clearNotification: (notificationId: string) => void;
  clearAllNotifications: () => void;
  checkForUpdates: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

const STORAGE_KEY_NOTIFICATIONS = "activityNotifications";
const STORAGE_KEY_SUBSCRIPTIONS = "activitySubscriptions";
const STORAGE_KEY_LAST_SEEN = "activityLastSeen";

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<ActivityNotification[]>(
    [],
  );
  const [subscriptions, setSubscriptions] = useState<
    NotificationSubscription[]
  >([]);
  const [lastSeen, setLastSeen] = useState<
    Record<string, Record<string, string>>
  >({});

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedNotifications = localStorage.getItem(STORAGE_KEY_NOTIFICATIONS);
    if (storedNotifications) {
      try {
        setNotifications(JSON.parse(storedNotifications));
      } catch {
        // Invalid data
      }
    }

    const storedSubscriptions = localStorage.getItem(STORAGE_KEY_SUBSCRIPTIONS);
    if (storedSubscriptions) {
      try {
        setSubscriptions(JSON.parse(storedSubscriptions));
      } catch {
        // Invalid data
      }
    }

    const storedLastSeen = localStorage.getItem(STORAGE_KEY_LAST_SEEN);
    if (storedLastSeen) {
      try {
        setLastSeen(JSON.parse(storedLastSeen));
      } catch {
        // Invalid data
      }
    }
  }, []);

  // Save notifications to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(
      STORAGE_KEY_NOTIFICATIONS,
      JSON.stringify(notifications),
    );
  }, [notifications]);

  // Save subscriptions to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(
      STORAGE_KEY_SUBSCRIPTIONS,
      JSON.stringify(subscriptions),
    );
  }, [subscriptions]);

  // Save lastSeen to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY_LAST_SEEN, JSON.stringify(lastSeen));
  }, [lastSeen]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const addSubscription = useCallback(
    (friendId: string, activityId: string) => {
      // Don't allow subscribing to own activities
      if (user && friendId === user.id) return;
      
      setSubscriptions((prev) => {
        const exists = prev.some(
          (s) => s.friendId === friendId && s.activityId === activityId,
        );
        if (exists) return prev;
        return [...prev, { friendId, activityId }];
      });
    },
    [user],
  );

  const removeSubscription = useCallback(
    (friendId: string, activityId: string) => {
      setSubscriptions((prev) =>
        prev.filter(
          (s) => !(s.friendId === friendId && s.activityId === activityId),
        ),
      );
    },
    [],
  );

  const isSubscribed = useCallback(
    (friendId: string, activityId: string) => {
      return subscriptions.some(
        (s) => s.friendId === friendId && s.activityId === activityId,
      );
    },
    [subscriptions],
  );

  const markAsRead = useCallback((notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearNotification = useCallback((notificationId: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Check for updates from subscribed activities
  const checkForUpdates = useCallback(async () => {
    if (!user || subscriptions.length === 0) return;

    try {
      // Group subscriptions by friend, excluding self
      const subscriptionsByFriend = subscriptions
        .filter((sub) => sub.friendId !== user.id) // Don't check own activities
        .reduce(
          (acc, sub) => {
            if (!acc[sub.friendId]) {
              acc[sub.friendId] = [];
            }
            acc[sub.friendId].push(sub.activityId);
            return acc;
          },
          {} as Record<string, string[]>,
        );

      // If no subscriptions after filtering self, exit early
      if (Object.keys(subscriptionsByFriend).length === 0) return;

      const today = new Date().toISOString().split("T")[0];
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const startDate = thirtyDaysAgo.toISOString().split("T")[0];

      // Get current lastSeen from localStorage to avoid stale state
      let currentLastSeen: Record<string, Record<string, string>> = {};
      try {
        const stored = localStorage.getItem(STORAGE_KEY_LAST_SEEN);
        if (stored) currentLastSeen = JSON.parse(stored);
      } catch {
        // Use empty object
      }

      const newLastSeen = { ...currentLastSeen };
      const newNotifications: ActivityNotification[] = [];

      // Fetch all data in parallel for speed
      const friendPromises = Object.entries(subscriptionsByFriend).map(
        async ([friendId, activityIds]) => {
          // Get friend's profile and activity types in parallel
          const [profileResult, activityTypesResult] = await Promise.all([
            supabase
              .from("profiles")
              .select("full_name, avatar")
              .eq("user_id", friendId)
              .single(),
            supabase
              .from("activity_types")
              .select("id, name, icon")
              .eq("user_id", friendId)
              .in("id", activityIds),
          ]);

          const profile = profileResult.data;
          const activityTypes = activityTypesResult.data;

          if (!activityTypes) return;

          // Get entries for subscribed activities
          try {
            const entries = await getSharedEntries(
              friendId,
              activityIds,
              startDate,
              today,
            );

            for (const activity of activityTypes) {
              const activityEntries = entries
                .filter((e) => e.activityTypeId === activity.id)
                .sort(
                  (a, b) =>
                    new Date(b.updatedAt).getTime() -
                    new Date(a.updatedAt).getTime(),
                );

              if (activityEntries.length === 0) continue;

              const latestEntry = activityEntries[0];
              // Use updatedAt in the key to catch edits too
              const entryKey = `${latestEntry.id}_${latestEntry.updatedAt.toISOString()}`;

              // Check if we've seen this entry before
              if (!newLastSeen[friendId]) {
                newLastSeen[friendId] = {};
              }

              const lastSeenEntry = newLastSeen[friendId][activity.id];

              if (lastSeenEntry !== entryKey) {
                // New or updated entry - create notification
                // Only notify if we had a previous value (not first time subscribing)
                if (lastSeenEntry) {
                  // Format the display value nicely
                  let displayValue = String(latestEntry.value);

                  newNotifications.push({
                    id: crypto.randomUUID(),
                    friendId,
                    friendName: profile?.full_name || "Friend",
                    friendAvatar: profile?.avatar || null,
                    activityId: activity.id,
                    activityName: activity.name,
                    activityIcon: activity.icon || "📊",
                    value: displayValue,
                    date: latestEntry.date,
                    createdAt: new Date().toISOString(),
                    read: false,
                  });
                }

                // Update last seen
                newLastSeen[friendId][activity.id] = entryKey;
              }
            }
          } catch {
            // Could not get entries for friend
          }
        },
      );

      await Promise.all(friendPromises);

      // Save lastSeen immediately to localStorage
      localStorage.setItem(STORAGE_KEY_LAST_SEEN, JSON.stringify(newLastSeen));
      setLastSeen(newLastSeen);

      if (newNotifications.length > 0) {
        setNotifications((prev) => {
          // Dedupe by friendId + activityId + date + value to avoid duplicates
          const existingKeys = new Set(
            prev.map(
              (n) => `${n.friendId}_${n.activityId}_${n.date}_${n.value}`,
            ),
          );
          const uniqueNew = newNotifications.filter(
            (n) =>
              !existingKeys.has(
                `${n.friendId}_${n.activityId}_${n.date}_${n.value}`,
              ),
          );
          return [...uniqueNew, ...prev].slice(0, 50); // Keep max 50
        });
      }
    } catch (error) {
      console.error("[Notifications] Error checking for updates:", error);
    }
  }, [user, subscriptions]);

  // Poll for updates every 10 seconds
  useEffect(() => {
    if (!user) return;

    // Check immediately on mount
    checkForUpdates();

    // Then poll every 10 seconds for faster updates
    const interval = setInterval(() => {
      checkForUpdates();
    }, 10000);

    return () => {
      clearInterval(interval);
    };
  }, [user, checkForUpdates]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        subscriptions,
        addSubscription,
        removeSubscription,
        isSubscribed,
        markAsRead,
        markAllAsRead,
        clearNotification,
        clearAllNotifications,
        checkForUpdates,
      }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotifications must be used within NotificationProvider",
    );
  }
  return context;
}
