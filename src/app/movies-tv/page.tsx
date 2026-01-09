"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useApp } from "@/context/AppContext";
import { formatDate, addDays, cn } from "@/lib/utils";
import { LogEntry } from "@/types";
import { IOSSegmentedControl } from "@/components/ios";
import { IOSModal } from "@/components/ios";
import { searchMedia } from "@/lib/omdb";

const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY || "";

// Search for movie posters using both OMDB and TMDb APIs
async function searchPosters(title: string): Promise<string[]> {
  const posters: string[] = [];

  // Try OMDB first
  try {
    const omdbResults = await searchMedia(title);
    for (const result of omdbResults) {
      if (result.Poster && result.Poster !== "N/A") {
        posters.push(result.Poster);
      }
      if (posters.length >= 3) break;
    }
  } catch (error) {
    console.error("OMDB poster search error:", error);
  }

  // If we don't have enough posters, try TMDb
  if (posters.length < 3 && TMDB_API_KEY) {
    try {
      const tmdbSearchUrl = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(
        title
      )}`;
      const response = await fetch(tmdbSearchUrl);
      if (response.ok) {
        const data = await response.json();
        for (const result of data.results || []) {
          if (result.poster_path) {
            const posterUrl = `https://image.tmdb.org/t/p/w500${result.poster_path}`;
            if (!posters.includes(posterUrl)) {
              posters.push(posterUrl);
            }
          }
          if (posters.length >= 6) break;
        }
      }
    } catch (error) {
      console.error("TMDb poster search error:", error);
    }
  }

  return posters.slice(0, 6);
}

function PosterPickerModal({
  isOpen,
  onClose,
  entry,
  onSelectPoster,
}: {
  isOpen: boolean;
  onClose: () => void;
  entry: LogEntry;
  onSelectPoster: (posterUrl: string) => void;
}) {
  const [posters, setPosters] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [customUrl, setCustomUrl] = useState("");
  const title = typeof entry.value === "string" ? entry.value : "";

  useEffect(() => {
    if (isOpen && title) {
      setLoading(true);
      searchPosters(title).then((results) => {
        setPosters(results);
        setLoading(false);
      });
    }
  }, [isOpen, title]);

  return (
    <IOSModal isOpen={isOpen} onClose={onClose} title='Choose Poster'>
      <div className='space-y-4'>
        <p className='text-sm text-gray-500 dark:text-gray-400'>
          Select a poster for &quot;{title}&quot;
        </p>

        {loading ? (
          <div className='flex justify-center py-8'>
            <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-ios-blue'></div>
          </div>
        ) : posters.length > 0 ? (
          <div className='grid grid-cols-3 gap-3'>
            {posters.map((poster, index) => (
              <button
                key={index}
                onClick={() => {
                  onSelectPoster(poster);
                  onClose();
                }}
                className='aspect-2/3 rounded-lg overflow-hidden border-2 border-transparent hover:border-ios-blue transition-all'>
                <img
                  src={poster}
                  alt={`Poster option ${index + 1}`}
                  className='w-full h-full object-cover'
                />
              </button>
            ))}
          </div>
        ) : (
          <p className='text-center text-gray-500 py-4'>
            No posters found. Try adding a custom URL below.
          </p>
        )}

        <div className='pt-2 border-t border-gray-200 dark:border-gray-700'>
          <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
            Or enter a custom poster URL
          </label>
          <div className='flex gap-2'>
            <input
              type='url'
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder='https://...'
              className='flex-1 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white text-sm'
            />
            <button
              onClick={() => {
                if (customUrl) {
                  onSelectPoster(customUrl);
                  onClose();
                }
              }}
              disabled={!customUrl}
              className='px-4 py-2 bg-ios-blue text-white rounded-lg text-sm font-medium disabled:opacity-50'>
              Use
            </button>
          </div>
        </div>
      </div>
    </IOSModal>
  );
}

function StarRating({
  rating,
  onRate,
  size = "md",
}: {
  rating?: number;
  onRate?: (rating: number) => void;
  size?: "sm" | "md" | "lg";
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const displayRating = hovered ?? rating ?? 0;
  const sizeClasses = { sm: "w-4 h-4", md: "w-5 h-5", lg: "w-6 h-6" };

  const getRatingFromPosition = useCallback((clientX: number) => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const starWidth = rect.width / 10;
    const star = Math.ceil(x / starWidth);
    return Math.max(1, Math.min(10, star));
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      setIsDragging(true);
      const rating = getRatingFromPosition(e.touches[0].clientX);
      if (rating) setHovered(rating);
    },
    [getRatingFromPosition]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging) return;
      const rating = getRatingFromPosition(e.touches[0].clientX);
      if (rating) setHovered(rating);
    },
    [isDragging, getRatingFromPosition]
  );

  const handleTouchEnd = useCallback(() => {
    if (hovered && onRate) {
      onRate(hovered);
    }
    setIsDragging(false);
    setHovered(null);
  }, [hovered, onRate]);

  return (
    <div
      ref={containerRef}
      className='flex gap-0.5 touch-none'
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
        <button
          key={star}
          onClick={() => onRate?.(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(null)}
          className='transition-transform hover:scale-110'>
          <svg
            className={cn(
              sizeClasses[size],
              star <= displayRating
                ? "text-amber-400 fill-amber-400"
                : "text-gray-300 dark:text-gray-600 fill-gray-300 dark:fill-gray-600"
            )}
            viewBox='0 0 24 24'>
            <path d='M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' />
          </svg>
        </button>
      ))}
    </div>
  );
}

function MediaCard({
  entry,
  onRate,
  onUpdatePoster,
  layout = "grid",
}: {
  entry: LogEntry;
  onRate: (entryId: string, rating: number) => void;
  onUpdatePoster: (entryId: string, posterUrl: string) => void;
  layout?: "grid" | "list";
}) {
  const [showRating, setShowRating] = useState(false);
  const [showPosterPicker, setShowPosterPicker] = useState(false);
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
          <button
            onClick={() => setShowPosterPicker(true)}
            className='relative w-20 h-28 shrink-0 bg-gray-200 dark:bg-gray-800 group'>
            {entry.poster ? (
              <>
                <img
                  src={entry.poster}
                  alt={title}
                  className='w-full h-full object-cover'
                />
                <div className='absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center'>
                  <span className='text-white opacity-0 group-hover:opacity-100 text-xs'>
                    Change
                  </span>
                </div>
              </>
            ) : (
              <div className='w-full h-full flex flex-col items-center justify-center text-2xl hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors'>
                🎬
                <span className='text-[10px] text-gray-500 dark:text-gray-400 mt-1'>
                  Add poster
                </span>
              </div>
            )}
          </button>
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
                  <svg
                    className='w-4 h-4'
                    viewBox='0 0 24 24'
                    fill='currentColor'>
                    <path d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' />
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
        <PosterPickerModal
          isOpen={showPosterPicker}
          onClose={() => setShowPosterPicker(false)}
          entry={entry}
          onSelectPoster={(url) => onUpdatePoster(entry.id, url)}
        />
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
        <button
          onClick={() => setShowPosterPicker(true)}
          className='relative aspect-2/3 bg-gray-200 dark:bg-gray-800 group'>
          {entry.poster ? (
            <>
              <img
                src={entry.poster}
                alt={title}
                className='w-full h-full object-cover'
              />
              <div className='absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center'>
                <span className='text-white opacity-0 group-hover:opacity-100 text-sm'>
                  Change
                </span>
              </div>
            </>
          ) : (
            <div className='w-full h-full flex flex-col items-center justify-center text-4xl hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors'>
              🎬
              <span className='text-[10px] text-gray-500 dark:text-gray-400 mt-1'>
                Add poster
              </span>
            </div>
          )}
        </button>
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
                <svg
                  className='w-4 h-4'
                  viewBox='0 0 24 24'
                  fill='currentColor'>
                  <path d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' />
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
      <PosterPickerModal
        isOpen={showPosterPicker}
        onClose={() => setShowPosterPicker(false)}
        entry={entry}
        onSelectPoster={(url) => onUpdatePoster(entry.id, url)}
      />
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
        t.name.toLowerCase().includes("film")
    )?.id;
  }, [activityTypes]);

  const seriesTypeId = useMemo(() => {
    return activityTypes.find(
      (t) =>
        t.name.toLowerCase().includes("tv") ||
        t.name.toLowerCase().includes("series")
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
      movies.map((e) => String(e.value).toLowerCase())
    ).size;
    const uniqueSeries = new Set(
      series.map((e) => String(e.value).toLowerCase())
    ).size;

    return { totalMovies: uniqueMovies, totalSeries: uniqueSeries };
  }, [entries, movieTypeId, seriesTypeId]);

  const handleRate = async (entryId: string, rating: number) => {
    // Don't allow rating when viewing another user's data
    if (isViewingOther) return;

    const entry = entries.find((e) => e.id === entryId);
    if (entry) await updateEntry({ ...entry, userRating: rating });
  };

  const handleUpdatePoster = async (entryId: string, posterUrl: string) => {
    // Don't allow editing when viewing another user's data
    if (isViewingOther) return;

    const entry = entries.find((e) => e.id === entryId);
    if (entry) await updateEntry({ ...entry, poster: posterUrl });
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

      <div className='px-4 pt-3 mb-3'>
        <IOSSegmentedControl
          options={[
            { value: "movies", label: "Movies (" + stats.totalMovies + ")" },
            { value: "series", label: "Series (" + stats.totalSeries + ")" },
          ]}
          value={activeTab}
          onChange={(v) => setActiveTab(v as "movies" | "series")}
        />
      </div>

      <div className='px-4 mb-3 flex gap-2 items-center'>
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
                  : "bg-white/80 dark:bg-ios-card-dark text-gray-700 dark:text-gray-300"
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
            <svg
              className='w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-500'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth={1.5}>
              <rect x='2' y='4' width='20' height='16' rx='2' />
              <path d='M7 4v16M17 4v16M2 9h5M17 9h5M2 15h5M17 15h5' />
            </svg>
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
                onUpdatePoster={handleUpdatePoster}
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
                onUpdatePoster={handleUpdatePoster}
                layout='list'
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
