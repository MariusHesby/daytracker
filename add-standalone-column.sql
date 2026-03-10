-- Add standalone column to activity_types table
-- Standalone activity types are shown as separate cards on the front page
ALTER TABLE activity_types ADD COLUMN IF NOT EXISTS standalone BOOLEAN DEFAULT FALSE;

-- Set existing checklist/todo types to standalone by default
UPDATE activity_types SET standalone = TRUE WHERE value_type = 'checklist';
