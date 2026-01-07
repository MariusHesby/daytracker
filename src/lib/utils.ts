// Utility functions

import { LogEntry, StatisticsSummary, TimeRange, ActivityType } from '@/types';

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

export function getDateRange(range: TimeRange): { start: string; end: string } {
  const end = new Date();
  const start = new Date();

  switch (range) {
    case 'week':
      start.setDate(end.getDate() - 7);
      break;
    case 'month':
      start.setMonth(end.getMonth() - 1);
      break;
    case 'year':
      start.setFullYear(end.getFullYear() - 1);
      break;
    case 'all':
      start.setFullYear(2000); // Far enough back
      break;
  }

  return {
    start: formatDate(start),
    end: formatDate(end),
  };
}

// Get consecutive dates
export function getDatesBetween(start: string, end: string): string[] {
  const dates: string[] = [];
  const current = new Date(start + 'T00:00:00');
  const endDate = new Date(end + 'T00:00:00');

  while (current <= endDate) {
    dates.push(formatDate(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
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
    } else if (activityType?.valueType === 'number') {
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
