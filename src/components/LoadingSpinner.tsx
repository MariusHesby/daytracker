"use client";

import { cn } from "@/lib/utils";

export interface LoadingSpinnerProps {
  /** Size of the spinner */
  size?: "sm" | "md" | "lg" | "xl";
  /** Color theme */
  color?: "blue" | "white" | "gray" | "purple";
  /** Additional CSS classes */
  className?: string;
}

const SIZE_CLASSES = {
  sm: "w-4 h-4 border-2",
  md: "w-6 h-6 border-2",
  lg: "w-8 h-8 border-3",
  xl: "w-12 h-12 border-4",
};

const COLOR_CLASSES = {
  blue: "border-gray-200 border-t-ios-blue dark:border-gray-700 dark:border-t-ios-blue",
  white: "border-white/30 border-t-white",
  gray: "border-gray-200 border-t-gray-500 dark:border-gray-700 dark:border-t-gray-400",
  purple:
    "border-purple-200 border-t-purple-500 dark:border-purple-900 dark:border-t-purple-500",
};

/**
 * A consistent loading spinner component used throughout the app.
 */
export function LoadingSpinner({
  size = "md",
  color = "blue",
  className,
}: LoadingSpinnerProps) {
  return (
    <div
      className={cn(
        "rounded-full animate-spin",
        SIZE_CLASSES[size],
        COLOR_CLASSES[color],
        className,
      )}
    />
  );
}

/**
 * A full-page loading state with spinner and optional message.
 */
export function LoadingState({ message = "Loading..." }: { message?: string }) {
  return (
    <div className='min-h-screen flex items-center justify-center'>
      <div className='flex flex-col items-center gap-3'>
        <LoadingSpinner size='lg' />
        <div className='text-gray-500 text-[15px]'>{message}</div>
      </div>
    </div>
  );
}
