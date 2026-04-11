// Utility functions

import { LogEntry, StatisticsSummary, TimeRange, ActivityType } from '@/types';

// UUID validation
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

// Sort activity types by order then creation date
export function sortActivityTypes(types: ActivityType[]): ActivityType[] {
  return [...types].sort((a, b) => {
    const orderA = a.order ?? Infinity;
    const orderB = b.order ?? Infinity;
    if (orderA !== orderB) return orderA - orderB;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

// Safe JSON parse from localStorage with fallback
export function safeParseJSON<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

// Normalize a URL for comparison (trim, lowercase, strip trailing slash)
export function normalizeUrl(url: string): string {
  return url.trim().toLowerCase().replace(/\/$/, '');
}

// Date formatting
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date + 'T12:00:00') : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDisplayDate(date: string): string {
  const d = new Date(date + 'T00:00:00');
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function isToday(date: string): boolean {
  return date === formatDate(new Date());
}

// Statistics calculations
export function calculateStatistics(
  entries: LogEntry[],
  activityTypes: ActivityType[]
): StatisticsSummary[] {
  const groupedByActivity = entries.reduce((acc, entry) => {
    if (!acc[entry.activityTypeId]) {
      acc[entry.activityTypeId] = [];
    }
    acc[entry.activityTypeId].push(entry);
    return acc;
  }, {} as Record<string, LogEntry[]>);

  return Object.entries(groupedByActivity).map(([activityTypeId, activityEntries]) => {
    const activityType = activityTypes.find(t => t.id === activityTypeId);
    const uniqueDays = new Set(activityEntries.map(e => e.date)).size;

    // Calculate most common value for text types
    let mostCommonValue: string | number | undefined;
    let averageValue: number | undefined;

    if (activityType?.valueType === 'text') {
      const valueCounts = activityEntries.reduce((acc, e) => {
        const val = String(e.value);
        acc[val] = (acc[val] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const sorted = Object.entries(valueCounts).sort((a, b) => b[1] - a[1]);
      mostCommonValue = sorted[0]?.[0];
    } else if (activityType?.valueType === 'counter') {
      const numericValues = activityEntries
        .map(e => Number(e.value))
        .filter(v => !isNaN(v));

      if (numericValues.length > 0) {
        averageValue = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
      }
    }

    return {
      activityTypeId,
      activityTypeName: activityType?.name || 'Unknown',
      totalEntries: activityEntries.length,
      uniqueDays,
      mostCommonValue,
      averageValue,
      entries: activityEntries,
    };
  });
}

// Navigation helpers
export function addDays(date: string, days: number): string {
  const d = new Date(date + 'T12:00:00'); // Use noon to avoid timezone issues
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Classname helper
export function cn(...classes: (string | boolean | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

// Date helpers for stats/calendar views

/** Get Monday of a given week */
export function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Monday
  date.setDate(diff);
  date.setHours(12, 0, 0, 0);
  return date;
}

/** Format a Date object as YYYY-MM-DD string */
export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Get ISO week number for a date */
export function getWeekNumber(d: Date): number {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
    )
  );
}

/** Get date range for a specific offset (0 = current, -1 = previous, etc.) */
export function getDateRangeWithOffset(
  range: TimeRange,
  offset: number
): { start: string; end: string; label: string } {
  const now = new Date();
  now.setHours(12, 0, 0, 0);

  if (range === 'week') {
    const monday = getMonday(now);
    monday.setDate(monday.getDate() + offset * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const weekNum = getWeekNumber(monday);
    const label = `Week ${weekNum}, ${monday.getFullYear()}`;

    return { start: toDateStr(monday), end: toDateStr(sunday), label };
  } else if (range === 'month') {
    const targetDate = new Date(now.getFullYear(), now.getMonth() + offset, 1, 12, 0, 0);
    const monthStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1, 12, 0, 0);
    const monthEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 12, 0, 0);

    const label = monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    return { start: toDateStr(monthStart), end: toDateStr(monthEnd), label };
  } else {
    // Year
    const targetYear = now.getFullYear() + offset;
    const yearStart = new Date(targetYear, 0, 1, 12, 0, 0);
    const yearEnd = new Date(targetYear, 11, 31, 12, 0, 0);

    return { start: toDateStr(yearStart), end: toDateStr(yearEnd), label: String(targetYear) };
  }
}
