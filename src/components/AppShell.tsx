"use client";

import { ReactNode, useState, useEffect, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { IOSTabBar } from "./ios";
import { useLanguage } from "@/context/LanguageContext";
import { SplashScreen } from "./SplashScreen";

// Subtle background logo component
function BackgroundLogo() {
  return (
    <div className='fixed inset-0 pointer-events-none overflow-hidden z-0'>
      <svg
        className='absolute -bottom-20 -right-20 w-[140vw] h-[140vw] max-w-[800px] max-h-[800px] opacity-[0.04] dark:opacity-[0.06] rotate-12'
        viewBox='0 0 512 512'
        fill='none'
        xmlns='http://www.w3.org/2000/svg'>
        {/* Stylized "D" shape */}
        <path
          d='M160 120 L160 392 L280 392 C360 392 420 320 420 256 C420 192 360 120 280 120 L160 120 Z'
          fill='none'
          stroke='currentColor'
          strokeWidth='32'
          strokeLinecap='round'
          strokeLinejoin='round'
          className='text-gray-900 dark:text-white'
        />

        {/* Timeline dots inside the D */}
        <circle
          cx='220'
          cy='200'
          r='20'
          fill='currentColor'
          className='text-gray-900 dark:text-white'
        />
        <circle
          cx='220'
          cy='256'
          r='20'
          fill='currentColor'
          className='text-gray-900 dark:text-white'
        />
        <circle
          cx='220'
          cy='312'
          r='20'
          fill='currentColor'
          className='text-gray-900 dark:text-white'
        />

        {/* Connecting lines */}
        <line
          x1='240'
          y1='200'
          x2='320'
          y2='200'
          stroke='currentColor'
          strokeWidth='12'
          strokeLinecap='round'
          className='text-gray-900 dark:text-white'
        />
        <line
          x1='240'
          y1='256'
          x2='340'
          y2='256'
          stroke='currentColor'
          strokeWidth='12'
          strokeLinecap='round'
          className='text-gray-900 dark:text-white'
        />
        <line
          x1='240'
          y1='312'
          x2='300'
          y2='312'
          stroke='currentColor'
          strokeWidth='12'
          strokeLinecap='round'
          className='text-gray-900 dark:text-white'
        />
      </svg>
    </div>
  );
}

// Tab bar icons as SVGs
const TodayIcon = ({ filled = false }: { filled?: boolean }) => (
  <svg
    viewBox='0 0 24 24'
    fill={filled ? "currentColor" : "none"}
    stroke='currentColor'
    strokeWidth={filled ? 0 : 1.5}
    className='w-full h-full'>
    {filled ? (
      <path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z' />
    ) : (
      <>
        <circle cx='12' cy='12' r='9' />
        <path d='M12 7v5l3 3' strokeLinecap='round' />
      </>
    )}
  </svg>
);

const MoviesIcon = ({ filled = false }: { filled?: boolean }) => (
  <svg
    viewBox='0 0 24 24'
    fill={filled ? "currentColor" : "none"}
    stroke='currentColor'
    strokeWidth={filled ? 0 : 1.5}
    className='w-full h-full'>
    {filled ? (
      <path d='M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z' />
    ) : (
      <>
        <rect x='2' y='4' width='20' height='16' rx='2' />
        <path d='M7 4v16M17 4v16M2 9h5M17 9h5M2 15h5M17 15h5' />
      </>
    )}
  </svg>
);

const StatsIcon = ({ filled = false }: { filled?: boolean }) => (
  <svg
    viewBox='0 0 24 24'
    fill={filled ? "currentColor" : "none"}
    stroke='currentColor'
    strokeWidth={filled ? 0 : 1.5}
    className='w-full h-full'>
    {filled ? (
      <path d='M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z' />
    ) : (
      <>
        <path d='M4 20h16' strokeLinecap='round' />
        <rect x='4' y='10' width='4' height='10' rx='1' />
        <rect x='10' y='6' width='4' height='14' rx='1' />
        <rect x='16' y='13' width='4' height='7' rx='1' />
      </>
    )}
  </svg>
);

const SettingsIcon = ({ filled = false }: { filled?: boolean }) => (
  <svg
    viewBox='0 0 24 24'
    fill={filled ? "currentColor" : "none"}
    stroke={filled ? "none" : "currentColor"}
    strokeWidth={filled ? 0 : 1.5}
    className='w-full h-full'>
    {filled ? (
      <path d='M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z' />
    ) : (
      <path d='M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z' />
    )}
  </svg>
);

interface AppShellProps {
  children: ReactNode;
}

const TABS = ["/", "/movies-tv", "/stats", "/settings"];

export function AppShell({ children }: AppShellProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const [showSplash, setShowSplash] = useState(true);
  const [hasSeenSplash, setHasSeenSplash] = useState(false);

  // Swipe handling
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleSwipe = useCallback(
    (direction: "left" | "right") => {
      const currentIndex = TABS.indexOf(pathname);
      if (currentIndex === -1) return;

      if (direction === "left" && currentIndex < TABS.length - 1) {
        router.push(TABS[currentIndex + 1]);
      } else if (direction === "right" && currentIndex > 0) {
        router.push(TABS[currentIndex - 1]);
      }
    },
    [pathname, router]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (touchStartX.current === null || touchStartY.current === null) return;

      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;

      const deltaX = touchEndX - touchStartX.current;
      const deltaY = touchEndY - touchStartY.current;

      // Only trigger swipe if horizontal movement is significantly greater than vertical
      // and the swipe is at least 50px (reduced from 80px for easier swiping)
      const minSwipeDistance = 50;

      if (
        Math.abs(deltaX) > Math.abs(deltaY) * 1.5 &&
        Math.abs(deltaX) > minSwipeDistance
      ) {
        if (deltaX > 0) {
          handleSwipe("right");
        } else {
          handleSwipe("left");
        }
      }

      touchStartX.current = null;
      touchStartY.current = null;
    };

    container.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleSwipe]);

  useEffect(() => {
    // Check if user has seen splash before in this session
    const seen = sessionStorage.getItem("hasSeenSplash");
    if (seen) {
      setShowSplash(false);
      setHasSeenSplash(true);
    }
  }, []);

  const handleSplashComplete = () => {
    sessionStorage.setItem("hasSeenSplash", "true");
    setShowSplash(false);
    setHasSeenSplash(true);
  };

  const tabItems = [
    {
      href: "/",
      label: t("tab.today"),
      icon: <TodayIcon />,
      activeIcon: <TodayIcon filled />,
    },
    {
      href: "/movies-tv",
      label: t("tab.moviesTv"),
      icon: <MoviesIcon />,
      activeIcon: <MoviesIcon filled />,
    },
    {
      href: "/stats",
      label: t("tab.statistics"),
      icon: <StatsIcon />,
      activeIcon: <StatsIcon filled />,
    },
    {
      href: "/settings",
      label: t("tab.settings"),
      icon: <SettingsIcon />,
      activeIcon: <SettingsIcon filled />,
    },
  ];

  return (
    <div
      ref={containerRef}
      className='min-h-screen bg-ios-bg dark:bg-ios-bg-dark relative'>
      {showSplash && !hasSeenSplash && (
        <SplashScreen onComplete={handleSplashComplete} />
      )}
      <BackgroundLogo />
      <main className='pb-20 relative z-10'>{children}</main>
      <IOSTabBar items={tabItems} />
    </div>
  );
}
