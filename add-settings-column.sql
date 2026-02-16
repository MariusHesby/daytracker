-- Add settings column to profiles table for syncing app settings across devices

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';

-- The settings column can store:
-- {
--   "football_api_key": "your-api-key",
--   "football_team": { ... FavoriteTeamConfig ... }
-- }
