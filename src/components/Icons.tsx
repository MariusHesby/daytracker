"use client";

import { ReactNode } from "react";
import {
  Tv,
  Film,
  Plane,
  Drumstick,
  Wine,
  Dumbbell,
  Calendar,
  Home,
  Droplet,
  Moon,
  UtensilsCrossed,
  PlusCircle,
  Bike,
  Car,
  PersonStanding,
  Footprints,
  Heart,
  Coffee,
  BookOpen,
  Music,
  Droplets,
  Flower2,
  Gamepad2,
  Star,
  Apple,
  Scale,
  Flame,
  Target,
  ListTodo,
  Utensils,
  Circle,
  Rabbit,
  type LucideIcon,
} from "lucide-react";

// Map icon names to Lucide components
const lucideIcons: Record<string, LucideIcon> = {
  tv: Tv,
  movie: Film,
  travel: Plane,
  protein: Drumstick,
  alcohol: Wine,
  workout: Dumbbell,
  event: Calendar,
  kidsAway: Home,
  period: Droplet,
  sleep: Moon,
  meal: UtensilsCrossed,
  other: PlusCircle,
  bicycle: Bike,
  car: Car,
  running: PersonStanding,
  walking: Footprints,
  heart: Heart,
  coffee: Coffee,
  book: BookOpen,
  music: Music,
  water: Droplets,
  meditation: Flower2,
  gaming: Gamepad2,
  star: Star,
  apple: Apple,
  scale: Scale,
  fire: Flame,
  target: Target,
  checklist: ListTodo,
  restaurant: Utensils,
  run: Rabbit,
  ball: Circle,
};

// Legacy icons object for backwards compatibility
export const icons = Object.fromEntries(
  Object.entries(lucideIcons).map(([name, LucideComponent]) => [
    name,
    <LucideComponent key={name} className='w-6 h-6' strokeWidth={2} />,
  ]),
) as Record<string, ReactNode>;

export type IconName = keyof typeof lucideIcons;

// Icon picker component
interface IconPickerProps {
  selectedIcon: IconName | string;
  onSelect: (icon: IconName) => void;
}

export function IconPicker({ selectedIcon, onSelect }: IconPickerProps) {
  const iconNames = Object.keys(lucideIcons) as IconName[];

  return (
    <div className='grid grid-cols-4 gap-2'>
      {iconNames.map((name) => {
        const LucideComponent = lucideIcons[name];
        return (
          <button
            key={name}
            type='button'
            onClick={() => onSelect(name as IconName)}
            className={`
              p-3 rounded-xl transition-all transform hover:scale-110
              flex items-center justify-center
              ${
                selectedIcon === name
                  ? "bg-gradient-to-br from-purple-400 to-pink-400 text-white shadow-lg scale-110"
                  : "bg-white/50 dark:bg-purple-800/30 text-purple-600 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-700/50"
              }
            `}
            title={name}>
            <LucideComponent className='w-6 h-6' strokeWidth={2} />
          </button>
        );
      })}
    </div>
  );
}

// Render icon by name
export function Icon({
  name,
  className = "w-6 h-6",
  strokeWidth = 2,
}: {
  name: IconName | string;
  className?: string;
  strokeWidth?: number;
}) {
  const LucideComponent = lucideIcons[name as IconName];
  if (!LucideComponent) {
    // Fallback to emoji if it's not a known icon
    return <span className={className}>{name}</span>;
  }
  return <LucideComponent className={className} strokeWidth={strokeWidth} />;
}
