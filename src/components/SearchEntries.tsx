"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useApp } from "@/context/AppContext";
import { LogEntry, ActivityType } from "@/types";
import { Icon, icons, IconName } from "./Icons";
import { cn } from "@/lib/utils";

interface SearchEntriesProps {
  onSelectDate: (date: string) => void;
}

export function SearchEntries({ onSelectDate }: SearchEntriesProps) {
  const { entries, activityTypes } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    (LogEntry & { activityType?: ActivityType })[]
  >([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const searchEntries = useCallback(
    (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults([]);
        return;
      }

      const lowerQuery = searchQuery.toLowerCase();
      const filtered = entries
        .filter((entry) => {
          // Search in entry value (for text entries)
          if (
            typeof entry.value === "string" &&
            entry.value.toLowerCase().includes(lowerQuery)
          ) {
            return true;
          }
          // Search in activity type name
          const activityType = activityTypes.find(
            (t) => t.id === entry.activityTypeId
          );
          if (activityType?.name.toLowerCase().includes(lowerQuery)) {
            return true;
          }
          // Search in date
          if (entry.date.includes(lowerQuery)) {
            return true;
          }
          return false;
        })
        .map((entry) => ({
          ...entry,
          activityType: activityTypes.find(
            (t) => t.id === entry.activityTypeId
          ),
        }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 20);

      setResults(filtered);
    },
    [entries, activityTypes]
  );

  useEffect(() => {
    searchEntries(query);
  }, [query, searchEntries]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + "T12:00:00");
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const diffDays = Math.floor(
      (today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
    });
  };

  const formatValue = (entry: LogEntry & { activityType?: ActivityType }) => {
    const type = entry.activityType;
    if (!type) return String(entry.value);

    if (type.valueType === "checkmark") {
      return entry.value === true ? "✓" : entry.value === "skipped" ? "✗" : "";
    }
    if (type.valueType === "mood") {
      if (entry.value === "happy") return "☺";
      if (entry.value === "neutral") return "—";
      if (entry.value === "sad") return "☹";
    }
    if (type.valueType === "boolean") {
      return entry.value === true ? "Yes" : "No";
    }
    return String(entry.value);
  };

  const handleSelect = (entry: LogEntry) => {
    onSelectDate(entry.date);
    setIsOpen(false);
    setQuery("");
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className='p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors'>
        <svg
          className='w-5 h-5'
          fill='none'
          viewBox='0 0 24 24'
          stroke='currentColor'
          strokeWidth={2}>
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
          />
        </svg>
      </button>
    );
  }

  return (
    <div
      className='fixed inset-0 z-50 bg-black/50'
      onClick={() => setIsOpen(false)}>
      <div
        className='bg-white dark:bg-gray-900 w-full max-h-[80vh] overflow-hidden flex flex-col'
        onClick={(e) => e.stopPropagation()}>
        {/* Search Input */}
        <div className='p-4 border-b border-gray-200 dark:border-gray-700'>
          <div className='flex items-center gap-3'>
            <svg
              className='w-5 h-5 text-gray-400 shrink-0'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
              strokeWidth={2}>
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
              />
            </svg>
            <input
              ref={inputRef}
              type='text'
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='Search activities, movies, meals...'
              className='flex-1 text-[17px] bg-transparent text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none'
              autoComplete='off'
            />
            <button
              onClick={() => setIsOpen(false)}
              className='text-ios-blue text-[17px] font-medium'>
              Cancel
            </button>
          </div>
        </div>

        {/* Results */}
        <div className='flex-1 overflow-y-auto'>
          {query.trim() && results.length === 0 && (
            <div className='p-8 text-center text-gray-500'>
              No results found for &quot;{query}&quot;
            </div>
          )}
          {results.map((entry) => (
            <button
              key={entry.id}
              onClick={() => handleSelect(entry)}
              className='w-full px-4 py-3 flex items-center gap-3 text-left border-b border-gray-100 dark:border-gray-800 active:bg-gray-50 dark:active:bg-gray-800'>
              {/* Icon */}
              {entry.activityType?.icon && (
                <div className='w-10 h-10 rounded-lg bg-ios-blue/10 flex items-center justify-center shrink-0'>
                  {entry.activityType.icon in icons ? (
                    <Icon
                      name={entry.activityType.icon as IconName}
                      className='w-5 h-5 text-ios-blue'
                    />
                  ) : (
                    <span className='text-lg'>{entry.activityType.icon}</span>
                  )}
                </div>
              )}
              {/* Content */}
              <div className='flex-1 min-w-0'>
                <div className='flex items-center gap-2'>
                  <span className='font-medium text-gray-900 dark:text-white'>
                    {entry.activityType?.name || "Unknown"}
                  </span>
                  <span className='text-sm text-gray-400'>
                    {formatDate(entry.date)}
                  </span>
                </div>
                {entry.activityType?.valueType === "text" &&
                  typeof entry.value === "string" && (
                    <p className='text-sm text-gray-500 dark:text-gray-400 truncate'>
                      {entry.value}
                    </p>
                  )}
                {entry.activityType?.valueType !== "text" && (
                  <p className='text-sm text-gray-500 dark:text-gray-400'>
                    {formatValue(entry)}
                  </p>
                )}
              </div>
              {/* Poster for media */}
              {entry.poster && (
                <img
                  src={entry.poster}
                  alt=''
                  className='w-10 h-14 object-cover rounded shrink-0'
                />
              )}
              {/* Arrow */}
              <svg
                className='w-4 h-4 text-gray-300 shrink-0'
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
          ))}
          {!query.trim() && (
            <div className='p-8 text-center text-gray-400'>
              <p className='text-sm'>Search your entries</p>
              <p className='text-xs mt-1'>
                Find movies, meals, workouts, and more
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
