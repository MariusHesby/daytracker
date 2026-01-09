"use client";

import { useState, useEffect, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { Icon, icons, IconName } from "@/components";
import { TimeRange, StatisticsSummary, LogEntry } from "@/types";
import { calculateStatistics, cn } from "@/lib/utils";
import { IOSSegmentedControl } from "@/components/ios";

// Helper to render icon
const renderIcon = (
  iconName: string | undefined,
  className: string = "w-6 h-6"
) => {
  if (!iconName) return null;
  if (iconName in icons) {
    return <Icon name={iconName as IconName} className={className} />;
  }
  return <span className='text-2xl'>{iconName}</span>;
};

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
];

// Helper to get Monday of a given week
function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Monday
  date.setDate(diff);
  date.setHours(12, 0, 0, 0);
  return date;
}

// Helper to format date as YYYY-MM-DD
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

// Get date range for a specific offset (0 = current, -1 = previous, etc.)
function getDateRangeWithOffset(
  range: TimeRange,
  offset: number
): { start: string; end: string; label: string } {
  const now = new Date();
  now.setHours(12, 0, 0, 0);

  if (range === "week") {
    const monday = getMonday(now);
    monday.setDate(monday.getDate() + offset * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const weekNum = getWeekNumber(monday);
    const label = `Week ${weekNum}, ${monday.getFullYear()}`;

    return { start: toDateStr(monday), end: toDateStr(sunday), label };
  } else if (range === "month") {
    const targetDate = new Date(
      now.getFullYear(),
      now.getMonth() + offset,
      1,
      12,
      0,
      0
    );
    const monthStart = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      1,
      12,
      0,
      0
    );
    const monthEnd = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth() + 1,
      0,
      12,
      0,
      0
    );

    const label = monthStart.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });

    return { start: toDateStr(monthStart), end: toDateStr(monthEnd), label };
  } else {
    // Year
    const targetYear = now.getFullYear() + offset;
    const yearStart = new Date(targetYear, 0, 1, 12, 0, 0);
    const yearEnd = new Date(targetYear, 11, 31, 12, 0, 0);

    return {
      start: toDateStr(yearStart),
      end: toDateStr(yearEnd),
      label: String(targetYear),
    };
  }
}

// Get ISO week number
function getWeekNumber(d: Date): number {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((date.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7
    )
  );
}

// Get mood color classes
function getMoodColorClasses(
  mood: string | undefined,
  isFilled: boolean
): string {
  if (!mood) return "";
  switch (mood) {
    case "happy":
      return isFilled
        ? "bg-green-500 text-white"
        : "bg-green-500/10 text-green-500";
    case "neutral":
      return isFilled
        ? "bg-amber-500 text-white"
        : "bg-amber-500/10 text-amber-500";
    case "sad":
      return isFilled ? "bg-red-500 text-white" : "bg-red-500/10 text-red-500";
    default:
      return isFilled
        ? "bg-ios-green text-white"
        : "bg-ios-green/10 text-ios-green";
  }
}

// Get mood emoji
function getMoodEmoji(mood: string | undefined): string {
  switch (mood) {
    case "happy":
      return "☺";
    case "neutral":
      return "—";
    case "sad":
      return "☹";
    default:
      return "✓";
  }
}

// Get mood bar color for progress bars
function getMoodBarColor(mood: string | undefined): string {
  switch (mood) {
    case "happy":
      return "bg-green-500";
    case "neutral":
      return "bg-amber-500";
    case "sad":
      return "bg-red-500";
    default:
      return "bg-ios-blue";
  }
}

// Get mood text color for selected state
function getMoodTextColor(mood: string | undefined): string {
  switch (mood) {
    case "happy":
      return "text-green-500";
    case "neutral":
      return "text-amber-500";
    case "sad":
      return "text-red-500";
    default:
      return "text-ios-blue";
  }
}

// Get mood background color for selected state
function getMoodBgColor(mood: string | undefined): string {
  switch (mood) {
    case "happy":
      return "bg-green-500/5 dark:bg-green-500/10";
    case "neutral":
      return "bg-amber-500/5 dark:bg-amber-500/10";
    case "sad":
      return "bg-red-500/5 dark:bg-red-500/10";
    default:
      return "bg-ios-blue/5 dark:bg-ios-blue/10";
  }
}

// Navigation header component for calendars
function CalendarNavHeader({
  label,
  onPrev,
  onNext,
  canGoPrev,
  canGoNext,
  onToday,
  showToday,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  canGoPrev: boolean;
  canGoNext: boolean;
  onToday?: () => void;
  showToday?: boolean;
}) {
  return (
    <div className='flex items-center justify-between mb-3'>
      <button
        onClick={onPrev}
        disabled={!canGoPrev}
        className={cn(
          "w-8 h-8 flex items-center justify-center rounded-full transition-all",
          canGoPrev
            ? "text-ios-blue active:bg-ios-blue/10"
            : "text-gray-300 dark:text-gray-600"
        )}>
        <svg
          className='w-5 h-5'
          fill='none'
          stroke='currentColor'
          strokeWidth={2.5}
          viewBox='0 0 24 24'>
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            d='M15 19l-7-7 7-7'
          />
        </svg>
      </button>

      <div className='text-center flex items-center gap-2'>
        <span className='text-[15px] font-medium text-gray-700 dark:text-gray-300'>
          {label}
        </span>
        {showToday && onToday && (
          <button
            onClick={onToday}
            className='text-[11px] text-ios-blue px-2 py-0.5 rounded-full bg-ios-blue/10'>
            Today
          </button>
        )}
      </div>

      <button
        onClick={onNext}
        disabled={!canGoNext}
        className={cn(
          "w-8 h-8 flex items-center justify-center rounded-full transition-all",
          canGoNext
            ? "text-ios-blue active:bg-ios-blue/10"
            : "text-gray-300 dark:text-gray-600"
        )}>
        <svg
          className='w-5 h-5'
          fill='none'
          stroke='currentColor'
          strokeWidth={2.5}
          viewBox='0 0 24 24'>
          <path strokeLinecap='round' strokeLinejoin='round' d='M9 5l7 7-7 7' />
        </svg>
      </button>
    </div>
  );
}

export default function StatsPage() {
  const {
    entries,
    loadEntriesForDateRange,
    activityTypes,
    viewingUser,
    setViewingUser,
    isViewingOther,
  } = useApp();
  const [timeRange, setTimeRange] = useState<TimeRange>("week");
  const [offset, setOffset] = useState(0); // 0 = current, -1 = previous, etc.
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(
    null
  );

  // Get current date range with offset
  const currentRange = useMemo(() => {
    return getDateRangeWithOffset(timeRange, offset);
  }, [timeRange, offset]);

  // Check if we can navigate further (back to 2020, forward to next year)
  const canGoBack = useMemo(() => {
    const prevRange = getDateRangeWithOffset(timeRange, offset - 1);
    // Allow going back to 2020
    return prevRange.start >= "2020-01-01";
  }, [timeRange, offset]);

  const canGoForward = useMemo(() => {
    const now = new Date();
    const nextYear = now.getFullYear() + 1;
    const nextRange = getDateRangeWithOffset(timeRange, offset + 1);
    // Allow going forward to end of next year
    return nextRange.start <= `${nextYear}-12-31`;
  }, [timeRange, offset]);

  // Load entries based on time range - load a wider range to enable navigation
  useEffect(() => {
    // Load all entries to enable proper navigation bounds
    loadEntriesForDateRange("2000-01-01", toDateStr(new Date()));
  }, [loadEntriesForDateRange]);

  // Reset offset when time range changes
  useEffect(() => {
    setOffset(0);
  }, [timeRange]);

  // Calculate statistics for current range
  const statistics = useMemo(() => {
    const filteredEntries = entries.filter(
      (e) => e.date >= currentRange.start && e.date <= currentRange.end
    );
    return calculateStatistics(filteredEntries, activityTypes);
  }, [entries, activityTypes, currentRange]);

  // Get stat for selected activity (always return something if activity is selected)
  const selectedStat = useMemo(() => {
    if (!selectedActivityId) return null;
    const stat = statistics.find(
      (s) => s.activityTypeId === selectedActivityId
    );
    if (stat) return stat;

    // Return empty stat for the selected activity when no entries in current range
    const activityType = activityTypes.find((t) => t.id === selectedActivityId);
    if (activityType) {
      return {
        activityTypeId: activityType.id,
        activityTypeName: activityType.name,
        totalEntries: 0,
        uniqueDays: 0,
        entries: [],
      };
    }
    return null;
  }, [statistics, selectedActivityId, activityTypes]);

  const getActivityType = (id: string) =>
    activityTypes.find((t) => t.id === id);

  // Count values for the selected activity
  const valueCounts = useMemo(() => {
    if (!selectedStat) return [];

    const counts: Record<string, number> = {};
    selectedStat.entries.forEach((entry) => {
      // Normalize the key: trim whitespace and convert to lowercase for consistent grouping
      const key = String(entry.value).trim().toLowerCase();
      counts[key] = (counts[key] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);
  }, [selectedStat]);

  // Get max count for bar scaling
  const maxCount = useMemo(() => {
    if (valueCounts.length === 0) return 1;
    return Math.max(...valueCounts.map((v) => v.count));
  }, [valueCounts]);

  // State for selected entry value to show dates
  const [selectedValue, setSelectedValue] = useState<string | null>(null);
  const [showAllDates, setShowAllDates] = useState(false);

  // Get all dates for selected activity
  const allDatesForActivity = useMemo(() => {
    if (!selectedStat) return new Set<string>();
    return new Set(selectedStat.entries.map((entry) => entry.date));
  }, [selectedStat]);

  // Get mood value for each date (for mood-type activities)
  const moodByDate = useMemo(() => {
    if (!selectedStat) return new Map<string, string>();
    const selectedType = getActivityType(selectedStat.activityTypeId);
    if (selectedType?.valueType !== "mood") return new Map<string, string>();

    const map = new Map<string, string>();
    selectedStat.entries.forEach((entry) => {
      map.set(entry.date, String(entry.value).toLowerCase());
    });
    return map;
  }, [selectedStat, activityTypes]);

  // Check if selected activity is mood type
  const isMoodType = useMemo(() => {
    if (!selectedStat) return false;
    const selectedType = getActivityType(selectedStat.activityTypeId);
    return selectedType?.valueType === "mood";
  }, [selectedStat, activityTypes]);

  // Get dates for selected value as a Set for quick lookup
  const datesForSelectedValue = useMemo(() => {
    if (!selectedStat || !selectedValue) return new Set<string>();

    const dates = selectedStat.entries
      .filter(
        (entry) => String(entry.value).trim().toLowerCase() === selectedValue
      )
      .map((entry) => entry.date);

    return new Set(dates);
  }, [selectedStat, selectedValue]);

  // Generate calendar data based on time range
  const calendarData = useMemo(() => {
    if (!selectedValue && !showAllDates) return null;

    const datesToShow = showAllDates
      ? allDatesForActivity
      : datesForSelectedValue;

    const startDate = new Date(currentRange.start + "T12:00:00");
    const endDate = new Date(currentRange.end + "T12:00:00");

    if (timeRange === "week") {
      // Week view - show 7 days with month info
      const days: {
        date: string;
        dayName: string;
        dayNum: number;
        month: string;
        isMarked: boolean;
        isToday: boolean;
      }[] = [];
      const current = new Date(startDate);

      while (current <= endDate) {
        const dateStr = toDateStr(current);
        days.push({
          date: dateStr,
          dayName: current.toLocaleDateString("en-US", { weekday: "short" }),
          dayNum: current.getDate(),
          month: current.toLocaleDateString("en-US", { month: "short" }),
          isMarked: datesToShow.has(dateStr),
          isToday: dateStr === toDateStr(new Date()),
        });
        current.setDate(current.getDate() + 1);
      }

      // Get the week range description
      const weekNum = getWeekNumber(startDate);
      const weekRange = `Week ${weekNum}, ${startDate.getFullYear()}`;

      return { type: "week" as const, days, weekRange };
    } else if (timeRange === "month") {
      // Month view - show full month grid
      const weeks: {
        date: string;
        dayNum: number;
        isMarked: boolean;
        isToday: boolean;
        isCurrentMonth: boolean;
      }[][] = [];

      // Get first day of the month
      const monthStart = new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        1,
        12,
        0,
        0
      );
      const monthEnd = new Date(
        startDate.getFullYear(),
        startDate.getMonth() + 1,
        0,
        12,
        0,
        0
      );

      // Find Monday of the first week
      const firstDayOfWeek = (monthStart.getDay() + 6) % 7; // Monday = 0
      const calendarStart = new Date(monthStart);
      calendarStart.setDate(calendarStart.getDate() - firstDayOfWeek);

      const current = new Date(calendarStart);

      for (let week = 0; week < 6; week++) {
        const weekDays: (typeof weeks)[0] = [];
        for (let day = 0; day < 7; day++) {
          const dateStr = toDateStr(current);
          weekDays.push({
            date: dateStr,
            dayNum: current.getDate(),
            isMarked: datesToShow.has(dateStr),
            isToday: dateStr === toDateStr(new Date()),
            isCurrentMonth: current.getMonth() === monthStart.getMonth(),
          });
          current.setDate(current.getDate() + 1);
        }
        weeks.push(weekDays);

        // Stop if we've completed the month
        if (current > monthEnd && current.getDay() === 1) break;
      }

      return {
        type: "month" as const,
        weeks,
        monthName: monthStart.toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        }),
      };
    } else {
      // Year view - show GitHub-style year calendar heatmap
      const today = new Date();
      today.setHours(12, 0, 0, 0); // Normalize to noon to avoid time comparison issues
      const targetYear = parseInt(currentRange.label); // Year is stored as label

      // Generate all 12 months for the year
      const months: {
        name: string;
        shortName: string;
        year: number;
        days: {
          date: string;
          dayNum: number;
          isMarked: boolean;
          isToday: boolean;
          isFuture: boolean;
        }[];
      }[] = [];

      for (let month = 0; month < 12; month++) {
        const monthStart = new Date(targetYear, month, 1, 12, 0, 0);
        const monthEnd = new Date(targetYear, month + 1, 0, 12, 0, 0);
        const daysInMonth = monthEnd.getDate();

        const days: (typeof months)[0]["days"] = [];

        for (let day = 1; day <= daysInMonth; day++) {
          const current = new Date(targetYear, month, day, 12, 0, 0);
          const dateStr = toDateStr(current);
          const isFuture = current > today;

          days.push({
            date: dateStr,
            dayNum: day,
            isMarked: datesToShow.has(dateStr),
            isToday: dateStr === toDateStr(today),
            isFuture,
          });
        }

        months.push({
          name: monthStart.toLocaleDateString("en-US", { month: "long" }),
          shortName: monthStart
            .toLocaleDateString("en-US", { month: "short" })
            .substring(0, 3),
          year: targetYear,
          days,
        });
      }

      return {
        type: "year" as const,
        months,
        year: targetYear,
        totalCount: Array.from(datesToShow).length,
      };
    }
  }, [
    selectedValue,
    showAllDates,
    timeRange,
    datesForSelectedValue,
    allDatesForActivity,
    currentRange,
  ]);

  // Reset selected value when activity changes
  useEffect(() => {
    setSelectedValue(null);
    setShowAllDates(false);
  }, [selectedActivityId]);

  // Reset offset to current period when clicking outside calendar
  const handleBackgroundClick = () => {
    if (offset !== 0) {
      setOffset(0);
    }
  };

  // iOS-style bar colors
  const barColors = [
    "bg-ios-blue",
    "bg-ios-green",
    "bg-amber-500",
    "bg-ios-red",
    "bg-purple-500",
    "bg-cyan-500",
    "bg-pink-500",
    "bg-orange-500",
  ];

  return (
    <div className='pb-16' onClick={handleBackgroundClick}>
      {/* Viewing Another User Banner */}
      {isViewingOther && viewingUser && (
        <div className='bg-ios-blue text-white px-4 py-3 flex items-center justify-between'>
          <div>
            <p className='text-sm font-medium'>Viewing shared data</p>
            <p className='text-xs opacity-80'>{viewingUser.email}</p>
          </div>
          <button
            onClick={() => setViewingUser(null)}
            className='px-3 py-1.5 bg-white/20 rounded-lg text-sm font-medium hover:bg-white/30 transition-colors'>
            Back to my data
          </button>
        </div>
      )}

      {/* Time Range Selector - iOS Segmented Control */}
      <div className='px-4 py-3 mb-0'>
        <IOSSegmentedControl
          options={TIME_RANGES.map((r) => ({ value: r.value, label: r.label }))}
          value={timeRange}
          onChange={(value) => setTimeRange(value as TimeRange)}
        />
      </div>

      {/* Main Content */}
      <main className='max-w-lg mx-auto px-4'>
        {/* Activity Type Selector */}
        <div className='mb-4'>
          <div className='flex flex-wrap gap-2'>
            {activityTypes.map((type, index) => {
              const stat = statistics.find((s) => s.activityTypeId === type.id);
              const entryCount = stat?.totalEntries || 0;
              const isSelected = selectedActivityId === type.id;

              return (
                <button
                  key={type.id}
                  onClick={() =>
                    setSelectedActivityId(isSelected ? null : type.id)
                  }
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-xl transition-all",
                    isSelected
                      ? "bg-ios-blue text-white"
                      : entryCount > 0
                      ? "bg-white/80 dark:bg-ios-card-dark text-gray-700 dark:text-gray-300"
                      : "bg-gray-200 dark:bg-gray-800 text-gray-400"
                  )}>
                  {type.icon && (
                    <span
                      className={cn(
                        "text-lg",
                        isSelected ? "opacity-100" : "opacity-70"
                      )}>
                      {renderIcon(type.icon, "w-5 h-5")}
                    </span>
                  )}
                  <span className='text-[15px] font-medium'>{type.name}</span>
                  {entryCount > 0 && (
                    <span
                      className={cn(
                        "text-[13px] px-2 py-0.5 rounded-full font-medium",
                        isSelected
                          ? "bg-white/20"
                          : "bg-gray-100 dark:bg-gray-700"
                      )}>
                      {entryCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Activity Stats */}
        {selectedStat ? (
          <div className='bg-white/80 dark:bg-ios-card-dark rounded-xl overflow-hidden'>
            {/* Header - Clickable to show all dates */}
            <button
              onClick={() => {
                setShowAllDates(!showAllDates);
                setSelectedValue(null);
              }}
              className={cn(
                "w-full p-4 border-b border-gray-200/80 dark:border-gray-700/80 text-left transition-all",
                showAllDates
                  ? "bg-ios-blue/10 dark:bg-ios-blue/20"
                  : "bg-ios-blue/5 dark:bg-ios-blue/10"
              )}>
              <div className='flex items-center gap-3'>
                {getActivityType(selectedStat.activityTypeId)?.icon && (
                  <div className='w-10 h-10 rounded-xl bg-ios-blue/10 flex items-center justify-center'>
                    <span className='text-ios-blue'>
                      {renderIcon(
                        getActivityType(selectedStat.activityTypeId)?.icon,
                        "w-6 h-6"
                      )}
                    </span>
                  </div>
                )}
                <div className='flex-1'>
                  <h3
                    className={cn(
                      "font-semibold text-[17px]",
                      showAllDates
                        ? "text-ios-blue"
                        : "text-gray-900 dark:text-white"
                    )}>
                    {selectedStat.activityTypeName}
                  </h3>
                  <p className='text-[15px] text-gray-500 dark:text-gray-400'>
                    {selectedStat.totalEntries} entries over{" "}
                    {selectedStat.uniqueDays} days
                  </p>
                </div>
                <span
                  className={cn(
                    "text-[13px] text-gray-400 transition-transform",
                    showAllDates ? "rotate-180" : ""
                  )}>
                  ▼
                </span>
              </div>
            </button>

            {/* Calendar view for all dates */}
            {showAllDates && calendarData && (
              <div
                className='p-4 border-b border-gray-200/80 dark:border-gray-700/80'
                onClick={(e) => e.stopPropagation()}>
                <div className='p-3 bg-gray-50 dark:bg-gray-800 rounded-xl'>
                  {calendarData.type === "week" && (
                    <div>
                      <CalendarNavHeader
                        label={calendarData.weekRange}
                        onPrev={() => setOffset(offset - 1)}
                        onNext={() => setOffset(offset + 1)}
                        canGoPrev={canGoBack}
                        canGoNext={canGoForward}
                        onToday={() => setOffset(0)}
                        showToday={offset !== 0}
                      />
                      <div className='flex justify-between gap-1'>
                        {calendarData.days.map((day) => {
                          const mood = moodByDate.get(day.date);
                          return (
                            <div
                              key={day.date}
                              className={cn(
                                "flex-1 text-center py-2 px-1 rounded-lg",
                                day.isMarked
                                  ? isMoodType
                                    ? getMoodColorClasses(mood, true)
                                    : "bg-ios-green text-white"
                                  : day.isToday
                                  ? isMoodType
                                    ? "bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300"
                                    : "bg-ios-green/10 text-ios-green"
                                  : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                              )}>
                              <div className='text-[10px] uppercase font-medium'>
                                {day.dayName}
                              </div>
                              <div
                                className={cn(
                                  "text-lg font-bold",
                                  day.isMarked && "text-white"
                                )}>
                                {day.dayNum}
                              </div>
                              <div className='text-[9px] opacity-70'>
                                {day.month}
                              </div>
                              {day.isMarked && (
                                <div className='text-[10px]'>
                                  {isMoodType ? getMoodEmoji(mood) : "✓"}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {calendarData.type === "month" && (
                    <div>
                      <CalendarNavHeader
                        label={calendarData.monthName}
                        onPrev={() => setOffset(offset - 1)}
                        onNext={() => setOffset(offset + 1)}
                        canGoPrev={canGoBack}
                        canGoNext={canGoForward}
                        onToday={() => setOffset(0)}
                        showToday={offset !== 0}
                      />
                      <div className='grid grid-cols-7 gap-1 text-center text-[10px] text-gray-500 mb-1'>
                        <div>Mo</div>
                        <div>Tu</div>
                        <div>We</div>
                        <div>Th</div>
                        <div>Fr</div>
                        <div>Sa</div>
                        <div>Su</div>
                      </div>
                      {calendarData.weeks.map((week, weekIdx) => (
                        <div key={weekIdx} className='grid grid-cols-7 gap-1'>
                          {week.map((day) => {
                            const mood = moodByDate.get(day.date);
                            return (
                              <div
                                key={day.date}
                                className={cn(
                                  "aspect-square flex items-center justify-center text-[13px] rounded-lg",
                                  !day.isCurrentMonth && "opacity-30",
                                  day.isMarked
                                    ? isMoodType
                                      ? getMoodColorClasses(mood, true) +
                                        " font-bold"
                                      : "bg-ios-green text-white font-bold"
                                    : day.isToday
                                    ? isMoodType
                                      ? "bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium"
                                      : "bg-ios-green/10 text-ios-green font-medium"
                                    : "text-gray-600 dark:text-gray-400"
                                )}>
                                {day.dayNum}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}

                  {calendarData.type === "year" && (
                    <div className='space-y-2'>
                      <CalendarNavHeader
                        label={String(calendarData.year)}
                        onPrev={() => setOffset(offset - 1)}
                        onNext={() => setOffset(offset + 1)}
                        canGoPrev={canGoBack}
                        canGoNext={canGoForward}
                        onToday={() => setOffset(0)}
                        showToday={offset !== 0}
                      />
                      <div className='grid grid-cols-2 gap-4'>
                        {calendarData.months.map((month, idx) => (
                          <div key={idx} className='text-center'>
                            <div className='text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1.5'>
                              {month.name}
                            </div>
                            <div className='grid grid-cols-7 gap-0.5 text-[8px] text-gray-400 mb-0.5'>
                              <div>M</div>
                              <div>T</div>
                              <div>W</div>
                              <div>T</div>
                              <div>F</div>
                              <div>S</div>
                              <div>S</div>
                            </div>
                            <div className='grid grid-cols-7 gap-0.5'>
                              {(() => {
                                const firstDay = new Date(month.year, idx, 1);
                                const startDay = (firstDay.getDay() + 6) % 7;
                                const emptyCells = [];
                                for (let i = 0; i < startDay; i++) {
                                  emptyCells.push(
                                    <div
                                      key={`empty-${i}`}
                                      className='w-4 h-4'
                                    />
                                  );
                                }
                                return emptyCells;
                              })()}
                              {month.days.map((day) => {
                                const mood = moodByDate.get(day.date);
                                return (
                                  <div
                                    key={day.date}
                                    className={cn(
                                      "w-4 h-4 rounded-sm flex items-center justify-center text-[9px]",
                                      day.isFuture
                                        ? "bg-gray-100 dark:bg-gray-800 text-gray-300 dark:text-gray-600"
                                        : day.isMarked
                                        ? isMoodType
                                          ? getMoodColorClasses(mood, true) +
                                            " font-bold"
                                          : "bg-ios-green text-white font-bold"
                                        : day.isToday
                                        ? isMoodType
                                          ? "bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400 font-medium"
                                          : "bg-ios-green/30 text-ios-green font-medium"
                                        : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                                    )}
                                    title={`${day.dayNum}. ${month.name}${
                                      day.isMarked
                                        ? isMoodType
                                          ? ` ${getMoodEmoji(mood)}`
                                          : " ✓"
                                        : ""
                                    }`}>
                                    {day.dayNum}
                                  </div>
                                );
                              })}
                            </div>
                            <div className='mt-1 text-[10px] text-gray-500 dark:text-gray-400'>
                              {month.days.filter((d) => d.isMarked).length >
                                0 && (
                                <span className='text-ios-green font-medium'>
                                  {month.days.filter((d) => d.isMarked).length}{" "}
                                  days
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Value List with Bars */}
            <div className='p-4'>
              <h4 className='text-[13px] font-normal text-gray-500 dark:text-gray-400 mb-3'>
                Tap to see dates
              </h4>
              <div className='space-y-3'>
                {valueCounts.map(({ value, count }, index) => {
                  const isSelected = selectedValue === value;
                  const moodBarColor = isMoodType
                    ? getMoodBarColor(value)
                    : barColors[index % barColors.length];
                  const moodTextColor = isMoodType
                    ? getMoodTextColor(value)
                    : "text-ios-blue";
                  const moodBgColorClass = isMoodType
                    ? getMoodBgColor(value)
                    : "bg-ios-blue/5 dark:bg-ios-blue/10";
                  return (
                    <div key={value}>
                      <button
                        onClick={() =>
                          setSelectedValue(isSelected ? null : value)
                        }
                        className={cn(
                          "w-full text-left space-y-1 p-2 -m-2 rounded-lg transition-all",
                          isSelected
                            ? moodBgColorClass
                            : "active:bg-gray-100 dark:active:bg-gray-800"
                        )}>
                        <div className='flex items-center justify-between text-[15px]'>
                          <span
                            className={cn(
                              "capitalize truncate mr-2",
                              isSelected
                                ? cn(moodTextColor, "font-medium")
                                : "text-gray-700 dark:text-gray-300"
                            )}>
                            {formatDisplayValue(value)}
                          </span>
                          <div className='flex items-center gap-2'>
                            <span className='text-[13px] text-gray-600 dark:text-gray-400 font-medium shrink-0 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full'>
                              {count}
                            </span>
                            <span
                              className={cn(
                                "text-[13px] text-gray-400 transition-transform",
                                isSelected ? "rotate-180" : ""
                              )}>
                              ▼
                            </span>
                          </div>
                        </div>
                        <div className='h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden'>
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              moodBarColor
                            )}
                            style={{ width: `${(count / maxCount) * 100}%` }}
                          />
                        </div>
                      </button>

                      {/* Calendar view when selected */}
                      {isSelected && calendarData && (
                        <div
                          className='mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl'
                          onClick={(e) => e.stopPropagation()}>
                          {calendarData.type === "week" && (
                            <div>
                              <CalendarNavHeader
                                label={calendarData.weekRange}
                                onPrev={() => setOffset(offset - 1)}
                                onNext={() => setOffset(offset + 1)}
                                canGoPrev={canGoBack}
                                canGoNext={canGoForward}
                                onToday={() => setOffset(0)}
                                showToday={offset !== 0}
                              />
                              <div className='flex justify-between gap-1'>
                                {calendarData.days.map((day) => (
                                  <div
                                    key={day.date}
                                    className={cn(
                                      "flex-1 text-center py-2 px-1 rounded-lg",
                                      day.isMarked
                                        ? isMoodType
                                          ? getMoodColorClasses(value, true)
                                          : "bg-ios-blue text-white"
                                        : day.isToday
                                        ? isMoodType
                                          ? getMoodColorClasses(value, false)
                                          : "bg-ios-blue/10 text-ios-blue"
                                        : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                                    )}>
                                    <div className='text-[10px] uppercase font-medium'>
                                      {day.dayName}
                                    </div>
                                    <div
                                      className={cn(
                                        "text-lg font-bold",
                                        day.isMarked && "text-white"
                                      )}>
                                      {day.dayNum}
                                    </div>
                                    <div className='text-[9px] opacity-70'>
                                      {day.month}
                                    </div>
                                    {day.isMarked && (
                                      <div className='text-[10px]'>
                                        {isMoodType ? getMoodEmoji(value) : "✓"}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {calendarData.type === "month" && (
                            <div>
                              <CalendarNavHeader
                                label={calendarData.monthName}
                                onPrev={() => setOffset(offset - 1)}
                                onNext={() => setOffset(offset + 1)}
                                canGoPrev={canGoBack}
                                canGoNext={canGoForward}
                                onToday={() => setOffset(0)}
                                showToday={offset !== 0}
                              />
                              <div className='grid grid-cols-7 gap-1 text-center text-[10px] text-gray-500 mb-1'>
                                <div>Mo</div>
                                <div>Tu</div>
                                <div>We</div>
                                <div>Th</div>
                                <div>Fr</div>
                                <div>Sa</div>
                                <div>Su</div>
                              </div>
                              {calendarData.weeks.map((week, weekIdx) => (
                                <div
                                  key={weekIdx}
                                  className='grid grid-cols-7 gap-1'>
                                  {week.map((day) => (
                                    <div
                                      key={day.date}
                                      className={cn(
                                        "aspect-square flex items-center justify-center text-[13px] rounded-lg",
                                        !day.isCurrentMonth && "opacity-30",
                                        day.isMarked
                                          ? isMoodType
                                            ? getMoodColorClasses(value, true) +
                                              " font-bold"
                                            : "bg-ios-blue text-white font-bold"
                                          : day.isToday
                                          ? isMoodType
                                            ? getMoodColorClasses(
                                                value,
                                                false
                                              ) + " font-medium"
                                            : "bg-ios-blue/10 text-ios-blue font-medium"
                                          : "text-gray-600 dark:text-gray-400"
                                      )}>
                                      {day.dayNum}
                                    </div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          )}

                          {calendarData.type === "year" && (
                            <div className='space-y-2'>
                              {/* Year header with navigation */}
                              <CalendarNavHeader
                                label={String(calendarData.year)}
                                onPrev={() => setOffset(offset - 1)}
                                onNext={() => setOffset(offset + 1)}
                                canGoPrev={canGoBack}
                                canGoNext={canGoForward}
                                onToday={() => setOffset(0)}
                                showToday={offset !== 0}
                              />

                              {/* Mini calendar grid - 2 columns of months (6 rows) */}
                              <div className='grid grid-cols-2 gap-4'>
                                {calendarData.months.map((month, idx) => (
                                  <div key={idx} className='text-center'>
                                    <div className='text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1.5'>
                                      {month.name}
                                    </div>
                                    <div className='grid grid-cols-7 gap-0.5 text-[8px] text-gray-400 mb-0.5'>
                                      <div>M</div>
                                      <div>T</div>
                                      <div>W</div>
                                      <div>T</div>
                                      <div>F</div>
                                      <div>S</div>
                                      <div>S</div>
                                    </div>
                                    <div className='grid grid-cols-7 gap-0.5'>
                                      {/* Add empty cells for first week alignment */}
                                      {(() => {
                                        const firstDay = new Date(
                                          month.year,
                                          idx,
                                          1
                                        );
                                        const startDay =
                                          (firstDay.getDay() + 6) % 7; // Monday = 0
                                        const emptyCells = [];
                                        for (let i = 0; i < startDay; i++) {
                                          emptyCells.push(
                                            <div
                                              key={`empty-${i}`}
                                              className='w-4 h-4'
                                            />
                                          );
                                        }
                                        return emptyCells;
                                      })()}
                                      {month.days.map((day) => (
                                        <div
                                          key={day.date}
                                          className={cn(
                                            "w-4 h-4 rounded-sm flex items-center justify-center text-[9px]",
                                            day.isFuture
                                              ? "bg-gray-100 dark:bg-gray-800 text-gray-300 dark:text-gray-600"
                                              : day.isMarked
                                              ? isMoodType
                                                ? getMoodColorClasses(
                                                    value,
                                                    true
                                                  ) + " font-bold"
                                                : "bg-ios-blue text-white font-bold"
                                              : day.isToday
                                              ? isMoodType
                                                ? getMoodColorClasses(
                                                    value,
                                                    false
                                                  ) + " font-medium"
                                                : "bg-ios-blue/30 text-ios-blue font-medium"
                                              : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                                          )}
                                          title={`${day.dayNum}. ${month.name}${
                                            day.isMarked
                                              ? isMoodType
                                                ? ` ${getMoodEmoji(value)}`
                                                : " ✓"
                                              : ""
                                          }`}>
                                          {day.dayNum}
                                        </div>
                                      ))}
                                    </div>
                                    {/* Month summary */}
                                    <div className='mt-1 text-[10px] text-gray-500 dark:text-gray-400'>
                                      {month.days.filter((d) => d.isMarked)
                                        .length > 0 && (
                                        <span
                                          className={cn(
                                            "font-medium",
                                            isMoodType
                                              ? getMoodTextColor(value)
                                              : "text-ios-blue"
                                          )}>
                                          {
                                            month.days.filter((d) => d.isMarked)
                                              .length
                                          }{" "}
                                          days
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Legend */}
                              <div className='flex items-center justify-center gap-2 mt-3 text-[10px] text-gray-500'>
                                <span>Less</span>
                                <div className='flex gap-1'>
                                  <div className='w-2 h-2 rounded-sm bg-gray-200 dark:bg-gray-700' />
                                  <div className='w-2 h-2 rounded-sm bg-ios-blue/30' />
                                  <div className='w-2 h-2 rounded-sm bg-ios-blue' />
                                </div>
                                <span>More</span>
                              </div>
                            </div>
                          )}

                          {/* Summary */}
                          <div className='mt-3 pt-2 border-t border-gray-200/80 dark:border-gray-700/80 text-center text-[13px] text-gray-500'>
                            {datesForSelectedValue.size} days with this value
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className='text-center py-12'>
            <p className='text-[17px] text-gray-500 dark:text-gray-400'>
              Select an activity to see statistics
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function formatDisplayValue(value: string): string {
  if (value === "true") return "Yes";
  if (value === "false") return "No";
  if (value === "skipped") return "No";
  return value;
}
