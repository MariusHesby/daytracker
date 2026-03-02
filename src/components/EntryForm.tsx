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
  ROUTINE_COLORS,
  COMMON_EXERCISES,
} from "@/types";
import { cn, addDays } from "@/lib/utils";
import { getMediaMetadata } from "@/lib/supabase-sync";
import { Icon, icons, IconName } from "./Icons";
import { MediaSearch } from "./MediaSearch";
import {
  fetchRandomFunFact,
  getSelectedCategories,
  FunFact,
} from "@/lib/funfacts";

interface EntryFormProps {
  date: string;
  onSuccess?: () => void;
  viewMode?: "list" | "icons";
  onViewModeChange?: (mode: "list" | "icons") => void;
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

export function EntryForm({
  date,
  onSuccess,
  viewMode: externalViewMode,
  onViewModeChange,
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
  const [numberValue, setNumberValue] = useState<string>("");
  const [lastClickTime, setLastClickTime] = useState<Record<string, number>>(
    {},
  );
  const [isLocking, setIsLocking] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [showFunFact, setShowFunFact] = useState(false);
  const [funFact, setFunFact] = useState<FunFact | null>(null);

  // View mode: 'list' or 'icons' - use external state if provided
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

  // Checklist new item text input state
  const [newChecklistItemText, setNewChecklistItemText] = useState("");
  const [showChecklistDropdown, setShowChecklistDropdown] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);

  // Get checklist suggestions from all entries with checklist data
  const checklistSuggestions = useMemo(() => {
    const itemCounts = new Map<string, number>();
    entries.forEach((entry) => {
      if (entry.checklistData?.items) {
        entry.checklistData.items.forEach((item) => {
          const text = item.text.trim();
          if (text) {
            itemCounts.set(text, (itemCounts.get(text) || 0) + 1);
          }
        });
      }
    });
    // Sort by count descending and return top 10
    return Array.from(itemCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([text, count]) => ({ value: text, count }));
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
      const workoutType = activityTypes.find((t) => t.valueType === "workout");
      if (workoutType) {
        const history = await getWorkoutHistory(workoutType.id, date);
        setWorkoutHistoryEntries(history);
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

      for (const checklistType of checklistTypes) {
        const checklistEntry = dateEntries.find(
          (e) =>
            e.activityTypeId === checklistType.id && e.checklistData?.items,
        );

        if (checklistEntry?.checklistData?.items) {
          const uncompletedItems = checklistEntry.checklistData.items.filter(
            (item) => !item.completed,
          );

          if (uncompletedItems.length > 0) {
            // Check if there's already a checklist entry for the next day
            const nextDayEntries = entries.filter((e) => e.date === nextDay);
            const existingNextDayEntry = nextDayEntries.find(
              (e) =>
                e.activityTypeId === checklistType.id && e.checklistData?.items,
            );

            // Reset the uncompleted items (set completed to false) for the new day
            const itemsForNextDay: ChecklistItem[] = uncompletedItems.map(
              (item) => ({
                id: crypto.randomUUID(),
                text: item.text,
                completed: false,
              }),
            );

            if (existingNextDayEntry) {
              // Merge with existing items, avoiding duplicates
              const existingTexts = new Set(
                existingNextDayEntry.checklistData?.items?.map((i) => i.text) ||
                  [],
              );
              const newItems = itemsForNextDay.filter(
                (item) => !existingTexts.has(item.text),
              );
              const mergedItems = [
                ...(existingNextDayEntry.checklistData?.items || []),
                ...newItems,
              ];

              await updateEntry({
                ...existingNextDayEntry,
                checklistData: { items: mergedItems },
                value: `${mergedItems.filter((i) => i.completed).length}/${mergedItems.length}`,
              });
            } else {
              // Create new entry for next day
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

      // Fetch fun fact if categories are selected
      const categories = getSelectedCategories();
      if (categories.length > 0) {
        fetchRandomFunFact().then((fact) => {
          if (fact) {
            setFunFact(fact);
            // Show fun fact modal after celebration finishes (1.5s)
            setTimeout(() => {
              setShowFunFact(true);
            }, 1500);
          }
        });
      }
    } else {
      // When unlocking: all activities will show again (dynamic filtering)
    }
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
          <div className='pt-3 flex gap-3'>
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
          <div className='pt-3 flex gap-3'>
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
            {(ownGoal.protein ||
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
                  <button
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

        const handleAddItem = async () => {
          if (!newChecklistItemText.trim()) return;

          const newItem: ChecklistItem = {
            id: crypto.randomUUID(),
            text: newChecklistItemText.trim(),
            completed: false,
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
          setNewChecklistItemText("");
        };

        const handleToggleItem = async (itemId: string) => {
          if (!existingEntry) return;

          const updatedItems = checklistItems.map((item) =>
            item.id === itemId ? { ...item, completed: !item.completed } : item,
          );
          const checklistData: ChecklistData = { items: updatedItems };

          await updateEntry({
            ...existingEntry,
            checklistData,
            value: `${updatedItems.filter((i) => i.completed).length}/${updatedItems.length}`,
          });
        };

        const handleDeleteItem = async (itemId: string) => {
          if (!existingEntry) return;

          const updatedItems = checklistItems.filter(
            (item) => item.id !== itemId,
          );

          if (updatedItems.length === 0) {
            // Delete the entry if no items left
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
                  value={newChecklistItemText}
                  onChange={(e) => {
                    setNewChecklistItemText(e.target.value);
                    setShowChecklistDropdown(true);
                  }}
                  onFocus={() => setShowChecklistDropdown(true)}
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
                  onClick={() => {
                    handleAddItem();
                    setShowChecklistDropdown(false);
                  }}
                  disabled={!newChecklistItemText.trim()}
                  className={cn(
                    "px-4 py-2 rounded-lg text-[15px] font-medium transition-colors",
                    newChecklistItemText.trim()
                      ? "bg-ios-blue text-white"
                      : "bg-gray-200 dark:bg-gray-600 text-gray-400 dark:text-gray-500",
                  )}>
                  Add
                </button>
              </div>
              {/* Autocomplete dropdown */}
              {showChecklistDropdown &&
                (() => {
                  // Filter suggestions based on what the user is typing
                  const filteredSuggestions = newChecklistItemText.trim()
                    ? checklistSuggestions.filter((sugg) =>
                        sugg.value
                          .toLowerCase()
                          .includes(newChecklistItemText.toLowerCase()),
                      )
                    : checklistSuggestions;
                  // Don't show if exact match or no suggestions
                  const showDropdown =
                    filteredSuggestions.length > 0 &&
                    !filteredSuggestions.some(
                      (s) =>
                        s.value.toLowerCase() ===
                        newChecklistItemText.toLowerCase().trim(),
                    );

                  if (!showDropdown) return null;

                  return (
                    <div className='absolute left-0 right-12 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-50 max-h-48 overflow-y-auto'>
                      {filteredSuggestions.slice(0, 10).map((sugg) => (
                        <button
                          key={sugg.value}
                          onClick={() => {
                            setNewChecklistItemText(sugg.value);
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

  // Get checklist types for standalone section
  const checklistTypes = allActivityTypes.filter(
    (t) =>
      t.valueType === "checklist" &&
      (!t.hidden ||
        (savedValues[t.id] || []).length > 0 ||
        entries.some(
          (e) =>
            e.activityTypeId === t.id && e.date === date && e.checklistData,
        )),
  );
  const nextDay = addDays(date, 1);

  return (
    <>
      {/* Standalone Checklist / Todo Section — separated like matchday */}
      {checklistTypes.map((type) => {
        const existingEntry = entries.find(
          (e) =>
            e.activityTypeId === type.id && e.date === date && e.checklistData,
        );
        const checklistItems = existingEntry?.checklistData?.items || [];
        const completedCount = checklistItems.filter(
          (item) => item.completed,
        ).length;
        const totalCount = checklistItems.length;

        // Next day items
        const nextDayEntry = entries.find(
          (e) =>
            e.activityTypeId === type.id &&
            e.date === nextDay &&
            e.checklistData,
        );
        const nextDayItems = nextDayEntry?.checklistData?.items || [];
        const nextDayCompleted = nextDayItems.filter((i) => i.completed).length;

        const handleAddItem = async () => {
          if (!newChecklistItemText.trim()) return;

          const newItem: ChecklistItem = {
            id: crypto.randomUUID(),
            text: newChecklistItemText.trim(),
            completed: false,
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
          setNewChecklistItemText("");
        };

        const handleToggleItem = async (itemId: string) => {
          if (!existingEntry) return;

          const updatedItems = checklistItems.map((item) =>
            item.id === itemId ? { ...item, completed: !item.completed } : item,
          );
          const checklistData: ChecklistData = { items: updatedItems };

          await updateEntry({
            ...existingEntry,
            checklistData,
            value: `${updatedItems.filter((i) => i.completed).length}/${updatedItems.length}`,
          });
        };

        const handleDeleteItem = async (itemId: string) => {
          if (!existingEntry) return;

          const updatedItems = checklistItems.filter(
            (item) => item.id !== itemId,
          );

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

        // Next day toggle/delete handlers
        const handleToggleNextDayItem = async (itemId: string) => {
          if (!nextDayEntry) return;
          const updatedItems = nextDayItems.map((item) =>
            item.id === itemId ? { ...item, completed: !item.completed } : item,
          );
          await updateEntry({
            ...nextDayEntry,
            checklistData: { items: updatedItems },
            value: `${updatedItems.filter((i) => i.completed).length}/${updatedItems.length}`,
          });
        };

        const handleDeleteNextDayItem = async (itemId: string) => {
          if (!nextDayEntry) return;
          const updatedItems = nextDayItems.filter(
            (item) => item.id !== itemId,
          );
          if (updatedItems.length === 0) {
            await deleteEntry(nextDayEntry.id);
          } else {
            await updateEntry({
              ...nextDayEntry,
              checklistData: { items: updatedItems },
              value: `${updatedItems.filter((i) => i.completed).length}/${updatedItems.length}`,
            });
          }
        };

        // Don't render if locked and no items
        if (isLocked && totalCount === 0 && nextDayItems.length === 0)
          return null;

        return (
          <div
            key={type.id}
            className='mb-3 bg-white/80 dark:bg-ios-card-dark rounded-xl border border-gray-200/60 dark:border-gray-700/60 overflow-visible'>
            {/* Header — tap to open/close */}
            <div
              className='flex items-center px-4 py-3 cursor-pointer active:bg-gray-100 dark:active:bg-gray-700'
              onClick={() => setChecklistOpen((prev) => !prev)}>
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
            {checklistOpen && (totalCount > 0 || !isLocked) && (
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
                {!isLocked && (
                  <div className='relative mt-2'>
                    <div className='flex items-center gap-2'>
                      <input
                        type='text'
                        value={newChecklistItemText}
                        onChange={(e) => {
                          setNewChecklistItemText(e.target.value);
                          setShowChecklistDropdown(true);
                        }}
                        onFocus={() => setShowChecklistDropdown(true)}
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
                        onClick={() => {
                          handleAddItem();
                          setShowChecklistDropdown(false);
                        }}
                        disabled={!newChecklistItemText.trim()}
                        className={cn(
                          "px-4 py-2 rounded-lg text-[15px] font-medium transition-colors",
                          newChecklistItemText.trim()
                            ? "bg-ios-blue text-white"
                            : "bg-gray-200 dark:bg-gray-600 text-gray-400 dark:text-gray-500",
                        )}>
                        Add
                      </button>
                    </div>
                    {/* Autocomplete dropdown */}
                    {showChecklistDropdown &&
                      (() => {
                        const filteredSuggestions = newChecklistItemText.trim()
                          ? checklistSuggestions.filter((sugg) =>
                              sugg.value
                                .toLowerCase()
                                .includes(newChecklistItemText.toLowerCase()),
                            )
                          : checklistSuggestions;
                        const showDropdown =
                          filteredSuggestions.length > 0 &&
                          !filteredSuggestions.some(
                            (s) =>
                              s.value.toLowerCase() ===
                              newChecklistItemText.toLowerCase().trim(),
                          );
                        if (!showDropdown) return null;
                        return (
                          <div className='absolute left-0 right-12 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-50 max-h-48 overflow-y-auto'>
                            {filteredSuggestions.slice(0, 10).map((sugg) => (
                              <button
                                key={sugg.value}
                                onClick={() => {
                                  setNewChecklistItemText(sugg.value);
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
                )}
              </div>
            )}

            {/* Tomorrow's checklist items */}
            {checklistOpen && nextDayItems.length > 0 && (
              <div className='border-t border-gray-200/60 dark:border-gray-700/60'>
                <div className='flex items-center px-4 py-2'>
                  <span className='text-[13px] font-medium text-gray-400 dark:text-gray-500'>
                    Tomorrow
                  </span>
                  <span className='ml-auto text-[12px] text-gray-400 dark:text-gray-500'>
                    {nextDayCompleted}/{nextDayItems.length}
                  </span>
                </div>
                <div className='px-4 pb-3 space-y-1'>
                  {nextDayItems.map((item) => (
                    <div
                      key={item.id}
                      className='flex items-center gap-3 py-1.5 px-1 group'>
                      <button
                        onClick={() => handleToggleNextDayItem(item.id)}
                        className={cn(
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                          item.completed
                            ? "bg-ios-green/70 border-ios-green/70"
                            : "border-gray-300/60 dark:border-gray-600/60",
                        )}>
                        {item.completed && (
                          <svg
                            className='w-3 h-3 text-white'
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
                          "flex-1 text-[14px]",
                          item.completed
                            ? "text-gray-300 dark:text-gray-600 line-through"
                            : "text-gray-500 dark:text-gray-400",
                        )}>
                        {item.text}
                      </span>
                      <button
                        onClick={() => handleDeleteNextDayItem(item.id)}
                        className='w-5 h-5 rounded-full flex items-center justify-center text-gray-200 dark:text-gray-700 active:text-ios-red transition-colors'>
                        <svg
                          className='w-2.5 h-2.5'
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
              </div>
            )}
          </div>
        );
      })}

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

          return (
            <div className='mb-4 bg-white dark:bg-ios-card-dark rounded-2xl shadow-lg shadow-black/5 dark:shadow-black/20 overflow-visible relative z-10'>
              {/* Header with close button */}
              <div className='flex items-center justify-between px-4 py-3'>
                <div className='flex items-center gap-3'>
                  {type.icon && (
                    <span className='text-[24px]'>{type.icon}</span>
                  )}
                  <span className='text-[17px] font-semibold text-gray-900 dark:text-white'>
                    {type.name}
                  </span>
                </div>
                <button
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
                {/* Saved values with delete option - not for mood, workout, checkmark, counter, or checklist type */}
                {hasSavedValues &&
                  !isMood &&
                  !isWorkout &&
                  !isCheckmark &&
                  !isCounter &&
                  !isChecklist && (
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
          {allActivityTypes
            .filter((type) => {
              // Checklist types are shown in the standalone section above
              if (type.valueType === "checklist") return false;
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
                  {isSkipped && (
                    <div className='w-1.5 h-1.5 rounded-full bg-ios-red' />
                  )}
                </button>
              );
            })}

          {/* Add Hidden Activity Button - Icon Grid Version */}
          {!isViewingOther && allActivityTypes.some((t) => t.hidden) && (
            <button
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
        <div className='bg-white/80 dark:bg-ios-card-dark rounded-xl overflow-visible'>
          {allActivityTypes
            .filter((type) => {
              // Checklist types are shown in the standalone section above
              if (type.valueType === "checklist") return false;
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
                    className={cn(
                      "flex items-center min-h-[48px] px-4 active:bg-gray-100 dark:active:bg-gray-700 cursor-pointer",
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
                      {/* Saved values with delete option - not for mood, workout, or checklist type */}
                      {hasSavedValues &&
                        !isMood &&
                        !isWorkout &&
                        !isChecklist && (
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
      {!isViewingOther && (
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

      {/* Fun Fact Modal */}
      {showFunFact && funFact && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
          {/* Backdrop */}
          <div
            className='absolute inset-0 bg-black/50 backdrop-blur-sm'
            onClick={() => setShowFunFact(false)}
          />
          {/* Modal */}
          <div className='relative bg-white dark:bg-ios-card-dark rounded-2xl shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-200'>
            {/* Light bulb icon */}
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
            {/* Title */}
            <h3 className='text-lg font-semibold text-center text-gray-900 dark:text-white mb-3'>
              Did You Know?
            </h3>
            {/* Fun fact text */}
            <p className='text-gray-600 dark:text-gray-300 text-center text-[15px] leading-relaxed mb-4'>
              {funFact.fact}
            </p>
            {/* Good to know button */}
            <button
              onClick={() => setShowFunFact(false)}
              className='w-full py-3 bg-ios-blue text-white font-semibold rounded-xl active:opacity-80 transition-opacity'>
              Good to know
            </button>
          </div>
        </div>
      )}
    </>
  );
}
