"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import {
  ActivityType,
  Suggestion,
  NutritionData,
  LogEntry,
  WorkoutExercise,
  WorkoutData,
  CustomExercise,
  WorkoutRoutine,
  ChecklistItem,
  ChecklistData,
  ChecklistRepeat,
  TimerData,
  TimerEntry,
  TimerAdjustment,
  ROUTINE_COLORS,
  COMMON_EXERCISES,
  CoachData,
  CoachLineupEntry,
  CoachSubstitution,
  FootballPosition,
  FOOTBALL_POSITIONS,
} from "@/types";
import { cn, addDays, getMonday, toDateStr } from "@/lib/utils";
import { getMediaMetadata } from "@/lib/supabase-sync";
import { Icon, icons, IconName } from "./Icons";
import { MediaSearch } from "./MediaSearch";
import { CoachMatchPanel } from "./CoachMatchPanel";
import {
  fetchAllFunFacts,
  getSelectedCategories,
  FunFact,
} from "@/lib/funfacts";

interface EntryFormProps {
  date: string;
  onSuccess?: () => void;
  viewMode?: "list" | "icons";
  onViewModeChange?: (mode: "list" | "icons") => void;
  newsIcon?: {
    visible: boolean;
    hasUnread: boolean;
    loading: boolean;
    onClick: () => void;
  };
}

type SavedValue = {
  value: string | number | boolean;
  id: string;
  nutritionData?: NutritionData;
};

// Confetti particle for celebration
interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  rotation: number;
  velocityX: number;
  velocityY: number;
}

/**
 * Compute the status color for a timer subject based on period progress.
 * Returns 'green' | 'yellow' | 'red' and the usage/expected ratio.
 */
function getTimerSubjectStatus(
  subjectId: string,
  limitMinutes: number,
  limitPeriod: "daily" | "weekly" | "monthly",
  currentDate: string,
  allEntries: LogEntry[],
  activityTypeId: string,
): {
  color: "green" | "yellow" | "red";
  usedMinutes: number;
  expectedMinutes: number;
  periodProgress: number;
  totalDays: number;
  dayNumber: number;
} {
  const d = new Date(currentDate + "T12:00:00");

  let periodStart: string;
  let dayNumber: number;
  let totalDays: number;

  if (limitPeriod === "daily") {
    periodStart = currentDate;
    dayNumber = 1;
    totalDays = 1;
  } else if (limitPeriod === "weekly") {
    const monday = getMonday(d);
    periodStart = toDateStr(monday);
    // dayNumber: Mon=1, Tue=2, ..., Sun=7
    const dayOfWeek = d.getDay();
    dayNumber = dayOfWeek === 0 ? 7 : dayOfWeek;
    totalDays = 7;
  } else {
    // monthly
    periodStart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    dayNumber = d.getDate();
    // Total days in month
    totalDays = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  }

  // Collect all entries for this activity type within the period up to (and including) current date
  let usedMinutes = 0;
  allEntries.forEach((entry) => {
    if (
      entry.activityTypeId === activityTypeId &&
      entry.date >= periodStart &&
      entry.date <= currentDate &&
      entry.timerData?.entries
    ) {
      const te = entry.timerData.entries.find((e) => e.subjectId === subjectId);
      if (te) {
        // te.minutes = baseInput + addTotal (stored format)
        // te.subtractMinutes = subtractTotal
        // Adds increase the budget, subtracts decrease it.
        // effectiveUsed = baseInput - addTotal + subtractTotal
        //               = (te.minutes - addTotal) - addTotal + subtractTotal
        const adjs = te.adjustments || [];
        const adjAdd = adjs
          .filter((a) => a.type === "add")
          .reduce((s, a) => s + a.minutes, 0);
        const adjSub = adjs
          .filter((a) => a.type === "subtract")
          .reduce((s, a) => s + a.minutes, 0);
        usedMinutes += (te.minutes || 0) - 2 * adjAdd + adjSub;
      }
    }
  });

  // Pro-rated expected usage up to current day
  const expectedMinutes = (limitMinutes / totalDays) * dayNumber;
  const periodProgress = dayNumber / totalDays;

  // Determine color based on usage vs expected
  let color: "green" | "yellow" | "red";
  if (limitMinutes <= 0) {
    color = "green";
  } else if (usedMinutes > expectedMinutes * 1.1) {
    color = "red";
  } else if (usedMinutes >= expectedMinutes * 0.9) {
    color = "yellow";
  } else {
    color = "green";
  }

  return {
    color,
    usedMinutes,
    expectedMinutes,
    periodProgress,
    totalDays,
    dayNumber,
  };
}

export function EntryForm({
  date,
  onSuccess,
  viewMode: externalViewMode,
  onViewModeChange,
  newsIcon,
}: EntryFormProps) {
  const {
    activityTypes,
    allActivityTypes,
    addEntry,
    getSuggestions,
    getWorkoutHistory,
    entries,
    loadEntriesForDateRange,
    deleteEntry,
    updateEntry,
    updateActivityType,
    isViewingOther,
    isDayLocked,
    toggleDayLock,
  } = useApp();
  const { user } = useAuth();
  const router = useRouter();
  const [expandedTypeId, setExpandedTypeIdState] = useState<string | null>(
    () => {
      if (typeof window !== "undefined") {
        return localStorage.getItem(`expanded-activity-${date}`);
      }
      return null;
    },
  );
  const [savedValues, setSavedValues] = useState<Record<string, SavedValue[]>>(
    {},
  );
  const [suggestions, setSuggestions] = useState<Record<string, Suggestion[]>>(
    {},
  );
  const [customValue, setCustomValue] = useState("");
  const [showTextDropdown, setShowTextDropdown] = useState(false);
  const [showNutritionDropdown, setShowNutritionDropdown] = useState(false);
  const [foodIconPickerFor, setFoodIconPickerFor] = useState<{
    typeId: string;
    foodName: string;
  } | null>(null);
  const [editingFoodMap, setEditingFoodMap] = useState(false);
  const [editingFoodItem, setEditingFoodItem] = useState<{
    typeId: string;
    originalName: string;
    newName: string;
  } | null>(null);
  const [numberValue, setNumberValue] = useState<string>("");
  const [lastClickTime, setLastClickTime] = useState<Record<string, number>>(
    {},
  );
  const [isLocking, setIsLocking] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [showFunFact, setShowFunFact] = useState(false);
  const [funFacts, setFunFacts] = useState<FunFact[]>([]);
  const [funFactIndex, setFunFactIndex] = useState(0);
  const [showHiddenActivitiesPopup, setShowHiddenActivitiesPopup] =
    useState(false);
  const [funFactsPendingAfterHidden, setFunFactsPendingAfterHidden] =
    useState(false);
  const [internalViewMode, setInternalViewMode] = useState<"list" | "icons">(
    () => {
      if (typeof window !== "undefined") {
        return (
          (localStorage.getItem("entryform-viewmode") as "list" | "icons") ||
          "list"
        );
      }
      return "list";
    },
  );

  // Use external view mode if provided, otherwise use internal
  const viewMode = externalViewMode ?? internalViewMode;
  const setViewMode = onViewModeChange ?? setInternalViewMode;

  // Nutrition entry state
  const [nutritionInput, setNutritionInput] = useState<NutritionData>({
    foodName: "",
  });
  // Track if we've already shown goal celebration for this date
  const [goalCelebratedTypes, setGoalCelebratedTypes] = useState<Set<string>>(
    new Set(),
  );

  // Workout entry state - tracks data for all exercises
  // Uses localStorage to persist across navigation, keyed by date
  const [workoutData, setWorkoutData] = useState<
    Record<
      string,
      Array<{
        reps?: number;
        weight?: number;
        distance?: number;
        duration?: number;
      }>
    >
  >({});
  const [expandedExercises, setExpandedExercises] = useState<Set<string>>(
    new Set(),
  );
  const [isEditingWorkout, setIsEditingWorkout] = useState(false);
  const [selectedRoutineId, setSelectedRoutineId] = useState<string | null>(
    null,
  );

  // Track which date we've loaded data for to prevent race conditions
  const loadedDateRef = useRef<string | null>(null);

  // Workout history for placeholders (from previous days)
  const [workoutHistoryEntries, setWorkoutHistoryEntries] = useState<
    LogEntry[]
  >([]);

  // Routine management state
  const [showAddRoutine, setShowAddRoutine] = useState(false);
  const [newRoutineName, setNewRoutineName] = useState("");
  const [newRoutineExercises, setNewRoutineExercises] = useState<string[]>([]);
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);

  const isLocked = isDayLocked(date);

  const [showAddHiddenModal, setShowAddHiddenModal] = useState(false);

  // Checklist new item text input state (per activity type)
  const [checklistItemTexts, setChecklistItemTexts] = useState<
    Record<string, string>
  >({});
  const [showChecklistDropdown, setShowChecklistDropdown] = useState(false);
  const [activeChecklistTypeId, setActiveChecklistTypeId] = useState<
    string | null
  >(null);
  const [openChecklists, setOpenChecklists] = useState<Set<string>>(new Set());

  // Track which dates have had checklist auto-populated to avoid re-running
  const checklistAutoPopulatedRef = useRef<Set<string>>(new Set());

  // Track which date+type combos have been back-filled for non-repeating checklists
  const nonRepeatBackfilledRef = useRef<Set<string>>(new Set());

  // Helper to get/set per-activity-type checklist input text
  const getChecklistText = (typeId: string) => checklistItemTexts[typeId] || "";
  const setChecklistText = (typeId: string, text: string) => {
    setChecklistItemTexts((prev) => ({ ...prev, [typeId]: text }));
  };

  // Get checklist suggestions per activity type
  const checklistSuggestionsByType = useMemo(() => {
    const result: Record<string, Array<{ value: string; count: number }>> = {};
    entries.forEach((entry) => {
      if (entry.checklistData?.items && entry.activityTypeId) {
        const typeId = entry.activityTypeId;
        if (!result[typeId]) result[typeId] = [];
        entry.checklistData.items.forEach((item) => {
          const text = item.text.trim();
          if (text) {
            const existing = result[typeId].find((s) => s.value === text);
            if (existing) {
              existing.count++;
            } else {
              result[typeId].push({ value: text, count: 1 });
            }
          }
        });
      }
    });
    // Sort each type's suggestions by count descending, top 10
    for (const typeId of Object.keys(result)) {
      result[typeId] = result[typeId]
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    }
    return result;
  }, [entries]);

  // Clean up old day-hidden-activities localStorage keys (migration)
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(`day-hidden-activities-${date}`);
    }
  }, [date]);

  // Wrapper to persist expandedTypeId to localStorage
  const setExpandedTypeId = useCallback(
    (typeId: string | null) => {
      setExpandedTypeIdState(typeId);
      if (typeof window !== "undefined") {
        if (typeId) {
          localStorage.setItem(`expanded-activity-${date}`, typeId);
        } else {
          localStorage.removeItem(`expanded-activity-${date}`);
        }
      }
    },
    [date],
  );

  // Load expanded activity from localStorage on mount and visibility change
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedExpanded = localStorage.getItem(`expanded-activity-${date}`);
      if (savedExpanded) {
        setExpandedTypeIdState(savedExpanded);
      }

      // Restore state when page becomes visible (phone wake)
      const handleVisibilityChange = () => {
        if (document.visibilityState === "visible") {
          const savedExpanded = localStorage.getItem(
            `expanded-activity-${date}`,
          );
          if (savedExpanded) {
            setExpandedTypeIdState(savedExpanded);
          }
        }
      };

      document.addEventListener("visibilitychange", handleVisibilityChange);
      return () => {
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange,
        );
      };
    }
  }, [date]);

  // Load workout state from localStorage when date changes
  // This persists workout draft data across navigation for all users
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Load workout draft data from localStorage for all users
      const savedData = localStorage.getItem(`workout-data-${date}`);
      // UI state (expanded, editing, routine) can be loaded for all users
      const savedExpanded = localStorage.getItem(`workout-expanded-${date}`);
      const savedEditing = localStorage.getItem(`workout-editing-${date}`);
      const savedRoutine = localStorage.getItem(`workout-routine-${date}`);

      setWorkoutData(savedData ? JSON.parse(savedData) : {});
      setExpandedExercises(
        savedExpanded ? new Set(JSON.parse(savedExpanded)) : new Set(),
      );
      setIsEditingWorkout(savedEditing === "true");
      setSelectedRoutineId(savedRoutine || null);

      // Mark this date as loaded - only after state is set
      loadedDateRef.current = date;
    }
  }, [date]);

  // Load workout history for placeholders (from previous days)
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const workoutType = activityTypes.find(
          (t) => t.valueType === "workout",
        );
        if (workoutType) {
          const history = await getWorkoutHistory(workoutType.id, date);
          setWorkoutHistoryEntries(history);
        }
      } catch (err) {
        console.error("Failed to load workout history:", err);
      }
    };
    loadHistory();
  }, [date, activityTypes, getWorkoutHistory]);

  // Save workout draft data to localStorage for all users
  // This persists workout inputs across navigation (e.g., switching tabs)
  useEffect(() => {
    // Only save if we have actual data - never clear localStorage from this effect
    // (clearing happens explicitly when workout is saved or deleted)
    if (typeof window !== "undefined" && loadedDateRef.current === date) {
      const hasActualData = Object.keys(workoutData).some((exerciseName) => {
        const sets = workoutData[exerciseName] || [];
        return sets.some(
          (set) => set.reps || set.weight || set.distance || set.duration,
        );
      });

      if (hasActualData) {
        localStorage.setItem(
          `workout-data-${date}`,
          JSON.stringify(workoutData),
        );
      }
      // Don't remove localStorage here - it causes race conditions on remount
    }
  }, [workoutData, date]);

  // Save expanded exercises to localStorage
  useEffect(() => {
    if (typeof window !== "undefined" && loadedDateRef.current === date) {
      if (expandedExercises.size > 0) {
        localStorage.setItem(
          `workout-expanded-${date}`,
          JSON.stringify([...expandedExercises]),
        );
      }
      // Don't remove - causes race conditions
    }
  }, [expandedExercises, date]);

  // Save editing state to localStorage
  useEffect(() => {
    if (typeof window !== "undefined" && loadedDateRef.current === date) {
      if (isEditingWorkout) {
        localStorage.setItem(`workout-editing-${date}`, "true");
      }
      // Don't remove - causes race conditions
    }
  }, [isEditingWorkout, date]);

  // Save selected routine to localStorage
  useEffect(() => {
    if (typeof window !== "undefined" && loadedDateRef.current === date) {
      if (selectedRoutineId) {
        localStorage.setItem(`workout-routine-${date}`, selectedRoutineId);
      }
      // Don't remove - causes race conditions
    }
  }, [selectedRoutineId, date]);

  // Generate confetti particles for celebration
  const createParticles = useCallback(() => {
    const colors = [
      "#34C759",
      "#FFD60A",
      "#FF9500",
      "#FF3B30",
      "#AF52DE",
      "#5856D6",
      "#007AFF",
      "#00C7BE",
      "#FF2D55",
      "#5AC8FA",
    ];
    const newParticles: Particle[] = [];
    for (let i = 0; i < 150; i++) {
      newParticles.push({
        id: i,
        x: 50 + (Math.random() - 0.5) * 60,
        y: 50 + (Math.random() - 0.5) * 30,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 10 + 4,
        rotation: Math.random() * 360,
        velocityX: (Math.random() - 0.5) * 25,
        velocityY: -Math.random() * 20 - 8,
      });
    }
    setParticles(newParticles);
  }, []);

  // Animate celebration
  useEffect(() => {
    if (!showCelebration) return;

    createParticles();

    const timer = setTimeout(() => {
      setShowCelebration(false);
      setParticles([]);
    }, 2000);

    return () => clearTimeout(timer);
  }, [showCelebration, createParticles]);

  // Handle lock toggle - also saves workout data and hides empty activities
  const handleLockToggle = async () => {
    if (isViewingOther) return;
    setIsLocking(true);

    // Save any pending workout data before locking
    const workoutType = activityTypes.find((t) => t.valueType === "workout");
    if (workoutType && Object.keys(workoutData).length > 0) {
      const customExercises = workoutType.customExercises || [];
      await handleSaveAllWorkouts(workoutType.id, customExercises);
    }

    const currentlyLocked = isDayLocked(date);
    const newLockedState = await toggleDayLock(date);
    setIsLocking(false);

    if (newLockedState) {
      // When locking: hide activities that don't have any data for this day
      const dateEntries = entries.filter(
        (e) => e.date === date && !e.isWatchlist,
      );
      const activityIdsWithData = new Set(
        dateEntries.map((e) => e.activityTypeId),
      );

      // Move uncompleted checklist items to the next day (use allActivityTypes to include hidden ones)
      const nextDay = addDays(date, 1);
      const checklistTypes = allActivityTypes.filter(
        (t) => t.valueType === "checklist",
      );

      // Re-fetch fresh entries from the database to avoid stale state
      let freshEntries = entries;
      try {
        const { getEntries } = await import("@/lib/db");
        const { getEntriesFromSupabase } = await import("@/lib/supabase-sync");
        if (user) {
          freshEntries = await getEntriesFromSupabase(user.id, date, nextDay);
        } else {
          freshEntries = await getEntries(date, nextDay);
        }
      } catch {
        // Fall back to state entries if re-fetch fails
        console.warn(
          "Failed to re-fetch entries for checklist carry-forward, using state",
        );
      }
      const freshDateEntries = freshEntries.filter(
        (e) => e.date === date && !e.isWatchlist,
      );

      for (const checklistType of checklistTypes) {
        const isRepeating =
          checklistType.checklistRepeat &&
          checklistType.checklistRepeat !== "none";

        if (isRepeating) {
          // Repeating checklists: create tomorrow from template with ALL items unchecked.
          // Don't carry forward uncompleted items — user starts fresh each day.
          if (
            checklistType.checklistTemplate &&
            checklistType.checklistTemplate.length > 0
          ) {
            const nextDayEntries = freshEntries.filter(
              (e) => e.date === nextDay,
            );
            const existingNextDayEntry = nextDayEntries.find(
              (e) =>
                e.activityTypeId === checklistType.id && e.checklistData?.items,
            );

            const templateItems = checklistType.checklistTemplate
              .filter((t) => t.addedDate <= nextDay)
              .map((t) => ({
                id: crypto.randomUUID(),
                text: t.text,
                completed: false,
                addedDate: t.addedDate,
              }));

            if (templateItems.length > 0) {
              if (existingNextDayEntry) {
                // Replace with full template (all items unchecked)
                await updateEntry({
                  ...existingNextDayEntry,
                  checklistData: { items: templateItems },
                  value: `0/${templateItems.length}`,
                });
              } else {
                await addEntry({
                  date: nextDay,
                  activityTypeId: checklistType.id,
                  value: `0/${templateItems.length}`,
                  checklistData: { items: templateItems },
                });
              }
            }
          }
        } else {
          // Non-repeating checklists: only carry forward UNCOMPLETED items.
          // Completed items are considered done and should not reappear the next day.
          const checklistEntry = freshDateEntries.find(
            (e) =>
              e.activityTypeId === checklistType.id && e.checklistData?.items,
          );

          if (
            checklistEntry?.checklistData?.items &&
            checklistEntry.checklistData.items.length > 0
          ) {
            const allItems = checklistEntry.checklistData.items;
            const uncompletedItems = allItems.filter((item) => !item.completed);

            if (uncompletedItems.length === 0) continue;

            const nextDayEntries = freshEntries.filter(
              (e) => e.date === nextDay,
            );
            const existingNextDayEntry = nextDayEntries.find(
              (e) =>
                e.activityTypeId === checklistType.id && e.checklistData?.items,
            );

            const itemsForNextDay: ChecklistItem[] = uncompletedItems.map(
              (item) => ({
                id: crypto.randomUUID(),
                text: item.text,
                completed: false,
                addedDate: item.addedDate,
              }),
            );

            if (existingNextDayEntry) {
              // Remove items from next-day entry that were completed today
              // (they may have been carried forward uncompleted from a previous lock)
              const completedTodayTexts = new Set(
                allItems.filter((i) => i.completed).map((i) => i.text),
              );
              const existingFilteredItems = (
                existingNextDayEntry.checklistData?.items || []
              ).filter((i) => !completedTodayTexts.has(i.text));
              const existingTexts = new Set(
                existingFilteredItems.map((i) => i.text),
              );
              const newItems = itemsForNextDay.filter(
                (item) => !existingTexts.has(item.text),
              );
              const mergedItems = [...existingFilteredItems, ...newItems];

              await updateEntry({
                ...existingNextDayEntry,
                checklistData: { items: mergedItems },
                value: `${mergedItems.filter((i) => i.completed).length}/${mergedItems.length}`,
              });
            } else {
              await addEntry({
                date: nextDay,
                activityTypeId: checklistType.id,
                value: `0/${itemsForNextDay.length}`,
                checklistData: { items: itemsForNextDay },
              });
            }
          }
        }
      }

      // Re-load entries to reflect carry-forward changes
      await loadEntriesForDateRange(date, addDays(date, 1));

      // Clear workout localStorage since day is now locked
      localStorage.removeItem(`workout-data-${date}`);
      localStorage.removeItem(`workout-expanded-${date}`);
      localStorage.removeItem(`workout-editing-${date}`);
      localStorage.removeItem(`workout-routine-${date}`);
      localStorage.removeItem(`expanded-activity-${date}`);
      // Clear state
      setWorkoutData({});
      setExpandedExercises(new Set());
      setIsEditingWorkout(false);
      setSelectedRoutineId(null);
      setExpandedTypeIdState(null);
      setShowCelebration(true);

      // Build post-lock popup sequence
      const showHiddenOnLock =
        typeof window !== "undefined" &&
        localStorage.getItem("show_hidden_on_lock") === "true";
      const hasHiddenActivities = allActivityTypes.some((t) => t.hidden);
      const categories = getSelectedCategories();
      const hasFunFacts = categories.length > 0;

      if (hasFunFacts) {
        fetchAllFunFacts().then((facts) => {
          if (facts.length > 0) {
            setFunFacts(facts);
            setFunFactIndex(0);
            setTimeout(() => setShowFunFact(true), 1500);
            if (showHiddenOnLock && hasHiddenActivities) {
              setFunFactsPendingAfterHidden(true);
            }
          } else if (showHiddenOnLock && hasHiddenActivities) {
            setTimeout(() => setShowHiddenActivitiesPopup(true), 1500);
          }
        });
      } else if (showHiddenOnLock && hasHiddenActivities) {
        setTimeout(() => setShowHiddenActivitiesPopup(true), 1500);
      }
    } else {
      // When unlocking: all activities will show again (dynamic filtering)
    }
  };

  const dismissHiddenActivitiesPopup = () => {
    setShowHiddenActivitiesPopup(false);
    setFunFactsPendingAfterHidden(false);
  };

  useEffect(() => {
    // Load current day + next day (for tomorrow's checklist preview)
    loadEntriesForDateRange(date, addDays(date, 1));
    // Load expanded activity from localStorage instead of resetting
    if (typeof window !== "undefined") {
      const savedExpanded = localStorage.getItem(`expanded-activity-${date}`);
      setExpandedTypeIdState(savedExpanded || null);
    }
    setGoalCelebratedTypes(new Set()); // Reset celebrations for new date
  }, [date, loadEntriesForDateRange]);

  // Back-fill non-repeating checklists: if the current date has no entry for a
  // non-repeating checklist type, find the most recent past entry and copy it.
  // This ensures items persist even when intermediate days were never locked.
  useEffect(() => {
    if (isViewingOther) return;

    const nonRepeatTypes = allActivityTypes.filter(
      (t) =>
        t.valueType === "checklist" &&
        (!t.checklistRepeat || t.checklistRepeat === "none"),
    );
    if (nonRepeatTypes.length === 0) return;

    const dateEntries = entries.filter(
      (e) => e.date === date && !e.isWatchlist,
    );

    const typesNeedingFill = nonRepeatTypes.filter((type) => {
      const cacheKey = `${date}-${type.id}`;
      if (nonRepeatBackfilledRef.current.has(cacheKey)) return false;
      return !dateEntries.some(
        (e) => e.activityTypeId === type.id && e.checklistData?.items,
      );
    });

    if (typesNeedingFill.length === 0) return;

    const backfill = async () => {
      const lookbackStart = addDays(date, -90);
      const yesterday = addDays(date, -1);

      let pastEntries: import("@/types").LogEntry[];
      try {
        if (user) {
          const { getEntriesFromSupabase } =
            await import("@/lib/supabase-sync");
          pastEntries = await getEntriesFromSupabase(
            user.id,
            lookbackStart,
            yesterday,
          );
        } else {
          const { getEntries } = await import("@/lib/db");
          pastEntries = await getEntries(lookbackStart, yesterday);
        }
      } catch {
        return;
      }

      for (const type of typesNeedingFill) {
        const cacheKey = `${date}-${type.id}`;
        nonRepeatBackfilledRef.current.add(cacheKey);

        const mostRecentPastEntry = pastEntries
          .filter(
            (e) =>
              e.activityTypeId === type.id &&
              e.checklistData?.items &&
              e.checklistData.items.length > 0,
          )
          .sort((a, b) => b.date.localeCompare(a.date))[0];

        if (!mostRecentPastEntry) continue;

        const itemsForDate: ChecklistItem[] = mostRecentPastEntry
          .checklistData!.items!.filter((item) => !item.completed)
          .map((item) => ({
            id: crypto.randomUUID(),
            text: item.text,
            completed: false,
            addedDate: item.addedDate,
          }));

        if (itemsForDate.length > 0) {
          await addEntry({
            date,
            activityTypeId: type.id,
            value: `0/${itemsForDate.length}`,
            checklistData: { items: itemsForDate },
          });
        }
      }
    };

    backfill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, entries, allActivityTypes, isViewingOther, user, addEntry]);

  // Auto-populate repeating checklists: only create TOMORROW's entry from template.
  // Never auto-creates entries for today — today's entry is either:
  //   - Created yesterday by this same logic (as "tomorrow")
  //   - Created by carry-forward when locking the previous day
  //   - Manually created by the user adding items
  // This prevents the delete-all bug (auto-populate can't re-create today's entry).
  //
  // IMPORTANT: This effect deliberately does NOT depend on `entries`.
  // It checks the DB directly for tomorrow's entry to avoid re-running on every
  // entry mutation (which caused items to reappear after delete-all).
  useEffect(() => {
    if (isViewingOther) return;

    // Only auto-populate when viewing today (not browsing history/future)
    const today = toDateStr(new Date());
    if (date !== today) return;

    const repeatChecklistTypes = allActivityTypes.filter(
      (t) =>
        t.valueType === "checklist" &&
        t.checklistRepeat &&
        t.checklistRepeat !== "none",
    );
    if (repeatChecklistTypes.length === 0) return;

    const tomorrow = addDays(date, 1);

    const autoPopulateChecklists = async () => {
      for (const type of repeatChecklistTypes) {
        const cacheKey = `tomorrow-${tomorrow}-${type.id}`;
        if (checklistAutoPopulatedRef.current.has(cacheKey)) continue;

        // Check the DB directly for tomorrow's entry (not state, to avoid dep on entries)
        let tomorrowHasEntry = false;
        try {
          if (user) {
            const { getEntriesFromSupabase } =
              await import("@/lib/supabase-sync");
            const tomorrowEntries = await getEntriesFromSupabase(
              user.id,
              tomorrow,
              tomorrow,
            );
            tomorrowHasEntry = tomorrowEntries.some(
              (e) => e.activityTypeId === type.id && e.checklistData,
            );
          } else {
            const { getEntries } = await import("@/lib/db");
            const tomorrowEntries = await getEntries(tomorrow, tomorrow);
            tomorrowHasEntry = tomorrowEntries.some(
              (e) => e.activityTypeId === type.id && e.checklistData,
            );
          }
        } catch {
          // If DB check fails, skip to be safe
          checklistAutoPopulatedRef.current.add(cacheKey);
          continue;
        }

        if (tomorrowHasEntry) {
          checklistAutoPopulatedRef.current.add(cacheKey);
          continue;
        }

        // Determine if we should auto-populate based on repeat frequency
        const shouldPopulate = (() => {
          const repeat = type.checklistRepeat!;
          if (repeat === "daily") return true;
          // For weekly/monthly, we just check if template exists — the template
          // is the source of truth. The entry will only be created if template has items.
          return true;
        })();

        if (!shouldPopulate) {
          checklistAutoPopulatedRef.current.add(cacheKey);
          continue;
        }

        // Get the template — only proceed if it exists and has items
        const template = type.checklistTemplate;
        if (!template || template.length === 0) {
          checklistAutoPopulatedRef.current.add(cacheKey);
          continue;
        }

        try {
          // Filter template items: only include items added on or before tomorrow
          const itemsForDate = template
            .filter((t) => t.addedDate <= tomorrow)
            .map((t) => ({
              id: crypto.randomUUID(),
              text: t.text,
              completed: false,
              addedDate: t.addedDate,
            }));

          if (itemsForDate.length > 0) {
            await addEntry({
              date: tomorrow,
              activityTypeId: type.id,
              value: `0/${itemsForDate.length}`,
              checklistData: { items: itemsForDate },
            });
          }

          checklistAutoPopulatedRef.current.add(cacheKey);
        } catch (err) {
          console.warn("Failed to auto-populate checklist for tomorrow:", err);
          checklistAutoPopulatedRef.current.add(cacheKey);
        }
      }
    };

    autoPopulateChecklists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, allActivityTypes, isViewingOther, user, addEntry]);

  useEffect(() => {
    const dateEntries = entries.filter(
      (e) => e.date === date && !e.isWatchlist,
    );
    const newSavedValues: Record<string, SavedValue[]> = {};
    dateEntries.forEach((entry) => {
      if (!newSavedValues[entry.activityTypeId]) {
        newSavedValues[entry.activityTypeId] = [];
      }
      newSavedValues[entry.activityTypeId].push({
        value: entry.value,
        id: entry.id,
        nutritionData: entry.nutritionData,
      });
    });
    setSavedValues(newSavedValues);
  }, [entries, date]);

  useEffect(() => {
    async function loadAllSuggestions() {
      const newSuggestions: Record<string, Suggestion[]> = {};
      // Load suggestions for all activity types including hidden ones
      for (const type of allActivityTypes) {
        if (type.valueType === "text" || type.valueType === "nutrition") {
          const sugg = await getSuggestions(type.id);
          newSuggestions[type.id] = sugg;
        }
      }
      setSuggestions(newSuggestions);
    }
    loadAllSuggestions();
  }, [allActivityTypes, getSuggestions]);

  // Calculate nutrition totals for a type
  const getNutritionTotals = useCallback(
    (typeId: string) => {
      const typeEntries = savedValues[typeId] || [];
      return typeEntries.reduce(
        (acc, entry) => {
          if (entry.nutritionData) {
            acc.calories += entry.nutritionData.calories || 0;
            acc.protein += entry.nutritionData.protein || 0;
            acc.carbs += entry.nutritionData.carbs || 0;
            acc.fat += entry.nutritionData.fat || 0;
          }
          return acc;
        },
        { calories: 0, protein: 0, carbs: 0, fat: 0 },
      );
    },
    [savedValues],
  );

  // Get combined nutrition totals and goals for a specific type and its merged types
  const getMergedNutritionData = useCallback(
    (typeId: string) => {
      const currentType = allActivityTypes.find((t) => t.id === typeId);
      if (!currentType || currentType.valueType !== "nutrition") {
        return {
          totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
          goals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
          hasData: false,
          isMerged: false,
        };
      }

      // Find the primary type - either this type has mergedNutritionTypeIds,
      // or another nutrition type includes this one in its mergedNutritionTypeIds
      let primaryType: typeof currentType | undefined;
      let mergedIds: string[] = [];

      // First check if this type is the primary (has non-empty mergedNutritionTypeIds)
      if (
        currentType.mergedNutritionTypeIds &&
        currentType.mergedNutritionTypeIds.length > 0
      ) {
        primaryType = currentType;
        mergedIds = currentType.mergedNutritionTypeIds;
      } else {
        // Search for a nutrition type that includes this type in its merge list
        const parentType = allActivityTypes.find(
          (t) =>
            t.valueType === "nutrition" &&
            t.id !== typeId &&
            t.mergedNutritionTypeIds &&
            t.mergedNutritionTypeIds.length > 0 &&
            t.mergedNutritionTypeIds.includes(typeId),
        );
        if (parentType) {
          primaryType = parentType;
          mergedIds = parentType.mergedNutritionTypeIds || [];
        }
      }

      // If no merge settings found, return just this type's data
      if (!primaryType) {
        const totals = getNutritionTotals(typeId);
        const goal = currentType.nutritionGoal || {};
        return {
          totals,
          goals: {
            calories: goal.calories || 0,
            protein: goal.protein || 0,
            carbs: goal.carbs || 0,
            fat: goal.fat || 0,
          },
          hasData: !!(
            totals.calories ||
            totals.protein ||
            totals.carbs ||
            totals.fat
          ),
          isMerged: false,
          hasCommonGoal: false,
        };
      }

      // Get the type IDs to include (primary type + merged types)
      const typeIdsToInclude = [primaryType.id, ...mergedIds];

      // Combine all totals from the included types
      const combinedTotals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
      let hasAnyData = false;

      typeIdsToInclude.forEach((id) => {
        const totals = getNutritionTotals(id);
        combinedTotals.calories += totals.calories;
        combinedTotals.protein += totals.protein;
        combinedTotals.carbs += totals.carbs;
        combinedTotals.fat += totals.fat;
        if (totals.calories || totals.protein || totals.carbs || totals.fat) {
          hasAnyData = true;
        }
      });

      // Use mergedNutritionGoal if set, otherwise combine individual goals
      let combinedGoals = { calories: 0, protein: 0, carbs: 0, fat: 0 };

      if (primaryType.mergedNutritionGoal) {
        // Use the common goal for merged activities
        combinedGoals = {
          calories: primaryType.mergedNutritionGoal.calories || 0,
          protein: primaryType.mergedNutritionGoal.protein || 0,
          carbs: primaryType.mergedNutritionGoal.carbs || 0,
          fat: primaryType.mergedNutritionGoal.fat || 0,
        };
      } else {
        // Combine all goals from the included types
        typeIdsToInclude.forEach((id) => {
          const type = allActivityTypes.find((t) => t.id === id);
          if (type?.nutritionGoal) {
            combinedGoals.calories += type.nutritionGoal.calories || 0;
            combinedGoals.protein += type.nutritionGoal.protein || 0;
            combinedGoals.carbs += type.nutritionGoal.carbs || 0;
            combinedGoals.fat += type.nutritionGoal.fat || 0;
          }
        });
      }

      return {
        totals: combinedTotals,
        goals: combinedGoals,
        hasData: hasAnyData,
        isMerged: mergedIds.length > 0,
        hasCommonGoal: !!primaryType.mergedNutritionGoal,
      };
    },
    [allActivityTypes, getNutritionTotals],
  );

  // Check if nutrition goal is reached
  const checkNutritionGoalReached = useCallback(
    (
      type: ActivityType,
      totals: { calories: number; protein: number; carbs: number; fat: number },
    ) => {
      if (!type.nutritionGoal) return false;
      const goal = type.nutritionGoal;

      // Check if any goal is set and reached
      if (goal.protein && totals.protein >= goal.protein) return true;
      if (goal.calories && totals.calories >= goal.calories) return true;
      if (goal.carbs && totals.carbs >= goal.carbs) return true;
      if (goal.fat && totals.fat >= goal.fat) return true;

      return false;
    },
    [],
  );

  // Handle saving nutrition entry
  const handleSaveNutrition = async (typeId: string) => {
    if (isViewingOther) return;
    if (!nutritionInput.foodName.trim()) return;

    // Use allActivityTypes to support hidden activities
    const type = allActivityTypes.find((t) => t.id === typeId);
    if (!type) return;

    try {
      // Get current totals before adding
      const currentTotals = getNutritionTotals(typeId);
      const wasGoalReached = checkNutritionGoalReached(type, currentTotals);

      await addEntry({
        date,
        activityTypeId: typeId,
        value: nutritionInput.foodName.trim(),
        nutritionData: {
          foodName: nutritionInput.foodName.trim(),
          calories: nutritionInput.calories,
          protein: nutritionInput.protein,
          carbs: nutritionInput.carbs,
          fat: nutritionInput.fat,
        },
      });

      // Calculate new totals
      const newTotals = {
        calories: currentTotals.calories + (nutritionInput.calories || 0),
        protein: currentTotals.protein + (nutritionInput.protein || 0),
        carbs: currentTotals.carbs + (nutritionInput.carbs || 0),
        fat: currentTotals.fat + (nutritionInput.fat || 0),
      };

      // Check if goal just got reached (wasn't before, is now)
      const isGoalReached = checkNutritionGoalReached(type, newTotals);
      if (
        isGoalReached &&
        !wasGoalReached &&
        !goalCelebratedTypes.has(typeId)
      ) {
        setGoalCelebratedTypes((prev) => new Set([...prev, typeId]));
        setShowCelebration(true);
      }

      // Reset nutrition input
      setNutritionInput({ foodName: "" });
      setExpandedTypeId(null);

      // Reload suggestions for this type
      const sugg = await getSuggestions(typeId);
      setSuggestions((prev) => ({ ...prev, [typeId]: sugg }));

      onSuccess?.();
    } catch (error) {
      console.error("Failed to add nutrition entry:", error);
    }
  };

  // Handle saving all workout exercises at once
  const handleSaveAllWorkouts = async (
    typeId: string,
    customExercises: CustomExercise[],
  ) => {
    if (isViewingOther) return;

    try {
      // Find existing workout entry for today
      const existingEntries = savedValues[typeId] || [];
      const existingWorkoutEntry = existingEntries.find((e) => {
        const entry = entries.find((ent) => ent.id === e.id);
        return entry?.workoutData;
      });

      // Build all exercises from workoutData state
      const allExercises: WorkoutExercise[] = [];

      for (const exerciseName of Object.keys(workoutData)) {
        const sets = workoutData[exerciseName];
        const exerciseConfig = customExercises.find(
          (e) => e.name === exerciseName,
        );
        if (!exerciseConfig) continue;

        // Filter sets that have data
        const validSets = sets.filter(
          (set) => set.reps || set.weight || set.distance || set.duration,
        );
        if (validSets.length === 0) continue;

        // Store each set's data individually
        const combinedExercise: WorkoutExercise = {
          id: `${Date.now()}-${exerciseName}`,
          name: exerciseName,
          category: exerciseConfig.category,
          sets: validSets.length,
          reps: validSets[0].reps,
          weight: validSets.some((e) => e.weight)
            ? Math.max(
                ...validSets.filter((e) => e.weight).map((e) => e.weight!),
              )
            : undefined,
          distance: validSets.some((e) => e.distance)
            ? validSets.reduce((sum, e) => sum + (e.distance || 0), 0)
            : undefined,
          duration: validSets.some((e) => e.duration)
            ? validSets.reduce((sum, e) => sum + (e.duration || 0), 0)
            : undefined,
          setsData: validSets, // Store individual set data
        };

        allExercises.push(combinedExercise);
      }

      if (allExercises.length === 0) return;

      if (existingWorkoutEntry) {
        // Update existing entry
        const existingEntry = entries.find(
          (e) => e.id === existingWorkoutEntry.id,
        );
        if (existingEntry) {
          await updateEntry({
            ...existingEntry,
            value: `${allExercises.length} exercise${
              allExercises.length !== 1 ? "s" : ""
            }`,
            workoutData: {
              exercises: allExercises,
            },
          });
        }
      } else {
        // Create new workout entry
        await addEntry({
          date,
          activityTypeId: typeId,
          value: `${allExercises.length} exercise${
            allExercises.length !== 1 ? "s" : ""
          }`,
          workoutData: {
            exercises: allExercises,
          },
        });
      }

      // Only reset if no exercises are expanded (user is done)
      if (expandedExercises.size === 0) {
        // Clear localStorage since workout is saved
        localStorage.removeItem(`workout-data-${date}`);
        localStorage.removeItem(`workout-expanded-${date}`);
        localStorage.removeItem(`workout-editing-${date}`);
        setWorkoutData({});
        setIsEditingWorkout(false);
      }

      onSuccess?.();
    } catch (error) {
      console.error("Failed to save workout:", error);
    }
  };

  // Delete entire workout
  const handleDeleteWorkout = async (typeId: string) => {
    if (isViewingOther) return;

    const existingEntries = savedValues[typeId] || [];
    for (const entry of existingEntries) {
      await deleteEntry(entry.id);
    }
    // Clear localStorage since workout is deleted
    localStorage.removeItem(`workout-data-${date}`);
    localStorage.removeItem(`workout-expanded-${date}`);
    localStorage.removeItem(`workout-editing-${date}`);
    setWorkoutData({});
    setExpandedExercises(new Set());
    setIsEditingWorkout(false);
  };

  const handleSaveValue = async (
    typeId: string,
    value: string | number | boolean,
    metadata?: {
      imdbId?: string;
      poster?: string;
      imdbRating?: string;
      year?: string;
      userRating?: number;
    },
  ) => {
    // Don't allow editing when viewing another user's data
    if (isViewingOther) return;

    // Use allActivityTypes to support hidden activities
    const type = allActivityTypes.find((t) => t.id === typeId);
    if (!type) return;

    try {
      if (
        type?.valueType === "boolean" ||
        type?.valueType === "checkmark" ||
        type?.valueType === "mood"
      ) {
        const existingValues = savedValues[typeId] || [];
        for (const existing of existingValues) {
          await deleteEntry(existing.id);
        }
      }

      // For counter type, delete existing and add new value
      if (type?.valueType === "counter") {
        const existingValues = savedValues[typeId] || [];
        for (const existing of existingValues) {
          await deleteEntry(existing.id);
        }
      }

      // For media types, copy metadata from existing entry if not provided
      const isMedia =
        type.name.toLowerCase().includes("movie") ||
        type.name.toLowerCase().includes("film") ||
        type.name.toLowerCase().includes("tv") ||
        type.name.toLowerCase().includes("series") ||
        type.name.toLowerCase().includes("serie");

      let entryMetadata = metadata;

      if (isMedia && typeof value === "string" && !metadata) {
        // Find existing entry to copy metadata (poster, imdbId, etc.)
        const existingEntry = entries.find(
          (e) =>
            e.activityTypeId === typeId &&
            String(e.value).toLowerCase() === value.toLowerCase(),
        );

        if (existingEntry) {
          // Also look for existing user rating from any entry with same imdbId
          const entryWithRating = entries.find(
            (e) =>
              e.imdbId === existingEntry.imdbId && e.userRating !== undefined,
          );

          entryMetadata = {
            imdbId: existingEntry.imdbId,
            poster: existingEntry.poster,
            imdbRating: existingEntry.imdbRating,
            year: existingEntry.year,
            userRating: entryWithRating?.userRating,
          };
        } else if (user) {
          // Fallback: query Supabase for metadata from a historical entry
          const dbMeta = await getMediaMetadata(user.id, typeId, value);
          if (dbMeta) {
            entryMetadata = dbMeta;
          }
        }
      }

      await addEntry({
        date,
        activityTypeId: typeId,
        value,
        ...(entryMetadata && {
          imdbId: entryMetadata.imdbId,
          poster: entryMetadata.poster,
          imdbRating: entryMetadata.imdbRating,
          year: entryMetadata.year,
          userRating: entryMetadata.userRating,
        }),
      });

      setExpandedTypeId(null);
      setCustomValue("");
      setNumberValue("");

      if (type.valueType === "text") {
        const sugg = await getSuggestions(type.id);
        setSuggestions((prev) => ({ ...prev, [type.id]: sugg }));
      }

      onSuccess?.();
    } catch (error) {
      console.error("Failed to add entry:", error);
    }
  };

  const removeSavedValue = async (typeId: string, entryId: string) => {
    // Don't allow editing when viewing another user's data
    if (isViewingOther) return;

    try {
      await deleteEntry(entryId);
    } catch (error) {
      console.error("Failed to delete entry:", error);
    }
  };

  const formatValue = (
    value: string | number | boolean,
    typeId?: string,
  ): string => {
    // Use allActivityTypes to support hidden activities
    const type = typeId ? allActivityTypes.find((t) => t.id === typeId) : null;
    if (type?.valueType === "checkmark" && value === true) return "✓";
    if (type?.valueType === "checkmark" && value === "skipped") return "✗";
    if (type?.valueType === "mood") {
      if (value === "happy") return "☺";
      if (value === "neutral") return "—";
      if (value === "sad") return "☹";
    }
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return String(value);
  };

  const toggleExpanded = (typeId: string) => {
    // Don't allow expanding input form when viewing another user's data
    if (isViewingOther) return;

    if (expandedTypeId === typeId) {
      setExpandedTypeId(null);
      setCustomValue("");
      setNumberValue("");
    } else {
      setExpandedTypeId(typeId);
      setCustomValue("");
      setNumberValue("");
    }
  };

  const isMediaType = (type: ActivityType): "movie" | "series" | null => {
    const name = type.name.toLowerCase();
    if (name.includes("movie") || name.includes("film")) return "movie";
    if (
      name.includes("tv") ||
      name.includes("series") ||
      name.includes("serie")
    )
      return "series";
    return null;
  };

  const handleMediaSelect = async (
    typeId: string,
    title: string,
    imdbId: string,
    year: string,
    poster: string,
    rating?: string,
  ) => {
    // TMDb IDs start with "tmdb-", we use rating from the search result instead of fetching OMDB details
    const displayTitle = `${title} (${year})`;

    // Look up existing user rating for this movie/TV series (by imdbId)
    // This persists the rating across multiple viewings
    const existingEntryWithRating = entries.find(
      (e) => e.imdbId === imdbId && e.userRating !== undefined,
    );
    const existingUserRating = existingEntryWithRating?.userRating;

    await handleSaveValue(typeId, displayTitle, {
      imdbId,
      poster: poster !== "N/A" ? poster : undefined,
      imdbRating: rating && rating !== "N/A" ? rating : undefined,
      year,
      userRating: existingUserRating,
    });
  };

  const renderExpandedInput = (type: ActivityType) => {
    const mediaType = isMediaType(type);

    if (mediaType && type.valueType === "text") {
      return (
        <div className='pt-3 space-y-3'>
          <MediaSearch
            type={mediaType}
            onSelect={(title, imdbId, year, poster, rating) =>
              handleMediaSelect(type.id, title, imdbId, year, poster, rating)
            }
            onSelectPrevious={(value) => handleSaveValue(type.id, value)}
            placeholder={
              mediaType === "movie"
                ? "Search for movie..."
                : "Search for TV series..."
            }
            suggestions={suggestions[type.id] || []}
          />
        </div>
      );
    }

    switch (type.valueType) {
      case "text": {
        const typeSuggestions = suggestions[type.id] || [];
        // Filter suggestions based on what the user is typing
        const filteredSuggestions = customValue.trim()
          ? typeSuggestions.filter((sugg) =>
              sugg.value.toLowerCase().includes(customValue.toLowerCase()),
            )
          : typeSuggestions;
        // Sort by most recently used first
        filteredSuggestions.sort(
          (a, b) =>
            new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime(),
        );
        // Show dropdown when focused and has suggestions (either all or filtered)
        const suggestionsToShow = filteredSuggestions.slice(0, 10);
        const showDropdown =
          showTextDropdown &&
          suggestionsToShow.length > 0 &&
          // Don't show if exact match is typed
          !suggestionsToShow.some(
            (s) => s.value.toLowerCase() === customValue.toLowerCase().trim(),
          );

        return (
          <div className='pt-3 space-y-3'>
            <div className='relative'>
              <div className='flex gap-2'>
                <input
                  type='text'
                  value={customValue}
                  onChange={(e) => {
                    setCustomValue(e.target.value);
                    setShowTextDropdown(true);
                  }}
                  onFocus={() => setShowTextDropdown(true)}
                  onBlur={() =>
                    setTimeout(() => setShowTextDropdown(false), 200)
                  }
                  placeholder='Enter value...'
                  className='flex-1 px-3 py-2 rounded-lg text-[17px] bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-ios-blue'
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && customValue.trim()) {
                      handleSaveValue(type.id, customValue.trim());
                      setShowTextDropdown(false);
                    }
                    if (e.key === "Escape") {
                      setShowTextDropdown(false);
                      setExpandedTypeId(null);
                    }
                  }}
                />
                {customValue.trim() && (
                  <button
                    onClick={() => {
                      handleSaveValue(type.id, customValue.trim());
                      setShowTextDropdown(false);
                    }}
                    className='px-5 py-2.5 rounded-full bg-ios-blue text-white text-[14px] font-medium shadow-lg shadow-ios-blue/30'>
                    Add
                  </button>
                )}
              </div>
              {/* Autocomplete dropdown - shows recent suggestions */}
              {showDropdown && (
                <div className='absolute left-0 right-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-50 max-h-64 overflow-y-auto'>
                  {suggestionsToShow.map((sugg) => (
                    <button
                      key={sugg.value}
                      onClick={() => {
                        handleSaveValue(type.id, sugg.value);
                        setShowTextDropdown(false);
                      }}
                      className='w-full px-3 py-2.5 text-left text-[17px] text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 border-b border-gray-100 dark:border-gray-700 last:border-b-0 flex items-center justify-between'>
                      <span>{sugg.value}</span>
                      <span className='text-[13px] text-gray-400 dark:text-gray-500'>
                        ({sugg.count}×)
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      }

      case "counter":
        // Counter is handled inline on the row, not in expanded view
        return null;

      case "mood":
        return (
          <div
            className='pt-3 flex gap-3'
            data-info='Mood selector. Tap a face to log your mood. Tap again to remove it.'>
            <button
              onClick={() => {
                const currentValue = savedValues[type.id]?.[0];
                if (currentValue?.value === "happy") {
                  deleteEntry(currentValue.id);
                } else {
                  handleSaveValue(type.id, "happy");
                }
              }}
              className={cn(
                "flex-1 py-4 rounded-xl active:scale-95 transition-transform flex items-center justify-center mood-btn",
                "bg-gray-100 dark:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600",
                savedValues[type.id]?.[0]?.value === "happy" &&
                  "ring-2 ring-ios-green bg-ios-green/10 dark:bg-ios-green/20",
              )}>
              {/* Happy face - smile */}
              <svg
                className='w-8 h-8 text-ios-green'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'>
                <circle cx='12' cy='12' r='10' />
                <path d='M8 14s1.5 2 4 2 4-2 4-2' />
                <line x1='9' y1='9' x2='9.01' y2='9' strokeWidth='3' />
                <line x1='15' y1='9' x2='15.01' y2='9' strokeWidth='3' />
              </svg>
            </button>
            <button
              onClick={() => {
                const currentValue = savedValues[type.id]?.[0];
                if (currentValue?.value === "neutral") {
                  deleteEntry(currentValue.id);
                } else {
                  handleSaveValue(type.id, "neutral");
                }
              }}
              className={cn(
                "flex-1 py-4 rounded-xl active:scale-95 transition-transform flex items-center justify-center mood-btn",
                "bg-gray-100 dark:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600",
                savedValues[type.id]?.[0]?.value === "neutral" &&
                  "ring-2 ring-ios-orange bg-ios-orange/10 dark:bg-ios-orange/20",
              )}>
              {/* Neutral face - straight line */}
              <svg
                className='w-8 h-8 text-ios-orange'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'>
                <circle cx='12' cy='12' r='10' />
                <line x1='8' y1='15' x2='16' y2='15' />
                <line x1='9' y1='9' x2='9.01' y2='9' strokeWidth='3' />
                <line x1='15' y1='9' x2='15.01' y2='9' strokeWidth='3' />
              </svg>
            </button>
            <button
              onClick={() => {
                const currentValue = savedValues[type.id]?.[0];
                if (currentValue?.value === "sad") {
                  deleteEntry(currentValue.id);
                } else {
                  handleSaveValue(type.id, "sad");
                }
              }}
              className={cn(
                "flex-1 py-4 rounded-xl active:scale-95 transition-transform flex items-center justify-center mood-btn",
                "bg-gray-100 dark:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600",
                savedValues[type.id]?.[0]?.value === "sad" &&
                  "ring-2 ring-ios-red bg-ios-red/10 dark:bg-ios-red/20",
              )}>
              {/* Sad face - frown */}
              <svg
                className='w-8 h-8 text-ios-red'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'>
                <circle cx='12' cy='12' r='10' />
                <path d='M16 16s-1.5-2-4-2-4 2-4 2' />
                <line x1='9' y1='9' x2='9.01' y2='9' strokeWidth='3' />
                <line x1='15' y1='9' x2='15.01' y2='9' strokeWidth='3' />
              </svg>
            </button>
          </div>
        );

      case "boolean":
        return (
          <div
            className='pt-3 flex gap-3'
            data-info='Yes/No. Tap to log your answer for this activity.'>
            <button
              onClick={() => handleSaveValue(type.id, true)}
              className='flex-1 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-[17px] font-medium text-gray-900 dark:text-white active:bg-gray-200 dark:active:bg-gray-600 flex items-center justify-center gap-2'>
              <svg
                className='w-5 h-5 text-ios-green'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
                strokeWidth={2.5}>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='M5 13l4 4L19 7'
                />
              </svg>
              Yes
            </button>
            <button
              onClick={() => handleSaveValue(type.id, false)}
              className='flex-1 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-[17px] font-medium text-gray-900 dark:text-white active:bg-gray-200 dark:active:bg-gray-600 flex items-center justify-center gap-2'>
              <svg
                className='w-5 h-5 text-ios-red'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
                strokeWidth={2.5}>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='M6 18L18 6M6 6l12 12'
                />
              </svg>
              No
            </button>
          </div>
        );

      case "checkmark":
        return (
          <div className='pt-3'>
            <button
              onClick={() => handleSaveValue(type.id, true)}
              className='w-full py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-[20px] active:bg-gray-200 dark:active:bg-gray-600 flex items-center justify-center gap-2 transition-transform active:scale-95'>
              <span className='text-2xl text-ios-green'>✓</span>
            </button>
          </div>
        );

      case "nutrition": {
        // Get THIS activity's own totals and goals for the Daily Progress section
        const ownTotals = getNutritionTotals(type.id);
        const ownGoal = type.nutritionGoal || {};
        const typeEntries = savedValues[type.id] || [];

        return (
          <div className='pt-3 space-y-4'>
            {/* Progress bars - show this activity's own progress */}
            {type.showDailyGoals &&
              (ownGoal.protein ||
                ownGoal.calories ||
                ownGoal.carbs ||
                ownGoal.fat) && (
                <div className='space-y-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50'>
                  <p className='text-[13px] font-medium text-gray-500 mb-2'>
                    Daily Progress
                  </p>
                  {ownGoal.protein && (
                    <div>
                      <div className='flex justify-between text-[13px] mb-1'>
                        <span className='text-gray-600 dark:text-gray-400'>
                          Protein
                        </span>
                        <span
                          className={cn(
                            "font-medium",
                            ownTotals.protein >= ownGoal.protein
                              ? "text-ios-green"
                              : "text-gray-600 dark:text-gray-400",
                          )}>
                          {ownTotals.protein}g / {ownGoal.protein}g
                          {ownTotals.protein >= ownGoal.protein && " ✓"}
                        </span>
                      </div>
                      <div className='h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden'>
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            ownTotals.protein >= ownGoal.protein
                              ? "bg-ios-green"
                              : "bg-ios-blue",
                          )}
                          style={{
                            width: `${Math.min(
                              100,
                              (ownTotals.protein / ownGoal.protein) * 100,
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                  {ownGoal.calories && (
                    <div>
                      <div className='flex justify-between text-[13px] mb-1'>
                        <span className='text-gray-600 dark:text-gray-400'>
                          Calories
                        </span>
                        <span
                          className={cn(
                            "font-medium",
                            ownTotals.calories >= ownGoal.calories
                              ? "text-ios-green"
                              : "text-gray-600 dark:text-gray-400",
                          )}>
                          {ownTotals.calories} / {ownGoal.calories} kcal
                          {ownTotals.calories >= ownGoal.calories && " ✓"}
                        </span>
                      </div>
                      <div className='h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden'>
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            ownTotals.calories >= ownGoal.calories
                              ? "bg-ios-green"
                              : "bg-ios-orange",
                          )}
                          style={{
                            width: `${Math.min(
                              100,
                              (ownTotals.calories / ownGoal.calories) * 100,
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                  {ownGoal.carbs && (
                    <div>
                      <div className='flex justify-between text-[13px] mb-1'>
                        <span className='text-gray-600 dark:text-gray-400'>
                          Carbs
                        </span>
                        <span
                          className={cn(
                            "font-medium",
                            ownTotals.carbs >= ownGoal.carbs
                              ? "text-ios-green"
                              : "text-gray-600 dark:text-gray-400",
                          )}>
                          {ownTotals.carbs}g / {ownGoal.carbs}g
                          {ownTotals.carbs >= ownGoal.carbs && " ✓"}
                        </span>
                      </div>
                      <div className='h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden'>
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            ownTotals.carbs >= ownGoal.carbs
                              ? "bg-ios-green"
                              : "bg-amber-500",
                          )}
                          style={{
                            width: `${Math.min(
                              100,
                              (ownTotals.carbs / ownGoal.carbs) * 100,
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                  {ownGoal.fat && (
                    <div>
                      <div className='flex justify-between text-[13px] mb-1'>
                        <span className='text-gray-600 dark:text-gray-400'>
                          Fat
                        </span>
                        <span
                          className={cn(
                            "font-medium",
                            ownTotals.fat >= ownGoal.fat
                              ? "text-ios-green"
                              : "text-gray-600 dark:text-gray-400",
                          )}>
                          {ownTotals.fat}g / {ownGoal.fat}g
                          {ownTotals.fat >= ownGoal.fat && " ✓"}
                        </span>
                      </div>
                      <div className='h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden'>
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            ownTotals.fat >= ownGoal.fat
                              ? "bg-ios-green"
                              : "bg-purple-500",
                          )}
                          style={{
                            width: `${Math.min(
                              100,
                              (ownTotals.fat / ownGoal.fat) * 100,
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

            {/* Protein Quick-Select Map */}
            {type.showProteinMap &&
              (() => {
                const recentFoods = (suggestions[type.id] || []).slice(0, 9);
                if (recentFoods.length === 0) return null;

                // Auto-match food names to Lucide icons
                const foodIconMap: [RegExp, string][] = [
                  [/chicken|kylling/i, "chicken"],
                  [/beef|steak|biff|okse/i, "beef"],
                  [/pork|ribbe|svin/i, "pork"],
                  [/fish|laks|salmon|tuna|torsk|cod|fisk/i, "fish"],
                  [/shrimp|reke|prawn/i, "shrimp"],
                  [/seafood|sjømat|crab|krabbe|lobster/i, "fish"],
                  [/egg/i, "egg"],
                  [/milk|melk/i, "milk"],
                  [/cottage.*cheese|kesam/i, "cottageCheese"],
                  [/cheese|ost(?!e)/i, "cheese"],
                  [/yogurt|yoghurt|skyr/i, "yoghurt"],
                  [/bread|brød/i, "wheat"],
                  [/crisp.*bread|knekkebrød|knekkebr/i, "crispBread"],
                  [/rice|ris\b/i, "hotFood"],
                  [/pasta|spaghetti|noodle/i, "hotFood"],
                  [/bean|bønne|lentil|linse/i, "bean"],
                  [/nut|nøtt|almond|peanut/i, "nut"],
                  [/tofu|soy/i, "vegan"],
                  [/turkey|kalkun/i, "chicken"],
                  [/salad|salat/i, "salad"],
                  [/oat|havre|granola|cereal/i, "soup"],
                  [/apple|eple/i, "apple"],
                  [/banana/i, "banana"],
                  [/avocado/i, "leaf"],
                  [/potato|potet/i, "hotFood"],
                  [/carrot|gulrot/i, "carrot"],
                  [/broccoli|brokkoli/i, "leafyGreen"],
                  [/corn|mais/i, "wheat"],
                  [/pizza/i, "pizza"],
                  [/burger|hamburger/i, "burger"],
                  [/taco/i, "sandwich"],
                  [/sushi/i, "fish"],
                  [/cake|kake/i, "cakeSlice"],
                  [/chocolate|sjokolade/i, "candy"],
                  [/coffee|kaffe/i, "coffee"],
                  [/juice|smoothie/i, "glassWater"],
                  [/protein|shake|pulver/i, "cupSoda"],
                  [/bacon/i, "ham"],
                  [/ham|skinke/i, "ham"],
                  [/soup|suppe/i, "soup"],
                  [/sandwich|smørbrød/i, "sandwich"],
                  [/waffle|vaffel/i, "cookie"],
                  [/pancake|pannekake/i, "cookie"],
                  [/lamb|lam\b/i, "beef"],
                  [/honey|honning/i, "candy"],
                  [/butter|smør/i, "cakeSlice"],
                  [/berry|bær|blueberry|strawberry/i, "cherry"],
                  [/grape|drue/i, "grape"],
                  [/orange|appelsin|lemon|sitron/i, "citrus"],
                  [/ice.*cream|is\b/i, "iceCream"],
                  [/popcorn|snack|chips/i, "popcorn"],
                  [/cookie|kjeks/i, "cookie"],
                  [/croissant|bolle/i, "croissant"],
                ];

                const getFoodIcon = (name: string): string => {
                  for (const [pattern, icon] of foodIconMap) {
                    if (pattern.test(name)) return icon;
                  }
                  return "restaurant";
                };

                return (
                  <div className='space-y-2.5 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50'>
                    <div className='flex items-center justify-between'>
                      <p className='text-[13px] font-medium text-gray-500'>
                        Recent Foods
                      </p>
                      <button
                        type='button'
                        onClick={() => setEditingFoodMap(!editingFoodMap)}
                        className='text-[13px] font-medium text-ios-blue active:opacity-60'>
                        {editingFoodMap ? "Done" : "Edit"}
                      </button>
                    </div>
                    <div className='grid grid-cols-3 gap-2.5'>
                      {recentFoods.map((food) => {
                        const customIcon = (type.foodIcons || {})[food.value];
                        const foodIcon = customIcon
                          ? customIcon
                          : getFoodIcon(food.value);
                        const isSelected =
                          nutritionInput.foodName === food.value;
                        return (
                          <div key={food.value} className='relative'>
                            <button
                              type='button'
                              onClick={() => {
                                if (editingFoodMap) {
                                  setEditingFoodItem({
                                    typeId: type.id,
                                    originalName: food.value,
                                    newName: food.value,
                                  });
                                } else {
                                  setNutritionInput({
                                    foodName: food.value,
                                  });
                                }
                              }}
                              className={cn(
                                "relative w-full flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-2xl border transition-all active:scale-95 origin-center",
                                isSelected
                                  ? "z-10 scale-[1.08] shadow-md border-ios-blue bg-ios-blue/10"
                                  : "",
                                !isSelected &&
                                  (editingFoodMap
                                    ? "border-ios-blue/40 bg-ios-blue/5"
                                    : "border-gray-200/80 dark:border-gray-700/80 bg-white dark:bg-gray-800"),
                              )}>
                              {editingFoodMap && (
                                <div className='absolute top-1 right-1.5'>
                                  <svg
                                    className='w-3.5 h-3.5 text-ios-blue'
                                    fill='none'
                                    viewBox='0 0 24 24'
                                    stroke='currentColor'
                                    strokeWidth={2}>
                                    <path
                                      strokeLinecap='round'
                                      strokeLinejoin='round'
                                      d='m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z'
                                    />
                                  </svg>
                                </div>
                              )}
                              <Icon
                                name={foodIcon}
                                className={cn(
                                  "w-7 h-7",
                                  editingFoodMap
                                    ? "text-ios-blue"
                                    : isSelected
                                      ? "text-ios-blue"
                                      : "text-gray-600 dark:text-gray-300",
                                )}
                                strokeWidth={1.5}
                              />
                              <span
                                className={cn(
                                  "text-[13px] font-medium leading-tight text-center w-full px-1",
                                  isSelected ? "line-clamp-2" : "truncate",
                                  editingFoodMap
                                    ? "text-ios-blue"
                                    : isSelected
                                      ? "text-ios-blue"
                                      : "text-gray-700 dark:text-gray-300",
                                )}>
                                {food.value}
                              </span>
                              <span className='text-[11px] text-gray-400'>
                                {food.count}×
                              </span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

            {/* Add new entry form */}
            {(() => {
              const typeSuggestions = suggestions[type.id] || [];
              // Filter suggestions based on what the user is typing
              const filteredSuggestions = nutritionInput.foodName.trim()
                ? typeSuggestions.filter((sugg) =>
                    sugg.value
                      .toLowerCase()
                      .includes(nutritionInput.foodName.toLowerCase()),
                  )
                : typeSuggestions;
              // Show dropdown when focused and has suggestions (either all or filtered)
              const suggestionsToShow = filteredSuggestions.slice(0, 10);
              const showDropdown =
                showNutritionDropdown &&
                suggestionsToShow.length > 0 &&
                // Don't show if exact match is typed
                !suggestionsToShow.some(
                  (s) =>
                    s.value.toLowerCase() ===
                    nutritionInput.foodName.toLowerCase().trim(),
                );

              return (
                <div className='space-y-3'>
                  <div className='relative'>
                    <input
                      type='text'
                      value={nutritionInput.foodName}
                      onChange={(e) => {
                        setNutritionInput({
                          ...nutritionInput,
                          foodName: e.target.value,
                        });
                        setShowNutritionDropdown(true);
                      }}
                      onFocus={() => setShowNutritionDropdown(true)}
                      onBlur={() =>
                        setTimeout(() => setShowNutritionDropdown(false), 200)
                      }
                      placeholder='What did you eat?'
                      className='w-full px-3 py-2 rounded-lg text-[17px] bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-ios-blue'
                    />
                    {/* Autocomplete dropdown - shows recent suggestions */}
                    {showDropdown && (
                      <div className='absolute left-0 right-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-50 max-h-64 overflow-y-auto'>
                        {suggestionsToShow.map((sugg) => (
                          <button
                            key={sugg.value}
                            onClick={() => {
                              setNutritionInput({
                                ...nutritionInput,
                                foodName: sugg.value,
                              });
                              setShowNutritionDropdown(false);
                            }}
                            className='w-full px-3 py-2.5 text-left text-[17px] text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 border-b border-gray-100 dark:border-gray-700 last:border-b-0 flex items-center justify-between'>
                            <span>{sugg.value}</span>
                            <span className='text-[13px] text-gray-400 dark:text-gray-500'>
                              ({sugg.count}×)
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {type.showDailyGoals && (
                    <div className='grid grid-cols-2 gap-2'>
                      <div>
                        <label className='text-[12px] text-gray-500 mb-1 block'>
                          Calories
                        </label>
                        <input
                          type='number'
                          value={nutritionInput.calories || ""}
                          onChange={(e) =>
                            setNutritionInput({
                              ...nutritionInput,
                              calories: e.target.value
                                ? parseInt(e.target.value)
                                : undefined,
                            })
                          }
                          placeholder='kcal'
                          className='w-full px-3 py-2 rounded-lg text-[15px] bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-ios-blue'
                        />
                      </div>
                      <div>
                        <label className='text-[12px] text-gray-500 mb-1 block'>
                          Protein (g)
                        </label>
                        <input
                          type='number'
                          value={nutritionInput.protein || ""}
                          onChange={(e) =>
                            setNutritionInput({
                              ...nutritionInput,
                              protein: e.target.value
                                ? parseInt(e.target.value)
                                : undefined,
                            })
                          }
                          placeholder='g'
                          className='w-full px-3 py-2 rounded-lg text-[15px] bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-ios-blue'
                        />
                      </div>
                      <div>
                        <label className='text-[12px] text-gray-500 mb-1 block'>
                          Carbs (g)
                        </label>
                        <input
                          type='number'
                          value={nutritionInput.carbs || ""}
                          onChange={(e) =>
                            setNutritionInput({
                              ...nutritionInput,
                              carbs: e.target.value
                                ? parseInt(e.target.value)
                                : undefined,
                            })
                          }
                          placeholder='g'
                          className='w-full px-3 py-2 rounded-lg text-[15px] bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-ios-blue'
                        />
                      </div>
                      <div>
                        <label className='text-[12px] text-gray-500 mb-1 block'>
                          Fat (g)
                        </label>
                        <input
                          type='number'
                          value={nutritionInput.fat || ""}
                          onChange={(e) =>
                            setNutritionInput({
                              ...nutritionInput,
                              fat: e.target.value
                                ? parseInt(e.target.value)
                                : undefined,
                            })
                          }
                          placeholder='g'
                          className='w-full px-3 py-2 rounded-lg text-[15px] bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-ios-blue'
                        />
                      </div>
                    </div>
                  )}
                  <button
                    data-info='Add Food. Save this food entry with its nutritional information.'
                    onClick={() => handleSaveNutrition(type.id)}
                    disabled={!nutritionInput.foodName.trim()}
                    className='w-full py-2.5 rounded-full text-[14px] font-medium bg-ios-blue text-white shadow-lg shadow-ios-blue/30 disabled:opacity-50 disabled:cursor-not-allowed'>
                    Add Food
                  </button>
                </div>
              );
            })()}
          </div>
        );
      }

      case "workout": {
        const typeEntries = savedValues[type.id] || [];

        // Group exercises by entry ID to show separate workouts (use Set to avoid duplicates)
        const seenEntryIds = new Set<string>();
        const workoutEntries: Array<{
          entryId: string;
          exercises: WorkoutExercise[];
        }> = [];
        let quickCheckEntryId: string | null = null;

        typeEntries.forEach((saved) => {
          // Skip if we've already processed this entry
          if (seenEntryIds.has(saved.id)) return;
          seenEntryIds.add(saved.id);

          const entry = entries.find((e) => e.id === saved.id);
          if (entry?.workoutData?.exercises?.length) {
            workoutEntries.push({
              entryId: saved.id,
              exercises: entry.workoutData.exercises,
            });
          } else if (saved.value === true) {
            // Track quick check separately - don't add to visible list
            quickCheckEntryId = saved.id;
          }
        });

        const hasAnyWorkout = workoutEntries.length > 0;
        const isQuickChecked = !!quickCheckEntryId;

        return (
          <div className='space-y-3'>
            {/* List of workout entries (only actual workouts, not quick checks) */}
            {workoutEntries.map((workout, workoutIdx) => {
              const firstExercise = workout.exercises[0];
              const hasMoreExercises = workout.exercises.length > 1;

              return (
                <div
                  key={workout.entryId}
                  className='flex items-center justify-between py-2 px-3 bg-white dark:bg-gray-800 rounded-xl'>
                  <div className='flex items-center gap-3 flex-1 min-w-0'>
                    <span className='w-6 h-6 rounded-full bg-ios-green/10 text-ios-green text-[13px] font-semibold flex items-center justify-center shrink-0'>
                      {workoutIdx + 1}
                    </span>
                    <div className='flex items-center gap-2 min-w-0'>
                      <span className='text-[15px] font-medium text-gray-900 dark:text-white truncate'>
                        {firstExercise.name}
                      </span>
                      {hasMoreExercises ? (
                        <span className='text-[13px] text-gray-400 dark:text-gray-500 shrink-0'>
                          ++
                        </span>
                      ) : (
                        firstExercise.sets && (
                          <span className='text-[13px] text-gray-400 dark:text-gray-500 shrink-0'>
                            {firstExercise.sets}×
                            {firstExercise.weight &&
                              ` ${firstExercise.weight}kg`}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      router.push(`/workout?edit=${workout.entryId}`)
                    }
                    className='p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500 shrink-0'>
                    <svg
                      className='w-4 h-4'
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'
                      strokeWidth={2}>
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        d='M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z'
                      />
                    </svg>
                  </button>
                </div>
              );
            })}

            {/* Bottom row with quick check and add workout */}
            <div className='flex items-center gap-2'>
              {/* Quick check button - only show if no workouts added */}
              {!hasAnyWorkout && (
                <button
                  onClick={() => {
                    if (isQuickChecked && quickCheckEntryId) {
                      deleteEntry(quickCheckEntryId);
                    } else {
                      handleSaveValue(type.id, true);
                    }
                  }}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-medium transition-colors workout-action-btn",
                    isQuickChecked
                      ? "bg-ios-green text-white shadow-lg shadow-ios-green/30"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400",
                  )}>
                  <svg
                    className='w-4 h-4'
                    fill='none'
                    viewBox='0 0 24 24'
                    stroke='currentColor'
                    strokeWidth={2}>
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      d='M5 13l4 4L19 7'
                    />
                  </svg>
                  Quick check
                </button>
              )}

              {/* Add new workout button */}
              <button
                data-info='Add workout. Open the workout tracker to log a new session.'
                onClick={() => router.push("/workout")}
                className='px-4 py-2 rounded-full text-[13px] bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors workout-action-btn'>
                + Add workout
              </button>
            </div>
          </div>
        );
      }

      case "checklist": {
        const typeEntries = savedValues[type.id] || [];
        // Get the checklist entry for this day (there should only be one per day)
        const existingEntry = entries.find(
          (e) =>
            e.activityTypeId === type.id && e.date === date && e.checklistData,
        );
        const checklistItems = existingEntry?.checklistData?.items || [];
        const completedCount = checklistItems.filter(
          (item) => item.completed,
        ).length;
        const totalCount = checklistItems.length;

        const currentChecklistText = getChecklistText(type.id);
        const handleAddItem = async () => {
          if (!currentChecklistText.trim()) return;

          const itemText = currentChecklistText.trim();
          // Clear input immediately
          setChecklistText(type.id, "");

          const newItem: ChecklistItem = {
            id: crypto.randomUUID(),
            text: itemText,
            completed: false,
            addedDate: date,
          };

          const updatedItems = [...checklistItems, newItem];
          const checklistData: ChecklistData = { items: updatedItems };

          if (existingEntry) {
            await updateEntry({
              ...existingEntry,
              checklistData,
              value: `${updatedItems.filter((i) => i.completed).length}/${updatedItems.length}`,
            });
          } else {
            await addEntry({
              date,
              activityTypeId: type.id,
              value: `0/${updatedItems.length}`,
              checklistData,
            });
          }

          // If repeating checklist, update master template
          if (type.checklistRepeat && type.checklistRepeat !== "none") {
            try {
              let currentTemplate = type.checklistTemplate || [];
              // Bootstrap template from existing items if empty
              if (currentTemplate.length === 0) {
                currentTemplate = checklistItems.map((item) => ({
                  text: item.text,
                  addedDate: item.addedDate || date,
                }));
              }
              if (!currentTemplate.some((t) => t.text === itemText)) {
                const updatedTemplate = [
                  ...currentTemplate,
                  { text: itemText, addedDate: date },
                ];
                await updateActivityType({
                  ...type,
                  checklistTemplate: updatedTemplate,
                });

                // Also update tomorrow's existing entry if one was already created
                const tomorrow = addDays(date, 1);
                const tomorrowEntry = entries.find(
                  (e) =>
                    e.activityTypeId === type.id &&
                    e.date === tomorrow &&
                    e.checklistData,
                );
                if (tomorrowEntry) {
                  const tomorrowTexts = new Set(
                    tomorrowEntry.checklistData?.items?.map((i) => i.text) ||
                      [],
                  );
                  if (!tomorrowTexts.has(itemText)) {
                    const tomorrowItems = [
                      ...(tomorrowEntry.checklistData?.items || []),
                      {
                        id: crypto.randomUUID(),
                        text: itemText,
                        completed: false,
                        addedDate: date,
                      },
                    ];
                    await updateEntry({
                      ...tomorrowEntry,
                      checklistData: { items: tomorrowItems },
                      value: `${tomorrowItems.filter((i) => i.completed).length}/${tomorrowItems.length}`,
                    });
                  }
                }
              }
            } catch (err) {
              console.error("Failed to update checklist template:", err);
            }
          }
        };

        const handleToggleItem = async (itemId: string) => {
          if (!existingEntry) return;

          const toggledItem = checklistItems.find((i) => i.id === itemId);
          const willBeCompleted = !toggledItem?.completed;

          const updatedItems = checklistItems.map((item) =>
            item.id === itemId ? { ...item, completed: !item.completed } : item,
          );
          const checklistData: ChecklistData = { items: updatedItems };

          await updateEntry({
            ...existingEntry,
            checklistData,
            value: `${updatedItems.filter((i) => i.completed).length}/${updatedItems.length}`,
          });

          // When completing an item, remove it from all pre-existing future entries
          // to prevent it reappearing on days that were visited before this check.
          if (willBeCompleted && toggledItem) {
            const futureEntries = entries.filter(
              (e) =>
                e.activityTypeId === type.id &&
                e.date > date &&
                e.checklistData?.items?.some(
                  (i) => i.text === toggledItem.text && !i.completed,
                ),
            );
            for (const futureEntry of futureEntries) {
              const updatedFutureItems = (
                futureEntry.checklistData?.items || []
              ).filter((i) => i.text !== toggledItem.text);
              await updateEntry({
                ...futureEntry,
                checklistData: { items: updatedFutureItems },
                value: `${updatedFutureItems.filter((i) => i.completed).length}/${updatedFutureItems.length}`,
              });
            }
          }
        };

        const handleDeleteItem = async (itemId: string) => {
          if (!existingEntry) return;

          const deletedItem = checklistItems.find((item) => item.id === itemId);
          const updatedItems = checklistItems.filter(
            (item) => item.id !== itemId,
          );

          // For repeating checklists: update master template + tomorrow's entry
          if (
            deletedItem &&
            type.checklistRepeat &&
            type.checklistRepeat !== "none"
          ) {
            if (type.checklistTemplate) {
              const updatedTemplate = type.checklistTemplate.filter(
                (t) => t.text !== deletedItem.text,
              );
              await updateActivityType({
                ...type,
                checklistTemplate: updatedTemplate,
              });
            }

            // Also remove from tomorrow's existing entry if one was already created
            const tomorrow = addDays(date, 1);
            const tomorrowEntry = entries.find(
              (e) =>
                e.activityTypeId === type.id &&
                e.date === tomorrow &&
                e.checklistData,
            );
            if (tomorrowEntry) {
              const tomorrowItems = (
                tomorrowEntry.checklistData?.items || []
              ).filter((i) => i.text !== deletedItem.text);
              if (tomorrowItems.length === 0) {
                await deleteEntry(tomorrowEntry.id);
              } else {
                await updateEntry({
                  ...tomorrowEntry,
                  checklistData: { items: tomorrowItems },
                  value: `${tomorrowItems.filter((i) => i.completed).length}/${tomorrowItems.length}`,
                });
              }
            }
          }

          // Update or delete the current entry
          if (updatedItems.length === 0) {
            await deleteEntry(existingEntry.id);
          } else {
            const checklistData: ChecklistData = { items: updatedItems };
            await updateEntry({
              ...existingEntry,
              checklistData,
              value: `${updatedItems.filter((i) => i.completed).length}/${updatedItems.length}`,
            });
          }
        };

        return (
          <div className='pt-3 space-y-3'>
            {/* Progress - only show when there are completed items */}
            {completedCount > 0 && (
              <div className='flex items-center gap-2 text-[13px] text-gray-500 dark:text-gray-400'>
                <span>
                  {completedCount}/{totalCount} completed
                </span>
                {completedCount === totalCount && totalCount > 0 && (
                  <span className='text-ios-green'>✓ All done!</span>
                )}
              </div>
            )}

            {/* Checklist items */}
            <div className='space-y-1'>
              {checklistItems.map((item) => (
                <div
                  key={item.id}
                  className='flex items-center gap-3 py-2 px-1 group'>
                  <button
                    onClick={() => handleToggleItem(item.id)}
                    className={cn(
                      "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                      item.completed
                        ? "bg-ios-green border-ios-green"
                        : "border-gray-300 dark:border-gray-600",
                    )}>
                    {item.completed && (
                      <svg
                        className='w-4 h-4 text-white'
                        fill='none'
                        viewBox='0 0 24 24'
                        stroke='currentColor'
                        strokeWidth={3}>
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          d='M5 13l4 4L19 7'
                        />
                      </svg>
                    )}
                  </button>
                  <span
                    className={cn(
                      "flex-1 text-[15px]",
                      item.completed
                        ? "text-gray-400 dark:text-gray-500 line-through"
                        : "text-gray-900 dark:text-white",
                    )}>
                    {item.text}
                  </span>
                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    className='w-6 h-6 rounded-full flex items-center justify-center text-gray-200 dark:text-gray-700 active:text-ios-red transition-colors'>
                    <svg
                      className='w-3 h-3'
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'
                      strokeWidth={1.5}>
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        d='M6 18L18 6M6 6l12 12'
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            {/* Add new item with autocomplete */}
            <div className='relative'>
              <div className='flex items-center gap-2'>
                <input
                  type='text'
                  value={currentChecklistText}
                  onChange={(e) => {
                    setChecklistText(type.id, e.target.value);
                    setShowChecklistDropdown(true);
                    setActiveChecklistTypeId(type.id);
                  }}
                  onFocus={() => {
                    setShowChecklistDropdown(true);
                    setActiveChecklistTypeId(type.id);
                  }}
                  onBlur={() =>
                    setTimeout(() => setShowChecklistDropdown(false), 200)
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddItem();
                      setShowChecklistDropdown(false);
                    }
                    if (e.key === "Escape") {
                      setShowChecklistDropdown(false);
                    }
                  }}
                  placeholder='Add new item...'
                  className='flex-1 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-[15px] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-ios-blue'
                />
                <button
                  data-info='Add. Create a new item on the checklist.'
                  onClick={() => {
                    handleAddItem();
                    setShowChecklistDropdown(false);
                  }}
                  disabled={!currentChecklistText.trim()}
                  className={cn(
                    "px-4 py-2 rounded-lg text-[15px] font-medium transition-colors",
                    currentChecklistText.trim()
                      ? "bg-ios-blue text-white"
                      : "bg-gray-200 dark:bg-gray-600 text-gray-400 dark:text-gray-500",
                  )}>
                  Add
                </button>
              </div>
              {/* Autocomplete dropdown */}
              {showChecklistDropdown &&
                activeChecklistTypeId === type.id &&
                (() => {
                  const typeSuggestions =
                    checklistSuggestionsByType[type.id] || [];
                  // Filter suggestions based on what the user is typing
                  const filteredSuggestions = currentChecklistText.trim()
                    ? typeSuggestions.filter((sugg) =>
                        sugg.value
                          .toLowerCase()
                          .includes(currentChecklistText.toLowerCase()),
                      )
                    : typeSuggestions;
                  // Don't show if exact match or no suggestions
                  const showDropdown =
                    filteredSuggestions.length > 0 &&
                    !filteredSuggestions.some(
                      (s) =>
                        s.value.toLowerCase() ===
                        currentChecklistText.toLowerCase().trim(),
                    );

                  if (!showDropdown) return null;

                  return (
                    <div className='absolute left-0 right-12 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-50 max-h-48 overflow-y-auto'>
                      {filteredSuggestions.slice(0, 10).map((sugg) => (
                        <button
                          key={sugg.value}
                          onClick={() => {
                            setChecklistText(type.id, sugg.value);
                            setShowChecklistDropdown(false);
                          }}
                          className='w-full px-3 py-2.5 text-left text-[15px] text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 border-b border-gray-100 dark:border-gray-700 last:border-b-0 flex items-center justify-between'>
                          <span>{sugg.value}</span>
                          <span className='text-[13px] text-gray-400 dark:text-gray-500'>
                            ({sugg.count}×)
                          </span>
                        </button>
                      ))}
                    </div>
                  );
                })()}
            </div>
          </div>
        );
      }

      case "timer": {
        if (!type.timerConfig?.subjects?.length) {
          return (
            <div className='pt-3'>
              <p className='text-[13px] text-gray-500 dark:text-gray-400'>
                No subjects configured. Edit this activity type to add subjects.
              </p>
            </div>
          );
        }

        // Find existing timer entry for this day
        const existingTimerEntry = entries.find(
          (e) => e.activityTypeId === type.id && e.date === date && e.timerData,
        );
        const timerEntries = existingTimerEntry?.timerData?.entries || [];

        const handleTimerSave = async (
          subjectId: string,
          baseMinutes: number,
          adjustments?: TimerAdjustment[],
        ) => {
          const adjs = adjustments || [];
          const addTotal = adjs
            .filter((a) => a.type === "add")
            .reduce((sum, a) => sum + a.minutes, 0);
          const subtractTotal = adjs
            .filter((a) => a.type === "subtract")
            .reduce((sum, a) => sum + a.minutes, 0);

          const updatedEntries: TimerEntry[] = type.timerConfig!.subjects.map(
            (subject) => {
              if (subject.id === subjectId) {
                return {
                  subjectId: subject.id,
                  minutes: Math.max(0, baseMinutes + addTotal),
                  subtractMinutes: subtractTotal,
                  adjustments: adjs.length > 0 ? adjs : undefined,
                };
              }
              const existing = timerEntries.find(
                (te) => te.subjectId === subject.id,
              );
              return {
                subjectId: subject.id,
                minutes: existing?.minutes || 0,
                subtractMinutes: existing?.subtractMinutes || 0,
                adjustments: existing?.adjustments,
              };
            },
          );

          const timerData: TimerData = { entries: updatedEntries };
          const parts = type.timerConfig!.subjects.map((subject) => {
            const entry = updatedEntries.find(
              (e) => e.subjectId === subject.id,
            );
            const net = Math.max(
              0,
              (entry?.minutes || 0) - (entry?.subtractMinutes || 0),
            );
            const h = Math.floor(net / 60);
            const m = net % 60;
            return `${subject.name}: ${h > 0 ? `${h}h ${m}m` : `${m}m`}`;
          });
          const valueStr = parts.join(", ");

          if (existingTimerEntry) {
            await updateEntry({
              ...existingTimerEntry,
              timerData,
              value: valueStr,
            });
          } else {
            await addEntry({
              date,
              activityTypeId: type.id,
              value: valueStr,
              timerData,
            });
          }
        };

        return (
          <div className='pt-3 space-y-4'>
            {/* Per-subject time inputs */}
            {type.timerConfig.subjects.map((subject) => {
              const subjectEntry = timerEntries.find(
                (te) => te.subjectId === subject.id,
              );
              const storedMinutes = subjectEntry?.minutes || 0;
              const storedSubtract = subjectEntry?.subtractMinutes || 0;
              // Derive adjustments from stored data (backward compat)
              const adjustments: TimerAdjustment[] =
                subjectEntry?.adjustments ||
                (storedSubtract > 0
                  ? [
                      {
                        id: `legacy-${subject.id}`,
                        type: "subtract" as const,
                        minutes: storedSubtract,
                      },
                    ]
                  : []);
              const addTotal = adjustments
                .filter((a) => a.type === "add")
                .reduce((sum, a) => sum + a.minutes, 0);
              const subtractTotal = adjustments
                .filter((a) => a.type === "subtract")
                .reduce((sum, a) => sum + a.minutes, 0);
              const baseMinutes = storedMinutes - addTotal;
              const baseH = Math.floor(baseMinutes / 60);
              const baseM = baseMinutes % 60;
              const netMinutes = Math.max(0, storedMinutes - storedSubtract);
              const netH = Math.floor(netMinutes / 60);
              const netM = netMinutes % 60;
              const subjectLimit =
                subject.limitMinutes || type.timerConfig.limitMinutes || 0;

              const handleAddAdjustment = (adjType: "add" | "subtract") => {
                const newAdj: TimerAdjustment = {
                  id: crypto.randomUUID(),
                  type: adjType,
                  minutes: 0,
                };
                const updated = [...adjustments, newAdj];
                handleTimerSave(subject.id, baseMinutes, updated);
              };

              const handleRemoveAdjustment = (adjId: string) => {
                const updated = adjustments.filter((a) => a.id !== adjId);
                handleTimerSave(subject.id, baseMinutes, updated);
              };

              const handleUpdateAdjustment = (
                adjId: string,
                updates: Partial<TimerAdjustment>,
              ) => {
                const updated = adjustments.map((a) =>
                  a.id === adjId ? { ...a, ...updates } : a,
                );
                handleTimerSave(subject.id, baseMinutes, updated);
              };

              return (
                <div
                  key={subject.id}
                  className='p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 space-y-2'>
                  <div className='flex items-center justify-between'>
                    <label className='text-[15px] font-medium text-gray-900 dark:text-white'>
                      {subject.name}
                    </label>
                    <div className='flex items-center gap-2'>
                      {netMinutes > 0 && (
                        <span
                          className={cn(
                            "text-[15px] font-semibold",
                            adjustments.length > 0
                              ? "text-ios-blue"
                              : "text-gray-900 dark:text-white",
                          )}>
                          {netH > 0 ? `${netH}h ${netM}m` : `${netM}m`}
                        </span>
                      )}
                      {subjectLimit > 0 &&
                        (() => {
                          const status = getTimerSubjectStatus(
                            subject.id,
                            subjectLimit,
                            type.timerConfig.limitPeriod || "daily",
                            date,
                            entries,
                            type.id,
                          );
                          const remaining = Math.max(
                            0,
                            subjectLimit - status.usedMinutes,
                          );
                          const over = status.usedMinutes > subjectLimit;
                          const colorClass =
                            status.color === "red"
                              ? "text-red-500"
                              : status.color === "yellow"
                                ? "text-yellow-500"
                                : "text-green-500";
                          const rH = Math.floor(remaining / 60);
                          const rM = remaining % 60;
                          if (over) {
                            const o = status.usedMinutes - subjectLimit;
                            const oH = Math.floor(o / 60);
                            const oM = o % 60;
                            return (
                              <span
                                className={cn(
                                  "text-[13px] font-medium",
                                  colorClass,
                                )}>
                                +{oH > 0 ? `${oH}h ` : ""}
                                {oM}m
                              </span>
                            );
                          }
                          return (
                            <span
                              className={cn(
                                "text-[13px] font-medium",
                                colorClass,
                              )}>
                              {rH > 0 ? `${rH}h ${rM}m left` : `${rM}m left`}
                            </span>
                          );
                        })()}
                    </div>
                  </div>
                  {/* Time input row with +/- buttons */}
                  <div className='flex items-center gap-1'>
                    <div className='flex items-center gap-1'>
                      <input
                        type='number'
                        value={baseH || ""}
                        onChange={(e) => {
                          const h = parseInt(e.target.value) || 0;
                          handleTimerSave(
                            subject.id,
                            h * 60 + baseM,
                            adjustments,
                          );
                        }}
                        placeholder='0'
                        min='0'
                        className='w-14 px-2 py-1.5 rounded-lg text-[15px] bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-ios-blue text-center'
                      />
                      <span className='text-[13px] text-gray-500'>h</span>
                      <input
                        type='number'
                        value={baseM || ""}
                        onChange={(e) => {
                          const m = Math.min(59, parseInt(e.target.value) || 0);
                          handleTimerSave(
                            subject.id,
                            baseH * 60 + m,
                            adjustments,
                          );
                        }}
                        placeholder='0'
                        min='0'
                        max='59'
                        className='w-14 px-2 py-1.5 rounded-lg text-[15px] bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-ios-blue text-center'
                      />
                      <span className='text-[13px] text-gray-500'>m</span>
                    </div>
                    {/* Add / Subtract buttons */}
                    <div className='flex items-center gap-2.5 ml-auto'>
                      <button
                        type='button'
                        data-info='Add time. Add a time entry for this subject.'
                        onClick={() => handleAddAdjustment("add")}
                        className='w-7 h-7 rounded-full flex items-center justify-center text-ios-green bg-ios-green/10 active:bg-ios-green/20 transition-colors'
                        title='Add time'>
                        <svg
                          className='w-3.5 h-3.5'
                          fill='none'
                          viewBox='0 0 24 24'
                          stroke='currentColor'
                          strokeWidth={2.5}>
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            d='M12 4v16m8-8H4'
                          />
                        </svg>
                      </button>
                      <button
                        type='button'
                        data-info='Subtract time. Remove time from this subject.'
                        onClick={() => handleAddAdjustment("subtract")}
                        className='w-7 h-7 rounded-full flex items-center justify-center text-ios-red bg-ios-red/10 active:bg-ios-red/20 transition-colors'
                        title='Subtract time'>
                        <svg
                          className='w-3.5 h-3.5'
                          fill='none'
                          viewBox='0 0 24 24'
                          stroke='currentColor'
                          strokeWidth={2.5}>
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            d='M20 12H4'
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                  {/* Adjustment rows */}
                  {adjustments.map((adj) => {
                    const adjH = Math.floor(adj.minutes / 60);
                    const adjM = adj.minutes % 60;
                    const isAdd = adj.type === "add";
                    return (
                      <div
                        key={adj.id}
                        className={cn(
                          "flex items-center gap-1 pl-0 pr-2 py-1 rounded-lg",
                          isAdd
                            ? "bg-ios-green/8 dark:bg-ios-green/10"
                            : "bg-ios-red/8 dark:bg-ios-red/10",
                        )}>
                        <input
                          type='number'
                          value={adjH || ""}
                          onChange={(e) => {
                            const h = parseInt(e.target.value) || 0;
                            handleUpdateAdjustment(adj.id, {
                              minutes: h * 60 + adjM,
                            });
                          }}
                          placeholder='0'
                          min='0'
                          className={cn(
                            "w-14 px-2 py-1.5 rounded-lg text-[15px] text-center text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2",
                            isAdd
                              ? "bg-ios-green/5 dark:bg-ios-green/15 focus:ring-ios-green/50"
                              : "bg-ios-red/5 dark:bg-ios-red/15 focus:ring-ios-red/50",
                          )}
                        />
                        <span className='text-[13px] text-gray-500'>h</span>
                        <input
                          type='number'
                          value={adjM || ""}
                          onChange={(e) => {
                            const m = Math.min(
                              59,
                              parseInt(e.target.value) || 0,
                            );
                            handleUpdateAdjustment(adj.id, {
                              minutes: adjH * 60 + m,
                            });
                          }}
                          placeholder='0'
                          min='0'
                          max='59'
                          className={cn(
                            "w-14 px-2 py-1.5 rounded-lg text-[15px] text-center text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2",
                            isAdd
                              ? "bg-ios-green/5 dark:bg-ios-green/15 focus:ring-ios-green/50"
                              : "bg-ios-red/5 dark:bg-ios-red/15 focus:ring-ios-red/50",
                          )}
                        />
                        <span className='text-[13px] text-gray-500'>m</span>
                        <input
                          type='text'
                          value={adj.comment || ""}
                          onChange={(e) =>
                            handleUpdateAdjustment(adj.id, {
                              comment: e.target.value,
                            })
                          }
                          placeholder='comment...'
                          className={cn(
                            "flex-1 min-w-0 px-2 py-1.5 rounded-lg text-[13px] text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-gray-600",
                            isAdd
                              ? "bg-ios-green/5 dark:bg-ios-green/15"
                              : "bg-ios-red/5 dark:bg-ios-red/15",
                          )}
                        />
                        <button
                          type='button'
                          onClick={() => handleRemoveAdjustment(adj.id)}
                          className='w-5 h-5 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0'>
                          <svg
                            className='w-3 h-3'
                            fill='none'
                            viewBox='0 0 24 24'
                            stroke='currentColor'
                            strokeWidth={2.5}>
                            <path
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              d='M6 18L18 6M6 6l12 12'
                            />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                  {/* Period progress bar for this subject */}
                  {subjectLimit > 0 &&
                    (() => {
                      const status = getTimerSubjectStatus(
                        subject.id,
                        subjectLimit,
                        type.timerConfig.limitPeriod || "daily",
                        date,
                        entries,
                        type.id,
                      );
                      const colorClass =
                        status.color === "red"
                          ? "bg-red-500"
                          : status.color === "yellow"
                            ? "bg-yellow-500"
                            : "bg-green-500";
                      const usagePercent = Math.min(
                        100,
                        (status.usedMinutes / subjectLimit) * 100,
                      );
                      const periodPercent = status.periodProgress * 100;
                      return (
                        <div className='pt-1 space-y-0.5'>
                          <div className='relative h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden'>
                            {/* Period progress marker */}
                            {status.totalDays > 1 && (
                              <div
                                className='absolute top-0 bottom-0 w-[2px] bg-gray-400 dark:bg-gray-500 z-10'
                                style={{ left: `${periodPercent}%` }}
                              />
                            )}
                            {/* Usage fill */}
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                colorClass,
                              )}
                              style={{ width: `${usagePercent}%` }}
                            />
                          </div>
                          {status.totalDays > 1 && (
                            <div className='flex justify-between text-[10px] text-gray-400'>
                              <span>
                                Day {status.dayNumber}/{status.totalDays}
                              </span>
                              <span>
                                {(() => {
                                  const usedH = Math.floor(
                                    status.usedMinutes / 60,
                                  );
                                  const usedM = status.usedMinutes % 60;
                                  const limitH = Math.floor(subjectLimit / 60);
                                  const limitM = subjectLimit % 60;
                                  const usedStr =
                                    usedH > 0
                                      ? `${usedH}h${usedM > 0 ? ` ${usedM}m` : ""}`
                                      : `${usedM}m`;
                                  const limitStr =
                                    limitH > 0
                                      ? `${limitH}h${limitM > 0 ? ` ${limitM}m` : ""}`
                                      : `${limitM}m`;
                                  return `${usedStr} / ${limitStr}`;
                                })()}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                </div>
              );
            })}
          </div>
        );
      }
    }
  };

  // Handler for checkmark toggle in icon grid view
  const handleCheckmarkToggle = (
    typeId: string,
    typeSavedValues: Array<{ id: string; value: unknown }>,
  ) => {
    const hasSavedValues = typeSavedValues.length > 0;
    const now = Date.now();
    const lastClick = lastClickTime[typeId] || 0;
    const isDoubleClick = now - lastClick < 400;
    setLastClickTime({ ...lastClickTime, [typeId]: now });

    if (isDoubleClick) {
      // Double-click: set to "skipped" (red X)
      if (hasSavedValues) {
        typeSavedValues.forEach((saved) => {
          deleteEntry(saved.id);
        });
      }
      handleSaveValue(typeId, "skipped");
    } else {
      // Single click: toggle between checked and unchecked
      if (hasSavedValues) {
        // Remove the checkmark or skipped state
        typeSavedValues.forEach((saved) => {
          deleteEntry(saved.id);
        });
      } else {
        // Add the checkmark
        handleSaveValue(typeId, true);
      }
    }
  };

  // Handler for workout quick-check toggle in icon grid view
  // Single click: opens workout panel, Double click: toggles quick-check
  const handleWorkoutQuickCheck = (
    typeId: string,
    typeSavedValues: Array<{ id: string; value: unknown }>,
  ) => {
    const now = Date.now();
    const lastClick = lastClickTime[typeId] || 0;
    const isDoubleClick = now - lastClick < 400;
    setLastClickTime({ ...lastClickTime, [typeId]: now });

    if (isDoubleClick) {
      // Double-click: toggle quick-check (simple checkmark without workout details)
      // Check if there's already a quick-check entry (value === true, no workoutData)
      const hasQuickCheck = typeSavedValues.some((saved) => {
        const entry = entries.find((e) => e.id === saved.id);
        return saved.value === true && !entry?.workoutData?.exercises?.length;
      });

      if (hasQuickCheck) {
        // Remove the quick-check entry
        typeSavedValues.forEach((saved) => {
          const entry = entries.find((e) => e.id === saved.id);
          if (saved.value === true && !entry?.workoutData?.exercises?.length) {
            deleteEntry(saved.id);
          }
        });
      } else {
        // Add a quick-check entry
        handleSaveValue(typeId, true);
      }
      // Close expanded panel if open
      if (expandedTypeId === typeId) {
        setExpandedTypeId(null);
      }
    } else {
      // Single click: toggle expansion (open workout panel)
      setExpandedTypeId(expandedTypeId === typeId ? null : typeId);
    }
  };

  // Get standalone types (shown as separate cards above the grouped section)
  const standaloneTypes = allActivityTypes.filter(
    (t) =>
      t.standalone &&
      (!t.hidden ||
        (savedValues[t.id] || []).length > 0 ||
        entries.some(
          (e) =>
            e.activityTypeId === t.id &&
            e.date === date &&
            (e.checklistData || e.value),
        )),
  );
  // Split into checklist standalone and other standalone
  const standaloneChecklistTypes = standaloneTypes.filter(
    (t) => t.valueType === "checklist",
  );
  const standaloneCoachTypes = standaloneTypes.filter(
    (t) => t.valueType === "coach",
  );
  const standaloneOtherTypes = standaloneTypes.filter(
    (t) => t.valueType !== "checklist" && t.valueType !== "coach",
  );
  const nextDay = addDays(date, 1);

  return (
    <>
      {/* Standalone Sections — separate cards (only in list view) */}
      {viewMode !== "icons" && (
        <>
          {/* Non-checklist standalone types */}
          {standaloneOtherTypes.map((type) => {
            const typeSavedValues = savedValues[type.id] || [];
            const hasSavedValues = typeSavedValues.length > 0;
            const isCheckmark = type.valueType === "checkmark";
            const isMood = type.valueType === "mood";
            const isWorkout = type.valueType === "workout";
            const isTimer = type.valueType === "timer";

            // Summary for header
            const displayValue =
              isCheckmark && hasSavedValues
                ? typeSavedValues[0].value === "skipped"
                  ? "✗"
                  : "✓"
                : hasSavedValues
                  ? `${typeSavedValues.length}`
                  : null;

            if (type.hidden && !hasSavedValues) return null;

            return (
              <div
                key={type.id}
                data-info={`${type.name} (${type.valueType}). ${
                  isCheckmark
                    ? "Tap to mark as done for today."
                    : type.valueType === "text"
                      ? "Tap to expand and type a value."
                      : type.valueType === "counter"
                        ? "Tap to expand. Use + and − to count."
                        : type.valueType === "mood"
                          ? "Tap to expand and select your mood."
                          : type.valueType === "boolean"
                            ? "Tap to expand and choose Yes or No."
                            : type.valueType === "nutrition"
                              ? "Tap to expand and log food with calories, protein, carbs, fat."
                              : type.valueType === "workout"
                                ? "Tap to expand and log exercises with sets, reps, and weight."
                                : type.valueType === "checklist"
                                  ? "Tap to expand and check off items on the list."
                                  : type.valueType === "timer"
                                    ? "Tap to expand and track time for each subject."
                                    : (type.valueType as string) === "media"
                                      ? "Tap to expand and search for movies or TV series."
                                      : "Tap to expand and add a value."
                } You can create your own activities in Settings → Activity Types.`}
                className='mb-2 bg-white/80 dark:bg-ios-card-dark rounded-xl border border-gray-200/60 dark:border-gray-700/60 overflow-visible'>
                {/* Header — tap to expand/collapse */}
                <div
                  className='flex items-center px-4 py-3 cursor-pointer active:bg-gray-100 dark:active:bg-gray-700'
                  onClick={() => {
                    if (isCheckmark) {
                      handleCheckmarkToggle(type.id, typeSavedValues);
                    } else {
                      setExpandedTypeId(
                        expandedTypeId === type.id ? null : type.id,
                      );
                    }
                  }}>
                  <div className='w-8 h-8 flex items-center justify-center mr-3 shrink-0'>
                    {type.icon &&
                      (type.icon in icons ? (
                        <Icon
                          name={type.icon as IconName}
                          className={cn(
                            "w-6 h-6",
                            hasSavedValues ? "text-ios-green" : "text-ios-blue",
                          )}
                        />
                      ) : (
                        <span className='text-xl'>{type.icon}</span>
                      ))}
                  </div>
                  <span className='text-[17px] font-medium text-gray-900 dark:text-white'>
                    {type.name}
                  </span>
                  <div className='ml-auto flex items-center gap-2'>
                    {displayValue && (
                      <span className='text-[13px] text-gray-400 dark:text-gray-500'>
                        {displayValue}
                      </span>
                    )}
                    {!isCheckmark && (
                      <svg
                        className={cn(
                          "w-4 h-4 text-gray-400 transition-transform",
                          expandedTypeId === type.id && "rotate-180",
                        )}
                        fill='none'
                        viewBox='0 0 24 24'
                        stroke='currentColor'
                        strokeWidth={2}>
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          d='M19 9l-7 7-7-7'
                        />
                      </svg>
                    )}
                  </div>
                </div>

                {/* Expanded content */}
                {expandedTypeId === type.id && !isCheckmark && (
                  <div className='px-4 pb-4'>
                    {hasSavedValues && !isMood && !isWorkout && !isTimer && (
                      <div className='flex flex-wrap gap-2 pb-3'>
                        {typeSavedValues.map((saved) => (
                          <span
                            key={saved.id}
                            className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[15px] bg-ios-blue text-white'>
                            {formatValue(saved.value, type.id)}
                            <button
                              type='button'
                              onClick={(e) => {
                                e.stopPropagation();
                                removeSavedValue(type.id, saved.id);
                              }}
                              className='w-4 h-4 rounded-full bg-white/30 flex items-center justify-center text-xs'>
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    {renderExpandedInput(type)}
                  </div>
                )}
              </div>
            );
          })}

          {/* Standalone Checklist types */}
          {standaloneChecklistTypes.map((type) => {
            const existingEntry = entries.find(
              (e) =>
                e.activityTypeId === type.id &&
                e.date === date &&
                e.checklistData,
            );
            const checklistItems = existingEntry?.checklistData?.items || [];
            const completedCount = checklistItems.filter(
              (item) => item.completed,
            ).length;
            const totalCount = checklistItems.length;

            const standaloneChecklistText = getChecklistText(type.id);
            const handleAddItem = async () => {
              if (!standaloneChecklistText.trim()) return;

              const itemText = standaloneChecklistText.trim();
              // Clear input immediately
              setChecklistText(type.id, "");

              const newItem: ChecklistItem = {
                id: crypto.randomUUID(),
                text: itemText,
                completed: false,
                addedDate: date,
              };

              const updatedItems = [...checklistItems, newItem];
              const checklistData: ChecklistData = { items: updatedItems };

              if (existingEntry) {
                await updateEntry({
                  ...existingEntry,
                  checklistData,
                  value: `${updatedItems.filter((i) => i.completed).length}/${updatedItems.length}`,
                });
              } else {
                await addEntry({
                  date,
                  activityTypeId: type.id,
                  value: `0/${updatedItems.length}`,
                  checklistData,
                });
              }

              // If repeating checklist, update master template
              if (type.checklistRepeat && type.checklistRepeat !== "none") {
                try {
                  let currentTemplate = type.checklistTemplate || [];
                  // Bootstrap template from existing items if empty
                  if (currentTemplate.length === 0) {
                    currentTemplate = checklistItems.map((item) => ({
                      text: item.text,
                      addedDate: item.addedDate || date,
                    }));
                  }
                  if (!currentTemplate.some((t) => t.text === itemText)) {
                    const updatedTemplate = [
                      ...currentTemplate,
                      { text: itemText, addedDate: date },
                    ];
                    await updateActivityType({
                      ...type,
                      checklistTemplate: updatedTemplate,
                    });

                    // Also update tomorrow's existing entry if one was already created
                    const tomorrow = addDays(date, 1);
                    const tomorrowEntry = entries.find(
                      (e) =>
                        e.activityTypeId === type.id &&
                        e.date === tomorrow &&
                        e.checklistData,
                    );
                    if (tomorrowEntry) {
                      const tomorrowTexts = new Set(
                        tomorrowEntry.checklistData?.items?.map(
                          (i) => i.text,
                        ) || [],
                      );
                      if (!tomorrowTexts.has(itemText)) {
                        const tomorrowItems = [
                          ...(tomorrowEntry.checklistData?.items || []),
                          {
                            id: crypto.randomUUID(),
                            text: itemText,
                            completed: false,
                            addedDate: date,
                          },
                        ];
                        await updateEntry({
                          ...tomorrowEntry,
                          checklistData: { items: tomorrowItems },
                          value: `${tomorrowItems.filter((i) => i.completed).length}/${tomorrowItems.length}`,
                        });
                      }
                    }
                  }
                } catch (err) {
                  console.error("Failed to update checklist template:", err);
                }
              }
            };

            const handleToggleItem = async (itemId: string) => {
              if (!existingEntry) return;

              const toggledItem = checklistItems.find((i) => i.id === itemId);
              const willBeCompleted = !toggledItem?.completed;

              const updatedItems = checklistItems.map((item) =>
                item.id === itemId
                  ? { ...item, completed: !item.completed }
                  : item,
              );
              const checklistData: ChecklistData = { items: updatedItems };

              await updateEntry({
                ...existingEntry,
                checklistData,
                value: `${updatedItems.filter((i) => i.completed).length}/${updatedItems.length}`,
              });

              // When completing an item, remove it from all pre-existing future entries
              // to prevent it reappearing on days that were visited before this check.
              if (willBeCompleted && toggledItem) {
                const futureEntries = entries.filter(
                  (e) =>
                    e.activityTypeId === type.id &&
                    e.date > date &&
                    e.checklistData?.items?.some(
                      (i) => i.text === toggledItem.text && !i.completed,
                    ),
                );
                for (const futureEntry of futureEntries) {
                  const updatedFutureItems = (
                    futureEntry.checklistData?.items || []
                  ).filter((i) => i.text !== toggledItem.text);
                  await updateEntry({
                    ...futureEntry,
                    checklistData: { items: updatedFutureItems },
                    value: `${updatedFutureItems.filter((i) => i.completed).length}/${updatedFutureItems.length}`,
                  });
                }
              }
            };

            const handleDeleteItem = async (itemId: string) => {
              if (!existingEntry) return;

              const deletedItem = checklistItems.find(
                (item) => item.id === itemId,
              );
              const updatedItems = checklistItems.filter(
                (item) => item.id !== itemId,
              );

              // For repeating checklists: update master template + tomorrow's entry
              if (
                deletedItem &&
                type.checklistRepeat &&
                type.checklistRepeat !== "none"
              ) {
                if (type.checklistTemplate) {
                  const updatedTemplate = type.checklistTemplate.filter(
                    (t) => t.text !== deletedItem.text,
                  );
                  await updateActivityType({
                    ...type,
                    checklistTemplate: updatedTemplate,
                  });
                }

                // Also remove from tomorrow's existing entry if one was already created
                const tomorrow = addDays(date, 1);
                const tomorrowEntry = entries.find(
                  (e) =>
                    e.activityTypeId === type.id &&
                    e.date === tomorrow &&
                    e.checklistData,
                );
                if (tomorrowEntry) {
                  const tomorrowItems = (
                    tomorrowEntry.checklistData?.items || []
                  ).filter((i) => i.text !== deletedItem.text);
                  if (tomorrowItems.length === 0) {
                    await deleteEntry(tomorrowEntry.id);
                  } else {
                    await updateEntry({
                      ...tomorrowEntry,
                      checklistData: { items: tomorrowItems },
                      value: `${tomorrowItems.filter((i) => i.completed).length}/${tomorrowItems.length}`,
                    });
                  }
                }
              }

              // Update or delete the current entry
              if (updatedItems.length === 0) {
                await deleteEntry(existingEntry.id);
              } else {
                const checklistData: ChecklistData = { items: updatedItems };
                await updateEntry({
                  ...existingEntry,
                  checklistData,
                  value: `${updatedItems.filter((i) => i.completed).length}/${updatedItems.length}`,
                });
              }
            };

            // Don't render if hidden type with no items
            if (type.hidden && totalCount === 0) return null;

            return (
              <div
                key={type.id}
                className='mb-2 bg-white/80 dark:bg-ios-card-dark rounded-xl border border-gray-200/60 dark:border-gray-700/60 overflow-visible'>
                {/* Header — tap to open/close */}
                <div
                  className='flex items-center px-4 py-3 cursor-pointer active:bg-gray-100 dark:active:bg-gray-700'
                  onClick={() =>
                    setOpenChecklists((prev) => {
                      const next = new Set(prev);
                      if (next.has(type.id)) next.delete(type.id);
                      else next.add(type.id);
                      return next;
                    })
                  }>
                  <div className='w-8 h-8 flex items-center justify-center mr-3 shrink-0'>
                    {type.icon &&
                      (type.icon in icons ? (
                        <Icon
                          name={type.icon as IconName}
                          className={cn(
                            "w-6 h-6",
                            completedCount === totalCount && totalCount > 0
                              ? "text-ios-green"
                              : totalCount > 0
                                ? "text-ios-orange"
                                : "text-ios-blue",
                          )}
                        />
                      ) : (
                        <span className='text-xl'>{type.icon}</span>
                      ))}
                  </div>
                  <span className='text-[17px] font-medium text-gray-900 dark:text-white'>
                    {type.name}
                  </span>
                  {type.checklistRepeat && type.checklistRepeat !== "none" && (
                    <span className='ml-1.5 text-[11px] text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-full'>
                      {type.checklistRepeat === "daily"
                        ? "↻ Daily"
                        : type.checklistRepeat === "weekly"
                          ? "↻ Weekly"
                          : "↻ Monthly"}
                    </span>
                  )}
                  <div className='ml-auto flex items-center gap-2'>
                    {totalCount > 0 && (
                      <span className='text-[13px] text-gray-400 dark:text-gray-500'>
                        {completedCount}/{totalCount}
                        {completedCount === totalCount && " ✓"}
                      </span>
                    )}
                  </div>
                </div>

                {/* Today's checklist items — collapsible */}
                {openChecklists.has(type.id) && (
                  <div className='px-4 pb-3'>
                    {checklistItems.length > 0 && (
                      <div className='space-y-1'>
                        {checklistItems.map((item) => (
                          <div
                            key={item.id}
                            className='flex items-center gap-3 py-2 px-1 group'>
                            <button
                              onClick={() => handleToggleItem(item.id)}
                              className={cn(
                                "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                                item.completed
                                  ? "bg-ios-green border-ios-green"
                                  : "border-gray-300 dark:border-gray-600",
                              )}>
                              {item.completed && (
                                <svg
                                  className='w-4 h-4 text-white'
                                  fill='none'
                                  viewBox='0 0 24 24'
                                  stroke='currentColor'
                                  strokeWidth={3}>
                                  <path
                                    strokeLinecap='round'
                                    strokeLinejoin='round'
                                    d='M5 13l4 4L19 7'
                                  />
                                </svg>
                              )}
                            </button>
                            <span
                              className={cn(
                                "flex-1 text-[15px]",
                                item.completed
                                  ? "text-gray-400 dark:text-gray-500 line-through"
                                  : "text-gray-900 dark:text-white",
                              )}>
                              {item.text}
                            </span>
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className='w-6 h-6 rounded-full flex items-center justify-center text-gray-200 dark:text-gray-700 active:text-ios-red transition-colors'>
                              <svg
                                className='w-3 h-3'
                                fill='none'
                                viewBox='0 0 24 24'
                                stroke='currentColor'
                                strokeWidth={1.5}>
                                <path
                                  strokeLinecap='round'
                                  strokeLinejoin='round'
                                  d='M6 18L18 6M6 6l12 12'
                                />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add new item with autocomplete */}
                    <div className='relative mt-2'>
                      <div className='flex items-center gap-2'>
                        <input
                          type='text'
                          value={standaloneChecklistText}
                          onChange={(e) => {
                            setChecklistText(type.id, e.target.value);
                            setShowChecklistDropdown(true);
                            setActiveChecklistTypeId(type.id);
                          }}
                          onFocus={() => {
                            setShowChecklistDropdown(true);
                            setActiveChecklistTypeId(type.id);
                          }}
                          onBlur={() =>
                            setTimeout(
                              () => setShowChecklistDropdown(false),
                              200,
                            )
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddItem();
                              setShowChecklistDropdown(false);
                            }
                            if (e.key === "Escape") {
                              setShowChecklistDropdown(false);
                            }
                          }}
                          placeholder='Add new item...'
                          className='flex-1 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-[15px] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-ios-blue'
                        />
                        <button
                          onClick={() => {
                            handleAddItem();
                            setShowChecklistDropdown(false);
                          }}
                          disabled={!standaloneChecklistText.trim()}
                          className={cn(
                            "px-4 py-2 rounded-lg text-[15px] font-medium transition-colors",
                            standaloneChecklistText.trim()
                              ? "bg-ios-blue text-white"
                              : "bg-gray-200 dark:bg-gray-600 text-gray-400 dark:text-gray-500",
                          )}>
                          Add
                        </button>
                      </div>
                      {/* Autocomplete dropdown */}
                      {showChecklistDropdown &&
                        activeChecklistTypeId === type.id &&
                        (() => {
                          const typeSuggestions =
                            checklistSuggestionsByType[type.id] || [];
                          const filteredSuggestions =
                            standaloneChecklistText.trim()
                              ? typeSuggestions.filter((sugg) =>
                                  sugg.value
                                    .toLowerCase()
                                    .includes(
                                      standaloneChecklistText.toLowerCase(),
                                    ),
                                )
                              : typeSuggestions;
                          const showDropdown =
                            filteredSuggestions.length > 0 &&
                            !filteredSuggestions.some(
                              (s) =>
                                s.value.toLowerCase() ===
                                standaloneChecklistText.toLowerCase().trim(),
                            );
                          if (!showDropdown) return null;
                          return (
                            <div className='absolute left-0 right-12 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-50 max-h-48 overflow-y-auto'>
                              {filteredSuggestions.slice(0, 10).map((sugg) => (
                                <button
                                  key={sugg.value}
                                  onClick={() => {
                                    setChecklistText(type.id, sugg.value);
                                    setShowChecklistDropdown(false);
                                  }}
                                  className='w-full px-3 py-2.5 text-left text-[15px] text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 border-b border-gray-100 dark:border-gray-700 last:border-b-0 flex items-center justify-between'>
                                  <span>{sugg.value}</span>
                                  <span className='text-[13px] text-gray-400 dark:text-gray-500'>
                                    ({sugg.count}×)
                                  </span>
                                </button>
                              ))}
                            </div>
                          );
                        })()}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Coach standalone cards */}
          {standaloneCoachTypes.map((type) => {
            if (!type.coachConfig) return null;
            const existingEntry =
              entries.find(
                (e) => e.activityTypeId === type.id && e.date === date,
              ) ?? null;

            async function handleCoachSave(
              coachData: import("@/types").CoachData,
              value: string,
            ) {
              if (existingEntry) {
                await updateEntry({
                  ...existingEntry,
                  coachData,
                  value: value || existingEntry.value,
                });
              } else {
                await addEntry({
                  date,
                  activityTypeId: type.id,
                  value: value || "In progress",
                  coachData,
                });
              }
            }

            return (
              <div
                key={type.id}
                className='mb-2 bg-white/80 dark:bg-ios-card-dark rounded-xl border border-gray-200/60 dark:border-gray-700/60 overflow-visible'>
                {/* Header */}
                <div
                  className='flex items-center px-4 py-3 cursor-pointer active:bg-gray-100 dark:active:bg-gray-700'
                  onClick={() =>
                    setExpandedTypeId(
                      expandedTypeId === type.id ? null : type.id,
                    )
                  }>
                  <div className='w-8 h-8 flex items-center justify-center mr-3 shrink-0'>
                    {type.icon &&
                      (type.icon in icons ? (
                        <Icon
                          name={type.icon as IconName}
                          className='w-6 h-6 text-ios-blue'
                        />
                      ) : (
                        <span className='text-xl'>{type.icon}</span>
                      ))}
                  </div>
                  <span className='text-[17px] font-medium text-gray-900 dark:text-white'>
                    {type.name}
                  </span>
                  <div className='ml-auto flex items-center gap-2'>
                    {existingEntry?.value && (
                      <span className='text-[13px] text-gray-400 dark:text-gray-500'>
                        {String(existingEntry.value)}
                      </span>
                    )}
                    <svg
                      className={cn(
                        "w-4 h-4 text-gray-400 transition-transform",
                        expandedTypeId === type.id && "rotate-180",
                      )}
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'
                      strokeWidth={2}>
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        d='M19 9l-7 7-7-7'
                      />
                    </svg>
                  </div>
                </div>

                {/* Match panel */}
                {expandedTypeId === type.id && (
                  <div className='px-4 pb-4'>
                    <CoachMatchPanel
                      type={type}
                      entry={existingEntry}
                      onSave={handleCoachSave}
                      onUpdateConfig={async (updatedType) => {
                        await updateActivityType(updatedType);
                      }}
                      disabled={isViewingOther || isDayLocked(date)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* Expanded Content for Icon Grid View - Positioned at top */}
      {viewMode === "icons" &&
        expandedTypeId &&
        (() => {
          // Use allActivityTypes to support hidden activities
          const type = allActivityTypes.find((t) => t.id === expandedTypeId);
          if (!type) return null;

          const typeSavedValues = savedValues[type.id] || [];
          const hasSavedValues = typeSavedValues.length > 0;
          const isMood = type.valueType === "mood";
          const isWorkout = type.valueType === "workout";
          const isCheckmark = type.valueType === "checkmark";
          const isCounter = type.valueType === "counter";
          const isChecklist = type.valueType === "checklist";
          const isTimer = type.valueType === "timer";

          return (
            <div className='mb-4 bg-white dark:bg-ios-card-dark rounded-2xl shadow-lg shadow-black/5 dark:shadow-black/20 overflow-visible relative z-10'>
              {/* Header with close button */}
              <div className='flex items-center justify-between px-4 py-3'>
                <div className='flex items-center gap-3'>
                  {type.icon &&
                    (type.icon in icons ? (
                      <Icon
                        name={type.icon as IconName}
                        className='w-6 h-6 text-ios-blue'
                      />
                    ) : (
                      <span className='text-[24px]'>{type.icon}</span>
                    ))}
                  <span className='text-[17px] font-semibold text-gray-900 dark:text-white'>
                    {type.name}
                  </span>
                </div>
                <button
                  data-info='Close. Collapse this activity panel.'
                  onClick={() => setExpandedTypeId(null)}
                  className='w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400'>
                  <svg
                    className='w-5 h-5'
                    fill='none'
                    viewBox='0 0 24 24'
                    stroke='currentColor'
                    strokeWidth={2}>
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      d='M6 18L18 6M6 6l12 12'
                    />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className='px-4 pb-4'>
                {/* Saved values with delete option - not for mood, workout, checkmark, counter, checklist, or timer type */}
                {hasSavedValues &&
                  !isMood &&
                  !isWorkout &&
                  !isCheckmark &&
                  !isCounter &&
                  !isChecklist &&
                  !isTimer && (
                    <div className='flex flex-wrap gap-2 pt-1 pb-3'>
                      {typeSavedValues.map((saved) => (
                        <span
                          key={saved.id}
                          className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[15px] bg-ios-blue text-white'>
                          {formatValue(saved.value, type.id)}
                          <button
                            type='button'
                            onClick={(e) => {
                              e.stopPropagation();
                              removeSavedValue(type.id, saved.id);
                            }}
                            className='w-4 h-4 rounded-full bg-white/30 flex items-center justify-center text-xs'>
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                {renderExpandedInput(type)}
              </div>
            </div>
          );
        })()}

      {/* Icon Grid View */}
      {viewMode === "icons" && (
        <div className='grid grid-cols-4 gap-3.5'>
          {/* News icon tile */}
          {newsIcon?.visible && (
            <button
              onClick={newsIcon.onClick}
              className='aspect-square rounded-xl flex flex-col items-center justify-center gap-1 transition-all active:scale-95 p-1.5 overflow-hidden relative bg-gray-100/90 dark:bg-gray-800/90'>
              <div className='relative w-8 h-8 rounded-lg bg-ios-orange flex items-center justify-center'>
                <svg
                  className='w-5 h-5 text-white'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'
                  strokeWidth={2}>
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    d='M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z'
                  />
                </svg>
                {newsIcon.hasUnread && (
                  <span className='absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-ios-red ring-2 ring-gray-100 dark:ring-gray-800' />
                )}
              </div>
              <span className='text-[9px] text-gray-900 dark:text-white text-center w-full px-0.5 line-clamp-2 leading-tight'>
                News
              </span>
            </button>
          )}

          {/* Standalone types first, then grouped types */}
          {[
            ...standaloneTypes,
            ...allActivityTypes.filter((t) => !t.standalone),
          ]
            .filter((type) => {
              // Show if currently expanded (user is adding data)
              if (expandedTypeId === type.id) return true;
              // When day is locked: only show activities that have data
              if (isLocked) {
                const typeSavedValues = savedValues[type.id] || [];
                return typeSavedValues.length > 0;
              }
              // Show if not globally hidden
              if (!type.hidden) return true;
              // Show hidden activities if they have data for this day
              const typeSavedValues = savedValues[type.id] || [];
              return typeSavedValues.length > 0;
            })
            .map((type) => {
              const typeSavedValues = savedValues[type.id] || [];
              const hasSavedValues = typeSavedValues.length > 0;
              const isCheckmark = type.valueType === "checkmark";
              const isWorkout = type.valueType === "workout";
              const isNutrition = type.valueType === "nutrition";
              const isMood = type.valueType === "mood";
              const isCounter = type.valueType === "counter";
              const isChecklist = type.valueType === "checklist";
              const isTimer = type.valueType === "timer";

              // Check if workout has any data being entered
              const workoutHasEnteredData =
                isWorkout &&
                Object.keys(workoutData).some((exerciseName) => {
                  const sets = workoutData[exerciseName] || [];
                  return sets.some(
                    (set) =>
                      set.reps || set.weight || set.distance || set.duration,
                  );
                });

              // Check checklist completion
              const checklistEntry = isChecklist
                ? entries.find(
                    (e) =>
                      e.activityTypeId === type.id &&
                      e.date === date &&
                      e.checklistData,
                  )
                : null;
              const checklistItems = checklistEntry?.checklistData?.items || [];
              const checklistCompleted =
                checklistItems.length > 0 &&
                checklistItems.every((i) => i.completed);
              const checklistHasItems = checklistItems.length > 0;

              // Calculate nutrition goal progress (use merged types if configured)
              const nutritionGoalProgress = (() => {
                if (!isNutrition || !type.nutritionGoal)
                  return {
                    hasGoals: false,
                    allGoalsReached: false,
                    hasData: false,
                    percentage: 0,
                    ownPercentage: 0,
                    combinedPercentage: 0,
                    isMerged: false,
                  };

                // Always use merged data - it handles both merged and non-merged cases
                const merged = getMergedNutritionData(type.id);
                const { totals, goals, isMerged } = merged;

                // Calculate this activity's own percentage (can exceed 100%)
                const ownTotals = getNutritionTotals(type.id);
                const ownGoal = type.nutritionGoal;
                let ownGoalsSet = 0;
                let ownTotalPercentage = 0;
                if (ownGoal.protein) {
                  ownGoalsSet++;
                  ownTotalPercentage +=
                    (ownTotals.protein / ownGoal.protein) * 100;
                }
                if (ownGoal.calories) {
                  ownGoalsSet++;
                  ownTotalPercentage +=
                    (ownTotals.calories / ownGoal.calories) * 100;
                }
                if (ownGoal.carbs) {
                  ownGoalsSet++;
                  ownTotalPercentage += (ownTotals.carbs / ownGoal.carbs) * 100;
                }
                if (ownGoal.fat) {
                  ownGoalsSet++;
                  ownTotalPercentage += (ownTotals.fat / ownGoal.fat) * 100;
                }
                const ownPercentage =
                  ownGoalsSet > 0
                    ? Math.round(ownTotalPercentage / ownGoalsSet)
                    : 0;

                // Calculate combined percentage (capped at 100%)
                let goalsSet = 0;
                let totalPercentage = 0;
                let goalsReached = 0;
                if (goals.protein) {
                  goalsSet++;
                  totalPercentage += Math.min(
                    100,
                    (totals.protein / goals.protein) * 100,
                  );
                  if (totals.protein >= goals.protein) goalsReached++;
                }
                if (goals.calories) {
                  goalsSet++;
                  totalPercentage += Math.min(
                    100,
                    (totals.calories / goals.calories) * 100,
                  );
                  if (totals.calories >= goals.calories) goalsReached++;
                }
                if (goals.carbs) {
                  goalsSet++;
                  totalPercentage += Math.min(
                    100,
                    (totals.carbs / goals.carbs) * 100,
                  );
                  if (totals.carbs >= goals.carbs) goalsReached++;
                }
                if (goals.fat) {
                  goalsSet++;
                  totalPercentage += Math.min(
                    100,
                    (totals.fat / goals.fat) * 100,
                  );
                  if (totals.fat >= goals.fat) goalsReached++;
                }
                const combinedPercentage =
                  goalsSet > 0 ? Math.round(totalPercentage / goalsSet) : 0;

                return {
                  hasGoals: ownGoalsSet > 0,
                  allGoalsReached: goalsReached === goalsSet && goalsSet > 0,
                  hasData: merged.hasData,
                  percentage: ownPercentage, // Use own percentage as main display
                  ownPercentage,
                  combinedPercentage,
                  isMerged,
                };
              })();

              const hasValue =
                hasSavedValues || workoutHasEnteredData || checklistHasItems;
              const isSkipped =
                isCheckmark && typeSavedValues[0]?.value === "skipped";
              const isChecked = isCheckmark && hasSavedValues && !isSkipped;

              // Get display text for the icon
              const getIconDisplayText = () => {
                if (isChecklist && checklistHasItems) {
                  const completed = checklistItems.filter(
                    (i) => i.completed,
                  ).length;
                  return `${completed}/${checklistItems.length}`;
                }
                if (!hasValue || isSkipped) return null;
                if (isCheckmark) return null; // Just show green icon
                if (isMood && hasSavedValues) {
                  const val = typeSavedValues[0].value;
                  if (val === "happy") return "☺";
                  if (val === "neutral") return "—";
                  if (val === "sad") return "☹";
                }
                if (isCounter && hasSavedValues) {
                  return String(typeSavedValues[0].value);
                }
                if (isWorkout) {
                  // Count exercises
                  let count = 0;
                  if (hasSavedValues) {
                    typeSavedValues.forEach((saved) => {
                      const entry = entries.find((e) => e.id === saved.id);
                      if (entry?.workoutData?.exercises) {
                        count += entry.workoutData.exercises.length;
                      }
                    });
                  } else if (workoutHasEnteredData) {
                    count = Object.keys(workoutData).filter((name) => {
                      const sets = workoutData[name] || [];
                      return sets.some(
                        (s) => s.reps || s.weight || s.distance || s.duration,
                      );
                    }).length;
                  }
                  // Show count if exercises logged, or nothing if just quick-check (icon will show green)
                  return count > 0 ? `${count}` : null;
                }
                // For timer types, don't show text - colored circles are rendered separately
                if (isTimer && type.timerConfig?.subjects) {
                  return null;
                }
                // For nutrition types with goals, show percentage progress (use combined if merge is enabled)
                if (
                  isNutrition &&
                  type.nutritionGoal &&
                  nutritionGoalProgress.hasGoals &&
                  nutritionGoalProgress.hasData
                ) {
                  if (nutritionGoalProgress.isMerged) {
                    return `${nutritionGoalProgress.ownPercentage}% (${nutritionGoalProgress.combinedPercentage}%)`;
                  }
                  return `${nutritionGoalProgress.percentage}%`;
                }
                // For nutrition without goals and text types, show the activity type name
                if (hasSavedValues) {
                  return type.name;
                }
                return null;
              };

              const displayText = getIconDisplayText();

              // Check if workout has a quick-check (value === true, no exercises)
              const hasWorkoutQuickCheck =
                isWorkout &&
                typeSavedValues.some((saved) => {
                  const entry = entries.find((e) => e.id === saved.id);
                  return (
                    saved.value === true &&
                    !entry?.workoutData?.exercises?.length
                  );
                });

              return (
                <button
                  key={type.id}
                  data-info={`${type.name} (${type.valueType}). ${isCheckmark ? "Tap to mark as done." : isWorkout ? "Tap to log a workout." : "Tap to expand and add a value."} You can create your own activities in Settings → Activity Types.`}
                  onClick={() => {
                    if (isCheckmark) {
                      // For checkmark types, toggle directly without expanding
                      handleCheckmarkToggle(type.id, typeSavedValues);
                    } else if (isWorkout) {
                      // For workout types, use double-click for quick-check
                      handleWorkoutQuickCheck(type.id, typeSavedValues);
                    } else {
                      // For other types, toggle expansion
                      setExpandedTypeId(
                        expandedTypeId === type.id ? null : type.id,
                      );
                    }
                  }}
                  className={cn(
                    "aspect-square rounded-xl flex flex-col items-center justify-center gap-1 transition-all active:scale-95 p-1.5 overflow-hidden relative",
                    isSkipped
                      ? "bg-gradient-to-br from-red-400/40 via-rose-500/30 to-pink-400/40 dark:from-red-500/50 dark:via-rose-600/40 dark:to-pink-500/50 ring-2 ring-ios-red/50"
                      : "bg-gray-100/90 dark:bg-gray-800/90",
                  )}>
                  {/* Checkmark indicator for checkmark and workout activity types */}
                  {(isCheckmark || isWorkout) && (
                    <div className='absolute top-1 right-1'>
                      <svg
                        className={cn(
                          "w-2.5 h-2.5",
                          (hasValue && !isSkipped) || hasWorkoutQuickCheck
                            ? "text-ios-green"
                            : "text-gray-300 dark:text-gray-600",
                        )}
                        viewBox='0 0 24 24'
                        fill='none'
                        stroke='currentColor'
                        strokeWidth='3'
                        strokeLinecap='round'
                        strokeLinejoin='round'>
                        <polyline points='20 6 9 17 4 12' />
                      </svg>
                    </div>
                  )}
                  <div
                    className={cn(
                      "w-8 h-8 flex items-center justify-center shrink-0",
                      isChecklist
                        ? checklistCompleted
                          ? "text-green-600 dark:text-green-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.15)]"
                          : checklistHasItems
                            ? "text-ios-orange drop-shadow-[0_1px_2px_rgba(0,0,0,0.15)]"
                            : "text-ios-blue"
                        : isNutrition && nutritionGoalProgress.hasGoals
                          ? nutritionGoalProgress.allGoalsReached
                            ? "text-green-600 dark:text-green-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.15)]"
                            : nutritionGoalProgress.hasData
                              ? "text-ios-orange drop-shadow-[0_1px_2px_rgba(0,0,0,0.15)]"
                              : "text-ios-blue"
                          : hasValue && !isSkipped
                            ? "text-green-600 dark:text-green-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.15)]"
                            : isSkipped
                              ? "text-ios-red"
                              : "text-ios-blue",
                    )}>
                    {type.icon in icons ? (
                      <Icon name={type.icon as IconName} className='w-7 h-7' />
                    ) : (
                      <span className='text-2xl'>{type.icon}</span>
                    )}
                  </div>
                  <span className='text-[9px] text-gray-900 dark:text-white text-center w-full px-0.5 line-clamp-2 leading-tight'>
                    {isChecklist && displayText
                      ? displayText
                      : isNutrition && type.nutritionGoal && displayText
                        ? displayText
                        : type.name}
                  </span>
                  {/* Timer status circles */}
                  {isTimer &&
                    type.timerConfig?.subjects &&
                    type.timerConfig.subjects.some(
                      (s) =>
                        (s.limitMinutes ||
                          type.timerConfig!.limitMinutes ||
                          0) > 0,
                    ) && (
                      <div className='flex items-center gap-1'>
                        {type.timerConfig.subjects.map((s) => {
                          const limit =
                            s.limitMinutes ||
                            type.timerConfig!.limitMinutes ||
                            0;
                          const status = getTimerSubjectStatus(
                            s.id,
                            limit,
                            type.timerConfig!.limitPeriod || "daily",
                            date,
                            entries,
                            type.id,
                          );
                          const bgColor =
                            limit <= 0
                              ? "bg-gray-300 dark:bg-gray-600"
                              : status.color === "red"
                                ? "bg-red-500"
                                : status.color === "yellow"
                                  ? "bg-yellow-500"
                                  : "bg-green-500";
                          return (
                            <div
                              key={s.id}
                              className={cn("w-2 h-2 rounded-full", bgColor)}
                            />
                          );
                        })}
                      </div>
                    )}
                  {isSkipped && (
                    <div className='w-1.5 h-1.5 rounded-full bg-ios-red' />
                  )}
                </button>
              );
            })}

          {/* Add Hidden Activity Button - Icon Grid Version */}
          {!isViewingOther && allActivityTypes.some((t) => t.hidden) && (
            <button
              data-info='Add activity. Show a hidden activity for today.'
              onClick={() => setShowAddHiddenModal(true)}
              className={cn(
                "aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 p-1",
                "bg-gray-100/50 dark:bg-gray-800/30 border-2 border-dashed border-gray-300 dark:border-gray-600",
              )}>
              <div className='w-8 h-8 rounded-lg flex items-center justify-center'>
                <svg
                  className='w-5 h-5 text-gray-400'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'
                  strokeWidth={2}>
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    d='M12 4v16m8-8H4'
                  />
                </svg>
              </div>
              <span className='text-[9px] text-gray-400 font-medium leading-tight text-center px-0.5 line-clamp-2'>
                Add
              </span>
            </button>
          )}
        </div>
      )}

      {/* List View */}
      {viewMode === "list" && (
        <div className='mt-8 bg-white/80 dark:bg-ios-card-dark rounded-xl overflow-visible'>
          {allActivityTypes
            .filter((type) => {
              // Standalone types are shown in the standalone section above
              if (type.standalone) return false;
              // Show if currently expanded (user is adding data)
              if (expandedTypeId === type.id) return true;
              // When day is locked: only show activities that have data
              if (isLocked) {
                const typeSavedValues = savedValues[type.id] || [];
                return typeSavedValues.length > 0;
              }
              // Show if not globally hidden
              if (!type.hidden) return true;
              // Show hidden activities if they have data for this day
              const typeSavedValues = savedValues[type.id] || [];
              return typeSavedValues.length > 0;
            })
            .map((type, index, filteredTypes) => {
              const typeSavedValues = savedValues[type.id] || [];
              const hasSavedValues = typeSavedValues.length > 0;
              const isExpanded = expandedTypeId === type.id;
              const isLast = index === filteredTypes.length - 1;
              const isCheckmark = type.valueType === "checkmark";
              const isCounter = type.valueType === "counter";
              const isMood = type.valueType === "mood";
              const isNutrition = type.valueType === "nutrition";
              const isWorkout = type.valueType === "workout";
              const isChecklist = type.valueType === "checklist";
              const isTimer = type.valueType === "timer";

              // Check if workout has any data being entered (not yet saved)
              const workoutHasEnteredData =
                isWorkout &&
                Object.keys(workoutData).some((exerciseName) => {
                  const sets = workoutData[exerciseName] || [];
                  return sets.some(
                    (set) =>
                      set.reps || set.weight || set.distance || set.duration,
                  );
                });

              // Check checklist items
              const checklistEntry = isChecklist
                ? entries.find(
                    (e) =>
                      e.activityTypeId === type.id &&
                      e.date === date &&
                      e.checklistData,
                  )
                : null;
              const checklistItems = checklistEntry?.checklistData?.items || [];
              const checklistCompleted =
                checklistItems.length > 0 &&
                checklistItems.every((i) => i.completed);
              const checklistHasItems = checklistItems.length > 0;

              // Count exercises with entered data
              const workoutEnteredExerciseCount = isWorkout
                ? Object.keys(workoutData).filter((exerciseName) => {
                    const sets = workoutData[exerciseName] || [];
                    return sets.some(
                      (set) =>
                        set.reps || set.weight || set.distance || set.duration,
                    );
                  }).length
                : 0;

              // Calculate nutrition goal progress for list view (use merged types if configured)
              const nutritionGoalProgress = (() => {
                if (!isNutrition || !type.nutritionGoal)
                  return {
                    hasGoals: false,
                    allGoalsReached: false,
                    hasData: false,
                    percentage: 0,
                    ownPercentage: 0,
                    combinedPercentage: 0,
                    isMerged: false,
                  };

                // Always use merged data - it handles both merged and non-merged cases
                const merged = getMergedNutritionData(type.id);
                const { totals, goals, isMerged } = merged;

                // Calculate this activity's own percentage (can exceed 100%)
                const ownTotals = getNutritionTotals(type.id);
                const ownGoal = type.nutritionGoal;
                let ownGoalsSet = 0;
                let ownTotalPercentage = 0;
                if (ownGoal.protein) {
                  ownGoalsSet++;
                  ownTotalPercentage +=
                    (ownTotals.protein / ownGoal.protein) * 100;
                }
                if (ownGoal.calories) {
                  ownGoalsSet++;
                  ownTotalPercentage +=
                    (ownTotals.calories / ownGoal.calories) * 100;
                }
                if (ownGoal.carbs) {
                  ownGoalsSet++;
                  ownTotalPercentage += (ownTotals.carbs / ownGoal.carbs) * 100;
                }
                if (ownGoal.fat) {
                  ownGoalsSet++;
                  ownTotalPercentage += (ownTotals.fat / ownGoal.fat) * 100;
                }
                const ownPercentage =
                  ownGoalsSet > 0
                    ? Math.round(ownTotalPercentage / ownGoalsSet)
                    : 0;

                // Calculate combined percentage (capped at 100%)
                let goalsSet = 0;
                let totalPercentage = 0;
                let goalsReached = 0;
                if (goals.protein) {
                  goalsSet++;
                  totalPercentage += Math.min(
                    100,
                    (totals.protein / goals.protein) * 100,
                  );
                  if (totals.protein >= goals.protein) goalsReached++;
                }
                if (goals.calories) {
                  goalsSet++;
                  totalPercentage += Math.min(
                    100,
                    (totals.calories / goals.calories) * 100,
                  );
                  if (totals.calories >= goals.calories) goalsReached++;
                }
                if (goals.carbs) {
                  goalsSet++;
                  totalPercentage += Math.min(
                    100,
                    (totals.carbs / goals.carbs) * 100,
                  );
                  if (totals.carbs >= goals.carbs) goalsReached++;
                }
                if (goals.fat) {
                  goalsSet++;
                  totalPercentage += Math.min(
                    100,
                    (totals.fat / goals.fat) * 100,
                  );
                  if (totals.fat >= goals.fat) goalsReached++;
                }
                const combinedPercentage =
                  goalsSet > 0 ? Math.round(totalPercentage / goalsSet) : 0;

                return {
                  hasGoals: ownGoalsSet > 0,
                  allGoalsReached: goalsReached === goalsSet && goalsSet > 0,
                  hasData: merged.hasData,
                  percentage: ownPercentage,
                  ownPercentage,
                  combinedPercentage,
                  isMerged,
                };
              })();

              // Get current counter value
              const currentCounterValue =
                isCounter && hasSavedValues
                  ? typeof typeSavedValues[0].value === "number"
                    ? typeSavedValues[0].value
                    : 0
                  : 0;

              const handleCounterChange = (delta: number) => {
                const newValue = Math.max(0, currentCounterValue + delta);
                if (newValue === 0 && hasSavedValues) {
                  // Remove entry when counter reaches 0
                  deleteEntry(typeSavedValues[0].id);
                } else if (newValue > 0) {
                  handleSaveValue(type.id, newValue);
                }
              };

              const handleRowClick = () => {
                if (isCheckmark) {
                  const now = Date.now();
                  const lastClick = lastClickTime[type.id] || 0;
                  const isDoubleClick = now - lastClick < 400; // 400ms for double-click
                  setLastClickTime({ ...lastClickTime, [type.id]: now });

                  if (isDoubleClick) {
                    // Double-click: set to "skipped" (red X)
                    if (hasSavedValues) {
                      // Delete existing and add skipped
                      typeSavedValues.forEach((saved) => {
                        deleteEntry(saved.id);
                      });
                    }
                    handleSaveValue(type.id, "skipped");
                  } else {
                    // Single click: toggle between checked and unchecked
                    if (hasSavedValues) {
                      const currentValue = typeSavedValues[0]?.value;
                      if (currentValue === "skipped") {
                        // If skipped, remove it
                        typeSavedValues.forEach((saved) => {
                          deleteEntry(saved.id);
                        });
                      } else {
                        // If checked, remove the checkmark
                        typeSavedValues.forEach((saved) => {
                          deleteEntry(saved.id);
                        });
                      }
                    } else {
                      // Add the checkmark
                      handleSaveValue(type.id, true);
                    }
                  }
                } else if (isCounter) {
                  // For counter, tapping row resets to 0 if not already 0
                  if (currentCounterValue > 0 && hasSavedValues) {
                    deleteEntry(typeSavedValues[0].id);
                  }
                  // If already 0, do nothing
                } else {
                  toggleExpanded(type.id);
                }
              };

              return (
                <div key={type.id}>
                  {/* Activity row */}
                  <div
                    data-info={`${type.name} (${type.valueType}). ${
                      isCheckmark
                        ? "Tap to mark as done for today."
                        : type.valueType === "text"
                          ? "Tap to expand and type a value."
                          : type.valueType === "counter"
                            ? "Use + and − on the right to count."
                            : type.valueType === "mood"
                              ? "Tap to expand and select your mood."
                              : type.valueType === "boolean"
                                ? "Tap to expand and choose Yes or No."
                                : type.valueType === "nutrition"
                                  ? "Tap to expand and log food with calories, protein, carbs, fat."
                                  : type.valueType === "workout"
                                    ? "Tap to log a workout with exercises, sets, and reps."
                                    : type.valueType === "checklist"
                                      ? "Tap to expand and check off items."
                                      : type.valueType === "timer"
                                        ? "Tap to expand and track time for each subject."
                                        : (type.valueType as string) === "media"
                                          ? "Tap to expand and search for movies or TV series."
                                          : "Tap to expand and add a value."
                    } You can create your own activities in Settings → Activity Types.`}
                    className={cn(
                      "flex items-center min-h-[52px] px-4 active:bg-gray-100 dark:active:bg-gray-700 cursor-pointer",
                      isExpanded && "bg-gray-50 dark:bg-gray-800",
                      !isLast &&
                        !isExpanded &&
                        "border-b border-gray-200/80 dark:border-gray-700/80",
                    )}
                    onClick={handleRowClick}>
                    {/* Icon */}
                    {type.icon && (
                      <div className='w-8 h-8 flex items-center justify-center mr-3 shrink-0'>
                        {type.icon in icons ? (
                          <Icon
                            name={type.icon as IconName}
                            className={cn(
                              "w-6 h-6",
                              isChecklist
                                ? checklistCompleted
                                  ? "text-ios-green"
                                  : checklistHasItems
                                    ? "text-ios-orange"
                                    : "text-ios-blue"
                                : isNutrition && nutritionGoalProgress.hasGoals
                                  ? nutritionGoalProgress.allGoalsReached
                                    ? "text-ios-green"
                                    : nutritionGoalProgress.hasData
                                      ? "text-ios-orange"
                                      : "text-ios-blue"
                                  : hasSavedValues || workoutHasEnteredData
                                    ? "text-ios-green"
                                    : "text-ios-blue",
                            )}
                          />
                        ) : (
                          <span className='text-xl'>{type.icon}</span>
                        )}
                      </div>
                    )}

                    {/* Content and right-aligned controls */}
                    <div className='flex-1 py-2 flex items-center min-w-0 overflow-hidden gap-2'>
                      {/* Main label */}
                      <span className='text-[17px] font-medium text-gray-900 dark:text-white shrink-0'>
                        {type.name}
                      </span>

                      {/* Right-aligned values for all types */}
                      <div className='flex items-center gap-2 ml-auto shrink-0'>
                        {/* Text type values - right aligned */}
                        {hasSavedValues &&
                          !isExpanded &&
                          type.valueType === "text" && (
                            <span className='text-[15px] text-gray-500 dark:text-gray-400 truncate max-w-[180px]'>
                              {typeSavedValues.map((saved, i) => (
                                <span key={saved.id}>
                                  {formatValue(saved.value, type.id)}
                                  {i < typeSavedValues.length - 1 && ", "}
                                </span>
                              ))}
                            </span>
                          )}
                        {/* Checklist - show progress */}
                        {isChecklist && checklistHasItems && (
                          <span
                            className={cn(
                              "text-[15px] shrink-0",
                              checklistCompleted
                                ? "text-ios-green"
                                : "text-gray-500 dark:text-gray-400",
                            )}>
                            {checklistItems.filter((i) => i.completed).length}/
                            {checklistItems.length}
                          </span>
                        )}
                        {/* Workout - show green checkmark if has workout */}
                        {isWorkout &&
                          (() => {
                            // Check if there are any saved workout entries
                            let hasWorkout = false;
                            typeSavedValues.forEach((saved) => {
                              const entry = entries.find(
                                (e) => e.id === saved.id,
                              );
                              if (
                                entry?.workoutData?.exercises?.length ||
                                saved.value === true
                              ) {
                                hasWorkout = true;
                              }
                            });

                            if (!hasWorkout && !workoutHasEnteredData) {
                              return null;
                            }

                            // Has workout - show green checkmark
                            return (
                              <svg
                                className='w-5 h-5 text-ios-green shrink-0'
                                fill='none'
                                stroke='currentColor'
                                viewBox='0 0 24 24'
                                strokeWidth={3}>
                                <path
                                  strokeLinecap='round'
                                  strokeLinejoin='round'
                                  d='M5 13l4 4L19 7'
                                />
                              </svg>
                            );
                          })()}
                        {/* Nutrition progress summary */}
                        {isNutrition &&
                          (() => {
                            const hasEntries = hasSavedValues;

                            if (!nutritionGoalProgress.hasGoals && !hasEntries)
                              return null;

                            return (
                              <span
                                className={cn(
                                  "text-[15px] truncate max-w-[180px]",
                                  nutritionGoalProgress.hasGoals
                                    ? nutritionGoalProgress.allGoalsReached
                                      ? "text-ios-green"
                                      : "text-gray-500 dark:text-gray-400"
                                    : "text-gray-500 dark:text-gray-400",
                                )}>
                                {nutritionGoalProgress.hasGoals &&
                                nutritionGoalProgress.hasData ? (
                                  <>
                                    {nutritionGoalProgress.isMerged
                                      ? `${nutritionGoalProgress.ownPercentage}% (${nutritionGoalProgress.combinedPercentage}%)`
                                      : `${nutritionGoalProgress.percentage}%`}
                                  </>
                                ) : hasEntries ? (
                                  // Show food names instead of "x items"
                                  <>
                                    {typeSavedValues
                                      .map((saved) => {
                                        const entry = entries.find(
                                          (e) => e.id === saved.id,
                                        );
                                        return (
                                          entry?.nutritionData?.foodName ||
                                          String(saved.value)
                                        );
                                      })
                                      .join(", ")}
                                  </>
                                ) : null}
                              </span>
                            );
                          })()}
                        {/* Checkmark icon */}
                        {isCheckmark && hasSavedValues && (
                          <>
                            {typeSavedValues[0]?.value === "skipped" ? (
                              <svg
                                className='w-5 h-5 text-ios-red shrink-0'
                                fill='none'
                                stroke='currentColor'
                                viewBox='0 0 24 24'
                                strokeWidth={3}>
                                <path
                                  strokeLinecap='round'
                                  strokeLinejoin='round'
                                  d='M6 18L18 6M6 6l12 12'
                                />
                              </svg>
                            ) : (
                              <svg
                                className='w-5 h-5 text-ios-green shrink-0'
                                fill='none'
                                stroke='currentColor'
                                viewBox='0 0 24 24'
                                strokeWidth={3}>
                                <path
                                  strokeLinecap='round'
                                  strokeLinejoin='round'
                                  d='M5 13l4 4L19 7'
                                />
                              </svg>
                            )}
                          </>
                        )}
                        {/* Mood icon display */}
                        {isMood && hasSavedValues && (
                          <span className='shrink-0'>
                            {typeSavedValues[0].value === "happy" && (
                              <svg
                                className='w-5 h-5 text-ios-green'
                                viewBox='0 0 24 24'
                                fill='none'
                                stroke='currentColor'
                                strokeWidth='2'
                                strokeLinecap='round'
                                strokeLinejoin='round'>
                                <circle cx='12' cy='12' r='10' />
                                <path d='M8 14s1.5 2 4 2 4-2 4-2' />
                                <line
                                  x1='9'
                                  y1='9'
                                  x2='9.01'
                                  y2='9'
                                  strokeWidth='3'
                                />
                                <line
                                  x1='15'
                                  y1='9'
                                  x2='15.01'
                                  y2='9'
                                  strokeWidth='3'
                                />
                              </svg>
                            )}
                            {typeSavedValues[0].value === "neutral" && (
                              <svg
                                className='w-5 h-5 text-ios-orange'
                                viewBox='0 0 24 24'
                                fill='none'
                                stroke='currentColor'
                                strokeWidth='2'
                                strokeLinecap='round'
                                strokeLinejoin='round'>
                                <circle cx='12' cy='12' r='10' />
                                <line x1='8' y1='15' x2='16' y2='15' />
                                <line
                                  x1='9'
                                  y1='9'
                                  x2='9.01'
                                  y2='9'
                                  strokeWidth='3'
                                />
                                <line
                                  x1='15'
                                  y1='9'
                                  x2='15.01'
                                  y2='9'
                                  strokeWidth='3'
                                />
                              </svg>
                            )}
                            {typeSavedValues[0].value === "sad" && (
                              <svg
                                className='w-5 h-5 text-ios-red'
                                viewBox='0 0 24 24'
                                fill='none'
                                stroke='currentColor'
                                strokeWidth='2'
                                strokeLinecap='round'
                                strokeLinejoin='round'>
                                <circle cx='12' cy='12' r='10' />
                                <path d='M16 16s-1.5-2-4-2-4 2-4 2' />
                                <line
                                  x1='9'
                                  y1='9'
                                  x2='9.01'
                                  y2='9'
                                  strokeWidth='3'
                                />
                                <line
                                  x1='15'
                                  y1='9'
                                  x2='15.01'
                                  y2='9'
                                  strokeWidth='3'
                                />
                              </svg>
                            )}
                          </span>
                        )}
                        {/* Counter controls */}
                        {isCounter && (
                          <div
                            className='flex items-center gap-x-2'
                            data-info='Counter. Use − and + to adjust the count.'
                            onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCounterChange(-1);
                              }}
                              disabled={currentCounterValue === 0}
                              className={cn(
                                "w-7 h-7 rounded-full flex items-center justify-center text-[18px] font-medium border border-gray-200 dark:border-gray-600",
                                "bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 shadow-none",
                                "active:bg-gray-100 dark:active:bg-gray-700 active:scale-95 transition-transform",
                                currentCounterValue === 0 && "opacity-30",
                              )}>
                              −
                            </button>
                            <span
                              className={cn(
                                "w-7 text-center text-[17px] font-semibold tabular-nums",
                                currentCounterValue > 0
                                  ? "text-ios-green"
                                  : "text-gray-400 dark:text-gray-500",
                              )}>
                              {currentCounterValue}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCounterChange(1);
                              }}
                              className={cn(
                                "w-7 h-7 rounded-full flex items-center justify-center text-[18px] font-medium border border-ios-blue/20",
                                "bg-ios-blue/5 text-ios-blue shadow-none",
                                "active:bg-ios-blue/10 active:scale-95 transition-transform",
                              )}>
                              +
                            </button>
                          </div>
                        )}
                        {/* Timer - show colored status circles */}
                        {isTimer &&
                          type.timerConfig?.subjects &&
                          type.timerConfig.subjects.some(
                            (s) =>
                              (s.limitMinutes ||
                                type.timerConfig!.limitMinutes ||
                                0) > 0,
                          ) && (
                            <div className='flex items-center gap-1.5 shrink-0'>
                              {type.timerConfig.subjects.map((s) => {
                                const limit =
                                  s.limitMinutes ||
                                  type.timerConfig!.limitMinutes ||
                                  0;
                                const status = getTimerSubjectStatus(
                                  s.id,
                                  limit,
                                  type.timerConfig!.limitPeriod || "daily",
                                  date,
                                  entries,
                                  type.id,
                                );
                                const bgColor =
                                  limit <= 0
                                    ? "bg-gray-300 dark:bg-gray-600"
                                    : status.color === "red"
                                      ? "bg-red-500"
                                      : status.color === "yellow"
                                        ? "bg-yellow-500"
                                        : "bg-green-500";
                                return (
                                  <div
                                    key={s.id}
                                    className={cn(
                                      "w-2.5 h-2.5 rounded-full",
                                      bgColor,
                                    )}
                                  />
                                );
                              })}
                            </div>
                          )}
                        {/* Boolean value display (show check or x if saved) */}
                        {type.valueType === "boolean" && hasSavedValues && (
                          <span
                            className={cn(
                              "w-5 h-5 flex items-center justify-center text-[17px] font-bold",
                              typeSavedValues[0].value
                                ? "text-ios-green"
                                : "text-ios-red",
                            )}>
                            {typeSavedValues[0].value ? "✓" : "✗"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded content - not for checkmark or counter types */}
                  {isExpanded && !isCheckmark && !isCounter && (
                    <div
                      className={cn(
                        "px-4 pb-4 pt-2 bg-gray-50 dark:bg-gray-800/50",
                        !isLast &&
                          "border-b border-gray-200/80 dark:border-gray-700/80",
                      )}>
                      {/* Saved values with delete option - not for mood, workout, checklist, or timer type */}
                      {hasSavedValues &&
                        !isMood &&
                        !isWorkout &&
                        !isChecklist &&
                        !isTimer && (
                          <div className='flex flex-wrap gap-2 pt-1 pb-3'>
                            {typeSavedValues.map((saved) => (
                              <span
                                key={saved.id}
                                className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[15px] bg-ios-blue text-white'>
                                {formatValue(saved.value, type.id)}
                                <button
                                  type='button'
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeSavedValue(type.id, saved.id);
                                  }}
                                  className='w-4 h-4 rounded-full bg-white/30 flex items-center justify-center text-xs'>
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}

                      {renderExpandedInput(type)}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {/* Add Hidden Activity Button - List View Version */}
      {!isViewingOther &&
        viewMode === "list" &&
        allActivityTypes.some((t) => t.hidden) && (
          <button
            data-info='Add activity. Show a hidden activity for today.'
            onClick={() => setShowAddHiddenModal(true)}
            className='mt-3 w-full py-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center gap-2 text-gray-400 hover:text-gray-500 hover:border-gray-400 transition-colors'>
            <svg
              className='w-5 h-5'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
              strokeWidth={2}>
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                d='M12 4v16m8-8H4'
              />
            </svg>
            <span className='text-[14px] font-medium'>Add activity</span>
          </button>
        )}

      {/* Post-Lock Hidden Activities Popup — top-anchored panel */}
      {showHiddenActivitiesPopup && (
        <div
          className='fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-16'
          onClick={dismissHiddenActivitiesPopup}>
          <div
            className='w-full max-w-lg mx-4 bg-white dark:bg-gray-900 rounded-2xl max-h-[calc(100vh-140px)] overflow-hidden shadow-xl'
            onClick={(e) => e.stopPropagation()}>
            <div className='p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between'>
              <h3 className='text-[17px] font-semibold text-gray-900 dark:text-white'>
                Hidden Activities
              </h3>
              <button
                onClick={dismissHiddenActivitiesPopup}
                className='p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800'>
                <svg
                  className='w-6 h-6 text-gray-400'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'>
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M6 18L18 6M6 6l12 12'
                  />
                </svg>
              </button>
            </div>
            <div className='p-4 overflow-y-auto max-h-[calc(100vh-260px)]'>
              <p className='text-[13px] text-gray-500 dark:text-gray-400 mb-2'>
                Did you log anything for these today?
              </p>
              <div className='space-y-2'>
                {allActivityTypes
                  .filter((t) => t.hidden)
                  .map((type) => (
                    <button
                      key={type.id}
                      onClick={() => {
                        dismissHiddenActivitiesPopup();
                        setExpandedTypeId(type.id);
                      }}
                      className='w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors'>
                      <div
                        className='w-10 h-10 rounded-xl flex items-center justify-center'
                        style={{ backgroundColor: "rgba(0, 122, 255, 0.1)" }}>
                        <Icon
                          name={(type.icon as IconName) || "star"}
                          className='w-5 h-5 text-ios-blue'
                        />
                      </div>
                      <span className='text-[15px] font-medium text-gray-900 dark:text-white'>
                        {type.name}
                      </span>
                      <svg
                        className='w-5 h-5 text-gray-400 ml-auto'
                        fill='none'
                        viewBox='0 0 24 24'
                        stroke='currentColor'>
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M9 5l7 7-7 7'
                        />
                      </svg>
                    </button>
                  ))}
              </div>
            </div>
            <div className='px-4 pb-4'>
              <button
                onClick={dismissHiddenActivitiesPopup}
                className='w-full py-3 rounded-xl text-[15px] font-medium bg-ios-blue text-white active:opacity-80'>
                All good!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Hidden Activity Modal */}
      {showAddHiddenModal && (
        <div
          className='fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-16'
          onClick={() => setShowAddHiddenModal(false)}>
          <div
            className='w-full max-w-lg mx-4 bg-white dark:bg-gray-900 rounded-2xl max-h-[calc(100vh-140px)] overflow-hidden shadow-xl'
            onClick={(e) => e.stopPropagation()}>
            <div className='p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between'>
              <h3 className='text-[17px] font-semibold text-gray-900 dark:text-white'>
                Add Activity
              </h3>
              <button
                onClick={() => setShowAddHiddenModal(false)}
                className='p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800'>
                <svg
                  className='w-6 h-6 text-gray-400'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'>
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M6 18L18 6M6 6l12 12'
                  />
                </svg>
              </button>
            </div>
            <div className='p-4 overflow-y-auto max-h-[calc(100vh-220px)]'>
              {/* Globally hidden activities (from settings) */}
              {allActivityTypes.filter((t) => t.hidden).length > 0 && (
                <div>
                  <p className='text-[13px] text-gray-500 dark:text-gray-400 mb-2'>
                    Hidden in settings
                  </p>
                  <div className='space-y-2'>
                    {allActivityTypes
                      .filter((t) => t.hidden)
                      .map((type) => (
                        <button
                          key={type.id}
                          onClick={() => {
                            // Just expand the activity to let user add data
                            // Don't unhide globally - it will show once it has data
                            setExpandedTypeId(type.id);
                            setShowAddHiddenModal(false);
                          }}
                          className='w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors'>
                          <div
                            className='w-10 h-10 rounded-xl flex items-center justify-center'
                            style={{
                              backgroundColor: "rgba(0, 122, 255, 0.1)",
                            }}>
                            <Icon
                              name={(type.icon as IconName) || "star"}
                              className='w-5 h-5 text-ios-blue'
                            />
                          </div>
                          <span className='text-[15px] font-medium text-gray-900 dark:text-white'>
                            {type.name}
                          </span>
                          <svg
                            className='w-5 h-5 text-gray-400 ml-auto'
                            fill='none'
                            viewBox='0 0 24 24'
                            stroke='currentColor'>
                            <path
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              strokeWidth={2}
                              d='M12 4v16m8-8H4'
                            />
                          </svg>
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* No hidden activities */}
              {allActivityTypes.filter((t) => t.hidden).length === 0 && (
                <p className='text-center text-gray-500 dark:text-gray-400 py-8'>
                  No hidden activities
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lock Day Button - Outside activity list */}
      {!isViewingOther &&
        !(
          typeof window !== "undefined" &&
          localStorage.getItem("hide_lock_button") === "true" &&
          !isLocked
        ) && (
          <div className='mt-6 flex justify-center relative'>
            {/* Celebration overlay - fixed position to prevent scrollbars */}
            {showCelebration && (
              <div className='fixed inset-0 pointer-events-none overflow-hidden z-50'>
                <div className='absolute inset-0 flex items-center justify-center'>
                  {particles.map((particle) => (
                    <div
                      key={particle.id}
                      className='absolute animate-confetti'
                      style={
                        {
                          left: `${particle.x}%`,
                          top: `${particle.y}%`,
                          width: particle.size,
                          height: particle.size,
                          backgroundColor: particle.color,
                          transform: `rotate(${particle.rotation}deg)`,
                          "--vx": particle.velocityX,
                          "--vy": particle.velocityY,
                        } as React.CSSProperties
                      }
                    />
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={handleLockToggle}
              disabled={isLocking}
              data-info="Lock day. Finalize the day when you're done logging. Triggers a fun fact and celebration!"
              className={cn(
                "px-6 py-2.5 rounded-full flex items-center justify-center gap-2 transition-all duration-300",
                "active:scale-[0.98]",
                isLocked
                  ? "bg-ios-green text-white shadow-lg shadow-ios-green/30"
                  : "bg-white/80 dark:bg-ios-card-dark text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700",
                isLocking && "opacity-70 cursor-not-allowed",
              )}>
              {/* Lock icon with animation */}
              <div
                className={cn(
                  "transition-transform duration-500",
                  isLocked && "animate-bounce-once",
                )}>
                {isLocked ? (
                  <svg
                    className='w-4 h-4'
                    fill='none'
                    viewBox='0 0 24 24'
                    stroke='currentColor'
                    strokeWidth={2}>
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'
                    />
                  </svg>
                ) : (
                  <svg
                    className='w-4 h-4'
                    fill='none'
                    viewBox='0 0 24 24'
                    stroke='currentColor'
                    strokeWidth={2}>
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      d='M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z'
                    />
                  </svg>
                )}
              </div>
              <span className='font-medium text-[14px]'>
                {isLocking
                  ? "Working..."
                  : isLocked
                    ? "Day Locked ✨"
                    : "Lock Day"}
              </span>
            </button>
          </div>
        )}

      {/* Fun Fact / Word of the Day Modal */}
      {showFunFact && funFacts.length > 0 && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
          {/* Backdrop */}
          <div
            className='absolute inset-0 bg-black/50 backdrop-blur-sm'
            onClick={() => setShowFunFact(false)}
          />
          {/* Modal */}
          <div className='relative bg-white dark:bg-ios-card-dark rounded-2xl shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-200'>
            {/* Pagination dots — only shown when more than one fact */}
            {funFacts.length > 1 && (
              <div className='flex justify-center gap-1.5 mb-4'>
                {funFacts.map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "rounded-full transition-all duration-200",
                      i === funFactIndex
                        ? "w-4 h-1.5 bg-ios-blue"
                        : "w-1.5 h-1.5 bg-gray-300 dark:bg-gray-600",
                    )}
                  />
                ))}
              </div>
            )}

            {/* Current fact */}
            {(() => {
              const fact = funFacts[funFactIndex];
              return fact.word ? (
                <>
                  {/* Book icon for word of the day */}
                  <div className='flex justify-center mb-4'>
                    <div className='w-14 h-14 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center'>
                      <svg
                        className='w-8 h-8 text-purple-500'
                        fill='none'
                        viewBox='0 0 24 24'
                        strokeWidth={1.5}
                        stroke='currentColor'>
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          d='M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25'
                        />
                      </svg>
                    </div>
                  </div>
                  <h3 className='text-lg font-semibold text-center text-gray-900 dark:text-white mb-3'>
                    Word of the Day
                  </h3>
                  <p className='text-center text-[20px] font-bold text-gray-900 dark:text-white mb-1'>
                    {fact.word}
                  </p>
                  {fact.wordClass && (
                    <p className='text-center text-[12px] text-gray-400 dark:text-gray-500 italic mb-2'>
                      {fact.wordClass}
                    </p>
                  )}
                  <p className='text-gray-600 dark:text-gray-300 text-center text-[15px] leading-relaxed'>
                    {fact.definition}
                  </p>
                </>
              ) : (
                <>
                  {/* Light bulb icon for random facts */}
                  <div className='flex justify-center mb-4'>
                    <div className='w-14 h-14 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center'>
                      <svg
                        className='w-8 h-8 text-yellow-500'
                        fill='none'
                        viewBox='0 0 24 24'
                        strokeWidth={1.5}
                        stroke='currentColor'>
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          d='M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18'
                        />
                      </svg>
                    </div>
                  </div>
                  <h3 className='text-lg font-semibold text-center text-gray-900 dark:text-white mb-3'>
                    Did You Know?
                  </h3>
                  <p className='text-gray-600 dark:text-gray-300 text-center text-[15px] leading-relaxed'>
                    {fact.fact}
                  </p>
                </>
              );
            })()}

            {/* Next / Done button */}
            <button
              onClick={() => {
                if (funFactIndex < funFacts.length - 1) {
                  setFunFactIndex(funFactIndex + 1);
                } else {
                  setShowFunFact(false);
                  if (funFactsPendingAfterHidden) {
                    setShowHiddenActivitiesPopup(true);
                  }
                }
              }}
              className='w-full mt-4 py-3 bg-ios-blue text-white font-semibold rounded-xl active:opacity-80 transition-opacity'>
              {"Cool!"}
            </button>
          </div>
        </div>
      )}

      {/* Food Icon Picker Modal */}
      {foodIconPickerFor &&
        (() => {
          const foodIcons = [
            { icon: "apple", label: "Apple" },
            { icon: "banana", label: "Banana" },
            { icon: "bean", label: "Beans" },
            { icon: "beef", label: "Beef" },
            { icon: "cherry", label: "Berries" },
            { icon: "wheat", label: "Bread" },
            { icon: "burger", label: "Burger" },
            { icon: "cakeSlice", label: "Cake" },
            { icon: "candy", label: "Candy" },
            { icon: "carrot", label: "Carrot" },
            { icon: "cheese", label: "Cheese" },
            { icon: "chicken", label: "Chicken" },
            { icon: "citrus", label: "Citrus" },
            { icon: "coffee", label: "Coffee" },
            { icon: "cookie", label: "Cookie" },
            { icon: "cottageCheese", label: "Cottage Ch." },
            { icon: "cow", label: "Cow" },
            { icon: "crispBread2", label: "Cracker" },
            { icon: "crispBread", label: "Crisp Bread" },
            { icon: "duck", label: "Duck" },
            { icon: "egg", label: "Egg" },
            { icon: "fish", label: "Fish" },
            { icon: "eggFried", label: "Fried Egg" },
            { icon: "grape", label: "Grapes" },
            { icon: "leafyGreen", label: "Greens" },
            { icon: "ham", label: "Ham" },
            { icon: "leaf", label: "Herbs" },
            { icon: "hotFood", label: "Hot Meal" },
            { icon: "iceCream", label: "Ice Cream" },
            { icon: "glassWater", label: "Juice" },
            { icon: "lamb", label: "Lamb" },
            { icon: "milk", label: "Milk" },
            { icon: "nut", label: "Nuts" },
            { icon: "restaurant", label: "Other" },
            { icon: "croissant", label: "Pastry" },
            { icon: "pig", label: "Pig" },
            { icon: "pizza", label: "Pizza" },
            { icon: "vegan", label: "Plant" },
            { icon: "pork", label: "Pork" },
            { icon: "salad", label: "Salad" },
            { icon: "sandwich", label: "Sandwich" },
            { icon: "cupSoda", label: "Shake" },
            { icon: "shrimp", label: "Shrimp" },
            { icon: "popcorn", label: "Snack" },
            { icon: "soup", label: "Soup" },
            { icon: "yoghurt", label: "Yoghurt" },
          ];
          const currentType = allActivityTypes.find(
            (t) => t.id === foodIconPickerFor.typeId,
          );
          const currentIcon =
            currentType?.foodIcons?.[foodIconPickerFor.foodName] || "";
          return (
            <div
              className='fixed inset-0 bg-black/50 z-[60] flex items-start justify-center pt-12'
              onClick={() => setFoodIconPickerFor(null)}>
              <div
                className='w-full max-w-lg bg-white dark:bg-gray-900 rounded-b-2xl max-h-[80vh] overflow-hidden shadow-xl'
                onClick={(e) => e.stopPropagation()}>
                <div className='p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between'>
                  <div>
                    <h3 className='text-[17px] font-semibold text-gray-900 dark:text-white'>
                      Choose Icon
                    </h3>
                    <p className='text-[13px] text-gray-500 mt-0.5'>
                      {foodIconPickerFor.foodName}
                    </p>
                  </div>
                  <div className='flex items-center gap-2'>
                    {currentIcon && (
                      <button
                        onClick={async () => {
                          if (!currentType) return;
                          const newFoodIcons = { ...currentType.foodIcons };
                          delete newFoodIcons[foodIconPickerFor.foodName];
                          await updateActivityType({
                            ...currentType,
                            foodIcons:
                              Object.keys(newFoodIcons).length > 0
                                ? newFoodIcons
                                : undefined,
                          });
                          setFoodIconPickerFor(null);
                        }}
                        className='px-3 py-1.5 text-[14px] text-ios-red font-medium rounded-lg active:bg-red-50 dark:active:bg-red-900/20'>
                        Reset
                      </button>
                    )}
                    <button
                      onClick={() => setFoodIconPickerFor(null)}
                      className='text-ios-blue text-[17px] font-medium px-2'>
                      Done
                    </button>
                  </div>
                </div>
                <div className='p-4 overflow-y-auto max-h-[calc(80vh-60px)]'>
                  <div className='grid grid-cols-4 gap-3'>
                    {foodIcons.map((item) => (
                      <button
                        key={item.icon}
                        type='button'
                        onClick={async () => {
                          if (!currentType) return;
                          const newFoodIcons = {
                            ...(currentType.foodIcons || {}),
                            [foodIconPickerFor.foodName]: item.icon,
                          };
                          await updateActivityType({
                            ...currentType,
                            foodIcons: newFoodIcons,
                          });
                          setFoodIconPickerFor(null);
                        }}
                        className={cn(
                          "flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all active:scale-95",
                          currentIcon === item.icon
                            ? "border-ios-blue bg-ios-blue/10"
                            : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800",
                        )}>
                        <Icon
                          name={item.icon}
                          className='w-7 h-7'
                          strokeWidth={1.5}
                        />
                        <span className='text-[10px] text-gray-500 dark:text-gray-400'>
                          {item.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Edit Food Item Modal */}
      {editingFoodItem && (
        <div
          className='fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-6'
          onClick={() => setEditingFoodItem(null)}>
          <div
            className='w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl shadow-xl overflow-hidden'
            onClick={(e) => e.stopPropagation()}>
            <div className='p-5 space-y-4'>
              <h3 className='text-[17px] font-semibold text-gray-900 dark:text-white text-center'>
                Edit Food
              </h3>
              <div>
                <label className='text-[13px] text-gray-500 mb-1.5 block'>
                  Name
                </label>
                <input
                  type='text'
                  value={editingFoodItem.newName}
                  onChange={(e) =>
                    setEditingFoodItem({
                      ...editingFoodItem,
                      newName: e.target.value,
                    })
                  }
                  className='w-full px-3 py-2.5 rounded-xl text-[17px] bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-ios-blue'
                  autoFocus
                />
              </div>
              <div>
                <div className='flex items-center justify-between mb-1.5'>
                  <label className='text-[13px] text-gray-500'>Icon</label>
                  <button
                    type='button'
                    onClick={() => {
                      setFoodIconPickerFor({
                        typeId: editingFoodItem.typeId,
                        foodName: editingFoodItem.originalName,
                      });
                    }}
                    className='text-[13px] text-ios-blue font-medium'>
                    Change
                  </button>
                </div>
                <div className='flex items-center justify-center p-4 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700'>
                  <Icon
                    name={(() => {
                      const ct = allActivityTypes.find(
                        (t) => t.id === editingFoodItem.typeId,
                      );
                      const customIcon =
                        ct?.foodIcons?.[editingFoodItem.originalName];
                      if (customIcon) return customIcon;
                      // Auto-match to Lucide icon
                      const foodIconMap: [RegExp, string][] = [
                        [/chicken|kylling/i, "chicken"],
                        [/beef|steak|biff|okse/i, "beef"],
                        [/pork|ribbe|svin/i, "pork"],
                        [/fish|laks|salmon|tuna|torsk|cod|fisk/i, "fish"],
                        [/shrimp|reke|prawn/i, "shrimp"],
                        [/egg/i, "egg"],
                        [/milk|melk/i, "milk"],
                        [/cottage.*cheese|kesam/i, "cottageCheese"],
                        [/cheese|ost(?!e)/i, "cheese"],
                        [/yogurt|yoghurt|skyr/i, "yoghurt"],
                        [/bread|brød/i, "wheat"],
                        [/crisp.*bread|knekkebrød|knekkebr/i, "crispBread"],
                        [/bean|bønne|lentil|linse/i, "bean"],
                        [/nut|nøtt/i, "nut"],
                      ];
                      for (const [p, icon] of foodIconMap) {
                        if (p.test(editingFoodItem.originalName)) return icon;
                      }
                      return "restaurant";
                    })()}
                    className='w-10 h-10 text-gray-600 dark:text-gray-300'
                    strokeWidth={1.5}
                  />
                </div>
              </div>
            </div>
            <div className='flex border-t border-gray-200 dark:border-gray-700'>
              <button
                onClick={() => setEditingFoodItem(null)}
                className='flex-1 py-3.5 text-[17px] font-medium text-gray-500 border-r border-gray-200 dark:border-gray-700 active:bg-gray-100 dark:active:bg-gray-800'>
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!editingFoodItem.newName.trim()) return;
                  const oldName = editingFoodItem.originalName;
                  const newName = editingFoodItem.newName.trim();

                  if (oldName !== newName) {
                    try {
                      // Update all entries in Supabase
                      const { renameFoodInSupabase } =
                        await import("@/lib/supabase-sync");
                      if (user?.id) {
                        await renameFoodInSupabase(
                          user.id,
                          editingFoodItem.typeId,
                          oldName,
                          newName,
                        );
                      }

                      // Update local entries for current view
                      for (const entry of entries) {
                        if (
                          entry.activityTypeId === editingFoodItem.typeId &&
                          entry.value === oldName
                        ) {
                          await updateEntry({
                            ...entry,
                            value: newName,
                            nutritionData: entry.nutritionData
                              ? { ...entry.nutritionData, foodName: newName }
                              : undefined,
                          });
                        }
                      }

                      // Update foodIcons map if custom icon was set
                      const ct = allActivityTypes.find(
                        (t) => t.id === editingFoodItem.typeId,
                      );
                      if (ct?.foodIcons?.[oldName]) {
                        const newFoodIcons = { ...ct.foodIcons };
                        newFoodIcons[newName] = newFoodIcons[oldName];
                        delete newFoodIcons[oldName];
                        await updateActivityType({
                          ...ct,
                          foodIcons: newFoodIcons,
                        });
                      }
                    } catch (e) {
                      console.error("Failed to rename food:", e);
                    }
                  }
                  setEditingFoodItem(null);
                  setEditingFoodMap(false);
                }}
                className='flex-1 py-3.5 text-[17px] font-semibold text-ios-blue active:bg-gray-100 dark:active:bg-gray-800'>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
