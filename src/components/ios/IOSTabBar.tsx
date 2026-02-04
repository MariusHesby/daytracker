"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

interface TabItem {
  href: string;
  label: string;
  icon: ReactNode;
  activeIcon?: ReactNode;
}

interface IOSTabBarProps {
  items: TabItem[];
  className?: string;
}

export function IOSTabBar({ items, className }: IOSTabBarProps) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50",
        "bg-white/80 dark:bg-ios-card-dark/80 backdrop-blur-xl",
        "border-t border-gray-200/50 dark:border-gray-700/50",
        className,
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <div className='flex items-center justify-around pt-2 pb-1.5'>
        {items.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center flex-1",
                "transition-colors",
              )}>
              <div
                className={cn(
                  "w-6 h-6",
                  isActive
                    ? "text-ios-blue"
                    : "text-gray-400 dark:text-gray-500",
                )}>
                {isActive && item.activeIcon ? item.activeIcon : item.icon}
              </div>
              <span
                className={cn(
                  "text-[10px] mt-0.5",
                  isActive
                    ? "text-ios-blue font-medium"
                    : "text-gray-400 dark:text-gray-500",
                )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
