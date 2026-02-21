"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Image from "next/image";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { formatDate, addDays, cn } from "@/lib/utils";
import { LogEntry } from "@/types";
import { IOSSegmentedControl } from "@/components/ios";
import { MediaSearch, StarRating } from "@/components";
import { getSharedWithMe, SharedUser } from "@/lib/sharing";
import { supabase } from "@/lib/supabase";
import { getMediaLink } from "@/lib/tmdb";

const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY || "";

// Search for all available posters for a specific movie/TV show using TMDb
async function searchPosters(
  title: string,
  imdbId?: string,
): Promise<string[]> {
  const posters: string[] = [];

  if (!TMDB_API_KEY) return posters;

  try {
    let tmdbId: number | null = null;
    let mediaType: "movie" | "tv" = "movie";

    // If we have an IMDB ID, use it to find the exact movie/show
    if (imdbId && imdbId.startsWith("tt")) {
      const findUrl = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
      const findResponse = await fetch(findUrl);
      if (findResponse.ok) {
        const findData = await findResponse.json();
        if (findData.movie_results?.length > 0) {
          tmdbId = findData.movie_results[0].id;
          mediaType = "movie";
        } else if (findData.tv_results?.length > 0) {
          tmdbId = findData.tv_results[0].id;
          mediaType = "tv";
        }
      }
    }

    // If no IMDB ID or find failed, search by title
    if (!tmdbId) {
      const searchUrl = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}`;
      const searchResponse = await fetch(searchUrl);
      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        const firstResult = searchData.results?.[0];
        if (firstResult) {
          tmdbId = firstResult.id;
          mediaType = firstResult.media_type === "tv" ? "tv" : "movie";
        }
      }
    }

    // Now fetch all posters for this specific movie/show
    if (tmdbId) {
      const imagesUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}/images?api_key=${TMDB_API_KEY}`;
      const imagesResponse = await fetch(imagesUrl);
      if (imagesResponse.ok) {
        const imagesData = await imagesResponse.json();
        // Get posters sorted by vote_average (quality)
        const sortedPosters = (imagesData.posters || [])
          .sort(
            (a: { vote_average: number }, b: { vote_average: number }) =>
              b.vote_average - a.vote_average,
          )
          .slice(0, 12);

        for (const poster of sortedPosters) {
          if (poster.file_path) {
            posters.push(`https://image.tmdb.org/t/p/w500${poster.file_path}`);
          }
        }
      }
    }
  } catch (error) {
    console.error("TMDb poster search error:", error);
  }

  return posters;
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
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const title = typeof entry.value === "string" ? entry.value : "";

  // Reset state when modal opens and fetch posters
  const loadPosters = useCallback(async () => {
    if (!title) return;
    setLoading(true);
    setSelectedIndex(null);
    const results = await searchPosters(title, entry.imdbId);
    setPosters(results);
    setLoading(false);
  }, [title, entry.imdbId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadPosters();
    }
  }, [isOpen, loadPosters]);

  const handleSelect = (poster: string, index: number) => {
    setSelectedIndex(index);
    onSelectPoster(poster);
    // Brief delay to show selection before closing
    setTimeout(() => onClose(), 150);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (dataUrl) {
          onSelectPoster(dataUrl);
          onClose();
        }
      };
      reader.readAsDataURL(file);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className='fixed inset-0 z-50 flex items-end justify-center sm:items-center'
      onClick={onClose}>
      {/* Backdrop */}
      <div className='absolute inset-0 bg-black/60 backdrop-blur-sm' />

      {/* Modal */}
      <div
        className='relative w-full max-w-md mx-auto mb-20 sm:mb-0 bg-white dark:bg-gray-900 rounded-3xl sm:rounded-2xl overflow-hidden animate-in slide-in-from-bottom duration-300 max-h-[70vh] flex flex-col'
        onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className='flex items-center justify-between px-5 py-4 border-b border-gray-200/80 dark:border-gray-700/80'>
          <button
            onClick={onClose}
            className='text-[17px] text-ios-blue active:opacity-60'>
            Cancel
          </button>
          <h2 className='text-[17px] font-semibold text-gray-900 dark:text-white'>
            Choose Poster
          </h2>
          <div className='w-[60px]' /> {/* Spacer for centering */}
        </div>

        {/* Title info */}
        <div className='px-5 py-3 bg-gray-50 dark:bg-gray-800/50'>
          <p className='text-[15px] text-gray-600 dark:text-gray-400 text-center'>
            {title}
          </p>
        </div>

        {/* Content */}
        <div className='flex-1 overflow-y-auto overscroll-contain p-4'>
          <input
            ref={fileInputRef}
            type='file'
            accept='image/*'
            onChange={handleFileSelect}
            className='hidden'
          />

          {loading ? (
            <div className='flex flex-col items-center justify-center py-12'>
              <div className='w-10 h-10 border-3 border-ios-blue/30 border-t-ios-blue rounded-full animate-spin' />
              <p className='mt-4 text-[15px] text-gray-500 dark:text-gray-400'>
                Finding posters...
              </p>
            </div>
          ) : posters.length > 0 ? (
            <div className='grid grid-cols-3 gap-3'>
              {posters.map((poster, index) => (
                <button
                  key={index}
                  onClick={() => handleSelect(poster, index)}
                  className={cn(
                    "relative aspect-[2/3] rounded-xl overflow-hidden transition-all duration-200",
                    "active:scale-95",
                    selectedIndex === index
                      ? "ring-3 ring-ios-blue ring-offset-2 ring-offset-white dark:ring-offset-gray-900 scale-[0.98]"
                      : "ring-1 ring-gray-200 dark:ring-gray-700",
                  )}>
                  <Image
                    src={poster}
                    alt={`Poster ${index + 1}`}
                    fill
                    className='object-cover'
                    sizes='(max-width: 768px) 33vw, 200px'
                    unoptimized={poster.startsWith("data:")}
                  />
                  {selectedIndex === index && (
                    <div className='absolute inset-0 bg-ios-blue/20 flex items-center justify-center'>
                      <div className='w-8 h-8 rounded-full bg-ios-blue flex items-center justify-center'>
                        <svg
                          className='w-5 h-5 text-white'
                          fill='none'
                          viewBox='0 0 24 24'
                          strokeWidth={3}
                          stroke='currentColor'>
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            d='M4.5 12.75l6 6 9-13.5'
                          />
                        </svg>
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className='flex flex-col items-center justify-center py-8'>
              <div className='w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3'>
                <svg
                  className='w-7 h-7 text-gray-400'
                  fill='none'
                  viewBox='0 0 24 24'
                  strokeWidth={1.5}
                  stroke='currentColor'>
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    d='M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z'
                  />
                </svg>
              </div>
              <p className='text-[15px] font-medium text-gray-900 dark:text-white mb-1'>
                No Online Posters Found
              </p>
              <p className='text-[13px] text-gray-500 dark:text-gray-400 text-center px-6'>
                Use the photo library option below to add your own
              </p>
            </div>
          )}

          {/* Divider */}
          {!loading && (
            <div className='flex items-center gap-3 my-4'>
              <div className='flex-1 h-px bg-gray-200 dark:bg-gray-700' />
              <span className='text-[13px] text-gray-400 dark:text-gray-500'>
                or
              </span>
              <div className='flex-1 h-px bg-gray-200 dark:bg-gray-700' />
            </div>
          )}

          {/* Photo Library Button */}
          {!loading && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className='w-full flex items-center gap-3 p-4 rounded-xl bg-gray-100 dark:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 transition-colors'>
              <div className='w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 flex items-center justify-center'>
                <svg
                  className='w-5 h-5 text-white'
                  fill='none'
                  viewBox='0 0 24 24'
                  strokeWidth={2}
                  stroke='currentColor'>
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    d='M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z'
                  />
                </svg>
              </div>
              <div className='flex-1 text-left'>
                <p className='text-[17px] font-medium text-gray-900 dark:text-white'>
                  Choose from Photo Library
                </p>
                <p className='text-[13px] text-gray-500 dark:text-gray-400'>
                  Select an image from your device
                </p>
              </div>
              <svg
                className='w-5 h-5 text-gray-400'
                fill='none'
                viewBox='0 0 24 24'
                strokeWidth={2}
                stroke='currentColor'>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='M8.25 4.5l7.5 7.5-7.5 7.5'
                />
              </svg>
            </button>
          )}
        </div>

        {/* Bottom padding */}
        <div className='h-4' />
      </div>
    </div>
  );
}

// MinRatingFilter - same drag functionality as StarRating but shows current value with "+"
function MinRatingFilter({
  value,
  onChange,
}: {
  value: number;
  onChange: (rating: number) => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const displayRating = hovered ?? value;

  const getRatingFromPosition = useCallback((clientX: number) => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const starWidth = rect.width / 10;
    const star = Math.ceil(x / starWidth);
    return Math.max(1, Math.min(10, star));
  }, []);

  // Use native event listeners for better touch control
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onTouchStart = (e: TouchEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setIsDragging(true);
      const rating = getRatingFromPosition(e.touches[0].clientX);
      if (rating) setHovered(rating);
    };

    const onTouchMove = (e: TouchEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const rating = getRatingFromPosition(e.touches[0].clientX);
      if (rating) setHovered(rating);
    };

    const onTouchEnd = (e: TouchEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setIsDragging(false);
    };

    container.addEventListener("touchstart", onTouchStart, { passive: false });
    container.addEventListener("touchmove", onTouchMove, { passive: false });
    container.addEventListener("touchend", onTouchEnd, { passive: false });

    return () => {
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", onTouchEnd);
    };
  }, [getRatingFromPosition]);

  // Save rating when dragging ends with a hovered value
  const prevDraggingRef = useRef(isDragging);
  useEffect(() => {
    // Only trigger when transitioning from dragging to not dragging
    if (prevDraggingRef.current && !isDragging && hovered !== null) {
      onChange(hovered);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHovered(null);
    }
    prevDraggingRef.current = isDragging;
  }, [isDragging, hovered, onChange]);

  return (
    <div className='flex items-center gap-1'>
      <div
        ref={containerRef}
        className='flex gap-1 touch-none select-none'
        style={{ touchAction: "none" }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
          <button
            key={star}
            onClick={() => onChange(star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(null)}
            className='transition-transform hover:scale-110 touch-none'
            style={{ touchAction: "none" }}>
            <svg
              className={cn(
                "w-6 h-6",
                star <= displayRating
                  ? "text-amber-400 fill-amber-400"
                  : "text-gray-300 dark:text-gray-600 fill-gray-300 dark:fill-gray-600",
              )}
              viewBox='0 0 24 24'>
              <path d='M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' />
            </svg>
          </button>
        ))}
      </div>
      <span className='ml-2 text-sm text-gray-600 dark:text-gray-300'>
        {displayRating}+
      </span>
    </div>
  );
}

function MediaCard({
  entry,
  onRate,
  onUpdatePoster,
  onMarkAsWatched,
  onRemoveFromWatchlist,
  isWatchlistView = false,
  layout = "grid",
  isDraggable = false,
  onDragStart,
  onDragEnd,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  isDragging = false,
  isDragOver = false,
}: {
  entry: LogEntry;
  onRate: (entryId: string, rating: number) => void;
  onUpdatePoster: (entryId: string, posterUrl: string) => void;
  onMarkAsWatched?: (entryId: string) => void;
  onRemoveFromWatchlist?: (entryId: string) => void;
  isWatchlistView?: boolean;
  layout?: "grid" | "list";
  isDraggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDragEnter?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  isDragging?: boolean;
  isDragOver?: boolean;
}) {
  const [showRating, setShowRating] = useState(false);
  const [showPosterPicker, setShowPosterPicker] = useState(false);
  const title = typeof entry.value === "string" ? entry.value : "";

  if (layout === "list") {
    return (
      <div
        draggable={isDraggable}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={cn(
          isDraggable && "cursor-grab active:cursor-grabbing",
          isDragging && "opacity-50",
          isDragOver && "ring-2 ring-ios-blue rounded-xl",
        )}>
        {/* Drag handle for watchlist */}
        {isDraggable && (
          <div className='flex items-center gap-2 mb-1.5'>
            <div className='text-gray-400 dark:text-gray-500'>
              <svg className='w-5 h-5' fill='currentColor' viewBox='0 0 24 24'>
                <path d='M8 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM8 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM8 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM14 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM14 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0z' />
              </svg>
            </div>
          </div>
        )}
        <div className='bg-white/80 dark:bg-ios-card-dark rounded-xl overflow-hidden shadow-sm flex'>
          <button
            onClick={() => setShowPosterPicker(true)}
            className='relative w-20 h-28 shrink-0 bg-gray-200 dark:bg-gray-800 group'>
            {entry.poster ? (
              <>
                <Image
                  src={entry.poster}
                  alt={title}
                  fill
                  className='object-cover'
                  sizes='80px'
                  unoptimized={entry.poster.startsWith("data:")}
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
            <div className='flex items-start justify-between gap-3'>
              {(() => {
                const link = getMediaLink(entry.imdbId);
                return link ? (
                  <a
                    href={link}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='font-semibold text-gray-900 dark:text-white text-[15px] line-clamp-2 hover:text-ios-blue transition-colors flex-1'>
                    {title}
                  </a>
                ) : (
                  <h3 className='font-semibold text-gray-900 dark:text-white text-[15px] line-clamp-2 flex-1'>
                    {title}
                  </h3>
                );
              })()}
              {/* Calendar badge - iOS style */}
              <div className='rounded-lg overflow-hidden shrink-0 w-[32px] opacity-60 border-l border-b border-gray-300 dark:border-gray-600'>
                <div className='bg-gray-400 dark:bg-gray-500 h-[11px] flex items-center justify-center'>
                  <span className='text-[7px] font-semibold text-white uppercase'>
                    {new Date(entry.date).toLocaleDateString("en-US", {
                      month: "short",
                    })}
                  </span>
                </div>
                <div className='bg-gray-100 dark:bg-gray-700 h-[21px] flex items-center justify-center'>
                  <span className='text-[14px] font-semibold text-gray-600 dark:text-gray-300 leading-none'>
                    {new Date(entry.date).getDate()}
                  </span>
                </div>
              </div>
            </div>
            <div className='flex items-center gap-3 mt-4'>
              {entry.imdbRating && (
                <span className='text-[14px] text-amber-500'>
                  ⭐ {Math.round(parseFloat(entry.imdbRating))}
                </span>
              )}
              {!isWatchlistView && entry.userRating ? (
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
              ) : !isWatchlistView && !entry.userRating ? (
                <button
                  onClick={() => setShowRating(true)}
                  className='text-ios-blue'
                  title='Add rating'>
                  <svg
                    className='w-8 h-5'
                    viewBox='0 0 32 20'
                    fill='currentColor'>
                    <circle cx='8' cy='4' r='3' />
                    <path d='M5 8c0 0 0 4 0 6c0 1 1 2 2 2h2v3h2v-3h1l2-4v-2c0-1-1-2-2-2H7c-1 0-2 1-2 2z' />
                    <rect
                      x='18'
                      y='2'
                      width='12'
                      height='9'
                      rx='1'
                      fill='none'
                      stroke='currentColor'
                      strokeWidth='1.5'
                    />
                    <path
                      d='M22 11v2h4v-2'
                      fill='none'
                      stroke='currentColor'
                      strokeWidth='1.5'
                    />
                    <path d='M22 5v4l3-2z' />
                  </svg>
                </button>
              ) : null}
            </div>
            {isWatchlistView ? (
              <div className='mt-2 flex items-center gap-2'>
                <button
                  onClick={() => onMarkAsWatched?.(entry.id)}
                  className='px-2 py-1 text-gray-500 dark:text-gray-400 text-[12px] hover:text-green-600 dark:hover:text-green-400 transition-colors'>
                  ✓ Watched
                </button>
                <button
                  onClick={() => onRemoveFromWatchlist?.(entry.id)}
                  className='p-1.5 text-gray-400 hover:text-red-500 transition-colors'>
                  <svg
                    className='w-5 h-5'
                    fill='none'
                    viewBox='0 0 24 24'
                    strokeWidth={1.5}
                    stroke='currentColor'>
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      d='M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0'
                    />
                  </svg>
                </button>
              </div>
            ) : showRating ? (
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
    <div className='bg-white/80 dark:bg-ios-card-dark rounded-xl overflow-hidden shadow-sm h-full flex flex-col'>
      <button
        onClick={() => setShowPosterPicker(true)}
        className='relative aspect-2/3 bg-gray-200 dark:bg-gray-800 group'>
        {entry.poster ? (
          <>
            <Image
              src={entry.poster}
              alt={title}
              fill
              className='object-cover'
              sizes='(max-width: 768px) 50vw, 300px'
              unoptimized={entry.poster.startsWith("data:")}
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
        {(() => {
          const link = getMediaLink(entry.imdbId);
          return link ? (
            <a
              href={link}
              target='_blank'
              rel='noopener noreferrer'
              className='font-semibold text-gray-900 dark:text-white text-[14px] line-clamp-2 hover:text-ios-blue transition-colors'>
              {title}
            </a>
          ) : (
            <h3 className='font-semibold text-gray-900 dark:text-white text-[14px] line-clamp-2'>
              {title}
            </h3>
          );
        })()}
        <div className='flex items-center gap-3 mt-auto pt-2'>
          {entry.imdbRating && (
            <span className='text-[14px] text-amber-500'>
              ⭐ {Math.round(parseFloat(entry.imdbRating))}
            </span>
          )}
          {!isWatchlistView && entry.userRating ? (
            <button
              onClick={() => setShowRating(true)}
              className='text-[14px] text-ios-blue flex items-center gap-1'>
              <svg className='w-4 h-4' viewBox='0 0 24 24' fill='currentColor'>
                <path d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' />
              </svg>
              {entry.userRating}
            </button>
          ) : !isWatchlistView && !entry.userRating ? (
            <button
              onClick={() => setShowRating(true)}
              className='text-ios-blue'
              title='Add rating'>
              <svg className='w-8 h-5' viewBox='0 0 32 20' fill='currentColor'>
                <circle cx='8' cy='4' r='3' />
                <path d='M5 8c0 0 0 4 0 6c0 1 1 2 2 2h2v3h2v-3h1l2-4v-2c0-1-1-2-2-2H7c-1 0-2 1-2 2z' />
                <rect
                  x='18'
                  y='2'
                  width='12'
                  height='9'
                  rx='1'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='1.5'
                />
                <path
                  d='M22 11v2h4v-2'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='1.5'
                />
                <path d='M22 5v4l3-2z' />
              </svg>
            </button>
          ) : null}
          {/* Calendar badge - iOS style */}
          <div className='rounded-lg overflow-hidden ml-auto w-[32px] opacity-60 border-l border-b border-gray-300 dark:border-gray-600'>
            <div className='bg-gray-400 dark:bg-gray-500 h-[11px] flex items-center justify-center'>
              <span className='text-[7px] font-semibold text-white uppercase'>
                {new Date(entry.date).toLocaleDateString("en-US", {
                  month: "short",
                })}
              </span>
            </div>
            <div className='bg-gray-100 dark:bg-gray-700 h-[21px] flex items-center justify-center'>
              <span className='text-[14px] font-semibold text-gray-600 dark:text-gray-300 leading-none'>
                {new Date(entry.date).getDate()}
              </span>
            </div>
          </div>
        </div>
        {isWatchlistView ? (
          <div className='mt-3 flex items-center gap-1.5'>
            <button
              onClick={() => onMarkAsWatched?.(entry.id)}
              className='px-1.5 py-0.5 text-gray-500 dark:text-gray-400 text-[10px] hover:text-green-600 dark:hover:text-green-400 transition-colors'>
              ✓ Watched
            </button>
            <button
              onClick={() => onRemoveFromWatchlist?.(entry.id)}
              className='p-1 text-gray-400 hover:text-red-500 transition-colors'>
              <svg
                className='w-4 h-4'
                fill='none'
                viewBox='0 0 24 24'
                strokeWidth={1.5}
                stroke='currentColor'>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0'
                />
              </svg>
            </button>
          </div>
        ) : showRating ? (
          <div className='mt-3 space-y-1.5'>
            <StarRating
              rating={entry.userRating}
              onRate={(r) => {
                onRate(entry.id, r);
                setShowRating(false);
              }}
              size='sm'
              wrap
            />
            <button
              onClick={() => setShowRating(false)}
              className='text-[12px] text-gray-500'>
              Cancel
            </button>
          </div>
        ) : null}
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
  const { user } = useAuth();
  const {
    entries,
    loadEntriesForDateRange,
    activityTypes,
    updateEntry,
    addEntry,
    deleteEntry,
    viewingUser,
    setViewingUser,
    isViewingOther,
  } = useApp();
  const [activeTab, setActiveTab] = useState<"movies" | "series">("movies");
  const [sortBy, setSortBy] = useState<"date" | "rating" | "imdb">("date");
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("movies-tv-viewmode");
      return saved === "grid" ? "grid" : "list";
    }
    return "list";
  });

  const handleViewModeChange = (mode: "grid" | "list") => {
    setViewMode(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("movies-tv-viewmode", mode);
    }
  };
  const [showWatchlist, setShowWatchlist] = useState(false);

  // Drag and drop state for watchlist reordering
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragCounter = useRef(0);

  // Watchlist order stored in localStorage (map of entry.id -> order)
  const [watchlistOrder, setWatchlistOrder] = useState<
    Record<string, Record<string, number>>
  >({});

  // Load watchlist order from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedOrder = localStorage.getItem("watchlistOrder");
      if (savedOrder) {
        try {
          setWatchlistOrder(JSON.parse(savedOrder));
        } catch (e) {
          console.error("Failed to parse watchlist order:", e);
        }
      }
    }
  }, []);

  // Save watchlist order to localStorage
  const saveWatchlistOrder = useCallback(
    (newOrder: Record<string, Record<string, number>>) => {
      setWatchlistOrder(newOrder);
      if (typeof window !== "undefined") {
        localStorage.setItem("watchlistOrder", JSON.stringify(newOrder));
      }
    },
    [],
  );

  // Favorites filter state
  const [showFavorites, setShowFavorites] = useState(false);
  const [minStarRating, setMinStarRating] = useState(1);
  const [favoriteFriends, setFavoriteFriends] = useState<string[]>([]);
  const [favoriteEntries, setFavoriteEntries] = useState<LogEntry[]>([]);
  const [loadingFavorites, setLoadingFavorites] = useState(false);
  const [favoriteUsers, setFavoriteUsers] = useState<Map<string, SharedUser>>(
    new Map(),
  );
  // Map from activity_type_id to type ('movie' | 'series')
  const [favoriteActivityTypes, setFavoriteActivityTypes] = useState<
    Map<string, "movie" | "series">
  >(new Map());

  // Load favorite friends from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const favorites = localStorage.getItem("favoriteFriends");
      if (favorites) {
        try {
          setFavoriteFriends(JSON.parse(favorites));
        } catch (e) {
          console.error("Failed to parse favorite friends:", e);
        }
      }
    }
  }, []);

  // Fetch movies from favorite friends when showFavorites is enabled
  useEffect(() => {
    const fetchFavoriteMovies = async () => {
      if (!showFavorites || !user?.id || favoriteFriends.length === 0) {
        setFavoriteEntries([]);
        return;
      }

      setLoadingFavorites(true);
      try {
        // Get shared users to verify we have access
        const sharedUsers = await getSharedWithMe(user.id);
        const userMap = new Map<string, SharedUser>();
        const activityTypeMap = new Map<string, "movie" | "series">();

        sharedUsers.forEach((su) => {
          userMap.set(su.id, su);
          // Build activity type map from each user's shared activity types
          su.activityTypes.forEach((at) => {
            const name = at.name.toLowerCase();
            if (name.includes("movie") || name.includes("film")) {
              activityTypeMap.set(at.id, "movie");
            } else if (name.includes("tv") || name.includes("series")) {
              activityTypeMap.set(at.id, "series");
            }
          });
        });

        setFavoriteUsers(userMap);
        setFavoriteActivityTypes(activityTypeMap);

        // Filter to only favorites we actually have access to
        const validFavorites = favoriteFriends.filter((id) => userMap.has(id));

        if (validFavorites.length === 0) {
          setFavoriteEntries([]);
          setLoadingFavorites(false);
          return;
        }

        // Fetch entries from favorite friends using RPC function
        const { data: entries, error } = await supabase.rpc(
          "get_shared_entries",
          {
            p_viewer_id: user.id,
            p_owner_ids: validFavorites,
          },
        );

        if (error) {
          console.warn("RPC get_shared_entries not available:", error.message);
          setFavoriteEntries([]);
        } else if (entries) {
          const mapped: LogEntry[] = entries.map(
            (e: {
              id: string;
              user_id: string;
              activity_type_id: string;
              date: string;
              value: string | number | boolean;
              note: string | null;
              imdb_id: string | null;
              poster: string | null;
              imdb_rating: string | null;
              year: string | null;
              user_rating: number | null;
              created_at: string;
              updated_at: string;
            }) => ({
              id: e.id,
              date: e.date,
              activityTypeId: e.activity_type_id,
              value: e.value,
              note: e.note || undefined,
              imdbId: e.imdb_id || undefined,
              poster: e.poster || undefined,
              imdbRating: e.imdb_rating || undefined,
              year: e.year || undefined,
              userRating: e.user_rating || undefined,
              createdAt: new Date(e.created_at),
              updatedAt: new Date(e.updated_at),
              ownerId: e.user_id,
            }),
          );
          setFavoriteEntries(mapped);
        }
      } catch (error) {
        console.error("Failed to fetch favorite movies:", error);
        setFavoriteEntries([]);
      } finally {
        setLoadingFavorites(false);
      }
    };

    fetchFavoriteMovies();
  }, [showFavorites, user?.id, favoriteFriends]);

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
    // When showing favorites, use favoriteEntries instead
    if (showFavorites) {
      // Filter favorite entries by type (movie or series based on favoriteActivityTypes map)
      const filteredEntries = favoriteEntries.filter((e) => {
        const type = favoriteActivityTypes.get(e.activityTypeId);
        if (activeTab === "movies") {
          return type === "movie";
        } else {
          return type === "series";
        }
      });

      // Filter by minimum star rating
      const ratingFiltered = filteredEntries.filter(
        (e) => (e.userRating || 0) >= minStarRating,
      );

      // Group by value (title) and keep only the highest rated entry for each
      const uniqueByTitle = new Map<string, LogEntry>();
      ratingFiltered.forEach((entry) => {
        const key = String(entry.value).toLowerCase();
        const existing = uniqueByTitle.get(key);
        if (!existing || (entry.userRating || 0) > (existing.userRating || 0)) {
          uniqueByTitle.set(key, entry);
        }
      });

      // Convert back to array and sort
      return Array.from(uniqueByTitle.values()).sort((a, b) => {
        if (sortBy === "rating")
          return (b.userRating || 0) - (a.userRating || 0);
        if (sortBy === "imdb")
          return (
            parseFloat(b.imdbRating || "0") - parseFloat(a.imdbRating || "0")
          );
        return b.date.localeCompare(a.date);
      });
    }

    const typeId = activeTab === "movies" ? movieTypeId : seriesTypeId;
    if (!typeId) return [];

    // Get all entries for this type, filtering by watchlist status
    const allEntries = entries.filter((e) => {
      if (e.activityTypeId !== typeId) return false;
      // When showing watchlist, only show watchlist items
      // When not showing watchlist, exclude watchlist items
      if (showWatchlist) {
        return e.isWatchlist === true;
      } else {
        return e.isWatchlist !== true;
      }
    });

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
    const sortedEntries = Array.from(uniqueByTitle.values());

    // If showing watchlist, use custom order from localStorage
    if (showWatchlist) {
      const orderKey = activeTab; // 'movies' or 'series'
      const order = watchlistOrder[orderKey] || {};
      return sortedEntries.sort((a, b) => {
        const orderA = order[a.id] ?? Number.MAX_SAFE_INTEGER;
        const orderB = order[b.id] ?? Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) return orderA - orderB;
        // Fall back to date order for items without custom order
        return b.date.localeCompare(a.date);
      });
    }

    return sortedEntries.sort((a, b) => {
      if (sortBy === "rating") return (b.userRating || 0) - (a.userRating || 0);
      if (sortBy === "imdb")
        return (
          parseFloat(b.imdbRating || "0") - parseFloat(a.imdbRating || "0")
        );
      return b.date.localeCompare(a.date);
    });
  }, [
    entries,
    activeTab,
    movieTypeId,
    seriesTypeId,
    sortBy,
    showFavorites,
    showWatchlist,
    watchlistOrder,
    favoriteEntries,
    minStarRating,
    favoriteActivityTypes,
  ]);

  const stats = useMemo(() => {
    const movies = entries.filter(
      (e) => e.activityTypeId === movieTypeId && !e.isWatchlist,
    );
    const series = entries.filter(
      (e) => e.activityTypeId === seriesTypeId && !e.isWatchlist,
    );

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

  const handleUpdatePoster = async (entryId: string, posterUrl: string) => {
    // Don't allow editing when viewing another user's data
    if (isViewingOther) return;

    const entry = entries.find((e) => e.id === entryId);
    if (entry) await updateEntry({ ...entry, poster: posterUrl });
  };

  const handleMarkAsWatched = async (entryId: string) => {
    // Don't allow editing when viewing another user's data
    if (isViewingOther) return;

    const entry = entries.find((e) => e.id === entryId);
    if (entry) {
      // Remove from watchlist and set today's date
      await updateEntry({
        ...entry,
        isWatchlist: false,
        date: formatDate(new Date()),
      });
    }
  };

  const handleRemoveFromWatchlist = async (entryId: string) => {
    // Don't allow editing when viewing another user's data
    if (isViewingOther) return;

    await deleteEntry(entryId);
  };

  const handleAddToWatchlist = async (
    title: string,
    imdbId: string,
    year: string,
    poster: string,
    rating?: string,
  ) => {
    if (isViewingOther) return;

    const typeId = activeTab === "movies" ? movieTypeId : seriesTypeId;
    if (!typeId) return;

    await addEntry({
      activityTypeId: typeId,
      date: formatDate(new Date()),
      value: title,
      imdbId,
      year,
      poster: poster !== "N/A" ? poster : undefined,
      imdbRating: rating && rating !== "N/A" ? rating : undefined,
      isWatchlist: true,
    });
  };

  // Drag and drop handlers for watchlist reordering
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
    setTimeout(() => {
      const target = e.target as HTMLElement;
      target.style.opacity = "0.5";
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const target = e.target as HTMLElement;
    target.style.opacity = "1";
    setDraggedIndex(null);
    setDragOverIndex(null);
    dragCounter.current = 0;
  };

  const handleDragEnter = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    dragCounter.current++;
    if (draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setDragOverIndex(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDragOverIndex(null);
      return;
    }

    // Reorder the items
    const newOrder = [...mediaEntries];
    const [draggedItem] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(dropIndex, 0, draggedItem);

    // Save the new order
    const orderKey = activeTab; // 'movies' or 'series'
    const newOrderMap: Record<string, number> = {};
    newOrder.forEach((entry, idx) => {
      newOrderMap[entry.id] = idx;
    });

    saveWatchlistOrder({
      ...watchlistOrder,
      [orderKey]: newOrderMap,
    });

    setDraggedIndex(null);
    setDragOverIndex(null);
    dragCounter.current = 0;
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
            className='px-3 py-1.5 bg-white/20 rounded-full text-[13px] font-medium hover:bg-white/30 transition-colors'>
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

      <div className='px-4 mb-3'>
        <IOSSegmentedControl
          options={[
            { value: "movies", label: "Movies" },
            { value: "series", label: "Series" },
          ]}
          value={activeTab}
          onChange={(v) => setActiveTab(v as "movies" | "series")}
        />
      </div>

      <div className='px-4 mb-3 flex gap-2 items-center'>
        <div className='flex gap-2 flex-1 items-center'>
          {/* Sort dropdown - always visible */}
          <div className='relative'>
            <button
              onClick={() => {
                // If favorites or watchlist is active, switch to watched list
                if (showFavorites || showWatchlist) {
                  setShowFavorites(false);
                  setShowWatchlist(false);
                } else {
                  // Otherwise toggle dropdown
                  setShowSortDropdown(!showSortDropdown);
                }
              }}
              className={cn(
                "px-3 py-2 rounded-full text-[13px] font-medium flex items-center gap-1.5",
                !showFavorites && !showWatchlist
                  ? "bg-ios-blue text-white"
                  : "bg-white/80 dark:bg-ios-card-dark text-gray-700 dark:text-gray-300",
              )}>
              <svg
                className='w-4 h-4'
                fill='none'
                viewBox='0 0 24 24'
                strokeWidth={1.5}
                stroke='currentColor'>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5'
                />
              </svg>
              {sortBy === "date"
                ? "Newest"
                : sortBy === "rating"
                  ? "My rating"
                  : "IMDB"}
              <svg
                className={cn(
                  "w-3 h-3 transition-transform",
                  showSortDropdown && "rotate-180",
                )}
                fill='none'
                viewBox='0 0 24 24'
                strokeWidth={2}
                stroke='currentColor'>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='M19.5 8.25l-7.5 7.5-7.5-7.5'
                />
              </svg>
            </button>
            {showSortDropdown && (
              <>
                <div
                  className='fixed inset-0 z-40'
                  onClick={() => setShowSortDropdown(false)}
                />
                <div className='absolute top-full left-0 mt-1 bg-white dark:bg-ios-card-dark rounded-xl shadow-lg overflow-hidden z-50 min-w-[120px]'>
                  {[
                    { value: "date", label: "Newest" },
                    { value: "rating", label: "My rating" },
                    { value: "imdb", label: "IMDB" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setSortBy(option.value as typeof sortBy);
                        setShowSortDropdown(false);
                      }}
                      className={cn(
                        "w-full px-4 py-2.5 text-left text-[13px] font-medium",
                        sortBy === option.value
                          ? "bg-ios-blue/10 text-ios-blue"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700",
                      )}>
                      {option.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          {/* Heart button for favorites */}
          <button
            onClick={() => {
              if (showFavorites) {
                setShowFavorites(false);
              } else {
                setShowFavorites(true);
                setShowWatchlist(false);
              }
            }}
            className={cn(
              "px-3 py-2 rounded-full text-[13px] font-medium flex items-center gap-1.5",
              showFavorites
                ? "bg-red-500 text-white"
                : "bg-white/80 dark:bg-ios-card-dark text-gray-700 dark:text-gray-300",
            )}>
            <svg
              viewBox='0 0 24 24'
              className='w-4 h-4'
              fill={showFavorites ? "currentColor" : "none"}
              stroke='currentColor'
              strokeWidth='2'>
              <path d='M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z' />
            </svg>
          </button>
          {/* Watchlist button */}
          <button
            onClick={() => {
              if (showWatchlist) {
                setShowWatchlist(false);
              } else {
                setShowWatchlist(true);
                setShowFavorites(false);
              }
            }}
            className={cn(
              "px-3 py-2 rounded-full text-[13px] font-medium flex items-center gap-1.5",
              showWatchlist
                ? "bg-amber-500 text-white"
                : "bg-white/80 dark:bg-ios-card-dark text-gray-700 dark:text-gray-300",
            )}>
            <svg
              viewBox='0 0 24 24'
              className='w-4 h-4'
              fill='none'
              stroke='currentColor'
              strokeWidth='2'>
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                d='M12 6v6l4 2'
              />
              <circle cx='12' cy='12' r='10' />
            </svg>
          </button>
        </div>
        <button
          onClick={() =>
            handleViewModeChange(viewMode === "grid" ? "list" : "grid")
          }
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

      {/* Star rating filter when showing favorites */}
      {showFavorites && (
        <div className='px-4 mb-3'>
          <div className='bg-white/80 dark:bg-ios-card-dark rounded-xl p-3'>
            <p className='text-sm text-gray-500 dark:text-gray-400 mb-2'>
              Minimum rating from favorites:
            </p>
            <MinRatingFilter
              value={minStarRating}
              onChange={setMinStarRating}
            />
            {favoriteFriends.length === 0 && (
              <p className='text-xs text-gray-400 mt-2'>
                No favorites yet. Add favorites from the Friends tab.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Add to Watchlist Search - shown above watchlist items */}
      {showWatchlist && !isViewingOther && (
        <div className='px-4 mb-4'>
          <MediaSearch
            type={activeTab === "movies" ? "movie" : "series"}
            onSelect={handleAddToWatchlist}
            placeholder={`Add ${activeTab === "movies" ? "movie" : "series"} to watchlist...`}
            clearOnSelect
          />
        </div>
      )}

      <main className='px-4'>
        {loadingFavorites ? (
          <div className='text-center py-12'>
            <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-ios-blue mx-auto mb-4'></div>
            <p className='text-gray-500'>Loading favorites...</p>
          </div>
        ) : mediaEntries.length === 0 ? (
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
              {showWatchlist
                ? `No ${activeTab === "movies" ? "movies" : "series"} in watchlist`
                : showFavorites
                  ? favoriteFriends.length === 0
                    ? "No favorites yet. Add favorites from the Friends tab."
                    : `No ${
                        activeTab === "movies" ? "movies" : "series"
                      } from favorites with rating ${minStarRating}+`
                  : `No ${activeTab === "movies" ? "movies" : "series"} found`}
            </p>
          </div>
        ) : viewMode === "grid" ? (
          <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2'>
            {mediaEntries.map((entry, index) => (
              <MediaCard
                key={entry.id}
                entry={entry}
                onRate={handleRate}
                onUpdatePoster={handleUpdatePoster}
                onMarkAsWatched={handleMarkAsWatched}
                onRemoveFromWatchlist={handleRemoveFromWatchlist}
                isWatchlistView={showWatchlist}
                layout='grid'
              />
            ))}
          </div>
        ) : (
          <div className='space-y-3'>
            {mediaEntries.map((entry, index) => (
              <MediaCard
                key={entry.id}
                entry={entry}
                onRate={handleRate}
                onUpdatePoster={handleUpdatePoster}
                onMarkAsWatched={handleMarkAsWatched}
                onRemoveFromWatchlist={handleRemoveFromWatchlist}
                isWatchlistView={showWatchlist}
                layout='list'
                isDraggable={showWatchlist && !isViewingOther}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragEnd={handleDragEnd}
                onDragEnter={(e) => handleDragEnter(e, index)}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
                isDragging={draggedIndex === index}
                isDragOver={dragOverIndex === index}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
