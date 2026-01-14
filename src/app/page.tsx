"use client";

import { useEffect, useRef } from "react";
import { useApp } from "@/context/AppContext";
import { useLanguage } from "@/context/LanguageContext";
import { EntryForm, DateNavigator, SearchEntries, QuickAdd } from "@/components";
import { addDays } from "@/lib/utils";

export default function HomePage() {
  const {
    selectedDate,
    setSelectedDate,
    loadEntriesForDateRange,
    isLoading,
    viewingUser,
    setViewingUser,
    isViewingOther,
  } = useApp();
  const { t } = useLanguage();
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
    <div ref={scrollRef} className='overflow-y-auto'>
      {/* Viewing Another User Banner */}
      {isViewingOther && viewingUser && (
        <div className='bg-ios-blue text-white px-4 py-3 flex items-center justify-between'>
          <div>
            <p className='text-sm font-medium'>{t("friends.viewingData")}</p>
            <p className='text-xs opacity-80'>{viewingUser.email}</p>
          </div>
          <button
            onClick={() => setViewingUser(null)}
            className='px-3 py-1.5 bg-white/20 rounded-lg text-sm font-medium hover:bg-white/30 transition-colors'>
            {t("friends.backToMyData")}
          </button>
        </div>
      )}

      {/* Header with Search */}
      <div className='px-4 pt-6 pb-4 flex items-center justify-between'>
        <h1 className='text-2xl font-bold text-gray-900 dark:text-white'>
          DayTracker
        </h1>
        <SearchEntries onSelectDate={setSelectedDate} />
      </div>

      {/* Date Navigator */}
      <div className='px-4 pt-1 pb-3'>
        <DateNavigator date={selectedDate} onChange={setSelectedDate} />
      </div>

      {/* Quick Add Widgets */}
      {!isViewingOther && (
        <div className='px-4 pb-3'>
          <QuickAdd date={selectedDate} />
        </div>
      )}

      {/* Main Content */}
      <main className='px-4 pb-4'>
        <EntryForm date={selectedDate} />
      </main>
    </div>
  );
}
