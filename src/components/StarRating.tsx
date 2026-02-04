"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

export interface StarRatingProps {
  rating?: number;
  onRate?: (rating: number) => void;
  size?: "sm" | "md" | "lg";
  wrap?: boolean;
}

const SIZE_CLASSES = { sm: "w-5 h-5", md: "w-6 h-6", lg: "w-7 h-7" };

/**
 * A 10-star rating component with touch and mouse support.
 * Supports drag-to-rate on touch devices.
 */
export function StarRating({
  rating,
  onRate,
  size = "md",
  wrap = false,
}: StarRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const justTouchedRef = useRef(false);
  const displayRating = hovered ?? rating ?? 0;

  const getRatingFromPosition = useCallback((clientX: number) => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const starWidth = rect.width / 10;
    const star = Math.ceil(x / starWidth);
    return Math.max(1, Math.min(10, star));
  }, []);

  // Handle click - but ignore if we just handled a touch
  const handleClick = useCallback(
    (star: number) => {
      if (justTouchedRef.current) {
        // Ignore synthetic click after touch
        return;
      }
      onRate?.(star);
    },
    [onRate],
  );

  // Use native event listeners for better touch control
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onTouchStart = (e: TouchEvent) => {
      e.stopPropagation();
      e.preventDefault();
      justTouchedRef.current = true;
      setIsDragging(true);
      const rating = getRatingFromPosition(e.touches[0].clientX);
      if (rating) setHovered(rating);
    };

    const onTouchMove = (e: TouchEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const rating = getRatingFromPosition(e.touches[0].clientX);
      if (rating) setHovered(rating);
    };

    const onTouchEnd = (e: TouchEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setIsDragging(false);
      // Reset touch flag after a delay to ignore synthetic click
      setTimeout(() => {
        justTouchedRef.current = false;
      }, 300);
    };

    container.addEventListener("touchstart", onTouchStart, { passive: false });
    container.addEventListener("touchmove", onTouchMove, { passive: false });
    container.addEventListener("touchend", onTouchEnd, { passive: false });

    return () => {
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", onTouchEnd);
    };
  }, [getRatingFromPosition]);

  // Save rating when dragging ends with a hovered value
  useEffect(() => {
    if (!isDragging && hovered !== null && onRate) {
      onRate(hovered);
      setHovered(null);
    }
  }, [isDragging, hovered, onRate]);

  return (
    <div
      ref={containerRef}
      data-no-swipe
      className={cn(
        "flex gap-1 touch-none select-none",
        wrap && "flex-wrap justify-center",
      )}
      style={{ touchAction: "none" }}>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
        <button
          key={star}
          type='button'
          data-no-swipe
          onClick={() => handleClick(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(null)}
          className='transition-transform hover:scale-110 touch-none'
          style={{ touchAction: "none" }}>
          <svg
            className={cn(
              SIZE_CLASSES[size],
              star <= displayRating
                ? "text-amber-400 fill-amber-400"
                : "text-gray-300 dark:text-gray-600 fill-gray-300 dark:fill-gray-600",
            )}
            viewBox='0 0 24 24'>
            <path d='M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' />
          </svg>
        </button>
      ))}
    </div>
  );
}
