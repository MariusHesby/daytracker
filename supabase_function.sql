-- This SQL function should be run in your Supabase SQL Editor
-- It allows viewers to check last activity dates for shared activity types

CREATE OR REPLACE FUNCTION get_shared_activity_dates(
  p_owner_id UUID,
  p_viewer_id UUID,
  p_activity_type_ids UUID[]
)
RETURNS TABLE (
  activity_type_id UUID,
  last_updated TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- First verify that a valid share exists
  IF NOT EXISTS (
    SELECT 1 FROM shares 
    WHERE owner_id = p_owner_id 
    AND viewer_id = p_viewer_id
  ) THEN
    RETURN;
  END IF;

  -- Return the latest entry date for each activity type
  RETURN QUERY
  SELECT DISTINCT ON (e.activity_type_id)
    e.activity_type_id,
    GREATEST(e.created_at, e.updated_at) as last_updated
  FROM log_entries e
  WHERE e.user_id = p_owner_id
    AND e.activity_type_id = ANY(p_activity_type_ids)
  ORDER BY e.activity_type_id, GREATEST(e.created_at, e.updated_at) DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_shared_activity_dates TO authenticated;

-- Function to get entries from multiple shared users (for favorites feature)
CREATE OR REPLACE FUNCTION get_shared_entries(
  p_viewer_id UUID,
  p_owner_ids UUID[]
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  activity_type_id UUID,
  date DATE,
  value TEXT,
  note TEXT,
  imdb_id TEXT,
  poster TEXT,
  imdb_rating TEXT,
  year TEXT,
  user_rating INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.user_id,
    e.activity_type_id,
    e.date,
    e.value::TEXT,
    e.note,
    e.imdb_id,
    e.poster,
    e.imdb_rating,
    e.year,
    e.user_rating,
    e.created_at,
    e.updated_at
  FROM log_entries e
  INNER JOIN shares s ON s.owner_id = e.user_id AND s.viewer_id = p_viewer_id
  WHERE e.user_id = ANY(p_owner_ids)
    AND e.activity_type_id = ANY(s.activity_type_ids);
END;
$$;

GRANT EXECUTE ON FUNCTION get_shared_entries TO authenticated;
