// Screen Time feature – separate from the Timer activity type
// Stores config in localStorage, syncs to Supabase settings

import { supabase } from './supabase';

const CONFIG_KEY = 'screentime_config';
const DATA_KEY_PREFIX = 'screentime_data_'; // + YYYY-MM-DD

export type ScreenTimePeriod = 'daily' | 'weekly' | 'monthly';

export interface ScreenTimeSubject {
  id: string;
  name: string;
  limitMinutes: number; // e.g. 840 = 14h
}

export interface ScreenTimeConfig {
  enabled: boolean;
  subjects: ScreenTimeSubject[];
  limitPeriod: ScreenTimePeriod;
  intervalMinutes: number; // +/- step size (default 15)
}

export interface ScreenTimeDayEntry {
  subjectId: string;
  minutes: number;
}

export interface ScreenTimeDayData {
  date: string; // YYYY-MM-DD
  entries: ScreenTimeDayEntry[];
}

const defaultConfig: ScreenTimeConfig = {
  enabled: false,
  subjects: [],
  limitPeriod: 'weekly',
  intervalMinutes: 15,
};

// ─── Config management ───────────────────────────────────

export function getScreenTimeConfig(): ScreenTimeConfig {
  if (typeof window === 'undefined') return defaultConfig;
  const stored = localStorage.getItem(CONFIG_KEY);
  if (!stored) return defaultConfig;
  try {
    return { ...defaultConfig, ...JSON.parse(stored) };
  } catch {
    return defaultConfig;
  }
}

export function setScreenTimeConfig(config: ScreenTimeConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  syncScreenTimeConfigToSupabase();
  window.dispatchEvent(new Event('screenTimeConfigUpdated'));
}

export function isScreenTimeEnabled(): boolean {
  return getScreenTimeConfig().enabled;
}

// ─── Day data management ─────────────────────────────────

function dataKey(date: string): string {
  return DATA_KEY_PREFIX + date;
}

export function getScreenTimeDayData(date: string): ScreenTimeDayData {
  if (typeof window === 'undefined') return { date, entries: [] };
  const stored = localStorage.getItem(dataKey(date));
  if (!stored) return { date, entries: [] };
  try {
    return JSON.parse(stored);
  } catch {
    return { date, entries: [] };
  }
}

export function setScreenTimeDayData(data: ScreenTimeDayData): void {
  localStorage.setItem(dataKey(data.date), JSON.stringify(data));
  syncScreenTimeDataToSupabase();
}

export function getMinutesForSubject(date: string, subjectId: string): number {
  const data = getScreenTimeDayData(date);
  const entry = data.entries.find(e => e.subjectId === subjectId);
  return entry?.minutes || 0;
}

export function setMinutesForSubject(date: string, subjectId: string, minutes: number): void {
  const data = getScreenTimeDayData(date);
  const existing = data.entries.find(e => e.subjectId === subjectId);
  if (existing) {
    existing.minutes = Math.max(0, minutes);
  } else {
    data.entries.push({ subjectId, minutes: Math.max(0, minutes) });
  }
  setScreenTimeDayData(data);
}

// ─── Period calculations ─────────────────────────────────

function getMonday(d: Date): Date {
  const clone = new Date(d);
  const day = clone.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  clone.setDate(clone.getDate() + diff);
  return clone;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getPeriodDates(date: string, period: ScreenTimePeriod): string[] {
  const d = new Date(date + 'T12:00:00');
  const dates: string[] = [];

  if (period === 'daily') {
    dates.push(date);
  } else if (period === 'weekly') {
    const monday = getMonday(d);
    for (let i = 0; i < 7; i++) {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      dates.push(toDateStr(day));
    }
  } else {
    // monthly
    const year = d.getFullYear();
    const month = d.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let i = 1; i <= daysInMonth; i++) {
      dates.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`);
    }
  }

  return dates;
}

export function getPeriodTotalMinutes(date: string, subjectId: string, period: ScreenTimePeriod): number {
  const dates = getPeriodDates(date, period);
  let total = 0;
  for (const d of dates) {
    total += getMinutesForSubject(d, subjectId);
  }
  return total;
}

export function getSubjectStatus(
  date: string,
  subjectId: string,
  limitMinutes: number,
  period: ScreenTimePeriod,
): { color: 'green' | 'yellow' | 'red'; usedMinutes: number; expectedMinutes: number; dayNumber: number; totalDays: number } {
  const d = new Date(date + 'T12:00:00');
  let dayNumber: number;
  let totalDays: number;

  if (period === 'daily') {
    dayNumber = 1;
    totalDays = 1;
  } else if (period === 'weekly') {
    const dow = d.getDay();
    dayNumber = dow === 0 ? 7 : dow;
    totalDays = 7;
  } else {
    dayNumber = d.getDate();
    totalDays = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  }

  const usedMinutes = getPeriodTotalMinutes(date, subjectId, period);
  const expectedMinutes = (limitMinutes / totalDays) * dayNumber;

  let color: 'green' | 'yellow' | 'red';
  if (limitMinutes <= 0) {
    color = 'green';
  } else if (usedMinutes > expectedMinutes * 1.1) {
    color = 'red';
  } else if (usedMinutes >= expectedMinutes * 0.9) {
    color = 'yellow';
  } else {
    color = 'green';
  }

  return { color, usedMinutes, expectedMinutes, dayNumber, totalDays };
}

// ─── Supabase sync ───────────────────────────────────────

let syncConfigTimer: ReturnType<typeof setTimeout> | null = null;
let syncDataTimer: ReturnType<typeof setTimeout> | null = null;

async function doSyncConfigToSupabase(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const config = getScreenTimeConfig();
    const { data: existing } = await supabase
      .from('profiles')
      .select('settings')
      .eq('id', user.id)
      .single();

    const currentSettings = existing?.settings || {};
    const { error } = await supabase
      .from('profiles')
      .update({ settings: { ...currentSettings, screentime_config: config } })
      .eq('id', user.id);

    if (error) console.error('Failed to sync screen time config:', error);
  } catch (err) {
    console.error('Failed to sync screen time config:', err);
  }
}

async function doSyncDataToSupabase(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Collect all screentime data from localStorage
    const allData: Record<string, ScreenTimeDayData> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(DATA_KEY_PREFIX)) {
        try {
          allData[key.slice(DATA_KEY_PREFIX.length)] = JSON.parse(localStorage.getItem(key)!);
        } catch { /* skip corrupt entries */ }
      }
    }

    const { data: existing } = await supabase
      .from('profiles')
      .select('settings')
      .eq('id', user.id)
      .single();

    const currentSettings = existing?.settings || {};
    const { error } = await supabase
      .from('profiles')
      .update({ settings: { ...currentSettings, screentime_data: allData } })
      .eq('id', user.id);

    if (error) console.error('Failed to sync screen time data:', error);
  } catch (err) {
    console.error('Failed to sync screen time data:', err);
  }
}

function syncScreenTimeConfigToSupabase(): void {
  if (syncConfigTimer) clearTimeout(syncConfigTimer);
  syncConfigTimer = setTimeout(doSyncConfigToSupabase, 1000);
}

function syncScreenTimeDataToSupabase(): void {
  if (syncDataTimer) clearTimeout(syncDataTimer);
  syncDataTimer = setTimeout(doSyncDataToSupabase, 1000);
}

export async function loadScreenTimeFromSupabase(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('profiles')
      .select('settings')
      .eq('id', user.id)
      .single();

    if (data?.settings?.screentime_config) {
      // Always use cloud config as source of truth
      localStorage.setItem(CONFIG_KEY, JSON.stringify(data.settings.screentime_config));
    }

    if (data?.settings?.screentime_data) {
      for (const [date, dayData] of Object.entries(data.settings.screentime_data)) {
        // Always use cloud data as source of truth
        localStorage.setItem(dataKey(date), JSON.stringify(dayData));
      }
    }
  } catch (err) {
    console.error('Failed to load screen time from Supabase:', err);
  }
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

export function getDayLabel(date: string, period: ScreenTimePeriod): string {
  const d = new Date(date + 'T12:00:00');
  if (period === 'daily') return 'Today';
  if (period === 'weekly') {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[d.getDay()];
  }
  return String(d.getDate());
}
