"use client";

import { ReactNode } from "react";

// Apple-style icons following Human Interface Guidelines
// Simple, filled shapes with minimal details for clarity at all sizes

export const icons = {
  // TV Series - simple rectangle with play indicator
  tv: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <rect x='2' y='4' width='20' height='14' rx='2' />
      <path d='M10 8.5v5l4-2.5z' fill='white' fillOpacity='0.9' />
    </svg>
  ),

  // Movies - film reel / clapperboard simplified
  movie: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <rect x='3' y='6' width='18' height='14' rx='2' />
      <rect x='3' y='3' width='18' height='4' rx='1' />
      <path
        d='M7 3v4M12 3v4M17 3v4'
        stroke='white'
        strokeWidth='1.5'
        strokeOpacity='0.7'
      />
    </svg>
  ),

  // Travel - airplane simplified
  travel: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <path d='M21 16v-2l-8-5V3.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z' />
    </svg>
  ),

  // Protein - drumstick simplified as filled shape
  protein: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <ellipse cx='15' cy='8' rx='5' ry='4' />
      <path d='M11 10l-6 8.5a1.5 1.5 0 001.2 2.4 1.5 1.5 0 001.3-.9l5-7.5' />
    </svg>
  ),

  // Alcohol - wine glass simplified
  alcohol: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <path d='M6 3v6c0 3.31 2.69 6 6 6s6-2.69 6-6V3H6z' />
      <rect x='11' y='15' width='2' height='5' />
      <rect x='8' y='20' width='8' height='2' rx='1' />
    </svg>
  ),

  // Workout - dumbbell simplified
  workout: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <rect x='2' y='9' width='4' height='6' rx='1' />
      <rect x='18' y='9' width='4' height='6' rx='1' />
      <rect x='5' y='7' width='3' height='10' rx='1' />
      <rect x='16' y='7' width='3' height='10' rx='1' />
      <rect x='8' y='10.5' width='8' height='3' rx='0.5' />
    </svg>
  ),

  // Event - calendar simplified
  event: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <rect x='3' y='4' width='18' height='18' rx='3' />
      <rect x='3' y='4' width='18' height='5' rx='3' fill='currentColor' />
      <circle cx='12' cy='14' r='2.5' fill='white' fillOpacity='0.9' />
    </svg>
  ),

  // Kids Away - heart in house simplified
  kidsAway: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <path d='M12 3L2 12h3v8h14v-8h3L12 3z' />
      <path
        d='M12 11c-.8-.8-2-.9-2.5-.3-.6.6-.5 1.5.3 2.3l2.2 2.2 2.2-2.2c.8-.8.9-1.7.3-2.3-.5-.6-1.7-.5-2.5.3z'
        fill='white'
        fillOpacity='0.9'
      />
    </svg>
  ),

  // Period - droplet filled
  period: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <path d='M12 2C8 6.5 5 10.5 5 14a7 7 0 0014 0c0-3.5-3-7.5-7-12z' />
    </svg>
  ),

  // Sleep - moon filled
  sleep: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <path d='M12 3a9 9 0 109 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 01-4.4 2.26 5.403 5.403 0 01-3.14-9.8c-.44-.06-.9-.1-1.36-.1z' />
    </svg>
  ),

  // Meal - fork and knife simplified
  meal: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <path d='M7 2v9a3 3 0 003 3v8h2v-8a3 3 0 003-3V2h-2v7h-1V2H10v7H9V2H7z' />
      <path d='M17 2c0 3 1 5 1 8v12h2V10c0-3 1-5 1-8h-4z' />
    </svg>
  ),

  // Default/other - plus circle filled
  other: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <circle cx='12' cy='12' r='10' />
      <path
        d='M12 7v10M7 12h10'
        stroke='white'
        strokeWidth='2'
        strokeLinecap='round'
      />
    </svg>
  ),

  // Bicycle - simplified
  bicycle: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <circle cx='5.5' cy='16.5' r='3.5' />
      <circle cx='18.5' cy='16.5' r='3.5' />
      <path
        d='M5.5 16.5L10 10l2.5 3.5L15 10l3.5 6.5'
        stroke='currentColor'
        strokeWidth='2'
        fill='none'
      />
      <circle cx='15' cy='5' r='2' />
    </svg>
  ),

  // Car - simplified
  car: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <path d='M5 11l1.5-4.5h11L19 11' />
      <rect x='3' y='11' width='18' height='7' rx='2' />
      <circle cx='7' cy='15' r='1.5' fill='white' fillOpacity='0.9' />
      <circle cx='17' cy='15' r='1.5' fill='white' fillOpacity='0.9' />
    </svg>
  ),

  // Running - person running simplified
  running: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <circle cx='14' cy='4' r='2.5' />
      <path d='M10.5 9l-4 4.5 1.5 1.3 3-3.3 2 2-2 6h2.5l1.5-5 2.5 2v5h2v-6.5l-4-3.5 1-3c1 1 2.5 2 4.5 2v-2c-1.5 0-3-1-3.5-2l-1.5-2c-.5-.5-1-.5-1.5-.5-.3 0-.7.1-1 .3l-4 2v5h2V9z' />
    </svg>
  ),

  // Walking - person walking simplified
  walking: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <circle cx='12' cy='4' r='2.5' />
      <path d='M10 23l1.5-7.5L9 14V9l4-2 4 2v3l-2.5 1.5L13 23h-2l1-9-2-.5V23h-2z' />
    </svg>
  ),

  // Heart - filled heart
  heart: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <path d='M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z' />
    </svg>
  ),

  // Coffee - cup simplified
  coffee: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <path d='M4 6h12v9a4 4 0 01-4 4H8a4 4 0 01-4-4V6z' />
      <path d='M16 8h2a2 2 0 012 2v1a2 2 0 01-2 2h-2' />
      <rect x='4' y='20' width='12' height='2' rx='1' />
    </svg>
  ),

  // Book - simplified
  book: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <path d='M4 4a2 2 0 012-2h12a2 2 0 012 2v16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z' />
      <path d='M7 4v7l2.5-1.5L12 11V4' fill='white' fillOpacity='0.9' />
    </svg>
  ),

  // Music - note simplified
  music: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <circle cx='8' cy='18' r='4' />
      <path d='M12 18V4l8-2v12' />
      <circle cx='16' cy='14' r='4' />
    </svg>
  ),

  // Water - droplet simplified
  water: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <path d='M12 2C8 6.5 5 10.5 5 14a7 7 0 0014 0c0-3.5-3-7.5-7-12z' />
      <ellipse cx='10' cy='14' rx='2' ry='3' fill='white' fillOpacity='0.3' />
    </svg>
  ),

  // Meditation - simplified lotus/person
  meditation: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <circle cx='12' cy='6' r='3' />
      <path d='M12 10c-4 0-7 2-7 4l2 2h10l2-2c0-2-3-4-7-4z' />
      <ellipse cx='12' cy='19' rx='8' ry='3' fillOpacity='0.5' />
    </svg>
  ),

  // Gaming - controller simplified
  gaming: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <path d='M6 8a4 4 0 00-4 4v2a3 3 0 005.12 2.12L9 14h6l1.88 2.12A3 3 0 0022 14v-2a4 4 0 00-4-4H6z' />
      <path
        d='M8 11v2M7 12h2'
        stroke='white'
        strokeWidth='1.5'
        strokeLinecap='round'
      />
      <circle cx='16' cy='11' r='1' fill='white' />
      <circle cx='18' cy='13' r='1' fill='white' />
    </svg>
  ),

  // Star - filled star
  star: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <path d='M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' />
    </svg>
  ),

  // Apple - fruit simplified
  apple: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <path d='M12 4c-1 0-2 .5-2.5 1.5C8 4.5 6 5 5 6.5 3.5 8.5 3 11 3 14c0 4 2 8 5 8 1 0 2-.5 3-1 1 .5 2 1 3 1 3 0 5-4 5-8 0-3-.5-5.5-2-7.5-1-1.5-3-2-4.5-1-.5-1-1.5-1.5-2.5-1.5z' />
      <path d='M12 2c1 0 2 1 2 2s-1 2-2 2' />
    </svg>
  ),

  // Scale - weight scale simplified
  scale: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <rect x='4' y='14' width='16' height='8' rx='2' />
      <path d='M6 14V8a6 6 0 0112 0v6' />
      <circle cx='12' cy='7' r='2' />
    </svg>
  ),

  // Fire - flame simplified
  fire: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <path d='M12 2c-2 3-4 5-4 8a4 4 0 004 4c-1 0-2 1-2 2 0 2 1.5 3 3 3h2c1.5 0 3-1 3-3 0-1-1-2-2-2a4 4 0 004-4c0-3-2-5-4-8-1 2-2 3-2 4 0-1-1-2-2-4z' />
    </svg>
  ),

  // Target - bullseye simplified
  target: (
    <svg viewBox='0 0 24 24' fill='currentColor' className='w-6 h-6'>
      <circle cx='12' cy='12' r='10' />
      <circle cx='12' cy='12' r='7' fill='white' fillOpacity='0.9' />
      <circle cx='12' cy='12' r='4' />
      <circle cx='12' cy='12' r='1.5' fill='white' fillOpacity='0.9' />
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
