"use client";

import { useState, useEffect, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { formatDate, addDays, cn } from "@/lib/utils";
import { LogEntry } from "@/types";
import { IOSSegmentedControl } from "@/components/ios";
import { StarRating } from "@/components";

function MediaCard({
  entry,
  onRate,
  layout = "grid",
}: {
  entry: LogEntry;
  onRate: (entryId: string, rating: number) => void;
  layout?: "grid" | "list";
}) {
  const [showRating, setShowRating] = useState(false);
  const title = typeof entry.value === "string" ? entry.value : "";

  if (layout === "list") {
    return (
      <div>
        {/* Added date above the card - iOS style */}
        <p className='text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5 px-0.5'>
          {new Date(entry.date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </p>
        <div className='bg-white/80 dark:bg-ios-card-dark rounded-xl overflow-hidden shadow-sm flex'>
          <div className='relative w-20 h-28 shrink-0 bg-gray-200 dark:bg-gray-800'>
            {entry.poster ? (
              <img
                src={entry.poster}
                alt={title}
                className='w-full h-full object-cover'
              />
            ) : (
              <div className='w-full h-full flex items-center justify-center text-2xl'>
                🎬
              </div>
            )}
          </div>
          <div className='p-3 flex-1 flex flex-col justify-start min-w-0'>
            <h3 className='font-semibold text-gray-900 dark:text-white text-[15px] line-clamp-2'>
              {title}
            </h3>
            <div className='flex items-center gap-3 mt-1.5'>
              {entry.imdbRating && (
                <span className='text-[14px] text-amber-500'>
                  ⭐ {Math.round(parseFloat(entry.imdbRating))}
                </span>
              )}
              {entry.userRating ? (
                <button
                  onClick={() => setShowRating(true)}
                  className='text-[14px] text-ios-blue flex items-center gap-1'>
                  <svg className='w-4 h-4' viewBox='0 0 512 512' fill='none'>
                    <path
                      d='M160 120 L160 392 L280 392 C360 392 420 320 420 256 C420 192 360 120 280 120 L160 120 Z'
                      fill='none'
                      stroke='currentColor'
                      strokeWidth='40'
                      strokeLinecap='round'
                      strokeLinejoin='round'
                    />
                    <circle cx='220' cy='200' r='16' fill='currentColor' />
                    <circle cx='220' cy='256' r='16' fill='currentColor' />
                    <circle cx='220' cy='312' r='16' fill='currentColor' />
                  </svg>
                  {entry.userRating}
                </button>
              ) : null}
            </div>
            {showRating ? (
              <div className='mt-2 space-y-1.5'>
                <StarRating
                  rating={entry.userRating}
                  onRate={(r) => {
                    onRate(entry.id, r);
                    setShowRating(false);
                  }}
                  size='sm'
                />
                <button
                  onClick={() => setShowRating(false)}
                  className='text-[12px] text-gray-500'>
                  Cancel
                </button>
              </div>
            ) : !entry.userRating ? (
              <button
                onClick={() => setShowRating(true)}
                className='mt-1 text-[13px] text-ios-blue text-left'>
                Add rating
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Added date above the card - iOS style */}
      <p className='text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5 px-0.5'>
        {new Date(entry.date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })}
      </p>
      <div className='bg-white/80 dark:bg-ios-card-dark rounded-xl overflow-hidden shadow-sm h-full flex flex-col'>
        <div className='relative aspect-2/3 bg-gray-200 dark:bg-gray-800'>
          {entry.poster ? (
            <img
              src={entry.poster}
              alt={title}
              className='w-full h-full object-cover'
            />
          ) : (
            <div className='w-full h-full flex items-center justify-center text-4xl'>
              🎬
            </div>
          )}
        </div>
        <div className='p-2.5 flex flex-col flex-1'>
          <h3 className='font-semibold text-gray-900 dark:text-white text-[14px] line-clamp-2'>
            {title}
          </h3>
          <div className='flex items-center gap-3 mt-auto'>
            {entry.imdbRating && (
              <span className='text-[14px] text-amber-500'>
                ⭐ {Math.round(parseFloat(entry.imdbRating))}
              </span>
            )}
            {entry.userRating ? (
              <button
                onClick={() => setShowRating(true)}
                className='text-[14px] text-ios-blue flex items-center gap-1'>
                <svg className='w-4 h-4' viewBox='0 0 512 512' fill='none'>
                  <path
                    d='M160 120 L160 392 L280 392 C360 392 420 320 420 256 C420 192 360 120 280 120 L160 120 Z'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth='40'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                  />
                  <circle cx='220' cy='200' r='16' fill='currentColor' />
                  <circle cx='220' cy='256' r='16' fill='currentColor' />
                  <circle cx='220' cy='312' r='16' fill='currentColor' />
                </svg>
                {entry.userRating}
              </button>
            ) : null}
          </div>
          {showRating ? (
            <div className='mt-2 space-y-1.5'>
              <StarRating
                rating={entry.userRating}
                onRate={(r) => {
                  onRate(entry.id, r);
                  setShowRating(false);
                }}
                size='sm'
              />
              <button
                onClick={() => setShowRating(false)}
                className='text-[12px] text-gray-500'>
                Cancel
              </button>
            </div>
          ) : !entry.userRating ? (
            <button
              onClick={() => setShowRating(true)}
              className='mt-1 text-[13px] text-ios-blue text-left'>
              Add rating
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function MoviesPage() {
  const {
    entries,
    loadEntriesForDateRange,
    activityTypes,
    updateEntry,
    viewingUser,
    setViewingUser,
    isViewingOther,
  } = useApp();
  const [activeTab, setActiveTab] = useState<"movies" | "series">("movies");
  const [sortBy, setSortBy] = useState<"date" | "rating" | "imdb">("date");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");

  const movieTypeId = useMemo(() => {
    return activityTypes.find(
      (t) =>
        t.name.toLowerCase().includes("movie") ||
        t.name.toLowerCase().includes("film"),
    )?.id;
  }, [activityTypes]);

  const seriesTypeId = useMemo(() => {
    return activityTypes.find(
      (t) =>
        t.name.toLowerCase().includes("tv") ||
        t.name.toLowerCase().includes("series"),
    )?.id;
  }, [activityTypes]);

  useEffect(() => {
    const end = formatDate(new Date());
    const start = addDays(end, -365 * 5);
    loadEntriesForDateRange(start, end);
  }, [loadEntriesForDateRange]);

  const mediaEntries = useMemo(() => {
    const typeId = activeTab === "movies" ? movieTypeId : seriesTypeId;
    if (!typeId) return [];

    // Get all entries for this type
    const allEntries = entries.filter((e) => e.activityTypeId === typeId);

    // Group by value (title) and keep only the newest entry for each
    const uniqueByTitle = new Map<string, (typeof allEntries)[0]>();
    allEntries.forEach((entry) => {
      const key = String(entry.value).toLowerCase();
      const existing = uniqueByTitle.get(key);
      if (!existing || entry.date > existing.date) {
        uniqueByTitle.set(key, entry);
      }
    });

    // Convert back to array and sort
    return Array.from(uniqueByTitle.values()).sort((a, b) => {
      if (sortBy === "rating") return (b.userRating || 0) - (a.userRating || 0);
      if (sortBy === "imdb")
        return (
          parseFloat(b.imdbRating || "0") - parseFloat(a.imdbRating || "0")
        );
      return b.date.localeCompare(a.date);
    });
  }, [entries, activeTab, movieTypeId, seriesTypeId, sortBy]);

  const stats = useMemo(() => {
    const movies = entries.filter((e) => e.activityTypeId === movieTypeId);
    const series = entries.filter((e) => e.activityTypeId === seriesTypeId);

    // Count unique movies/series
    const uniqueMovies = new Set(
      movies.map((e) => String(e.value).toLowerCase()),
    ).size;
    const uniqueSeries = new Set(
      series.map((e) => String(e.value).toLowerCase()),
    ).size;

    return { totalMovies: uniqueMovies, totalSeries: uniqueSeries };
  }, [entries, movieTypeId, seriesTypeId]);

  const handleRate = async (entryId: string, rating: number) => {
    // Don't allow rating when viewing another user's data
    if (isViewingOther) return;

    const entry = entries.find((e) => e.id === entryId);
    if (entry) await updateEntry({ ...entry, userRating: rating });
  };

  return (
    <div className='pb-16'>
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

      {/* Header */}
      <div className='px-4 pt-6 pb-4'>
        <h1 className='text-2xl font-bold text-gray-900 dark:text-white'>
          Movies & TV
        </h1>
      </div>

      <div className='px-4 mb-4'>
        <IOSSegmentedControl
          options={[
            { value: "movies", label: "Movies (" + stats.totalMovies + ")" },
            { value: "series", label: "Series (" + stats.totalSeries + ")" },
          ]}
          value={activeTab}
          onChange={(v) => setActiveTab(v as "movies" | "series")}
        />
      </div>

      <div className='px-4 mb-4 flex gap-2 items-center'>
        <div className='flex gap-2 flex-1'>
          {[
            { value: "date", label: "Newest" },
            { value: "rating", label: "My rating" },
            { value: "imdb", label: "IMDB" },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setSortBy(option.value as typeof sortBy)}
              className={cn(
                "px-4 py-2 rounded-full text-[13px] font-medium",
                sortBy === option.value
                  ? "bg-ios-blue text-white"
                  : "bg-white/80 dark:bg-ios-card-dark text-gray-700 dark:text-gray-300",
              )}>
              {option.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
          className='p-2 rounded-lg bg-white/80 dark:bg-ios-card-dark text-gray-700 dark:text-gray-300'>
          {viewMode === "grid" ? (
            <svg
              className='w-5 h-5'
              fill='none'
              viewBox='0 0 24 24'
              strokeWidth={1.5}
              stroke='currentColor'>
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                d='M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5'
              />
            </svg>
          ) : (
            <svg
              className='w-5 h-5'
              fill='none'
              viewBox='0 0 24 24'
              strokeWidth={1.5}
              stroke='currentColor'>
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                d='M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z'
              />
            </svg>
          )}
        </button>
      </div>

      <main className='px-4'>
        {mediaEntries.length === 0 ? (
          <div className='text-center py-12'>
            <p className='text-4xl mb-4'>
              {activeTab === "movies" ? "🎬" : "📺"}
            </p>
            <p className='text-gray-500'>
              No {activeTab === "movies" ? "movies" : "series"} found
            </p>
          </div>
        ) : viewMode === "grid" ? (
          <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-8'>
            {mediaEntries.map((entry) => (
              <MediaCard
                key={entry.id}
                entry={entry}
                onRate={handleRate}
                layout='grid'
              />
            ))}
          </div>
        ) : (
          <div className='space-y-3'>
            {mediaEntries.map((entry) => (
              <MediaCard
                key={entry.id}
                entry={entry}
                onRate={handleRate}
                layout='list'
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
