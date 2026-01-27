"use client";

import { useEffect, useRef, useState } from "react";
import { useApp } from "@/context/AppContext";
import { useLanguage } from "@/context/LanguageContext";
import {
  EntryForm,
  DateNavigator,
  SearchEntries,
  LoadingState,
} from "@/components";
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

  // View mode state
  const [viewMode, setViewMode] = useState<"list" | "icons">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("entryform-viewmode");
      return saved === "icons" ? "icons" : "list";
    }
    return "list";
  });

  const handleViewModeChange = (mode: "list" | "icons") => {
    setViewMode(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("entryform-viewmode", mode);
    }
  };

  // Load entries for a wide range to support media date updates
  useEffect(() => {
    const start = "2000-01-01";
    const end = addDays(selectedDate, 365);
    loadEntriesForDateRange(start, end);
  }, [selectedDate, loadEntriesForDateRange]);

  if (isLoading) {
    return <LoadingState />;
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
            className='px-3 py-1.5 bg-white/20 rounded-full text-[13px] font-medium hover:bg-white/30 transition-colors'>
            {t("friends.backToMyData")}
          </button>
        </div>
      )}

      {/* Header with Search */}
      <div className='px-4 pt-6 pb-4 flex items-center justify-between'>
        <h1 className='text-2xl font-bold text-gray-900 dark:text-white'>
          DayTracker
        </h1>
        <div className='flex items-center gap-2'>
          {/* View Mode Toggle */}
          <button
            onClick={() =>
              handleViewModeChange(viewMode === "list" ? "icons" : "list")
            }
            className='p-2 rounded-lg bg-gray-100 dark:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700'
            title={viewMode === "list" ? "Switch to icons" : "Switch to list"}>
            {viewMode === "list" ? (
              <svg
                className='w-5 h-5 text-gray-600 dark:text-gray-400'
                fill='none'
                viewBox='0 0 24 24'
                strokeWidth={1.5}
                stroke='currentColor'>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z'
                />
              </svg>
            ) : (
              <svg
                className='w-5 h-5 text-gray-600 dark:text-gray-400'
                fill='none'
                viewBox='0 0 24 24'
                strokeWidth={1.5}
                stroke='currentColor'>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z'
                />
              </svg>
            )}
          </button>
          <SearchEntries onSelectDate={setSelectedDate} />
        </div>
      </div>

      {/* Date Navigator */}
      <div className='px-4 pt-1 pb-3'>
        <DateNavigator date={selectedDate} onChange={setSelectedDate} />
      </div>

      {/* Main Content */}
      <main className='px-4 pb-4'>
        <EntryForm
          date={selectedDate}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
        />
      </main>
    </div>
  );
}
