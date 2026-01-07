"use client";

import { useState, useEffect } from "react";

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<"logo" | "fadeOut" | "done">("logo");

  useEffect(() => {
    // Show logo animation for 1.5 seconds
    const logoTimer = setTimeout(() => {
      setPhase("fadeOut");
    }, 1500);

    // Complete after fade out (1.5s + 2s fade = 3.5s total)
    const completeTimer = setTimeout(() => {
      setPhase("done");
      onComplete();
    }, 3500);

    return () => {
      clearTimeout(logoTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  if (phase === "done") return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-ios-bg dark:bg-ios-bg-dark transition-opacity duration-2000 ${
        phase === "fadeOut" ? "opacity-0" : "opacity-100"
      }`}>
      <div className='flex flex-col items-center gap-4'>
        {/* Animated Logo */}
        <svg
          className='w-32 h-32'
          viewBox='0 0 512 512'
          fill='none'
          xmlns='http://www.w3.org/2000/svg'>
          {/* Stylized "D" shape - draws in */}
          <path
            d='M160 120 L160 392 L280 392 C360 392 420 320 420 256 C420 192 360 120 280 120 L160 120 Z'
            fill='none'
            stroke='currentColor'
            strokeWidth='32'
            strokeLinecap='round'
            strokeLinejoin='round'
            className='text-ios-blue animate-draw-d'
          />

          {/* Timeline dots - fade in sequentially */}
          <circle
            cx='220'
            cy='200'
            r='20'
            fill='currentColor'
            className='text-ios-blue animate-dot-1'
          />
          <circle
            cx='220'
            cy='256'
            r='20'
            fill='currentColor'
            className='text-ios-blue animate-dot-2'
          />
          <circle
            cx='220'
            cy='312'
            r='20'
            fill='currentColor'
            className='text-ios-blue animate-dot-3'
          />

          {/* Connecting lines - slide in */}
          <line
            x1='240'
            y1='200'
            x2='320'
            y2='200'
            stroke='currentColor'
            strokeWidth='12'
            strokeLinecap='round'
            className='text-ios-blue animate-line-1'
          />
          <line
            x1='240'
            y1='256'
            x2='340'
            y2='256'
            stroke='currentColor'
            strokeWidth='12'
            strokeLinecap='round'
            className='text-ios-blue animate-line-2'
          />
          <line
            x1='240'
            y1='312'
            x2='300'
            y2='312'
            stroke='currentColor'
            strokeWidth='12'
            strokeLinecap='round'
            className='text-ios-blue animate-line-3'
          />
        </svg>

        {/* App name - fades in */}
        <h1 className='text-2xl font-semibold text-gray-900 dark:text-white animate-fade-in-up'>
          DayTracker
        </h1>
      </div>
    </div>
  );
}
