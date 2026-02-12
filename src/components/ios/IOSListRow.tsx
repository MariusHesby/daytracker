"use client";

import { cn } from "@/lib/utils";
import { ReactNode, MouseEventHandler } from "react";

interface IOSListRowProps {
  children: ReactNode;
  className?: string;
  onClick?: MouseEventHandler<HTMLDivElement>;
  showChevron?: boolean;
  showSeparator?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  subtitle?: string;
  destructive?: boolean;
}

export function IOSListRow({
  children,
  className,
  onClick,
  showChevron = false,
  showSeparator = true,
  leading,
  trailing,
  subtitle,
  destructive = false,
}: IOSListRowProps) {
  const isClickable = !!onClick;

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative flex items-center min-h-[44px] px-4",
        isClickable &&
          "active:bg-gray-100 dark:active:bg-gray-700 cursor-pointer",
        className
      )}>
      {leading && <div className='mr-3 flex-shrink-0'>{leading}</div>}

      <div
        className={cn(
          "flex-1 py-3 flex items-center justify-between",
          showSeparator && "border-b border-gray-200/80 dark:border-gray-700/80"
        )}>
        <div className='flex-1 min-w-0'>
          <div
            className={cn(
              "text-[17px]",
              destructive ? "text-red-500" : "text-gray-900 dark:text-white"
            )}>
            {children}
          </div>
          {subtitle && (
            <div className='text-[15px] text-gray-500 dark:text-gray-400 mt-0.5'>
              {subtitle}
            </div>
          )}
        </div>

        {trailing && (
          <div className='ml-2 flex-shrink-0 text-gray-500 dark:text-gray-400'>
            {trailing}
          </div>
        )}

        {showChevron && (
          <svg
            className='w-4 h-4 text-gray-400 ml-2 flex-shrink-0'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'>
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2.5}
              d='M9 5l7 7-7 7'
            />
          </svg>
        )}
      </div>
    </div>
  );
}
