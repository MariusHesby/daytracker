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
import { useAuth } from "./AuthContext";

interface AppContextType {
  // Activity Types
  activityTypes: ActivityType[];
  allActivityTypes: ActivityType[]; // Including hidden ones for settings
  addActivityType: (
    type: Omit<ActivityType, "id" | "createdAt">
  ) => Promise<void>;
  updateActivityType: (type: ActivityType) => Promise<void>;
  deleteActivityType: (id: string) => Promise<void>;
  toggleActivityTypeHidden: (id: string) => Promise<void>;
  reorderActivityTypes: (reorderedTypes: ActivityType[]) => Promise<void>;

  // Entries
  entries: LogEntry[];
  addEntry: (
    entry: Omit<LogEntry, "id" | "createdAt" | "updatedAt">
  ) => Promise<void>;
  updateEntry: (entry: LogEntry) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  loadEntriesForDateRange: (start: string, end: string) => Promise<void>;

  // Suggestions
  getSuggestions: (activityTypeId: string) => Promise<Suggestion[]>;

  // Sync
  syncToCloud: () => Promise<void>;
  isSyncing: boolean;

  // State
  isLoading: boolean;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
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

  // Initialize database and load data
  useEffect(() => {
    async function init() {
      try {
        setIsLoading(true);

        if (user) {
          // User is logged in - load from Supabase
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
        }

        setIsLoading(false);
      } catch (error) {
        console.error("Failed to initialize database:", error);
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
          currentDateRange.end
        );
        setEntries(cloudEntries);
      }
    } catch (error) {
      console.error("Sync failed:", error);
      throw error;
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
    [user]
  );

  const updateActivityType = useCallback(
    async (type: ActivityType) => {
      if (user) {
        await cloudDb.updateActivityTypeInSupabase(type);
      } else {
        await db.updateActivityType(type);
      }
      setActivityTypes((prev) =>
        prev.map((t) => (t.id === type.id ? type : t))
      );
    },
    [user]
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
    [user]
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
          prev.map((t) => (t.id === id ? updated : t))
        );
      }
    },
    [activityTypes, user]
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
    [user]
  );

  // Entries
  const loadEntriesForDateRange = useCallback(
    async (start: string, end: string) => {
      setCurrentDateRange({ start, end });
      if (user) {
        const loadedEntries = await cloudDb.getEntriesFromSupabase(
          user.id,
          start,
          end
        );
        setEntries(loadedEntries);
      } else {
        const loadedEntries = await db.getEntries(start, end);
        setEntries(loadedEntries);
      }
    },
    [user]
  );

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
            entry.value
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
    [user]
  );

  const updateEntry = useCallback(
    async (entry: LogEntry) => {
      if (user) {
        const updated = await cloudDb.updateEntryInSupabase(entry);
        setEntries((prev) =>
          prev.map((e) => (e.id === entry.id ? updated : e))
        );
      } else {
        const updated = await db.updateEntry(entry);
        setEntries((prev) =>
          prev.map((e) => (e.id === entry.id ? updated : e))
        );
      }
    },
    [user]
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
    [user]
  );

  // Suggestions
  const getSuggestions = useCallback(
    async (activityTypeId: string) => {
      if (user) {
        return cloudDb.getSuggestionsFromSupabase(user.id, activityTypeId);
      }
      return db.getSuggestions(activityTypeId);
    },
    [user]
  );

  // Filter out hidden activity types for normal use
  const visibleActivityTypes = activityTypes.filter((t) => !t.hidden);

  return (
    <AppContext.Provider
      value={{
        activityTypes: visibleActivityTypes,
        allActivityTypes: activityTypes,
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
        syncToCloud,
        isSyncing,
        isLoading,
        selectedDate,
        setSelectedDate,
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
