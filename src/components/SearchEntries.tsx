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
            (t) => t.id === entry.activityTypeId,
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
            (t) => t.id === entry.activityTypeId,
          ),
        }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 20);

      setResults(filtered);
    },
    [entries, activityTypes],
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
      (today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
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
        className='w-9 h-9 text-gray-500 dark:text-gray-400 flex items-center justify-center active:opacity-60 transition-opacity'>
        <svg
          className='w-[18px] h-[18px]'
          fill='none'
          viewBox='0 0 24 24'
          stroke='currentColor'
          strokeWidth={2.5}>
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
      className='fixed inset-0 z-50 bg-black/40 backdrop-blur-sm'
      onClick={() => setIsOpen(false)}>
      <div
        className='bg-gray-100/95 dark:bg-gray-900/95 backdrop-blur-xl w-full max-h-[85vh] overflow-hidden flex flex-col rounded-b-3xl shadow-2xl'
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        onClick={(e) => e.stopPropagation()}>
        {/* Search Input */}
        <div className='pt-6 pb-3 px-4'>
          <div className='flex items-center gap-3'>
            <div className='flex-1 flex items-center gap-2.5 pl-4 pr-3 py-2.5 bg-white/80 dark:bg-gray-800/80 rounded-xl border border-gray-200/50 dark:border-gray-700/50'>
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
                className='flex-1 text-[17px] bg-transparent text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none pl-1'
                autoComplete='off'
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className='w-5 h-5 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center'>
                  <svg
                    className='w-3 h-3 text-white'
                    fill='none'
                    viewBox='0 0 24 24'
                    stroke='currentColor'
                    strokeWidth={3}>
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      d='M6 18L18 6M6 6l12 12'
                    />
                  </svg>
                </button>
              )}
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className='text-ios-blue text-[17px] font-medium shrink-0'>
              Cancel
            </button>
          </div>
        </div>

        {/* Results */}
        <div className='flex-1 overflow-y-auto px-4 pb-4'>
          {query.trim() && results.length === 0 && (
            <div className='py-12 text-center'>
              <div className='w-16 h-16 mx-auto mb-4 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center'>
                <svg
                  className='w-8 h-8 text-gray-400'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'
                  strokeWidth={1.5}>
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
                  />
                </svg>
              </div>
              <p className='text-gray-500 dark:text-gray-400'>
                No results for &quot;{query}&quot;
              </p>
            </div>
          )}
          {results.length > 0 && (
            <div className='bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm'>
              {results.map((entry, index) => (
                <button
                  key={entry.id}
                  onClick={() => handleSelect(entry)}
                  className={cn(
                    "w-full px-4 py-3 flex items-center gap-3 text-left active:bg-gray-50 dark:active:bg-gray-700/50 transition-colors",
                    index !== results.length - 1 &&
                      "border-b border-gray-100 dark:border-gray-700/50",
                  )}>
                  {/* Icon */}
                  {entry.activityType?.icon && (
                    <div className='w-10 h-10 rounded-xl bg-ios-blue/10 flex items-center justify-center shrink-0'>
                      {entry.activityType.icon in icons ? (
                        <Icon
                          name={entry.activityType.icon as IconName}
                          className='w-5 h-5 text-ios-blue'
                        />
                      ) : (
                        <span className='text-lg'>
                          {entry.activityType.icon}
                        </span>
                      )}
                    </div>
                  )}
                  {/* Content */}
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center gap-2'>
                      <span className='font-medium text-[15px] text-gray-900 dark:text-white'>
                        {entry.activityType?.name || "Unknown"}
                      </span>
                      <span className='text-[13px] text-gray-400'>
                        {formatDate(entry.date)}
                      </span>
                    </div>
                    {entry.activityType?.valueType === "text" &&
                      typeof entry.value === "string" && (
                        <p className='text-[13px] text-gray-500 dark:text-gray-400 truncate'>
                          {entry.value}
                        </p>
                      )}
                    {entry.activityType?.valueType !== "text" && (
                      <p className='text-[13px] text-gray-500 dark:text-gray-400'>
                        {formatValue(entry)}
                      </p>
                    )}
                  </div>
                  {/* Poster for media */}
                  {entry.poster && (
                    <img
                      src={entry.poster}
                      alt=''
                      className='w-10 h-14 object-cover rounded-lg shrink-0'
                    />
                  )}
                  {/* Arrow */}
                  <svg
                    className='w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0'
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
            </div>
          )}
          {!query.trim() && (
            <div className='py-16 text-center'>
              <div className='w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-ios-blue/20 to-ios-blue/5 flex items-center justify-center'>
                <svg
                  className='w-10 h-10 text-ios-blue'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'
                  strokeWidth={1.5}>
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
                  />
                </svg>
              </div>
              <p className='text-[17px] font-medium text-gray-900 dark:text-white mb-1'>
                Search your entries
              </p>
              <p className='text-[15px] text-gray-500 dark:text-gray-400'>
                Find movies, meals, workouts, and more
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
