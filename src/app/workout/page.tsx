"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { cn, toDateStr } from "@/lib/utils";
import {
  CustomExercise,
  WorkoutExercise,
  WorkoutRoutine,
  ROUTINE_COLORS,
} from "@/types";
import { Plus, X, Check, ChevronRight, Dumbbell } from "lucide-react";

export default function WorkoutPage() {
  const { activityTypes, entries, addEntry, updateEntry, updateActivityType } =
    useApp();
  const { user } = useAuth();
  const { t } = useLanguage();

  const [selectedDate] = useState(() => toDateStr(new Date()));

  // Modal states
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [showAddRoutine, setShowAddRoutine] = useState(false);
  const [showManageRoutines, setShowManageRoutines] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<WorkoutRoutine | null>(
    null,
  );

  // New exercise form
  const [newExerciseName, setNewExerciseName] = useState("");
  const [newExerciseCategory, setNewExerciseCategory] = useState<
    "strength" | "cardio"
  >("strength");
  const [newExerciseTrackWeight, setNewExerciseTrackWeight] = useState(true);
  const [newExerciseTrackReps, setNewExerciseTrackReps] = useState(true);
  const [newExerciseTrackDistance, setNewExerciseTrackDistance] =
    useState(false);
  const [newExerciseTrackDuration, setNewExerciseTrackDuration] =
    useState(false);

  // Routine form
  const [newRoutineName, setNewRoutineName] = useState("");
  const [newRoutineColor, setNewRoutineColor] = useState(ROUTINE_COLORS[0]);
  const [selectedExercisesForRoutine, setSelectedExercisesForRoutine] =
    useState<string[]>([]);

  // Workout state
  const [selectedRoutineId, setSelectedRoutineId] = useState<string | null>(
    null,
  );
  const [expandedExercises, setExpandedExercises] = useState<Set<string>>(
    new Set(),
  );
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

  // Get workout activity type
  const workoutType = useMemo(
    () => activityTypes.find((t) => t.valueType === "workout"),
    [activityTypes],
  );

  // Get user's exercises
  const exercises = useMemo(() => {
    return workoutType?.customExercises || [];
  }, [workoutType]);

  // Get routines
  const routines = useMemo(() => {
    return workoutType?.workoutRoutines || [];
  }, [workoutType]);

  // Get exercises for selected routine
  const displayedExercises = useMemo(() => {
    if (!selectedRoutineId) return exercises;
    const routine = routines.find((r) => r.id === selectedRoutineId);
    if (!routine) return exercises;
    return exercises.filter((e) =>
      routine.exerciseNames.some(
        (n) => n.toLowerCase() === e.name.toLowerCase(),
      ),
    );
  }, [selectedRoutineId, routines, exercises]);

  // Today's saved workout
  const savedWorkoutEntry = useMemo(() => {
    if (!workoutType) return null;
    return entries.find(
      (e) =>
        e.date === selectedDate &&
        e.activityTypeId === workoutType.id &&
        e.workoutData,
    );
  }, [entries, workoutType, selectedDate]);

  const savedExercises = savedWorkoutEntry?.workoutData?.exercises || [];

  // Load saved data on mount
  useEffect(() => {
    if (savedExercises.length > 0) {
      const newData: typeof workoutData = {};
      savedExercises.forEach((ex) => {
        if (ex.setsData && ex.setsData.length > 0) {
          newData[ex.name] = ex.setsData;
        } else {
          newData[ex.name] = Array.from({ length: ex.sets || 1 }, () => ({
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

  // Add new exercise
  const handleAddExercise = async () => {
    if (!workoutType || !newExerciseName.trim()) return;

    const newExercise: CustomExercise = {
      name: newExerciseName.trim(),
      category: newExerciseCategory,
      trackWeight: newExerciseTrackWeight,
      trackReps: newExerciseTrackReps,
      trackDistance: newExerciseTrackDistance,
      trackDuration: newExerciseTrackDuration,
    };

    await updateActivityType({
      ...workoutType,
      customExercises: [...(workoutType.customExercises || []), newExercise],
    });

    // Reset form
    setNewExerciseName("");
    setNewExerciseCategory("strength");
    setNewExerciseTrackWeight(true);
    setNewExerciseTrackReps(true);
    setNewExerciseTrackDistance(false);
    setNewExerciseTrackDuration(false);
    setShowAddExercise(false);
  };

  // Delete exercise
  const handleDeleteExercise = async (name: string) => {
    if (!workoutType) return;
    await updateActivityType({
      ...workoutType,
      customExercises: (workoutType.customExercises || []).filter(
        (e) => e.name.toLowerCase() !== name.toLowerCase(),
      ),
    });
  };

  // Add routine
  const handleAddRoutine = async () => {
    if (!workoutType || !newRoutineName.trim()) return;

    const newRoutine: WorkoutRoutine = {
      id: `routine-${Date.now()}`,
      name: newRoutineName.trim(),
      color: newRoutineColor,
      exerciseNames: selectedExercisesForRoutine,
    };

    await updateActivityType({
      ...workoutType,
      workoutRoutines: [...(workoutType.workoutRoutines || []), newRoutine],
    });

    // Reset form
    setNewRoutineName("");
    setNewRoutineColor(ROUTINE_COLORS[0]);
    setSelectedExercisesForRoutine([]);
    setShowAddRoutine(false);
  };

  // Update routine
  const handleUpdateRoutine = async () => {
    if (!workoutType || !editingRoutine) return;

    await updateActivityType({
      ...workoutType,
      workoutRoutines: (workoutType.workoutRoutines || []).map((r) =>
        r.id === editingRoutine.id
          ? { ...editingRoutine, exerciseNames: selectedExercisesForRoutine }
          : r,
      ),
    });

    setEditingRoutine(null);
    setSelectedExercisesForRoutine([]);
  };

  // Delete routine
  const handleDeleteRoutine = async (id: string) => {
    if (!workoutType) return;
    await updateActivityType({
      ...workoutType,
      workoutRoutines: (workoutType.workoutRoutines || []).filter(
        (r) => r.id !== id,
      ),
    });
    if (selectedRoutineId === id) setSelectedRoutineId(null);
  };

  // Toggle exercise expansion
  const toggleExercise = (name: string) => {
    setExpandedExercises((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(name)) {
        newSet.delete(name);
      } else {
        newSet.add(name);
        if (!workoutData[name]) {
          setWorkoutData((prev) => ({ ...prev, [name]: [{}] }));
        }
      }
      return newSet;
    });
  };

  // Update set data
  const updateExerciseSet = (
    exerciseName: string,
    index: number,
    field: string,
    value: number | undefined,
  ) => {
    const sets = [...(workoutData[exerciseName] || [{}])];
    sets[index] = { ...sets[index], [field]: value };
    setWorkoutData((prev) => ({ ...prev, [exerciseName]: sets }));
  };

  // Add set
  const addSet = (exerciseName: string) => {
    const sets = workoutData[exerciseName] || [{}];
    const lastSet = sets[sets.length - 1] || {};
    setWorkoutData((prev) => ({
      ...prev,
      [exerciseName]: [...sets, { ...lastSet }],
    }));
  };

  // Remove set
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

  // Get exercise config
  const getExerciseConfig = (name: string) => {
    return (
      exercises.find((e) => e.name.toLowerCase() === name.toLowerCase()) || {
        name,
        category: "strength" as const,
        trackWeight: true,
        trackReps: true,
      }
    );
  };

  // Save workout
  const saveWorkout = useCallback(async () => {
    if (!workoutType) return;

    const exercisesToSave: WorkoutExercise[] = [];

    for (const exerciseName of Object.keys(workoutData)) {
      const sets = workoutData[exerciseName];
      const config = getExerciseConfig(exerciseName);

      const validSets = sets.filter(
        (s) => s.reps || s.weight || s.distance || s.duration,
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
  }, [
    workoutType,
    workoutData,
    savedWorkoutEntry,
    selectedDate,
    addEntry,
    updateEntry,
  ]);

  // Auto-save (debounced)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      const hasData = Object.values(workoutData).some((sets) =>
        sets.some((s) => s.reps || s.weight || s.distance || s.duration),
      );
      if (hasData) {
        saveWorkout();
      }
    }, 1000);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [workoutData, saveWorkout]);

  const exercisesWithData = Object.keys(workoutData).filter((name) =>
    exerciseHasData(name),
  ).length;

  return (
    <div className='min-h-screen bg-gray-50 dark:bg-black pb-40'>
      {/* Header */}
      <div className='px-4 pt-6 pb-4'>
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='text-2xl font-bold text-gray-900 dark:text-white'>
              {t("workout.title")}
            </h1>
            {exercisesWithData > 0 && (
              <p className='text-sm text-ios-green font-medium mt-0.5'>
                ✓ {exercisesWithData} exercise
                {exercisesWithData !== 1 ? "s" : ""} logged
              </p>
            )}
          </div>
          <button
            onClick={() => setShowManageRoutines(true)}
            className='p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'>
            <svg
              className='w-5 h-5'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'>
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4'
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Routines */}
      {routines.length > 0 && (
        <div className='px-4'>
          <div className='flex gap-2 overflow-x-auto pb-3 scrollbar-hide'>
            <button
              onClick={() => setSelectedRoutineId(null)}
              className={cn(
                "px-4 py-2.5 rounded-full text-[14px] font-semibold whitespace-nowrap transition-all flex-shrink-0",
                selectedRoutineId === null
                  ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                  : "bg-white dark:bg-ios-card-dark text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700",
              )}>
              All Exercises
            </button>
            {routines.map((routine) => (
              <button
                key={routine.id}
                onClick={() =>
                  setSelectedRoutineId(
                    selectedRoutineId === routine.id ? null : routine.id,
                  )
                }
                className={cn(
                  "px-4 py-2.5 rounded-full text-[14px] font-semibold whitespace-nowrap transition-all flex-shrink-0",
                  selectedRoutineId === routine.id
                    ? "text-white"
                    : "bg-white dark:bg-ios-card-dark text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700",
                )}
                style={
                  selectedRoutineId === routine.id
                    ? { backgroundColor: routine.color }
                    : undefined
                }>
                {routine.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div className='px-4 py-4 space-y-4'>
        {/* Add Exercise Button */}
        <button
          onClick={() => setShowAddExercise(true)}
          className='w-full py-4 rounded-2xl bg-gradient-to-r from-ios-blue to-blue-600 text-white text-[17px] font-semibold flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-transform'>
          <Plus className='w-6 h-6' />
          Add Exercise
        </button>

        {/* Empty State */}
        {exercises.length === 0 && (
          <div className='py-16 text-center'>
            <div className='w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center'>
              <Dumbbell className='w-10 h-10 text-gray-400' />
            </div>
            <h3 className='text-lg font-semibold text-gray-900 dark:text-white mb-2'>
              No exercises yet
            </h3>
            <p className='text-gray-500 dark:text-gray-400 text-[15px] max-w-xs mx-auto'>
              Add your first exercise to start tracking your workouts
            </p>
          </div>
        )}

        {/* Exercise List */}
        {displayedExercises.length > 0 && (
          <div className='space-y-3'>
            {displayedExercises.map((exercise) => {
              const isExpanded = expandedExercises.has(exercise.name);
              const hasData = exerciseHasData(exercise.name);
              const sets = workoutData[exercise.name] || [{}];

              return (
                <div
                  key={exercise.name}
                  className={cn(
                    'bg-white dark:bg-ios-card-dark rounded-2xl overflow-hidden shadow-sm transition-all',
                    isExpanded && 'ring-2 ring-ios-blue ring-offset-2 ring-offset-gray-50 dark:ring-offset-black'
                  )}>
                  {/* Exercise Header */}
                  <button
                    onClick={() => toggleExercise(exercise.name)}
                    className='w-full px-4 py-4 flex items-center gap-3'>
                    <div
                      className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center",
                        hasData
                          ? "bg-ios-green/10"
                          : "bg-gray-100 dark:bg-gray-800",
                      )}>
                      <span className='text-2xl'>
                        {exercise.category === "cardio" ? "🏃" : "💪"}
                      </span>
                    </div>
                    <div className='flex-1 text-left'>
                      <span
                        className={cn(
                          "text-[17px] font-semibold block",
                          hasData
                            ? "text-ios-green"
                            : "text-gray-900 dark:text-white",
                        )}>
                        {exercise.name}
                      </span>
                      {hasData && (
                        <span className='text-[13px] text-ios-green'>
                          {
                            sets.filter(
                              (s) =>
                                s.reps || s.weight || s.distance || s.duration,
                            ).length
                          }{" "}
                          sets
                        </span>
                      )}
                    </div>
                    {hasData ? (
                      <Check className='w-6 h-6 text-ios-green' />
                    ) : (
                      <ChevronRight
                        className={cn(
                          "w-5 h-5 text-gray-400 transition-transform",
                          isExpanded && "rotate-90",
                        )}
                      />
                    )}
                  </button>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className='px-4 pb-4 space-y-3 border-t border-gray-100 dark:border-gray-800 pt-3'>
                      {sets.map((set, index) => (
                        <div key={index} className='flex items-center gap-3'>
                          {/* Set Number */}
                          <div className='w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center'>
                            <span className='text-[15px] font-bold text-gray-500 dark:text-gray-400'>
                              {index + 1}
                            </span>
                          </div>

                          {/* Inputs */}
                          <div className='flex-1 grid grid-cols-2 gap-2'>
                            {exercise.trackReps !== false && (
                              <div className='relative'>
                                <input
                                  type='number'
                                  inputMode='numeric'
                                  value={set.reps || ""}
                                  onChange={(e) =>
                                    updateExerciseSet(
                                      exercise.name,
                                      index,
                                      "reps",
                                      e.target.value
                                        ? parseInt(e.target.value)
                                        : undefined,
                                    )
                                  }
                                  onFocus={(e) => e.target.select()}
                                  placeholder='0'
                                  className='w-full px-3 py-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-center text-[18px] font-bold text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-ios-blue'
                                />
                                <span className='absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-gray-400 font-medium'>
                                  reps
                                </span>
                              </div>
                            )}
                            {exercise.trackWeight !== false && (
                              <div className='relative'>
                                <input
                                  type='number'
                                  inputMode='decimal'
                                  value={set.weight || ""}
                                  onChange={(e) =>
                                    updateExerciseSet(
                                      exercise.name,
                                      index,
                                      "weight",
                                      e.target.value
                                        ? parseFloat(e.target.value)
                                        : undefined,
                                    )
                                  }
                                  onFocus={(e) => e.target.select()}
                                  placeholder='0'
                                  className='w-full px-3 py-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-center text-[18px] font-bold text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-ios-blue'
                                />
                                <span className='absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-gray-400 font-medium'>
                                  kg
                                </span>
                              </div>
                            )}
                            {exercise.trackDistance && (
                              <div className='relative'>
                                <input
                                  type='number'
                                  inputMode='decimal'
                                  value={set.distance || ""}
                                  onChange={(e) =>
                                    updateExerciseSet(
                                      exercise.name,
                                      index,
                                      "distance",
                                      e.target.value
                                        ? parseFloat(e.target.value)
                                        : undefined,
                                    )
                                  }
                                  onFocus={(e) => e.target.select()}
                                  placeholder='0'
                                  className='w-full px-3 py-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-center text-[18px] font-bold text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-ios-blue'
                                />
                                <span className='absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-gray-400 font-medium'>
                                  km
                                </span>
                              </div>
                            )}
                            {exercise.trackDuration && (
                              <div className='relative'>
                                <input
                                  type='number'
                                  inputMode='numeric'
                                  value={set.duration || ""}
                                  onChange={(e) =>
                                    updateExerciseSet(
                                      exercise.name,
                                      index,
                                      "duration",
                                      e.target.value
                                        ? parseInt(e.target.value)
                                        : undefined,
                                    )
                                  }
                                  onFocus={(e) => e.target.select()}
                                  placeholder='0'
                                  className='w-full px-3 py-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-center text-[18px] font-bold text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-ios-blue'
                                />
                                <span className='absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-gray-400 font-medium'>
                                  min
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Remove Set Button */}
                          {sets.length > 1 && (
                            <button
                              onClick={() => removeSet(exercise.name, index)}
                              className='w-10 h-10 rounded-xl flex items-center justify-center text-gray-400 hover:text-ios-red hover:bg-ios-red/10 transition-colors'>
                              <X className='w-5 h-5' />
                            </button>
                          )}
                        </div>
                      ))}

                      {/* Add Set Button */}
                      <button
                        onClick={() => addSet(exercise.name)}
                        className='w-full py-3 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-[15px] font-medium flex items-center justify-center gap-2 hover:border-ios-blue hover:text-ios-blue transition-colors'>
                        <Plus className='w-4 h-4' />
                        Add Set
                      </button>

                      {/* Delete Exercise */}
                      <button
                        onClick={() => handleDeleteExercise(exercise.name)}
                        className='w-full py-2 text-ios-red text-[14px] font-medium'>
                        Delete Exercise
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Exercise Modal */}
      {showAddExercise && (
        <div className='fixed inset-0 z-50 flex items-end justify-center'>
          <div
            className='absolute inset-0 bg-black/50'
            onClick={() => setShowAddExercise(false)}
          />
          <div className='relative w-full max-w-lg bg-white dark:bg-ios-card-dark rounded-t-3xl p-6 pb-24 animate-slide-up'>
            <div className='flex items-center justify-between mb-6'>
              <h2 className='text-xl font-bold text-gray-900 dark:text-white'>
                Add Exercise
              </h2>
              <button
                onClick={() => setShowAddExercise(false)}
                className='p-2 rounded-full bg-gray-100 dark:bg-gray-800'>
                <X className='w-5 h-5 text-gray-500' />
              </button>
            </div>

            <div className='space-y-4'>
              {/* Name */}
              <div>
                <label className='text-[14px] font-medium text-gray-700 dark:text-gray-300 mb-1.5 block'>
                  Exercise Name
                </label>
                <input
                  type='text'
                  value={newExerciseName}
                  onChange={(e) => setNewExerciseName(e.target.value)}
                  placeholder='e.g., Bench Press'
                  className='w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-[16px] text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-ios-blue'
                />
              </div>

              {/* Category */}
              <div>
                <label className='text-[14px] font-medium text-gray-700 dark:text-gray-300 mb-1.5 block'>
                  Category
                </label>
                <div className='flex gap-2'>
                  <button
                    onClick={() => {
                      setNewExerciseCategory("strength");
                      setNewExerciseTrackWeight(true);
                      setNewExerciseTrackReps(true);
                      setNewExerciseTrackDistance(false);
                      setNewExerciseTrackDuration(false);
                    }}
                    className={cn(
                      "flex-1 py-3 rounded-xl text-[15px] font-medium transition-all",
                      newExerciseCategory === "strength"
                        ? "bg-ios-blue text-white"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300",
                    )}>
                    💪 Strength
                  </button>
                  <button
                    onClick={() => {
                      setNewExerciseCategory("cardio");
                      setNewExerciseTrackWeight(false);
                      setNewExerciseTrackReps(false);
                      setNewExerciseTrackDistance(true);
                      setNewExerciseTrackDuration(true);
                    }}
                    className={cn(
                      "flex-1 py-3 rounded-xl text-[15px] font-medium transition-all",
                      newExerciseCategory === "cardio"
                        ? "bg-ios-blue text-white"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300",
                    )}>
                    🏃 Cardio
                  </button>
                </div>
              </div>

              {/* Tracking Options */}
              <div>
                <label className='text-[14px] font-medium text-gray-700 dark:text-gray-300 mb-1.5 block'>
                  Track
                </label>
                <div className='grid grid-cols-2 gap-2'>
                  {[
                    {
                      key: "reps",
                      label: "Reps",
                      state: newExerciseTrackReps,
                      set: setNewExerciseTrackReps,
                    },
                    {
                      key: "weight",
                      label: "Weight (kg)",
                      state: newExerciseTrackWeight,
                      set: setNewExerciseTrackWeight,
                    },
                    {
                      key: "distance",
                      label: "Distance (km)",
                      state: newExerciseTrackDistance,
                      set: setNewExerciseTrackDistance,
                    },
                    {
                      key: "duration",
                      label: "Duration (min)",
                      state: newExerciseTrackDuration,
                      set: setNewExerciseTrackDuration,
                    },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => opt.set(!opt.state)}
                      className={cn(
                        "py-3 rounded-xl text-[14px] font-medium transition-all border",
                        opt.state
                          ? "bg-ios-blue/10 border-ios-blue text-ios-blue"
                          : "bg-gray-100 dark:bg-gray-800 border-transparent text-gray-600 dark:text-gray-400",
                      )}>
                      {opt.state && "✓ "}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Add Button */}
              <button
                onClick={handleAddExercise}
                disabled={!newExerciseName.trim()}
                className='w-full py-4 rounded-xl bg-ios-blue text-white text-[17px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed'>
                Add Exercise
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Routines Modal */}
      {showManageRoutines && (
        <div className='fixed inset-0 z-50 flex items-end justify-center'>
          <div
            className='absolute inset-0 bg-black/50'
            onClick={() => setShowManageRoutines(false)}
          />
          <div className='relative w-full max-w-lg bg-white dark:bg-ios-card-dark rounded-t-3xl p-6 pb-24 animate-slide-up max-h-[80vh] overflow-y-auto'>
            <div className='flex items-center justify-between mb-6'>
              <h2 className='text-xl font-bold text-gray-900 dark:text-white'>
                Workout Groups
              </h2>
              <button
                onClick={() => setShowManageRoutines(false)}
                className='p-2 rounded-full bg-gray-100 dark:bg-gray-800'>
                <X className='w-5 h-5 text-gray-500' />
              </button>
            </div>

            {/* Add New Routine Button */}
            <button
              onClick={() => {
                setShowManageRoutines(false);
                setShowAddRoutine(true);
              }}
              className='w-full py-4 rounded-xl bg-ios-blue text-white text-[16px] font-semibold mb-4 flex items-center justify-center gap-2'>
              <Plus className='w-5 h-5' />
              Create New Group
            </button>

            {/* Routines List */}
            {routines.length === 0 ? (
              <div className='py-8 text-center'>
                <p className='text-gray-500 dark:text-gray-400'>
                  No workout groups yet. Create one to organize your exercises!
                </p>
              </div>
            ) : (
              <div className='space-y-3'>
                {routines.map((routine) => (
                  <div
                    key={routine.id}
                    className='bg-gray-100 dark:bg-gray-800 rounded-xl p-4'>
                    <div className='flex items-center gap-3 mb-2'>
                      <div
                        className='w-4 h-4 rounded-full'
                        style={{ backgroundColor: routine.color }}
                      />
                      <span className='text-[16px] font-semibold text-gray-900 dark:text-white flex-1'>
                        {routine.name}
                      </span>
                      <button
                        onClick={() => {
                          setEditingRoutine(routine);
                          setSelectedExercisesForRoutine(routine.exerciseNames);
                          setShowManageRoutines(false);
                        }}
                        className='text-ios-blue text-[14px] font-medium'>
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteRoutine(routine.id)}
                        className='text-ios-red text-[14px] font-medium'>
                        Delete
                      </button>
                    </div>
                    <p className='text-[13px] text-gray-500 dark:text-gray-400'>
                      {routine.exerciseNames.length} exercise
                      {routine.exerciseNames.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add/Edit Routine Modal */}
      {(showAddRoutine || editingRoutine) && (
        <div className='fixed inset-0 z-50 flex items-end justify-center'>
          <div
            className='absolute inset-0 bg-black/50'
            onClick={() => {
              setShowAddRoutine(false);
              setEditingRoutine(null);
              setSelectedExercisesForRoutine([]);
            }}
          />
          <div className='relative w-full max-w-lg bg-white dark:bg-ios-card-dark rounded-t-3xl p-6 pb-24 animate-slide-up max-h-[85vh] overflow-y-auto'>
            <div className='flex items-center justify-between mb-6'>
              <h2 className='text-xl font-bold text-gray-900 dark:text-white'>
                {editingRoutine ? "Edit Group" : "Create Group"}
              </h2>
              <button
                onClick={() => {
                  setShowAddRoutine(false);
                  setEditingRoutine(null);
                  setSelectedExercisesForRoutine([]);
                }}
                className='p-2 rounded-full bg-gray-100 dark:bg-gray-800'>
                <X className='w-5 h-5 text-gray-500' />
              </button>
            </div>

            <div className='space-y-5'>
              {/* Name */}
              {!editingRoutine && (
                <div>
                  <label className='text-[14px] font-medium text-gray-700 dark:text-gray-300 mb-1.5 block'>
                    Group Name
                  </label>
                  <input
                    type='text'
                    value={newRoutineName}
                    onChange={(e) => setNewRoutineName(e.target.value)}
                    placeholder='e.g., Push Day, Leg Day'
                    className='w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-[16px] text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-ios-blue'
                  />
                </div>
              )}

              {/* Color */}
              {!editingRoutine && (
                <div>
                  <label className='text-[14px] font-medium text-gray-700 dark:text-gray-300 mb-2 block'>
                    Color
                  </label>
                  <div className='flex gap-2 flex-wrap'>
                    {ROUTINE_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setNewRoutineColor(color)}
                        className={cn(
                          "w-10 h-10 rounded-full transition-all",
                          newRoutineColor === color &&
                            "ring-2 ring-offset-2 ring-gray-400",
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Exercises */}
              <div>
                <label className='text-[14px] font-medium text-gray-700 dark:text-gray-300 mb-2 block'>
                  Select Exercises
                </label>
                {exercises.length === 0 ? (
                  <p className='text-gray-500 dark:text-gray-400 text-[14px] py-4'>
                    Add some exercises first before creating a group.
                  </p>
                ) : (
                  <div className='space-y-2 max-h-[40vh] overflow-y-auto'>
                    {exercises.map((ex) => (
                      <button
                        key={ex.name}
                        onClick={() => {
                          setSelectedExercisesForRoutine((prev) =>
                            prev.includes(ex.name)
                              ? prev.filter((n) => n !== ex.name)
                              : [...prev, ex.name],
                          );
                        }}
                        className={cn(
                          "w-full px-4 py-3 rounded-xl text-left flex items-center gap-3 transition-all",
                          selectedExercisesForRoutine.includes(ex.name)
                            ? "bg-ios-blue/10 border-2 border-ios-blue"
                            : "bg-gray-100 dark:bg-gray-800 border-2 border-transparent",
                        )}>
                        <span className='text-xl'>
                          {ex.category === "cardio" ? "🏃" : "💪"}
                        </span>
                        <span className='text-[15px] font-medium text-gray-900 dark:text-white flex-1'>
                          {ex.name}
                        </span>
                        {selectedExercisesForRoutine.includes(ex.name) && (
                          <Check className='w-5 h-5 text-ios-blue' />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Save Button */}
              <button
                onClick={
                  editingRoutine ? handleUpdateRoutine : handleAddRoutine
                }
                disabled={editingRoutine ? false : !newRoutineName.trim()}
                className='w-full py-4 rounded-xl bg-ios-blue text-white text-[17px] font-semibold disabled:opacity-50'>
                {editingRoutine ? "Save Changes" : "Create Group"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Animation Styles */}
      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
