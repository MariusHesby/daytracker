-- Add checklist_repeat column to activity_types table
-- This column stores the repeat frequency for checklist-type activities
-- Values: 'none', 'daily', 'weekly', 'monthly' (or NULL for no repeat)

ALTER TABLE activity_types
ADD COLUMN IF NOT EXISTS checklist_repeat TEXT DEFAULT NULL;

-- Add a check constraint for valid values
ALTER TABLE activity_types
ADD CONSTRAINT checklist_repeat_valid
CHECK (checklist_repeat IS NULL OR checklist_repeat IN ('none', 'daily', 'weekly', 'monthly'));
