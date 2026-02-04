"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { ActivityType, LogEntry, Suggestion } from "@/types";
import * as db from "@/lib/db";
import * as cloudDb from "@/lib/supabase-sync";
import { getLockedDays, lockDay, unlockDay } from "@/lib/supabase";
import { useAuth } from "./AuthContext";

interface AppContextType {
  // Activity Types
  activityTypes: ActivityType[];
  allActivityTypes: ActivityType[]; // Including hidden ones for settings
  ownActivityTypes: ActivityType[]; // Main user's activity types (never changes when viewing shared data)
  addActivityType: (
    type: Omit<ActivityType, "id" | "createdAt">,
  ) => Promise<void>;
  updateActivityType: (type: ActivityType) => Promise<void>;
  deleteActivityType: (id: string) => Promise<void>;
  toggleActivityTypeHidden: (id: string) => Promise<void>;
  reorderActivityTypes: (reorderedTypes: ActivityType[]) => Promise<void>;

  // Entries
  entries: LogEntry[];
  addEntry: (
    entry: Omit<LogEntry, "id" | "createdAt" | "updatedAt">,
  ) => Promise<void>;
  updateEntry: (entry: LogEntry) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  loadEntriesForDateRange: (start: string, end: string) => Promise<void>;

  // Suggestions
  getSuggestions: (activityTypeId: string) => Promise<Suggestion[]>;

  // Workout history
  getWorkoutHistory: (
    activityTypeId: string,
    beforeDate: string,
  ) => Promise<LogEntry[]>;

  // Sync
  syncToCloud: () => Promise<void>;
  isSyncing: boolean;

  // State
  isLoading: boolean;
  selectedDate: string;
  setSelectedDate: (date: string) => void;

  // Viewing as another user (for shared data)
  viewingUser: {
    id: string;
    email: string;
    fullName?: string;
    activityTypeIds: string[];
    avatar?: string | null;
  } | null;
  setViewingUser: (
    user: {
      id: string;
      email: string;
      fullName?: string;
      activityTypeIds: string[];
      avatar?: string | null;
    } | null,
  ) => void;
  isViewingOther: boolean;

  // Locked days
  lockedDays: string[];
  isDayLocked: (date: string) => boolean;
  toggleDayLock: (date: string) => Promise<boolean>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [ownActivityTypes, setOwnActivityTypes] = useState<ActivityType[]>([]);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [currentDateRange, setCurrentDateRange] = useState<{
    start: string;
    end: string;
  } | null>(null);
  const [lockedDays, setLockedDays] = useState<string[]>([]);

  // Viewing as another user (shared data)
  const [viewingUser, setViewingUser] = useState<{
    id: string;
    email: string;
    fullName?: string;
    activityTypeIds: string[];
    avatar?: string | null;
  } | null>(null);
  const isViewingOther = viewingUser !== null;

  // Initialize database and load data
  useEffect(() => {
    async function init() {
      try {
        setIsLoading(true);

        if (user) {
          // User is logged in - load from Supabase only
          let types = await cloudDb.getActivityTypesFromSupabase(user.id);

          // If cloud is empty, create default activity types for the new user
          if (types.length === 0) {
            types = await cloudDb.initializeDefaultActivityTypes(user.id);
          }

          const sortedTypes = types.sort((a, b) => {
            const orderA = a.order ?? Infinity;
            const orderB = b.order ?? Infinity;
            if (orderA !== orderB) return orderA - orderB;
            return (
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
          });
          setActivityTypes(sortedTypes);
          setOwnActivityTypes(sortedTypes);

          // Load locked days
          const locked = await getLockedDays(user.id);
          setLockedDays(locked);
        } else {
          // Not logged in - use local IndexedDB
          await db.initDB();
          await db.initializeDefaultData();
          const types = await db.getActivityTypes();
          const sortedTypes = types.sort((a, b) => {
            const orderA = a.order ?? Infinity;
            const orderB = b.order ?? Infinity;
            if (orderA !== orderB) return orderA - orderB;
            return (
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
          });
          setActivityTypes(sortedTypes);
          setOwnActivityTypes(sortedTypes);
          setLockedDays([]);
        }

        setIsLoading(false);
      } catch (error) {
        console.error("Failed to initialize database:", error);
        setIsSyncing(false);
        setIsLoading(false);
      }
    }
    init();
  }, [user]);

  // Reload entries when user changes and we have a date range
  useEffect(() => {
    if (currentDateRange && !isLoading) {
      loadEntriesForDateRange(currentDateRange.start, currentDateRange.end);
    }
  }, [user, isLoading]);

  // Sync local data to cloud
  const syncToCloud = useCallback(async () => {
    if (!user) return;

    setIsSyncing(true);
    try {
      // Get all local data
      await db.initDB();
      const localTypes = await db.getActivityTypes();
      const localEntries = await db.getEntries("1900-01-01", "2100-12-31");

      // Upload to Supabase
      await cloudDb.syncLocalToSupabase(user.id, localTypes, localEntries);

      // Reload from cloud
      const cloudTypes = await cloudDb.getActivityTypesFromSupabase(user.id);
      setActivityTypes(cloudTypes);

      if (currentDateRange) {
        const cloudEntries = await cloudDb.getEntriesFromSupabase(
          user.id,
          currentDateRange.start,
          currentDateRange.end,
        );
        setEntries(cloudEntries);
      }
    } catch (error) {
      console.error("Sync failed:", error);
      // Re-throw as proper Error
      if (error instanceof Error) throw error;
      throw new Error(
        typeof error === "object" ? JSON.stringify(error) : String(error),
      );
    } finally {
      setIsSyncing(false);
    }
  }, [user, currentDateRange]);

  // Activity Types
  const addActivityType = useCallback(
    async (type: Omit<ActivityType, "id" | "createdAt">) => {
      if (user) {
        const newType = await cloudDb.addActivityTypeToSupabase(user.id, type);
        setActivityTypes((prev) => [...prev, newType]);
      } else {
        const newType = await db.addActivityType(type);
        setActivityTypes((prev) => [...prev, newType]);
      }
    },
    [user],
  );

  const updateActivityType = useCallback(
    async (type: ActivityType) => {
      if (user) {
        await cloudDb.updateActivityTypeInSupabase(type);
      } else {
        await db.updateActivityType(type);
      }
      setActivityTypes((prev) =>
        prev.map((t) => (t.id === type.id ? type : t)),
      );
    },
    [user],
  );

  const deleteActivityType = useCallback(
    async (id: string) => {
      if (user) {
        await cloudDb.deleteActivityTypeFromSupabase(id);
      } else {
        await db.deleteActivityType(id);
      }
      setActivityTypes((prev) => prev.filter((t) => t.id !== id));
    },
    [user],
  );

  const toggleActivityTypeHidden = useCallback(
    async (id: string) => {
      const type = activityTypes.find((t) => t.id === id);
      if (type) {
        const updated = { ...type, hidden: !type.hidden };
        if (user) {
          await cloudDb.updateActivityTypeInSupabase(updated);
        } else {
          await db.updateActivityType(updated);
        }
        setActivityTypes((prev) =>
          prev.map((t) => (t.id === id ? updated : t)),
        );
        setOwnActivityTypes((prev) =>
          prev.map((t) => (t.id === id ? updated : t)),
        );
      }
    },
    [activityTypes, user],
  );

  // Reorder activity types
  const reorderActivityTypes = useCallback(
    async (reorderedTypes: ActivityType[]) => {
      setActivityTypes(reorderedTypes);
      if (user) {
        await cloudDb.reorderActivityTypesInSupabase(reorderedTypes);
      } else {
        await db.reorderActivityTypes(reorderedTypes);
      }
    },
    [user],
  );

  // Entries
  const loadEntriesForDateRange = useCallback(
    async (start: string, end: string) => {
      setCurrentDateRange({ start, end });

      // If viewing another user's data, load their entries
      const targetUserId = viewingUser?.id || user?.id;

      if (targetUserId && user) {
        const loadedEntries = await cloudDb.getEntriesFromSupabase(
          targetUserId,
          start,
          end,
        );
        // Filter entries if viewing another user
        if (viewingUser) {
          const filteredEntries = loadedEntries.filter((e) =>
            viewingUser.activityTypeIds.includes(e.activityTypeId),
          );
          setEntries(filteredEntries);
        } else {
          setEntries(loadedEntries);
        }
      } else if (!user) {
        const loadedEntries = await db.getEntries(start, end);
        setEntries(loadedEntries);
      }
    },
    [user, viewingUser],
  );

  // Load activity types when viewingUser changes
  useEffect(() => {
    async function loadViewingUserData() {
      if (!user) return;

      if (viewingUser) {
        // Load the other user's activity types (filtered by shared IDs)
        try {
          const allTypes = await cloudDb.getActivityTypesFromSupabase(
            viewingUser.id,
          );

          // Only include activity types that were shared with us
          const sharedTypes = allTypes.filter((t) =>
            viewingUser.activityTypeIds.includes(t.id),
          );

          const sortedTypes = sharedTypes.sort((a, b) => {
            const orderA = a.order ?? Infinity;
            const orderB = b.order ?? Infinity;
            if (orderA !== orderB) return orderA - orderB;
            return (
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
          });
          setActivityTypes(sortedTypes);

          // Reload entries with a wide date range to ensure data is loaded
          const start = "2000-01-01";
          const today = new Date().toISOString().split("T")[0];
          const end = new Date(
            new Date(today).getTime() + 365 * 24 * 60 * 60 * 1000,
          )
            .toISOString()
            .split("T")[0];

          const loadedEntries = await cloudDb.getEntriesFromSupabase(
            viewingUser.id,
            start,
            end,
          );
          // Filter to only shared activity types
          const filteredEntries = loadedEntries.filter((e) =>
            viewingUser.activityTypeIds.includes(e.activityTypeId),
          );
          setEntries(filteredEntries);
          setCurrentDateRange({ start, end });
        } catch (error) {
          console.error("Failed to load viewing user data:", error);
        }
      } else {
        // Load own activity types
        try {
          const types = await cloudDb.getActivityTypesFromSupabase(user.id);
          const sortedTypes = types.sort((a, b) => {
            const orderA = a.order ?? Infinity;
            const orderB = b.order ?? Infinity;
            if (orderA !== orderB) return orderA - orderB;
            return (
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
          });
          setActivityTypes(sortedTypes);
          setOwnActivityTypes(sortedTypes);

          // Reload entries for current date range
          if (currentDateRange) {
            const loadedEntries = await cloudDb.getEntriesFromSupabase(
              user.id,
              currentDateRange.start,
              currentDateRange.end,
            );
            setEntries(loadedEntries);
          }
        } catch (error) {
          console.error("Failed to load own data:", error);
        }
      }
    }

    loadViewingUserData();
  }, [viewingUser, user]);

  const addEntry = useCallback(
    async (entry: Omit<LogEntry, "id" | "createdAt" | "updatedAt">) => {
      if (user) {
        const newEntry = await cloudDb.addEntryToSupabase(user.id, entry);
        setEntries((prev) => [...prev, newEntry]);

        // Add suggestion for text values
        if (typeof entry.value === "string" && entry.value.trim()) {
          await cloudDb.addOrUpdateSuggestionInSupabase(
            user.id,
            entry.activityTypeId,
            entry.value,
          );
        }
      } else {
        const newEntry = await db.addEntry(entry);
        setEntries((prev) => [...prev, newEntry]);

        // Add suggestion for text values
        if (typeof entry.value === "string" && entry.value.trim()) {
          await db.addOrUpdateSuggestion(entry.activityTypeId, entry.value);
        }
      }
    },
    [user],
  );

  const updateEntry = useCallback(
    async (entry: LogEntry) => {
      if (user) {
        const updated = await cloudDb.updateEntryInSupabase(entry);
        setEntries((prev) =>
          prev.map((e) => (e.id === entry.id ? updated : e)),
        );
      } else {
        const updated = await db.updateEntry(entry);
        setEntries((prev) =>
          prev.map((e) => (e.id === entry.id ? updated : e)),
        );
      }
    },
    [user],
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      if (user) {
        await cloudDb.deleteEntryFromSupabase(id);
      } else {
        await db.deleteEntry(id);
      }
      setEntries((prev) => prev.filter((e) => e.id !== id));
    },
    [user],
  );

  // Suggestions
  const getSuggestions = useCallback(
    async (activityTypeId: string) => {
      if (user) {
        return cloudDb.getSuggestionsFromSupabase(user.id, activityTypeId);
      }
      return db.getSuggestions(activityTypeId);
    },
    [user],
  );

  // Get workout history (last 90 days before specified date)
  const getWorkoutHistory = useCallback(
    async (activityTypeId: string, beforeDate: string): Promise<LogEntry[]> => {
      const startDate = new Date(beforeDate);
      startDate.setDate(startDate.getDate() - 90);
      const start = startDate.toISOString().split("T")[0];
      // Get entries up to the day before
      const endDate = new Date(beforeDate);
      endDate.setDate(endDate.getDate() - 1);
      const end = endDate.toISOString().split("T")[0];

      let historyEntries: LogEntry[] = [];
      if (user) {
        historyEntries = await cloudDb.getEntriesFromSupabase(
          user.id,
          start,
          end,
        );
      } else {
        historyEntries = await db.getEntries(start, end);
      }

      // Filter for workout entries of this type
      return historyEntries.filter(
        (e) => e.activityTypeId === activityTypeId && e.workoutData?.exercises,
      );
    },
    [user],
  );

  // Locked days
  const isDayLocked = useCallback(
    (date: string) => {
      return lockedDays.includes(date);
    },
    [lockedDays],
  );

  const toggleDayLock = useCallback(
    async (date: string): Promise<boolean> => {
      if (!user) return false;

      const isLocked = lockedDays.includes(date);

      if (isLocked) {
        const success = await unlockDay(user.id, date);
        if (success) {
          setLockedDays((prev) => prev.filter((d) => d !== date));
        }
        return !isLocked; // Return new state (unlocked = false)
      } else {
        const success = await lockDay(user.id, date);
        if (success) {
          setLockedDays((prev) => [...prev, date]);
        }
        return !isLocked; // Return new state (locked = true)
      }
    },
    [user, lockedDays],
  );

  // Filter out hidden activity types for normal use
  const visibleActivityTypes = activityTypes.filter((t) => !t.hidden);

  return (
    <AppContext.Provider
      value={{
        activityTypes: visibleActivityTypes,
        allActivityTypes: activityTypes,
        ownActivityTypes,
        addActivityType,
        updateActivityType,
        deleteActivityType,
        toggleActivityTypeHidden,
        reorderActivityTypes,
        entries,
        addEntry,
        updateEntry,
        deleteEntry,
        loadEntriesForDateRange,
        getSuggestions,
        getWorkoutHistory,
        syncToCloud,
        isSyncing,
        isLoading,
        selectedDate,
        setSelectedDate,
        viewingUser,
        setViewingUser,
        isViewingOther,
        lockedDays,
        isDayLocked,
        toggleDayLock,
      }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }
  return context;
}
