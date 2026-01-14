"use client";

import { usePeriodAlert } from "@/context/PeriodAlertContext";

export function PeriodAlertPopup() {
  const { currentAlert, dismissAlert } = usePeriodAlert();

  if (!currentAlert) return null;

  const getMoodIcon = () => {
    if (currentAlert.currentMood === "sad") {
      return (
        <div className='w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center'>
          <svg
            className='w-7 h-7 text-red-500'
            fill='none'
            viewBox='0 0 24 24'
            stroke='currentColor'
            strokeWidth='2'>
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
            />
          </svg>
        </div>
      );
    }
    if (currentAlert.currentMood === "happy") {
      return (
        <div className='w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center'>
          <svg
            className='w-7 h-7 text-green-500'
            fill='none'
            viewBox='0 0 24 24'
            stroke='currentColor'
            strokeWidth='2'>
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
            />
          </svg>
        </div>
      );
    }
    if (currentAlert.currentMood === "neutral") {
      return (
        <div className='w-14 h-14 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center'>
          <svg
            className='w-7 h-7 text-orange-500'
            fill='none'
            viewBox='0 0 24 24'
            stroke='currentColor'
            strokeWidth='2'>
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
            />
          </svg>
        </div>
      );
    }
    return (
      <div className='w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center'>
        <span className='text-2xl'>❓</span>
      </div>
    );
  };

  const getMoodMessage = () => {
    if (currentAlert.currentMood === "sad") {
      return "Oh no, she's on her period. Please note: logic, solutions, and suggestions are temporarily unavailable.";
    }
    if (currentAlert.currentMood === "happy") {
      return "Whoop whoop, the shop is open! Buying her some nice flowers now could be a strategic move.";
    }
    if (currentAlert.currentMood === "neutral") {
      return "Yellow warning light — proceed with caution!";
    }
    return "";
  };

  const getAccentColor = () => {
    if (currentAlert.currentMood === "sad") return "text-red-500";
    if (currentAlert.currentMood === "happy") return "text-green-500";
    if (currentAlert.currentMood === "neutral") return "text-orange-500";
    return "text-gray-500";
  };

  const getBorderColor = () => {
    if (currentAlert.currentMood === "sad")
      return "border-red-200 dark:border-red-800";
    if (currentAlert.currentMood === "happy")
      return "border-green-200 dark:border-green-800";
    if (currentAlert.currentMood === "neutral")
      return "border-orange-200 dark:border-orange-800";
    return "border-gray-200 dark:border-gray-700";
  };

  return (
    <div className='fixed inset-0 z-[100] flex items-center justify-center p-4'>
      <div
        className='absolute inset-0 bg-black/30 backdrop-blur-sm'
        onClick={dismissAlert}
      />
      <div
        className={`relative bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm shadow-2xl border ${getBorderColor()} overflow-hidden animate-in slide-in-from-bottom-4 duration-300`}>
        {/* Header */}
        <div className='px-5 pt-5 pb-4 flex items-start gap-4'>
          {getMoodIcon()}
          <div className='flex-1 min-w-0 pt-1'>
            <p
              className={`text-[13px] font-semibold uppercase tracking-wide ${getAccentColor()}`}>
              Period Alert
            </p>
            <p className='text-[17px] font-semibold text-gray-900 dark:text-white truncate'>
              {currentAlert.friendName}
            </p>
          </div>
        </div>

        {/* Message */}
        <div className='px-5 pb-5'>
          <p className='text-[15px] text-gray-600 dark:text-gray-300 leading-relaxed'>
            {getMoodMessage()}
          </p>
        </div>

        {/* Divider */}
        <div className='h-px bg-gray-200 dark:bg-gray-700' />

        {/* Action */}
        <button
          onClick={dismissAlert}
          className='w-full px-5 py-3.5 text-ios-blue text-[17px] font-semibold active:bg-gray-100 dark:active:bg-gray-700 transition-colors'>
          OK
        </button>
      </div>
    </div>
  );
}
