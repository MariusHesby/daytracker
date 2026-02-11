"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import {
  EntryForm,
  DateNavigator,
  SearchEntries,
  LoadingState,
  Avatar,
  NotificationBell,
} from "@/components";
import { addDays, formatDate } from "@/lib/utils";
import { IOSModal } from "@/components/ios";

export default function HomePage() {
  const {
    selectedDate,
    setSelectedDate,
    loadEntriesForDateRange,
    entries,
    isLoading,
    viewingUser,
    setViewingUser,
    isViewingOther,
    lockedDays,
  } = useApp();
  const { user, profile } = useAuth();
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

  // Streak popup state
  const [showStreakPopup, setShowStreakPopup] = useState(false);
  const [unlockedPage, setUnlockedPage] = useState(0);
  const UNLOCKED_PER_PAGE = 5;

  // Track if user answered trivia correctly TODAY
  const [triviaCorrectToday, setTriviaCorrectToday] = useState(false);

  // Listen for trivia correct changes (from EntryForm)
  useEffect(() => {
    const checkTriviaToday = () => {
      if (typeof window === "undefined") return;
      const stored = localStorage.getItem("triviaCorrectDate");
      const today = formatDate(new Date());
      setTriviaCorrectToday(stored === today);
    };

    // Load initial value
    checkTriviaToday();

    // Listen for storage changes and custom event
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "triviaCorrectDate") {
        checkTriviaToday();
      }
    };
    const handleTriviaUpdate = () => checkTriviaToday();

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("triviaCountUpdated", handleTriviaUpdate);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("triviaCountUpdated", handleTriviaUpdate);
    };
  }, []);

  // Calculate unlocked days from the first locked day to yesterday
  const unlockedDays = useMemo(() => {
    if (!lockedDays || lockedDays.length === 0) return [];

    // Find the earliest locked day
    const sortedLockedDays = [...lockedDays].sort();
    const firstLockedDate = sortedLockedDays[0];
    const lockedSet = new Set(lockedDays);

    // Get yesterday as the end date
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Build list of unlocked days from first locked day to yesterday
    const unlocked: string[] = [];
    const currentDate = new Date(firstLockedDate);

    while (currentDate <= yesterday) {
      const dateStr = formatDate(currentDate);
      if (!lockedSet.has(dateStr)) {
        unlocked.push(dateStr);
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Sort descending (most recent first)
    return unlocked.sort().reverse();
  }, [lockedDays]);

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
            <p className='text-sm font-medium'>Viewing their data</p>
            <p className='text-xs opacity-80'>
              {viewingUser.fullName || viewingUser.email}
            </p>
          </div>
          <button
            onClick={() => setViewingUser(null)}
            className='px-3 py-1.5 bg-white/20 rounded-full text-[13px] font-medium hover:bg-white/30 transition-colors'>
            Back to my data
          </button>
        </div>
      )}

      {/* Header with Search */}
      <div className='pt-8 pb-6'>
        {/* Full-width greeting header - iOS style */}
        {user && (
          <div className='px-4 mb-5'>
            <div className='relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 p-5 border border-gray-200/50 dark:border-gray-700/50'>
              {/* Subtle decorative elements */}
              <div className='absolute -top-12 -right-12 w-32 h-32 bg-ios-blue/5 rounded-full blur-2xl' />
              <div className='absolute -bottom-8 -left-8 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl' />

              <div className='relative flex items-center gap-4'>
                <div
                  className={`flex-shrink-0 ${isViewingOther ? "animate-heartbeat" : ""}`}>
                  <div className='relative'>
                    <div
                      className={`relative rounded-full ring-2 ring-ios-blue/20 dark:ring-ios-blue/30 ${isViewingOther ? "ring-pink-300" : ""}`}>
                      <Avatar
                        avatar={
                          isViewingOther
                            ? viewingUser?.avatar || null
                            : profile?.avatar || null
                        }
                        size='lg'
                      />
                    </div>
                  </div>
                </div>
                <div className='flex-1 min-w-0'>
                  <p className='text-gray-500 dark:text-gray-400 text-[13px] font-medium tracking-wide'>
                    {isViewingOther ? "Viewing" : "Good day,"}
                  </p>
                  <h1 className='text-[22px] font-bold text-gray-900 dark:text-white truncate leading-tight'>
                    {isViewingOther
                      ? viewingUser?.fullName || "User"
                      : profile?.fullName || "Welcome"}
                  </h1>
                </div>
              </div>
            </div>
          </div>
        )}
        {!user && (
          <div className='px-4 mb-4'>
            <div className='relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 p-5 border border-gray-200/50 dark:border-gray-700/50'>
              <div className='absolute -top-12 -right-12 w-32 h-32 bg-ios-blue/5 rounded-full blur-2xl' />
              <h1 className='relative text-2xl font-bold text-gray-900 dark:text-white'>
                DayTracker
              </h1>
            </div>
          </div>
        )}

        {/* Action buttons row */}
        <div className='px-4 flex items-center gap-2'>
          {/* Unlocked days and Trivia indicators on left */}
          {user && !isViewingOther && (
            <div className='flex items-center gap-3 mr-auto'>
              {/* Unlocked days button */}
              <button
                onClick={() => {
                  setUnlockedPage(0);
                  setShowStreakPopup(true);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${
                  unlockedDays.length > 0
                    ? "text-ios-orange"
                    : "text-gray-400 dark:text-gray-500"
                }`}
                title={`${unlockedDays.length} unlocked ${unlockedDays.length === 1 ? "day" : "days"}`}>
                <svg
                  className='w-5 h-5'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'
                  strokeWidth={2}>
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    d='M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z'
                  />
                </svg>
                <span className='text-[15px] font-semibold'>
                  {unlockedDays.length}
                </span>
              </button>
              {/* Trivia indicator - shows if answered correctly today */}
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all ${
                  triviaCorrectToday
                    ? "bg-amber-100 dark:bg-amber-900/40"
                    : "bg-gray-100 dark:bg-gray-800"
                }`}
                title={
                  triviaCorrectToday
                    ? "You got it right today! 🎉"
                    : "Answer a trivia correctly today"
                }>
                {triviaCorrectToday ? (
                  <svg
                    className='w-5 h-5 text-amber-500'
                    fill='currentColor'
                    viewBox='0 0 24 24'>
                    <path d='M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z' />
                  </svg>
                ) : (
                  <svg
                    className='w-5 h-5 text-gray-400 dark:text-gray-500'
                    fill='none'
                    viewBox='0 0 24 24'
                    stroke='currentColor'
                    strokeWidth={1.5}>
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      d='M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z'
                    />
                  </svg>
                )}
              </div>
            </div>
          )}
          {/* Notification Bell */}
          {user && <NotificationBell />}
          {/* View Mode Toggle */}
          <button
            onClick={() =>
              handleViewModeChange(viewMode === "list" ? "icons" : "list")
            }
            className='p-2 rounded-xl bg-gray-100 dark:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 transition-colors'
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
      <main className='px-4 pb-24'>
        <EntryForm
          date={selectedDate}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
        />
      </main>

      {/* Unlocked Days Info Popup */}
      <IOSModal
        isOpen={showStreakPopup}
        onClose={() => setShowStreakPopup(false)}
        title='Unlocked Days'>
        <div className='py-4'>
          <div className='text-center mb-4'>
            <div className='flex justify-center mb-3'>
              <svg
                className={`w-12 h-12 ${unlockedDays.length > 0 ? "text-ios-orange" : "text-ios-green"}`}
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
                strokeWidth={1.5}>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z'
                />
              </svg>
            </div>
            <p className='text-3xl font-bold text-gray-900 dark:text-white mb-2'>
              {unlockedDays.length} {unlockedDays.length === 1 ? "day" : "days"}
            </p>
            <p className='text-gray-500 dark:text-gray-400 text-[15px] leading-relaxed'>
              {unlockedDays.length > 0
                ? "Days that haven't been locked since your first locked day."
                : "All days are locked! Great job! 🎉"}
            </p>
          </div>

          {/* List of unlocked dates */}
          {unlockedDays.length > 0 && (
            <div className='mt-4'>
              <div className='space-y-2'>
                {unlockedDays
                  .slice(
                    unlockedPage * UNLOCKED_PER_PAGE,
                    (unlockedPage + 1) * UNLOCKED_PER_PAGE,
                  )
                  .map((date) => (
                    <button
                      key={date}
                      onClick={() => {
                        setSelectedDate(date);
                        setShowStreakPopup(false);
                      }}
                      className='w-full flex items-center justify-between px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors'>
                      <span className='text-[15px] text-gray-900 dark:text-white font-medium'>
                        {new Date(date + "T12:00:00").toLocaleDateString(
                          "en-US",
                          {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          },
                        )}
                      </span>
                      <svg
                        className='w-5 h-5 text-gray-400'
                        fill='none'
                        viewBox='0 0 24 24'
                        strokeWidth={1.5}
                        stroke='currentColor'>
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          d='M8.25 4.5l7.5 7.5-7.5 7.5'
                        />
                      </svg>
                    </button>
                  ))}
              </div>

              {/* Pagination */}
              {unlockedDays.length > UNLOCKED_PER_PAGE && (
                <div className='flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700'>
                  <button
                    onClick={() => setUnlockedPage((p) => Math.max(0, p - 1))}
                    disabled={unlockedPage === 0}
                    className='px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-[14px] font-medium text-gray-600 dark:text-gray-400 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors'>
                    Previous
                  </button>
                  <span className='text-[13px] text-gray-500 dark:text-gray-400'>
                    {unlockedPage + 1} /{" "}
                    {Math.ceil(unlockedDays.length / UNLOCKED_PER_PAGE)}
                  </span>
                  <button
                    onClick={() =>
                      setUnlockedPage((p) =>
                        Math.min(
                          Math.ceil(unlockedDays.length / UNLOCKED_PER_PAGE) -
                            1,
                          p + 1,
                        ),
                      )
                    }
                    disabled={
                      unlockedPage >=
                      Math.ceil(unlockedDays.length / UNLOCKED_PER_PAGE) - 1
                    }
                    className='px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-[14px] font-medium text-gray-600 dark:text-gray-400 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors'>
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </IOSModal>
    </div>
  );
}
