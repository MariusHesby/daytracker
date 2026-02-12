"use client";

import { cn } from "@/lib/utils";
import { ReactNode, useEffect, useRef, useState } from "react";

interface IOSHeaderProps {
  title: string;
  largeTitle?: boolean;
  leftButton?: ReactNode;
  rightButton?: ReactNode;
  className?: string;
  scrollRef?: React.RefObject<HTMLElement | null>;
}

export function IOSHeader({
  title,
  largeTitle = true,
  leftButton,
  rightButton,
  className,
  scrollRef,
}: IOSHeaderProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (!largeTitle || !scrollRef?.current) return;

    const element = scrollRef.current;
    const handleScroll = () => {
      setIsCollapsed(element.scrollTop > 40);
    };

    element.addEventListener("scroll", handleScroll);
    return () => element.removeEventListener("scroll", handleScroll);
  }, [largeTitle, scrollRef]);

  return (
    <>
      {/* Large title */}
      {largeTitle && (
        <div
          className={cn(
            "px-4 pt-14 pb-2 bg-ios-bg dark:bg-ios-bg-dark",
            "transition-all duration-200",
            isCollapsed
              ? "opacity-0 h-0 overflow-hidden pt-0 pb-0"
              : "opacity-100"
          )}>
          <h1 className='text-[34px] font-bold text-gray-900 dark:text-white tracking-tight text-center'>
            {title}
          </h1>
        </div>
      )}
    </>
  );
}
