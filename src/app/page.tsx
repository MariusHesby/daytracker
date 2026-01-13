"use client";

import { useEffect, useRef, useState } from "react";
import { useApp } from "@/context/AppContext";
import { useLanguage } from "@/context/LanguageContext";
import { EntryForm, DateNavigator } from "@/components";
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
    entries,
    activityTypes,
  } = useApp();
  const { t } = useLanguage();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [periodAlert, setPeriodAlert] = useState<{
    show: boolean;
    mood: string;
    friendEmail: string;
  } | null>(null);

  // Load entries for a wide range to support media date updates
  useEffect(() => {
    const start = "2000-01-01";
    const end = addDays(selectedDate, 365);
    loadEntriesForDateRange(start, end);
  }, [selectedDate, loadEntriesForDateRange]);

  // Check for period mood changes when viewing a friend's data
  useEffect(() => {
    if (!isViewingOther || !viewingUser) return;

    // Check if we have period alert enabled for this friend
    const periodAlertFriendsList = JSON.parse(
      localStorage.getItem("periodAlertFriendsList") || "[]"
    );

    if (!periodAlertFriendsList.includes(viewingUser.id)) return;

    // Find the Period activity type
    const periodActivityType = activityTypes.find(
      (t) => t.name.toLowerCase() === "period" && t.valueType === "mood"
    );

    if (!periodActivityType) return;

    // Find today's Period entry
    const today = new Date().toISOString().split("T")[0];
    const periodEntry = entries.find(
      (e) => e.activityTypeId === periodActivityType.id && e.date === today
    );

    if (!periodEntry) return;

    // Check last seen mood for this friend
    const lastSeenKey = `periodLastSeen_${viewingUser.id}`;
    const lastSeenMood = localStorage.getItem(lastSeenKey);
    const currentMood = String(periodEntry.value);

    // If mood has changed (or first time seeing it), show alert
    if (lastSeenMood !== currentMood) {
      localStorage.setItem(lastSeenKey, currentMood);

      // Show alert for any mood (including first time)
      setPeriodAlert({
        show: true,
        mood: currentMood,
        friendEmail: viewingUser.email,
      });
    }
  }, [isViewingOther, viewingUser, entries, activityTypes]);

  const getMoodEmoji = (mood: string) => {
    if (mood === "happy") return "😊";
    if (mood === "neutral") return "😐";
    if (mood === "sad") return "😢";
    return mood;
  };

  const getMoodMessage = (mood: string) => {
    if (mood === "happy") return t("period.moodHappy");
    if (mood === "neutral") return t("period.moodNeutral");
    if (mood === "sad") return t("period.moodSad");
    return "";
  };

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

      {/* Header */}
      <div className='px-4 pt-6 pb-4'>
        <h1 className='text-2xl font-bold text-gray-900 dark:text-white'>
          DayTracker
        </h1>
      </div>

      {/* Date Navigator */}
      <div className='px-4 pt-1 pb-3'>
        <DateNavigator date={selectedDate} onChange={setSelectedDate} />
      </div>

      {/* Main Content */}
      <main className='px-4 pb-4'>
        <EntryForm date={selectedDate} />
      </main>

      {/* Period Alert Popup */}
      {periodAlert?.show && (
        <div className='fixed inset-0 z-50 flex items-center justify-center'>
          <div
            className='absolute inset-0 bg-black/50'
            onClick={() => setPeriodAlert(null)}
          />
          <div className='relative bg-white dark:bg-gray-800 rounded-2xl p-6 mx-4 max-w-sm w-full shadow-xl text-center'>
            <div className='text-6xl mb-4'>
              {getMoodEmoji(periodAlert.mood)}
            </div>
            <h3 className='text-xl font-bold text-gray-900 dark:text-white mb-2'>
              {t("period.alertTitle")}
            </h3>
            <p className='text-[15px] text-gray-600 dark:text-gray-400 mb-2'>
              {periodAlert.friendEmail}
            </p>
            <p className='text-[15px] text-gray-600 dark:text-gray-400 mb-4'>
              {getMoodMessage(periodAlert.mood)}
            </p>
            <button
              onClick={() => setPeriodAlert(null)}
              className='w-full px-4 py-3 bg-ios-blue text-white rounded-lg text-[17px] font-medium'>
              {t("common.ok")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
