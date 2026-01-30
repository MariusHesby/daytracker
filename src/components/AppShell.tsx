"use client";

import { ReactNode, useState, useEffect, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { IOSTabBar } from "./ios";
import { useLanguage } from "@/context/LanguageContext";
import { SplashScreen } from "./SplashScreen";
import {
  Clock,
  Clapperboard,
  ChartBar,
  Settings,
  Dumbbell,
  Users,
} from "lucide-react";

// Pull-to-refresh indicator component
function PullToRefreshIndicator({
  pullDistance,
  isRefreshing,
}: {
  pullDistance: number;
  isRefreshing: boolean;
}) {
  const threshold = 80;
  const progress = Math.min(pullDistance / threshold, 1);
  const rotation = isRefreshing ? 0 : progress * 180;

  if (pullDistance <= 0 && !isRefreshing) return null;

  return (
    <div
      className='fixed left-0 right-0 flex justify-center z-50 pointer-events-none transition-transform duration-200'
      style={{
        top: Math.min(pullDistance * 0.5, 60) + "px",
        opacity: isRefreshing ? 1 : progress,
      }}>
      <div
        className={`w-8 h-8 flex items-center justify-center rounded-full bg-white dark:bg-gray-800 shadow-lg ${
          isRefreshing ? "animate-spin" : ""
        }`}>
        <svg
          viewBox='0 0 24 24'
          className='w-5 h-5 text-blue-500'
          style={{ transform: `rotate(${rotation}deg)` }}>
          {isRefreshing ? (
            <path
              fill='none'
              stroke='currentColor'
              strokeWidth='2'
              strokeLinecap='round'
              d='M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83'
            />
          ) : (
            <path
              fill='none'
              stroke='currentColor'
              strokeWidth='2'
              strokeLinecap='round'
              strokeLinejoin='round'
              d='M12 4v8m0 0l-3-3m3 3l3-3M4 14c0 4 4 6 8 6s8-2 8-6'
            />
          )}
        </svg>
      </div>
    </div>
  );
}

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

// Tab bar icons using Lucide React
const TodayIcon = ({ filled = false }: { filled?: boolean }) => (
  <Clock className='w-full h-full' strokeWidth={filled ? 2.5 : 1.5} />
);

const MoviesIcon = ({ filled = false }: { filled?: boolean }) => (
  <Clapperboard className='w-full h-full' strokeWidth={filled ? 2.5 : 1.5} />
);

const StatsIcon = ({ filled = false }: { filled?: boolean }) => (
  <ChartBar className='w-full h-full' strokeWidth={filled ? 2.5 : 1.5} />
);

const SettingsIcon = ({ filled = false }: { filled?: boolean }) => (
  <Settings className='w-full h-full' strokeWidth={filled ? 2.5 : 1.5} />
);

const WorkoutIcon = ({ filled = false }: { filled?: boolean }) => (
  <Dumbbell className='w-full h-full' strokeWidth={filled ? 2.5 : 1.5} />
);

const FriendsIcon = ({ filled = false }: { filled?: boolean }) => (
  <Users className='w-full h-full' strokeWidth={filled ? 2.5 : 1.5} />
);

interface AppShellProps {
  children: ReactNode;
}

const TABS = ["/", "/movies-tv", "/friends", "/stats", "/settings"];

export function AppShell({ children }: AppShellProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const [showSplash, setShowSplash] = useState(true);
  const [hasSeenSplash, setHasSeenSplash] = useState(false);
  const initialPathRef = useRef<string | null>(null);

  // Redirect to Today tab ONLY on PWA first load if it started at /settings (cached from old install)
  useEffect(() => {
    // Only check on first mount
    if (initialPathRef.current === null) {
      initialPathRef.current = pathname;

      if (typeof window !== "undefined" && pathname === "/settings") {
        const isStandalone =
          window.matchMedia("(display-mode: standalone)").matches ||
          (window.navigator as Navigator & { standalone?: boolean })
            .standalone === true;
        // Only redirect if this is the initial PWA launch
        if (isStandalone && !sessionStorage.getItem("hasNavigated")) {
          sessionStorage.setItem("hasNavigated", "true");
          router.replace("/");
        }
      }
    }
  }, [pathname, router]);

  // Pull-to-refresh state
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pullStartY = useRef<number | null>(null);
  const isPulling = useRef(false);

  // Swipe handling
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchStartTime = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const swipeDisabled = useRef(false); // Track if swipe should be disabled for this touch

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
    [pathname, router],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Check if touch started on an element that should prevent swipe
      const target = e.target as HTMLElement;
      if (target.closest("[data-no-swipe]")) {
        swipeDisabled.current = true;
        touchStartX.current = null;
        touchStartY.current = null;
        touchStartTime.current = null;
        return;
      }

      swipeDisabled.current = false;
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      touchStartTime.current = Date.now();

      // Check if we're at the top of the page for pull-to-refresh
      if (window.scrollY <= 0 && !isRefreshing) {
        pullStartY.current = e.touches[0].clientY;
        isPulling.current = true;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      // Skip if swipe is disabled for this touch sequence
      if (swipeDisabled.current) {
        return;
      }

      // Handle pull-to-refresh
      if (isPulling.current && pullStartY.current !== null && !isRefreshing) {
        const currentY = e.touches[0].clientY;
        const deltaY = currentY - pullStartY.current;

        // Only pull down, not up
        if (deltaY > 0 && window.scrollY <= 0) {
          // Apply resistance - the further you pull, the harder it gets
          const resistance = 0.5;
          const distance = deltaY * resistance;
          setPullDistance(distance);

          // Prevent default scrolling when pulling
          if (distance > 10) {
            e.preventDefault();
          }
        } else {
          setPullDistance(0);
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      // Skip if swipe is disabled for this touch sequence
      if (swipeDisabled.current) {
        touchStartX.current = null;
        touchStartY.current = null;
        touchStartTime.current = null;
        isPulling.current = false;
        pullStartY.current = null;
        swipeDisabled.current = false;
        return;
      }

      if (
        touchStartX.current === null ||
        touchStartY.current === null ||
        touchStartTime.current === null
      )
        return;

      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const touchDuration = Date.now() - touchStartTime.current;

      const deltaX = touchEndX - touchStartX.current;
      const deltaY = touchEndY - touchStartY.current;

      // Calculate velocity (pixels per millisecond)
      const velocityX = Math.abs(deltaX) / touchDuration;

      // Very responsive swipe detection:
      // - Only 20px minimum horizontal movement
      // - Allow diagonal swipes (horizontal just needs to be slightly more than vertical)
      // - Fast swipes work with just 15px
      const minSwipeDistance = 20;
      const minFastSwipeDistance = 15;
      const fastSwipeVelocity = 0.2; // pixels per ms

      // Much more lenient - horizontal just needs to be equal or greater than vertical
      const isHorizontalSwipe = Math.abs(deltaX) >= Math.abs(deltaY);
      const isLongEnough = Math.abs(deltaX) > minSwipeDistance;
      const isFastEnough =
        velocityX > fastSwipeVelocity &&
        Math.abs(deltaX) > minFastSwipeDistance;

      if (isHorizontalSwipe && (isLongEnough || isFastEnough)) {
        if (deltaX > 0) {
          handleSwipe("right");
        } else {
          handleSwipe("left");
        }
      }

      // Handle pull-to-refresh on touch end
      if (isPulling.current && pullDistance > 80) {
        setIsRefreshing(true);
        setPullDistance(0);

        // Perform refresh
        router.refresh();

        // Also trigger a page reload after a short delay
        setTimeout(() => {
          window.location.reload();
        }, 300);
      } else {
        setPullDistance(0);
      }

      isPulling.current = false;
      pullStartY.current = null;

      touchStartX.current = null;
      touchStartY.current = null;
      touchStartTime.current = null;
    };

    container.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    container.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleSwipe, pullDistance, isRefreshing, router]);

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
      href: "/friends",
      label: t("tab.friends"),
      icon: <FriendsIcon />,
      activeIcon: <FriendsIcon filled />,
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
      <PullToRefreshIndicator
        pullDistance={pullDistance}
        isRefreshing={isRefreshing}
      />
      {showSplash && !hasSeenSplash && (
        <SplashScreen onComplete={handleSplashComplete} />
      )}
      <BackgroundLogo />
      <main
        className='pb-16 relative z-10'
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        {children}
      </main>
      <IOSTabBar items={tabItems} />
    </div>
  );
}
