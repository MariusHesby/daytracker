"use client";

import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface IOSListProps {
  children: ReactNode;
  className?: string;
  header?: string;
  footer?: string;
  inset?: boolean;
}

export function IOSList({
  children,
  className,
  header,
  footer,
  inset = true,
}: IOSListProps) {
  return (
    <div className={cn("w-full", className)}>
      {header && (
        <div className='px-4 pb-2 pt-4'>
          <span className='text-[13px] text-gray-500 dark:text-gray-400 uppercase tracking-wide'>
            {header}
          </span>
        </div>
      )}
      <div
        className={cn(
          "bg-white/80 dark:bg-ios-card-dark overflow-hidden",
          inset ? "mx-4 rounded-xl" : ""
        )}>
        {children}
      </div>
      {footer && (
        <div className='px-4 pt-2 pb-4'>
          <span className='text-[13px] text-gray-500 dark:text-gray-400'>
            {footer}
          </span>
        </div>
      )}
    </div>
  );
}
