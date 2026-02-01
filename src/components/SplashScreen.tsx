"use client";

import { useState, useEffect } from "react";

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Show logo animation for 2.5 seconds, then hold for 0.3s, then switch instantly
    const completeTimer = setTimeout(() => {
      setVisible(false);
      onComplete();
    }, 2800);

    return () => {
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  if (!visible) return null;

  return (
    <div
      className='fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden'
      style={{ backgroundColor: "#f5f5f7" }}>
      <style>{`
        .dark .splash-bg { background-color: #000 !important; }
      `}</style>
      <div
        className='splash-bg absolute inset-0'
        style={{ backgroundColor: "#f5f5f7" }}
      />
      {/* Subtle background elements */}
      <div className='absolute inset-0 overflow-hidden z-10'>
        {/* Large decorative circles */}
        <div
          className='absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-[0.03] dark:opacity-[0.05]'
          style={{
            background:
              "radial-gradient(circle, var(--ios-blue) 0%, transparent 70%)",
          }}
        />
        <div
          className='absolute -bottom-48 -left-48 w-[500px] h-[500px] rounded-full opacity-[0.03] dark:opacity-[0.05]'
          style={{
            background:
              "radial-gradient(circle, var(--ios-purple, #af52de) 0%, transparent 70%)",
          }}
        />
        <div
          className='absolute top-1/4 -left-24 w-64 h-64 rounded-full opacity-[0.02] dark:opacity-[0.03]'
          style={{
            background:
              "radial-gradient(circle, var(--ios-green) 0%, transparent 70%)",
          }}
        />

        {/* Subtle grid pattern */}
        <div
          className='absolute inset-0 opacity-[0.015] dark:opacity-[0.03]'
          style={{
            backgroundImage: `
              linear-gradient(rgba(0,122,255,0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,122,255,0.3) 1px, transparent 1px)
            `,
            backgroundSize: "60px 60px",
          }}
        />

        {/* Floating dots - subtle */}
        <div
          className='absolute top-[15%] right-[20%] w-2 h-2 rounded-full bg-ios-blue/10 dark:bg-ios-blue/20 animate-pulse'
          style={{ animationDelay: "0s" }}
        />
        <div
          className='absolute top-[30%] left-[15%] w-1.5 h-1.5 rounded-full bg-ios-green/10 dark:bg-ios-green/20 animate-pulse'
          style={{ animationDelay: "0.5s" }}
        />
        <div
          className='absolute bottom-[25%] right-[15%] w-2.5 h-2.5 rounded-full bg-ios-purple/10 dark:bg-ios-purple/20 animate-pulse'
          style={{ animationDelay: "1s" }}
        />
        <div
          className='absolute bottom-[35%] left-[25%] w-1.5 h-1.5 rounded-full bg-ios-orange/10 dark:bg-ios-orange/20 animate-pulse'
          style={{ animationDelay: "0.3s" }}
        />
        <div
          className='absolute top-[60%] right-[30%] w-2 h-2 rounded-full bg-ios-teal/10 dark:bg-ios-teal/20 animate-pulse'
          style={{ animationDelay: "0.7s" }}
        />
      </div>

      <div className='flex flex-col items-center gap-6 -mt-16 relative z-20'>
        {/* Animated Logo - Much bigger */}
        <svg
          className='w-56 h-56 sm:w-64 sm:h-64'
          viewBox='0 0 512 512'
          fill='none'
          xmlns='http://www.w3.org/2000/svg'>
          {/* Subtle glow behind logo */}
          <defs>
            <filter id='glow' x='-50%' y='-50%' width='200%' height='200%'>
              <feGaussianBlur stdDeviation='8' result='coloredBlur' />
              <feMerge>
                <feMergeNode in='coloredBlur' />
                <feMergeNode in='SourceGraphic' />
              </feMerge>
            </filter>
          </defs>

          {/* Stylized "D" shape - draws in */}
          <path
            d='M160 120 L160 392 L280 392 C360 392 420 320 420 256 C420 192 360 120 280 120 L160 120 Z'
            fill='none'
            stroke='currentColor'
            strokeWidth='28'
            strokeLinecap='round'
            strokeLinejoin='round'
            className='text-ios-blue animate-draw-d'
            filter='url(#glow)'
          />

          {/* Timeline dots - fade in sequentially */}
          <circle
            cx='220'
            cy='200'
            r='22'
            fill='currentColor'
            className='text-ios-blue animate-dot-1'
          />
          <circle
            cx='220'
            cy='256'
            r='22'
            fill='currentColor'
            className='text-ios-blue animate-dot-2'
          />
          <circle
            cx='220'
            cy='312'
            r='22'
            fill='currentColor'
            className='text-ios-blue animate-dot-3'
          />

          {/* Connecting lines - slide in */}
          <line
            x1='244'
            y1='200'
            x2='330'
            y2='200'
            stroke='currentColor'
            strokeWidth='14'
            strokeLinecap='round'
            className='text-ios-blue animate-line-1'
          />
          <line
            x1='244'
            y1='256'
            x2='355'
            y2='256'
            stroke='currentColor'
            strokeWidth='14'
            strokeLinecap='round'
            className='text-ios-blue animate-line-2'
          />
          <line
            x1='244'
            y1='312'
            x2='310'
            y2='312'
            stroke='currentColor'
            strokeWidth='14'
            strokeLinecap='round'
            className='text-ios-blue animate-line-3'
          />
        </svg>

        {/* App name - fades in, bigger */}
        <h1 className='text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white animate-fade-in-up tracking-tight'>
          DayTracker
        </h1>

        {/* Subtle tagline */}
        <p
          className='text-sm text-gray-400 dark:text-gray-500 animate-fade-in-up opacity-0'
          style={{ animationDelay: "1.1s", animationFillMode: "forwards" }}>
          Track your days, shape your life
        </p>
      </div>
    </div>
  );
}
