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
import { getLatestUnreadMessages } from "@/lib/chat";

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
  type?: "activity" | "chat";
  messagePreview?: string;
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
  addChatNotification: (
    friendId: string,
    friendName: string,
    friendAvatar: string | null,
    message: string,
  ) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

const STORAGE_KEY_NOTIFICATIONS = "activityNotifications";
const STORAGE_KEY_SUBSCRIPTIONS = "activitySubscriptions";
const STORAGE_KEY_LAST_SEEN = "activityLastSeen";
const STORAGE_KEY_SEEN_MESSAGES = "seenChatMessageIds";

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

  // Sort notifications: unread chat first, then by time
  const sortedNotifications = [...notifications].sort((a, b) => {
    const aChat = a.type === "chat" && !a.read;
    const bChat = b.type === "chat" && !b.read;
    if (aChat && !bChat) return -1;
    if (!aChat && bChat) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

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

  const addChatNotification = useCallback(
    (
      friendId: string,
      friendName: string,
      friendAvatar: string | null,
      message: string,
    ) => {
      const notification: ActivityNotification = {
        id: crypto.randomUUID(),
        friendId,
        friendName,
        friendAvatar,
        activityId: "chat",
        activityName: "Message",
        activityIcon: "💬",
        value: message,
        date: new Date().toISOString().split("T")[0],
        createdAt: new Date().toISOString(),
        read: false,
        type: "chat",
        messagePreview:
          message.length > 50 ? message.slice(0, 50) + "..." : message,
      };
      setNotifications((prev) => {
        // Dedupe: don't add if same friend + same message within last minute
        const isDupe = prev.some(
          (n) =>
            n.type === "chat" &&
            n.friendId === friendId &&
            n.value === message &&
            Date.now() - new Date(n.createdAt).getTime() < 60000,
        );
        if (isDupe) return prev;
        return [notification, ...prev].slice(0, 50);
      });
    },
    [],
  );

  // Check for updates from subscribed activities and new chat messages
  const checkForUpdates = useCallback(async () => {
    if (!user) return;

    try {
      // --- Check for new chat messages ---
      try {
        const unreadMessages = await getLatestUnreadMessages(user.id);
        if (unreadMessages.length > 0) {
          // Get seen message IDs from localStorage
          let seenIds: string[] = [];
          try {
            const stored = localStorage.getItem(STORAGE_KEY_SEEN_MESSAGES);
            if (stored) seenIds = JSON.parse(stored);
          } catch {
            /* empty */
          }

          const newMessages = unreadMessages.filter(
            (msg) => !seenIds.includes(msg.id),
          );

          if (newMessages.length > 0) {
            // Fetch sender profiles
            const senderIds = [...new Set(newMessages.map((m) => m.senderId))];
            const { data: profiles } = await supabase
              .from("profiles")
              .select("user_id, full_name, avatar")
              .in("user_id", senderIds);

            const profileMap: Record<
              string,
              { full_name: string; avatar: string | null }
            > = {};
            (profiles || []).forEach((p) => {
              profileMap[p.user_id] = p;
            });

            const chatNotifications: ActivityNotification[] = newMessages.map(
              (msg) => ({
                id: crypto.randomUUID(),
                friendId: msg.senderId,
                friendName: profileMap[msg.senderId]?.full_name || "Friend",
                friendAvatar: profileMap[msg.senderId]?.avatar || null,
                activityId: "chat",
                activityName: "Message",
                activityIcon: "\ud83d\udcac",
                value: msg.content,
                date: new Date(msg.createdAt).toISOString().split("T")[0],
                createdAt: msg.createdAt,
                read: false,
                type: "chat" as const,
                messagePreview:
                  msg.content.length > 50
                    ? msg.content.slice(0, 50) + "..."
                    : msg.content,
              }),
            );

            if (chatNotifications.length > 0) {
              setNotifications((prev) => {
                const existingKeys = new Set(
                  prev.map(
                    (n) => `${n.friendId}_${n.type || "activity"}_${n.value}`,
                  ),
                );
                const uniqueNew = chatNotifications.filter(
                  (n) => !existingKeys.has(`${n.friendId}_chat_${n.value}`),
                );
                return [...uniqueNew, ...prev].slice(0, 50);
              });
            }

            // Save seen IDs
            const allSeenIds = [
              ...seenIds,
              ...newMessages.map((m) => m.id),
            ].slice(-100);
            localStorage.setItem(
              STORAGE_KEY_SEEN_MESSAGES,
              JSON.stringify(allSeenIds),
            );
          }
        }
      } catch (chatError) {
        // Chat table might not exist yet - silently ignore
        console.debug("[Notifications] Chat check skipped:", chatError);
      }

      // --- Check for activity updates ---
      if (subscriptions.length === 0) return;
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
        notifications: sortedNotifications,
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
        addChatNotification,
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
