"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import {
  EntryForm,
  DateNavigator,
  SearchEntries,
  LoadingState,
  Avatar,
  NotificationBell,
} from "@/components";
import { addDays, formatDate } from "@/lib/utils";
import { IOSModal } from "@/components/ios";
import { WeatherForecastPopup } from "@/components/WeatherForecastPopup";
import {
  fetchWeather,
  getStoredLocation,
  getWeatherCondition,
  WeatherData,
} from "@/lib/weather";
import {
  getFavoriteTeam,
  getMatchResult,
  isMatchLive,
  loadSettingsFromSupabase,
  FavoriteTeamConfig,
  FootballFixture,
  loadAllTeamData,
} from "@/lib/football";
import { FootballPopup } from "@/components/FootballPopup";
import {
  getNewsSources,
  fetchAllNews,
  fetchNewsForSource,
  formatSourceName,
  loadNewsFromSupabase,
  resetHiddenHeadlines,
  getCachedAllNews,
  getNewsVisible,
  markHeadlineRead,
  getReadHeadlines,
  resetReadHeadlines,
  clearCacheForSource,
  NewsItem,
} from "@/lib/news";

// News card with slide-to-mark-as-read
function NewsCard({
  item,
  onMarkRead,
}: {
  item: NewsItem;
  onMarkRead: () => void;
}) {
  const sliderRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const [sliderX, setSliderX] = useState(0);
  const [trackWidth, setTrackWidth] = useState(0);
  const isDragging = useRef(false);

  const thumbSize = 22;
  const maxSlide = trackWidth - thumbSize - 6; // 6 for padding

  return (
    <div className='rounded-xl overflow-hidden bg-white dark:bg-ios-card-dark shadow-sm flex flex-col min-w-0'>
      <a
        href={item.link}
        target='_blank'
        rel='noopener noreferrer'
        className='block active:bg-gray-50 dark:active:bg-gray-800 flex-1'>
        {item.image && (
          <img
            src={item.image}
            alt=''
            className='w-full h-36 object-cover bg-gray-200 dark:bg-gray-700'
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        )}
        <div className='px-3 py-2.5'>
          <p className='text-[14px] font-semibold text-gray-900 dark:text-white leading-snug line-clamp-3 break-words'>
            {item.title}
          </p>
          {item.pubDate && (
            <p className='text-[11px] text-gray-400 dark:text-gray-500 mt-1'>
              {new Date(item.pubDate).toLocaleDateString("nb-NO", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>
      </a>
      {/* Slide to mark as read */}
      <div className='px-2.5 pb-2 pt-0.5'>
        <div
          ref={trackRef}
          className='relative h-7 rounded-full bg-gray-50 dark:bg-gray-800/50 overflow-hidden'
          onTouchStart={(e) => {
            e.stopPropagation();
          }}>
          {/* Background label */}
          <div className='absolute inset-0 flex items-center justify-center pointer-events-none'>
            <span
              className='text-[10px] font-medium tracking-wide uppercase transition-opacity duration-150'
              style={{
                color: sliderX > maxSlide * 0.3 ? "transparent" : undefined,
              }}>
              <span className='text-gray-300 dark:text-gray-600'>
                slide → read
              </span>
            </span>
          </div>
          {/* Green fill */}
          <div
            className='absolute left-0 top-0 bottom-0 rounded-full bg-ios-green/10 dark:bg-ios-green/15 transition-all duration-75'
            style={{ width: sliderX + thumbSize / 2 + 2 }}
          />
          {/* Thumb */}
          <div
            ref={sliderRef}
            className='absolute top-[3px] left-[3px] w-[22px] h-[22px] rounded-full bg-gray-200 dark:bg-gray-600 shadow-sm flex items-center justify-center cursor-grab active:cursor-grabbing select-none touch-none'
            style={{
              transform: `translateX(${sliderX}px)`,
              transition: isDragging.current ? "none" : "transform 0.25s ease",
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              isDragging.current = true;
              startX.current = e.touches[0].clientX - sliderX;
              if (trackRef.current) {
                setTrackWidth(trackRef.current.offsetWidth);
              }
            }}
            onTouchMove={(e) => {
              if (!isDragging.current) return;
              e.stopPropagation();
              e.preventDefault();
              const x = e.touches[0].clientX - startX.current;
              const max =
                (trackRef.current?.offsetWidth || 200) - thumbSize - 6;
              setSliderX(Math.max(0, Math.min(x, max)));
            }}
            onTouchEnd={(e) => {
              e.stopPropagation();
              isDragging.current = false;
              const max =
                (trackRef.current?.offsetWidth || 200) - thumbSize - 6;
              if (sliderX >= max * 0.85) {
                setSliderX(max);
                setTimeout(onMarkRead, 200);
              } else {
                setSliderX(0);
              }
            }}>
            <svg
              className='w-3 h-3 text-gray-400 dark:text-gray-400'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
              strokeWidth={2.5}>
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                d='M5 13l4 4L19 7'
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

// Get time-based greeting
function getGreeting(): string {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 9) return "Good morning,";
  if (hour >= 9 && hour < 12) return "Good day,";
  if (hour >= 12 && hour < 14) return "Good afternoon,";
  if (hour >= 14 && hour < 17) return "Hey there,";
  if (hour >= 17 && hour < 20) return "Good evening,";
  if (hour >= 20 && hour < 23) return "Evening,";
  return "Good night,"; // 23:00 - 04:59
}

export default function HomePage() {
  const {
    selectedDate,
    setSelectedDate,
    loadEntriesForDateRange,
    entries,
    isLoading,
    viewingUser,
    setViewingUser,
    isViewingOther,
    lockedDays,
  } = useApp();
  const { user, profile } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);

  // View mode state
  const [viewMode, setViewMode] = useState<"list" | "icons">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("entryform-viewmode");
      return saved === "icons" ? "icons" : "list";
    }
    return "list";
  });

  const handleViewModeChange = (mode: "list" | "icons") => {
    setViewMode(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("entryform-viewmode", mode);
    }
  };

  // Streak popup state
  const [showStreakPopup, setShowStreakPopup] = useState(false);
  const [unlockedPage, setUnlockedPage] = useState(0);
  const UNLOCKED_PER_PAGE = 5;

  // Name display variant for header card
  const [nameVariant, setNameVariant] = useState(0);

  // Generate name combinations: first only, first+last, first+2nd, first+3rd, etc., then full
  function getNameVariants(fullName: string): string[] {
    const parts = fullName.split(" ");
    if (parts.length <= 1) return [fullName];
    const variants: string[] = [parts[0]]; // first name only
    if (parts.length === 2) {
      variants.push(fullName); // first + last (= full)
      return variants;
    }
    // 3+ names: first+last, first+2nd, first+3rd, ..., first+2nd+last, full
    variants.push(`${parts[0]} ${parts[parts.length - 1]}`); // first + last
    for (let i = 1; i < parts.length - 1; i++) {
      variants.push(`${parts[0]} ${parts[i]}`); // first + middle
    }
    if (parts.length >= 4) {
      variants.push(`${parts[0]} ${parts[1]} ${parts[parts.length - 1]}`); // first + 2nd + last
    }
    variants.push(fullName); // full name
    return variants;
  }

  // Weather state
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [showForecast, setShowForecast] = useState(false);

  // Football state
  const [favoriteTeam, setFavoriteTeamLocal] =
    useState<FavoriteTeamConfig | null>(null);
  const [nextFixture, setNextFixture] = useState<FootballFixture | null>(null);
  const [liveFixture, setLiveFixture] = useState<FootballFixture | null>(null);
  const [seasonFixtures, setSeasonFixtures] = useState<FootballFixture[]>([]);
  const [showFootball, setShowFootball] = useState(false);

  // News state
  const [newsData, setNewsData] = useState<Record<string, NewsItem[]>>({});
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsVisible, setNewsVisibleLocal] = useState(true);
  const newsHasSources = useRef(false);
  const [newsFullscreen, setNewsFullscreen] = useState(false);
  const [readHeadlines, setReadHeadlines] = useState<
    Record<string, Set<string>>
  >({});

  // Load read headlines when news data changes
  useEffect(() => {
    const readMap: Record<string, Set<string>> = {};
    for (const url of Object.keys(newsData)) {
      readMap[url] = getReadHeadlines(url);
    }
    setReadHeadlines(readMap);
  }, [newsData]);

  // Lock body scroll when fullscreen news is open
  useEffect(() => {
    if (newsFullscreen) {
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.width = "100%";
      document.body.style.top = `-${window.scrollY}px`;
    } else {
      const scrollY = document.body.style.top;
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
      document.body.style.top = "";
      window.scrollTo(0, parseInt(scrollY || "0") * -1);
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
      document.body.style.top = "";
    };
  }, [newsFullscreen]);

  const handleMarkRead = useCallback(
    (sourceUrl: string, articleLink: string) => {
      markHeadlineRead(sourceUrl, articleLink);
      setReadHeadlines((prev) => {
        const updated = { ...prev };
        const set = new Set(prev[sourceUrl] || []);
        set.add(articleLink);
        updated[sourceUrl] = set;
        return updated;
      });
    },
    [],
  );

  // Load favorite team and next fixture
  useEffect(() => {
    const loadFootball = async () => {
      // Load Supabase settings in parallel with checking local storage
      loadSettingsFromSupabase().catch(() => {});

      const fav = getFavoriteTeam();
      setFavoriteTeamLocal(fav);
      if (!fav) return;

      // Single bulk call gets everything
      const data = await loadAllTeamData(fav.team.id);
      setNextFixture(data.nextFixture);
      setLiveFixture(data.liveFixture);
      setSeasonFixtures(data.allFixtures);
    };

    loadFootball();

    // Listen for favorite team changes
    const handleUpdate = () => loadFootball();
    window.addEventListener("favoriteTeamUpdated", handleUpdate);

    // Refresh every 5 minutes
    const interval = setInterval(loadFootball, 5 * 60 * 1000);

    return () => {
      window.removeEventListener("favoriteTeamUpdated", handleUpdate);
      clearInterval(interval);
    };
  }, []);

  // Load news on mount and when config changes
  useEffect(() => {
    const loadNews = async () => {
      // Check visibility
      setNewsVisibleLocal(getNewsVisible());

      // Show cached data instantly
      const cached = getCachedAllNews();
      if (Object.keys(cached).length > 0) {
        setNewsData(cached);
        setNewsLoading(false);
      }

      // Check if there are sources configured
      const localSources = getNewsSources();
      newsHasSources.current = localSources.length > 0;

      // Load from Supabase (may add new sources)
      await loadNewsFromSupabase();
      const sources = getNewsSources();
      newsHasSources.current = sources.length > 0;

      if (sources.length === 0) {
        setNewsData({});
        setNewsLoading(false);
        return;
      }

      // Fetch fresh data in background
      const data = await fetchAllNews();
      setNewsData(data);
      setNewsLoading(false);
    };

    loadNews();

    const handleConfigUpdate = () => loadNews();
    window.addEventListener("newsConfigUpdated", handleConfigUpdate);

    // Refresh every 15 minutes
    const interval = setInterval(loadNews, 15 * 60 * 1000);

    return () => {
      window.removeEventListener("newsConfigUpdated", handleConfigUpdate);
      clearInterval(interval);
    };
  }, []);

  // Fetch weather on mount and when location changes
  useEffect(() => {
    const loadWeather = async () => {
      const location = getStoredLocation();
      if (!location) {
        setLocationName(null);
        return;
      }

      setLocationName(location.name);
      const weatherData = await fetchWeather(
        location.latitude,
        location.longitude,
      );
      if (weatherData) {
        setWeather(weatherData);
      }
    };

    loadWeather();

    // Refresh weather every 30 minutes
    const interval = setInterval(loadWeather, 30 * 60 * 1000);

    // Listen for location changes
    const handleLocationChange = () => loadWeather();
    window.addEventListener("locationUpdated", handleLocationChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener("locationUpdated", handleLocationChange);
    };
  }, []);

  // Calculate unlocked days from the first locked day to yesterday
  const unlockedDays = useMemo(() => {
    if (!lockedDays || lockedDays.length === 0) return [];

    // Find the earliest locked day
    const sortedLockedDays = [...lockedDays].sort();
    const firstLockedDate = sortedLockedDays[0];
    const lockedSet = new Set(lockedDays);

    // Get yesterday as the end date
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Build list of unlocked days from first locked day to yesterday
    const unlocked: string[] = [];
    const currentDate = new Date(firstLockedDate);

    while (currentDate <= yesterday) {
      const dateStr = formatDate(currentDate);
      if (!lockedSet.has(dateStr)) {
        unlocked.push(dateStr);
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Sort descending (most recent first)
    return unlocked.sort().reverse();
  }, [lockedDays]);

  // Load entries for a wide range to support media date updates
  useEffect(() => {
    const start = "2000-01-01";
    const end = addDays(selectedDate, 365);
    loadEntriesForDateRange(start, end);
  }, [selectedDate, loadEntriesForDateRange]);

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <div ref={scrollRef} className='overflow-y-auto'>
      {/* Viewing Another User Banner */}
      {isViewingOther && viewingUser && (
        <div className='bg-ios-blue text-white px-4 py-3 flex items-center justify-between'>
          <div>
            <p className='text-sm font-medium'>Viewing their data</p>
            <p className='text-xs opacity-80'>
              {viewingUser.fullName || viewingUser.email}
            </p>
          </div>
          <button
            onClick={() => setViewingUser(null)}
            className='px-3 py-1.5 bg-white/20 rounded-full text-[13px] font-medium hover:bg-white/30 transition-colors'>
            Back to my data
          </button>
        </div>
      )}

      {/* Header with Search */}
      <div className={user ? "pt-8 pb-4" : "pt-6 pb-4"}>
        {/* Full-width greeting header - iOS style */}
        {user && (
          <div className='px-4 mb-3'>
            {/* Location label - above card, right-aligned */}
            {weather && !isViewingOther && locationName && (
              <div
                className='flex justify-end pr-1 mb-1 cursor-pointer active:opacity-60 transition-opacity'
                onClick={() => setShowForecast(true)}>
                <span className='text-[11px] text-gray-400 dark:text-gray-500 font-medium'>
                  {locationName}
                </span>
              </div>
            )}
            <div
              onClick={() => {
                const fullName = isViewingOther
                  ? viewingUser?.fullName || ""
                  : profile?.fullName || "";
                const variants = getNameVariants(fullName);
                setNameVariant((prev) => (prev + 1) % variants.length);
              }}
              className='relative overflow-hidden rounded-2xl liquid-glass p-5 cursor-pointer active:opacity-90 transition-opacity'>
              {/* Weather emoji - large background on right side */}
              {weather && !isViewingOther && locationName && (
                <div className='absolute right-7 top-1/2 -translate-y-1/2 pointer-events-none select-none'>
                  <span className='leading-none text-[56px]'>
                    {
                      getWeatherCondition(weather.weatherCode, weather.isDay)
                        .icon
                    }
                  </span>
                </div>
              )}

              {/* Temperature - top right inside card (tap to open forecast) */}
              {weather && !isViewingOther && locationName && (
                <div
                  className='absolute top-2 right-3 z-10 cursor-pointer active:opacity-60 transition-opacity'
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowForecast(true);
                  }}>
                  <span className='text-[15px] font-semibold text-gray-500 dark:text-gray-400 leading-none'>
                    {weather.temperature}°
                  </span>
                </div>
              )}

              <div className='relative flex items-center gap-4'>
                <div
                  className={`flex-shrink-0 ${isViewingOther ? "animate-heartbeat" : ""}`}>
                  <div className='relative'>
                    <div
                      className={`relative rounded-full ring-2 ring-ios-blue/20 dark:ring-ios-blue/30 ${isViewingOther ? "ring-pink-300" : ""}`}>
                      <Avatar
                        avatar={
                          isViewingOther
                            ? viewingUser?.avatar || null
                            : profile?.avatar || null
                        }
                        size='lg'
                      />
                    </div>
                  </div>
                </div>
                <div className='flex-1 min-w-0'>
                  <p className='text-gray-500 dark:text-gray-400 text-[13px] font-medium tracking-wide'>
                    {isViewingOther ? "Viewing" : getGreeting()}
                  </p>
                  <h1 className='text-[19px] font-bold text-gray-900 dark:text-white leading-tight mt-0.5 truncate'>
                    {(() => {
                      const fullName = isViewingOther
                        ? viewingUser?.fullName || "User"
                        : profile?.fullName || "Welcome";
                      const variants = getNameVariants(fullName);
                      return variants[nameVariant % variants.length];
                    })()}
                  </h1>
                </div>
              </div>
              {/* Glass highlight — subtle shimmer across the top edge */}
              <div className='absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/80 to-transparent pointer-events-none' />
            </div>
          </div>
        )}

        {/* Football Section removed - shown as matchday activity below */}

        {/* Action buttons row */}
        <div className='px-4 pt-3 flex items-center justify-between'>
          {/* Left side - Unlocked days (no background) */}
          {user && !isViewingOther && (
            <div className='flex items-center gap-4 ml-1'>
              {/* Unlocked days button */}
              <button
                onClick={() => {
                  setUnlockedPage(0);
                  setShowStreakPopup(true);
                }}
                className={`flex items-center gap-1 transition-colors ${
                  unlockedDays.length > 0
                    ? "text-ios-orange"
                    : "text-gray-400 dark:text-gray-500"
                }`}
                title={`${unlockedDays.length} unlocked ${unlockedDays.length === 1 ? "day" : "days"}`}>
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
                <span className='text-[15px] font-semibold'>
                  {unlockedDays.length}
                </span>
              </button>
            </div>
          )}
          {/* Title or spacer when not logged in / viewing other */}
          {!user && (
            <h1 className='text-2xl font-bold text-gray-900 dark:text-white ml-1'>
              DayTracker
            </h1>
          )}
          {user && isViewingOther && <div />}

          {/* Right side - Bell, View Mode, Search */}
          <div className='flex items-center gap-1'>
            {user && <NotificationBell />}
            <button
              onClick={() =>
                handleViewModeChange(viewMode === "list" ? "icons" : "list")
              }
              className='p-2 active:opacity-60 transition-opacity'
              title={
                viewMode === "list" ? "Switch to icons" : "Switch to list"
              }>
              {viewMode === "list" ? (
                <svg
                  className='w-6 h-6 text-gray-500 dark:text-gray-400'
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
              ) : (
                <svg
                  className='w-6 h-6 text-gray-500 dark:text-gray-400'
                  fill='none'
                  viewBox='0 0 24 24'
                  strokeWidth={1.5}
                  stroke='currentColor'>
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    d='M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z'
                  />
                </svg>
              )}
            </button>
            <SearchEntries onSelectDate={setSelectedDate} />
          </div>
        </div>
      </div>

      {/* Date Navigator */}
      <div className='px-4 pt-2 pb-3'>
        <DateNavigator date={selectedDate} onChange={setSelectedDate} />
      </div>

      {/* Main Content */}
      <main className='px-4 pb-24'>
        {/* Matchday Football Activity — only fixtures on the selected date */}
        {user &&
          !isViewingOther &&
          favoriteTeam &&
          (() => {
            // Filter to fixtures matching the selected date
            const selectedDateStr = selectedDate; // already yyyy-mm-dd
            const dayFixtures = seasonFixtures.filter((f) => {
              const fDate = new Date(f.date);
              const fStr = `${fDate.getFullYear()}-${String(fDate.getMonth() + 1).padStart(2, "0")}-${String(fDate.getDate()).padStart(2, "0")}`;
              return fStr === selectedDateStr;
            });
            // Also show live fixture on today regardless
            const today = new Date();
            const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
            if (
              liveFixture &&
              isMatchLive(liveFixture) &&
              selectedDateStr === todayStr &&
              !dayFixtures.some((f) => f.id === liveFixture.id)
            ) {
              dayFixtures.push(liveFixture);
            }

            if (dayFixtures.length === 0) return null;

            // Map league names to short codes
            const leagueShort: Record<string, string> = {
              "Premier League": "PL",
              Championship: "ELC",
              "Champions League": "CL",
              Bundesliga: "BL",
              "La Liga": "LaL",
              "Serie A": "SA",
              "Ligue 1": "L1",
              Eredivisie: "ERE",
              "Primeira Liga": "PPL",
            };

            return dayFixtures.map((fixture) => {
              const isHome = fixture.teams.home.id === favoriteTeam.team.id;
              const opponent = isHome ? fixture.teams.away : fixture.teams.home;
              const live =
                liveFixture &&
                isMatchLive(liveFixture) &&
                liveFixture.id === fixture.id;
              const isFinished = ["FT", "AET", "PEN", "AWD"].includes(
                fixture.status.short,
              );
              const result = isFinished
                ? getMatchResult(fixture, favoriteTeam.team.id)
                : null;
              const league =
                leagueShort[fixture.league.name] || fixture.league.name;

              return (
                <div
                  key={fixture.id}
                  onClick={() => setShowFootball(true)}
                  className='flex items-center px-4 py-3 bg-white/80 dark:bg-ios-card-dark rounded-xl border border-gray-200/60 dark:border-gray-700/60 mb-3 active:bg-gray-100 dark:active:bg-gray-700 cursor-pointer'>
                  {/* Icon: W/D/L for played, H/A for upcoming */}
                  <div className='w-8 h-8 flex items-center justify-center mr-3 shrink-0'>
                    {live ? (
                      <div className='relative w-7 h-7 rounded-lg bg-red-500 flex items-center justify-center'>
                        <span className='text-[13px] font-bold text-white'>
                          {isHome ? "H" : "A"}
                        </span>
                        <div className='absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full animate-pulse ring-2 ring-white dark:ring-gray-900' />
                      </div>
                    ) : isFinished && result ? (
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                          result === "W"
                            ? "bg-green-500"
                            : result === "D"
                              ? "bg-amber-500"
                              : "bg-red-500"
                        }`}>
                        <span className='text-[13px] font-bold text-white'>
                          {result}
                        </span>
                      </div>
                    ) : (
                      <div className='w-7 h-7 rounded-lg bg-ios-blue flex items-center justify-center'>
                        <span className='text-[13px] font-bold text-white'>
                          {isHome ? "H" : "A"}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Opponent name */}
                  <span className='text-[17px] font-medium text-gray-900 dark:text-white shrink-0'>
                    {opponent.name}
                  </span>

                  {/* Right-aligned: league + score/time */}
                  <div className='flex items-center gap-2 ml-auto shrink-0'>
                    <span className='text-[13px] text-gray-400 dark:text-gray-500'>
                      {league}
                    </span>
                    {isFinished || live ? (
                      <span
                        className={`text-[15px] font-semibold tabular-nums ${
                          live
                            ? "text-red-500"
                            : "text-gray-500 dark:text-gray-400"
                        }`}>
                        {fixture.goals.home}–{fixture.goals.away}
                      </span>
                    ) : (
                      <span className='text-[15px] font-medium text-ios-blue'>
                        {new Date(fixture.date).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })}
                      </span>
                    )}
                  </div>
                </div>
              );
            });
          })()}

        {/* News Section */}
        {newsVisible &&
          (Object.keys(newsData).length > 0 ||
            newsHasSources.current ||
            newsLoading) && (
            <button
              onClick={() => {
                if (!newsLoading && Object.keys(newsData).length > 0) {
                  setNewsFullscreen(true);
                }
              }}
              className='mb-3 w-full flex items-center px-4 py-3 bg-white/80 dark:bg-ios-card-dark rounded-xl border border-gray-200/60 dark:border-gray-700/60 active:bg-gray-100 dark:active:bg-gray-700'>
              <div className='w-8 h-8 rounded-lg bg-ios-orange flex items-center justify-center mr-3 shrink-0'>
                <svg
                  className='w-[18px] h-[18px] text-white'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'
                  strokeWidth={2}>
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    d='M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z'
                  />
                </svg>
              </div>
              <span className='text-[17px] font-medium text-gray-900 dark:text-white'>
                News
              </span>
              {newsLoading && Object.keys(newsData).length === 0 && (
                <span className='ml-2 text-[12px] text-gray-400 dark:text-gray-500'>
                  Loading…
                </span>
              )}
              <svg
                className='w-4 h-4 text-gray-400 dark:text-gray-500 ml-auto'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
                strokeWidth={2}>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5'
                />
              </svg>
            </button>
          )}

        {/* Fullscreen News Modal */}
        {newsFullscreen && (
          <div
            className='fixed inset-0 z-50 bg-ios-bg dark:bg-ios-bg-dark overflow-y-auto overflow-x-hidden overscroll-none touch-pan-y'
            data-scrollable
            onTouchMove={(e) => e.stopPropagation()}>
            <div className='sticky top-0 z-10 bg-white/90 dark:bg-black/90 backdrop-blur-md border-b border-gray-200/60 dark:border-gray-700/60'>
              <div
                className='flex items-center justify-between px-4 py-3'
                style={{
                  paddingTop: "max(env(safe-area-inset-top, 12px), 12px)",
                }}>
                <h2 className='text-[20px] font-bold text-gray-900 dark:text-white'>
                  News
                </h2>
                <button
                  onClick={() => setNewsFullscreen(false)}
                  className='text-[17px] text-ios-blue font-medium active:opacity-60'>
                  Done
                </button>
              </div>
            </div>
            <div className='pb-8'>
              {Object.entries(newsData).map(([url, items], idx) => {
                const sourceRead = readHeadlines[url] || new Set<string>();
                const unreadItems = items.filter(
                  (item) => !sourceRead.has(item.link),
                );
                if (unreadItems.length === 0 && items.length === 0) return null;
                return (
                  <div
                    key={url}
                    className={
                      idx > 0
                        ? "mt-10 border-t-4 border-gray-300 dark:border-gray-600 pt-6"
                        : ""
                    }>
                    <div className='flex items-center justify-between px-4 pb-4'>
                      <h3 className='text-[28px] font-extrabold text-gray-900 dark:text-white tracking-tight'>
                        {formatSourceName(url)}
                      </h3>
                      <div className='flex items-center gap-2'>
                        {sourceRead.size > 0 && (
                          <button
                            onClick={() => {
                              resetReadHeadlines(url);
                              setReadHeadlines((prev) => {
                                const updated = { ...prev };
                                updated[url] = new Set();
                                return updated;
                              });
                            }}
                            className='text-[13px] text-ios-blue active:opacity-60'
                            title='Show read articles'>
                            Show read ({sourceRead.size})
                          </button>
                        )}
                        <button
                          onClick={async () => {
                            // Clear cache to force fresh fetch from source URL
                            clearCacheForSource(url);
                            resetHiddenHeadlines(url);
                            const sources = getNewsSources();
                            const source = sources.find((s) => s.url === url);
                            if (source) {
                              const fresh = await fetchNewsForSource(source);
                              setNewsData((prev) => ({
                                ...prev,
                                [url]: fresh,
                              }));
                            }
                          }}
                          className='p-1.5 text-ios-blue active:opacity-60'
                          title='Refresh from source'>
                          <svg
                            className='w-5 h-5'
                            fill='none'
                            viewBox='0 0 24 24'
                            stroke='currentColor'
                            strokeWidth={2}>
                            <path
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                    {unreadItems.length === 0 ? (
                      <p className='px-4 py-6 text-center text-[14px] text-gray-400 dark:text-gray-500'>
                        All caught up! ✓
                      </p>
                    ) : (
                      <div className='grid grid-cols-2 gap-3 px-4'>
                        {unreadItems.map((item, i) => (
                          <NewsCard
                            key={item.link || i}
                            item={item}
                            onMarkRead={() => handleMarkRead(url, item.link)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <EntryForm
          date={selectedDate}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
        />
      </main>

      {/* Unlocked Days Info Popup */}
      <IOSModal
        isOpen={showStreakPopup}
        onClose={() => setShowStreakPopup(false)}
        title='Unlocked Days'>
        <div className='py-4'>
          <div className='text-center mb-4'>
            <div className='flex justify-center mb-3'>
              <svg
                className={`w-12 h-12 ${unlockedDays.length > 0 ? "text-ios-orange" : "text-ios-green"}`}
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
                strokeWidth={1.5}>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z'
                />
              </svg>
            </div>
            <p className='text-3xl font-bold text-gray-900 dark:text-white mb-2'>
              {unlockedDays.length} {unlockedDays.length === 1 ? "day" : "days"}
            </p>
            <p className='text-gray-500 dark:text-gray-400 text-[15px] leading-relaxed'>
              {unlockedDays.length > 0
                ? "Days that haven't been locked since your first locked day."
                : "All days are locked! Great job!"}
            </p>
          </div>

          {/* List of unlocked dates */}
          {unlockedDays.length > 0 && (
            <div className='mt-4'>
              <div className='space-y-2'>
                {unlockedDays
                  .slice(
                    unlockedPage * UNLOCKED_PER_PAGE,
                    (unlockedPage + 1) * UNLOCKED_PER_PAGE,
                  )
                  .map((date) => (
                    <button
                      key={date}
                      onClick={() => {
                        setSelectedDate(date);
                        setShowStreakPopup(false);
                      }}
                      className='w-full flex items-center justify-between px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors'>
                      <span className='text-[15px] text-gray-900 dark:text-white font-medium'>
                        {new Date(date + "T12:00:00").toLocaleDateString(
                          "en-US",
                          {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          },
                        )}
                      </span>
                      <svg
                        className='w-5 h-5 text-gray-400'
                        fill='none'
                        viewBox='0 0 24 24'
                        strokeWidth={1.5}
                        stroke='currentColor'>
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          d='M8.25 4.5l7.5 7.5-7.5 7.5'
                        />
                      </svg>
                    </button>
                  ))}
              </div>

              {/* Pagination */}
              {unlockedDays.length > UNLOCKED_PER_PAGE && (
                <div className='flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700'>
                  <button
                    onClick={() => setUnlockedPage((p) => Math.max(0, p - 1))}
                    disabled={unlockedPage === 0}
                    className='px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-[14px] font-medium text-gray-600 dark:text-gray-400 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors'>
                    Previous
                  </button>
                  <span className='text-[13px] text-gray-500 dark:text-gray-400'>
                    {unlockedPage + 1} /{" "}
                    {Math.ceil(unlockedDays.length / UNLOCKED_PER_PAGE)}
                  </span>
                  <button
                    onClick={() =>
                      setUnlockedPage((p) =>
                        Math.min(
                          Math.ceil(unlockedDays.length / UNLOCKED_PER_PAGE) -
                            1,
                          p + 1,
                        ),
                      )
                    }
                    disabled={
                      unlockedPage >=
                      Math.ceil(unlockedDays.length / UNLOCKED_PER_PAGE) - 1
                    }
                    className='px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-[14px] font-medium text-gray-600 dark:text-gray-400 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors'>
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </IOSModal>

      {/* Weather Forecast Popup */}
      {locationName && (
        <WeatherForecastPopup
          isOpen={showForecast}
          onClose={() => setShowForecast(false)}
          locationName={locationName}
        />
      )}

      {/* Football Popup */}
      {favoriteTeam && (
        <FootballPopup
          isOpen={showFootball}
          onClose={() => setShowFootball(false)}
        />
      )}
    </div>
  );
}
