"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
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
  ROUTINE_COLORS,
  COMMON_EXERCISES,
} from "@/types";
import { cn } from "@/lib/utils";
import { Icon, icons, IconName } from "./Icons";
import { MediaSearch } from "./MediaSearch";

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

  // Load workout state from localStorage when date changes (only for anonymous users)
  // Signed-in users get their data from Supabase via entries
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Only load workout-data from localStorage for anonymous users
      const savedData = !user
        ? localStorage.getItem(`workout-data-${date}`)
        : null;
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
  }, [date, user]);

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

  // Save workout data to localStorage - only for anonymous users
  // Signed-in users save directly to Supabase when they click Save
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      loadedDateRef.current === date &&
      !user
    ) {
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
      } else {
        localStorage.removeItem(`workout-data-${date}`);
      }
    }
  }, [workoutData, date, user]);

  // Save expanded exercises to localStorage
  useEffect(() => {
    if (typeof window !== "undefined" && loadedDateRef.current === date) {
      if (expandedExercises.size > 0) {
        localStorage.setItem(
          `workout-expanded-${date}`,
          JSON.stringify([...expandedExercises]),
        );
      } else {
        localStorage.removeItem(`workout-expanded-${date}`);
      }
    }
  }, [expandedExercises, date]);

  // Save editing state to localStorage
  useEffect(() => {
    if (typeof window !== "undefined" && loadedDateRef.current === date) {
      if (isEditingWorkout) {
        localStorage.setItem(`workout-editing-${date}`, "true");
      } else {
        localStorage.removeItem(`workout-editing-${date}`);
      }
    }
  }, [isEditingWorkout, date]);

  // Save selected routine to localStorage
  useEffect(() => {
    if (typeof window !== "undefined" && loadedDateRef.current === date) {
      if (selectedRoutineId) {
        localStorage.setItem(`workout-routine-${date}`, selectedRoutineId);
      } else {
        localStorage.removeItem(`workout-routine-${date}`);
      }
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

  // Handle lock toggle - also saves workout data
  const handleLockToggle = async () => {
    if (isViewingOther) return;

    setIsLocking(true);

    // Save any pending workout data before locking
    const workoutType = activityTypes.find((t) => t.valueType === "workout");
    if (workoutType && Object.keys(workoutData).length > 0) {
      const customExercises = workoutType.customExercises || [];
      await handleSaveAllWorkouts(workoutType.id, customExercises);
    }

    const newLockedState = await toggleDayLock(date);
    setIsLocking(false);

    if (newLockedState) {
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
    }
  };

  useEffect(() => {
    loadEntriesForDateRange(date, date);
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
      for (const type of activityTypes) {
        if (type.valueType === "text" || type.valueType === "nutrition") {
          const sugg = await getSuggestions(type.id);
          newSuggestions[type.id] = sugg;
        }
      }
      setSuggestions(newSuggestions);
    }
    loadAllSuggestions();
  }, [activityTypes, getSuggestions]);

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

    const type = activityTypes.find((t) => t.id === typeId);
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
    },
  ) => {
    // Don't allow editing when viewing another user's data
    if (isViewingOther) return;

    const type = activityTypes.find((t) => t.id === typeId);
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
          entryMetadata = {
            imdbId: existingEntry.imdbId,
            poster: existingEntry.poster,
            imdbRating: existingEntry.imdbRating,
            year: existingEntry.year,
          };
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
    const type = typeId ? activityTypes.find((t) => t.id === typeId) : null;
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
    await handleSaveValue(typeId, displayTitle, {
      imdbId,
      poster: poster !== "N/A" ? poster : undefined,
      imdbRating: rating && rating !== "N/A" ? rating : undefined,
      year,
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
                  autoFocus
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
                "flex-1 py-4 rounded-xl active:scale-95 transition-transform flex items-center justify-center",
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
                "flex-1 py-4 rounded-xl active:scale-95 transition-transform flex items-center justify-center",
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
                "flex-1 py-4 rounded-xl active:scale-95 transition-transform flex items-center justify-center",
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
        const totals = getNutritionTotals(type.id);
        const goal = type.nutritionGoal || {};
        const typeEntries = savedValues[type.id] || [];

        return (
          <div className='pt-3 space-y-4'>
            {/* Progress bars */}
            {(goal.protein || goal.calories || goal.carbs || goal.fat) && (
              <div className='space-y-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50'>
                <p className='text-[13px] font-medium text-gray-500 mb-2'>
                  Daily Progress
                </p>
                {goal.protein && (
                  <div>
                    <div className='flex justify-between text-[13px] mb-1'>
                      <span className='text-gray-600 dark:text-gray-400'>
                        Protein
                      </span>
                      <span
                        className={cn(
                          "font-medium",
                          totals.protein >= goal.protein
                            ? "text-ios-green"
                            : "text-gray-600 dark:text-gray-400",
                        )}>
                        {totals.protein}g / {goal.protein}g
                        {totals.protein >= goal.protein && " ✓"}
                      </span>
                    </div>
                    <div className='h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden'>
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          totals.protein >= goal.protein
                            ? "bg-ios-green"
                            : "bg-ios-blue",
                        )}
                        style={{
                          width: `${Math.min(
                            100,
                            (totals.protein / goal.protein) * 100,
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
                {goal.calories && (
                  <div>
                    <div className='flex justify-between text-[13px] mb-1'>
                      <span className='text-gray-600 dark:text-gray-400'>
                        Calories
                      </span>
                      <span
                        className={cn(
                          "font-medium",
                          totals.calories >= goal.calories
                            ? "text-ios-green"
                            : "text-gray-600 dark:text-gray-400",
                        )}>
                        {totals.calories} / {goal.calories} kcal
                        {totals.calories >= goal.calories && " ✓"}
                      </span>
                    </div>
                    <div className='h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden'>
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          totals.calories >= goal.calories
                            ? "bg-ios-green"
                            : "bg-ios-orange",
                        )}
                        style={{
                          width: `${Math.min(
                            100,
                            (totals.calories / goal.calories) * 100,
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
                {goal.carbs && (
                  <div>
                    <div className='flex justify-between text-[13px] mb-1'>
                      <span className='text-gray-600 dark:text-gray-400'>
                        Carbs
                      </span>
                      <span
                        className={cn(
                          "font-medium",
                          totals.carbs >= goal.carbs
                            ? "text-ios-green"
                            : "text-gray-600 dark:text-gray-400",
                        )}>
                        {totals.carbs}g / {goal.carbs}g
                        {totals.carbs >= goal.carbs && " ✓"}
                      </span>
                    </div>
                    <div className='h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden'>
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          totals.carbs >= goal.carbs
                            ? "bg-ios-green"
                            : "bg-amber-500",
                        )}
                        style={{
                          width: `${Math.min(
                            100,
                            (totals.carbs / goal.carbs) * 100,
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
                {goal.fat && (
                  <div>
                    <div className='flex justify-between text-[13px] mb-1'>
                      <span className='text-gray-600 dark:text-gray-400'>
                        Fat
                      </span>
                      <span
                        className={cn(
                          "font-medium",
                          totals.fat >= goal.fat
                            ? "text-ios-green"
                            : "text-gray-600 dark:text-gray-400",
                        )}>
                        {totals.fat}g / {goal.fat}g
                        {totals.fat >= goal.fat && " ✓"}
                      </span>
                    </div>
                    <div className='h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden'>
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          totals.fat >= goal.fat
                            ? "bg-ios-green"
                            : "bg-purple-500",
                        )}
                        style={{
                          width: `${Math.min(
                            100,
                            (totals.fat / goal.fat) * 100,
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
                      autoFocus
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
                    "flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-medium transition-colors",
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
                className='px-4 py-2 rounded-full text-[13px] bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors'>
                + Add workout
              </button>
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

  return (
    <>
      {/* Expanded Content for Icon Grid View - Positioned at top */}
      {viewMode === "icons" &&
        expandedTypeId &&
        (() => {
          const type = activityTypes.find((t) => t.id === expandedTypeId);
          if (!type) return null;

          const typeSavedValues = savedValues[type.id] || [];
          const hasSavedValues = typeSavedValues.length > 0;
          const isMood = type.valueType === "mood";
          const isWorkout = type.valueType === "workout";
          const isCheckmark = type.valueType === "checkmark";
          const isCounter = type.valueType === "counter";

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
                {/* Saved values with delete option - not for mood, workout, checkmark, or counter type */}
                {hasSavedValues &&
                  !isMood &&
                  !isWorkout &&
                  !isCheckmark &&
                  !isCounter && (
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
        <div className='grid grid-cols-4 gap-3'>
          {activityTypes.map((type) => {
            const typeSavedValues = savedValues[type.id] || [];
            const hasSavedValues = typeSavedValues.length > 0;
            const isCheckmark = type.valueType === "checkmark";
            const isWorkout = type.valueType === "workout";
            const isNutrition = type.valueType === "nutrition";
            const isMood = type.valueType === "mood";
            const isCounter = type.valueType === "counter";

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

            const hasValue = hasSavedValues || workoutHasEnteredData;
            const isSkipped =
              isCheckmark && typeSavedValues[0]?.value === "skipped";
            const isChecked = isCheckmark && hasSavedValues && !isSkipped;

            // Get display text for the icon
            const getIconDisplayText = () => {
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
              // For nutrition types with goals, show goals reached
              if (isNutrition && type.nutritionGoal) {
                const totals = getNutritionTotals(type.id);
                const goal = type.nutritionGoal;
                let goalsSet = 0;
                let goalsReached = 0;
                if (goal.protein) {
                  goalsSet++;
                  if (totals.protein >= goal.protein) goalsReached++;
                }
                if (goal.calories) {
                  goalsSet++;
                  if (totals.calories >= goal.calories) goalsReached++;
                }
                if (goal.carbs) {
                  goalsSet++;
                  if (totals.carbs >= goal.carbs) goalsReached++;
                }
                if (goal.fat) {
                  goalsSet++;
                  if (totals.fat >= goal.fat) goalsReached++;
                }
                if (goalsSet > 0) {
                  return `${goalsReached}/${goalsSet}`;
                }
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
                  saved.value === true && !entry?.workoutData?.exercises?.length
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
                  "aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 p-1 overflow-hidden relative",
                  hasValue && !isSkipped
                    ? "bg-ios-green/15 dark:bg-ios-green/20"
                    : isSkipped
                      ? "bg-ios-red/15 dark:bg-ios-red/20"
                      : "bg-gray-200 dark:bg-gray-800",
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
                    hasValue && !isSkipped
                      ? "text-ios-green"
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
                  {isNutrition && type.nutritionGoal && displayText
                    ? displayText
                    : type.name}
                </span>
                {isSkipped && (
                  <div className='w-1.5 h-1.5 rounded-full bg-ios-red' />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* List View */}
      {viewMode === "list" && (
        <div className='bg-white/80 dark:bg-ios-card-dark rounded-xl overflow-visible'>
          {activityTypes.map((type, index) => {
            const typeSavedValues = savedValues[type.id] || [];
            const hasSavedValues = typeSavedValues.length > 0;
            const isExpanded = expandedTypeId === type.id;
            const isLast = index === activityTypes.length - 1;
            const isCheckmark = type.valueType === "checkmark";
            const isCounter = type.valueType === "counter";
            const isMood = type.valueType === "mood";
            const isNutrition = type.valueType === "nutrition";
            const isWorkout = type.valueType === "workout";

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
                    "flex items-center min-h-[44px] px-4 active:bg-gray-100 dark:active:bg-gray-700 cursor-pointer",
                    isExpanded && "bg-gray-50 dark:bg-gray-800",
                    isLocked && "pointer-events-none opacity-75",
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
                            isLocked
                              ? "text-ios-green"
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
                  <div className='flex-1 py-2 flex items-center min-w-0 overflow-hidden'>
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
                          const totals = getNutritionTotals(type.id);
                          const goal = type.nutritionGoal || {};
                          const hasGoal =
                            goal.protein ||
                            goal.calories ||
                            goal.carbs ||
                            goal.fat;
                          const hasEntries = hasSavedValues;

                          if (!hasGoal && !hasEntries) return null;

                          // Show primary goal progress (protein first, then calories)
                          const primaryGoal = goal.protein
                            ? "protein"
                            : goal.calories
                              ? "calories"
                              : null;
                          const totalValue =
                            primaryGoal === "protein"
                              ? totals.protein
                              : totals.calories;
                          const goalValue =
                            primaryGoal === "protein"
                              ? goal.protein
                              : goal.calories;
                          const isGoalReached =
                            goalValue && totalValue >= goalValue;

                          return (
                            <span className='text-[15px] text-gray-500 dark:text-gray-400 truncate max-w-[180px]'>
                              {primaryGoal === "protein" && goalValue ? (
                                <>
                                  {totals.protein}g / {goal.protein}g
                                  {isGoalReached && (
                                    <span className='text-ios-green ml-1'>
                                      ✓
                                    </span>
                                  )}
                                </>
                              ) : primaryGoal === "calories" && goalValue ? (
                                <>
                                  {totals.calories} / {goal.calories} kcal
                                  {isGoalReached && (
                                    <span className='text-ios-green ml-1'>
                                      ✓
                                    </span>
                                  )}
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
                    {/* Saved values with delete option - not for mood or workout type */}
                    {hasSavedValues && !isMood && !isWorkout && (
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
    </>
  );
}
