# DayTracker - AI Copilot Instructions

## Project Overview

DayTracker is a **Next.js 16 PWA** for daily life logging with an iOS-style UI. It tracks activities (meals, workouts, media, mood) with **offline-first architecture**: IndexedDB for anonymous users, Supabase for authenticated users.

## Architecture

### Data Flow Pattern

```
User Action → AppContext → db.ts (IndexedDB) OR supabase-sync.ts (Supabase)
                 ↓
            AuthContext checks user → routes to appropriate storage
```

- **Anonymous**: Data stored in IndexedDB (`src/lib/db.ts`)
- **Authenticated**: Data synced to Supabase (`src/lib/supabase-sync.ts`)
- Context providers in `layout.tsx` wrap in order: Auth → Language → Theme → App → PeriodAlert

### Key Types (`src/types/index.ts`)

- `ActivityType`: Defines trackable activities with `valueType` determining input UI:
  - `text`, `boolean`, `checkmark`, `counter`, `mood`, `nutrition`, `workout`
- `LogEntry`: Individual log entries with polymorphic data (`nutritionData`, `workoutData`, media fields)
- Database uses snake_case (`activity_type_id`), app uses camelCase (`activityTypeId`)

### Component Patterns

**iOS Components** (`src/components/ios/`):
Use these for consistent styling:

```tsx
import { IOSCard, IOSModal, IOSList, IOSListRow } from "@/components/ios";
```

**Barrel exports** (`src/components/index.ts`):

```tsx
import { EntryForm, DateNavigator, Icon } from "@/components";
```

**Styling**: Tailwind v4 with iOS CSS variables. Use semantic classes:

```tsx
className = "bg-ios-bg dark:bg-ios-bg-dark text-ios-label";
```

## Development Commands

```bash
npm run dev    # Start dev server at localhost:3000
npm run build  # Production build
npm run lint   # ESLint check
```

## Database Schema Changes

SQL migrations are in root directory (e.g., `add-workout-routines-column.sql`). Run in Supabase SQL Editor. Always:

1. Use `IF NOT EXISTS` for safety
2. Add column comments for documentation
3. Update `DbActivityType`/`DbLogEntry` types in `src/lib/supabase.ts`
4. Update converter functions in `src/lib/supabase-sync.ts`

## Conventions

### Import Paths

Always use `@/` alias: `import { useApp } from "@/context/AppContext"`

### Context Hooks

```tsx
const { entries, addEntry, selectedDate } = useApp();
const { user, profile } = useAuth();
```

### Adding New Activity Value Types

1. Add type to `valueType` union in `src/types/index.ts`
2. Add input UI in `EntryForm.tsx` (large file ~2300 lines - search for existing `valueType` handlers)
3. Update `DbActivityType.value_type` in `src/lib/supabase.ts`

### Icons

Use `Icon` component with names from `src/components/Icons.tsx`:

```tsx
<Icon name='workout' className='w-5 h-5' />
```

## Environment Variables

Required in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_TMDB_API_KEY=    # For media search
```

## Common Gotchas

- Date strings use `YYYY-MM-DD` format (ISO date, no time)
- `"use client"` required at top of any file using hooks or browser APIs
- IndexedDB operations are async - always `await` database calls
- Supabase RLS policies control data access - check `supabase-sharing-schema.sql` for sharing logic
