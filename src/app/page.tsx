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
      {/* Date Navigator */}
      <div className='px-4 pt-6 pb-4'>
        <DateNavigator date={selectedDate} onChange={setSelectedDate} />
      </div>

      {/* Main Content */}
      <main className='px-4 pb-6'>
        <EntryForm date={selectedDate} />
      </main>
    </div>
  );
}
