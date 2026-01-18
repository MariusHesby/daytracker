"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useApp } from "@/context/AppContext";
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

export function EntryForm({ date, onSuccess }: EntryFormProps) {
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
  const [expandedTypeId, setExpandedTypeIdState] = useState<string | null>(
    () => {
      if (typeof window !== "undefined") {
        return localStorage.getItem(`expanded-activity-${date}`);
      }
      return null;
    }
  );
  const [savedValues, setSavedValues] = useState<Record<string, SavedValue[]>>(
    {}
  );
  const [suggestions, setSuggestions] = useState<Record<string, Suggestion[]>>(
    {}
  );
  const [customValue, setCustomValue] = useState("");
  const [showTextDropdown, setShowTextDropdown] = useState(false);
  const [numberValue, setNumberValue] = useState<string>("");
  const [lastClickTime, setLastClickTime] = useState<Record<string, number>>(
    {}
  );
  const [isLocking, setIsLocking] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);

  // View mode: 'list' or 'icons'
  const [viewMode, setViewMode] = useState<"list" | "icons">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("entryform-viewmode") as "list" | "icons") || "list";
    }
    return "list";
  });

  // Nutrition entry state
  const [nutritionInput, setNutritionInput] = useState<NutritionData>({
    foodName: "",
  });
  // Track if we've already shown goal celebration for this date
  const [goalCelebratedTypes, setGoalCelebratedTypes] = useState<Set<string>>(
    new Set()
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
    new Set()
  );
  const [isEditingWorkout, setIsEditingWorkout] = useState(false);
  const [selectedRoutineId, setSelectedRoutineId] = useState<string | null>(
    null
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
    [date]
  );

  // Toggle view mode and persist
  const toggleViewMode = useCallback(() => {
    setViewMode((prev) => {
      const newMode = prev === "list" ? "icons" : "list";
      if (typeof window !== "undefined") {
        localStorage.setItem("entryform-viewmode", newMode);
      }
      return newMode;
    });
  }, []);

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
            `expanded-activity-${date}`
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
          handleVisibilityChange
        );
      };
    }
  }, [date]);

  // Load workout state from localStorage when date changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedData = localStorage.getItem(`workout-data-${date}`);
      const savedExpanded = localStorage.getItem(`workout-expanded-${date}`);
      const savedEditing = localStorage.getItem(`workout-editing-${date}`);
      const savedRoutine = localStorage.getItem(`workout-routine-${date}`);

      setWorkoutData(savedData ? JSON.parse(savedData) : {});
      setExpandedExercises(
        savedExpanded ? new Set(JSON.parse(savedExpanded)) : new Set()
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

  // Save workout data to localStorage - only if we've loaded for this date
  useEffect(() => {
    if (typeof window !== "undefined" && loadedDateRef.current === date) {
      const hasActualData = Object.keys(workoutData).some((exerciseName) => {
        const sets = workoutData[exerciseName] || [];
        return sets.some(
          (set) => set.reps || set.weight || set.distance || set.duration
        );
      });

      if (hasActualData) {
        localStorage.setItem(
          `workout-data-${date}`,
          JSON.stringify(workoutData)
        );
      } else {
        localStorage.removeItem(`workout-data-${date}`);
      }
    }
  }, [workoutData, date]);

  // Save expanded exercises to localStorage
  useEffect(() => {
    if (typeof window !== "undefined" && loadedDateRef.current === date) {
      if (expandedExercises.size > 0) {
        localStorage.setItem(
          `workout-expanded-${date}`,
          JSON.stringify([...expandedExercises])
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
    const dateEntries = entries.filter((e) => e.date === date);
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
        if (type.valueType === "text") {
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
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );
    },
    [savedValues]
  );

  // Check if nutrition goal is reached
  const checkNutritionGoalReached = useCallback(
    (
      type: ActivityType,
      totals: { calories: number; protein: number; carbs: number; fat: number }
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
    []
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

      onSuccess?.();
    } catch (error) {
      console.error("Failed to add nutrition entry:", error);
    }
  };

  // Handle saving all workout exercises at once
  const handleSaveAllWorkouts = async (
    typeId: string,
    customExercises: CustomExercise[]
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
          (e) => e.name === exerciseName
        );
        if (!exerciseConfig) continue;

        // Filter sets that have data
        const validSets = sets.filter(
          (set) => set.reps || set.weight || set.distance || set.duration
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
                ...validSets.filter((e) => e.weight).map((e) => e.weight!)
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
          (e) => e.id === existingWorkoutEntry.id
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
    }
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
            String(e.value).toLowerCase() === value.toLowerCase()
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
    typeId?: string
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
    rating?: string
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
              sugg.value.toLowerCase().includes(customValue.toLowerCase())
            )
          : typeSuggestions;
        // Show dropdown when focused and has suggestions (either all or filtered)
        const suggestionsToShow = filteredSuggestions.slice(0, 10);
        const showDropdown =
          showTextDropdown &&
          suggestionsToShow.length > 0 &&
          // Don't show if exact match is typed
          !suggestionsToShow.some(
            (s) => s.value.toLowerCase() === customValue.toLowerCase().trim()
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
                    className='px-4 py-2 rounded-lg bg-ios-blue text-white text-[17px] font-medium'>
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
              onClick={() => handleSaveValue(type.id, "happy")}
              className={cn(
                "flex-1 py-4 rounded-xl active:scale-95 transition-transform flex items-center justify-center",
                "bg-gray-100 dark:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600",
                savedValues[type.id]?.[0]?.value === "happy" &&
                  "ring-2 ring-ios-green bg-ios-green/10 dark:bg-ios-green/20"
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
              onClick={() => handleSaveValue(type.id, "neutral")}
              className={cn(
                "flex-1 py-4 rounded-xl active:scale-95 transition-transform flex items-center justify-center",
                "bg-gray-100 dark:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600",
                savedValues[type.id]?.[0]?.value === "neutral" &&
                  "ring-2 ring-ios-orange bg-ios-orange/10 dark:bg-ios-orange/20"
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
              onClick={() => handleSaveValue(type.id, "sad")}
              className={cn(
                "flex-1 py-4 rounded-xl active:scale-95 transition-transform flex items-center justify-center",
                "bg-gray-100 dark:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600",
                savedValues[type.id]?.[0]?.value === "sad" &&
                  "ring-2 ring-ios-red bg-ios-red/10 dark:bg-ios-red/20"
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
                            : "text-gray-600 dark:text-gray-400"
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
                            : "bg-ios-blue"
                        )}
                        style={{
                          width: `${Math.min(
                            100,
                            (totals.protein / goal.protein) * 100
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
                            : "text-gray-600 dark:text-gray-400"
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
                            : "bg-ios-orange"
                        )}
                        style={{
                          width: `${Math.min(
                            100,
                            (totals.calories / goal.calories) * 100
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
                            : "text-gray-600 dark:text-gray-400"
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
                            : "bg-amber-500"
                        )}
                        style={{
                          width: `${Math.min(
                            100,
                            (totals.carbs / goal.carbs) * 100
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
                            : "text-gray-600 dark:text-gray-400"
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
                            : "bg-purple-500"
                        )}
                        style={{
                          width: `${Math.min(
                            100,
                            (totals.fat / goal.fat) * 100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Today's entries */}
            {typeEntries.length > 0 && (
              <div className='space-y-1'>
                <p className='text-[13px] font-medium text-gray-500'>
                  Today&apos;s entries
                </p>
                {typeEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className='flex items-center justify-between p-2 rounded-lg bg-gray-100 dark:bg-gray-700/50'>
                    <span className='text-[15px] text-gray-900 dark:text-white'>
                      {entry.nutritionData?.foodName || entry.value}
                    </span>
                    <div className='flex items-center gap-3 text-[13px] text-gray-500'>
                      {entry.nutritionData?.protein && (
                        <span>{entry.nutritionData.protein}g P</span>
                      )}
                      {entry.nutritionData?.calories && (
                        <span>{entry.nutritionData.calories} kcal</span>
                      )}
                      <button
                        onClick={() => deleteEntry(entry.id)}
                        className='text-ios-red p-1'>
                        <svg
                          className='w-4 h-4'
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
                  </div>
                ))}
              </div>
            )}

            {/* Add new entry form */}
            <div className='space-y-3'>
              <input
                type='text'
                value={nutritionInput.foodName}
                onChange={(e) =>
                  setNutritionInput({
                    ...nutritionInput,
                    foodName: e.target.value,
                  })
                }
                placeholder='What did you eat?'
                className='w-full px-3 py-2 rounded-lg text-[17px] bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-ios-blue'
                autoFocus
              />
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
                className='w-full py-2.5 rounded-lg text-[17px] font-medium bg-ios-blue text-white disabled:opacity-50 disabled:cursor-not-allowed'>
                Add Food
              </button>
            </div>
          </div>
        );
      }

      case "workout": {
        const typeEntries = savedValues[type.id] || [];
        // Get all saved exercises from workout entries for today
        const savedExercises: WorkoutExercise[] = [];
        typeEntries.forEach((saved) => {
          const entry = entries.find((e) => e.id === saved.id);
          if (entry?.workoutData?.exercises) {
            savedExercises.push(...entry.workoutData.exercises);
          }
        });

        const hasSavedWorkout = savedExercises.length > 0;

        // Use only custom exercises from activity type settings
        const customExercises = type.customExercises || [];

        // Find last used values for an exercise from history (previous days)
        // Checks both saved database entries AND localStorage from recent days
        const getLastUsedValues = (exerciseName: string) => {
          // First check localStorage from previous days (for unsaved/unlocked data)
          if (typeof window !== "undefined") {
            // Check last 30 days of localStorage
            for (let i = 1; i <= 30; i++) {
              const prevDate = new Date(date);
              prevDate.setDate(prevDate.getDate() - i);
              const prevDateStr = prevDate.toISOString().split("T")[0];
              const savedData = localStorage.getItem(
                `workout-data-${prevDateStr}`
              );
              if (savedData) {
                try {
                  const workoutData = JSON.parse(savedData) as Record<
                    string,
                    Array<{
                      reps?: number;
                      weight?: number;
                      distance?: number;
                      duration?: number;
                    }>
                  >;
                  const exerciseData = workoutData[exerciseName];
                  if (exerciseData && exerciseData.length > 0) {
                    // Check if any set has actual data
                    const validSets = exerciseData.filter(
                      (set) =>
                        set.reps || set.weight || set.distance || set.duration
                    );
                    if (validSets.length > 0) {
                      return {
                        sets: validSets.length,
                        reps: validSets[0].reps,
                        weight: validSets[0].weight,
                        distance: validSets[0].distance,
                        duration: validSets[0].duration,
                        setsData: validSets,
                      };
                    }
                  }
                } catch (e) {
                  // Invalid JSON, skip
                }
              }
            }
          }

          // Fall back to saved database entries
          const sortedEntries = [...workoutHistoryEntries].sort((a, b) =>
            b.date.localeCompare(a.date)
          );

          for (const entry of sortedEntries) {
            if (entry.workoutData?.exercises) {
              const found = entry.workoutData.exercises.find(
                (ex) => ex.name.toLowerCase() === exerciseName.toLowerCase()
              );
              if (found) {
                return {
                  sets: found.sets || 1,
                  reps: found.reps,
                  weight: found.weight,
                  distance: found.distance,
                  duration: found.duration,
                  setsData: found.setsData,
                };
              }
            }
          }
          return { sets: 1 };
        };

        // Get placeholder values for an exercise set (from last used data)
        const getPlaceholderForSet = (
          exerciseName: string,
          setIndex: number
        ) => {
          const lastUsed = getLastUsedValues(exerciseName);
          if (lastUsed.setsData && lastUsed.setsData.length > setIndex) {
            return lastUsed.setsData[setIndex];
          } else if (lastUsed.setsData && lastUsed.setsData.length > 0) {
            // Use last set's data for additional sets
            return lastUsed.setsData[lastUsed.setsData.length - 1];
          }
          return {
            reps: lastUsed.reps,
            weight: lastUsed.weight,
            distance: lastUsed.distance,
            duration: lastUsed.duration,
          };
        };

        // Toggle exercise expansion - no auto-save, only saves when day is locked
        const toggleExercise = async (exerciseName: string) => {
          const newExpanded = new Set(expandedExercises);
          if (newExpanded.has(exerciseName)) {
            // Just collapse, don't save - save happens when locking day
            newExpanded.delete(exerciseName);
            setExpandedExercises(newExpanded);
          } else {
            newExpanded.add(exerciseName);
            // Initialize with empty sets if not already set (show placeholders instead of values)
            if (!workoutData[exerciseName]) {
              // Start with one empty set
              setWorkoutData((prev) => ({
                ...prev,
                [exerciseName]: [{}],
              }));
            }
            setExpandedExercises(newExpanded);
          }
        };

        // Update a specific set's data for an exercise
        const updateExerciseSet = (
          exerciseName: string,
          index: number,
          field: string,
          value: number | undefined
        ) => {
          const sets = [...(workoutData[exerciseName] || [{}])];
          sets[index] = { ...sets[index], [field]: value };
          setWorkoutData((prev) => ({ ...prev, [exerciseName]: sets }));
        };

        // Add a new set to an exercise (empty, with placeholders)
        const addExerciseSet = (exerciseName: string) => {
          const sets = workoutData[exerciseName] || [{}];
          // Add empty set - placeholder will show previous values
          setWorkoutData((prev) => ({
            ...prev,
            [exerciseName]: [...sets, {}],
          }));
        };

        // Remove a set from an exercise
        const removeExerciseSet = (exerciseName: string, index: number) => {
          const sets = workoutData[exerciseName] || [];
          if (sets.length > 1) {
            setWorkoutData((prev) => ({
              ...prev,
              [exerciseName]: sets.filter((_, i) => i !== index),
            }));
          }
        };

        // Check if exercise has data entered
        const exerciseHasData = (exerciseName: string) => {
          const sets = workoutData[exerciseName] || [];
          return sets.some(
            (set) => set.reps || set.weight || set.distance || set.duration
          );
        };

        // Get saved data for an exercise
        const getSavedExercise = (exerciseName: string) => {
          return savedExercises.find((ex) => ex.name === exerciseName);
        };

        // Start editing - load saved data into state
        const startEditing = () => {
          const newWorkoutData: typeof workoutData = {};
          savedExercises.forEach((ex) => {
            // Use stored setsData if available, otherwise recreate from aggregated values
            if (ex.setsData && ex.setsData.length > 0) {
              newWorkoutData[ex.name] = ex.setsData;
            } else {
              const numSets = ex.sets || 1;
              newWorkoutData[ex.name] = Array.from({ length: numSets }, () => ({
                reps: ex.reps,
                weight: ex.weight,
                distance: ex.distance,
                duration: ex.duration,
              }));
            }
          });
          setWorkoutData(newWorkoutData);
          setExpandedExercises(new Set(savedExercises.map((ex) => ex.name)));
          setIsEditingWorkout(true);
        };

        // Check if any exercise has data
        const hasAnyData = Object.keys(workoutData).some((name) =>
          exerciseHasData(name)
        );

        // Show saved view or editing view
        if (hasSavedWorkout && !isEditingWorkout) {
          return (
            <div className='pt-3 space-y-3'>
              <div className='flex items-center justify-between mb-2'>
                <p className='text-[13px] font-medium text-gray-500'>
                  Today&apos;s workout ({savedExercises.length} exercise
                  {savedExercises.length !== 1 ? "s" : ""})
                </p>
                <button
                  onClick={startEditing}
                  className='text-[15px] text-ios-blue font-medium'>
                  Edit
                </button>
              </div>

              {/* iOS-style grouped list */}
              <div className='rounded-xl overflow-hidden bg-white dark:bg-gray-800'>
                {savedExercises.map((exercise, exIndex) => {
                  const config = customExercises.find(
                    (e) => e.name === exercise.name
                  );
                  const setsToShow =
                    exercise.setsData ||
                    (exercise.sets
                      ? Array.from({ length: exercise.sets }, () => ({
                          reps: exercise.reps,
                          weight: exercise.weight,
                          distance: exercise.distance,
                          duration: exercise.duration,
                        }))
                      : [
                          {
                            reps: exercise.reps,
                            weight: exercise.weight,
                            distance: exercise.distance,
                            duration: exercise.duration,
                          },
                        ]);

                  return (
                    <div key={exercise.id}>
                      {/* Exercise name header */}
                      <div
                        className={cn(
                          "px-4 py-2.5 bg-gray-100 dark:bg-gray-700",
                          exIndex > 0 &&
                            "border-t border-gray-200 dark:border-gray-600"
                        )}>
                        <span className='text-[15px] font-semibold text-gray-900 dark:text-white'>
                          {exercise.name}
                        </span>
                      </div>

                      {/* Individual sets */}
                      <div className='divide-y divide-gray-100 dark:divide-gray-700'>
                        {setsToShow.map((set, setIndex) => (
                          <div
                            key={setIndex}
                            className='px-4 py-2.5 flex items-center justify-between'>
                            <span className='text-[14px] text-gray-500 w-16'>
                              Set {setIndex + 1}
                            </span>
                            <div className='flex items-center gap-4'>
                              {set.reps && (
                                <div className='flex items-center gap-1'>
                                  <span className='text-[15px] font-medium text-gray-900 dark:text-white'>
                                    {set.reps}
                                  </span>
                                  <span className='text-[13px] text-gray-500'>
                                    reps
                                  </span>
                                </div>
                              )}
                              {set.weight && (
                                <div className='flex items-center gap-1'>
                                  <span className='text-[15px] font-medium text-ios-blue'>
                                    {set.weight}
                                  </span>
                                  <span className='text-[13px] text-gray-500'>
                                    kg
                                  </span>
                                </div>
                              )}
                              {set.distance && (
                                <div className='flex items-center gap-1'>
                                  <span className='text-[15px] font-medium text-ios-orange'>
                                    {set.distance}
                                  </span>
                                  <span className='text-[13px] text-gray-500'>
                                    km
                                  </span>
                                </div>
                              )}
                              {set.duration && (
                                <div className='flex items-center gap-1'>
                                  <span className='text-[15px] font-medium text-purple-500'>
                                    {set.duration}
                                  </span>
                                  <span className='text-[13px] text-gray-500'>
                                    min
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        }

        // Editing/Adding view - show all exercises
        // Get available routines
        const routines = type.workoutRoutines || [];

        // Filter exercises based on selected routine
        const exercisesToShow = selectedRoutineId
          ? customExercises.filter((ex) => {
              const routine = routines.find((r) => r.id === selectedRoutineId);
              return routine?.exerciseNames.includes(ex.name);
            })
          : customExercises;

        // Get all available exercises (custom + built-in) for routine creation
        const getAllExercisesForRoutine = () => {
          return customExercises;
        };

        // Toggle exercise in new routine
        const toggleExerciseInNewRoutine = (exerciseName: string) => {
          if (newRoutineExercises.includes(exerciseName)) {
            setNewRoutineExercises(
              newRoutineExercises.filter((n) => n !== exerciseName)
            );
          } else {
            setNewRoutineExercises([...newRoutineExercises, exerciseName]);
          }
        };

        // Handle adding/updating routine
        const handleSaveRoutine = async () => {
          if (!newRoutineName.trim() || newRoutineExercises.length === 0)
            return;

          const colorIndex = routines.length % ROUTINE_COLORS.length;
          const newRoutine: WorkoutRoutine = {
            id: editingRoutineId || Date.now().toString(),
            name: newRoutineName.trim(),
            exerciseNames: newRoutineExercises,
            color: editingRoutineId
              ? routines.find((r) => r.id === editingRoutineId)?.color ||
                ROUTINE_COLORS[colorIndex]
              : ROUTINE_COLORS[colorIndex],
          };

          let updatedRoutines: WorkoutRoutine[];
          if (editingRoutineId) {
            updatedRoutines = routines.map((r) =>
              r.id === editingRoutineId ? newRoutine : r
            );
          } else {
            updatedRoutines = [...routines, newRoutine];
          }

          await updateActivityType({
            ...type,
            workoutRoutines: updatedRoutines,
          });

          setNewRoutineName("");
          setNewRoutineExercises([]);
          setShowAddRoutine(false);
          setEditingRoutineId(null);
        };

        // Handle editing routine
        const startEditRoutine = (routine: WorkoutRoutine) => {
          setEditingRoutineId(routine.id);
          setNewRoutineName(routine.name);
          setNewRoutineExercises([...routine.exerciseNames]);
          setShowAddRoutine(true);
        };

        // Handle deleting routine
        const handleDeleteRoutine = async (routineId: string) => {
          const updatedRoutines = routines.filter((r) => r.id !== routineId);
          await updateActivityType({
            ...type,
            workoutRoutines: updatedRoutines,
          });
          if (selectedRoutineId === routineId) {
            setSelectedRoutineId(null);
          }
        };

        return (
          <div className='pt-3 space-y-2'>
            {/* Routine selector */}
            <div className='mb-3'>
              <p className='text-[12px] text-gray-500 mb-2'>Select routine:</p>
              <div className='flex flex-wrap gap-2'>
                <button
                  onClick={() => setSelectedRoutineId(null)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-[14px] font-medium transition-colors",
                    selectedRoutineId === null
                      ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                  )}>
                  All
                </button>
                {routines.map((routine) => (
                  <button
                    key={routine.id}
                    onClick={() => setSelectedRoutineId(routine.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      startEditRoutine(routine);
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-[14px] font-medium transition-colors flex items-center gap-1.5",
                      selectedRoutineId === routine.id
                        ? "text-white"
                        : "bg-gray-100 dark:bg-gray-700"
                    )}
                    style={{
                      backgroundColor:
                        selectedRoutineId === routine.id
                          ? routine.color
                          : undefined,
                      color:
                        selectedRoutineId === routine.id
                          ? "white"
                          : routine.color,
                    }}>
                    <span
                      className='w-2 h-2 rounded-full'
                      style={{ backgroundColor: routine.color }}
                    />
                    {routine.name}
                  </button>
                ))}
                <button
                  onClick={() => {
                    setShowAddRoutine(!showAddRoutine);
                    setEditingRoutineId(null);
                    setNewRoutineName("");
                    setNewRoutineExercises([]);
                  }}
                  className='px-3 py-1.5 rounded-full text-[14px] font-medium text-ios-blue bg-ios-blue/10 transition-colors'>
                  + Add
                </button>
              </div>
            </div>

            {/* Add/Edit Routine Modal */}
            {showAddRoutine && (
              <div className='p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-3'>
                <div className='flex items-center justify-between'>
                  <span className='text-[15px] font-semibold text-gray-900 dark:text-white'>
                    {editingRoutineId ? "Edit Routine" : "New Routine"}
                  </span>
                  {editingRoutineId && (
                    <button
                      onClick={() => handleDeleteRoutine(editingRoutineId)}
                      className='text-[13px] text-ios-red font-medium'>
                      Delete
                    </button>
                  )}
                </div>
                <input
                  type='text'
                  value={newRoutineName}
                  onChange={(e) => setNewRoutineName(e.target.value)}
                  placeholder='Routine name (e.g., Push Day)'
                  className='w-full px-3 py-2.5 rounded-lg text-[15px] bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-ios-blue'
                />
                <div>
                  <label className='text-[13px] text-gray-500 mb-2 block'>
                    Select exercises:
                  </label>
                  <div className='max-h-48 overflow-auto space-y-1 rounded-lg bg-gray-50 dark:bg-gray-700/50 p-2'>
                    {getAllExercisesForRoutine().map((exercise) => (
                      <button
                        key={exercise.name}
                        type='button'
                        onClick={() =>
                          toggleExerciseInNewRoutine(exercise.name)
                        }
                        className={cn(
                          "w-full px-3 py-2 rounded-lg text-left text-[14px] flex items-center justify-between transition-colors",
                          newRoutineExercises.includes(exercise.name)
                            ? "bg-ios-blue/10 text-ios-blue"
                            : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                        )}>
                        <span>{exercise.name}</span>
                        {newRoutineExercises.includes(exercise.name) && (
                          <svg
                            className='w-5 h-5'
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
                        )}
                      </button>
                    ))}
                  </div>
                  {newRoutineExercises.length > 0 && (
                    <p className='text-[12px] text-ios-blue mt-2'>
                      {newRoutineExercises.length} exercise
                      {newRoutineExercises.length !== 1 ? "s" : ""} selected
                    </p>
                  )}
                </div>
                <div className='flex gap-2'>
                  <button
                    onClick={handleSaveRoutine}
                    disabled={
                      !newRoutineName.trim() || newRoutineExercises.length === 0
                    }
                    className='flex-1 py-2.5 rounded-lg text-[15px] font-medium bg-ios-blue text-white disabled:opacity-50'>
                    {editingRoutineId ? "Update" : "Add"}
                  </button>
                  <button
                    onClick={() => {
                      setShowAddRoutine(false);
                      setEditingRoutineId(null);
                      setNewRoutineName("");
                      setNewRoutineExercises([]);
                    }}
                    className='flex-1 py-2.5 rounded-lg text-[15px] font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {customExercises.length === 0 ? (
              <div className='py-4 text-center text-gray-500'>
                <p className='text-[14px]'>No exercises configured</p>
                <p className='text-[12px] mt-1'>Add exercises in Settings</p>
              </div>
            ) : exercisesToShow.length === 0 ? (
              <div className='py-4 text-center text-gray-500'>
                <p className='text-[14px]'>No exercises in this routine</p>
                <p className='text-[12px] mt-1'>
                  Select a different routine or edit in Settings
                </p>
              </div>
            ) : (
              <>
                {/* List all exercises with expandable sections */}
                {exercisesToShow.map((ex) => {
                  const isExpanded = expandedExercises.has(ex.name);
                  const sets = workoutData[ex.name] || [{}];
                  const hasData = exerciseHasData(ex.name);
                  const savedEx = getSavedExercise(ex.name);

                  return (
                    <div
                      key={ex.name}
                      className={cn(
                        "rounded-xl overflow-hidden",
                        isExpanded
                          ? "bg-gray-50 dark:bg-gray-800"
                          : "bg-white dark:bg-gray-800"
                      )}>
                      {/* Exercise header - tap to expand */}
                      <button
                        onClick={() => toggleExercise(ex.name)}
                        className={cn(
                          "w-full px-4 py-3 flex items-center justify-between",
                          isExpanded && "bg-gray-100 dark:bg-gray-700"
                        )}>
                        <div className='flex items-center gap-2'>
                          <span
                            className={cn(
                              "text-[15px] font-medium",
                              hasData || savedEx
                                ? "text-ios-green"
                                : "text-gray-900 dark:text-white"
                            )}>
                            {ex.name}
                          </span>
                          {(hasData || savedEx) && (
                            <svg
                              className='w-4 h-4 text-ios-green'
                              fill='currentColor'
                              viewBox='0 0 20 20'>
                              <path
                                fillRule='evenodd'
                                d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
                                clipRule='evenodd'
                              />
                            </svg>
                          )}
                        </div>
                        <svg
                          className={cn(
                            "w-5 h-5 text-gray-400 transition-transform",
                            isExpanded && "rotate-180"
                          )}
                          fill='none'
                          viewBox='0 0 24 24'
                          stroke='currentColor'>
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth={2}
                            d='M19 9l-7 7-7-7'
                          />
                        </svg>
                      </button>

                      {/* Expanded content - sets input */}
                      {isExpanded && (
                        <div className='px-4 pb-3 space-y-2 border-t border-gray-100 dark:border-gray-700'>
                          <div className='flex items-center justify-between pt-2'>
                            <span className='text-[13px] text-gray-500'>
                              Sets ({sets.length})
                            </span>
                          </div>

                          {sets.map((set, index) => {
                            const placeholder = getPlaceholderForSet(
                              ex.name,
                              index
                            );
                            return (
                              <div
                                key={index}
                                className='flex items-center gap-3 py-2'>
                                {/* Set number */}
                                <span className='text-[15px] font-semibold text-gray-500 w-6 text-center'>
                                  {index + 1}
                                </span>

                                {/* Input fields */}
                                <div className='flex-1 flex items-center gap-2'>
                                  {ex.trackReps && (
                                    <div className='flex-1 flex items-center gap-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2'>
                                      <input
                                        type='number'
                                        value={set.reps || ""}
                                        onChange={(e) =>
                                          updateExerciseSet(
                                            ex.name,
                                            index,
                                            "reps",
                                            e.target.value
                                              ? parseInt(e.target.value)
                                              : undefined
                                          )
                                        }
                                        onFocus={(e) => e.target.select()}
                                        placeholder={
                                          placeholder.reps?.toString() || "0"
                                        }
                                        className='w-full text-[16px] font-medium bg-transparent text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none text-right'
                                      />
                                      <span className='text-[13px] text-gray-500'>
                                        reps
                                      </span>
                                    </div>
                                  )}
                                  {ex.trackWeight && (
                                    <div className='flex-1 flex items-center gap-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2'>
                                      <input
                                        type='number'
                                        value={set.weight || ""}
                                        onChange={(e) =>
                                          updateExerciseSet(
                                            ex.name,
                                            index,
                                            "weight",
                                            e.target.value
                                              ? parseFloat(e.target.value)
                                              : undefined
                                          )
                                        }
                                        onFocus={(e) => e.target.select()}
                                        placeholder={
                                          placeholder.weight?.toString() || "0"
                                        }
                                        step='0.5'
                                        className='w-full text-[16px] font-medium bg-transparent text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none text-right'
                                      />
                                      <span className='text-[13px] text-gray-500'>
                                        kg
                                      </span>
                                    </div>
                                  )}
                                  {ex.trackDistance && (
                                    <div className='flex-1 flex items-center gap-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2'>
                                      <input
                                        type='number'
                                        value={set.distance || ""}
                                        onChange={(e) =>
                                          updateExerciseSet(
                                            ex.name,
                                            index,
                                            "distance",
                                            e.target.value
                                              ? parseFloat(e.target.value)
                                              : undefined
                                          )
                                        }
                                        onFocus={(e) => e.target.select()}
                                        placeholder={
                                          placeholder.distance?.toString() ||
                                          "0"
                                        }
                                        step='0.1'
                                        className='w-full text-[16px] font-medium bg-transparent text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none text-right'
                                      />
                                      <span className='text-[13px] text-gray-500'>
                                        km
                                      </span>
                                    </div>
                                  )}
                                  {ex.trackDuration && (
                                    <div className='flex-1 flex items-center gap-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2'>
                                      <input
                                        type='number'
                                        value={set.duration || ""}
                                        onChange={(e) =>
                                          updateExerciseSet(
                                            ex.name,
                                            index,
                                            "duration",
                                            e.target.value
                                              ? parseInt(e.target.value)
                                              : undefined
                                          )
                                        }
                                        onFocus={(e) => e.target.select()}
                                        placeholder={
                                          placeholder.duration?.toString() ||
                                          "0"
                                        }
                                        className='w-full text-[16px] font-medium bg-transparent text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none text-right'
                                      />
                                      <span className='text-[13px] text-gray-500'>
                                        min
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {/* Delete button */}
                                {sets.length > 1 ? (
                                  <button
                                    onClick={() =>
                                      removeExerciseSet(ex.name, index)
                                    }
                                    className='p-2 ml-2'>
                                    <svg
                                      className='w-5 h-5 text-ios-red'
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
                                ) : (
                                  <div className='w-9' />
                                )}
                              </div>
                            );
                          })}

                          {/* Add Set Button */}
                          <button
                            onClick={() => addExerciseSet(ex.name)}
                            className='w-full py-2.5 mt-2 rounded-lg text-[15px] font-medium text-ios-blue bg-ios-blue/10 active:bg-ios-blue/20'>
                            + Add Set
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Edit mode controls */}
                {isEditingWorkout && (
                  <div className='pt-2 flex gap-2'>
                    <button
                      onClick={() => {
                        setWorkoutData({});
                        setExpandedExercises(new Set());
                        setIsEditingWorkout(false);
                      }}
                      className='flex-1 py-2 rounded-lg text-[15px] font-medium bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'>
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDeleteWorkout(type.id)}
                      className='flex-1 py-2 rounded-lg text-[15px] font-medium bg-ios-red/10 text-ios-red'>
                      Delete Workout
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        );
      }
    }
  };

  return (
    <>
      {/* View Mode Toggle */}
      <div className='flex justify-end mb-2'>
        <button
          onClick={toggleViewMode}
          className='p-2 rounded-lg bg-gray-100 dark:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700'
          title={viewMode === "list" ? "Switch to icons" : "Switch to list"}
        >
          {viewMode === "list" ? (
            <svg className='w-5 h-5 text-gray-600 dark:text-gray-400' fill='none' viewBox='0 0 24 24' strokeWidth={1.5} stroke='currentColor'>
              <path strokeLinecap='round' strokeLinejoin='round' d='M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z' />
            </svg>
          ) : (
            <svg className='w-5 h-5 text-gray-600 dark:text-gray-400' fill='none' viewBox='0 0 24 24' strokeWidth={1.5} stroke='currentColor'>
              <path strokeLinecap='round' strokeLinejoin='round' d='M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z' />
            </svg>
          )}
        </button>
      </div>

      {/* Icon Grid View */}
      {viewMode === "icons" && (
        <div className='bg-white/80 dark:bg-ios-card-dark rounded-xl p-3'>
          <div className='grid grid-cols-5 gap-2'>
            {activityTypes.map((type) => {
              const typeSavedValues = savedValues[type.id] || [];
              const hasSavedValues = typeSavedValues.length > 0;
              const isCheckmark = type.valueType === "checkmark";
              const isWorkout = type.valueType === "workout";
              
              // Check if workout has any data being entered
              const workoutHasEnteredData =
                isWorkout &&
                Object.keys(workoutData).some((exerciseName) => {
                  const sets = workoutData[exerciseName] || [];
                  return sets.some(
                    (set) => set.reps || set.weight || set.distance || set.duration
                  );
                });

              const hasValue = hasSavedValues || workoutHasEnteredData;
              const isSkipped = isCheckmark && typeSavedValues[0]?.value === "skipped";

              return (
                <button
                  key={type.id}
                  onClick={() => {
                    setViewMode("list");
                    if (typeof window !== "undefined") {
                      localStorage.setItem("entryform-viewmode", "list");
                    }
                    setExpandedTypeId(type.id);
                  }}
                  className={cn(
                    "aspect-square rounded-xl flex flex-col items-center justify-center gap-1 transition-all active:scale-95",
                    hasValue && !isSkipped
                      ? "bg-ios-green/10 dark:bg-ios-green/20"
                      : isSkipped
                      ? "bg-ios-red/10 dark:bg-ios-red/20"
                      : "bg-gray-100 dark:bg-gray-800"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 flex items-center justify-center",
                    hasValue && !isSkipped
                      ? "text-ios-green"
                      : isSkipped
                      ? "text-ios-red"
                      : "text-ios-blue"
                  )}>
                    {type.icon in icons ? (
                      <Icon name={type.icon as IconName} className='w-7 h-7' />
                    ) : (
                      <span className='text-2xl'>{type.icon}</span>
                    )}
                  </div>
                  {hasValue && !isSkipped && (
                    <div className='w-1.5 h-1.5 rounded-full bg-ios-green' />
                  )}
                  {isSkipped && (
                    <div className='w-1.5 h-1.5 rounded-full bg-ios-red' />
                  )}
                </button>
              );
            })}
          </div>
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
                (set) => set.reps || set.weight || set.distance || set.duration
              );
            });

          // Count exercises with entered data
          const workoutEnteredExerciseCount = isWorkout
            ? Object.keys(workoutData).filter((exerciseName) => {
                const sets = workoutData[exerciseName] || [];
                return sets.some(
                  (set) =>
                    set.reps || set.weight || set.distance || set.duration
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
                  "flex items-center min-h-[40px] px-4 active:bg-gray-100 dark:active:bg-gray-700 cursor-pointer",
                  isExpanded && "bg-gray-50 dark:bg-gray-800",
                  isLocked && "pointer-events-none opacity-75"
                )}
                onClick={handleRowClick}>
                {/* Icon */}
                {type.icon && (
                  <div
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center mr-3 shrink-0",
                      isLocked
                        ? "bg-ios-green/10"
                        : hasSavedValues || workoutHasEnteredData
                        ? "bg-ios-green/10"
                        : "bg-ios-blue/10"
                    )}>
                    {type.icon in icons ? (
                      <Icon
                        name={type.icon as IconName}
                        className={cn(
                          "w-5 h-5",
                          isLocked
                            ? "text-ios-green"
                            : hasSavedValues || workoutHasEnteredData
                            ? "text-ios-green"
                            : "text-ios-blue"
                        )}
                      />
                    ) : (
                      <span className='text-lg'>{type.icon}</span>
                    )}
                  </div>
                )}

                {/* Content and right-aligned controls */}
                <div
                  className={cn(
                    "flex-1 py-2 flex items-center",
                    !isLast &&
                      !isExpanded &&
                      "border-b border-gray-200/80 dark:border-gray-700/80"
                  )}>
                  {/* Main label and inline text value */}
                  <div className='flex-1 min-w-0 flex items-center gap-2'>
                    <span className='text-[17px] font-medium text-gray-900 dark:text-white shrink-0'>
                      {type.name}
                    </span>
                    {/* Only show inline value for text type */}
                    {hasSavedValues &&
                      !isExpanded &&
                      type.valueType === "text" && (
                        <span className='text-[15px] text-gray-400 dark:text-gray-500 truncate'>
                          {typeSavedValues.map((saved, i) => (
                            <span key={saved.id}>
                              {formatValue(saved.value, type.id)}
                              {i < typeSavedValues.length - 1 && ", "}
                            </span>
                          ))}
                        </span>
                      )}
                  </div>

                  {/* Right-aligned value type controls (except text) */}
                  {(isCheckmark ||
                    isMood ||
                    isCounter ||
                    isNutrition ||
                    isWorkout ||
                    type.valueType === "boolean") && (
                    <div className='flex items-center gap-2 ml-auto shrink-0'>
                      {/* Workout summary - show for saved data or entered data */}
                      {isWorkout &&
                        (hasSavedValues || workoutHasEnteredData) &&
                        (() => {
                          // Count total exercises for today (saved)
                          let totalSavedExercises = 0;
                          typeSavedValues.forEach((saved) => {
                            const entry = entries.find(
                              (e) => e.id === saved.id
                            );
                            if (entry?.workoutData?.exercises) {
                              totalSavedExercises +=
                                entry.workoutData.exercises.length;
                            }
                          });
                          // Use entered count if no saved data, or saved count if data is saved
                          const displayCount = hasSavedValues
                            ? totalSavedExercises
                            : workoutEnteredExerciseCount;
                          const isSaved =
                            hasSavedValues && totalSavedExercises > 0;
                          return (
                            <span className='text-[15px] font-medium text-ios-green'>
                              {displayCount} exercise
                              {displayCount !== 1 ? "s" : ""}
                              {isSaved ? " ✓" : ""}
                            </span>
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
                            <span
                              className={cn(
                                "text-[15px] font-medium",
                                isGoalReached
                                  ? "text-ios-green"
                                  : "text-gray-500 dark:text-gray-400"
                              )}>
                              {primaryGoal === "protein" && goalValue ? (
                                <>
                                  {totals.protein}g / {goal.protein}g{" "}
                                  {isGoalReached && "✓"}
                                </>
                              ) : primaryGoal === "calories" && goalValue ? (
                                <>
                                  {totals.calories} / {goal.calories} kcal{" "}
                                  {isGoalReached && "✓"}
                                </>
                              ) : hasEntries ? (
                                <>
                                  {typeSavedValues.length} item
                                  {typeSavedValues.length !== 1 ? "s" : ""}
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
                              currentCounterValue === 0 && "opacity-30"
                            )}>
                            −
                          </button>
                          <span
                            className={cn(
                              "w-7 text-center text-[17px] font-semibold tabular-nums",
                              currentCounterValue > 0
                                ? "text-ios-green"
                                : "text-gray-400 dark:text-gray-500"
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
                              "active:bg-ios-blue/10 active:scale-95 transition-transform"
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
                              : "text-ios-red"
                          )}>
                          {typeSavedValues[0].value ? "✓" : "✗"}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Expanded content - not for checkmark or counter types */}
              {isExpanded && !isCheckmark && !isCounter && (
                <div
                  className={cn(
                    "px-4 pb-4 pt-2 bg-gray-50 dark:bg-gray-800/50",
                    !isLast &&
                      "border-b border-gray-200/80 dark:border-gray-700/80"
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
              isLocking && "opacity-70 cursor-not-allowed"
            )}>
            {/* Lock icon with animation */}
            <div
              className={cn(
                "transition-transform duration-500",
                isLocked && "animate-bounce-once"
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
