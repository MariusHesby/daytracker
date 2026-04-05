-- Add show_daily_goals, show_protein_map, and food_icons columns to activity_types
ALTER TABLE activity_types ADD COLUMN IF NOT EXISTS show_daily_goals BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE activity_types ADD COLUMN IF NOT EXISTS show_protein_map BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE activity_types ADD COLUMN IF NOT EXISTS food_icons JSONB DEFAULT NULL;
