"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Log", icon: "📝" },
  { href: "/movies-tv", label: "Movies & TV", icon: "🎬" },
  { href: "/stats", label: "Stats", icon: "📊" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className='fixed bottom-0 left-0 right-0 bg-white dark:bg-[#2b2930] z-50 elevation-2'>
      <div className='max-w-lg mx-auto'>
        <div className='flex items-center justify-around py-1'>
          {navItems.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-6 py-3 rounded-2xl transition-all",
                  isActive
                    ? "bg-purple-100 dark:bg-purple-900/50"
                    : "hover:bg-gray-100 dark:hover:bg-gray-800/50"
                )}>
                <span
                  className={cn(
                    "text-2xl transition-transform",
                    isActive && "scale-110"
                  )}>
                  {item.icon}
                </span>
                <span
                  className={cn(
                    "text-xs font-medium",
                    isActive
                      ? "text-purple-700 dark:text-purple-300"
                      : "text-gray-600 dark:text-gray-400"
                  )}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
