"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { Icon, icons, IconName } from "@/components";
import {
  TimeRange,
  StatisticsSummary,
  LogEntry,
  WorkoutExercise,
} from "@/types";
import {
  calculateStatistics,
  cn,
  getMonday,
  toDateStr,
  getWeekNumber,
  getDateRangeWithOffset,
} from "@/lib/utils";
import { IOSSegmentedControl, IOSModal } from "@/components/ios";

// Helper to render icon
const renderIcon = (
  iconName: string | undefined,
  className: string = "w-6 h-6",
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

// Get mood color classes
function getMoodColorClasses(
  mood: string | undefined,
  isFilled: boolean,
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
            : "text-gray-300 dark:text-gray-600",
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
            : "text-gray-300 dark:text-gray-600",
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
    allActivityTypes: activityTypes,
    viewingUser,
    setViewingUser,
    isViewingOther,
    setSelectedDate,
  } = useApp();
  const router = useRouter();
  const { user } = useAuth();
  const [infoMode, setInfoMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("info_mode") === "true";
  });

  useEffect(() => {
    const handler = () =>
      setInfoMode(localStorage.getItem("info_mode") === "true");
    window.addEventListener("infoModeUpdated", handler);
    return () => window.removeEventListener("infoModeUpdated", handler);
  }, []);

  const [timeRange, setTimeRange] = useState<TimeRange>("year");
  const [showInfoPopup, setShowInfoPopup] = useState(false);
  const [offset, setOffset] = useState(0); // 0 = current, -1 = previous, etc.
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(
    null,
  );

  // Get localStorage workout data for recent days (only for anonymous users)
  // Signed-in users get all data from Supabase
  const localStorageWorkoutEntries = useMemo(() => {
    // Skip localStorage for signed-in users - they have Supabase as source of truth
    if (user) return [];
    if (typeof window === "undefined") return [];

    const workoutType = activityTypes.find((t) => t.valueType === "workout");
    if (!workoutType) return [];

    const localEntries: LogEntry[] = [];
    const today = new Date();

    // Check last 90 days of localStorage
    for (let i = 0; i < 90; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = toDateStr(checkDate);

      // Skip if we already have a database entry for this date with workout data
      const hasDbEntry = entries.some(
        (e) =>
          e.date === dateStr &&
          e.activityTypeId === workoutType.id &&
          e.workoutData?.exercises,
      );
      if (hasDbEntry) continue;

      const savedData = localStorage.getItem(`workout-data-${dateStr}`);
      if (savedData) {
        try {
          const workoutData = JSON.parse(savedData) as Record<
            string,
            Array<{
              reps?: number;
              weight?: number;
              distance?: number;
              duration?: number;
            }>
          >;

          // Convert localStorage format to workout exercises
          const exercises: WorkoutExercise[] = [];
          for (const [exerciseName, sets] of Object.entries(workoutData)) {
            const validSets = sets.filter(
              (set) => set.reps || set.weight || set.distance || set.duration,
            );
            if (validSets.length === 0) continue;

            const exerciseConfig = workoutType.customExercises?.find(
              (e) => e.name === exerciseName,
            );

            exercises.push({
              id: `local-${dateStr}-${exerciseName}`,
              name: exerciseName,
              category: exerciseConfig?.category || "other",
              sets: validSets.length,
              reps: validSets[0].reps,
              weight: validSets.some((s) => s.weight)
                ? Math.max(
                    ...validSets.filter((s) => s.weight).map((s) => s.weight!),
                  )
                : undefined,
              distance: validSets.some((s) => s.distance)
                ? validSets.reduce((sum, s) => sum + (s.distance || 0), 0)
                : undefined,
              duration: validSets.some((s) => s.duration)
                ? validSets.reduce((sum, s) => sum + (s.duration || 0), 0)
                : undefined,
              setsData: validSets,
            });
          }

          if (exercises.length > 0) {
            localEntries.push({
              id: `local-${dateStr}`,
              activityTypeId: workoutType.id,
              date: dateStr,
              value: "Workout",
              workoutData: { exercises },
              createdAt: new Date(dateStr),
              updatedAt: new Date(dateStr),
            });
          }
        } catch (e) {
          // Invalid JSON, skip
        }
      }
    }

    return localEntries;
  }, [activityTypes, entries, user]);

  // Combine database entries with localStorage workout entries
  const allEntries = useMemo(() => {
    return [...entries, ...localStorageWorkoutEntries];
  }, [entries, localStorageWorkoutEntries]);

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
  // Re-fetch when page becomes visible to get fresh data
  useEffect(() => {
    const loadData = () => {
      loadEntriesForDateRange("2000-01-01", toDateStr(new Date()));
    };

    // Load on mount
    loadData();

    // Reload when page becomes visible (user returns to stats page)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadData();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Also reload on focus (for desktop tab switching)
    window.addEventListener("focus", loadData);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", loadData);
    };
  }, [loadEntriesForDateRange]);

  // Reset offset when time range changes
  useEffect(() => {
    setOffset(0);
  }, [timeRange]);

  // Calculate statistics for current range
  const statistics = useMemo(() => {
    const filteredEntries = allEntries.filter(
      (e) =>
        e.date >= currentRange.start &&
        e.date <= currentRange.end &&
        !e.isWatchlist,
    );
    return calculateStatistics(filteredEntries, activityTypes);
  }, [allEntries, activityTypes, currentRange]);

  // Get stat for selected activity (always return something if activity is selected)
  const selectedStat = useMemo(() => {
    if (!selectedActivityId) return null;
    const stat = statistics.find(
      (s) => s.activityTypeId === selectedActivityId,
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

  const getActivityType = useCallback(
    (id: string) => activityTypes.find((t) => t.id === id),
    [activityTypes],
  );

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

  // State for top TV series count (persisted)
  const [topSeriesCount, setTopSeriesCount] = useState<number>(() => {
    if (typeof window === "undefined") return 6;
    const saved = localStorage.getItem("stats-top-series-count");
    return saved ? parseInt(saved, 10) : 6;
  });

  // Check if selected activity is TV Series type
  const isTvSeriesType = useMemo(() => {
    if (!selectedStat) return false;
    const selectedType = getActivityType(selectedStat.activityTypeId);
    return selectedType?.name === "TV Series";
  }, [selectedStat, getActivityType]);

  // Compute top viewed TV series with poster data
  const topViewedSeries = useMemo(() => {
    if (!selectedStat || !isTvSeriesType) return [];

    // Group entries by normalized series name
    const seriesMap = new Map<
      string,
      { name: string; poster: string | undefined; count: number }
    >();
    selectedStat.entries.forEach((entry) => {
      const key = String(entry.value).trim().toLowerCase();
      const existing = seriesMap.get(key);
      if (existing) {
        existing.count += 1;
        // Keep the poster from the latest entry that has one
        if (entry.poster && !existing.poster) {
          existing.poster = entry.poster;
        }
      } else {
        seriesMap.set(key, {
          name: String(entry.value).trim(),
          poster: entry.poster,
          count: 1,
        });
      }
    });

    return Array.from(seriesMap.values())
      .filter((s) => s.count > 1)
      .sort((a, b) => b.count - a.count);
  }, [selectedStat, isTvSeriesType]);

  // Check if selected activity is Movie type
  const isMovieType = useMemo(() => {
    if (!selectedStat) return false;
    const selectedType = getActivityType(selectedStat.activityTypeId);
    return selectedType?.name === "Movie";
  }, [selectedStat, getActivityType]);

  // Movie sort mode (persisted)
  const [movieSortMode, setMovieSortMode] = useState<
    "newest" | "myRating" | "imdbRating"
  >(() => {
    if (typeof window === "undefined") return "newest";
    const saved = localStorage.getItem("stats-movie-sort-mode");
    return (saved as "newest" | "myRating" | "imdbRating") || "newest";
  });

  // Compute top 3 movies based on sort mode
  const topMovies = useMemo(() => {
    if (!selectedStat || !isMovieType) return [];

    // Deduplicate by name (keep the entry with best data)
    const movieMap = new Map<
      string,
      {
        name: string;
        poster: string | undefined;
        userRating: number;
        imdbRating: number;
        date: string;
        year: string;
      }
    >();
    selectedStat.entries.forEach((entry) => {
      const key = String(entry.value).trim().toLowerCase();
      const existing = movieMap.get(key);
      const userRating = entry.userRating || 0;
      const imdbRating = entry.imdbRating ? parseFloat(entry.imdbRating) : 0;
      if (!existing) {
        movieMap.set(key, {
          name: String(entry.value).trim(),
          poster: entry.poster,
          userRating,
          imdbRating,
          date: entry.date,
          year: entry.year || "",
        });
      } else {
        // Update with better data if available
        if (entry.poster && !existing.poster) existing.poster = entry.poster;
        if (userRating > existing.userRating) existing.userRating = userRating;
        if (imdbRating > existing.imdbRating) existing.imdbRating = imdbRating;
        if (entry.date > existing.date) existing.date = entry.date;
      }
    });

    const movies = Array.from(movieMap.values());

    switch (movieSortMode) {
      case "newest":
        return movies.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
      case "myRating":
        return movies
          .filter((m) => m.userRating > 0)
          .sort((a, b) => b.userRating - a.userRating)
          .slice(0, 3);
      case "imdbRating":
        return movies
          .filter((m) => m.imdbRating > 0)
          .sort((a, b) => b.imdbRating - a.imdbRating)
          .slice(0, 3);
      default:
        return movies.slice(0, 3);
    }
  }, [selectedStat, isMovieType, movieSortMode]);

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
  }, [selectedStat, getActivityType]);

  // Check if selected activity is mood type
  const isMoodType = useMemo(() => {
    if (!selectedStat) return false;
    const selectedType = getActivityType(selectedStat.activityTypeId);
    return selectedType?.valueType === "mood";
  }, [selectedStat, getActivityType]);

  // Check if selected activity is nutrition type
  const isNutritionType = useMemo(() => {
    if (!selectedStat) return false;
    const selectedType = getActivityType(selectedStat.activityTypeId);
    return selectedType?.valueType === "nutrition";
  }, [selectedStat, getActivityType]);

  // Calculate nutrition stats for the period
  const nutritionStats = useMemo(() => {
    if (!selectedStat || !isNutritionType) return null;

    const selectedType = getActivityType(selectedStat.activityTypeId);
    const goal = selectedType?.nutritionGoal || {};

    // Group entries by date to get daily totals
    const dailyTotals: Map<
      string,
      {
        protein: number;
        calories: number;
        carbs: number;
        fat: number;
        items: number;
      }
    > = new Map();

    selectedStat.entries.forEach((entry) => {
      const existing = dailyTotals.get(entry.date) || {
        protein: 0,
        calories: 0,
        carbs: 0,
        fat: 0,
        items: 0,
      };
      const nutritionData = entry.nutritionData;
      if (nutritionData) {
        existing.protein += nutritionData.protein || 0;
        existing.calories += nutritionData.calories || 0;
        existing.carbs += nutritionData.carbs || 0;
        existing.fat += nutritionData.fat || 0;
        existing.items += 1;
      }
      dailyTotals.set(entry.date, existing);
    });

    // Calculate averages and goal achievement
    const days = Array.from(dailyTotals.values());
    const totalDays = days.length;

    if (totalDays === 0) {
      return {
        goal,
        avgProtein: 0,
        avgCalories: 0,
        avgCarbs: 0,
        avgFat: 0,
        totalItems: 0,
        daysTracked: 0,
        daysProteinGoalMet: 0,
        daysCaloriesGoalMet: 0,
        proteinGoalRate: 0,
        caloriesGoalRate: 0,
        dailyTotals,
      };
    }

    const avgProtein = Math.round(
      days.reduce((sum, d) => sum + d.protein, 0) / totalDays,
    );
    const avgCalories = Math.round(
      days.reduce((sum, d) => sum + d.calories, 0) / totalDays,
    );
    const avgCarbs = Math.round(
      days.reduce((sum, d) => sum + d.carbs, 0) / totalDays,
    );
    const avgFat = Math.round(
      days.reduce((sum, d) => sum + d.fat, 0) / totalDays,
    );
    const totalItems = days.reduce((sum, d) => sum + d.items, 0);

    const daysProteinGoalMet = goal.protein
      ? days.filter((d) => d.protein >= (goal.protein || 0)).length
      : 0;
    const daysCaloriesGoalMet = goal.calories
      ? days.filter((d) => d.calories >= (goal.calories || 0)).length
      : 0;

    return {
      goal,
      avgProtein,
      avgCalories,
      avgCarbs,
      avgFat,
      totalItems,
      daysTracked: totalDays,
      daysProteinGoalMet,
      daysCaloriesGoalMet,
      proteinGoalRate: goal.protein
        ? Math.round((daysProteinGoalMet / totalDays) * 100)
        : 0,
      caloriesGoalRate: goal.calories
        ? Math.round((daysCaloriesGoalMet / totalDays) * 100)
        : 0,
      dailyTotals,
    };
  }, [selectedStat, isNutritionType, getActivityType]);

  // Check if selected activity is workout type
  const isWorkoutType = useMemo(() => {
    if (!selectedStat) return false;
    const selectedType = getActivityType(selectedStat.activityTypeId);
    return selectedType?.valueType === "workout";
  }, [selectedStat, getActivityType]);

  // Check if selected activity is checklist type
  const isChecklistType = useMemo(() => {
    if (!selectedStat) return false;
    const selectedType = getActivityType(selectedStat.activityTypeId);
    return selectedType?.valueType === "checklist";
  }, [selectedStat, getActivityType]);

  // Calculate checklist stats for the period
  const checklistStats = useMemo(() => {
    if (!selectedStat || !isChecklistType) return null;

    // Collect all checklist items from all entries
    // Only track items that were completed and when they were completed
    const itemData = new Map<
      string,
      {
        completedCount: number;
        completedDates: Set<string>; // Only dates where this item was marked done
      }
    >();
    let totalCompleted = 0;

    selectedStat.entries.forEach((entry) => {
      if (entry.checklistData?.items && entry.checklistData.items.length > 0) {
        entry.checklistData.items.forEach((item) => {
          // Only count completed items
          if (item.completed) {
            const text = item.text.trim();
            totalCompleted++;

            const existing = itemData.get(text) || {
              completedCount: 0,
              completedDates: new Set<string>(),
            };
            existing.completedCount++;
            existing.completedDates.add(entry.date);
            itemData.set(text, existing);
          }
        });
      }
    });

    // Sort by completed count descending - only include items that have been completed at least once
    const allItems = Array.from(itemData.entries())
      .sort((a, b) => b[1].completedCount - a[1].completedCount)
      .map(([text, data]) => ({
        text,
        count: data.completedCount,
        dates: data.completedDates,
      }));

    return {
      totalCompleted,
      allItems,
      topItems: allItems.slice(0, 10), // Show top 10 by default
      uniqueItems: itemData.size,
      maxCount: allItems.length > 0 ? allItems[0].count : 1,
    };
  }, [selectedStat, isChecklistType]);

  // State for showing all checklist items (persisted)
  const [showAllChecklistItems, setShowAllChecklistItems] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("stats-show-all-checklist") === "true";
  });

  // State for selected checklist item (to show calendar)
  const [selectedChecklistItem, setSelectedChecklistItem] = useState<
    string | null
  >(null);

  // State for expanded timer subject in stats
  const [expandedTimerSubject, setExpandedTimerSubject] = useState<
    string | null
  >(null);

  // Timer period navigation offset (0 = current period, -1 = previous, etc.)
  const [timerPeriodOffset, setTimerPeriodOffset] = useState(0);

  // Get dates for selected checklist item
  const datesForSelectedChecklistItem = useMemo(() => {
    if (!selectedChecklistItem || !checklistStats) return new Set<string>();
    const item = checklistStats.allItems.find(
      (i) => i.text === selectedChecklistItem,
    );
    return item?.dates || new Set<string>();
  }, [selectedChecklistItem, checklistStats]);

  // Checklist calendar data for selected item
  const checklistItemCalendarData = useMemo(() => {
    if (!selectedChecklistItem || datesForSelectedChecklistItem.size === 0)
      return null;

    const datesToShow = datesForSelectedChecklistItem;
    const startDate = new Date(currentRange.start + "T12:00:00");
    const endDate = new Date(currentRange.end + "T12:00:00");

    if (timeRange === "week") {
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

      const weekNum = getWeekNumber(startDate);
      const weekRange = `Week ${weekNum}, ${startDate.getFullYear()}`;

      return { type: "week" as const, days, weekRange };
    } else if (timeRange === "month") {
      const weeks: {
        date: string;
        dayNum: number;
        isMarked: boolean;
        isToday: boolean;
        isCurrentMonth: boolean;
      }[][] = [];

      const monthStart = new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        1,
        12,
        0,
        0,
      );
      const monthEnd = new Date(
        startDate.getFullYear(),
        startDate.getMonth() + 1,
        0,
        12,
        0,
        0,
      );

      const firstDayOfWeek = (monthStart.getDay() + 6) % 7;
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
      const today = new Date();
      today.setHours(12, 0, 0, 0);
      const targetYear = parseInt(currentRange.label);

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
      };
    }
  }, [
    selectedChecklistItem,
    datesForSelectedChecklistItem,
    timeRange,
    currentRange,
  ]);

  // Reset checklist item selection when activity changes
  useEffect(() => {
    setSelectedChecklistItem(null);
    setExpandedTimerSubject(null);
    setTimerPeriodOffset(0);
  }, [timeRange, selectedActivityId]);

  // Check if selected activity is timer type
  const isTimerType = useMemo(() => {
    if (!selectedStat) return false;
    const selectedType = getActivityType(selectedStat.activityTypeId);
    return selectedType?.valueType === "timer";
  }, [selectedStat, getActivityType]);

  // Calculate timer stats for the period
  const timerStats = useMemo(() => {
    if (!selectedStat || !isTimerType) return null;

    const selectedType = getActivityType(selectedStat.activityTypeId);
    if (!selectedType?.timerConfig) return null;

    const subjects = selectedType.timerConfig.subjects;
    const limitMinutes = selectedType.timerConfig.limitMinutes;
    const limitPeriod = selectedType.timerConfig.limitPeriod;

    // Compute period date range based on limitPeriod and timerPeriodOffset
    const now = new Date();
    let periodStart: string;
    let periodEnd: string;
    let periodLabel: string;

    if (limitPeriod === "daily") {
      const d = new Date(now);
      d.setDate(d.getDate() + timerPeriodOffset);
      const ds = d.toISOString().split("T")[0];
      periodStart = ds;
      periodEnd = ds;
      periodLabel = d.toLocaleDateString("en", {
        weekday: "long",
        month: "short",
        day: "numeric",
      });
    } else if (limitPeriod === "weekly") {
      const d = new Date(now);
      // Go to Monday of current week
      const dayOfWeek = d.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      d.setDate(d.getDate() + mondayOffset + timerPeriodOffset * 7);
      periodStart = d.toISOString().split("T")[0];
      const end = new Date(d);
      end.setDate(end.getDate() + 6);
      periodEnd = end.toISOString().split("T")[0];
      periodLabel = `${d.toLocaleDateString("en", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en", { month: "short", day: "numeric" })}`;
    } else {
      // monthly
      const d = new Date(
        now.getFullYear(),
        now.getMonth() + timerPeriodOffset,
        1,
      );
      periodStart = d.toISOString().split("T")[0];
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      periodEnd = end.toISOString().split("T")[0];
      periodLabel = d.toLocaleDateString("en", {
        month: "long",
        year: "numeric",
      });
    }

    // Filter entries to the current period
    const periodEntries = selectedStat.entries.filter(
      (e) => e.date >= periodStart && e.date <= periodEnd,
    );

    // Per-subject: total net minutes, daily data
    const subjectStats = new Map<
      string,
      {
        totalNet: number;
        totalGross: number;
        totalSubtracted: number;
        totalAdded: number;
        dailyData: { date: string; net: number; gross: number }[];
        daysWithData: number;
      }
    >();

    subjects.forEach((s) =>
      subjectStats.set(s.id, {
        totalNet: 0,
        totalGross: 0,
        totalSubtracted: 0,
        totalAdded: 0,
        dailyData: [],
        daysWithData: 0,
      }),
    );

    periodEntries.forEach((entry) => {
      if (entry.timerData?.entries) {
        entry.timerData.entries.forEach((te) => {
          const stats = subjectStats.get(te.subjectId);
          if (!stats) return;
          const storedMinutes = te.minutes || 0;
          const subtract = te.subtractMinutes || 0;
          // storedMinutes includes add adjustments, so strip them for base usage
          const adjs = te.adjustments || [];
          const adjAdd = adjs
            .filter((a) => a.type === "add")
            .reduce((s, a) => s + a.minutes, 0);
          const baseUsage = Math.max(0, storedMinutes - adjAdd);
          stats.totalNet += baseUsage;
          stats.totalGross += baseUsage;
          stats.totalSubtracted += subtract;
          stats.totalAdded += adjAdd;
          if (baseUsage > 0 || adjAdd > 0 || subtract > 0) {
            stats.dailyData.push({
              date: entry.date,
              net: baseUsage,
              gross: baseUsage,
            });
            stats.daysWithData++;
          }
        });
      }
    });

    // Sort each subject's daily data
    subjectStats.forEach((stats) => {
      stats.dailyData.sort((a, b) => a.date.localeCompare(b.date));
    });

    // Check if there's data in previous/next periods
    const hasPrevData = selectedStat.entries.some(
      (e) =>
        e.date < periodStart &&
        e.timerData?.entries?.some((te) => te.minutes > 0),
    );
    const hasNextData = timerPeriodOffset < 0; // Can always go forward until current period

    return {
      subjects,
      subjectStats,
      limitMinutes,
      limitPeriod,
      periodLabel,
      periodStart,
      periodEnd,
      hasPrevData,
      hasNextData,
    };
  }, [selectedStat, isTimerType, getActivityType, timerPeriodOffset]);

  // Calculate workout stats for the period
  const workoutStats = useMemo(() => {
    if (!selectedStat || !isWorkoutType) return null;

    // Collect all exercises from all entries
    const allExercises: { date: string; exercise: WorkoutExercise }[] = [];

    selectedStat.entries.forEach((entry) => {
      if (entry.workoutData?.exercises) {
        entry.workoutData.exercises.forEach((ex) => {
          allExercises.push({ date: entry.date, exercise: ex });
        });
      }
    });

    // Group by exercise name for frequency stats
    const exerciseCounts: Map<
      string,
      {
        count: number;
        category: string;
        totalWeight: number;
        totalReps: number;
        totalDistance: number;
        totalDuration: number;
      }
    > = new Map();

    // Track progress over time for each exercise (max weight/distance per day)
    const exerciseProgress: Map<
      string,
      { date: string; weight?: number; distance?: number; duration?: number }[]
    > = new Map();

    allExercises.forEach(({ date, exercise }) => {
      const existing = exerciseCounts.get(exercise.name) || {
        count: 0,
        category: exercise.category,
        totalWeight: 0,
        totalReps: 0,
        totalDistance: 0,
        totalDuration: 0,
      };
      existing.count += 1;
      existing.totalWeight += (exercise.weight || 0) * (exercise.sets || 1);
      existing.totalReps += (exercise.reps || 0) * (exercise.sets || 1);
      existing.totalDistance += exercise.distance || 0;
      existing.totalDuration += exercise.duration || 0;
      exerciseCounts.set(exercise.name, existing);

      // Track progress data points
      const progress = exerciseProgress.get(exercise.name) || [];
      progress.push({
        date,
        weight: exercise.weight,
        distance: exercise.distance,
        duration: exercise.duration,
      });
      exerciseProgress.set(exercise.name, progress);
    });

    // Get unique workout days
    const workoutDays = new Set(selectedStat.entries.map((e) => e.date));

    // Category breakdown
    const categoryBreakdown: Map<string, number> = new Map();
    allExercises.forEach(({ exercise }) => {
      const cat = exercise.category || "other";
      categoryBreakdown.set(cat, (categoryBreakdown.get(cat) || 0) + 1);
    });

    // Top exercises by frequency
    const topExercises = Array.from(exerciseCounts.entries()).sort(
      (a, b) => b[1].count - a[1].count,
    );

    // Calculate totals
    const totalWeight = allExercises.reduce(
      (sum, { exercise }) =>
        sum + (exercise.weight || 0) * (exercise.sets || 1),
      0,
    );
    const totalReps = allExercises.reduce(
      (sum, { exercise }) => sum + (exercise.reps || 0) * (exercise.sets || 1),
      0,
    );
    const totalDistance = allExercises.reduce(
      (sum, { exercise }) => sum + (exercise.distance || 0),
      0,
    );
    const totalDuration = allExercises.reduce(
      (sum, { exercise }) => sum + (exercise.duration || 0),
      0,
    );

    // Find exercises with weight progress (for chart)
    const exercisesWithWeightProgress = Array.from(exerciseProgress.entries())
      .filter(([, data]) => data.some((d) => d.weight))
      .map(([name, data]) => ({
        name,
        data: data
          .filter((d) => d.weight)
          .sort((a, b) => a.date.localeCompare(b.date)),
        maxWeight: Math.max(...data.map((d) => d.weight || 0)),
        latestWeight:
          data
            .filter((d) => d.weight)
            .sort((a, b) => b.date.localeCompare(a.date))[0]?.weight || 0,
      }))
      .sort((a, b) => b.data.length - a.data.length);

    // Find exercises with distance progress (for chart)
    const exercisesWithDistanceProgress = Array.from(exerciseProgress.entries())
      .filter(([, data]) => data.some((d) => d.distance))
      .map(([name, data]) => ({
        name,
        data: data
          .filter((d) => d.distance)
          .sort((a, b) => a.date.localeCompare(b.date)),
        maxDistance: Math.max(...data.map((d) => d.distance || 0)),
        totalDistance: data.reduce((sum, d) => sum + (d.distance || 0), 0),
      }))
      .sort((a, b) => b.data.length - a.data.length);

    // Calculate average workout days per week (cap range end at today)
    const rangeStart = new Date(currentRange.start + "T12:00:00");
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const rangeEnd = new Date(
      Math.min(
        new Date(currentRange.end + "T12:00:00").getTime(),
        today.getTime(),
      ),
    );
    const totalDays = Math.max(
      1,
      Math.round(
        (rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24),
      ) + 1,
    );
    const totalWeeks = Math.max(1, totalDays / 7);
    const avgPerWeek = Math.round((workoutDays.size / totalWeeks) * 10) / 10;

    return {
      totalExercises: allExercises.length,
      workoutDays: workoutDays.size,
      avgPerWeek,
      uniqueExercises: exerciseCounts.size,
      topExercises,
      categoryBreakdown: Array.from(categoryBreakdown.entries()),
      totalWeight: Math.round(totalWeight),
      totalReps,
      totalDistance: Math.round(totalDistance * 10) / 10,
      totalDuration,
      exerciseCounts,
      exercisesWithWeightProgress,
      exercisesWithDistanceProgress,
    };
  }, [selectedStat, isWorkoutType, currentRange]);

  // All-time workout progress (up to 1 year back) for curve charts
  const allTimeWorkoutProgress = useMemo(() => {
    if (!selectedActivityId || !isWorkoutType)
      return { strength: [], cardio: [] };

    const now = new Date();
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const cutoffDate = oneYearAgo.toISOString().split("T")[0];

    // Get all workout entries for the selected activity up to 1 year back
    const workoutEntries = allEntries.filter(
      (e) =>
        e.activityTypeId === selectedActivityId &&
        e.date >= cutoffDate &&
        e.workoutData?.exercises,
    );

    // Group by exercise name
    const exerciseProgress = new Map<
      string,
      { date: string; weight?: number; distance?: number; duration?: number }[]
    >();

    workoutEntries.forEach((entry) => {
      entry.workoutData!.exercises.forEach((ex) => {
        const progress = exerciseProgress.get(ex.name) || [];
        progress.push({
          date: entry.date,
          weight: ex.weight,
          distance: ex.distance,
          duration: ex.duration,
        });
        exerciseProgress.set(ex.name, progress);
      });
    });

    // Strength: exercises with weight data, aggregate max weight per day
    const strength = Array.from(exerciseProgress.entries())
      .filter(([, data]) => data.some((d) => d.weight && d.weight > 0))
      .map(([name, data]) => {
        // Aggregate: max weight per day
        const byDay = new Map<string, number>();
        data
          .filter((d) => d.weight && d.weight > 0)
          .forEach((d) => {
            const existing = byDay.get(d.date) || 0;
            byDay.set(d.date, Math.max(existing, d.weight!));
          });
        const points = Array.from(byDay.entries())
          .map(([date, weight]) => ({ date, weight }))
          .sort((a, b) => a.date.localeCompare(b.date));
        const maxWeight = Math.max(...points.map((p) => p.weight));
        const minWeight = Math.min(...points.map((p) => p.weight));
        const latestWeight = points[points.length - 1]?.weight || 0;
        const startWeight = points[0]?.weight || 0;
        const avgWeight =
          Math.round(
            (points.reduce((s, p) => s + p.weight, 0) / points.length) * 10,
          ) / 10;
        // Trend: compare second half avg to first half avg
        const half = Math.floor(points.length / 2);
        const firstHalfAvg =
          points.slice(0, half).reduce((s, p) => s + p.weight, 0) / (half || 1);
        const secondHalfAvg =
          points.slice(half).reduce((s, p) => s + p.weight, 0) /
          (points.length - half || 1);
        const trendPct =
          firstHalfAvg > 0
            ? Math.round(((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100)
            : 0;
        return {
          name,
          points,
          maxWeight,
          minWeight,
          latestWeight,
          startWeight,
          avgWeight,
          trendPct,
          dataCount: points.length,
        };
      })
      .filter((e) => e.points.length >= 2)
      .sort((a, b) => b.dataCount - a.dataCount);

    // Cardio: exercises with distance data, aggregate total distance per day
    const cardio = Array.from(exerciseProgress.entries())
      .filter(([, data]) => data.some((d) => d.distance && d.distance > 0))
      .map(([name, data]) => {
        const byDay = new Map<string, number>();
        data
          .filter((d) => d.distance && d.distance > 0)
          .forEach((d) => {
            const existing = byDay.get(d.date) || 0;
            byDay.set(d.date, Math.max(existing, d.distance!));
          });
        const points = Array.from(byDay.entries())
          .map(([date, distance]) => ({ date, distance }))
          .sort((a, b) => a.date.localeCompare(b.date));
        const maxDistance = Math.max(...points.map((p) => p.distance));
        const minDistance = Math.min(...points.map((p) => p.distance));
        const totalDistance = points.reduce((sum, p) => sum + p.distance, 0);
        const avgDistance =
          Math.round((totalDistance / points.length) * 10) / 10;
        const latestDistance = points[points.length - 1]?.distance || 0;
        const half = Math.floor(points.length / 2);
        const firstHalfAvg =
          points.slice(0, half).reduce((s, p) => s + p.distance, 0) /
          (half || 1);
        const secondHalfAvg =
          points.slice(half).reduce((s, p) => s + p.distance, 0) /
          (points.length - half || 1);
        const trendPct =
          firstHalfAvg > 0
            ? Math.round(((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100)
            : 0;
        return {
          name,
          points,
          maxDistance,
          minDistance,
          totalDistance,
          avgDistance,
          latestDistance,
          trendPct,
          dataCount: points.length,
        };
      })
      .filter((e) => e.points.length >= 2)
      .sort((a, b) => b.dataCount - a.dataCount);

    return { strength, cardio };
  }, [allEntries, selectedActivityId, isWorkoutType]);

  // State for showing all exercises and expanded exercise
  const [showAllExercises, setShowAllExercises] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("stats-show-all-exercises") === "true";
  });
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null);
  const [showSessionsFor, setShowSessionsFor] = useState<string | null>(null);

  // Get dates for selected value as a Set for quick lookup
  const datesForSelectedValue = useMemo(() => {
    if (!selectedStat || !selectedValue) return new Set<string>();

    const dates = selectedStat.entries
      .filter(
        (entry) => String(entry.value).trim().toLowerCase() === selectedValue,
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
        0,
      );
      const monthEnd = new Date(
        startDate.getFullYear(),
        startDate.getMonth() + 1,
        0,
        12,
        0,
        0,
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

  const barColorHex = [
    "#007aff",
    "#34c759",
    "#f59e0b",
    "#ff3b30",
    "#a855f7",
    "#06b6d4",
    "#ec4899",
    "#f97316",
  ];

  return (
    <div className='pb-16' onClick={handleBackgroundClick}>
      {/* Info button - top right */}
      {infoMode && (
        <div className='flex justify-end px-4 pt-3'>
          <button
            className='w-8 h-8 rounded-full border-2 border-ios-blue flex items-center justify-center'
            style={{ animation: "info-pulse 2.5s ease-in-out infinite" }}
            onClick={() => setShowInfoPopup(true)}>
            <span className='text-ios-blue text-[15px] font-semibold italic leading-none'>
              i
            </span>
          </button>
        </div>
      )}

      {/* Viewing Another User Banner */}
      {isViewingOther && viewingUser && (
        <div className='bg-ios-blue text-white px-4 py-3 flex items-center justify-between'>
          <div>
            <p className='text-sm font-medium'>Viewing shared data</p>
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

      {/* Header */}
      <div className='px-4 pt-6 pb-4 flex items-center justify-between'>
        <h1 className='text-2xl font-bold text-gray-900 dark:text-white'>
          Statistics
        </h1>
      </div>

      {/* Time Range Selector - iOS Segmented Control */}
      <div className='px-4 pb-3'>
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
            {activityTypes
              .filter((type) => {
                const stat = statistics.find(
                  (s) => s.activityTypeId === type.id,
                );
                return (stat?.totalEntries || 0) > 0;
              })
              .map((type, index) => {
                const stat = statistics.find(
                  (s) => s.activityTypeId === type.id,
                );
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
                        : "bg-white/80 dark:bg-ios-card-dark text-gray-700 dark:text-gray-300",
                    )}>
                    {type.icon && (
                      <span
                        className={cn(
                          "text-lg",
                          isSelected ? "opacity-100" : "opacity-70",
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
                            : "bg-gray-100 dark:bg-gray-700",
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
                  : "bg-ios-blue/5 dark:bg-ios-blue/10",
              )}>
              <div className='flex items-center gap-3'>
                {getActivityType(selectedStat.activityTypeId)?.icon && (
                  <div className='w-10 h-10 rounded-xl bg-ios-blue/10 flex items-center justify-center'>
                    <span className='text-ios-blue'>
                      {renderIcon(
                        getActivityType(selectedStat.activityTypeId)?.icon,
                        "w-6 h-6",
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
                        : "text-gray-900 dark:text-white",
                    )}>
                    {selectedStat.activityTypeName}
                  </h3>
                  <p className='text-[15px] text-gray-500 dark:text-gray-400'>
                    {selectedStat.totalEntries} entries over{" "}
                    {selectedStat.uniqueDays} days
                  </p>
                </div>
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
                                    : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400",
                              )}>
                              <div className='text-[10px] uppercase font-medium'>
                                {day.dayName}
                              </div>
                              <div
                                className={cn(
                                  "text-lg font-bold",
                                  day.isMarked && "text-white",
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
                                      : "text-gray-600 dark:text-gray-400",
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
                                    />,
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
                                            : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400",
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

            {/* Nutrition Stats View */}
            {isNutritionType && nutritionStats && (
              <div className='p-4'>
                {/* Summary Cards */}
                <div className='grid grid-cols-2 gap-3 mb-4'>
                  {/* Protein Card */}
                  {nutritionStats.goal.protein && (
                    <div className='p-3 rounded-xl bg-ios-blue/10'>
                      <div className='text-[13px] text-ios-blue font-medium mb-1'>
                        Protein Goal
                      </div>
                      <div className='text-[28px] font-bold text-ios-blue'>
                        {nutritionStats.proteinGoalRate}%
                      </div>
                      <div className='text-[12px] text-gray-500'>
                        {nutritionStats.daysProteinGoalMet}/
                        {nutritionStats.daysTracked} days hit{" "}
                        {nutritionStats.goal.protein}g
                      </div>
                    </div>
                  )}
                  {/* Calories Card */}
                  {nutritionStats.goal.calories && (
                    <div className='p-3 rounded-xl bg-ios-orange/10'>
                      <div className='text-[13px] text-ios-orange font-medium mb-1'>
                        Calorie Goal
                      </div>
                      <div className='text-[28px] font-bold text-ios-orange'>
                        {nutritionStats.caloriesGoalRate}%
                      </div>
                      <div className='text-[12px] text-gray-500'>
                        {nutritionStats.daysCaloriesGoalMet}/
                        {nutritionStats.daysTracked} days hit{" "}
                        {nutritionStats.goal.calories}
                      </div>
                    </div>
                  )}
                </div>

                {/* Daily Averages - Always show all 4 macros */}
                <h4 className='text-[13px] font-medium text-gray-500 mb-2'>
                  Daily Averages
                </h4>
                <div className='p-3 rounded-xl bg-gray-50 dark:bg-gray-800 mb-4'>
                  <div className='space-y-2'>
                    <div className='flex items-center justify-between'>
                      <span className='text-[15px] text-gray-700 dark:text-gray-300'>
                        Calories
                      </span>
                      <div className='flex items-center gap-2'>
                        <span className='text-[15px] font-semibold text-gray-900 dark:text-white'>
                          {nutritionStats.avgCalories}
                          {nutritionStats.goal.calories && (
                            <span className='text-gray-400 font-normal'>
                              {" "}
                              / {nutritionStats.goal.calories}
                            </span>
                          )}
                        </span>
                        {nutritionStats.goal.calories &&
                          nutritionStats.avgCalories >=
                            (nutritionStats.goal.calories || 0) && (
                            <span className='text-ios-green'>✓</span>
                          )}
                      </div>
                    </div>
                    <div className='flex items-center justify-between'>
                      <span className='text-[15px] text-gray-700 dark:text-gray-300'>
                        Protein
                      </span>
                      <div className='flex items-center gap-2'>
                        <span className='text-[15px] font-semibold text-gray-900 dark:text-white'>
                          {nutritionStats.avgProtein}
                          {nutritionStats.goal.protein ? (
                            <span className='text-gray-400 font-normal'>
                              {" "}
                              / {nutritionStats.goal.protein}g
                            </span>
                          ) : (
                            "g"
                          )}
                        </span>
                        {nutritionStats.goal.protein &&
                          nutritionStats.avgProtein >=
                            (nutritionStats.goal.protein || 0) && (
                            <span className='text-ios-green'>✓</span>
                          )}
                      </div>
                    </div>
                    <div className='flex items-center justify-between'>
                      <span className='text-[15px] text-gray-700 dark:text-gray-300'>
                        Carbs
                      </span>
                      <div className='flex items-center gap-2'>
                        <span className='text-[15px] font-semibold text-gray-900 dark:text-white'>
                          {nutritionStats.avgCarbs}
                          {nutritionStats.goal.carbs ? (
                            <span className='text-gray-400 font-normal'>
                              {" "}
                              / {nutritionStats.goal.carbs}g
                            </span>
                          ) : (
                            "g"
                          )}
                        </span>
                        {nutritionStats.goal.carbs &&
                          nutritionStats.avgCarbs >=
                            (nutritionStats.goal.carbs || 0) && (
                            <span className='text-ios-green'>✓</span>
                          )}
                      </div>
                    </div>
                    <div className='flex items-center justify-between'>
                      <span className='text-[15px] text-gray-700 dark:text-gray-300'>
                        Fat
                      </span>
                      <div className='flex items-center gap-2'>
                        <span className='text-[15px] font-semibold text-gray-900 dark:text-white'>
                          {nutritionStats.avgFat}
                          {nutritionStats.goal.fat ? (
                            <span className='text-gray-400 font-normal'>
                              {" "}
                              / {nutritionStats.goal.fat}g
                            </span>
                          ) : (
                            "g"
                          )}
                        </span>
                        {nutritionStats.goal.fat &&
                          nutritionStats.avgFat >=
                            (nutritionStats.goal.fat || 0) && (
                            <span className='text-ios-green'>✓</span>
                          )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Daily Progress Chart */}
                {nutritionStats.daysTracked > 0 &&
                  nutritionStats.goal.protein && (
                    <div className='mt-4 p-3 rounded-xl bg-gray-50 dark:bg-gray-800'>
                      <h4 className='text-[13px] font-medium text-gray-500 mb-3'>
                        Protein by Day
                      </h4>
                      <div className='flex items-end gap-1 h-24'>
                        {Array.from(nutritionStats.dailyTotals.entries())
                          .sort(([a], [b]) => a.localeCompare(b))
                          .slice(-14) // Show last 14 days max
                          .map(([date, data]) => {
                            const goalPercent = nutritionStats.goal.protein
                              ? Math.min(
                                  100,
                                  (data.protein / nutritionStats.goal.protein) *
                                    100,
                                )
                              : 0;
                            const metGoal =
                              data.protein >=
                              (nutritionStats.goal.protein || 0);
                            return (
                              <div
                                key={date}
                                className='flex-1 flex flex-col items-center'
                                title={`${date}: ${data.protein}g protein`}>
                                <div
                                  className='w-full relative'
                                  style={{ height: "80px" }}>
                                  <div
                                    className={cn(
                                      "absolute bottom-0 left-0 right-0 rounded-t transition-all",
                                      metGoal ? "bg-ios-green" : "bg-ios-blue",
                                    )}
                                    style={{ height: `${goalPercent}%` }}
                                  />
                                </div>
                                <div className='text-[9px] text-gray-400 mt-1'>
                                  {new Date(date).getDate()}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                      {/* Goal line indicator */}
                      <div className='flex items-center gap-2 mt-2 text-[11px] text-gray-500'>
                        <div className='flex items-center gap-1'>
                          <div className='w-3 h-3 rounded bg-ios-green' />
                          <span>Goal met</span>
                        </div>
                        <div className='flex items-center gap-1'>
                          <div className='w-3 h-3 rounded bg-ios-blue' />
                          <span>Below goal</span>
                        </div>
                      </div>
                    </div>
                  )}
              </div>
            )}

            {/* Workout Stats View */}
            {isWorkoutType && workoutStats && (
              <div className='p-4 space-y-4'>
                {/* Summary Cards */}
                <div className='grid grid-cols-2 gap-3'>
                  <div className='bg-white/80 dark:bg-gray-800 rounded-2xl p-4'>
                    <div className='text-[13px] text-gray-500 dark:text-gray-400 mb-1'>
                      Workout Days
                    </div>
                    <div className='text-[24px] font-bold text-gray-900 dark:text-white'>
                      {workoutStats.workoutDays}
                    </div>
                  </div>
                  <div className='bg-white/80 dark:bg-gray-800 rounded-2xl p-4'>
                    <div className='text-[13px] text-gray-500 dark:text-gray-400 mb-1'>
                      Average a Week
                    </div>
                    <div className='text-[24px] font-bold text-ios-blue'>
                      {workoutStats.avgPerWeek}
                    </div>
                  </div>
                </div>

                {/* Workout Calendar */}
                {calendarData && (
                  <div className='bg-white/80 dark:bg-gray-800 rounded-2xl p-4'>
                    <h4 className='text-[13px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3'>
                      Workout Days
                    </h4>
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
                                "flex-1 text-center py-2 px-1 rounded-xl transition-all",
                                day.isMarked
                                  ? "bg-ios-green text-white shadow-sm"
                                  : day.isToday
                                    ? "bg-ios-green/10 text-ios-green ring-1 ring-ios-green/30"
                                    : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400",
                              )}>
                              <div className='text-[10px] uppercase font-medium opacity-80'>
                                {day.dayName}
                              </div>
                              <div
                                className={cn(
                                  "text-lg font-bold",
                                  day.isMarked && "text-white",
                                )}>
                                {day.dayNum}
                              </div>
                              {day.isMarked && (
                                <div className='text-[10px]'>💪</div>
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
                          <div key={weekIdx} className='grid grid-cols-7 gap-1'>
                            {week.map((day) => (
                              <div
                                key={day.date}
                                className={cn(
                                  "aspect-square flex items-center justify-center text-[13px] rounded-lg",
                                  !day.isCurrentMonth && "opacity-30",
                                  day.isMarked
                                    ? "bg-ios-green text-white font-bold"
                                    : day.isToday
                                      ? "bg-ios-green/10 text-ios-green font-medium"
                                      : "text-gray-600 dark:text-gray-400",
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
                        <CalendarNavHeader
                          label={String(calendarData.year)}
                          onPrev={() => setOffset(offset - 1)}
                          onNext={() => setOffset(offset + 1)}
                          canGoPrev={canGoBack}
                          canGoNext={canGoForward}
                          onToday={() => setOffset(0)}
                          showToday={offset !== 0}
                        />
                        <div className='grid grid-cols-4 gap-2'>
                          {calendarData.months.map((month, idx) => {
                            const markedCount = month.days.filter((d) =>
                              allDatesForActivity.has(d.date),
                            ).length;
                            return (
                              <div
                                key={idx}
                                className='text-center p-2 rounded-xl bg-gray-50 dark:bg-gray-700/50'>
                                <div className='text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1'>
                                  {month.name}
                                </div>
                                <div
                                  className={cn(
                                    "text-[18px] font-bold",
                                    markedCount > 0
                                      ? "text-ios-green"
                                      : "text-gray-300 dark:text-gray-600",
                                  )}>
                                  {markedCount}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Category Breakdown */}
                {workoutStats.categoryBreakdown.length > 0 && (
                  <div className='bg-white/80 dark:bg-gray-800 rounded-2xl p-4'>
                    <h4 className='text-[13px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3'>
                      Categories
                    </h4>
                    <div className='space-y-3'>
                      {workoutStats.categoryBreakdown
                        .sort((a, b) => b[1] - a[1])
                        .map(([category, count]) => {
                          const total = workoutStats.totalExercises;
                          const percent = Math.round((count / total) * 100);
                          const categoryColors: Record<string, string> = {
                            strength: "bg-ios-blue",
                            cardio: "bg-ios-orange",
                            flexibility: "bg-purple-500",
                            other: "bg-gray-400",
                          };
                          const barColor =
                            categoryColors[category] || categoryColors.other;
                          return (
                            <div key={category}>
                              <div className='flex items-center justify-between text-[15px] mb-2'>
                                <span className='capitalize font-medium text-gray-900 dark:text-white'>
                                  {category}
                                </span>
                                <span className='text-[13px] text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full'>
                                  {count} ({percent}%)
                                </span>
                              </div>
                              <div className='h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden'>
                                <div
                                  className={cn(
                                    "h-full rounded-full transition-all",
                                    barColor,
                                  )}
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Exercises */}
                {workoutStats.topExercises.length > 0 && (
                  <div className='bg-white/80 dark:bg-gray-800 rounded-2xl overflow-hidden'>
                    <div className='px-4 pt-4 pb-2'>
                      <h4 className='text-[13px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400'>
                        Exercises
                      </h4>
                      <p className='text-[11px] text-gray-400 dark:text-gray-500 mt-0.5'>
                        Tap to see curve
                      </p>
                    </div>
                    <div>
                      {(showAllExercises
                        ? workoutStats.topExercises
                        : workoutStats.topExercises.slice(0, 5)
                      ).map(([name, data], index) => {
                        const isExpanded = expandedExercise === name;
                        // Find progress data from allTimeWorkoutProgress
                        const strengthData =
                          allTimeWorkoutProgress.strength.find(
                            (s) => s.name === name,
                          );
                        const cardioData = allTimeWorkoutProgress.cardio.find(
                          (c) => c.name === name,
                        );
                        const trendPct =
                          strengthData?.trendPct ?? cardioData?.trendPct ?? 0;
                        const maxLabel = strengthData
                          ? `${strengthData.maxWeight}kg`
                          : cardioData
                            ? `${cardioData.maxDistance % 1 === 0 ? cardioData.maxDistance : cardioData.maxDistance.toFixed(1)}km`
                            : null;
                        const hasChart = !!(strengthData || cardioData);
                        return (
                          <div key={name}>
                            <button
                              onClick={() =>
                                hasChart &&
                                setExpandedExercise(isExpanded ? null : name)
                              }
                              className={cn(
                                "w-full flex items-center justify-between px-4 py-3 transition-colors",
                                hasChart &&
                                  "active:bg-gray-50 dark:active:bg-gray-700/50",
                                index <
                                  (showAllExercises
                                    ? workoutStats.topExercises.length
                                    : Math.min(
                                        5,
                                        workoutStats.topExercises.length,
                                      )) -
                                    1 &&
                                  !isExpanded &&
                                  "border-b border-gray-100 dark:border-gray-700",
                              )}>
                              <div className='flex items-center gap-3'>
                                <div className='w-8 h-8 rounded-full bg-ios-blue/10 flex items-center justify-center'>
                                  <span className='text-[13px] font-bold text-ios-blue'>
                                    {index + 1}
                                  </span>
                                </div>
                                <div className='text-left'>
                                  <span className='text-[15px] text-gray-900 dark:text-white'>
                                    {name}
                                  </span>
                                </div>
                              </div>
                              <div className='flex items-center gap-2'>
                                {trendPct !== 0 && (
                                  <span
                                    className={cn(
                                      "text-[11px] font-semibold px-1.5 py-0.5 rounded-full",
                                      trendPct > 0
                                        ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                                        : "bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400",
                                    )}>
                                    {trendPct > 0 ? "↑" : "↓"}
                                    {Math.abs(trendPct)}%
                                  </span>
                                )}
                                {maxLabel && (
                                  <span className='text-[13px] font-semibold text-gray-600 dark:text-gray-300'>
                                    {maxLabel}
                                  </span>
                                )}
                              </div>
                            </button>
                            {/* Expanded curve */}
                            {isExpanded &&
                              strengthData &&
                              (() => {
                                const { points, maxWeight, minWeight } =
                                  strengthData;
                                const chartW = 280;
                                const chartH = 80;
                                const padL = 32;
                                const padR = 4;
                                const padY = 8;
                                const rangeW = maxWeight - minWeight || 1;
                                const pathPts = points.map((p, i) => ({
                                  x:
                                    padL +
                                    (points.length > 1
                                      ? (i / (points.length - 1)) *
                                        (chartW - padL - padR)
                                      : (chartW - padL - padR) / 2),
                                  y:
                                    padY +
                                    (1 - (p.weight - minWeight) / rangeW) *
                                      (chartH - 2 * padY),
                                  ...p,
                                }));
                                const smoothPath = pathPts.reduce(
                                  (acc, pt, i, arr) => {
                                    if (i === 0) return `M${pt.x},${pt.y}`;
                                    const prev = arr[i - 1];
                                    const cpx = (prev.x + pt.x) / 2;
                                    return `${acc} C${cpx},${prev.y} ${cpx},${pt.y} ${pt.x},${pt.y}`;
                                  },
                                  "",
                                );
                                const areaPath = `${smoothPath} L${pathPts[pathPts.length - 1].x},${chartH} L${pathPts[0].x},${chartH} Z`;
                                const prPt = pathPts.find(
                                  (p) => p.weight === maxWeight,
                                );
                                const fmtD = (d: string) =>
                                  new Date(d + "T12:00:00").toLocaleDateString(
                                    "en-US",
                                    { day: "numeric", month: "short" },
                                  );
                                return (
                                  <div className='px-4 pb-3 border-b border-gray-100 dark:border-gray-700'>
                                    <div className='bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 pb-1'>
                                      <svg
                                        viewBox={`0 0 ${chartW} ${chartH}`}
                                        className='w-full'
                                        style={{ height: 80 }}
                                        preserveAspectRatio='none'>
                                        <defs>
                                          <linearGradient
                                            id={`grad-ex-${name.replace(/\s/g, "")}`}
                                            x1='0'
                                            y1='0'
                                            x2='0'
                                            y2='1'>
                                            <stop
                                              offset='0%'
                                              stopColor='#007AFF'
                                              stopOpacity='0.2'
                                            />
                                            <stop
                                              offset='100%'
                                              stopColor='#007AFF'
                                              stopOpacity='0.02'
                                            />
                                          </linearGradient>
                                        </defs>
                                        <line
                                          x1={padL}
                                          y1={padY}
                                          x2={chartW - padR}
                                          y2={padY}
                                          stroke='#e5e7eb'
                                          strokeWidth='0.5'
                                          strokeDasharray='3,3'
                                        />
                                        <line
                                          x1={padL}
                                          y1={chartH - padY}
                                          x2={chartW - padR}
                                          y2={chartH - padY}
                                          stroke='#e5e7eb'
                                          strokeWidth='0.5'
                                          strokeDasharray='3,3'
                                        />
                                        <text
                                          x={padL - 4}
                                          y={padY + 3}
                                          textAnchor='end'
                                          fontSize='8'
                                          fill='#9ca3af'>
                                          {maxWeight}
                                        </text>
                                        <text
                                          x={padL - 4}
                                          y={chartH - padY + 3}
                                          textAnchor='end'
                                          fontSize='8'
                                          fill='#9ca3af'>
                                          {minWeight}
                                        </text>
                                        <path
                                          d={areaPath}
                                          fill={`url(#grad-ex-${name.replace(/\s/g, "")})`}
                                        />
                                        <path
                                          d={smoothPath}
                                          fill='none'
                                          stroke='#007AFF'
                                          strokeWidth='2.5'
                                          strokeLinecap='round'
                                          strokeLinejoin='round'
                                        />
                                        {prPt && (
                                          <circle
                                            cx={prPt.x}
                                            cy={prPt.y}
                                            r='4'
                                            fill='#34C759'
                                            stroke='white'
                                            strokeWidth='2'
                                          />
                                        )}
                                        <circle
                                          cx={pathPts[pathPts.length - 1].x}
                                          cy={pathPts[pathPts.length - 1].y}
                                          r='3.5'
                                          fill='#007AFF'
                                          stroke='white'
                                          strokeWidth='1.5'
                                        />
                                      </svg>
                                      <div className='flex justify-between mt-1'>
                                        <span className='text-[10px] text-gray-400'>
                                          {fmtD(points[0].date)}
                                        </span>
                                        <span className='text-[10px] text-gray-400'>
                                          {fmtD(points[points.length - 1].date)}
                                        </span>
                                      </div>
                                    </div>
                                    <div className='flex items-center justify-between text-[11px] text-gray-500 px-1 mt-2'>
                                      <span>
                                        PR{" "}
                                        <span className='font-semibold text-green-500'>
                                          {maxWeight}kg
                                        </span>
                                      </span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setShowSessionsFor(
                                            showSessionsFor === name
                                              ? null
                                              : name,
                                          );
                                        }}
                                        className='text-ios-blue active:opacity-70'>
                                        {points.length} sessions{" "}
                                        {showSessionsFor === name ? "▲" : "▼"}
                                      </button>
                                    </div>
                                    {showSessionsFor === name &&
                                      (() => {
                                        const reversed = [...points].reverse();
                                        const byYear: Record<
                                          string,
                                          typeof reversed
                                        > = {};
                                        reversed.forEach((pt) => {
                                          const yr = pt.date.slice(0, 4);
                                          if (!byYear[yr]) byYear[yr] = [];
                                          byYear[yr].push(pt);
                                        });
                                        const years = Object.keys(byYear).sort(
                                          (a, b) => b.localeCompare(a),
                                        );
                                        return (
                                          <div className='mt-2 space-y-2'>
                                            {years.map((yr) => (
                                              <div key={yr}>
                                                {years.length > 1 && (
                                                  <div className='text-[10px] font-semibold text-gray-400 dark:text-gray-500 mb-1'>
                                                    {yr}
                                                  </div>
                                                )}
                                                <div className='flex flex-wrap gap-1.5'>
                                                  {byYear[yr].map((pt) => {
                                                    const d = new Date(
                                                      pt.date + "T12:00:00",
                                                    );
                                                    const label =
                                                      d.toLocaleDateString(
                                                        "en-US",
                                                        {
                                                          day: "numeric",
                                                          month: "short",
                                                        },
                                                      );
                                                    const isPR =
                                                      pt.weight === maxWeight;
                                                    return (
                                                      <button
                                                        key={pt.date}
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          setSelectedDate(
                                                            pt.date,
                                                          );
                                                          router.push("/");
                                                        }}
                                                        className={cn(
                                                          "inline-flex items-center gap-1 pl-2 pr-1.5 py-1 rounded-lg text-[11px] active:scale-95 transition-transform",
                                                          isPR
                                                            ? "bg-green-50 dark:bg-green-900/20"
                                                            : "bg-gray-50 dark:bg-gray-700/50",
                                                        )}>
                                                        <span className='text-gray-500 dark:text-gray-400'>
                                                          {label}
                                                        </span>
                                                        <span
                                                          className={cn(
                                                            "text-[10px] font-bold px-1.5 py-0.5 rounded-md",
                                                            isPR
                                                              ? "bg-green-500 text-white"
                                                              : "bg-ios-blue/10 text-ios-blue dark:bg-ios-blue/20",
                                                          )}>
                                                          {pt.weight}kg
                                                        </span>
                                                      </button>
                                                    );
                                                  })}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        );
                                      })()}
                                  </div>
                                );
                              })()}
                            {isExpanded &&
                              cardioData &&
                              !strengthData &&
                              (() => {
                                const { points, maxDistance, minDistance } =
                                  cardioData;
                                const chartW = 280;
                                const chartH = 80;
                                const padL = 32;
                                const padR = 4;
                                const padY = 8;
                                const rangeD = maxDistance - minDistance || 1;
                                const pathPts = points.map((p, i) => ({
                                  x:
                                    padL +
                                    (points.length > 1
                                      ? (i / (points.length - 1)) *
                                        (chartW - padL - padR)
                                      : (chartW - padL - padR) / 2),
                                  y:
                                    padY +
                                    (1 - (p.distance - minDistance) / rangeD) *
                                      (chartH - 2 * padY),
                                  ...p,
                                }));
                                const smoothPath = pathPts.reduce(
                                  (acc, pt, i, arr) => {
                                    if (i === 0) return `M${pt.x},${pt.y}`;
                                    const prev = arr[i - 1];
                                    const cpx = (prev.x + pt.x) / 2;
                                    return `${acc} C${cpx},${prev.y} ${cpx},${pt.y} ${pt.x},${pt.y}`;
                                  },
                                  "",
                                );
                                const areaPath = `${smoothPath} L${pathPts[pathPts.length - 1].x},${chartH} L${pathPts[0].x},${chartH} Z`;
                                const prPt = pathPts.find(
                                  (p) => p.distance === maxDistance,
                                );
                                const fmtD = (d: string) =>
                                  new Date(d + "T12:00:00").toLocaleDateString(
                                    "en-US",
                                    { day: "numeric", month: "short" },
                                  );
                                const fmtDist = (d: number) =>
                                  d % 1 === 0 ? String(d) : d.toFixed(1);
                                return (
                                  <div className='px-4 pb-3 border-b border-gray-100 dark:border-gray-700'>
                                    <div className='bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 pb-1'>
                                      <svg
                                        viewBox={`0 0 ${chartW} ${chartH}`}
                                        className='w-full'
                                        style={{ height: 80 }}
                                        preserveAspectRatio='none'>
                                        <defs>
                                          <linearGradient
                                            id={`grad-ex-${name.replace(/\s/g, "")}`}
                                            x1='0'
                                            y1='0'
                                            x2='0'
                                            y2='1'>
                                            <stop
                                              offset='0%'
                                              stopColor='#FF9500'
                                              stopOpacity='0.2'
                                            />
                                            <stop
                                              offset='100%'
                                              stopColor='#FF9500'
                                              stopOpacity='0.02'
                                            />
                                          </linearGradient>
                                        </defs>
                                        <line
                                          x1={padL}
                                          y1={padY}
                                          x2={chartW - padR}
                                          y2={padY}
                                          stroke='#e5e7eb'
                                          strokeWidth='0.5'
                                          strokeDasharray='3,3'
                                        />
                                        <line
                                          x1={padL}
                                          y1={chartH - padY}
                                          x2={chartW - padR}
                                          y2={chartH - padY}
                                          stroke='#e5e7eb'
                                          strokeWidth='0.5'
                                          strokeDasharray='3,3'
                                        />
                                        <text
                                          x={padL - 4}
                                          y={padY + 3}
                                          textAnchor='end'
                                          fontSize='8'
                                          fill='#9ca3af'>
                                          {fmtDist(maxDistance)}
                                        </text>
                                        <text
                                          x={padL - 4}
                                          y={chartH - padY + 3}
                                          textAnchor='end'
                                          fontSize='8'
                                          fill='#9ca3af'>
                                          {fmtDist(minDistance)}
                                        </text>
                                        <path
                                          d={areaPath}
                                          fill={`url(#grad-ex-${name.replace(/\s/g, "")})`}
                                        />
                                        <path
                                          d={smoothPath}
                                          fill='none'
                                          stroke='#FF9500'
                                          strokeWidth='2.5'
                                          strokeLinecap='round'
                                          strokeLinejoin='round'
                                        />
                                        {prPt && (
                                          <circle
                                            cx={prPt.x}
                                            cy={prPt.y}
                                            r='4'
                                            fill='#34C759'
                                            stroke='white'
                                            strokeWidth='2'
                                          />
                                        )}
                                        <circle
                                          cx={pathPts[pathPts.length - 1].x}
                                          cy={pathPts[pathPts.length - 1].y}
                                          r='3.5'
                                          fill='#FF9500'
                                          stroke='white'
                                          strokeWidth='1.5'
                                        />
                                      </svg>
                                      <div className='flex justify-between mt-1'>
                                        <span className='text-[10px] text-gray-400'>
                                          {fmtD(points[0].date)}
                                        </span>
                                        <span className='text-[10px] text-gray-400'>
                                          {fmtD(points[points.length - 1].date)}
                                        </span>
                                      </div>
                                    </div>
                                    <div className='flex items-center justify-between text-[11px] text-gray-500 px-1 mt-2'>
                                      <span>
                                        Best{" "}
                                        <span className='font-semibold text-green-500'>
                                          {fmtDist(maxDistance)}km
                                        </span>
                                      </span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setShowSessionsFor(
                                            showSessionsFor === name
                                              ? null
                                              : name,
                                          );
                                        }}
                                        className='text-ios-blue active:opacity-70'>
                                        {points.length} sessions{" "}
                                        {showSessionsFor === name ? "▲" : "▼"}
                                      </button>
                                    </div>
                                    {showSessionsFor === name &&
                                      (() => {
                                        const reversed = [...points].reverse();
                                        const byYear: Record<
                                          string,
                                          typeof reversed
                                        > = {};
                                        reversed.forEach((pt) => {
                                          const yr = pt.date.slice(0, 4);
                                          if (!byYear[yr]) byYear[yr] = [];
                                          byYear[yr].push(pt);
                                        });
                                        const years = Object.keys(byYear).sort(
                                          (a, b) => b.localeCompare(a),
                                        );
                                        return (
                                          <div className='mt-2 space-y-2'>
                                            {years.map((yr) => (
                                              <div key={yr}>
                                                {years.length > 1 && (
                                                  <div className='text-[10px] font-semibold text-gray-400 dark:text-gray-500 mb-1'>
                                                    {yr}
                                                  </div>
                                                )}
                                                <div className='flex flex-wrap gap-1.5'>
                                                  {byYear[yr].map((pt) => {
                                                    const d = new Date(
                                                      pt.date + "T12:00:00",
                                                    );
                                                    const label =
                                                      d.toLocaleDateString(
                                                        "en-US",
                                                        {
                                                          day: "numeric",
                                                          month: "short",
                                                        },
                                                      );
                                                    const isBest =
                                                      pt.distance ===
                                                      maxDistance;
                                                    return (
                                                      <button
                                                        key={pt.date}
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          setSelectedDate(
                                                            pt.date,
                                                          );
                                                          router.push("/");
                                                        }}
                                                        className={cn(
                                                          "inline-flex items-center gap-1 pl-2 pr-1.5 py-1 rounded-lg text-[11px] active:scale-95 transition-transform",
                                                          isBest
                                                            ? "bg-green-50 dark:bg-green-900/20"
                                                            : "bg-gray-50 dark:bg-gray-700/50",
                                                        )}>
                                                        <span className='text-gray-500 dark:text-gray-400'>
                                                          {label}
                                                        </span>
                                                        <span
                                                          className={cn(
                                                            "text-[10px] font-bold px-1.5 py-0.5 rounded-md",
                                                            isBest
                                                              ? "bg-green-500 text-white"
                                                              : "bg-orange-500/10 text-orange-500 dark:bg-orange-500/20",
                                                          )}>
                                                          {fmtDist(pt.distance)}
                                                          km
                                                        </span>
                                                      </button>
                                                    );
                                                  })}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        );
                                      })()}
                                  </div>
                                );
                              })()}
                          </div>
                        );
                      })}
                    </div>
                    {workoutStats.topExercises.length > 5 && (
                      <button
                        onClick={() => {
                          const next = !showAllExercises;
                          setShowAllExercises(next);
                          localStorage.setItem(
                            "stats-show-all-exercises",
                            String(next),
                          );
                        }}
                        className='w-full text-center text-[13px] text-ios-blue font-medium py-3 border-t border-gray-100 dark:border-gray-700'>
                        {showAllExercises
                          ? "Show less"
                          : `Show all (${workoutStats.topExercises.length})`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Checklist Stats View */}
            {isChecklistType && checklistStats && (
              <div className='p-4'>
                <h4 className='text-[13px] font-normal text-gray-500 dark:text-gray-400 mb-3'>
                  Tap to see dates
                </h4>
                <div className='space-y-3'>
                  {(showAllChecklistItems
                    ? checklistStats.allItems
                    : checklistStats.allItems.slice(0, 5)
                  ).map((item, index) => {
                    const isSelected = selectedChecklistItem === item.text;
                    const itemBarColor = barColors[index % barColors.length];
                    return (
                      <div key={item.text}>
                        <button
                          onClick={() =>
                            setSelectedChecklistItem(
                              isSelected ? null : item.text,
                            )
                          }
                          className={cn(
                            "w-full text-left space-y-1 p-2 -m-2 rounded-lg transition-all",
                            isSelected
                              ? "bg-ios-blue/5 dark:bg-ios-blue/10"
                              : "active:bg-gray-100 dark:active:bg-gray-800",
                          )}>
                          <div className='flex items-center justify-between text-[15px]'>
                            <div className='flex items-center gap-2 truncate mr-2'>
                              {index < 10 && (
                                <div
                                  className={cn(
                                    "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0",
                                    itemBarColor,
                                  )}>
                                  {index + 1}
                                </div>
                              )}
                              <span
                                className={cn(
                                  "truncate",
                                  isSelected
                                    ? "text-ios-blue font-medium"
                                    : "text-gray-700 dark:text-gray-300",
                                )}>
                                {item.text}
                              </span>
                            </div>
                            <div className='flex items-center gap-2'>
                              <span className='text-[13px] text-gray-600 dark:text-gray-400 font-medium shrink-0 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full'>
                                {item.count}
                              </span>
                            </div>
                          </div>
                          <div className='h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden'>
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                itemBarColor,
                              )}
                              style={{
                                width: `${(item.count / checklistStats.maxCount) * 100}%`,
                              }}
                            />
                          </div>
                        </button>

                        {/* Calendar view when selected */}
                        {isSelected && checklistItemCalendarData && (
                          <div
                            className='mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl'
                            onClick={(e) => e.stopPropagation()}>
                            {checklistItemCalendarData.type === "week" && (
                              <div>
                                <CalendarNavHeader
                                  label={checklistItemCalendarData.weekRange}
                                  onPrev={() => setOffset(offset - 1)}
                                  onNext={() => setOffset(offset + 1)}
                                  canGoPrev={canGoBack}
                                  canGoNext={canGoForward}
                                  onToday={() => setOffset(0)}
                                  showToday={offset !== 0}
                                />
                                <div className='flex justify-between gap-1'>
                                  {checklistItemCalendarData.days.map((day) => (
                                    <div
                                      key={day.date}
                                      className={cn(
                                        "flex-1 text-center py-2 px-1 rounded-lg",
                                        day.isMarked
                                          ? `${itemBarColor} text-white`
                                          : day.isToday
                                            ? "bg-ios-blue/10 text-ios-blue"
                                            : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400",
                                      )}>
                                      <div className='text-[10px] uppercase font-medium'>
                                        {day.dayName}
                                      </div>
                                      <div
                                        className={cn(
                                          "text-lg font-bold",
                                          day.isMarked && "text-white",
                                        )}>
                                        {day.dayNum}
                                      </div>
                                      <div className='text-[9px] opacity-70'>
                                        {day.month}
                                      </div>
                                      {day.isMarked && (
                                        <div className='text-[10px]'>✓</div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {checklistItemCalendarData.type === "month" && (
                              <div>
                                <CalendarNavHeader
                                  label={checklistItemCalendarData.monthName}
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
                                {checklistItemCalendarData.weeks.map(
                                  (week, weekIdx) => (
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
                                              ? `${itemBarColor} text-white font-bold`
                                              : day.isToday
                                                ? "bg-ios-blue/10 text-ios-blue font-medium"
                                                : "text-gray-600 dark:text-gray-400",
                                          )}>
                                          {day.dayNum}
                                        </div>
                                      ))}
                                    </div>
                                  ),
                                )}
                              </div>
                            )}

                            {checklistItemCalendarData.type === "year" && (
                              <div className='space-y-2'>
                                <CalendarNavHeader
                                  label={String(checklistItemCalendarData.year)}
                                  onPrev={() => setOffset(offset - 1)}
                                  onNext={() => setOffset(offset + 1)}
                                  canGoPrev={canGoBack}
                                  canGoNext={canGoForward}
                                  onToday={() => setOffset(0)}
                                  showToday={offset !== 0}
                                />
                                <div className='grid grid-cols-2 gap-4'>
                                  {checklistItemCalendarData.months.map(
                                    (month, idx) => (
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
                                            const firstDay = new Date(
                                              month.year,
                                              idx,
                                              1,
                                            );
                                            const startDay =
                                              (firstDay.getDay() + 6) % 7;
                                            const emptyCells = [];
                                            for (let i = 0; i < startDay; i++) {
                                              emptyCells.push(
                                                <div
                                                  key={`empty-${i}`}
                                                  className='w-4 h-4'
                                                />,
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
                                                    ? `${itemBarColor} text-white font-bold`
                                                    : day.isToday
                                                      ? "bg-ios-blue/30 text-ios-blue font-medium"
                                                      : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400",
                                              )}
                                              title={`${day.dayNum}. ${month.name}${
                                                day.isMarked ? " ✓" : ""
                                              }`}>
                                              {day.dayNum}
                                            </div>
                                          ))}
                                        </div>
                                        <div className='mt-1 text-[10px] text-gray-500 dark:text-gray-400'>
                                          {month.days.filter((d) => d.isMarked)
                                            .length > 0 && (
                                            <span className='text-ios-blue font-medium'>
                                              {
                                                month.days.filter(
                                                  (d) => d.isMarked,
                                                ).length
                                              }{" "}
                                              days
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    ),
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {checklistStats.allItems.length > 5 && (
                  <button
                    onClick={() => {
                      const next = !showAllChecklistItems;
                      setShowAllChecklistItems(next);
                      localStorage.setItem(
                        "stats-show-all-checklist",
                        String(next),
                      );
                    }}
                    className='mt-4 w-full text-center text-[13px] text-ios-blue font-medium py-2'>
                    {showAllChecklistItems
                      ? "Show less"
                      : `Show all (${checklistStats.uniqueItems})`}
                  </button>
                )}
              </div>
            )}

            {/* Timer Stats View - Progress bars per subject */}
            {isTimerType && timerStats && (
              <div className='p-4 space-y-4'>
                {/* Period navigation */}
                <div className='flex items-center justify-between'>
                  <button
                    onClick={() => setTimerPeriodOffset((o) => o - 1)}
                    disabled={!timerStats.hasPrevData}
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                      timerStats.hasPrevData
                        ? "text-ios-blue active:bg-ios-blue/10"
                        : "text-gray-300 dark:text-gray-600",
                    )}>
                    <svg
                      className='w-5 h-5'
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'
                      strokeWidth={2}>
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        d='M15 19l-7-7 7-7'
                      />
                    </svg>
                  </button>
                  <span className='text-[14px] font-medium text-gray-700 dark:text-gray-300'>
                    {timerStats.periodLabel}
                  </span>
                  <button
                    onClick={() => setTimerPeriodOffset((o) => o + 1)}
                    disabled={!timerStats.hasNextData}
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                      timerStats.hasNextData
                        ? "text-ios-blue active:bg-ios-blue/10"
                        : "text-gray-300 dark:text-gray-600",
                    )}>
                    <svg
                      className='w-5 h-5'
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'
                      strokeWidth={2}>
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        d='M9 5l7 7-7 7'
                      />
                    </svg>
                  </button>
                </div>

                {timerStats.subjects.map((subject, index) => {
                  const stats = timerStats.subjectStats.get(subject.id);
                  if (!stats) return null;

                  const isExpanded = expandedTimerSubject === subject.id;
                  const barColor = barColorHex[index % barColorHex.length];
                  const subjectLimit =
                    subject.limitMinutes || timerStats.limitMinutes || 0;
                  // Effective budget usage: base + subtracted - added
                  const effectiveUsage = Math.max(
                    0,
                    stats.totalNet + stats.totalSubtracted - stats.totalAdded,
                  );
                  const displayTotal = effectiveUsage;
                  const netH = Math.floor(displayTotal / 60);
                  const netM = displayTotal % 60;
                  const netStr = netH > 0 ? `${netH}h ${netM}m` : `${netM}m`;
                  const limitH = Math.floor(subjectLimit / 60);
                  const limitM = subjectLimit % 60;
                  const limitStr =
                    subjectLimit > 0
                      ? limitH > 0
                        ? `${limitH}h${limitM > 0 ? ` ${limitM}m` : ""}`
                        : `${limitM}m`
                      : "";
                  const usedPct =
                    subjectLimit > 0
                      ? Math.min(
                          100,
                          Math.round((effectiveUsage / subjectLimit) * 100),
                        )
                      : 0;
                  const overLimit =
                    subjectLimit > 0 && effectiveUsage > subjectLimit;

                  return (
                    <div key={subject.id}>
                      {/* Subject progress bar - clickable */}
                      <button
                        onClick={() =>
                          setExpandedTimerSubject(
                            isExpanded ? null : subject.id,
                          )
                        }
                        className='w-full text-left space-y-1.5'>
                        <div className='flex items-center justify-between'>
                          <span className='text-[15px] font-medium text-gray-900 dark:text-white'>
                            {subject.name}
                          </span>
                          <div className='flex items-center gap-1.5'>
                            <span
                              className={cn(
                                "text-[15px] font-semibold",
                                overLimit
                                  ? "text-ios-red"
                                  : "text-gray-900 dark:text-white",
                              )}>
                              {stats.totalNet > 0 || displayTotal > 0
                                ? netStr
                                : "0m"}
                            </span>
                            {subjectLimit > 0 && (
                              <span className='text-[13px] text-gray-400 dark:text-gray-500'>
                                / {limitStr}
                              </span>
                            )}
                            <svg
                              className={cn(
                                "w-3.5 h-3.5 text-gray-400 transition-transform ml-0.5",
                                isExpanded && "rotate-180",
                              )}
                              fill='none'
                              viewBox='0 0 24 24'
                              stroke='currentColor'
                              strokeWidth={2}>
                              <path
                                strokeLinecap='round'
                                strokeLinejoin='round'
                                d='M19 9l-7 7-7-7'
                              />
                            </svg>
                          </div>
                        </div>
                        {subjectLimit > 0 && (
                          <div className='h-2.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden'>
                            <div
                              className='h-full rounded-full transition-all'
                              style={{
                                width: `${usedPct}%`,
                                backgroundColor: overLimit
                                  ? "#ff3b30"
                                  : usedPct > 80
                                    ? "#ff9500"
                                    : barColor,
                              }}
                            />
                          </div>
                        )}
                        {!subjectLimit && displayTotal > 0 && (
                          <div className='h-2.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden'>
                            <div
                              className='h-full rounded-full transition-all'
                              style={{
                                width: "100%",
                                backgroundColor: barColor,
                                opacity: 0.6,
                              }}
                            />
                          </div>
                        )}
                      </button>

                      {/* Expanded: daily breakdown */}
                      {isExpanded && (
                        <div className='mt-2 rounded-xl bg-gray-50 dark:bg-gray-800/50 overflow-hidden'>
                          {/* Day-by-day list */}
                          {stats.dailyData.length > 0 ? (
                            <div className='divide-y divide-gray-200/50 dark:divide-gray-700/50'>
                              {[...stats.dailyData].reverse().map((day) => {
                                const h = Math.floor(day.net / 60);
                                const m = day.net % 60;
                                const dateObj = new Date(
                                  day.date + "T12:00:00",
                                );
                                const dayStr = dateObj.toLocaleDateString(
                                  "en",
                                  {
                                    weekday: "short",
                                    month: "short",
                                    day: "numeric",
                                  },
                                );
                                const dayPct =
                                  subjectLimit > 0
                                    ? Math.min(
                                        100,
                                        Math.round(
                                          (day.net / subjectLimit) * 100,
                                        ),
                                      )
                                    : 0;
                                const dayOver =
                                  subjectLimit > 0 && day.net > subjectLimit;

                                return (
                                  <div
                                    key={day.date}
                                    className='px-3 py-2 space-y-1'>
                                    <div className='flex items-center justify-between text-[13px]'>
                                      <span className='text-gray-600 dark:text-gray-300'>
                                        {dayStr}
                                      </span>
                                      <span
                                        className={cn(
                                          "font-medium",
                                          dayOver
                                            ? "text-ios-red"
                                            : "text-gray-900 dark:text-white",
                                        )}>
                                        {h > 0 ? `${h}h ${m}m` : `${m}m`}
                                      </span>
                                    </div>
                                    {subjectLimit > 0 && (
                                      <div className='h-1 rounded-full bg-gray-200 dark:bg-gray-600 overflow-hidden'>
                                        <div
                                          className='h-full rounded-full transition-all'
                                          style={{
                                            width: `${dayPct}%`,
                                            backgroundColor: dayOver
                                              ? "#ff3b30"
                                              : dayPct > 80
                                                ? "#ff9500"
                                                : barColor,
                                          }}
                                        />
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className='px-3 py-3 text-center text-[13px] text-gray-400 dark:text-gray-500'>
                              No data this period
                            </div>
                          )}
                          {/* Summary at the bottom */}
                          {stats.daysWithData > 0 && (
                            <div className='px-3 py-2 border-t border-gray-200/60 dark:border-gray-700/60 space-y-0.5'>
                              <div className='flex items-center justify-between text-[13px]'>
                                <span className='text-gray-500 dark:text-gray-400'>
                                  Average per day
                                </span>
                                <span className='text-gray-500 dark:text-gray-400'>
                                  {(() => {
                                    const avg = Math.round(
                                      stats.totalNet / stats.daysWithData,
                                    );
                                    const h = Math.floor(avg / 60);
                                    const m = avg % 60;
                                    return h > 0 ? `${h}h ${m}m` : `${m}m`;
                                  })()}
                                </span>
                              </div>
                              {stats.totalAdded > 0 && (
                                <div className='flex items-center justify-between text-[13px]'>
                                  <span className='text-gray-500 dark:text-gray-400'>
                                    Total added
                                  </span>
                                  <span className='text-gray-500 dark:text-gray-400'>
                                    +
                                    {Math.floor(stats.totalAdded / 60) > 0
                                      ? `${Math.floor(stats.totalAdded / 60)}h ${stats.totalAdded % 60}m`
                                      : `${stats.totalAdded}m`}
                                  </span>
                                </div>
                              )}
                              {stats.totalSubtracted > 0 && (
                                <div className='flex items-center justify-between text-[13px]'>
                                  <span className='text-gray-500 dark:text-gray-400'>
                                    Total subtracted
                                  </span>
                                  <span className='text-gray-500 dark:text-gray-400'>
                                    −
                                    {Math.floor(stats.totalSubtracted / 60) > 0
                                      ? `${Math.floor(stats.totalSubtracted / 60)}h ${stats.totalSubtracted % 60}m`
                                      : `${stats.totalSubtracted}m`}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Top Viewed TV Series Grid */}
            {isTvSeriesType && topViewedSeries.length > 0 && (
              <div className='p-4 border-b border-gray-200/80 dark:border-gray-700/80'>
                <div className='flex items-center justify-between mb-3'>
                  <h4 className='text-[13px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400'>
                    Most Watched
                  </h4>
                  <div className='relative'>
                    <select
                      value={topSeriesCount}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setTopSeriesCount(val);
                        localStorage.setItem(
                          "stats-top-series-count",
                          String(val),
                        );
                      }}
                      className='appearance-none bg-gray-100 dark:bg-gray-700/80 text-[13px] font-medium text-ios-blue pl-3 pr-7 py-1.5 rounded-full outline-none cursor-pointer'>
                      {[3, 6, 9, 12, 15].map((n) => (
                        <option key={n} value={n}>
                          Top {n}
                        </option>
                      ))}
                    </select>
                    <svg
                      className='absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-ios-blue pointer-events-none'
                      fill='none'
                      stroke='currentColor'
                      strokeWidth={2.5}
                      viewBox='0 0 24 24'>
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        d='M19 9l-7 7-7-7'
                      />
                    </svg>
                  </div>
                </div>
                <div className='grid grid-cols-3 gap-3'>
                  {topViewedSeries.slice(0, topSeriesCount).map((series) => {
                    const seriesKey = series.name.toLowerCase();
                    const isSelected = selectedValue === seriesKey;
                    return (
                      <div key={series.name} className='relative'>
                        <button
                          onClick={() => {
                            setSelectedValue(isSelected ? null : seriesKey);
                            setShowAllDates(false);
                          }}
                          className={cn(
                            "aspect-[2/3] rounded-xl overflow-hidden bg-gray-200 dark:bg-gray-700 w-full transition-all",
                            isSelected &&
                              "ring-2 ring-ios-blue ring-offset-2 dark:ring-offset-gray-900",
                          )}>
                          {series.poster ? (
                            <img
                              src={series.poster}
                              alt={series.name}
                              className='w-full h-full object-cover'
                            />
                          ) : (
                            <div className='w-full h-full flex items-center justify-center text-[11px] text-gray-500 dark:text-gray-400 px-1 text-center'>
                              {series.name}
                            </div>
                          )}
                        </button>
                        {/* Notification badge */}
                        <div className='absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1 flex items-center justify-center rounded-full bg-ios-red text-white text-[12px] font-bold shadow-sm'>
                          {series.count}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Calendar for selected top series */}
                {selectedValue &&
                  topViewedSeries
                    .slice(0, topSeriesCount)
                    .some((s) => s.name.toLowerCase() === selectedValue) &&
                  calendarData && (
                    <div
                      className='mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl'
                      onClick={(e) => e.stopPropagation()}>
                      <div className='flex items-center justify-between mb-2'>
                        <span className='text-[13px] font-medium text-gray-700 dark:text-gray-300 capitalize'>
                          {formatDisplayValue(selectedValue)}
                        </span>
                        <button
                          onClick={() => setSelectedValue(null)}
                          className='text-[12px] text-ios-blue font-medium'>
                          Close
                        </button>
                      </div>
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
                                    ? "bg-ios-blue text-white"
                                    : day.isToday
                                      ? "bg-ios-blue/10 text-ios-blue"
                                      : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400",
                                )}>
                                <div className='text-[10px] uppercase font-medium'>
                                  {day.dayName}
                                </div>
                                <div
                                  className={cn(
                                    "text-lg font-bold",
                                    day.isMarked && "text-white",
                                  )}>
                                  {day.dayNum}
                                </div>
                                <div className='text-[9px] opacity-70'>
                                  {day.month}
                                </div>
                                {day.isMarked && (
                                  <div className='text-[10px]'>✓</div>
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
                                      ? "bg-ios-blue text-white font-bold"
                                      : day.isToday
                                        ? "bg-ios-blue/10 text-ios-blue font-medium"
                                        : "text-gray-600 dark:text-gray-400",
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
                                    const firstDay = new Date(
                                      month.year,
                                      idx,
                                      1,
                                    );
                                    const startDay =
                                      (firstDay.getDay() + 6) % 7;
                                    const emptyCells = [];
                                    for (let i = 0; i < startDay; i++) {
                                      emptyCells.push(
                                        <div
                                          key={`empty-${i}`}
                                          className='w-4 h-4'
                                        />,
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
                                            ? "bg-ios-blue text-white font-bold"
                                            : day.isToday
                                              ? "bg-ios-blue/30 text-ios-blue font-medium"
                                              : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400",
                                      )}
                                      title={`${day.dayNum}. ${month.name}${day.isMarked ? " ✓" : ""}`}>
                                      {day.dayNum}
                                    </div>
                                  ))}
                                </div>
                                <div className='mt-1 text-[10px] text-gray-500 dark:text-gray-400'>
                                  {month.days.filter((d) => d.isMarked).length >
                                    0 && (
                                    <span className='font-medium text-ios-blue'>
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
                        </div>
                      )}
                      <div className='mt-3 pt-2 border-t border-gray-200/80 dark:border-gray-700/80 text-center text-[13px] text-gray-500'>
                        {datesForSelectedValue.size} days watched
                      </div>
                    </div>
                  )}
              </div>
            )}

            {/* Top Movies Grid */}
            {isMovieType && topMovies.length > 0 && (
              <div className='p-4 border-b border-gray-200/80 dark:border-gray-700/80'>
                <div className='flex items-center gap-1 mb-3 bg-gray-100 dark:bg-gray-700/80 rounded-full p-0.5'>
                  {(
                    [
                      { value: "newest", label: "Newest" },
                      { value: "myRating", label: "My Top" },
                      { value: "imdbRating", label: "IMDb Top" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setMovieSortMode(opt.value);
                        localStorage.setItem(
                          "stats-movie-sort-mode",
                          opt.value,
                        );
                        setSelectedValue(null);
                      }}
                      className={cn(
                        "flex-1 text-[13px] font-medium py-1.5 rounded-full transition-all text-center",
                        movieSortMode === opt.value
                          ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                          : "text-gray-500 dark:text-gray-400",
                      )}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className='grid grid-cols-3 gap-3'>
                  {topMovies.map((movie) => {
                    const movieKey = movie.name.toLowerCase();
                    const isSelected = selectedValue === movieKey;
                    return (
                      <div key={movie.name} className='relative'>
                        <button
                          onClick={() => {
                            setSelectedValue(isSelected ? null : movieKey);
                            setShowAllDates(false);
                          }}
                          className={cn(
                            "aspect-[2/3] rounded-xl overflow-hidden bg-gray-200 dark:bg-gray-700 w-full transition-all",
                            isSelected &&
                              "ring-2 ring-ios-blue ring-offset-2 dark:ring-offset-gray-900",
                          )}>
                          {movie.poster ? (
                            <img
                              src={movie.poster}
                              alt={movie.name}
                              className='w-full h-full object-cover'
                            />
                          ) : (
                            <div className='w-full h-full flex items-center justify-center text-[11px] text-gray-500 dark:text-gray-400 px-1 text-center'>
                              {movie.name}
                            </div>
                          )}
                        </button>
                        {/* Rating badge */}
                        {movieSortMode === "myRating" &&
                          movie.userRating > 0 && (
                            <div className='absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1 flex items-center justify-center rounded-full bg-ios-blue text-white text-[11px] font-bold shadow-sm'>
                              {movie.userRating}
                            </div>
                          )}
                        {movieSortMode === "imdbRating" &&
                          movie.imdbRating > 0 && (
                            <div className='absolute -top-1.5 -right-1.5 min-w-[26px] h-[22px] px-1 flex items-center justify-center rounded-full bg-amber-500 text-white text-[11px] font-bold shadow-sm'>
                              {movie.imdbRating}
                            </div>
                          )}
                        {movieSortMode === "newest" && movie.year && (
                          <div className='absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1.5 flex items-center justify-center rounded-full bg-gray-600 text-white text-[10px] font-bold shadow-sm'>
                            {movie.year}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Calendar for selected movie */}
                {selectedValue &&
                  topMovies.some(
                    (m) => m.name.toLowerCase() === selectedValue,
                  ) &&
                  calendarData && (
                    <div
                      className='mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl'
                      onClick={(e) => e.stopPropagation()}>
                      <div className='flex items-center justify-between mb-2'>
                        <span className='text-[13px] font-medium text-gray-700 dark:text-gray-300 capitalize'>
                          {formatDisplayValue(selectedValue)}
                        </span>
                        <button
                          onClick={() => setSelectedValue(null)}
                          className='text-[12px] text-ios-blue font-medium'>
                          Close
                        </button>
                      </div>
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
                                    ? "bg-ios-blue text-white"
                                    : day.isToday
                                      ? "bg-ios-blue/10 text-ios-blue"
                                      : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400",
                                )}>
                                <div className='text-[10px] uppercase font-medium'>
                                  {day.dayName}
                                </div>
                                <div
                                  className={cn(
                                    "text-lg font-bold",
                                    day.isMarked && "text-white",
                                  )}>
                                  {day.dayNum}
                                </div>
                                <div className='text-[9px] opacity-70'>
                                  {day.month}
                                </div>
                                {day.isMarked && (
                                  <div className='text-[10px]'>✓</div>
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
                                      ? "bg-ios-blue text-white font-bold"
                                      : day.isToday
                                        ? "bg-ios-blue/10 text-ios-blue font-medium"
                                        : "text-gray-600 dark:text-gray-400",
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
                                    const firstDay = new Date(
                                      month.year,
                                      idx,
                                      1,
                                    );
                                    const startDay =
                                      (firstDay.getDay() + 6) % 7;
                                    const emptyCells = [];
                                    for (let i = 0; i < startDay; i++) {
                                      emptyCells.push(
                                        <div
                                          key={`empty-${i}`}
                                          className='w-4 h-4'
                                        />,
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
                                            ? "bg-ios-blue text-white font-bold"
                                            : day.isToday
                                              ? "bg-ios-blue/30 text-ios-blue font-medium"
                                              : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400",
                                      )}
                                      title={`${day.dayNum}. ${month.name}${day.isMarked ? " ✓" : ""}`}>
                                      {day.dayNum}
                                    </div>
                                  ))}
                                </div>
                                <div className='mt-1 text-[10px] text-gray-500 dark:text-gray-400'>
                                  {month.days.filter((d) => d.isMarked).length >
                                    0 && (
                                    <span className='font-medium text-ios-blue'>
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
                        </div>
                      )}
                      <div className='mt-3 pt-2 border-t border-gray-200/80 dark:border-gray-700/80 text-center text-[13px] text-gray-500'>
                        {datesForSelectedValue.size} days watched
                      </div>
                    </div>
                  )}
              </div>
            )}

            {/* Value List with Bars - Show for non-workout, non-checklist, non-timer types (including nutrition) */}
            {!isWorkoutType && !isChecklistType && !isTimerType && (
              <div className='p-4'>
                <h4 className='text-[13px] font-normal text-gray-500 dark:text-gray-400 mb-3'>
                  Tap to see dates
                </h4>
                <div className='space-y-3'>
                  {valueCounts
                    .filter(({ value }) => {
                      // Hide series already shown in top grid
                      if (isTvSeriesType && topViewedSeries.length > 0) {
                        const shownNames = new Set(
                          topViewedSeries
                            .slice(0, topSeriesCount)
                            .map((s) => s.name.toLowerCase()),
                        );
                        return !shownNames.has(value);
                      }
                      // Hide movies already shown in top grid
                      if (isMovieType && topMovies.length > 0) {
                        const shownNames = new Set(
                          topMovies.map((m) => m.name.toLowerCase()),
                        );
                        return !shownNames.has(value);
                      }
                      return true;
                    })
                    .map(({ value, count }, index) => {
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
                                : "active:bg-gray-100 dark:active:bg-gray-800",
                            )}>
                            <div className='flex items-center justify-between text-[15px]'>
                              <span
                                className={cn(
                                  "capitalize truncate mr-2",
                                  isSelected
                                    ? cn(moodTextColor, "font-medium")
                                    : "text-gray-700 dark:text-gray-300",
                                )}>
                                {formatDisplayValue(value)}
                              </span>
                              <div className='flex items-center gap-2'>
                                <span className='text-[13px] text-gray-600 dark:text-gray-400 font-medium shrink-0 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full'>
                                  {count}
                                </span>
                              </div>
                            </div>
                            <div className='h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden'>
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all",
                                  moodBarColor,
                                )}
                                style={{
                                  width: `${(count / maxCount) * 100}%`,
                                }}
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
                                                ? getMoodColorClasses(
                                                    value,
                                                    false,
                                                  )
                                                : "bg-ios-blue/10 text-ios-blue"
                                              : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400",
                                        )}>
                                        <div className='text-[10px] uppercase font-medium'>
                                          {day.dayName}
                                        </div>
                                        <div
                                          className={cn(
                                            "text-lg font-bold",
                                            day.isMarked && "text-white",
                                          )}>
                                          {day.dayNum}
                                        </div>
                                        <div className='text-[9px] opacity-70'>
                                          {day.month}
                                        </div>
                                        {day.isMarked && (
                                          <div className='text-[10px]'>
                                            {isMoodType
                                              ? getMoodEmoji(value)
                                              : "✓"}
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
                                                ? getMoodColorClasses(
                                                    value,
                                                    true,
                                                  ) + " font-bold"
                                                : "bg-ios-blue text-white font-bold"
                                              : day.isToday
                                                ? isMoodType
                                                  ? getMoodColorClasses(
                                                      value,
                                                      false,
                                                    ) + " font-medium"
                                                  : "bg-ios-blue/10 text-ios-blue font-medium"
                                                : "text-gray-600 dark:text-gray-400",
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
                                              1,
                                            );
                                            const startDay =
                                              (firstDay.getDay() + 6) % 7; // Monday = 0
                                            const emptyCells = [];
                                            for (let i = 0; i < startDay; i++) {
                                              emptyCells.push(
                                                <div
                                                  key={`empty-${i}`}
                                                  className='w-4 h-4'
                                                />,
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
                                                          true,
                                                        ) + " font-bold"
                                                      : "bg-ios-blue text-white font-bold"
                                                    : day.isToday
                                                      ? isMoodType
                                                        ? getMoodColorClasses(
                                                            value,
                                                            false,
                                                          ) + " font-medium"
                                                        : "bg-ios-blue/30 text-ios-blue font-medium"
                                                      : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400",
                                              )}
                                              title={`${day.dayNum}. ${
                                                month.name
                                              }${
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
                                                  : "text-ios-blue",
                                              )}>
                                              {
                                                month.days.filter(
                                                  (d) => d.isMarked,
                                                ).length
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
                                {datesForSelectedValue.size} days with this
                                value
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className='text-center py-12'>
            <p className='text-[17px] text-gray-500 dark:text-gray-400'>
              Select an activity to see statistics
            </p>
          </div>
        )}
      </main>

      {/* Info Popup */}
      <IOSModal
        isOpen={showInfoPopup}
        onClose={() => setShowInfoPopup(false)}
        title='Statistics'
        size='small'>
        <div className='bg-white/80 dark:bg-ios-card-dark rounded-xl overflow-hidden -mx-1'>
          {/* Time Range */}
          <div className='flex items-center gap-3 px-4 py-3 border-b border-gray-200/80 dark:border-gray-700/80'>
            <div className='w-8 h-8 flex items-center justify-center shrink-0'>
              <svg
                className='w-6 h-6 text-blue-400'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
                strokeWidth={2}>
                <rect x='3' y='4' width='18' height='18' rx='2' ry='2' />
                <line x1='16' y1='2' x2='16' y2='6' />
                <line x1='8' y1='2' x2='8' y2='6' />
                <line x1='3' y1='10' x2='21' y2='10' />
              </svg>
            </div>
            <div className='flex-1 min-w-0'>
              <p className='text-[15px] font-medium text-gray-900 dark:text-white'>
                Time Range
              </p>
              <p className='text-[13px] text-gray-500 dark:text-gray-400'>
                Week, Month or Year. Navigate with arrows.
              </p>
            </div>
          </div>
          {/* Activity Filter */}
          <div className='flex items-center gap-3 px-4 py-3 border-b border-gray-200/80 dark:border-gray-700/80'>
            <div className='w-8 h-8 flex items-center justify-center shrink-0'>
              <svg
                className='w-6 h-6 text-purple-400'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
                strokeWidth={2}>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z'
                />
              </svg>
            </div>
            <div className='flex-1 min-w-0'>
              <p className='text-[15px] font-medium text-gray-900 dark:text-white'>
                Activity Filter
              </p>
              <p className='text-[13px] text-gray-500 dark:text-gray-400'>
                Tap an activity to see its detailed stats.
              </p>
            </div>
          </div>
          {/* Frequency Bars */}
          <div className='flex items-center gap-3 px-4 py-3 border-b border-gray-200/80 dark:border-gray-700/80'>
            <div className='w-8 h-8 flex items-center justify-center shrink-0'>
              <svg
                className='w-6 h-6 text-orange-400'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
                strokeWidth={2}>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z'
                />
              </svg>
            </div>
            <div className='flex-1 min-w-0'>
              <p className='text-[15px] font-medium text-gray-900 dark:text-white'>
                Frequency Bars
              </p>
              <p className='text-[13px] text-gray-500 dark:text-gray-400'>
                Most logged values — shows, meals, etc.
              </p>
            </div>
          </div>
          {/* Calendar */}
          <div className='flex items-center gap-3 px-4 py-3 border-b border-gray-200/80 dark:border-gray-700/80'>
            <div className='w-8 h-8 flex items-center justify-center shrink-0'>
              <svg
                className='w-6 h-6 text-green-500'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
                strokeWidth={2}>
                <rect x='3' y='4' width='18' height='18' rx='2' ry='2' />
                <path d='M3 10h18M8 2v4M16 2v4M7 14h.01M12 14h.01M17 14h.01M7 18h.01M12 18h.01' />
              </svg>
            </div>
            <div className='flex-1 min-w-0'>
              <p className='text-[15px] font-medium text-gray-900 dark:text-white'>
                Calendar
              </p>
              <p className='text-[13px] text-gray-500 dark:text-gray-400'>
                Color-coded days showing when you logged.
              </p>
            </div>
          </div>
          {/* Workouts & Nutrition */}
          <div className='flex items-center gap-3 px-4 py-3'>
            <div className='w-8 h-8 flex items-center justify-center shrink-0'>
              <svg
                className='w-6 h-6 text-red-400'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
                strokeWidth={2}>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='M13 10V3L4 14h7v7l9-11h-7z'
                />
              </svg>
            </div>
            <div className='flex-1 min-w-0'>
              <p className='text-[15px] font-medium text-gray-900 dark:text-white'>
                Workouts & Nutrition
              </p>
              <p className='text-[13px] text-gray-500 dark:text-gray-400'>
                Exercise frequency, averages and goals.
              </p>
            </div>
          </div>
        </div>
      </IOSModal>
    </div>
  );
}

function formatDisplayValue(value: string): string {
  if (value === "true") return "Yes";
  if (value === "false") return "No";
  if (value === "skipped") return "No";
  return value;
}
