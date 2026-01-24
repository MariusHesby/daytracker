-- Add is_watchlist column to log_entries table for watchlist functionality
-- Run this migration in Supabase SQL Editor

ALTER TABLE log_entries 
ADD COLUMN IF NOT EXISTS is_watchlist BOOLEAN DEFAULT NULL;

-- Create an index for faster filtering
CREATE INDEX IF NOT EXISTS idx_log_entries_is_watchlist 
ON log_entries(user_id, is_watchlist) 
WHERE is_watchlist = true;

-- Add comment for documentation
COMMENT ON COLUMN log_entries.is_watchlist IS 'True if this entry is a watchlist item (want to watch), null/false if already watched';
