"use client";

import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface IOSCardProps {
  children: ReactNode;
  className?: string;
  padding?: "none" | "small" | "medium" | "large";
}

export function IOSCard({
  children,
  className,
  padding = "medium",
}: IOSCardProps) {
  const paddingClasses = {
    none: "",
    small: "p-3",
    medium: "p-4",
    large: "p-5",
  };

  return (
    <div
      className={cn(
        "bg-white dark:bg-ios-card-dark rounded-xl",
        paddingClasses[padding],
        className
      )}>
      {children}
    </div>
  );
}
