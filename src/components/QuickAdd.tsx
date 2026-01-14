"use client";

import { useState, useEffect, useCallback } from "react";
import { useApp } from "@/context/AppContext";
import { ActivityType, LogEntry } from "@/types";
import { Icon, icons, IconName } from "./Icons";
import { cn } from "@/lib/utils";

interface QuickAddProps {
  date: string;
}

export function QuickAdd({ date }: QuickAddProps) {
  const {
    activityTypes,
    entries,
    addEntry,
    deleteEntry,
    isViewingOther,
    isDayLocked,
  } = useApp();
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);

  const isLocked = isDayLocked(date);

  // Load pinned activity types from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("quickAddPinnedActivities");
      if (stored) {
        try {
          setPinnedIds(JSON.parse(stored));
        } catch (e) {
          console.error("Failed to parse pinned activities:", e);
        }
      }
    }
  }, []);

  // Save pinned activities to localStorage
  const savePinnedIds = (ids: string[]) => {
    setPinnedIds(ids);
    localStorage.setItem("quickAddPinnedActivities", JSON.stringify(ids));
  };

  const togglePin = (typeId: string) => {
    const newPinned = pinnedIds.includes(typeId)
      ? pinnedIds.filter((id) => id !== typeId)
      : [...pinnedIds, typeId];
    savePinnedIds(newPinned);
  };

  // Get entries for today
  const todayEntries = entries.filter((e) => e.date === date);

  // Get pinned activity types
  const pinnedTypes = pinnedIds
    .map((id) => activityTypes.find((t) => t.id === id))
    .filter((t): t is ActivityType => t !== undefined);

  // Handle quick add action
  const handleQuickAdd = async (type: ActivityType) => {
    if (isViewingOther || isLocked) return;

    const existingEntries = todayEntries.filter(
      (e) => e.activityTypeId === type.id
    );

    if (type.valueType === "checkmark") {
      if (existingEntries.length > 0) {
        // Toggle off if already checked
        for (const entry of existingEntries) {
          await deleteEntry(entry.id);
        }
      } else {
        // Add checkmark
        await addEntry({
          date,
          activityTypeId: type.id,
          value: true,
        });
      }
    } else if (type.valueType === "counter") {
      const currentValue =
        existingEntries.length > 0 &&
        typeof existingEntries[0].value === "number"
          ? existingEntries[0].value
          : 0;
      const newValue = currentValue + 1;

      // Delete existing and add new value
      for (const entry of existingEntries) {
        await deleteEntry(entry.id);
      }
      await addEntry({
        date,
        activityTypeId: type.id,
        value: newValue,
      });
    } else if (type.valueType === "boolean") {
      if (existingEntries.length > 0) {
        // Toggle off
        for (const entry of existingEntries) {
          await deleteEntry(entry.id);
        }
      } else {
        await addEntry({
          date,
          activityTypeId: type.id,
          value: true,
        });
      }
    }
    // For text and mood types, we don't do quick add (need more input)
  };

  // Get status for an activity type
  const getStatus = (type: ActivityType) => {
    const existingEntries = todayEntries.filter(
      (e) => e.activityTypeId === type.id
    );

    if (type.valueType === "checkmark" || type.valueType === "boolean") {
      return existingEntries.length > 0;
    }
    if (type.valueType === "counter") {
      return existingEntries.length > 0 &&
        typeof existingEntries[0].value === "number"
        ? existingEntries[0].value
        : 0;
    }
    return existingEntries.length > 0;
  };

  // Quick-addable types (not text or mood)
  const quickAddableTypes = activityTypes.filter(
    (t) =>
      t.valueType === "checkmark" ||
      t.valueType === "counter" ||
      t.valueType === "boolean"
  );

  if (pinnedTypes.length === 0 && !isEditing) {
    return (
      <button
        onClick={() => setIsEditing(true)}
        className='w-full py-3 px-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-gray-400 text-sm flex items-center justify-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors'>
        <svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}>
          <path strokeLinecap='round' strokeLinejoin='round' d='M12 4v16m8-8H4' />
        </svg>
        Add quick actions
      </button>
    );
  }

  return (
    <div className='space-y-2'>
      {/* Quick Add Buttons */}
      {!isEditing && pinnedTypes.length > 0 && (
        <div className='flex flex-wrap gap-2'>
          {pinnedTypes.map((type) => {
            const status = getStatus(type);
            const isActive = type.valueType === "counter" 
              ? typeof status === "number" && status > 0 
              : Boolean(status);
            const isQuickAddable =
              type.valueType === "checkmark" ||
              type.valueType === "counter" ||
              type.valueType === "boolean";

            return (
              <button
                key={type.id}
                onClick={() => isQuickAddable && handleQuickAdd(type)}
                disabled={!isQuickAddable || isViewingOther || isLocked}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-xl transition-all",
                  isActive
                    ? "bg-ios-green/20 text-ios-green"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300",
                  isQuickAddable && !isViewingOther && !isLocked
                    ? "active:scale-95"
                    : "opacity-60",
                  isLocked && "pointer-events-none"
                )}>
                {/* Icon */}
                {type.icon && (
                  <div className='w-6 h-6 flex items-center justify-center'>
                    {type.icon in icons ? (
                      <Icon
                        name={type.icon as IconName}
                        className={cn(
                          "w-5 h-5",
                          isActive ? "text-ios-green" : "text-gray-500"
                        )}
                      />
                    ) : (
                      <span className='text-base'>{type.icon}</span>
                    )}
                  </div>
                )}
                {/* Label & Status */}
                <span className='text-sm font-medium'>{type.name}</span>
                {type.valueType === "counter" && typeof status === "number" && (
                  <span
                    className={cn(
                      "min-w-[20px] h-5 rounded-full text-xs font-bold flex items-center justify-center",
                      status > 0
                        ? "bg-ios-green text-white"
                        : "bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300"
                    )}>
                    {status}
                  </span>
                )}
                {(type.valueType === "checkmark" ||
                  type.valueType === "boolean") &&
                  isActive && (
                    <svg
                      className='w-4 h-4 text-ios-green'
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
            );
          })}
          {/* Edit button */}
          <button
            onClick={() => setIsEditing(true)}
            className='w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'>
            <svg
              className='w-4 h-4'
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
          </button>
        </div>
      )}

      {/* Edit Mode */}
      {isEditing && (
        <div className='bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700'>
          <div className='flex items-center justify-between mb-3'>
            <h3 className='font-medium text-gray-900 dark:text-white'>
              Quick Actions
            </h3>
            <button
              onClick={() => setIsEditing(false)}
              className='text-ios-blue text-sm font-medium'>
              Done
            </button>
          </div>
          <p className='text-xs text-gray-500 mb-3'>
            Pin activities for one-tap logging. Works with checkmarks, counters,
            and yes/no types.
          </p>
          <div className='space-y-1'>
            {quickAddableTypes.map((type) => {
              const isPinned = pinnedIds.includes(type.id);
              return (
                <button
                  key={type.id}
                  onClick={() => togglePin(type.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                    isPinned
                      ? "bg-ios-blue/10"
                      : "hover:bg-gray-50 dark:hover:bg-gray-700"
                  )}>
                  {/* Icon */}
                  {type.icon && (
                    <div
                      className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center",
                        isPinned ? "bg-ios-blue/20" : "bg-gray-100 dark:bg-gray-700"
                      )}>
                      {type.icon in icons ? (
                        <Icon
                          name={type.icon as IconName}
                          className={cn(
                            "w-5 h-5",
                            isPinned ? "text-ios-blue" : "text-gray-500"
                          )}
                        />
                      ) : (
                        <span className='text-lg'>{type.icon}</span>
                      )}
                    </div>
                  )}
                  {/* Name */}
                  <span
                    className={cn(
                      "flex-1 text-left text-[15px]",
                      isPinned
                        ? "text-ios-blue font-medium"
                        : "text-gray-700 dark:text-gray-300"
                    )}>
                    {type.name}
                  </span>
                  {/* Type badge */}
                  <span className='text-xs text-gray-400 capitalize'>
                    {type.valueType}
                  </span>
                  {/* Check */}
                  {isPinned && (
                    <svg
                      className='w-5 h-5 text-ios-blue'
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'
                      strokeWidth={2.5}>
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        d='M5 13l4 4L19 7'
                      />
                    </svg>
                  )}
                </button>
              );
            })}
            {quickAddableTypes.length === 0 && (
              <p className='text-center text-gray-400 py-4 text-sm'>
                No quick-addable activities. Create activities with checkmark,
                counter, or boolean types.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
