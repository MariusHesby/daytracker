"use client";

import { useState, useEffect, useCallback } from "react";
import { useApp } from "@/context/AppContext";
import { ActivityType, Suggestion } from "@/types";
import { cn } from "@/lib/utils";
import { Icon, icons, IconName } from "./Icons";
import { MediaSearch } from "./MediaSearch";

interface EntryFormProps {
  date: string;
  onSuccess?: () => void;
}

type SavedValue = {
  value: string | number | boolean;
  id: string;
};

// Confetti particle for celebration
interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  rotation: number;
  velocityX: number;
  velocityY: number;
}

export function EntryForm({ date, onSuccess }: EntryFormProps) {
  const {
    activityTypes,
    addEntry,
    getSuggestions,
    entries,
    loadEntriesForDateRange,
    deleteEntry,
    updateEntry,
    isViewingOther,
    isDayLocked,
    toggleDayLock,
  } = useApp();
  const [expandedTypeId, setExpandedTypeId] = useState<string | null>(null);
  const [savedValues, setSavedValues] = useState<Record<string, SavedValue[]>>(
    {}
  );
  const [suggestions, setSuggestions] = useState<Record<string, Suggestion[]>>(
    {}
  );
  const [customValue, setCustomValue] = useState("");
  const [numberValue, setNumberValue] = useState<string>("");
  const [lastClickTime, setLastClickTime] = useState<Record<string, number>>(
    {}
  );
  const [isLocking, setIsLocking] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);

  const isLocked = isDayLocked(date);

  // Generate confetti particles for celebration
  const createParticles = useCallback(() => {
    const colors = [
      "#34C759",
      "#FFD60A",
      "#FF9500",
      "#FF3B30",
      "#AF52DE",
      "#5856D6",
      "#007AFF",
    ];
    const newParticles: Particle[] = [];
    for (let i = 0; i < 50; i++) {
      newParticles.push({
        id: i,
        x: 50 + (Math.random() - 0.5) * 20,
        y: 50,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4,
        rotation: Math.random() * 360,
        velocityX: (Math.random() - 0.5) * 15,
        velocityY: -Math.random() * 15 - 5,
      });
    }
    setParticles(newParticles);
  }, []);

  // Animate celebration
  useEffect(() => {
    if (!showCelebration) return;

    createParticles();

    const timer = setTimeout(() => {
      setShowCelebration(false);
      setParticles([]);
    }, 2000);

    return () => clearTimeout(timer);
  }, [showCelebration, createParticles]);

  // Handle lock toggle
  const handleLockToggle = async () => {
    if (isViewingOther) return;

    setIsLocking(true);
    const newLockedState = await toggleDayLock(date);
    setIsLocking(false);

    if (newLockedState) {
      setShowCelebration(true);
    }
  };

  useEffect(() => {
    loadEntriesForDateRange(date, date);
    setExpandedTypeId(null);
  }, [date, loadEntriesForDateRange]);

  useEffect(() => {
    const dateEntries = entries.filter((e) => e.date === date);
    const newSavedValues: Record<string, SavedValue[]> = {};
    dateEntries.forEach((entry) => {
      if (!newSavedValues[entry.activityTypeId]) {
        newSavedValues[entry.activityTypeId] = [];
      }
      newSavedValues[entry.activityTypeId].push({
        value: entry.value,
        id: entry.id,
      });
    });
    setSavedValues(newSavedValues);
  }, [entries, date]);

  useEffect(() => {
    async function loadAllSuggestions() {
      const newSuggestions: Record<string, Suggestion[]> = {};
      for (const type of activityTypes) {
        if (type.valueType === "text") {
          const sugg = await getSuggestions(type.id);
          newSuggestions[type.id] = sugg;
        }
      }
      setSuggestions(newSuggestions);
    }
    loadAllSuggestions();
  }, [activityTypes, getSuggestions]);

  const handleSaveValue = async (
    typeId: string,
    value: string | number | boolean,
    metadata?: {
      imdbId?: string;
      poster?: string;
      imdbRating?: string;
      year?: string;
    }
  ) => {
    // Don't allow editing when viewing another user's data
    if (isViewingOther) return;

    const type = activityTypes.find((t) => t.id === typeId);
    if (!type) return;

    try {
      if (
        type?.valueType === "boolean" ||
        type?.valueType === "checkmark" ||
        type?.valueType === "mood"
      ) {
        const existingValues = savedValues[typeId] || [];
        for (const existing of existingValues) {
          await deleteEntry(existing.id);
        }
      }

      // For counter type, delete existing and add new value
      if (type?.valueType === "counter") {
        const existingValues = savedValues[typeId] || [];
        for (const existing of existingValues) {
          await deleteEntry(existing.id);
        }
      }

      // For media types, copy metadata from existing entry if not provided
      const isMedia =
        type.name.toLowerCase().includes("movie") ||
        type.name.toLowerCase().includes("film") ||
        type.name.toLowerCase().includes("tv") ||
        type.name.toLowerCase().includes("series") ||
        type.name.toLowerCase().includes("serie");

      let entryMetadata = metadata;

      if (isMedia && typeof value === "string" && !metadata) {
        // Find existing entry to copy metadata (poster, imdbId, etc.)
        const existingEntry = entries.find(
          (e) =>
            e.activityTypeId === typeId &&
            String(e.value).toLowerCase() === value.toLowerCase()
        );

        if (existingEntry) {
          entryMetadata = {
            imdbId: existingEntry.imdbId,
            poster: existingEntry.poster,
            imdbRating: existingEntry.imdbRating,
            year: existingEntry.year,
          };
        }
      }

      await addEntry({
        date,
        activityTypeId: typeId,
        value,
        ...(entryMetadata && {
          imdbId: entryMetadata.imdbId,
          poster: entryMetadata.poster,
          imdbRating: entryMetadata.imdbRating,
          year: entryMetadata.year,
        }),
      });

      setExpandedTypeId(null);
      setCustomValue("");
      setNumberValue("");

      if (type.valueType === "text") {
        const sugg = await getSuggestions(type.id);
        setSuggestions((prev) => ({ ...prev, [type.id]: sugg }));
      }

      onSuccess?.();
    } catch (error) {
      console.error("Failed to add entry:", error);
    }
  };

  const removeSavedValue = async (typeId: string, entryId: string) => {
    // Don't allow editing when viewing another user's data
    if (isViewingOther) return;

    try {
      await deleteEntry(entryId);
    } catch (error) {
      console.error("Failed to delete entry:", error);
    }
  };

  const formatValue = (
    value: string | number | boolean,
    typeId?: string
  ): string => {
    const type = typeId ? activityTypes.find((t) => t.id === typeId) : null;
    if (type?.valueType === "checkmark" && value === true) return "✓";
    if (type?.valueType === "checkmark" && value === "skipped") return "✗";
    if (type?.valueType === "mood") {
      if (value === "happy") return "☺";
      if (value === "neutral") return "—";
      if (value === "sad") return "☹";
    }
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return String(value);
  };

  const toggleExpanded = (typeId: string) => {
    // Don't allow expanding input form when viewing another user's data
    if (isViewingOther) return;

    if (expandedTypeId === typeId) {
      setExpandedTypeId(null);
      setCustomValue("");
      setNumberValue("");
    } else {
      setExpandedTypeId(typeId);
      setCustomValue("");
      setNumberValue("");
    }
  };

  const isMediaType = (type: ActivityType): "movie" | "series" | null => {
    const name = type.name.toLowerCase();
    if (name.includes("movie") || name.includes("film")) return "movie";
    if (
      name.includes("tv") ||
      name.includes("series") ||
      name.includes("serie")
    )
      return "series";
    return null;
  };

  const handleMediaSelect = async (
    typeId: string,
    title: string,
    imdbId: string,
    year: string,
    poster: string,
    rating?: string
  ) => {
    // TMDb IDs start with "tmdb-", we use rating from the search result instead of fetching OMDB details
    const displayTitle = `${title} (${year})`;
    await handleSaveValue(typeId, displayTitle, {
      imdbId,
      poster: poster !== "N/A" ? poster : undefined,
      imdbRating: rating && rating !== "N/A" ? rating : undefined,
      year,
    });
  };

  const renderExpandedInput = (type: ActivityType) => {
    const mediaType = isMediaType(type);

    if (mediaType && type.valueType === "text") {
      return (
        <div className='pt-3 space-y-3'>
          <MediaSearch
            type={mediaType}
            onSelect={(title, imdbId, year, poster, rating) =>
              handleMediaSelect(type.id, title, imdbId, year, poster, rating)
            }
            placeholder={
              mediaType === "movie"
                ? "Search for movie..."
                : "Search for TV series..."
            }
          />
          {(suggestions[type.id] || []).length > 0 && (
            <div>
              <p className='text-[13px] text-gray-500 mb-2'>
                Previously watched:
              </p>
              <div className='flex flex-wrap gap-2'>
                {(suggestions[type.id] || []).slice(0, 2).map((sugg) => (
                  <button
                    key={sugg.value}
                    onClick={() => handleSaveValue(type.id, sugg.value)}
                    className='px-3 py-1.5 rounded-lg text-[15px] bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 active:bg-gray-200 dark:active:bg-gray-600'>
                    {sugg.value}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    switch (type.valueType) {
      case "text": {
        const typeSuggestions = suggestions[type.id] || [];
        // Filter suggestions based on what the user is typing
        const filteredSuggestions = customValue.trim()
          ? typeSuggestions.filter((sugg) =>
              sugg.value.toLowerCase().includes(customValue.toLowerCase())
            )
          : typeSuggestions;
        // Only show suggestions that aren't exact matches
        const showFilteredSuggestions =
          customValue.trim() &&
          filteredSuggestions.length > 0 &&
          !filteredSuggestions.some(
            (s) => s.value.toLowerCase() === customValue.toLowerCase()
          );

        return (
          <div className='pt-3 space-y-3'>
            {/* Show all suggestions when not typing */}
            {!customValue.trim() && typeSuggestions.length > 0 && (
              <div className='flex flex-wrap gap-2'>
                {typeSuggestions.map((sugg) => (
                  <button
                    key={sugg.value}
                    onClick={() => handleSaveValue(type.id, sugg.value)}
                    className='px-3 py-1.5 rounded-lg text-[15px] bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 active:bg-gray-200 dark:active:bg-gray-600'>
                    {sugg.value}
                  </button>
                ))}
              </div>
            )}
            <div className='relative'>
              <div className='flex gap-2'>
                <input
                  type='text'
                  value={customValue}
                  onChange={(e) => setCustomValue(e.target.value)}
                  placeholder={
                    typeSuggestions.length > 0
                      ? "Or enter new..."
                      : "Enter value..."
                  }
                  className='flex-1 px-3 py-2 rounded-lg text-[17px] bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-ios-blue'
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && customValue.trim()) {
                      handleSaveValue(type.id, customValue.trim());
                    }
                    if (e.key === "Escape") {
                      setExpandedTypeId(null);
                    }
                  }}
                />
                {customValue.trim() && (
                  <button
                    onClick={() => handleSaveValue(type.id, customValue.trim())}
                    className='px-4 py-2 rounded-lg bg-ios-blue text-white text-[17px] font-medium'>
                    Add
                  </button>
                )}
              </div>
              {/* Autocomplete dropdown */}
              {showFilteredSuggestions && (
                <div className='absolute left-0 right-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-50'>
                  {filteredSuggestions.slice(0, 5).map((sugg) => (
                    <button
                      key={sugg.value}
                      onClick={() => handleSaveValue(type.id, sugg.value)}
                      className='w-full px-3 py-2.5 text-left text-[17px] text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 border-b border-gray-100 dark:border-gray-700 last:border-b-0'>
                      {sugg.value}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      }

      case "counter":
        // Counter is handled inline on the row, not in expanded view
        return null;

      case "mood":
        return (
          <div className='pt-3 flex gap-3'>
            <button
              onClick={() => handleSaveValue(type.id, "happy")}
              className={cn(
                "flex-1 py-4 rounded-xl active:scale-95 transition-transform flex items-center justify-center",
                "bg-gray-100 dark:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600",
                savedValues[type.id]?.[0]?.value === "happy" &&
                  "ring-2 ring-ios-green bg-ios-green/10 dark:bg-ios-green/20"
              )}>
              {/* Happy face - smile */}
              <svg
                className='w-8 h-8 text-ios-green'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'>
                <circle cx='12' cy='12' r='10' />
                <path d='M8 14s1.5 2 4 2 4-2 4-2' />
                <line x1='9' y1='9' x2='9.01' y2='9' strokeWidth='3' />
                <line x1='15' y1='9' x2='15.01' y2='9' strokeWidth='3' />
              </svg>
            </button>
            <button
              onClick={() => handleSaveValue(type.id, "neutral")}
              className={cn(
                "flex-1 py-4 rounded-xl active:scale-95 transition-transform flex items-center justify-center",
                "bg-gray-100 dark:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600",
                savedValues[type.id]?.[0]?.value === "neutral" &&
                  "ring-2 ring-ios-orange bg-ios-orange/10 dark:bg-ios-orange/20"
              )}>
              {/* Neutral face - straight line */}
              <svg
                className='w-8 h-8 text-ios-orange'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'>
                <circle cx='12' cy='12' r='10' />
                <line x1='8' y1='15' x2='16' y2='15' />
                <line x1='9' y1='9' x2='9.01' y2='9' strokeWidth='3' />
                <line x1='15' y1='9' x2='15.01' y2='9' strokeWidth='3' />
              </svg>
            </button>
            <button
              onClick={() => handleSaveValue(type.id, "sad")}
              className={cn(
                "flex-1 py-4 rounded-xl active:scale-95 transition-transform flex items-center justify-center",
                "bg-gray-100 dark:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600",
                savedValues[type.id]?.[0]?.value === "sad" &&
                  "ring-2 ring-ios-red bg-ios-red/10 dark:bg-ios-red/20"
              )}>
              {/* Sad face - frown */}
              <svg
                className='w-8 h-8 text-ios-red'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'>
                <circle cx='12' cy='12' r='10' />
                <path d='M16 16s-1.5-2-4-2-4 2-4 2' />
                <line x1='9' y1='9' x2='9.01' y2='9' strokeWidth='3' />
                <line x1='15' y1='9' x2='15.01' y2='9' strokeWidth='3' />
              </svg>
            </button>
          </div>
        );

      case "boolean":
        return (
          <div className='pt-3 flex gap-3'>
            <button
              onClick={() => handleSaveValue(type.id, true)}
              className='flex-1 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-[17px] font-medium text-gray-900 dark:text-white active:bg-gray-200 dark:active:bg-gray-600 flex items-center justify-center gap-2'>
              <svg
                className='w-5 h-5 text-ios-green'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
                strokeWidth={2.5}>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='M5 13l4 4L19 7'
                />
              </svg>
              Yes
            </button>
            <button
              onClick={() => handleSaveValue(type.id, false)}
              className='flex-1 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-[17px] font-medium text-gray-900 dark:text-white active:bg-gray-200 dark:active:bg-gray-600 flex items-center justify-center gap-2'>
              <svg
                className='w-5 h-5 text-ios-red'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
                strokeWidth={2.5}>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='M6 18L18 6M6 6l12 12'
                />
              </svg>
              No
            </button>
          </div>
        );

      case "checkmark":
        return (
          <div className='pt-3'>
            <button
              onClick={() => handleSaveValue(type.id, true)}
              className='w-full py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-[20px] active:bg-gray-200 dark:active:bg-gray-600 flex items-center justify-center gap-2 transition-transform active:scale-95'>
              <span className='text-2xl text-ios-green'>✓</span>
            </button>
          </div>
        );
    }
  };

  return (
    <div className='bg-white/80 dark:bg-ios-card-dark rounded-xl overflow-visible'>
      {activityTypes.map((type, index) => {
        const typeSavedValues = savedValues[type.id] || [];
        const hasSavedValues = typeSavedValues.length > 0;
        const isExpanded = expandedTypeId === type.id;
        const isLast = index === activityTypes.length - 1;
        const isCheckmark = type.valueType === "checkmark";
        const isCounter = type.valueType === "counter";
        const isMood = type.valueType === "mood";

        // Get current counter value
        const currentCounterValue =
          isCounter && hasSavedValues
            ? typeof typeSavedValues[0].value === "number"
              ? typeSavedValues[0].value
              : 0
            : 0;

        const handleCounterChange = (delta: number) => {
          const newValue = Math.max(0, currentCounterValue + delta);
          if (newValue === 0 && hasSavedValues) {
            // Remove entry when counter reaches 0
            deleteEntry(typeSavedValues[0].id);
          } else if (newValue > 0) {
            handleSaveValue(type.id, newValue);
          }
        };

        const handleRowClick = () => {
          if (isCheckmark) {
            const now = Date.now();
            const lastClick = lastClickTime[type.id] || 0;
            const isDoubleClick = now - lastClick < 400; // 400ms for double-click
            setLastClickTime({ ...lastClickTime, [type.id]: now });

            if (isDoubleClick) {
              // Double-click: set to "skipped" (red X)
              if (hasSavedValues) {
                // Delete existing and add skipped
                typeSavedValues.forEach((saved) => {
                  deleteEntry(saved.id);
                });
              }
              handleSaveValue(type.id, "skipped");
            } else {
              // Single click: toggle between checked and unchecked
              if (hasSavedValues) {
                const currentValue = typeSavedValues[0]?.value;
                if (currentValue === "skipped") {
                  // If skipped, remove it
                  typeSavedValues.forEach((saved) => {
                    deleteEntry(saved.id);
                  });
                } else {
                  // If checked, remove the checkmark
                  typeSavedValues.forEach((saved) => {
                    deleteEntry(saved.id);
                  });
                }
              } else {
                // Add the checkmark
                handleSaveValue(type.id, true);
              }
            }
          } else if (isCounter) {
            // For counter, tapping row resets to 0 if not already 0
            if (currentCounterValue > 0 && hasSavedValues) {
              deleteEntry(typeSavedValues[0].id);
            }
            // If already 0, do nothing
          } else {
            toggleExpanded(type.id);
          }
        };

        return (
          <div key={type.id}>
            {/* Activity row */}
            <div
              className={cn(
                "flex items-center min-h-[40px] px-4 active:bg-gray-100 dark:active:bg-gray-700 cursor-pointer",
                isExpanded && "bg-gray-50 dark:bg-gray-800/50",
                isLocked && "pointer-events-none opacity-75"
              )}
              onClick={handleRowClick}>
              {/* Icon */}
              {type.icon && (
                <div
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center mr-3 shrink-0",
                    isLocked
                      ? "bg-ios-green/10"
                      : hasSavedValues
                      ? "bg-ios-green/10"
                      : "bg-ios-blue/10"
                  )}>
                  {type.icon in icons ? (
                    <Icon
                      name={type.icon as IconName}
                      className={cn(
                        "w-5 h-5",
                        isLocked
                          ? "text-ios-green"
                          : hasSavedValues
                          ? "text-ios-green"
                          : "text-ios-blue"
                      )}
                    />
                  ) : (
                    <span className='text-lg'>{type.icon}</span>
                  )}
                </div>
              )}

              {/* Content and right-aligned controls */}
              <div
                className={cn(
                  "flex-1 py-2 flex items-center",
                  !isLast &&
                    !isExpanded &&
                    "border-b border-gray-200/80 dark:border-gray-700/80"
                )}>
                {/* Main label and inline text value */}
                <div className='flex-1 min-w-0 flex items-center gap-2'>
                  <span className='text-[17px] font-medium text-gray-900 dark:text-white shrink-0'>
                    {type.name}
                  </span>
                  {/* Only show inline value for text type */}
                  {hasSavedValues &&
                    !isExpanded &&
                    type.valueType === "text" && (
                      <span className='text-[15px] text-gray-400 dark:text-gray-500 truncate'>
                        {typeSavedValues.map((saved, i) => (
                          <span key={saved.id}>
                            {formatValue(saved.value, type.id)}
                            {i < typeSavedValues.length - 1 && ", "}
                          </span>
                        ))}
                      </span>
                    )}
                </div>

                {/* Right-aligned value type controls (except text) */}
                {(isCheckmark ||
                  isMood ||
                  isCounter ||
                  type.valueType === "boolean") && (
                  <div className='flex items-center gap-2 ml-auto shrink-0'>
                    {/* Checkmark icon */}
                    {isCheckmark && hasSavedValues && (
                      <>
                        {typeSavedValues[0]?.value === "skipped" ? (
                          <svg
                            className='w-5 h-5 text-ios-red shrink-0'
                            fill='none'
                            stroke='currentColor'
                            viewBox='0 0 24 24'
                            strokeWidth={3}>
                            <path
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              d='M6 18L18 6M6 6l12 12'
                            />
                          </svg>
                        ) : (
                          <svg
                            className='w-5 h-5 text-ios-green shrink-0'
                            fill='none'
                            stroke='currentColor'
                            viewBox='0 0 24 24'
                            strokeWidth={3}>
                            <path
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              d='M5 13l4 4L19 7'
                            />
                          </svg>
                        )}
                      </>
                    )}
                    {/* Mood icon display */}
                    {isMood && hasSavedValues && (
                      <span className='shrink-0'>
                        {typeSavedValues[0].value === "happy" && (
                          <svg
                            className='w-5 h-5 text-ios-green'
                            viewBox='0 0 24 24'
                            fill='none'
                            stroke='currentColor'
                            strokeWidth='2'
                            strokeLinecap='round'
                            strokeLinejoin='round'>
                            <circle cx='12' cy='12' r='10' />
                            <path d='M8 14s1.5 2 4 2 4-2 4-2' />
                            <line
                              x1='9'
                              y1='9'
                              x2='9.01'
                              y2='9'
                              strokeWidth='3'
                            />
                            <line
                              x1='15'
                              y1='9'
                              x2='15.01'
                              y2='9'
                              strokeWidth='3'
                            />
                          </svg>
                        )}
                        {typeSavedValues[0].value === "neutral" && (
                          <svg
                            className='w-5 h-5 text-ios-orange'
                            viewBox='0 0 24 24'
                            fill='none'
                            stroke='currentColor'
                            strokeWidth='2'
                            strokeLinecap='round'
                            strokeLinejoin='round'>
                            <circle cx='12' cy='12' r='10' />
                            <line x1='8' y1='15' x2='16' y2='15' />
                            <line
                              x1='9'
                              y1='9'
                              x2='9.01'
                              y2='9'
                              strokeWidth='3'
                            />
                            <line
                              x1='15'
                              y1='9'
                              x2='15.01'
                              y2='9'
                              strokeWidth='3'
                            />
                          </svg>
                        )}
                        {typeSavedValues[0].value === "sad" && (
                          <svg
                            className='w-5 h-5 text-ios-red'
                            viewBox='0 0 24 24'
                            fill='none'
                            stroke='currentColor'
                            strokeWidth='2'
                            strokeLinecap='round'
                            strokeLinejoin='round'>
                            <circle cx='12' cy='12' r='10' />
                            <path d='M16 16s-1.5-2-4-2-4 2-4 2' />
                            <line
                              x1='9'
                              y1='9'
                              x2='9.01'
                              y2='9'
                              strokeWidth='3'
                            />
                            <line
                              x1='15'
                              y1='9'
                              x2='15.01'
                              y2='9'
                              strokeWidth='3'
                            />
                          </svg>
                        )}
                      </span>
                    )}
                    {/* Counter controls */}
                    {isCounter && (
                      <div
                        className='flex items-center gap-x-2'
                        onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCounterChange(-1);
                          }}
                          disabled={currentCounterValue === 0}
                          className={cn(
                            "w-7 h-7 rounded-full flex items-center justify-center text-[18px] font-medium border border-gray-200 dark:border-gray-600",
                            "bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 shadow-none",
                            "active:bg-gray-100 dark:active:bg-gray-700 active:scale-95 transition-transform",
                            currentCounterValue === 0 && "opacity-30"
                          )}>
                          −
                        </button>
                        <span
                          className={cn(
                            "w-7 text-center text-[17px] font-semibold tabular-nums",
                            currentCounterValue > 0
                              ? "text-ios-green"
                              : "text-gray-400 dark:text-gray-500"
                          )}>
                          {currentCounterValue}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCounterChange(1);
                          }}
                          className={cn(
                            "w-7 h-7 rounded-full flex items-center justify-center text-[18px] font-medium border border-ios-blue/20",
                            "bg-ios-blue/5 text-ios-blue shadow-none",
                            "active:bg-ios-blue/10 active:scale-95 transition-transform"
                          )}>
                          +
                        </button>
                      </div>
                    )}
                    {/* Boolean value display (show check or x if saved) */}
                    {type.valueType === "boolean" && hasSavedValues && (
                      <span
                        className={cn(
                          "w-5 h-5 flex items-center justify-center text-[17px] font-bold",
                          typeSavedValues[0].value
                            ? "text-ios-green"
                            : "text-ios-red"
                        )}>
                        {typeSavedValues[0].value ? "✓" : "✗"}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Expanded content - not for checkmark or counter types */}
            {isExpanded && !isCheckmark && !isCounter && (
              <div
                className={cn(
                  "px-4 pb-4 bg-gray-50 dark:bg-gray-800/50",
                  !isLast &&
                    "border-b border-gray-200/80 dark:border-gray-700/80"
                )}>
                {/* Saved values with delete option - not for mood type */}
                {hasSavedValues && !isMood && (
                  <div className='flex flex-wrap gap-2 pb-3'>
                    {typeSavedValues.map((saved) => (
                      <span
                        key={saved.id}
                        className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[15px] bg-ios-blue text-white'>
                        {formatValue(saved.value, type.id)}
                        <button
                          type='button'
                          onClick={(e) => {
                            e.stopPropagation();
                            removeSavedValue(type.id, saved.id);
                          }}
                          className='w-4 h-4 rounded-full bg-white/30 flex items-center justify-center text-xs'>
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {renderExpandedInput(type)}
              </div>
            )}
          </div>
        );
      })}

      {/* Lock Day Button */}
      {!isViewingOther && (
        <div className='mt-4 relative'>
          {/* Celebration overlay */}
          {showCelebration && (
            <div className='absolute inset-0 pointer-events-none overflow-hidden rounded-xl'>
              {particles.map((particle) => (
                <div
                  key={particle.id}
                  className='absolute animate-confetti'
                  style={
                    {
                      left: `${particle.x}%`,
                      top: `${particle.y}%`,
                      width: particle.size,
                      height: particle.size,
                      backgroundColor: particle.color,
                      transform: `rotate(${particle.rotation}deg)`,
                      "--vx": particle.velocityX,
                      "--vy": particle.velocityY,
                    } as React.CSSProperties
                  }
                />
              ))}
            </div>
          )}

          <button
            onClick={handleLockToggle}
            disabled={isLocking}
            className={cn(
              "w-full py-4 rounded-xl flex items-center justify-center gap-3 transition-all duration-300",
              "active:scale-[0.98]",
              isLocked
                ? "bg-ios-green text-white shadow-lg shadow-ios-green/30"
                : "bg-white/80 dark:bg-ios-card-dark text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700",
              isLocking && "opacity-70 cursor-not-allowed"
            )}>
            {/* Lock icon with animation */}
            <div
              className={cn(
                "transition-transform duration-500",
                isLocked && "animate-bounce-once"
              )}>
              {isLocked ? (
                <svg
                  className='w-6 h-6'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'
                  strokeWidth={2}>
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'
                  />
                </svg>
              ) : (
                <svg
                  className='w-6 h-6'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'
                  strokeWidth={2}>
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    d='M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z'
                  />
                </svg>
              )}
            </div>
            <span className='font-semibold text-[17px]'>
              {isLocking
                ? "Working..."
                : isLocked
                ? "Day Locked ✨"
                : "Lock Day"}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
