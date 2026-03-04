-- Add timer_config column to activity_types table
ALTER TABLE activity_types ADD COLUMN IF NOT EXISTS timer_config jsonb DEFAULT NULL;
COMMENT ON COLUMN activity_types.timer_config IS 'Config for timer/screen time tracking: subjects (names), limitMinutes, limitPeriod (daily/weekly/monthly)';

-- Add timer_data column to log_entries table
ALTER TABLE log_entries ADD COLUMN IF NOT EXISTS timer_data jsonb DEFAULT NULL;
COMMENT ON COLUMN log_entries.timer_data IS 'Stores per-subject time entries for a day: { entries: [{ subjectId, minutes }] }';
