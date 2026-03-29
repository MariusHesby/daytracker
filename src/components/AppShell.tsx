"use client";

import { ReactNode, useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { IOSTabBar } from "./ios";
import { SplashScreen } from "./SplashScreen";
import { InfoModeOverlay } from "./InfoModeOverlay";
import { useApp } from "@/context/AppContext";
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

// Subtle background logo component with decorative elements
function BackgroundLogo() {
  return (
    <div className='fixed inset-0 pointer-events-none overflow-hidden z-0'>
      {/* Large decorative gradient circles */}
      <div
        className='absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-[0.025] dark:opacity-[0.04]'
        style={{
          background:
            "radial-gradient(circle, var(--ios-blue) 0%, transparent 70%)",
        }}
      />
      <div
        className='absolute -bottom-64 -left-64 w-[600px] h-[600px] rounded-full opacity-[0.02] dark:opacity-[0.035]'
        style={{
          background:
            "radial-gradient(circle, var(--ios-purple, #af52de) 0%, transparent 70%)",
        }}
      />
      <div
        className='absolute top-1/3 -right-32 w-80 h-80 rounded-full opacity-[0.015] dark:opacity-[0.025]'
        style={{
          background:
            "radial-gradient(circle, var(--ios-green) 0%, transparent 70%)",
        }}
      />
      <div
        className='absolute bottom-1/4 left-1/4 w-48 h-48 rounded-full opacity-[0.02] dark:opacity-[0.03]'
        style={{
          background:
            "radial-gradient(circle, var(--ios-orange) 0%, transparent 70%)",
        }}
      />

      {/* Subtle grid pattern */}
      <div
        className='absolute inset-0 opacity-[0.012] dark:opacity-[0.025]'
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,122,255,0.4) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,122,255,0.4) 1px, transparent 1px)
          `,
          backgroundSize: "80px 80px",
        }}
      />

      {/* Main logo - much bigger */}
      <svg
        className='absolute -bottom-32 -right-32 w-[180vw] h-[180vw] max-w-[1100px] max-h-[1100px] opacity-[0.055] dark:opacity-[0.07] rotate-12'
        viewBox='0 0 512 512'
        fill='none'
        xmlns='http://www.w3.org/2000/svg'>
        {/* Stylized "D" shape */}
        <path
          d='M160 120 L160 392 L280 392 C360 392 420 320 420 256 C420 192 360 120 280 120 L160 120 Z'
          fill='none'
          stroke='currentColor'
          strokeWidth='28'
          strokeLinecap='round'
          strokeLinejoin='round'
          className='text-ios-blue'
        />

        {/* Timeline dots inside the D */}
        <circle
          cx='220'
          cy='200'
          r='22'
          fill='currentColor'
          className='text-ios-blue'
        />
        <circle
          cx='220'
          cy='256'
          r='22'
          fill='currentColor'
          className='text-ios-blue'
        />
        <circle
          cx='220'
          cy='312'
          r='22'
          fill='currentColor'
          className='text-ios-blue'
        />

        {/* Connecting lines */}
        <line
          x1='244'
          y1='200'
          x2='330'
          y2='200'
          stroke='currentColor'
          strokeWidth='14'
          strokeLinecap='round'
          className='text-ios-blue'
        />
        <line
          x1='244'
          y1='256'
          x2='355'
          y2='256'
          stroke='currentColor'
          strokeWidth='14'
          strokeLinecap='round'
          className='text-ios-blue'
        />
        <line
          x1='244'
          y1='312'
          x2='310'
          y2='312'
          stroke='currentColor'
          strokeWidth='14'
          strokeLinecap='round'
          className='text-ios-blue'
        />
      </svg>

      {/* Secondary smaller logo in opposite corner */}
      <svg
        className='absolute -top-16 -left-16 w-[60vw] h-[60vw] max-w-[350px] max-h-[350px] opacity-[0.015] dark:opacity-[0.025] -rotate-12'
        viewBox='0 0 512 512'
        fill='none'
        xmlns='http://www.w3.org/2000/svg'>
        <path
          d='M160 120 L160 392 L280 392 C360 392 420 320 420 256 C420 192 360 120 280 120 L160 120 Z'
          fill='none'
          stroke='currentColor'
          strokeWidth='28'
          strokeLinecap='round'
          strokeLinejoin='round'
          className='text-ios-purple'
        />
        <circle
          cx='220'
          cy='200'
          r='22'
          fill='currentColor'
          className='text-ios-purple'
        />
        <circle
          cx='220'
          cy='256'
          r='22'
          fill='currentColor'
          className='text-ios-purple'
        />
        <circle
          cx='220'
          cy='312'
          r='22'
          fill='currentColor'
          className='text-ios-purple'
        />
        <line
          x1='244'
          y1='200'
          x2='330'
          y2='200'
          stroke='currentColor'
          strokeWidth='14'
          strokeLinecap='round'
          className='text-ios-purple'
        />
        <line
          x1='244'
          y1='256'
          x2='355'
          y2='256'
          stroke='currentColor'
          strokeWidth='14'
          strokeLinecap='round'
          className='text-ios-purple'
        />
        <line
          x1='244'
          y1='312'
          x2='310'
          y2='312'
          stroke='currentColor'
          strokeWidth='14'
          strokeLinecap='round'
          className='text-ios-purple'
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

export function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { viewingUser } = useApp();
  const isSpying = viewingUser !== null;
  const [showSplash, setShowSplash] = useState(false);
  const [splashChecked, setSplashChecked] = useState(false);
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

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Check if touch started inside a scrollable container (e.g. chat messages)
      const target = e.target as HTMLElement;
      const scrollableParent = target.closest("[data-scrollable]");
      if (scrollableParent) {
        // Don't activate pull-to-refresh when inside a scrollable area
        isPulling.current = false;
        return;
      }

      // Check if we're at the top of the page for pull-to-refresh
      if (window.scrollY <= 0 && !isRefreshing) {
        pullStartY.current = e.touches[0].clientY;
        isPulling.current = true;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
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

    const handleTouchEnd = () => {
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
  }, [pullDistance, isRefreshing, router]);

  useEffect(() => {
    // Only show splash once per 24 hours
    const lastShown = localStorage.getItem("splashLastShown");
    const cooldown = 24 * 60 * 60 * 1000; // 24 hours
    const shouldShow =
      !lastShown || Date.now() - parseInt(lastShown, 10) > cooldown;
    setShowSplash(shouldShow);
    setSplashChecked(true);
  }, []);

  const handleSplashComplete = () => {
    localStorage.setItem("splashLastShown", Date.now().toString());
    setShowSplash(false);
  };

  const tabItems = [
    {
      href: "/",
      label: "Today",
      icon: <TodayIcon />,
      activeIcon: <TodayIcon filled />,
    },
    {
      href: "/movies-tv",
      label: "Movies & TV",
      icon: <MoviesIcon />,
      activeIcon: <MoviesIcon filled />,
    },
    {
      href: "/stats",
      label: "Statistics",
      icon: <StatsIcon />,
      activeIcon: <StatsIcon filled />,
    },
    {
      href: "/friends",
      label: "Friends",
      icon: <FriendsIcon />,
      activeIcon: <FriendsIcon filled />,
      disabled: isSpying,
    },
    {
      href: "/settings",
      label: "Settings",
      icon: <SettingsIcon />,
      activeIcon: <SettingsIcon filled />,
      disabled: isSpying,
    },
  ];

  return (
    <div
      ref={containerRef}
      className='min-h-screen bg-ios-bg dark:bg-ios-bg-dark relative overflow-x-hidden'>
      <PullToRefreshIndicator
        pullDistance={pullDistance}
        isRefreshing={isRefreshing}
      />
      {showSplash && splashChecked && (
        <SplashScreen onComplete={handleSplashComplete} />
      )}
      <BackgroundLogo />
      <main
        className='pb-16 relative z-10'
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        {children}
      </main>
      <IOSTabBar items={tabItems} />
      <InfoModeOverlay />
    </div>
  );
}
