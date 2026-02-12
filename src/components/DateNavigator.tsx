"use client";

import { useState, useEffect } from "react";
import { formatDisplayDate, isToday, addDays } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface DateNavigatorProps {
  date: string;
  onChange: (date: string) => void;
}

export function DateNavigator({ date, onChange }: DateNavigatorProps) {
  const [navigationCount, setNavigationCount] = useState(0);
  const [showHint, setShowHint] = useState(true);

  // Load navigation count from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedCount = localStorage.getItem("dateNavigatorHintCount");
      const count = savedCount ? parseInt(savedCount, 10) : 0;
      setNavigationCount(count);
      setShowHint(count < 3);
    }
  }, []);

  const incrementNavigationCount = () => {
    if (typeof window !== "undefined") {
      const newCount = navigationCount + 1;
      setNavigationCount(newCount);
      localStorage.setItem("dateNavigatorHintCount", newCount.toString());
      if (newCount >= 3) {
        setShowHint(false);
      }
    }
  };

  const handlePrevDay = () => {
    incrementNavigationCount();
    onChange(addDays(date, -1));
  };

  const handleNextDay = () => {
    incrementNavigationCount();
    onChange(addDays(date, 1));
  };

  const handleToday = () => {
    onChange(new Date().toISOString().split("T")[0]);
  };

  const today = isToday(date);

  return (
    <div className='flex items-center justify-between bg-gray-100/50 dark:bg-gray-800/30 rounded-xl border border-gray-200/50 dark:border-gray-700/30'>
      <button
        onClick={handlePrevDay}
        className={cn(
          "p-3 transition-opacity active:opacity-50",
          "text-gray-400 dark:text-gray-500",
        )}
        title='Previous day'>
        <svg
          className='w-6 h-6'
          fill='none'
          stroke='currentColor'
          viewBox='0 0 24 24'
          strokeWidth={2}>
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            d='M15 19l-7-7 7-7'
          />
        </svg>
      </button>

      <button
        onClick={handleToday}
        className={cn("flex-1 py-2 px-4 transition-opacity active:opacity-50")}>
        <span
          className={cn(
            "font-semibold text-[17px]",
            today ? "text-ios-blue" : "text-gray-600 dark:text-gray-300",
          )}>
          {today ? "Today" : formatDisplayDate(date)}
        </span>
        {!today && showHint && (
          <p className='text-[12px] text-gray-400 dark:text-gray-500 mt-0.5'>
            Tap to go to today
          </p>
        )}
      </button>

      <button
        onClick={handleNextDay}
        className={cn(
          "p-3 transition-opacity active:opacity-50",
          "text-gray-400 dark:text-gray-500",
        )}
        title='Next day'>
        <svg
          className='w-6 h-6'
          fill='none'
          stroke='currentColor'
          viewBox='0 0 24 24'
          strokeWidth={2}>
          <path strokeLinecap='round' strokeLinejoin='round' d='M9 5l7 7-7 7' />
        </svg>
      </button>
    </div>
  );
}
