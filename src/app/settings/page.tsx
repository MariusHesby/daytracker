"use client";

import { useRef, useState } from "react";
import { useApp } from "@/context/AppContext";
import { useTheme } from "@/context/ThemeContext";
import { useLanguage } from "@/context/LanguageContext";
import { ActivityTypeManager, ActivityTypeManagerRef } from "@/components";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { isLoading } = useApp();
  const { theme, setTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const activityManagerRef = useRef<ActivityTypeManagerRef>(null);
  const [isAddingActivity, setIsAddingActivity] = useState(false);

  if (isLoading) {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <div className='w-6 h-6 border-2 border-ios-blue border-t-transparent rounded-full animate-spin' />
      </div>
    );
  }

  const themeOptions = [
    { value: "light", label: t("settings.light") },
    { value: "dark", label: t("settings.dark") },
    { value: "system", label: t("settings.system") },
  ] as const;

  const languageOptions = [
    { value: "en", label: "English" },
    { value: "no", label: "Norsk" },
  ] as const;

  return (
    <div className='min-h-screen pb-24'>
      {/* Main Content */}
      <main className='max-w-lg mx-auto px-4 py-6 space-y-6'>
        {/* Language Section */}
        <section>
          <h2 className='text-[13px] font-normal text-gray-500 dark:text-gray-400 uppercase tracking-wide px-4 mb-2'>
            {t("settings.language")}
          </h2>
          <div className='bg-white/80 dark:bg-ios-card-dark rounded-xl overflow-hidden'>
            {languageOptions.map((option, index) => (
              <button
                key={option.value}
                onClick={() => setLanguage(option.value)}
                className={cn(
                  "w-full px-4 py-3 flex items-center justify-between min-h-[44px] text-left active:bg-gray-100 dark:active:bg-gray-700",
                  index < languageOptions.length - 1 &&
                    "border-b border-gray-200/80 dark:border-gray-700/80"
                )}>
                <span className='text-[17px] text-gray-900 dark:text-white'>
                  {option.label}
                </span>
                {language === option.value && (
                  <svg
                    className='w-5 h-5 text-ios-blue'
                    fill='none'
                    viewBox='0 0 24 24'
                    strokeWidth={2.5}
                    stroke='currentColor'>
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      d='M4.5 12.75l6 6 9-13.5'
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* Theme Section */}
        <section>
          <h2 className='text-[13px] font-normal text-gray-500 dark:text-gray-400 uppercase tracking-wide px-4 mb-2'>
            {t("settings.theme")}
          </h2>
          <div className='bg-white/80 dark:bg-ios-card-dark rounded-xl overflow-hidden'>
            {themeOptions.map((option, index) => (
              <button
                key={option.value}
                onClick={() => setTheme(option.value)}
                className={cn(
                  "w-full px-4 py-3 flex items-center justify-between min-h-[44px] text-left active:bg-gray-100 dark:active:bg-gray-700",
                  index < themeOptions.length - 1 &&
                    "border-b border-gray-200/80 dark:border-gray-700/80"
                )}>
                <span className='text-[17px] text-gray-900 dark:text-white'>
                  {option.label}
                </span>
                {theme === option.value && (
                  <svg
                    className='w-5 h-5 text-ios-blue'
                    fill='none'
                    viewBox='0 0 24 24'
                    strokeWidth={2.5}
                    stroke='currentColor'>
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      d='M4.5 12.75l6 6 9-13.5'
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* Activity Types Section */}
        <section>
          <div className='flex items-center justify-between px-4 mb-2'>
            <h2 className='text-[13px] font-normal text-gray-500 dark:text-gray-400 uppercase tracking-wide'>
              {t("settings.activityTypes")}
            </h2>
            {!isAddingActivity && (
              <button
                onClick={() => activityManagerRef.current?.startAdding()}
                className='text-[13px] font-medium text-ios-blue'>
                + Add
              </button>
            )}
          </div>
          <div className='bg-white/80 dark:bg-ios-card-dark rounded-xl overflow-hidden'>
            <ActivityTypeManager
              ref={activityManagerRef}
              onAddingChange={setIsAddingActivity}
            />
          </div>
        </section>

        {/* About Section */}
        <section>
          <h2 className='text-[13px] font-normal text-gray-500 dark:text-gray-400 uppercase tracking-wide px-4 mb-2'>
            {t("settings.about")}
          </h2>
          <div className='bg-white/80 dark:bg-ios-card-dark rounded-xl'>
            <div className='px-4 py-3 flex items-center justify-between min-h-[44px] border-b border-gray-200/80 dark:border-gray-700/80'>
              <span className='text-[17px] text-gray-900 dark:text-white'>
                {t("settings.app")}
              </span>
              <span className='text-[17px] text-gray-500'>DayTracker</span>
            </div>
            <div className='px-4 py-3 flex items-center justify-between min-h-[44px] border-b border-gray-200/80 dark:border-gray-700/80'>
              <span className='text-[17px] text-gray-900 dark:text-white'>
                {t("settings.version")}
              </span>
              <span className='text-[17px] text-gray-500'>1.0.0</span>
            </div>
            <div className='px-4 py-3 min-h-[44px]'>
              <span className='text-[17px] text-gray-900 dark:text-white'>
                {t("settings.dataStorage")}
              </span>
              <p className='text-[15px] text-gray-500 mt-1'>
                {t("settings.dataStorageDesc")}
              </p>
            </div>
          </div>
        </section>

        {/* Data Management */}
        <section>
          <h2 className='text-[13px] font-normal text-gray-500 dark:text-gray-400 uppercase tracking-wide px-4 mb-2'>
            {t("settings.data")}
          </h2>
          <div className='bg-white/80 dark:bg-ios-card-dark rounded-xl overflow-hidden'>
            <button
              onClick={() => {
                if (confirm(t("settings.deleteAllConfirm"))) {
                  indexedDB.deleteDatabase("daytracker-db");
                  window.location.reload();
                }
              }}
              className='w-full px-4 py-3 min-h-[44px] text-[17px] text-ios-red text-center active:bg-gray-100 dark:active:bg-gray-700'>
              {t("settings.deleteAllData")}
            </button>
          </div>
          <p className='text-[13px] text-gray-500 dark:text-gray-400 px-4 mt-2'>
            {t("settings.deleteAllDesc")}
          </p>
        </section>
      </main>
    </div>
  );
}
