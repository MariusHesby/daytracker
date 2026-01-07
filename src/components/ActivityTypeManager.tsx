"use client";

import { useState, useRef, useImperativeHandle, forwardRef } from "react";
import { useApp } from "@/context/AppContext";
import { ActivityType } from "@/types";
import { cn } from "@/lib/utils";
import { Icon, IconPicker, icons, IconName } from "./Icons";

type ValueType = "text" | "boolean" | "checkmark" | "counter" | "mood";

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
    allActivityTypes: activityTypes,
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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Check for duplicate name (case-insensitive)
    const nameExists = activityTypes.some(
      (t) =>
        t.name.toLowerCase() === name.trim().toLowerCase() && t.id !== editingId
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
        });
      }
    } else {
      await addActivityType({
        name: name.trim(),
        icon: icon || undefined,
        valueType,
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
    setIsAdding(true);
  };

  const handleDelete = async (id: string) => {
    if (
      confirm(
        "Delete this activity type? Existing entries will not be deleted."
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
                error && "ring-2 ring-ios-red"
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
                "flex items-center justify-center gap-2"
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
                "flex items-center justify-between"
              )}>
              <span>
                {VALUE_TYPE_OPTIONS.find((o) => o.value === valueType)?.label ||
                  valueType}
              </span>
              <svg
                className={cn(
                  "w-5 h-5 text-gray-400 transition-transform",
                  showValueTypePicker && "rotate-180"
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
                      valueType === option.value && "bg-ios-blue/10"
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

          <div className='flex gap-2 pt-2'>
            <button
              type='submit'
              className='flex-1 py-2.5 rounded-lg text-[17px] font-medium bg-ios-blue text-white'>
              {editingId ? "Update" : "Add"}
            </button>
            <button
              type='button'
              onClick={resetForm}
              className='flex-1 py-2.5 rounded-lg text-[17px] font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'>
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
                isDragOver && "bg-ios-blue/10"
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
                    "border-b border-gray-200/80 dark:border-gray-700/80"
                )}>
                <div className='flex-1 min-w-0'>
                  <p
                    className={cn(
                      "text-[17px]",
                      type.hidden
                        ? "text-gray-400 dark:text-gray-500"
                        : "text-gray-900 dark:text-white"
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
                  {type.isDefault ? (
                    <button
                      onClick={() => toggleActivityTypeHidden(type.id)}
                      className={cn(
                        "p-2 rounded-lg",
                        type.hidden ? "text-gray-400" : "text-ios-red"
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
                  ) : (
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
