-- Add checklist_data column to log_entries table
ALTER TABLE log_entries ADD COLUMN IF NOT EXISTS checklist_data jsonb DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN log_entries.checklist_data IS 'Stores checklist items with id, text, and completed status';
