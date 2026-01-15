"use client";

import { ReactNode } from "react";

// Google Material-style icons as React components
// Each icon is designed to match Google's Material Design aesthetic

export const icons = {
  // TV Series - monitor with play button
  tv: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <path d='M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z' />
      <path d='M10 8v6l5-3z' />
    </svg>
  ),

  // Movies - film clapperboard
  movie: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <path d='M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4zM4 18V8h16v10H4z' />
    </svg>
  ),

  // Travel - airplane
  travel: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <path d='M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z' />
    </svg>
  ),

  // Protein - chicken drumstick / meat
  protein: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <path d='M18.06 3c-1.52 0-2.91.56-3.96 1.49L7.85 10.74c-1.91.44-3.35 2.13-3.35 4.15 0 .83.23 1.61.64 2.27l-.71.71a.996.996 0 101.41 1.41l.71-.71c.66.41 1.44.64 2.27.64 2.02 0 3.71-1.44 4.15-3.35l6.25-6.25c.93-1.05 1.49-2.44 1.49-3.96 0-1.63-.64-3.16-1.81-4.32C17.74 3.16 16.91 3 18.06 3zm-5.59 11.47c-.23.93-1.07 1.61-2.07 1.61-.59 0-1.12-.24-1.51-.63-.39-.39-.63-.92-.63-1.51 0-1 .68-1.84 1.61-2.07l2.6 2.6z' />
    </svg>
  ),

  // Alcohol - wine glass
  alcohol: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <path d='M6 3l-.01 6c-.01 2.62 1.89 4.79 4.39 5.22V20H7v2h10v-2h-3.38v-5.78c2.49-.43 4.39-2.6 4.39-5.22L18 3H6zm6 10c-1.66 0-3-1.32-3-2.95V5h6v5.05C15 11.68 13.66 13 12 13z' />
    </svg>
  ),

  // Workout - dumbbell
  workout: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <path d='M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29l-1.43-1.43z' />
    </svg>
  ),

  // Event - calendar with star
  event: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <path d='M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z' />
      <path d='M12 10l1.12 2.27 2.5.36-1.81 1.77.43 2.49L12 15.77l-2.24 1.18.43-2.49-1.81-1.77 2.5-.36z' />
    </svg>
  ),

  // Kids Away - house with heart
  kidsAway: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <path d='M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3zm0 11.5c-1.93-1.93-3.5-2.52-3.5-4 0-1.38 1.12-2.5 2.5-2.5.89 0 1.43.38 1.87.82L12 10l1.13-1.18c.44-.44.98-.82 1.87-.82 1.38 0 2.5 1.12 2.5 2.5 0 1.48-1.57 2.07-3.5 4l-2 2-2-2z' />
    </svg>
  ),

  // Period - drop/water
  period: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <path d='M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2c0-3.32-2.67-7.25-8-11.8zm0 18c-3.35 0-6-2.57-6-6.2 0-2.34 1.95-5.44 6-9.14 4.05 3.7 6 6.79 6 9.14 0 3.63-2.65 6.2-6 6.2z' />
      <circle cx='12' cy='16' r='2' />
    </svg>
  ),

  // Sleep - moon with stars
  sleep: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <path d='M12.34 2.02C6.59 1.82 2 6.42 2 12c0 5.52 4.48 10 10 10 3.71 0 6.93-2.02 8.66-5.02-7.51-.25-12.09-8.43-8.32-14.96zM15 4l1 3h3l-2.5 2 1 3-2.5-2-2.5 2 1-3L10 7h3l1-3z' />
    </svg>
  ),

  // Meal - fork and knife
  meal: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <path d='M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z' />
    </svg>
  ),

  // Default/other - circle with plus
  other: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z' />
    </svg>
  ),

  // Bicycle - cycling
  bicycle: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <path d='M15.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM5 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zm5.8-10l2.4-2.4.8.8c1.3 1.3 3 2.1 5.1 2.1V9c-1.5 0-2.7-.6-3.6-1.5l-1.9-1.9c-.5-.4-1-.6-1.6-.6s-1.1.2-1.4.6L7.8 8.4c-.4.4-.6.9-.6 1.4 0 .6.2 1.1.6 1.4L11 14v5h2v-6.2l-2.2-2.3zM19 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5z' />
    </svg>
  ),

  // Car - automobile
  car: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <path d='M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z' />
    </svg>
  ),

  // Running - person running
  running: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <path d='M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4z' />
    </svg>
  ),

  // Walking - person walking
  walking: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <path d='M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7z' />
    </svg>
  ),

  // Heart - health/love
  heart: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <path d='M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z' />
    </svg>
  ),

  // Coffee - morning coffee/caffeine
  coffee: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <path d='M18.5 3H6c-1.1 0-2 .9-2 2v5.71c0 3.83 2.95 7.18 6.78 7.29 3.96.12 7.22-3.06 7.22-7v-1h.5c1.93 0 3.5-1.57 3.5-3.5S20.43 3 18.5 3zM16 5v3h2.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5H16v-1c0-2.76-2.24-5-5-5H6V5h10zM4 19h16v2H4z' />
    </svg>
  ),

  // Book - reading
  book: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <path d='M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z' />
    </svg>
  ),

  // Music - music note
  music: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <path d='M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z' />
    </svg>
  ),

  // Water - hydration
  water: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <path d='M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2c0-3.32-2.67-7.25-8-11.8zm0 18c-3.35 0-6-2.57-6-6.2 0-2.34 1.95-5.44 6-9.14 4.05 3.7 6 6.79 6 9.14 0 3.63-2.65 6.2-6 6.2z' />
    </svg>
  ),

  // Meditation - person meditating
  meditation: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <path d='M12 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6.78 11.81c-.53-.53-1.27-.76-2-.59L15 15.77V13c0-.53-.21-1.04-.58-1.41L12 9.17V5c0-.55-.45-1-1-1s-1 .45-1 1v4.17L7.58 11.59C7.21 11.96 7 12.47 7 13v2.77l-1.78-.45c-.73-.18-1.47.06-2 .59-.79.79-.58 2.1.49 2.55l4.76 2.04c.26.11.55.17.84.17h5.38c.29 0 .58-.06.84-.17l4.76-2.04c1.07-.46 1.29-1.77.49-2.55zM12 21l-4-1.8V14l4 4 4-4v5.2l-4 1.8z' />
    </svg>
  ),

  // Gaming - game controller
  gaming: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <path d='M21.58 16.09l-1.09-7.66C20.21 6.46 18.52 5 16.53 5H7.47C5.48 5 3.79 6.46 3.51 8.43l-1.09 7.66C2.2 17.63 3.39 19 4.94 19h0c.68 0 1.32-.27 1.8-.75L9 16h6l2.25 2.25c.48.48 1.13.75 1.8.75h0c1.56 0 2.75-1.37 2.53-2.91zM11 11H9v2H8v-2H6v-1h2V8h1v2h2v1zm4-1c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm2 3c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z' />
    </svg>
  ),

  // Star - achievement/rating
  star: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <path d='M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z' />
    </svg>
  ),

  // Apple - food/nutrition
  apple: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <path d='M20 10c0-4.42-3.58-8-8-8-1.74 0-3.34.57-4.65 1.52C8.32 3.19 9.61 3 11 3c2.94 0 5.5 1.32 7.24 3.3.47.63.89 1.31 1.23 2.04.34.94.53 1.95.53 3.01 0 4.03-2.93 7.36-6.76 7.98.12-.32.23-.65.31-.99C17.22 17.23 20 13.97 20 10zM12 22c-4.97 0-9-4.03-9-9 0-4.42 3.58-8 8-8 .34 0 .68.02 1 .07-.65 1.07-1 2.32-1 3.64 0 3.87 3.13 7 7 7 .34 0 .68-.02 1-.07-.65 4.07-4.19 7.36-8.63 7.36H12z' />
    </svg>
  ),

  // Scale - weight/measurement
  scale: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <path d='M12 3c-1.27 0-2.4.8-2.82 2H3v2h1.95L2 14c-.47 2 1 4 3.5 4s4.06-2 3.5-4L6.05 7h3.12c.33.85 1.01 1.53 1.83 1.83V20H9v2h6v-2h-2V8.83c.82-.3 1.5-.98 1.83-1.83h3.12L15 14c-.47 2 1 4 3.5 4s4.06-2 3.5-4l-2.95-7H21V5h-6.18C14.4 3.8 13.27 3 12 3zm0 2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM5.5 16c-.83 0-1.5-.4-1.5-1h3c0 .6-.67 1-1.5 1zm13 0c-.83 0-1.5-.4-1.5-1h3c0 .6-.67 1-1.5 1z' />
    </svg>
  ),

  // Fire - calories/energy
  fire: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <path d='M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z' />
    </svg>
  ),

  // Target - goals
  target: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <path d='M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10 10-4.49 10-10S17.51 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z' />
    </svg>
  ),
};

export type IconName = keyof typeof icons;

// Icon picker component
interface IconPickerProps {
  selectedIcon: IconName | string;
  onSelect: (icon: IconName) => void;
}

export function IconPicker({ selectedIcon, onSelect }: IconPickerProps) {
  const iconNames = Object.keys(icons) as IconName[];

  return (
    <div className='grid grid-cols-4 gap-2'>
      {iconNames.map((name) => (
        <button
          key={name}
          type='button'
          onClick={() => onSelect(name)}
          className={`
            p-3 rounded-xl transition-all transform hover:scale-110
            flex items-center justify-center
            ${
              selectedIcon === name
                ? "bg-gradient-to-br from-purple-400 to-pink-400 text-white shadow-lg scale-110"
                : "bg-white/50 dark:bg-purple-800/30 text-purple-600 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-700/50"
            }
          `}
          title={name}>
          <span className='w-6 h-6'>{icons[name]}</span>
        </button>
      ))}
    </div>
  );
}

// Render icon by name
export function Icon({
  name,
  className = "w-6 h-6",
}: {
  name: IconName | string;
  className?: string;
}) {
  const icon = icons[name as IconName];
  if (!icon) {
    // Fallback to emoji if it's not a known icon
    return <span className={className}>{name}</span>;
  }
  return <span className={className}>{icon}</span>;
}
