"use client";

import { useState, useEffect, useCallback } from "react";
import {
  searchTMDb,
  TMDbMediaResult,
  getTMDbPosterUrl,
  isTMDbConfigured,
} from "@/lib/tmdb";
import { cn } from "@/lib/utils";
import { Suggestion } from "@/types";

interface MediaSearchProps {
  type: "movie" | "series";
  onSelect: (
    title: string,
    imdbId: string,
    year: string,
    poster: string,
    rating?: string
  ) => void;
  onSelectPrevious?: (value: string) => void;
  placeholder?: string;
  initialValue?: string;
  suggestions?: Suggestion[];
}

export function MediaSearch({
  type,
  onSelect,
  onSelectPrevious,
  placeholder,
  initialValue = "",
  suggestions = [],
}: MediaSearchProps) {
  const [query, setQuery] = useState(initialValue);
  const [results, setResults] = useState<TMDbMediaResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isConfigured, setIsConfigured] = useState(true);

  useEffect(() => {
    setIsConfigured(isTMDbConfigured());
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      const searchResults = await searchTMDb(query, type);
      setResults(searchResults);
      setIsLoading(false);
      setShowResults(true);
    }, 400);

    return () => clearTimeout(timer);
  }, [query, type]);

  const handleSelect = useCallback(
    (result: TMDbMediaResult) => {
      const titleWithYear = `${result.Title} (${result.Year})`;
      setQuery(titleWithYear);
      setShowResults(false);
      onSelect(
        result.Title,
        result.imdbID,
        result.Year,
        result.Poster,
        result.Rating
      );
    },
    [onSelect]
  );

  if (!isConfigured) {
    return (
      <div className='text-sm text-amber-600 dark:text-amber-400 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg'>
        <p className='font-medium'>TMDb API not configured</p>
        <p className='text-xs mt-1'>
          Add{" "}
          <code className='bg-amber-100 dark:bg-amber-800 px-1 rounded'>
            NEXT_PUBLIC_TMDB_API_KEY
          </code>{" "}
          to .env.local
        </p>
        <a
          href='https://www.themoviedb.org/settings/api'
          target='_blank'
          rel='noopener noreferrer'
          className='text-xs text-amber-700 dark:text-amber-300 underline mt-1 inline-block'>
          Get free API key here →
        </a>
      </div>
    );
  }

  return (
    <div className='relative'>
      <div className='relative'>
        <input
          type='text'
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowResults(true);
            setShowSuggestions(true);
          }}
          onFocus={() => {
            if (results.length > 0) setShowResults(true);
            if (!query.trim() && suggestions.length > 0) setShowSuggestions(true);
          }}
          onBlur={() => setTimeout(() => {
            setShowResults(false);
            setShowSuggestions(false);
          }, 200)}
          placeholder={
            placeholder ||
            `Search for ${type === "movie" ? "movie" : "TV series"}...`
          }
          className={cn(
            "w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600",
            "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100",
            "focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent",
            "placeholder:text-gray-400"
          )}
        />
        {isLoading && (
          <div className='absolute right-3 top-1/2 -translate-y-1/2'>
            <div className='w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin' />
          </div>
        )}
      </div>

      {/* Previously watched dropdown - show when focused and not searching */}
      {showSuggestions && !query.trim() && suggestions.length > 0 && (
        <div
          className={cn(
            "absolute z-50 mt-1 w-full max-h-64 overflow-auto",
            "bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700"
          )}>
          <div className='px-3 py-2 text-[13px] text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700'>
            Previously watched
          </div>
          {suggestions.slice(0, 10).map((sugg) => (
            <button
              key={sugg.value}
              onClick={() => {
                if (onSelectPrevious) {
                  onSelectPrevious(sugg.value);
                }
                setQuery("");
                setShowSuggestions(false);
              }}
              className={cn(
                "w-full px-3 py-2.5 text-left text-[15px]",
                "hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors",
                "border-b border-gray-100 dark:border-gray-700 last:border-b-0",
                "flex items-center justify-between"
              )}>
              <span className='text-gray-900 dark:text-gray-100 truncate'>{sugg.value}</span>
              <span className='text-[13px] text-gray-400 dark:text-gray-500 ml-2 shrink-0'>({sugg.count}×)</span>
            </button>
          ))}
        </div>
      )}

      {/* Filtered suggestions when typing - show matches from previously watched */}
      {showSuggestions && query.trim() && suggestions.length > 0 && results.length === 0 && !isLoading && (() => {
        const filtered = suggestions.filter(s => 
          s.value.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 5);
        if (filtered.length === 0) return null;
        return (
          <div
            className={cn(
              "absolute z-50 mt-1 w-full max-h-64 overflow-auto",
              "bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700"
            )}>
            {filtered.map((sugg) => (
              <button
                key={sugg.value}
                onClick={() => {
                  if (onSelectPrevious) {
                    onSelectPrevious(sugg.value);
                  }
                  setQuery("");
                  setShowSuggestions(false);
                }}
                className={cn(
                  "w-full px-3 py-2.5 text-left text-[15px]",
                  "hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors",
                  "border-b border-gray-100 dark:border-gray-700 last:border-b-0",
                  "flex items-center justify-between"
                )}>
                <span className='text-gray-900 dark:text-gray-100 truncate'>{sugg.value}</span>
                <span className='text-[13px] text-gray-400 dark:text-gray-500 ml-2 shrink-0'>({sugg.count}×)</span>
              </button>
            ))}
          </div>
        );
      })()}

      {/* Search Results Dropdown */}
      {showResults && results.length > 0 && (
        <div
          className={cn(
            "absolute z-50 mt-1 w-full max-h-80 overflow-auto",
            "bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700"
          )}>
          {results
            .filter(
              (result, index, self) =>
                index === self.findIndex((r) => r.imdbID === result.imdbID)
            )
            .map((result) => (
              <button
                key={result.imdbID}
                onClick={() => handleSelect(result)}
                className={cn(
                  "w-full flex items-center gap-3 p-2 text-left",
                  "hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors",
                  "border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                )}>
                {/* Poster thumbnail */}
                <img
                  src={getTMDbPosterUrl(result.Poster)}
                  alt={result.Title}
                  className='w-10 h-14 object-cover rounded-md bg-gray-200 dark:bg-gray-700 flex-shrink-0'
                />
                <div className='flex-1 min-w-0'>
                  <p className='font-medium text-gray-900 dark:text-gray-100 truncate'>
                    {result.Title}
                  </p>
                  <p className='text-sm text-gray-500 dark:text-gray-400'>
                    {result.Year} •{" "}
                    {result.Type === "movie" ? "Movie" : "TV Series"}
                    {result.Rating !== "N/A" && ` • ⭐ ${result.Rating}`}
                  </p>
                </div>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

// Component to display media info card
interface MediaInfoCardProps {
  title: string;
  year?: string;
  poster?: string;
  imdbId?: string;
  compact?: boolean;
}

export function MediaInfoCard({
  title,
  year,
  poster,
  imdbId,
  compact = false,
}: MediaInfoCardProps) {
  const imdbUrl = imdbId ? `https://www.imdb.com/title/${imdbId}` : null;

  if (compact) {
    return (
      <div className='flex items-center gap-2'>
        {poster && poster !== "N/A" && (
          <img
            src={poster}
            alt={title}
            className='w-8 h-12 object-cover rounded shadow-sm'
          />
        )}
        <div className='flex-1 min-w-0'>
          <p className='text-sm font-medium text-gray-800 dark:text-gray-200 truncate'>
            {title}
          </p>
          {year && (
            <p className='text-xs text-gray-500 dark:text-gray-400'>{year}</p>
          )}
        </div>
        {imdbUrl && (
          <a
            href={imdbUrl}
            target='_blank'
            rel='noopener noreferrer'
            className='text-amber-500 hover:text-amber-600 p-1'
            title='Open on IMDB'>
            <svg className='w-4 h-4' viewBox='0 0 24 24' fill='currentColor'>
              <path d='M14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7zm-2 16H5V5h7V3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7h-7z' />
            </svg>
          </a>
        )}
      </div>
    );
  }

  return (
    <div className='flex gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl'>
      {poster && poster !== "N/A" ? (
        <img
          src={poster}
          alt={title}
          className='w-16 h-24 object-cover rounded-lg shadow-md'
        />
      ) : (
        <div className='w-16 h-24 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center'>
          <svg
            className='w-8 h-8 text-gray-400'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'>
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={1.5}
              d='M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z'
            />
          </svg>
        </div>
      )}
      <div className='flex-1'>
        <h4 className='font-semibold text-gray-900 dark:text-gray-100'>
          {title}
        </h4>
        {year && (
          <p className='text-sm text-gray-500 dark:text-gray-400'>{year}</p>
        )}
        {imdbUrl && (
          <a
            href={imdbUrl}
            target='_blank'
            rel='noopener noreferrer'
            className='inline-flex items-center gap-1 mt-2 text-sm text-amber-600 dark:text-amber-400 hover:underline'>
            <span>View on IMDB</span>
            <svg className='w-3 h-3' viewBox='0 0 24 24' fill='currentColor'>
              <path d='M14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7zm-2 16H5V5h7V3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7h-7z' />
            </svg>
          </a>
        )}
      </div>
    </div>
  );
}
