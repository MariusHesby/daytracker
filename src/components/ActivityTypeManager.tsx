"use client";

import { useState, useRef, useImperativeHandle, forwardRef } from "react";
import { useApp } from "@/context/AppContext";
import {
  ActivityType,
  NutritionGoal,
  CustomExercise,
  ExerciseCategory,
  COMMON_EXERCISES,
} from "@/types";
import { cn } from "@/lib/utils";
import { Icon, IconPicker, icons, IconName } from "./Icons";

type ValueType =
  | "text"
  | "boolean"
  | "checkmark"
  | "counter"
  | "mood"
  | "nutrition"
  | "workout";

const VALUE_TYPE_OPTIONS: {
  value: ValueType;
  label: string;
  description: string;
}[] = [
  { value: "text", label: "Text", description: "Multiple text entries" },
  { value: "counter", label: "Counter", description: "Tap to count up/down" },
  {
    value: "checkmark",
    label: "Checkmark",
    description: "Tap once for ✓ or double tap for ✗",
  },
  { value: "mood", label: "Mood", description: "Happy, neutral, or sad" },
  {
    value: "nutrition",
    label: "Nutrition",
    description: "Track food with calorie/protein goals",
  },
  {
    value: "workout",
    label: "Workout",
    description: "Track exercises with sets, reps, weight, distance",
  },
];

export interface ActivityTypeManagerRef {
  startAdding: () => void;
  isAdding: boolean;
}

interface ActivityTypeManagerProps {
  onAddingChange?: (isAdding: boolean) => void;
}

export const ActivityTypeManager = forwardRef<
  ActivityTypeManagerRef,
  ActivityTypeManagerProps
>(function ActivityTypeManager({ onAddingChange }, ref) {
  const {
    ownActivityTypes: activityTypes,
    addActivityType,
    updateActivityType,
    deleteActivityType,
    toggleActivityTypeHidden,
    reorderActivityTypes,
  } = useApp();
  const [isAdding, setIsAddingState] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<string>("other");
  const [valueType, setValueType] = useState<ValueType>("text");
  const [unit, setUnit] = useState("");
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showValueTypePicker, setShowValueTypePicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Nutrition goal state
  const [nutritionGoal, setNutritionGoal] = useState<NutritionGoal>({});

  // Custom exercises state for workout type
  const [customExercises, setCustomExercises] = useState<CustomExercise[]>([]);
  const [newExerciseName, setNewExerciseName] = useState("");
  const [newExerciseCategory, setNewExerciseCategory] =
    useState<ExerciseCategory>("strength");
  const [newExerciseTrackWeight, setNewExerciseTrackWeight] = useState(true);
  const [newExerciseTrackReps, setNewExerciseTrackReps] = useState(true);
  const [newExerciseTrackDistance, setNewExerciseTrackDistance] =
    useState(false);
  const [newExerciseTrackDuration, setNewExerciseTrackDuration] =
    useState(false);
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [showExerciseDropdown, setShowExerciseDropdown] = useState(false);
  const exerciseInputRef = useRef<HTMLInputElement>(null);

  const setIsAdding = (value: boolean) => {
    setIsAddingState(value);
    onAddingChange?.(value);
  };

  useImperativeHandle(ref, () => ({
    startAdding: () => setIsAdding(true),
    isAdding,
  }));

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragCounter = useRef(0);

  const resetForm = () => {
    setName("");
    setIcon("other");
    setValueType("text");
    setUnit("");
    setIsAdding(false);
    setEditingId(null);
    setShowIconPicker(false);
    setError(null);
    setNutritionGoal({});
    setCustomExercises([]);
    setNewExerciseName("");
    setNewExerciseCategory("strength");
    setNewExerciseTrackWeight(true);
    setNewExerciseTrackReps(true);
    setNewExerciseTrackDistance(false);
    setNewExerciseTrackDuration(false);
    setShowAddExercise(false);
  };

  const handleAddExercise = () => {
    if (!newExerciseName.trim()) return;

    // Check if exercise already exists in custom exercises only
    // (Built-in exercises are already available, so selecting one from dropdown is just for customizing tracking options)
    const existsInCustom = customExercises.some(
      (e) => e.name.toLowerCase() === newExerciseName.trim().toLowerCase(),
    );

    if (existsInCustom) {
      setError("You already have a custom exercise with this name.");
      return;
    }

    setCustomExercises([
      ...customExercises,
      {
        name: newExerciseName.trim(),
        category: newExerciseCategory,
        trackWeight: newExerciseTrackWeight,
        trackReps: newExerciseTrackReps,
        trackDistance: newExerciseTrackDistance,
        trackDuration: newExerciseTrackDuration,
      },
    ]);

    // Reset new exercise form
    setNewExerciseName("");
    setNewExerciseCategory("strength");
    setNewExerciseTrackWeight(true);
    setNewExerciseTrackReps(true);
    setNewExerciseTrackDistance(false);
    setNewExerciseTrackDuration(false);
    setShowAddExercise(false);
    setError(null);
  };

  const handleRemoveExercise = (exerciseName: string) => {
    setCustomExercises(customExercises.filter((e) => e.name !== exerciseName));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Check for duplicate name (case-insensitive)
    const nameExists = activityTypes.some(
      (t) =>
        t.name.toLowerCase() === name.trim().toLowerCase() &&
        t.id !== editingId,
    );

    if (nameExists) {
      setError("An activity type with this name already exists.");
      return;
    }

    setError(null);

    if (editingId) {
      const existing = activityTypes.find((t) => t.id === editingId);
      if (existing) {
        await updateActivityType({
          ...existing,
          name: name.trim(),
          icon: icon || undefined,
          valueType,
          nutritionGoal: valueType === "nutrition" ? nutritionGoal : undefined,
          customExercises:
            valueType === "workout" && customExercises.length > 0
              ? customExercises
              : undefined,
        });
      }
    } else {
      await addActivityType({
        name: name.trim(),
        icon: icon || undefined,
        valueType,
        nutritionGoal: valueType === "nutrition" ? nutritionGoal : undefined,
        customExercises:
          valueType === "workout" && customExercises.length > 0
            ? customExercises
            : undefined,
      });
    }

    resetForm();
  };

  const handleEdit = (type: ActivityType) => {
    setEditingId(type.id);
    setName(type.name);
    setIcon(type.icon || "other");
    setValueType(type.valueType as ValueType);
    setUnit(type.unit || "");
    setNutritionGoal(type.nutritionGoal || {});
    setCustomExercises(type.customExercises || []);
    setIsAdding(true);
  };

  const handleDelete = async (id: string) => {
    if (
      confirm(
        "Delete this activity type? Existing entries will not be deleted.",
      )
    ) {
      await deleteActivityType(id);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
    // Add a slight delay to allow the drag image to be set
    setTimeout(() => {
      const target = e.target as HTMLElement;
      target.style.opacity = "0.5";
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const target = e.target as HTMLElement;
    target.style.opacity = "1";
    setDraggedIndex(null);
    setDragOverIndex(null);
    dragCounter.current = 0;
  };

  const handleDragEnter = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    dragCounter.current++;
    if (draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setDragOverIndex(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDragOverIndex(null);
      return;
    }

    const newOrder = [...activityTypes];
    const [draggedItem] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(dropIndex, 0, draggedItem);
    reorderActivityTypes(newOrder);

    setDraggedIndex(null);
    setDragOverIndex(null);
    dragCounter.current = 0;
  };

  // Check if icon is a known icon or an emoji
  const renderIcon = (iconName: string | undefined) => {
    if (!iconName) return null;
    if (iconName in icons) {
      return <Icon name={iconName as IconName} className='w-6 h-6' />;
    }
    // Fallback to emoji
    return <span className='text-xl'>{iconName}</span>;
  };

  return (
    <div className='space-y-4'>
      {/* Add/Edit Form */}
      {isAdding && (
        <form onSubmit={handleSubmit} className='px-4 pb-4 space-y-4'>
          <div>
            <label className='block text-[13px] font-normal text-gray-500 dark:text-gray-400 mb-1 px-1'>
              Name *
            </label>
            <input
              type='text'
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder='E.g. Exercise'
              className={cn(
                "w-full px-3 py-2.5 rounded-lg text-[17px]",
                "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white",
                "focus:outline-none focus:ring-2 focus:ring-ios-blue",
                "placeholder:text-gray-400",
                error && "ring-2 ring-ios-red",
              )}
            />
            {error && (
              <p className='text-[13px] text-ios-red mt-1 px-1'>{error}</p>
            )}
          </div>

          <div>
            <label className='block text-[13px] font-normal text-gray-500 dark:text-gray-400 mb-1 px-1'>
              Icon
            </label>
            <button
              type='button'
              onClick={() => setShowIconPicker(!showIconPicker)}
              className={cn(
                "w-full px-3 py-2.5 rounded-lg text-[17px]",
                "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white",
                "flex items-center justify-center gap-2",
              )}>
              {renderIcon(icon)}
              <span className='text-[15px] text-gray-500'>Select icon</span>
            </button>
          </div>

          {/* Icon Picker */}
          {showIconPicker && (
            <div className='p-3 rounded-xl bg-gray-50 dark:bg-gray-800'>
              <p className='text-[13px] text-gray-500 dark:text-gray-400 mb-2'>
                Select an icon:
              </p>
              <IconPicker
                selectedIcon={icon}
                onSelect={(name) => {
                  setIcon(name);
                  setShowIconPicker(false);
                }}
              />
            </div>
          )}

          <div className='relative'>
            <label className='block text-[13px] font-normal text-gray-500 dark:text-gray-400 mb-1 px-1'>
              Value type
            </label>
            <button
              type='button'
              onClick={() => setShowValueTypePicker(!showValueTypePicker)}
              className={cn(
                "w-full px-3 py-2.5 rounded-lg text-[17px] text-left",
                "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white",
                "focus:outline-none focus:ring-2 focus:ring-ios-blue",
                "flex items-center justify-between",
              )}>
              <span>
                {VALUE_TYPE_OPTIONS.find((o) => o.value === valueType)?.label ||
                  valueType}
              </span>
              <svg
                className={cn(
                  "w-5 h-5 text-gray-400 transition-transform",
                  showValueTypePicker && "rotate-180",
                )}
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M19 9l-7 7-7-7'
                />
              </svg>
            </button>

            {showValueTypePicker && (
              <div className='absolute z-20 w-full mt-1 rounded-xl bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden'>
                {VALUE_TYPE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type='button'
                    onClick={() => {
                      setValueType(option.value);
                      setShowValueTypePicker(false);
                    }}
                    className={cn(
                      "w-full px-4 py-3 text-left flex items-center justify-between",
                      "hover:bg-gray-50 dark:hover:bg-gray-700/50",
                      valueType === option.value && "bg-ios-blue/10",
                    )}>
                    <div>
                      <p className='text-[17px] text-gray-900 dark:text-white'>
                        {option.label}
                      </p>
                      <p className='text-[13px] text-gray-500 dark:text-gray-400'>
                        {option.description}
                      </p>
                    </div>
                    {valueType === option.value && (
                      <svg
                        className='w-5 h-5 text-ios-blue'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'>
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2.5}
                          d='M5 13l4 4L19 7'
                        />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Nutrition Goals */}
          {valueType === "nutrition" && (
            <div className='space-y-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50'>
              <p className='text-[15px] font-medium text-gray-700 dark:text-gray-300'>
                Daily Goals (optional)
              </p>
              <div className='grid grid-cols-2 gap-3'>
                <div>
                  <label className='text-[13px] text-gray-500 mb-1 block'>
                    Calories (kcal)
                  </label>
                  <input
                    type='number'
                    value={nutritionGoal.calories || ""}
                    onChange={(e) =>
                      setNutritionGoal({
                        ...nutritionGoal,
                        calories: e.target.value
                          ? parseInt(e.target.value)
                          : undefined,
                      })
                    }
                    placeholder='e.g. 2000'
                    className='w-full px-3 py-2 rounded-lg text-[17px] bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 border border-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-ios-blue'
                  />
                </div>
                <div>
                  <label className='text-[13px] text-gray-500 mb-1 block'>
                    Protein (g)
                  </label>
                  <input
                    type='number'
                    value={nutritionGoal.protein || ""}
                    onChange={(e) =>
                      setNutritionGoal({
                        ...nutritionGoal,
                        protein: e.target.value
                          ? parseInt(e.target.value)
                          : undefined,
                      })
                    }
                    placeholder='e.g. 130'
                    className='w-full px-3 py-2 rounded-lg text-[17px] bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 border border-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-ios-blue'
                  />
                </div>
                <div>
                  <label className='text-[13px] text-gray-500 mb-1 block'>
                    Carbs (g)
                  </label>
                  <input
                    type='number'
                    value={nutritionGoal.carbs || ""}
                    onChange={(e) =>
                      setNutritionGoal({
                        ...nutritionGoal,
                        carbs: e.target.value
                          ? parseInt(e.target.value)
                          : undefined,
                      })
                    }
                    placeholder='e.g. 250'
                    className='w-full px-3 py-2 rounded-lg text-[17px] bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 border border-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-ios-blue'
                  />
                </div>
                <div>
                  <label className='text-[13px] text-gray-500 mb-1 block'>
                    Fat (g)
                  </label>
                  <input
                    type='number'
                    value={nutritionGoal.fat || ""}
                    onChange={(e) =>
                      setNutritionGoal({
                        ...nutritionGoal,
                        fat: e.target.value
                          ? parseInt(e.target.value)
                          : undefined,
                      })
                    }
                    placeholder='e.g. 65'
                    className='w-full px-3 py-2 rounded-lg text-[17px] bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 border border-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-ios-blue'
                  />
                </div>
              </div>
            </div>
          )}

          {/* Custom Exercises for Workout type */}
          {valueType === "workout" && (
            <div className='space-y-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50'>
              <div className='flex items-center justify-between'>
                <p className='text-[15px] font-medium text-gray-700 dark:text-gray-300'>
                  Custom Exercises
                </p>
                <button
                  type='button'
                  onClick={() => setShowAddExercise(!showAddExercise)}
                  className='text-[13px] font-medium text-ios-blue'>
                  + Add Exercise
                </button>
              </div>

              <p className='text-[13px] text-gray-500'>
                Add your own exercises in addition to the{" "}
                {COMMON_EXERCISES.length} built-in exercises.
              </p>

              {/* Add Exercise Form */}
              {showAddExercise && (
                <div className='space-y-3 p-3 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600'>
                  <div className='relative'>
                    <input
                      ref={exerciseInputRef}
                      type='text'
                      value={newExerciseName}
                      onChange={(e) => {
                        setNewExerciseName(e.target.value);
                        setShowExerciseDropdown(true);
                      }}
                      onFocus={() => setShowExerciseDropdown(true)}
                      onBlur={() =>
                        setTimeout(() => setShowExerciseDropdown(false), 200)
                      }
                      placeholder='Exercise name'
                      className='w-full px-3 py-2 rounded-lg text-[15px] bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-ios-blue'
                    />
                    {showExerciseDropdown && (
                      <div className='absolute z-20 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-auto'>
                        {COMMON_EXERCISES.filter(
                          (ex) =>
                            !customExercises.some(
                              (ce) =>
                                ce.name.toLowerCase() === ex.name.toLowerCase(),
                            ) &&
                            (newExerciseName === "" ||
                              ex.name
                                .toLowerCase()
                                .includes(newExerciseName.toLowerCase())),
                        ).map((exercise) => (
                          <button
                            key={exercise.name}
                            type='button'
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setNewExerciseName(exercise.name);
                              setNewExerciseCategory(exercise.category);
                              setNewExerciseTrackWeight(
                                exercise.trackWeight || false,
                              );
                              setNewExerciseTrackReps(
                                exercise.trackReps || false,
                              );
                              setNewExerciseTrackDistance(
                                exercise.trackDistance || false,
                              );
                              setNewExerciseTrackDuration(
                                exercise.trackDuration || false,
                              );
                              setShowExerciseDropdown(false);
                            }}
                            className='w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors'>
                            <span className='text-[15px] text-gray-900 dark:text-white'>
                              {exercise.name}
                            </span>
                            <span className='text-[12px] text-gray-500 ml-2 capitalize'>
                              {exercise.category}
                            </span>
                          </button>
                        ))}
                        {COMMON_EXERCISES.filter(
                          (ex) =>
                            !customExercises.some(
                              (ce) =>
                                ce.name.toLowerCase() === ex.name.toLowerCase(),
                            ) &&
                            (newExerciseName === "" ||
                              ex.name
                                .toLowerCase()
                                .includes(newExerciseName.toLowerCase())),
                        ).length === 0 &&
                          newExerciseName.trim() && (
                            <div className='px-3 py-2 text-[13px] text-gray-500'>
                              Create custom: "{newExerciseName}"
                            </div>
                          )}
                      </div>
                    )}
                  </div>

                  {/* Category selector */}
                  <div>
                    <label className='text-[12px] text-gray-500 mb-1 block'>
                      Category
                    </label>
                    <div className='flex gap-1'>
                      {(
                        [
                          "strength",
                          "cardio",
                          "flexibility",
                          "other",
                        ] as ExerciseCategory[]
                      ).map((cat) => (
                        <button
                          key={cat}
                          type='button'
                          onClick={() => setNewExerciseCategory(cat)}
                          className={cn(
                            "flex-1 py-1.5 rounded-lg text-[12px] capitalize",
                            newExerciseCategory === cat
                              ? "bg-ios-blue text-white"
                              : "bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300",
                          )}>
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tracking options */}
                  <div>
                    <label className='text-[12px] text-gray-500 mb-1 block'>
                      Track
                    </label>
                    <div className='flex flex-wrap gap-2'>
                      <button
                        type='button'
                        onClick={() =>
                          setNewExerciseTrackWeight(!newExerciseTrackWeight)
                        }
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-[13px]",
                          newExerciseTrackWeight
                            ? "bg-ios-blue text-white"
                            : "bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300",
                        )}>
                        Weight (kg)
                      </button>
                      <button
                        type='button'
                        onClick={() =>
                          setNewExerciseTrackReps(!newExerciseTrackReps)
                        }
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-[13px]",
                          newExerciseTrackReps
                            ? "bg-ios-blue text-white"
                            : "bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300",
                        )}>
                        Sets/Reps
                      </button>
                      <button
                        type='button'
                        onClick={() =>
                          setNewExerciseTrackDistance(!newExerciseTrackDistance)
                        }
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-[13px]",
                          newExerciseTrackDistance
                            ? "bg-ios-blue text-white"
                            : "bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300",
                        )}>
                        Distance (km)
                      </button>
                      <button
                        type='button'
                        onClick={() =>
                          setNewExerciseTrackDuration(!newExerciseTrackDuration)
                        }
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-[13px]",
                          newExerciseTrackDuration
                            ? "bg-ios-blue text-white"
                            : "bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300",
                        )}>
                        Duration (min)
                      </button>
                    </div>
                  </div>

                  <div className='flex gap-2'>
                    <button
                      type='button'
                      onClick={handleAddExercise}
                      disabled={!newExerciseName.trim()}
                      className='flex-1 py-2.5 rounded-full text-[14px] font-medium bg-ios-blue text-white shadow-lg shadow-ios-blue/30 disabled:opacity-50'>
                      Add
                    </button>
                    <button
                      type='button'
                      onClick={() => setShowAddExercise(false)}
                      className='flex-1 py-2.5 rounded-full text-[14px] font-medium bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Custom Exercises List */}
              {customExercises.length > 0 && (
                <div className='space-y-1'>
                  <p className='text-[12px] text-gray-500 mb-2'>
                    Your custom exercises:
                  </p>
                  {customExercises.map((exercise) => (
                    <div
                      key={exercise.name}
                      className='flex items-center justify-between p-2 rounded-lg bg-white dark:bg-gray-700'>
                      <div>
                        <span className='text-[15px] text-gray-900 dark:text-white'>
                          {exercise.name}
                        </span>
                        <div className='flex gap-1 mt-0.5'>
                          <span className='text-[11px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-600 text-gray-500 capitalize'>
                            {exercise.category}
                          </span>
                          {exercise.trackWeight && (
                            <span className='text-[11px] px-1.5 py-0.5 rounded bg-ios-blue/10 text-ios-blue'>
                              kg
                            </span>
                          )}
                          {exercise.trackReps && (
                            <span className='text-[11px] px-1.5 py-0.5 rounded bg-ios-green/10 text-ios-green'>
                              reps
                            </span>
                          )}
                          {exercise.trackDistance && (
                            <span className='text-[11px] px-1.5 py-0.5 rounded bg-ios-orange/10 text-ios-orange'>
                              km
                            </span>
                          )}
                          {exercise.trackDuration && (
                            <span className='text-[11px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-500'>
                              min
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type='button'
                        onClick={() => handleRemoveExercise(exercise.name)}
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
                  ))}
                </div>
              )}
            </div>
          )}

          <div className='flex gap-2 pt-2'>
            <button
              type='submit'
              className='flex-1 py-2.5 rounded-full text-[15px] font-medium bg-ios-blue text-white shadow-lg shadow-ios-blue/30'>
              {editingId ? "Update" : "Add"}
            </button>
            <button
              type='button'
              onClick={resetForm}
              className='flex-1 py-2.5 rounded-full text-[15px] font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Activity Types List */}
      <div>
        {activityTypes.map((type, index) => {
          const isDragging = draggedIndex === index;
          const isDragOver = dragOverIndex === index;
          const isLast = index === activityTypes.length - 1;

          return (
            <div
              key={type.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnd={handleDragEnd}
              onDragEnter={(e) => handleDragEnter(e, index)}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, index)}
              className={cn(
                "flex items-center min-h-[56px] px-4",
                "cursor-grab active:cursor-grabbing",
                isDragging && "opacity-50",
                isDragOver && "bg-ios-blue/10",
              )}>
              {/* Drag handle */}
              <div className='text-gray-400 dark:text-gray-500 mr-3'>
                <svg
                  className='w-5 h-5'
                  fill='currentColor'
                  viewBox='0 0 24 24'>
                  <path d='M8 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM8 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM8 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM14 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM14 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0z' />
                </svg>
              </div>

              {/* Icon */}
              <div className='w-8 h-8 rounded-lg bg-ios-blue/10 flex items-center justify-center mr-3 shrink-0'>
                <span className='text-ios-blue'>{renderIcon(type.icon)}</span>
              </div>

              {/* Content */}
              <div
                className={cn(
                  "flex-1 py-3 flex items-center justify-between",
                  !isLast &&
                    "border-b border-gray-200/80 dark:border-gray-700/80",
                )}>
                <div className='flex-1 min-w-0'>
                  <p
                    className={cn(
                      "text-[17px]",
                      type.hidden
                        ? "text-gray-400 dark:text-gray-500"
                        : "text-gray-900 dark:text-white",
                    )}>
                    {type.name}
                  </p>
                  <p className='text-[13px] text-gray-500 dark:text-gray-400'>
                    {VALUE_TYPE_OPTIONS.find((o) => o.value === type.valueType)
                      ?.label || type.valueType}
                  </p>
                </div>

                {/* Edit/Delete/Hide buttons */}
                <div className='flex items-center gap-1'>
                  <button
                    onClick={() => handleEdit(type)}
                    className='p-2 text-ios-blue rounded-lg'
                    title='Edit'>
                    <svg
                      className='w-5 h-5'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'>
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z'
                      />
                    </svg>
                  </button>
                  {/* Hide/Show button for all activity types */}
                  <button
                    onClick={() => toggleActivityTypeHidden(type.id)}
                    className={cn(
                      "p-2 rounded-lg",
                      type.hidden ? "text-gray-400" : "text-ios-orange",
                    )}
                    title={type.hidden ? "Show" : "Hide"}>
                    {type.hidden ? (
                      <svg
                        className='w-5 h-5'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'>
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21'
                        />
                      </svg>
                    ) : (
                      <svg
                        className='w-5 h-5'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'>
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M15 12a3 3 0 11-6 0 3 3 0 016 0z'
                        />
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'
                        />
                      </svg>
                    )}
                  </button>
                  {/* Delete button only for non-default types */}
                  {!type.isDefault && (
                    <button
                      onClick={() => handleDelete(type.id)}
                      className='p-2 text-ios-red rounded-lg'
                      title='Delete'>
                      <svg
                        className='w-5 h-5'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'>
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
                        />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
