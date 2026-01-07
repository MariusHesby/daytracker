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

  // State
  isLoading: boolean;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  // Initialize database and load data
  useEffect(() => {
    async function init() {
      try {
        await db.initDB();
        await db.initializeDefaultData();
        const types = await db.getActivityTypes();
        // Sort by order field, then by createdAt for types without order
        const sortedTypes = types.sort((a, b) => {
          const orderA = a.order ?? Infinity;
          const orderB = b.order ?? Infinity;
          if (orderA !== orderB) return orderA - orderB;
          return (
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        });
        setActivityTypes(sortedTypes);
        setIsLoading(false);
      } catch (error) {
        console.error("Failed to initialize database:", error);
        setIsLoading(false);
      }
    }
    init();
  }, []);

  // Activity Types
  const addActivityType = useCallback(
    async (type: Omit<ActivityType, "id" | "createdAt">) => {
      const newType = await db.addActivityType(type);
      setActivityTypes((prev) => [...prev, newType]);
    },
    []
  );

  const updateActivityType = useCallback(async (type: ActivityType) => {
    await db.updateActivityType(type);
    setActivityTypes((prev) => prev.map((t) => (t.id === type.id ? type : t)));
  }, []);

  const deleteActivityType = useCallback(async (id: string) => {
    await db.deleteActivityType(id);
    setActivityTypes((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toggleActivityTypeHidden = useCallback(
    async (id: string) => {
      const type = activityTypes.find((t) => t.id === id);
      if (type) {
        const updated = { ...type, hidden: !type.hidden };
        await db.updateActivityType(updated);
        setActivityTypes((prev) =>
          prev.map((t) => (t.id === id ? updated : t))
        );
      }
    },
    [activityTypes]
  );

  // Reorder activity types and persist to IndexedDB
  const reorderActivityTypes = useCallback(
    async (reorderedTypes: ActivityType[]) => {
      setActivityTypes(reorderedTypes);
      await db.reorderActivityTypes(reorderedTypes);
    },
    []
  );

  // Entries
  const loadEntriesForDateRange = useCallback(
    async (start: string, end: string) => {
      const loadedEntries = await db.getEntries(start, end);
      setEntries(loadedEntries);
    },
    []
  );

  const addEntry = useCallback(
    async (entry: Omit<LogEntry, "id" | "createdAt" | "updatedAt">) => {
      const newEntry = await db.addEntry(entry);
      setEntries((prev) => [...prev, newEntry]);

      // Add suggestion for text values
      if (typeof entry.value === "string" && entry.value.trim()) {
        await db.addOrUpdateSuggestion(entry.activityTypeId, entry.value);
      }
    },
    []
  );

  const updateEntry = useCallback(async (entry: LogEntry) => {
    const updated = await db.updateEntry(entry);
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? updated : e)));
  }, []);

  const deleteEntry = useCallback(async (id: string) => {
    await db.deleteEntry(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  // Suggestions
  const getSuggestions = useCallback(async (activityTypeId: string) => {
    return db.getSuggestions(activityTypeId);
  }, []);

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
