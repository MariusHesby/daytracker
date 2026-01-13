"use client";

import { usePeriodAlert } from "@/context/PeriodAlertContext";
import { useLanguage } from "@/context/LanguageContext";

export function PeriodAlertPopup() {
  const { currentAlert, dismissAlert } = usePeriodAlert();
  const { t } = useLanguage();

  if (!currentAlert) return null;

  const getMoodEmoji = () => {
    if (currentAlert.currentMood === "sad") return "🔴";
    if (currentAlert.currentMood === "happy") return "🟢";
    if (currentAlert.currentMood === "neutral") return "🟠";
    return "❓";
  };

  const getMoodMessage = () => {
    const { currentMood, previousMood } = currentAlert;

    if (currentMood === "sad") {
      return t("period.moodSad");
    }
    if (currentMood === "happy") {
      return t("period.moodHappy");
    }
    if (currentMood === "neutral") {
      // Orange message depends on previous mood
      if (previousMood === "sad") {
        return t("period.moodNeutralFromSad");
      } else {
        // From happy or unknown
        return t("period.moodNeutralFromHappy");
      }
    }
    return "";
  };

  const getMoodColor = () => {
    if (currentAlert.currentMood === "sad") return "bg-red-500";
    if (currentAlert.currentMood === "happy") return "bg-green-500";
    if (currentAlert.currentMood === "neutral") return "bg-orange-500";
    return "bg-gray-500";
  };

  return (
    <div className='fixed inset-0 z-[100] flex items-center justify-center'>
      <div className='absolute inset-0 bg-black/50' onClick={dismissAlert} />
      <div className='relative bg-white dark:bg-gray-800 rounded-2xl p-6 mx-4 max-w-sm w-full shadow-xl'>
        <div className='text-center'>
          <div className='text-6xl mb-4'>{getMoodEmoji()}</div>
          <h3 className='text-xl font-bold text-gray-900 dark:text-white mb-2'>
            {t("period.alertTitle")}
          </h3>
          <p className='text-[15px] font-medium text-gray-700 dark:text-gray-300 mb-3'>
            {currentAlert.friendName}
          </p>
          <div
            className={`${getMoodColor()} text-white rounded-xl p-4 mb-4 text-[15px] leading-relaxed`}>
            {getMoodMessage()}
          </div>
          <button
            onClick={dismissAlert}
            className='w-full px-4 py-3 bg-ios-blue text-white rounded-lg text-[17px] font-medium'>
            {t("common.ok")}
          </button>
        </div>
      </div>
    </div>
  );
}
