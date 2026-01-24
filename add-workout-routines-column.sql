-- Add workout_routines column to activity_types table
-- Run this migration in Supabase SQL Editor

ALTER TABLE activity_types 
ADD COLUMN IF NOT EXISTS workout_routines JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN activity_types.workout_routines IS 'JSON array of workout routines/groups for organizing exercises';
