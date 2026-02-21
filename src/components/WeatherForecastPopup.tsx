"use client";

import { useEffect, useState } from "react";
import {
  fetchForecast,
  ForecastData,
  HourlyForecast,
  getWeatherCondition,
  getStoredLocation,
} from "@/lib/weather";

interface WeatherForecastPopupProps {
  isOpen: boolean;
  onClose: () => void;
  locationName: string;
}

export function WeatherForecastPopup({
  isOpen,
  onClose,
  locationName,
}: WeatherForecastPopupProps) {
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dayOffset, setDayOffset] = useState(0); // 0 = today, 1-7 = next days

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setDayOffset(0);
    const location = getStoredLocation();
    if (!location) {
      setLoading(false);
      return;
    }
    fetchForecast(location.latitude, location.longitude).then((data) => {
      setForecast(data);
      setLoading(false);
    });
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Get the date string for the current dayOffset
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + dayOffset);
  const targetStr = targetDate.toISOString().split("T")[0];

  // Get hours for the selected day
  const currentHour = new Date().getHours();
  const dayHours: HourlyForecast[] = (forecast?.hourly ?? []).filter((h) => {
    const hDate = h.time.split("T")[0];
    if (hDate !== targetStr) return false;
    const hHour = parseInt(h.time.split("T")[1].split(":")[0]);
    // Today: start from current hour. Future days: start from 06:00
    if (dayOffset === 0) return hHour >= currentHour;
    return hHour >= 6;
  });

  // Show every 2 hours for compactness
  const displayHours = dayHours.filter((_, i) => i % 2 === 0);

  // Get the daily summary for the selected day
  const dailySummary = (forecast?.daily ?? []).find(
    (d) => d.date === targetStr,
  );

  const formatHour = (time: string) => {
    const hour = parseInt(time.split("T")[1].split(":")[0]);
    return `${hour.toString().padStart(2, "0")}`;
  };

  // Label for the current day
  const getDayLabel = () => {
    if (dayOffset === 0) return "Today";
    if (dayOffset === 1) return "Tomorrow";
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    return d.toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  };

  const maxDays = Math.min((forecast?.daily?.length ?? 1) - 1, 7);

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center'>
      {/* Backdrop */}
      <div
        className='absolute inset-0 bg-black/40 backdrop-blur-sm'
        onClick={onClose}
      />

      {/* Popup */}
      <div className='relative w-full max-w-sm mx-4 bg-white dark:bg-gray-900 rounded-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-200 shadow-xl'>
        {/* Header */}
        <div className='flex items-center justify-between px-4 py-3 border-b border-gray-200/80 dark:border-gray-700/50'>
          <button
            onClick={() => setDayOffset((d) => Math.max(0, d - 1))}
            className={`text-[15px] font-medium transition-colors ${
              dayOffset > 0
                ? "text-ios-blue active:opacity-60"
                : "text-gray-300 dark:text-gray-600"
            }`}
            disabled={dayOffset === 0}>
            ← Prev
          </button>
          <h2 className='text-[15px] font-semibold text-gray-900 dark:text-white'>
            {locationName}
          </h2>
          <button
            onClick={() => setDayOffset((d) => Math.min(maxDays, d + 1))}
            className={`text-[15px] font-medium transition-colors ${
              dayOffset < maxDays
                ? "text-ios-blue active:opacity-60"
                : "text-gray-300 dark:text-gray-600"
            }`}
            disabled={dayOffset >= maxDays}>
            Next →
          </button>
        </div>

        {/* Day label */}
        <div className='px-4 pt-3 pb-1'>
          <p className='text-[13px] font-medium text-gray-400 dark:text-gray-500'>
            {getDayLabel()}
          </p>
        </div>

        {/* Content */}
        <div className='p-4 pt-2'>
          {loading ? (
            <div className='flex items-center justify-center py-8'>
              <div className='w-5 h-5 border-2 border-ios-blue border-t-transparent rounded-full animate-spin' />
            </div>
          ) : !forecast ? (
            <p className='text-center text-gray-400 py-8 text-sm'>
              Unable to load forecast
            </p>
          ) : (
            <div>
              {/* Day summary */}
              {dailySummary && (
                <div className='flex items-center justify-between mb-4 pb-3 border-b border-gray-100 dark:border-gray-800'>
                  <div className='flex items-center gap-2'>
                    <span className='text-2xl'>
                      {getWeatherCondition(dailySummary.weatherCode, true).icon}
                    </span>
                    <div>
                      <p className='text-[13px] font-medium text-gray-500 dark:text-gray-400'>
                        {
                          getWeatherCondition(dailySummary.weatherCode, true)
                            .description
                        }
                      </p>
                      <p className='text-[12px] text-gray-400 dark:text-gray-500'>
                        {dailySummary.precipitationProbability > 0
                          ? `💧 ${dailySummary.precipitationProbability}%`
                          : "No precipitation"}
                      </p>
                    </div>
                  </div>
                  <div className='text-right'>
                    <span className='text-[13px] text-gray-400 dark:text-gray-500'>
                      H:{dailySummary.tempMax}° L:{dailySummary.tempMin}°
                    </span>
                  </div>
                </div>
              )}

              {/* Hourly scroll */}
              <div
                className='flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide'
                style={{ touchAction: "pan-x" }}>
                {displayHours.map((h, i) => {
                  const condition = getWeatherCondition(h.weatherCode, h.isDay);
                  const now = new Date();
                  const isNow =
                    dayOffset === 0 &&
                    parseInt(h.time.split("T")[1].split(":")[0]) ===
                      now.getHours();
                  return (
                    <div
                      key={i}
                      className='flex flex-col items-center gap-1 min-w-[44px]'>
                      <span className='text-[12px] text-gray-400 dark:text-gray-500 font-medium'>
                        {isNow ? "Now" : formatHour(h.time)}
                      </span>
                      <span className='text-lg leading-none'>
                        {condition.icon}
                      </span>
                      <span className='text-[14px] font-semibold text-gray-800 dark:text-gray-200'>
                        {h.temperature}°
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Close button */}
        <div className='px-4 pb-4'>
          <button
            onClick={onClose}
            className='w-full py-2.5 text-[15px] font-medium text-ios-blue active:opacity-60 transition-opacity'>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
