-- Add coach_config to activity_types and coach_data to log_entries
alter table public.activity_types
  add column if not exists coach_config jsonb default null;

alter table public.log_entries
  add column if not exists coach_data jsonb default null;

-- Update value_type check constraint to include 'coach' (and 'timer' if not already present)
alter table public.activity_types
  drop constraint if exists activity_types_value_type_check;

alter table public.activity_types
  add constraint activity_types_value_type_check
  check (value_type in (
    'text', 'boolean', 'checkmark', 'counter', 'mood',
    'nutrition', 'workout', 'checklist', 'timer', 'coach'
  ));
