// IndexedDB wrapper for offline-first storage

import { ActivityType, LogEntry, Suggestion, DEFAULT_ACTIVITY_TYPES } from '@/types';

const DB_NAME = 'daytracker-db';
const DB_VERSION = 1;

let db: IDBDatabase | null = null;

export async function initDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Activity Types store
      if (!database.objectStoreNames.contains('activityTypes')) {
        const activityStore = database.createObjectStore('activityTypes', { keyPath: 'id' });
        activityStore.createIndex('name', 'name', { unique: true });
      }

      // Log Entries store
      if (!database.objectStoreNames.contains('entries')) {
        const entriesStore = database.createObjectStore('entries', { keyPath: 'id' });
        entriesStore.createIndex('date', 'date', { unique: false });
        entriesStore.createIndex('activityTypeId', 'activityTypeId', { unique: false });
        entriesStore.createIndex('date_activity', ['date', 'activityTypeId'], { unique: false });
      }

      // Suggestions store
      if (!database.objectStoreNames.contains('suggestions')) {
        const suggestionsStore = database.createObjectStore('suggestions', { keyPath: ['activityTypeId', 'value'] });
        suggestionsStore.createIndex('activityTypeId', 'activityTypeId', { unique: false });
      }
    };
  });
}

// Generate unique ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Activity Types CRUD
export async function getActivityTypes(): Promise<ActivityType[]> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('activityTypes', 'readonly');
    const store = transaction.objectStore('activityTypes');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function addActivityType(activityType: Omit<ActivityType, 'id' | 'createdAt'>): Promise<ActivityType> {
  const database = await initDB();
  const newType: ActivityType = {
    ...activityType,
    id: generateId(),
    createdAt: new Date(),
  };

  return new Promise((resolve, reject) => {
    const transaction = database.transaction('activityTypes', 'readwrite');
    const store = transaction.objectStore('activityTypes');
    const request = store.add(newType);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(newType);
  });
}

export async function updateActivityType(activityType: ActivityType): Promise<ActivityType> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('activityTypes', 'readwrite');
    const store = transaction.objectStore('activityTypes');
    const request = store.put(activityType);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(activityType);
  });
}

export async function deleteActivityType(id: string): Promise<void> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('activityTypes', 'readwrite');
    const store = transaction.objectStore('activityTypes');
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function reorderActivityTypes(orderedTypes: ActivityType[]): Promise<void> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('activityTypes', 'readwrite');
    const store = transaction.objectStore('activityTypes');
    
    let completed = 0;
    orderedTypes.forEach((type, index) => {
      const updatedType = { ...type, order: index };
      const request = store.put(updatedType);
      request.onsuccess = () => {
        completed++;
        if (completed === orderedTypes.length) {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  });
}

// Log Entries CRUD
export async function getEntries(startDate?: string, endDate?: string): Promise<LogEntry[]> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('entries', 'readonly');
    const store = transaction.objectStore('entries');
    const index = store.index('date');

    let request: IDBRequest;
    if (startDate && endDate) {
      const range = IDBKeyRange.bound(startDate, endDate);
      request = index.getAll(range);
    } else {
      request = store.getAll();
    }

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function getEntriesByDate(date: string): Promise<LogEntry[]> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('entries', 'readonly');
    const store = transaction.objectStore('entries');
    const index = store.index('date');
    const request = index.getAll(date);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function addEntry(entry: Omit<LogEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<LogEntry> {
  const database = await initDB();
  const now = new Date();
  const newEntry: LogEntry = {
    ...entry,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  };

  return new Promise((resolve, reject) => {
    const transaction = database.transaction('entries', 'readwrite');
    const store = transaction.objectStore('entries');
    const request = store.add(newEntry);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(newEntry);
  });
}

export async function updateEntry(entry: LogEntry): Promise<LogEntry> {
  const database = await initDB();
  const updatedEntry = { ...entry, updatedAt: new Date() };

  return new Promise((resolve, reject) => {
    const transaction = database.transaction('entries', 'readwrite');
    const store = transaction.objectStore('entries');
    const request = store.put(updatedEntry);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(updatedEntry);
  });
}

export async function deleteEntry(id: string): Promise<void> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('entries', 'readwrite');
    const store = transaction.objectStore('entries');
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// Suggestions CRUD
export async function getSuggestions(activityTypeId: string): Promise<Suggestion[]> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('suggestions', 'readonly');
    const store = transaction.objectStore('suggestions');
    const index = store.index('activityTypeId');
    const request = index.getAll(activityTypeId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const suggestions = request.result as Suggestion[];
      // Sort by count descending, then by lastUsed
      suggestions.sort((a, b) => b.count - a.count || new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime());
      resolve(suggestions);
    };
  });
}

export async function addOrUpdateSuggestion(activityTypeId: string, value: string): Promise<void> {
  if (!value || typeof value !== 'string') return;

  const database = await initDB();
  const trimmedValue = value.trim();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction('suggestions', 'readwrite');
    const store = transaction.objectStore('suggestions');
    const request = store.get([activityTypeId, trimmedValue]);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const existing = request.result as Suggestion | undefined;
      const suggestion: Suggestion = existing
        ? { ...existing, count: existing.count + 1, lastUsed: new Date() }
        : { activityTypeId, value: trimmedValue, count: 1, lastUsed: new Date() };

      const putRequest = store.put(suggestion);
      putRequest.onerror = () => reject(putRequest.error);
      putRequest.onsuccess = () => resolve();
    };
  });
}

// Initialize with default activity types if empty
export async function initializeDefaultData(): Promise<void> {
  const existingTypes = await getActivityTypes();
  if (existingTypes.length === 0) {
    for (const type of DEFAULT_ACTIVITY_TYPES) {
      await addActivityType(type);
    }
  }
}
