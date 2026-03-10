-- Add checklist_template column to activity_types
-- This stores the master template of items for repeating checklists,
-- with each item having an addedDate so items accumulate over time.
ALTER TABLE activity_types 
ADD COLUMN IF NOT EXISTS checklist_template JSONB DEFAULT NULL;
