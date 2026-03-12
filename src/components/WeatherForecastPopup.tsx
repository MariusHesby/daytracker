"use client";

import { useEffect, useState, useRef, useCallback } from "react";
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
  const [dayOffset, setDayOffset] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollX, setScrollX] = useState(0);
  const itemWidth = 80;

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

  // Scroll to beginning when day changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ left: 0, behavior: "smooth" });
    }
  }, [dayOffset]);

  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      setScrollX(scrollRef.current.scrollLeft);
    }
  }, []);

  if (!isOpen) return null;

  // Get the date for the current dayOffset
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + dayOffset);
  const targetStr = targetDate.toISOString().split("T")[0];

  // Get hours for the selected day
  const currentHour = new Date().getHours();
  const dayHours: HourlyForecast[] = (forecast?.hourly ?? []).filter((h) => {
    const hDate = h.time.split("T")[0];
    if (hDate !== targetStr) return false;
    const hHour = parseInt(h.time.split("T")[1].split(":")[0]);
    if (dayOffset === 0) return hHour >= currentHour;
    return true;
  });

  // Daily summary
  const dailySummary = (forecast?.daily ?? []).find(
    (d) => d.date === targetStr,
  );

  const formatHour = (time: string) => {
    const hour = parseInt(time.split("T")[1].split(":")[0]);
    return `${hour.toString().padStart(2, "0")}:00`;
  };

  const getDayLabel = () => {
    if (dayOffset === 0) return "Today";
    if (dayOffset === 1) return "Tomorrow";
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const maxDays = Math.min((forecast?.daily?.length ?? 1) - 1, 7);

  // Smooth scale with interpolation based on scroll position
  const getSmoothedScale = (index: number) => {
    const containerWidth = scrollRef.current?.clientWidth ?? 360;
    const centerX = scrollX + containerWidth / 2;
    const itemCenterX = index * itemWidth + itemWidth / 2;
    const distance = Math.abs(centerX - itemCenterX);

    const normalizedDist = distance / itemWidth;
    if (normalizedDist < 0.3) return 3;
    if (normalizedDist < 1) {
      const t = (normalizedDist - 0.3) / 0.7;
      return 3 - t * 1;
    }
    if (normalizedDist < 1.8) {
      const t = (normalizedDist - 1) / 0.8;
      return 2 - t * 0.6;
    }
    if (normalizedDist < 2.8) {
      const t = (normalizedDist - 1.8) / 1;
      return 1.4 - t * 0.4;
    }
    return 1;
  };

  return (
    <div className='fixed inset-0 z-50 flex items-end justify-center sm:items-center'>
      {/* Backdrop */}
      <div
        className='absolute inset-0 bg-black/50 backdrop-blur-md'
        onClick={onClose}
      />

      {/* Popup */}
      <div className='relative w-full max-w-md mx-0 sm:mx-4 bg-white/90 dark:bg-gray-900/95 backdrop-blur-xl rounded-t-3xl sm:rounded-3xl overflow-hidden animate-in slide-in-from-bottom duration-300 shadow-2xl'>
        {/* Drag handle */}
        <div className='flex justify-center pt-3 pb-1 sm:hidden'>
          <div className='w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600' />
        </div>

        {/* Header with arrows and day label */}
        <div className='flex items-center justify-between px-5 pt-3 pb-2'>
          <button
            onClick={() => setDayOffset((d) => Math.max(0, d - 1))}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              dayOffset > 0
                ? "text-ios-blue active:bg-ios-blue/10 active:scale-90"
                : "text-gray-300 dark:text-gray-700"
            }`}
            disabled={dayOffset === 0}>
            <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'>
              <polyline points='15 18 9 12 15 6' />
            </svg>
          </button>

          <button
            onClick={() => setDayOffset(0)}
            className='flex flex-col items-center active:opacity-60 transition-opacity'>
            <span className='text-[17px] font-bold text-gray-900 dark:text-white'>
              {getDayLabel()}
            </span>
            {dailySummary && (
              <span className='text-[12px] text-gray-400 dark:text-gray-500 font-medium'>
                H:{dailySummary.tempMax}° L:{dailySummary.tempMin}°
              </span>
            )}
          </button>

          <button
            onClick={() => setDayOffset((d) => Math.min(maxDays, d + 1))}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              dayOffset < maxDays
                ? "text-ios-blue active:bg-ios-blue/10 active:scale-90"
                : "text-gray-300 dark:text-gray-700"
            }`}
            disabled={dayOffset >= maxDays}>
            <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'>
              <polyline points='9 18 15 12 9 6' />
            </svg>
          </button>
        </div>

        {/* Day summary */}
        {dailySummary && !loading && forecast && (
          <div className='px-5 pb-2'>
            <div className='flex items-center justify-center gap-2'>
              <span className='text-[13px] text-gray-500 dark:text-gray-400 font-medium'>
                {getWeatherCondition(dailySummary.weatherCode, true).description}
              </span>
              {dailySummary.precipitationProbability > 0 && (
                <span className='text-[12px] text-blue-400'>
                  💧 {dailySummary.precipitationProbability}%
                </span>
              )}
            </div>
          </div>
        )}

        {/* Content */}
        <div className='px-2 pt-2 pb-4'>
          {loading ? (
            <div className='flex flex-col items-center justify-center py-16 gap-3'>
              <div className='w-8 h-8 border-3 border-ios-blue border-t-transparent rounded-full animate-spin' />
              <span className='text-[13px] text-gray-400'>Loading forecast...</span>
            </div>
          ) : !forecast ? (
            <div className='flex flex-col items-center justify-center py-16 gap-2'>
              <span className='text-3xl'>🌡️</span>
              <p className='text-gray-400 text-sm'>Unable to load forecast</p>
            </div>
          ) : (
            <>
              {/* Hourly carousel */}
              <div
                ref={scrollRef}
                onScroll={handleScroll}
                className='flex items-center overflow-x-auto pb-4 pt-2 scrollbar-hide'
                style={{
                  touchAction: "pan-x",
                  scrollbarWidth: "none",
                  msOverflowStyle: "none",
                  WebkitOverflowScrolling: "touch",
                  minHeight: 200,
                }}>
                {/* Left padding to center first item */}
                <div
                  className='flex-shrink-0'
                  style={{ width: "calc(50% - 40px)" }}
                />
                {dayHours.map((h, i) => {
                  const condition = getWeatherCondition(h.weatherCode, h.isDay);
                  const now = new Date();
                  const isNow =
                    dayOffset === 0 &&
                    parseInt(h.time.split("T")[1].split(":")[0]) ===
                      now.getHours();
                  const scale = getSmoothedScale(i);
                  const isLarge = scale > 2.5;
                  const isMedium = scale > 1.5 && scale <= 2.5;
                  const visualScale = 0.55 + (scale - 1) * 0.225;

                  return (
                    <div
                      key={i}
                      className='flex-shrink-0 flex items-center justify-center'
                      style={{ width: itemWidth }}>
                      <div
                        className='flex flex-col items-center gap-0.5'
                        style={{
                          transform: `scale(${visualScale})`,
                          transition: "transform 100ms ease-out, opacity 100ms ease-out",
                          opacity: scale < 1.2 ? 0.4 : scale < 1.5 ? 0.6 : scale < 2 ? 0.8 : 1,
                        }}>
                        <span
                          className={`font-semibold leading-none ${
                            isNow
                              ? "text-ios-blue"
                              : "text-gray-500 dark:text-gray-400"
                          } ${isLarge ? "text-[16px]" : "text-[13px]"}`}>
                          {isNow ? "Now" : formatHour(h.time)}
                        </span>
                        <span
                          className='leading-none my-1.5 block'
                          style={{
                            fontSize: isLarge ? "72px" : isMedium ? "48px" : "32px",
                          }}>
                          {condition.icon}
                        </span>
                        <span
                          className={`font-bold leading-none ${
                            isLarge
                              ? "text-[32px] text-gray-900 dark:text-white"
                              : isMedium
                                ? "text-[20px] text-gray-800 dark:text-gray-200"
                                : "text-[15px] text-gray-600 dark:text-gray-400"
                          }`}>
                          {h.temperature}°
                        </span>
                        {isLarge && (
                          <span className='text-[12px] text-gray-400 dark:text-gray-500 font-medium mt-1 whitespace-nowrap'>
                            {condition.description}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {/* Right padding to center last item */}
                <div
                  className='flex-shrink-0'
                  style={{ width: "calc(50% - 40px)" }}
                />
              </div>

              {/* Scroll indicator dots */}
              <div className='flex justify-center gap-1 pb-1'>
                {dayHours.length > 0 && (
                  <div className='flex items-center gap-0.5'>
                    {Array.from({
                      length: Math.min(Math.ceil(dayHours.length / 4), 8),
                    }).map((_, i) => {
                      const totalDots = Math.min(
                        Math.ceil(dayHours.length / 4),
                        8,
                      );
                      const maxScroll = scrollRef.current
                        ? scrollRef.current.scrollWidth -
                          scrollRef.current.clientWidth
                        : 1;
                      const progress =
                        maxScroll > 0 ? scrollX / maxScroll : 0;
                      const dotPosition =
                        totalDots > 1 ? i / (totalDots - 1) : 0;
                      const dotDistance = Math.abs(progress - dotPosition);
                      const isActive = dotDistance < 0.15;
                      return (
                        <div
                          key={i}
                          className={`rounded-full transition-all duration-200 ${
                            isActive
                              ? "w-4 h-1.5 bg-ios-blue"
                              : "w-1.5 h-1.5 bg-gray-300 dark:bg-gray-600"
                          }`}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Close button */}
        <div className='px-5 pb-6 pt-1'>
          <button
            onClick={onClose}
            className='w-full py-3 rounded-2xl text-[16px] font-semibold text-ios-blue bg-ios-blue/10 active:bg-ios-blue/20 transition-colors'>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
