"use client";

import { cn } from "@/lib/utils";
import { ReactNode, useEffect } from "react";

interface IOSModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  showCloseButton?: boolean;
  size?: "small" | "medium" | "large" | "fullscreen";
}

export function IOSModal({
  isOpen,
  onClose,
  title,
  children,
  showCloseButton = true,
  size = "medium",
}: IOSModalProps) {
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses = {
    small: "max-w-sm",
    medium: "max-w-md",
    large: "max-w-lg",
    fullscreen: "w-full h-full max-w-none rounded-none",
  };

  return (
    <div className='fixed inset-0 z-50 flex items-end sm:items-center justify-center'>
      {/* Backdrop */}
      <div
        className='absolute inset-0 bg-black/40 backdrop-blur-sm'
        onClick={onClose}
      />

      {/* Modal content */}
      <div
        className={cn(
          "relative w-full bg-white dark:bg-ios-card-dark rounded-t-2xl sm:rounded-2xl overflow-hidden",
          "animate-in slide-in-from-bottom duration-300",
          "max-h-[90vh] flex flex-col",
          size !== "fullscreen" && sizeClasses[size]
        )}>
        {/* Header */}
        {(title || showCloseButton) && (
          <div className='flex items-center justify-between px-4 py-3 border-b border-gray-200/80 dark:border-gray-700/80'>
            <div className='w-16'>{/* Empty space for balance */}</div>
            {title && (
              <h2 className='text-[17px] font-semibold text-gray-900 dark:text-white'>
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className='w-16 text-right text-ios-blue text-[17px]'>
                Ferdig
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className='flex-1 overflow-y-auto'>{children}</div>
      </div>
    </div>
  );
}
