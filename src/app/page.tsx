"use client";

import { useEffect, useRef } from "react";
import { useApp } from "@/context/AppContext";
import { EntryForm, DateNavigator } from "@/components";
import { addDays } from "@/lib/utils";

export default function HomePage() {
  const { selectedDate, setSelectedDate, loadEntriesForDateRange, isLoading } =
    useApp();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load entries for a wide range to support media date updates
  useEffect(() => {
    const start = "2000-01-01";
    const end = addDays(selectedDate, 365);
    loadEntriesForDateRange(start, end);
  }, [selectedDate, loadEntriesForDateRange]);

  if (isLoading) {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <div className='flex flex-col items-center gap-3'>
          <div className='w-8 h-8 border-3 border-gray-200 border-t-ios-blue rounded-full animate-spin'></div>
          <div className='text-gray-500 text-[15px]'>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className='min-h-screen overflow-y-auto'>
      {/* Header with Logo */}
      <div className='flex items-center justify-center gap-3 pt-6 pb-2'>
        <svg
          className='w-10 h-10'
          viewBox='0 0 512 512'
          fill='none'
          xmlns='http://www.w3.org/2000/svg'>
          <path
            d='M160 120 L160 392 L280 392 C360 392 420 320 420 256 C420 192 360 120 280 120 L160 120 Z'
            fill='none'
            stroke='currentColor'
            strokeWidth='32'
            strokeLinecap='round'
            strokeLinejoin='round'
            className='text-ios-blue'
          />
          <circle
            cx='220'
            cy='200'
            r='20'
            fill='currentColor'
            className='text-ios-blue'
          />
          <circle
            cx='220'
            cy='256'
            r='20'
            fill='currentColor'
            className='text-ios-blue'
          />
          <circle
            cx='220'
            cy='312'
            r='20'
            fill='currentColor'
            className='text-ios-blue'
          />
          <line
            x1='240'
            y1='200'
            x2='320'
            y2='200'
            stroke='currentColor'
            strokeWidth='12'
            strokeLinecap='round'
            className='text-ios-blue'
          />
          <line
            x1='240'
            y1='256'
            x2='340'
            y2='256'
            stroke='currentColor'
            strokeWidth='12'
            strokeLinecap='round'
            className='text-ios-blue'
          />
          <line
            x1='240'
            y1='312'
            x2='300'
            y2='312'
            stroke='currentColor'
            strokeWidth='12'
            strokeLinecap='round'
            className='text-ios-blue'
          />
        </svg>
        <h1 className='text-xl font-semibold text-gray-900 dark:text-white'>
          DayTracker
        </h1>
      </div>

      {/* Date Navigator */}
      <div className='px-4 pt-2 pb-4'>
        <DateNavigator date={selectedDate} onChange={setSelectedDate} />
      </div>

      {/* Main Content */}
      <main className='px-4 pb-6'>
        <EntryForm date={selectedDate} />
      </main>
    </div>
  );
}
