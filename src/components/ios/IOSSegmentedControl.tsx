"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";

interface IOSSegmentedControlProps {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function IOSSegmentedControl({
  options,
  value,
  onChange,
  className,
}: IOSSegmentedControlProps) {
  const selectedIndex = options.findIndex((o) => o.value === value);

  return (
    <div
      className={cn(
        "relative flex p-0.5 bg-gray-200/80 dark:bg-gray-700 rounded-lg",
        className
      )}>
      {/* Sliding background */}
      <div
        className='absolute top-0.5 bottom-0.5 bg-white dark:bg-gray-600 rounded-md shadow-sm transition-transform duration-200'
        style={{
          width: `calc(${100 / options.length}% - 2px)`,
          transform: `translateX(calc(${selectedIndex * 100}% + ${
            selectedIndex * 2
          }px))`,
        }}
      />

      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "relative z-10 flex-1 py-1.5 px-3 text-[13px] font-medium rounded-md transition-colors",
            value === option.value
              ? "text-gray-900 dark:text-white"
              : "text-gray-500 dark:text-gray-400"
          )}>
          {option.label}
        </button>
      ))}
    </div>
  );
}
