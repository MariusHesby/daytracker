"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { cn, toDateStr } from "@/lib/utils";
import {
  ActivityType,
  LogEntry,
  CustomExercise,
  WorkoutExercise,
  WorkoutRoutine,
  COMMON_EXERCISES,
  ROUTINE_COLORS,
} from "@/types";
import {
  WgerExercise,
  searchExercises,
  fetchExercisesByCategory,
  getExerciseName,
  getExerciseImage,
  getExerciseMuscles,
  WGER_CATEGORY_MAP,
  CATEGORY_ICONS,
  CATEGORY_COLORS,
  preloadPopularExercises,
} from "@/lib/wger";
import { Icon, icons, IconName } from "@/components/Icons";

// Category data for the grid
const CATEGORIES = [
  { id: 11, name: "Chest", icon: "🫁", color: "from-cyan-400 to-cyan-600" },
  { id: 12, name: "Back", icon: "🔙", color: "from-green-400 to-green-600" },
  { id: 13, name: "Shoulders", icon: "🏋️", color: "from-yellow-400 to-yellow-600" },
  { id: 8, name: "Arms", icon: "💪", color: "from-blue-400 to-blue-600" },
  { id: 9, name: "Legs", icon: "🦿", color: "from-pink-400 to-pink-600" },
  { id: 10, name: "Abs", icon: "🎯", color: "from-orange-400 to-orange-600" },
  { id: 15, name: "Cardio", icon: "❤️", color: "from-red-400 to-red-600" },
  { id: 14, name: "Calves", icon: "🦵", color: "from-purple-400 to-purple-600" },
];

export default function WorkoutPage() {
  const { activityTypes, entries, addEntry, updateEntry, updateActivityType } = useApp();
  const { user } = useAuth();
  const { t } = useLanguage();

  // Current date for logging
  const [selectedDate, setSelectedDate] = useState(() => toDateStr(new Date()));

  // UI State
  const [activeView, setActiveView] = useState<"workout" | "browse" | "search">("workout");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<WgerExercise[]>([]);
  const [categoryExercises, setCategoryExercises] = useState<WgerExercise[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingCategory, setIsLoadingCategory] = useState(false);

  // Workout state
  const [workoutData, setWorkoutData] = useState<
    Record<string, Array<{ reps?: number; weight?: number; distance?: number; duration?: number }>>
  >({});
  const [expandedExercises, setExpandedExercises] = useState<Set<string>>(new Set());
  const [selectedRoutineId, setSelectedRoutineId] = useState<string | null>(null);

  // Get workout activity type
  const workoutType = useMemo(
    () => activityTypes.find((t) => t.valueType === "workout"),
    [activityTypes]
  );

  // Get exercises for current workout type
  const allExercises = useMemo(() => {
    if (!workoutType) return COMMON_EXERCISES;
    const custom = workoutType.customExercises || [];
    // Combine and deduplicate
    const combined = [...COMMON_EXERCISES];
    custom.forEach((c) => {
      if (!combined.find((e) => e.name.toLowerCase() === c.name.toLowerCase())) {
        combined.push(c);
      }
    });
    return combined;
  }, [workoutType]);

  // Get routines
  const routines = workoutType?.workoutRoutines || [];

  // Get exercises for selected routine
  const routineExercises = useMemo(() => {
    if (!selectedRoutineId) return allExercises;
    const routine = routines.find((r) => r.id === selectedRoutineId);
    if (!routine) return allExercises;
    return allExercises.filter((e) =>
      routine.exerciseNames.some((n) => n.toLowerCase() === e.name.toLowerCase())
    );
  }, [selectedRoutineId, routines, allExercises]);

  // Today's saved workout data
  const savedWorkoutEntry = useMemo(() => {
    if (!workoutType) return null;
    return entries.find(
      (e) => e.date === selectedDate && e.activityTypeId === workoutType.id && e.workoutData
    );
  }, [entries, workoutType, selectedDate]);

  const savedExercises = savedWorkoutEntry?.workoutData?.exercises || [];

  // Load saved data into state on mount
  useEffect(() => {
    if (savedExercises.length > 0) {
      const newData: typeof workoutData = {};
      savedExercises.forEach((ex) => {
        if (ex.setsData && ex.setsData.length > 0) {
          newData[ex.name] = ex.setsData;
        } else {
          const numSets = ex.sets || 1;
          newData[ex.name] = Array.from({ length: numSets }, () => ({
            reps: ex.reps,
            weight: ex.weight,
            distance: ex.distance,
            duration: ex.duration,
          }));
        }
      });
      setWorkoutData(newData);
      setExpandedExercises(new Set(savedExercises.map((ex) => ex.name)));
    }
  }, [savedWorkoutEntry?.id]);

  // Search handler with debounce
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(async () => {
      const results = await searchExercises(searchQuery, 30);
      setSearchResults(results);
      setIsSearching(false);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  // Load category exercises
  useEffect(() => {
    if (selectedCategory === null) return;
    setIsLoadingCategory(true);
    fetchExercisesByCategory(selectedCategory, 100).then((exercises) => {
      setCategoryExercises(exercises);
      setIsLoadingCategory(false);
    });
  }, [selectedCategory]);

  // Toggle exercise expansion
  const toggleExercise = (name: string) => {
    setExpandedExercises((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(name)) {
        newSet.delete(name);
      } else {
        newSet.add(name);
        // Initialize with one empty set if not already
        if (!workoutData[name]) {
          setWorkoutData((prev) => ({ ...prev, [name]: [{}] }));
        }
      }
      return newSet;
    });
  };

  // Update exercise set data
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

  // Add a set to an exercise
  const addSet = (exerciseName: string) => {
    const sets = workoutData[exerciseName] || [{}];
    setWorkoutData((prev) => ({ ...prev, [exerciseName]: [...sets, {}] }));
  };

  // Remove a set from an exercise
  const removeSet = (exerciseName: string, index: number) => {
    const sets = workoutData[exerciseName] || [];
    if (sets.length > 1) {
      setWorkoutData((prev) => ({
        ...prev,
        [exerciseName]: sets.filter((_, i) => i !== index),
      }));
    }
  };

  // Check if exercise has data
  const exerciseHasData = (name: string) => {
    const sets = workoutData[name] || [];
    return sets.some((s) => s.reps || s.weight || s.distance || s.duration);
  };

  // Get exercise config (from COMMON or custom)
  const getExerciseConfig = (name: string) => {
    const common = COMMON_EXERCISES.find(
      (e) => e.name.toLowerCase() === name.toLowerCase()
    );
    if (common) return common;
    const custom = workoutType?.customExercises?.find(
      (e) => e.name.toLowerCase() === name.toLowerCase()
    );
    if (custom) return custom;
    // Default config
    return { name, category: "strength" as const, trackWeight: true, trackReps: true };
  };

  // Add exercise from API to custom exercises
  const addExerciseFromApi = async (wgerExercise: WgerExercise) => {
    if (!workoutType) return;

    const name = getExerciseName(wgerExercise);
    const muscles = getExerciseMuscles(wgerExercise);
    const imageUrl = getExerciseImage(wgerExercise);
    const categoryName = wgerExercise.category.name.toLowerCase();

    // Determine tracking options based on category
    const isCardio = categoryName === "cardio";
    const newExercise: CustomExercise = {
      name,
      category: isCardio ? "cardio" : "strength",
      trackWeight: !isCardio,
      trackReps: !isCardio,
      trackDistance: isCardio,
      trackDuration: isCardio,
      wgerId: wgerExercise.id,
      imageUrl: imageUrl || undefined,
      muscles,
    };

    // Check if already exists
    const exists =
      COMMON_EXERCISES.some((e) => e.name.toLowerCase() === name.toLowerCase()) ||
      workoutType.customExercises?.some((e) => e.name.toLowerCase() === name.toLowerCase());

    if (!exists) {
      await updateActivityType({
        ...workoutType,
        customExercises: [...(workoutType.customExercises || []), newExercise],
      });
    }

    // Expand the exercise and switch to workout view
    setExpandedExercises((prev) => new Set([...prev, name]));
    if (!workoutData[name]) {
      setWorkoutData((prev) => ({ ...prev, [name]: [{}] }));
    }
    setActiveView("workout");
    setSearchQuery("");
    setSelectedCategory(null);
  };

  // Save workout
  const saveWorkout = async () => {
    if (!workoutType) return;

    const exercisesToSave: WorkoutExercise[] = [];

    for (const exerciseName of Object.keys(workoutData)) {
      const sets = workoutData[exerciseName];
      const config = getExerciseConfig(exerciseName);

      const validSets = sets.filter(
        (s) => s.reps || s.weight || s.distance || s.duration
      );
      if (validSets.length === 0) continue;

      exercisesToSave.push({
        id: `${Date.now()}-${exerciseName}`,
        name: exerciseName,
        category: config.category,
        sets: validSets.length,
        reps: validSets[0].reps,
        weight: validSets.some((s) => s.weight)
          ? Math.max(...validSets.filter((s) => s.weight).map((s) => s.weight!))
          : undefined,
        distance: validSets.some((s) => s.distance)
          ? validSets.reduce((sum, s) => sum + (s.distance || 0), 0)
          : undefined,
        duration: validSets.some((s) => s.duration)
          ? validSets.reduce((sum, s) => sum + (s.duration || 0), 0)
          : undefined,
        setsData: validSets,
      });
    }

    if (exercisesToSave.length === 0) return;

    if (savedWorkoutEntry) {
      await updateEntry({
        ...savedWorkoutEntry,
        value: `${exercisesToSave.length} exercise${exercisesToSave.length !== 1 ? "s" : ""}`,
        workoutData: { exercises: exercisesToSave },
      });
    } else {
      await addEntry({
        date: selectedDate,
        activityTypeId: workoutType.id,
        value: `${exercisesToSave.length} exercise${exercisesToSave.length !== 1 ? "s" : ""}`,
        workoutData: { exercises: exercisesToSave },
      });
    }
  };

  // Auto-save when data changes (debounced)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      const hasData = Object.values(workoutData).some((sets) =>
        sets.some((s) => s.reps || s.weight || s.distance || s.duration)
      );
      if (hasData) {
        saveWorkout();
      }
    }, 1000);
    return () => clearTimeout(saveTimeoutRef.current);
  }, [workoutData]);

  // Count exercises with data
  const exercisesWithData = Object.keys(workoutData).filter((name) =>
    exerciseHasData(name)
  ).length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black pb-24">
      {/* Header */}
      <div
        className="bg-white dark:bg-ios-card-dark border-b border-gray-200 dark:border-gray-800 sticky top-0 z-20"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t("workout.title")}
            </h1>
            {exercisesWithData > 0 && (
              <div className="flex items-center gap-2 text-ios-green">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-[15px] font-medium">
                  {exercisesWithData} {exercisesWithData === 1 ? "exercise" : "exercises"}
                </span>
              </div>
            )}
          </div>

          {/* View Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveView("workout")}
              className={cn(
                "flex-1 py-2.5 rounded-xl text-[15px] font-medium transition-all",
                activeView === "workout"
                  ? "bg-ios-blue text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
              )}
            >
              {t("workout.myWorkout")}
            </button>
            <button
              onClick={() => setActiveView("browse")}
              className={cn(
                "flex-1 py-2.5 rounded-xl text-[15px] font-medium transition-all",
                activeView === "browse"
                  ? "bg-ios-blue text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
              )}
            >
              {t("workout.browse")}
            </button>
          </div>
        </div>

        {/* Search Bar (always visible in browse/search) */}
        {(activeView === "browse" || activeView === "search") && (
          <div className="px-4 pb-3">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (e.target.value.length >= 2) {
                    setActiveView("search");
                  }
                }}
                placeholder={t("workout.searchExercises")}
                className="w-full pl-10 pr-4 py-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-[16px] text-gray-900 dark:text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-ios-blue"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setActiveView("browse");
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                >
                  <svg
                    className="w-5 h-5 text-gray-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="px-4 py-4">
        {/* WORKOUT VIEW */}
        {activeView === "workout" && (
          <div className="space-y-3">
            {/* Routines Horizontal Scroll */}
            {routines.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                <button
                  onClick={() => setSelectedRoutineId(null)}
                  className={cn(
                    "px-4 py-2 rounded-full text-[14px] font-medium whitespace-nowrap transition-all",
                    selectedRoutineId === null
                      ? "bg-ios-blue text-white"
                      : "bg-white dark:bg-ios-card-dark text-gray-700 dark:text-gray-300"
                  )}
                >
                  All Exercises
                </button>
                {routines.map((routine) => (
                  <button
                    key={routine.id}
                    onClick={() =>
                      setSelectedRoutineId(selectedRoutineId === routine.id ? null : routine.id)
                    }
                    className={cn(
                      "px-4 py-2 rounded-full text-[14px] font-medium whitespace-nowrap transition-all",
                      selectedRoutineId === routine.id
                        ? "text-white"
                        : "bg-white dark:bg-ios-card-dark text-gray-700 dark:text-gray-300"
                    )}
                    style={
                      selectedRoutineId === routine.id
                        ? { backgroundColor: routine.color || "#007AFF" }
                        : undefined
                    }
                  >
                    {routine.name}
                  </button>
                ))}
              </div>
            )}

            {/* Quick Add Button */}
            <button
              onClick={() => setActiveView("browse")}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-ios-blue to-blue-600 text-white text-[17px] font-semibold flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-transform"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
              {t("workout.addExercise")}
            </button>

            {/* Exercise List */}
            {routineExercises.length > 0 ? (
              <div className="bg-white dark:bg-ios-card-dark rounded-2xl overflow-hidden divide-y divide-gray-100 dark:divide-gray-800">
                {routineExercises.map((exercise) => {
                  const isExpanded = expandedExercises.has(exercise.name);
                  const hasData = exerciseHasData(exercise.name);
                  const savedEx = savedExercises.find(
                    (e) => e.name.toLowerCase() === exercise.name.toLowerCase()
                  );
                  const sets = workoutData[exercise.name] || [{}];
                  const customEx = workoutType?.customExercises?.find(
                    (e) => e.name.toLowerCase() === exercise.name.toLowerCase()
                  );

                  return (
                    <div key={exercise.name}>
                      {/* Exercise Header */}
                      <button
                        onClick={() => toggleExercise(exercise.name)}
                        className={cn(
                          "w-full px-4 py-4 flex items-center gap-3",
                          isExpanded && "bg-gray-50 dark:bg-gray-800/50"
                        )}
                      >
                        {/* Image or Icon */}
                        <div
                          className={cn(
                            "w-14 h-14 rounded-xl flex items-center justify-center overflow-hidden",
                            !customEx?.imageUrl &&
                              "bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600"
                          )}
                        >
                          {customEx?.imageUrl ? (
                            <img
                              src={customEx.imageUrl}
                              alt={exercise.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-2xl">
                              {exercise.category === "cardio" ? "🏃" : "💪"}
                            </span>
                          )}
                        </div>

                        {/* Name and Status */}
                        <div className="flex-1 text-left">
                          <span
                            className={cn(
                              "text-[17px] font-medium block",
                              hasData || savedEx
                                ? "text-ios-green"
                                : "text-gray-900 dark:text-white"
                            )}
                          >
                            {exercise.name}
                          </span>
                          {customEx?.muscles && customEx.muscles.length > 0 && (
                            <span className="text-[13px] text-gray-500">
                              {customEx.muscles.slice(0, 2).join(", ")}
                            </span>
                          )}
                          {(hasData || savedEx) && (
                            <span className="text-[13px] text-ios-green">
                              {sets.filter((s) => s.reps || s.weight || s.distance || s.duration)
                                .length || savedEx?.sets || 0}{" "}
                              sets logged
                            </span>
                          )}
                        </div>

                        {/* Checkmark or Arrow */}
                        {hasData || savedEx ? (
                          <svg
                            className="w-6 h-6 text-ios-green"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                        ) : (
                          <svg
                            className={cn(
                              "w-5 h-5 text-gray-400 transition-transform",
                              isExpanded && "rotate-90"
                            )}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        )}
                      </button>

                      {/* Expanded Sets */}
                      {isExpanded && (
                        <div className="px-4 pb-4 space-y-3 bg-gray-50 dark:bg-gray-800/50">
                          {sets.map((set, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-3 bg-white dark:bg-ios-card-dark rounded-xl p-3"
                            >
                              {/* Set Number */}
                              <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                                <span className="text-[15px] font-semibold text-gray-600 dark:text-gray-300">
                                  {index + 1}
                                </span>
                              </div>

                              {/* Inputs */}
                              <div className="flex-1 flex items-center gap-2">
                                {exercise.trackReps !== false && (
                                  <div className="flex-1">
                                    <input
                                      type="number"
                                      inputMode="numeric"
                                      value={set.reps || ""}
                                      onChange={(e) =>
                                        updateExerciseSet(
                                          exercise.name,
                                          index,
                                          "reps",
                                          e.target.value ? parseInt(e.target.value) : undefined
                                        )
                                      }
                                      onFocus={(e) => e.target.select()}
                                      placeholder="0"
                                      className="w-full px-3 py-3 bg-gray-100 dark:bg-gray-700 rounded-xl text-center text-[18px] font-semibold text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-ios-blue"
                                    />
                                    <span className="text-[11px] text-gray-500 text-center block mt-1">
                                      reps
                                    </span>
                                  </div>
                                )}

                                {exercise.trackWeight !== false && (
                                  <div className="flex-1">
                                    <input
                                      type="number"
                                      inputMode="decimal"
                                      value={set.weight || ""}
                                      onChange={(e) =>
                                        updateExerciseSet(
                                          exercise.name,
                                          index,
                                          "weight",
                                          e.target.value ? parseFloat(e.target.value) : undefined
                                        )
                                      }
                                      onFocus={(e) => e.target.select()}
                                      placeholder="0"
                                      step="0.5"
                                      className="w-full px-3 py-3 bg-gray-100 dark:bg-gray-700 rounded-xl text-center text-[18px] font-semibold text-ios-blue placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-ios-blue"
                                    />
                                    <span className="text-[11px] text-gray-500 text-center block mt-1">
                                      kg
                                    </span>
                                  </div>
                                )}

                                {exercise.trackDistance && (
                                  <div className="flex-1">
                                    <input
                                      type="number"
                                      inputMode="decimal"
                                      value={set.distance || ""}
                                      onChange={(e) =>
                                        updateExerciseSet(
                                          exercise.name,
                                          index,
                                          "distance",
                                          e.target.value ? parseFloat(e.target.value) : undefined
                                        )
                                      }
                                      onFocus={(e) => e.target.select()}
                                      placeholder="0"
                                      step="0.1"
                                      className="w-full px-3 py-3 bg-gray-100 dark:bg-gray-700 rounded-xl text-center text-[18px] font-semibold text-ios-orange placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-ios-blue"
                                    />
                                    <span className="text-[11px] text-gray-500 text-center block mt-1">
                                      km
                                    </span>
                                  </div>
                                )}

                                {exercise.trackDuration && (
                                  <div className="flex-1">
                                    <input
                                      type="number"
                                      inputMode="numeric"
                                      value={set.duration || ""}
                                      onChange={(e) =>
                                        updateExerciseSet(
                                          exercise.name,
                                          index,
                                          "duration",
                                          e.target.value ? parseInt(e.target.value) : undefined
                                        )
                                      }
                                      onFocus={(e) => e.target.select()}
                                      placeholder="0"
                                      className="w-full px-3 py-3 bg-gray-100 dark:bg-gray-700 rounded-xl text-center text-[18px] font-semibold text-ios-purple placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-ios-blue"
                                    />
                                    <span className="text-[11px] text-gray-500 text-center block mt-1">
                                      min
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Remove Set */}
                              {sets.length > 1 && (
                                <button
                                  onClick={() => removeSet(exercise.name, index)}
                                  className="p-2 text-gray-400 active:text-ios-red"
                                >
                                  <svg
                                    className="w-5 h-5"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                    />
                                  </svg>
                                </button>
                              )}
                            </div>
                          ))}

                          {/* Add Set Button */}
                          <button
                            onClick={() => addSet(exercise.name)}
                            className="w-full py-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 text-[15px] font-medium flex items-center justify-center gap-2 active:bg-gray-100 dark:active:bg-gray-700"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                              />
                            </svg>
                            Add Set
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🏋️</div>
                <p className="text-gray-500 dark:text-gray-400 text-[17px]">
                  {t("workout.noExercises")}
                </p>
                <button
                  onClick={() => setActiveView("browse")}
                  className="mt-4 px-6 py-3 bg-ios-blue text-white rounded-xl text-[15px] font-medium"
                >
                  {t("workout.browseExercises")}
                </button>
              </div>
            )}
          </div>
        )}

        {/* BROWSE VIEW */}
        {activeView === "browse" && !selectedCategory && (
          <div className="space-y-4">
            <h2 className="text-[15px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              {t("workout.muscleGroups")}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {CATEGORIES.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={cn(
                    "p-5 rounded-2xl bg-gradient-to-br text-white text-left shadow-lg active:scale-[0.98] transition-transform",
                    category.color
                  )}
                >
                  <span className="text-3xl block mb-2">{category.icon}</span>
                  <span className="text-[17px] font-semibold">{category.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* CATEGORY EXERCISES */}
        {activeView === "browse" && selectedCategory && (
          <div className="space-y-4">
            <button
              onClick={() => setSelectedCategory(null)}
              className="flex items-center gap-2 text-ios-blue text-[15px] font-medium"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back to Categories
            </button>

            {isLoadingCategory ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-3 border-ios-blue border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="bg-white dark:bg-ios-card-dark rounded-2xl overflow-hidden divide-y divide-gray-100 dark:divide-gray-800">
                {categoryExercises.map((exercise) => {
                  const name = getExerciseName(exercise);
                  const imageUrl = getExerciseImage(exercise);
                  const muscles = getExerciseMuscles(exercise);
                  const isAdded =
                    COMMON_EXERCISES.some((e) => e.name.toLowerCase() === name.toLowerCase()) ||
                    workoutType?.customExercises?.some(
                      (e) => e.name.toLowerCase() === name.toLowerCase()
                    );

                  return (
                    <button
                      key={exercise.id}
                      onClick={() => addExerciseFromApi(exercise)}
                      className="w-full px-4 py-4 flex items-center gap-3 active:bg-gray-50 dark:active:bg-gray-800"
                    >
                      <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-200 dark:bg-gray-700 flex-shrink-0">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl">
                            💪
                          </div>
                        )}
                      </div>
                      <div className="flex-1 text-left">
                        <span className="text-[16px] font-medium text-gray-900 dark:text-white block">
                          {name}
                        </span>
                        {muscles.length > 0 && (
                          <span className="text-[13px] text-gray-500">
                            {muscles.slice(0, 2).join(", ")}
                          </span>
                        )}
                      </div>
                      {isAdded ? (
                        <svg
                          className="w-6 h-6 text-ios-green"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="w-6 h-6 text-ios-blue"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                          />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* SEARCH RESULTS */}
        {activeView === "search" && (
          <div className="space-y-4">
            {isSearching ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-3 border-ios-blue border-t-transparent rounded-full animate-spin" />
              </div>
            ) : searchResults.length > 0 ? (
              <div className="bg-white dark:bg-ios-card-dark rounded-2xl overflow-hidden divide-y divide-gray-100 dark:divide-gray-800">
                {searchResults.map((exercise) => {
                  const name = getExerciseName(exercise);
                  const imageUrl = getExerciseImage(exercise);
                  const muscles = getExerciseMuscles(exercise);

                  return (
                    <button
                      key={exercise.id}
                      onClick={() => addExerciseFromApi(exercise)}
                      className="w-full px-4 py-4 flex items-center gap-3 active:bg-gray-50 dark:active:bg-gray-800"
                    >
                      <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-200 dark:bg-gray-700 flex-shrink-0">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl">
                            💪
                          </div>
                        )}
                      </div>
                      <div className="flex-1 text-left">
                        <span className="text-[16px] font-medium text-gray-900 dark:text-white block">
                          {name}
                        </span>
                        {muscles.length > 0 && (
                          <span className="text-[13px] text-gray-500">
                            {muscles.slice(0, 2).join(", ")}
                          </span>
                        )}
                        <span className="text-[12px] text-gray-400 block">
                          {exercise.category.name}
                        </span>
                      </div>
                      <svg
                        className="w-6 h-6 text-ios-blue"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                        />
                      </svg>
                    </button>
                  );
                })}
              </div>
            ) : searchQuery.length >= 2 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">
                  No exercises found for "{searchQuery}"
                </p>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
