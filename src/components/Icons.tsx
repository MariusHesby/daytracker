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
  Volleyball,
  Rabbit,
  Brain,
  Bell,
  Clock,
  CookingPot,
  Beef,
  Fish,
  Shrimp,
  Egg,
  EggFried,
  Milk,
  Wheat,
  Croissant,
  Sandwich,
  Soup,
  Bean,
  Nut,
  Vegan,
  Salad,
  LeafyGreen,
  Carrot,
  Banana,
  Cherry,
  Citrus,
  Grape,
  Pizza,
  Hamburger,
  CupSoda,
  GlassWater,
  CakeSlice,
  Candy,
  Cookie,
  IceCreamCone,
  Popcorn,
  Leaf,
  Ham,
  Slice,
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
  ball: Volleyball,
  brain: Brain,
  bell: Bell,
  clock: Clock,
  hotFood: CookingPot,
  // Food icons
  chicken: Drumstick,
  beef: Beef,
  pork: Ham,
  fish: Fish,
  shrimp: Shrimp,
  egg: Egg,
  eggFried: EggFried,
  milk: Milk,
  wheat: Wheat,
  croissant: Croissant,
  sandwich: Sandwich,
  soup: Soup,
  bean: Bean,
  nut: Nut,
  vegan: Vegan,
  salad: Salad,
  leafyGreen: LeafyGreen,
  carrot: Carrot,
  banana: Banana,
  cherry: Cherry,
  citrus: Citrus,
  grape: Grape,
  pizza: Pizza,
  burger: Hamburger,
  cupSoda: CupSoda,
  glassWater: GlassWater,
  cakeSlice: CakeSlice,
  candy: Candy,
  cookie: Cookie,
  iceCream: IceCreamCone,
  popcorn: Popcorn,
  leaf: Leaf,
  ham: Ham,
  crispBread: Slice,
};

// Custom crisp bread icon - flat cracker with holes
const CrispBreadIcon = ({
  className,
  strokeWidth = 1.5,
  ...props
}: {
  className?: string;
  strokeWidth?: number;
  [key: string]: unknown;
}) => (
  <svg
    xmlns='http://www.w3.org/2000/svg'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth={strokeWidth}
    strokeLinecap='round'
    strokeLinejoin='round'
    className={className}
    {...props}>
    {/* Flat rectangular cracker shape with rounded corners */}
    <rect x='3' y='7' width='18' height='10' rx='1.5' />
    {/* Dot pattern like a cracker */}
    <circle cx='7.5' cy='10' r='0.8' fill='currentColor' stroke='none' />
    <circle cx='12' cy='10' r='0.8' fill='currentColor' stroke='none' />
    <circle cx='16.5' cy='10' r='0.8' fill='currentColor' stroke='none' />
    <circle cx='7.5' cy='14' r='0.8' fill='currentColor' stroke='none' />
    <circle cx='12' cy='14' r='0.8' fill='currentColor' stroke='none' />
    <circle cx='16.5' cy='14' r='0.8' fill='currentColor' stroke='none' />
    <circle cx='9.75' cy='12' r='0.8' fill='currentColor' stroke='none' />
    <circle cx='14.25' cy='12' r='0.8' fill='currentColor' stroke='none' />
  </svg>
);

type CustomIconProps = {
  className?: string;
  strokeWidth?: number;
  [key: string]: unknown;
};

// Custom pig icon - side profile silhouette
const PigIcon = ({
  className,
  strokeWidth = 1.5,
  ...props
}: CustomIconProps) => (
  <svg
    xmlns='http://www.w3.org/2000/svg'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth={strokeWidth}
    strokeLinecap='round'
    strokeLinejoin='round'
    className={className}
    {...props}>
    {/* Body outline - side profile pig */}
    <path d='M4 14 C4 10, 6 7, 10 7 L15 7 C18 7, 20 9, 20 12 C20 14, 19 16, 16 16 L8 16 C5 16, 4 15, 4 14 Z' />
    {/* Snout */}
    <path d='M20 11 L22 10.5 L22 12.5 L20 12' />
    {/* Eye */}
    <circle cx='17' cy='10' r='0.6' fill='currentColor' stroke='none' />
    {/* Ear */}
    <path d='M16 7 L15.5 4.5 L18 6.5' />
    {/* Tail - curly */}
    <path d='M4 12 C2.5 11, 2 12.5, 3 13' />
    {/* Front leg */}
    <line x1='15' y1='16' x2='15' y2='20' />
    <line x1='13' y1='16' x2='13' y2='20' />
    {/* Back leg */}
    <line x1='8' y1='16' x2='8' y2='20' />
    <line x1='6' y1='16' x2='6' y2='20' />
  </svg>
);

// Custom cow icon - side profile silhouette
const CowIcon = ({
  className,
  strokeWidth = 1.5,
  ...props
}: CustomIconProps) => (
  <svg
    xmlns='http://www.w3.org/2000/svg'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth={strokeWidth}
    strokeLinecap='round'
    strokeLinejoin='round'
    className={className}
    {...props}>
    {/* Body */}
    <path d='M3 13 C3 10, 5 8, 8 8 L16 8 C18 8, 19 9, 19 11 L19 14 C19 15, 18 16, 16 16 L6 16 C4 16, 3 15, 3 13 Z' />
    {/* Head - extends right from body */}
    <path d='M19 10 L21 8.5 C22 8, 23 8.5, 23 9.5 L23 11.5 C23 12, 22.5 12.5, 22 12.5 L19 12' />
    {/* Horns */}
    <path d='M21 8.5 L20 6' />
    <path d='M22 8 L23 6' />
    {/* Eye */}
    <circle cx='21' cy='10' r='0.5' fill='currentColor' stroke='none' />
    {/* Ear */}
    <path d='M20.5 8.5 C20 7.5, 19 7.5, 19.5 8.5' />
    {/* Udder */}
    <path d='M10 16 Q10 17.5, 9 17.5 Q8 17.5, 8 16' />
    {/* Front legs */}
    <line x1='15' y1='16' x2='15' y2='20' />
    <line x1='17' y1='16' x2='17' y2='20' />
    {/* Back legs */}
    <line x1='5' y1='16' x2='5' y2='20' />
    <line x1='7' y1='16' x2='7' y2='20' />
    {/* Tail */}
    <path d='M3 10 C1.5 9, 1 11, 2 12' />
  </svg>
);

// Custom duck icon - side profile silhouette
const DuckIcon = ({
  className,
  strokeWidth = 1.5,
  ...props
}: CustomIconProps) => (
  <svg
    xmlns='http://www.w3.org/2000/svg'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth={strokeWidth}
    strokeLinecap='round'
    strokeLinejoin='round'
    className={className}
    {...props}>
    {/* Body - plump, low */}
    <path d='M4 15 C4 12, 6 10, 10 10 L15 10 C18 10, 20 12, 19 15 C18 17, 15 18, 10 18 C6 18, 4 17, 4 15 Z' />
    {/* Neck going up */}
    <path d='M18 11 C19 9, 19 7, 18.5 6' />
    <path d='M20 11 C21 9, 20.5 7, 20 6' />
    {/* Head */}
    <circle cx='19' cy='5.5' r='2' />
    {/* Eye */}
    <circle cx='19.8' cy='5' r='0.5' fill='currentColor' stroke='none' />
    {/* Beak - flat */}
    <path d='M21 5.5 L23.5 5 L23.5 6.5 L21 6.5' />
    {/* Tail feathers - pointing up */}
    <path d='M4 14 L2 11 L3 11.5' />
    <path d='M4.5 13.5 L3 10.5' />
    {/* Legs */}
    <line x1='10' y1='18' x2='10' y2='21' />
    <line x1='13' y1='18' x2='13' y2='21' />
    {/* Feet */}
    <path d='M10 21 L8.5 21.5' />
    <path d='M13 21 L11.5 21.5' />
  </svg>
);

// Custom lamb icon - side profile silhouette with wool
const LambIcon = ({
  className,
  strokeWidth = 1.5,
  ...props
}: CustomIconProps) => (
  <svg
    xmlns='http://www.w3.org/2000/svg'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth={strokeWidth}
    strokeLinecap='round'
    strokeLinejoin='round'
    className={className}
    {...props}>
    {/* Woolly body - bumpy outline */}
    <path d='M5 15 C4 14, 4 12, 5 11 C4.5 10, 5 9, 6 8.5 C6 7.5, 7 7, 8 7 C8.5 6, 10 5.5, 11 6 C12 5.5, 13.5 5.5, 14 6.5 C15 6, 16 6.5, 16.5 7.5 C17.5 7.5, 18 8.5, 18 9.5 C19 10, 19 11, 18.5 12 C19 13, 19 14.5, 18 15.5 L18 16 L5 16 Z' />
    {/* Head - extends right, lower */}
    <path d='M18 11 L20.5 10.5 C21.5 10.5, 22 11, 22 12 C22 13, 21.5 13.5, 20.5 13.5 L18 13' />
    {/* Ear */}
    <path d='M20 10.5 C20.5 9.5, 19.5 9, 19 10' />
    {/* Eye */}
    <circle cx='20.5' cy='11.5' r='0.5' fill='currentColor' stroke='none' />
    {/* Nose */}
    <circle cx='21.5' cy='12.5' r='0.3' fill='currentColor' stroke='none' />
    {/* Front legs */}
    <line x1='15' y1='16' x2='15' y2='20' />
    <line x1='17' y1='16' x2='17' y2='20' />
    {/* Back legs */}
    <line x1='6' y1='16' x2='6' y2='20' />
    <line x1='8' y1='16' x2='8' y2='20' />
    {/* Tail */}
    <path d='M5 13 C4 12, 4 14, 5 14.5' />
  </svg>
);

// Custom cheese icon - wedge with holes
const CheeseIcon = ({
  className,
  strokeWidth = 1.5,
  ...props
}: CustomIconProps) => (
  <svg
    xmlns='http://www.w3.org/2000/svg'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth={strokeWidth}
    strokeLinecap='round'
    strokeLinejoin='round'
    className={className}
    {...props}>
    {/* Cheese wedge - triangular side profile */}
    <path d='M2 17 L22 17 L22 11 Z' />
    {/* Top edge */}
    <line x1='2' y1='17' x2='22' y2='17' />
    {/* Holes */}
    <circle cx='14' cy='14.5' r='1.3' />
    <circle cx='9' cy='15.5' r='0.9' />
    <circle cx='18' cy='14' r='0.8' />
  </svg>
);

// Custom cottage cheese icon - bowl with lumpy texture
const CottageCheeseIcon = ({
  className,
  strokeWidth = 1.5,
  ...props
}: CustomIconProps) => (
  <svg
    xmlns='http://www.w3.org/2000/svg'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth={strokeWidth}
    strokeLinecap='round'
    strokeLinejoin='round'
    className={className}
    {...props}>
    {/* Bowl */}
    <path d='M3 12 C3 12, 4 19, 12 19 C20 19, 21 12, 21 12' />
    {/* Bowl rim */}
    <line x1='2' y1='12' x2='22' y2='12' />
    {/* Lumpy cottage cheese top */}
    <path d='M6 12 C6 10.5, 7.5 9.5, 9 10.5' />
    <path d='M9 10.5 C9.5 9, 11 8.5, 12 10' />
    <path d='M12 10 C12.5 8.5, 14.5 8.5, 15 10' />
    <path d='M15 10 C15.5 9, 17 9.5, 18 12' />
  </svg>
);

// Custom yoghurt icon - cup/container with spoon
const YoghurtIcon = ({
  className,
  strokeWidth = 1.5,
  ...props
}: CustomIconProps) => (
  <svg
    xmlns='http://www.w3.org/2000/svg'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth={strokeWidth}
    strokeLinecap='round'
    strokeLinejoin='round'
    className={className}
    {...props}>
    {/* Cup body - tapered */}
    <path d='M6 8 L7.5 20 L16.5 20 L18 8' />
    {/* Lid/rim */}
    <rect x='5' y='6' width='14' height='2' rx='0.5' />
    {/* Foil top detail */}
    <path d='M8 6 C9 4.5, 11 4, 12 4.5 C13 4, 15 4.5, 16 6' />
    {/* Label line */}
    <line x1='8' y1='13' x2='16' y2='13' />
    <line x1='9' y1='15' x2='15' y2='15' />
  </svg>
);

// Combined icons map including custom icons
const allIcons: Record<string, LucideIcon | typeof CrispBreadIcon> = {
  ...lucideIcons,
  crispBread2: CrispBreadIcon,
  pig: PigIcon,
  cow: CowIcon,
  duck: DuckIcon,
  lamb: LambIcon,
  cheese: CheeseIcon,
  cottageCheese: CottageCheeseIcon,
  yoghurt: YoghurtIcon,
};

// Legacy icons object for backwards compatibility
export const icons = Object.fromEntries(
  Object.entries(lucideIcons).map(([name, LucideComponent]) => [
    name,
    <LucideComponent key={name} className='w-6 h-6' strokeWidth={1.5} />,
  ]),
) as Record<string, ReactNode>;

export type IconName = keyof typeof lucideIcons;

// Icon picker component
interface IconPickerProps {
  selectedIcon: IconName | string;
  onSelect: (icon: IconName) => void;
}

export function IconPicker({ selectedIcon, onSelect }: IconPickerProps) {
  const iconNames = Object.keys(allIcons) as IconName[];

  return (
    <div className='grid grid-cols-4 gap-2'>
      {iconNames.map((name) => {
        const LucideComponent = allIcons[name];
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
            <LucideComponent className='w-6 h-6' strokeWidth={1.5} />
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
  strokeWidth,
}: {
  name: IconName | string;
  className?: string;
  strokeWidth?: number;
}) {
  const LucideComponent = allIcons[name as string];
  if (!LucideComponent) {
    // Fallback to emoji if it's not a known icon
    return <span className={className}>{name}</span>;
  }
  return (
    <LucideComponent className={className} strokeWidth={strokeWidth ?? 1.5} />
  );
}
