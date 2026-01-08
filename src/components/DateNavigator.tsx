"use client";

import { formatDisplayDate, isToday, addDays } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface DateNavigatorProps {
  date: string;
  onChange: (date: string) => void;
}

export function DateNavigator({ date, onChange }: DateNavigatorProps) {
  const handlePrevDay = () => {
    onChange(addDays(date, -1));
  };

  const handleNextDay = () => {
    onChange(addDays(date, 1));
  };

  const handleToday = () => {
    onChange(new Date().toISOString().split("T")[0]);
  };

  const today = isToday(date);

  return (
    <div className='flex items-center justify-between bg-white/80 dark:bg-ios-card-dark rounded-xl'>
      <button
        onClick={handlePrevDay}
        className={cn(
          "p-2.5 rounded-lg transition-all",
          "text-ios-blue active:bg-gray-100 dark:active:bg-gray-700"
        )}
        title='Previous day'>
        <svg
          className='w-5 h-5'
          fill='none'
          stroke='currentColor'
          viewBox='0 0 24 24'
          strokeWidth={2.5}>
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            d='M15 19l-7-7 7-7'
          />
        </svg>
      </button>

      <button
        onClick={handleToday}
        className={cn(
          "flex-1 py-2 px-4 rounded-lg transition-all",
          "active:bg-gray-100 dark:active:bg-gray-700"
        )}>
        <span
          className={cn(
            "font-semibold text-[17px]",
            today ? "text-ios-blue" : "text-gray-900 dark:text-white"
          )}>
          {today ? "Today" : formatDisplayDate(date)}
        </span>
        {!today && (
          <p className='text-[13px] text-gray-500 dark:text-gray-400 mt-0.5'>
            Tap to go to today
          </p>
        )}
      </button>

      <button
        onClick={handleNextDay}
        className={cn(
          "p-2.5 rounded-lg transition-all",
          "text-ios-blue active:bg-gray-100 dark:active:bg-gray-700"
        )}
        title='Next day'>
        <svg
          className='w-5 h-5'
          fill='none'
          stroke='currentColor'
          viewBox='0 0 24 24'
          strokeWidth={2.5}>
          <path strokeLinecap='round' strokeLinejoin='round' d='M9 5l7 7-7 7' />
        </svg>
      </button>
    </div>
  );
}
