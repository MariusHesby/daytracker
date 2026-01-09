-- Fix shares where activity_type_ids don't match any existing activity_types
-- This updates broken shares to include ALL of the owner's current activity types

-- First, let's see which shares are broken (preview)
SELECT 
  s.id as share_id,
  s.owner_id,
  s.viewer_id,
  s.activity_type_ids as old_ids,
  array_agg(at.id) as new_ids
FROM shares s
LEFT JOIN activity_types at ON at.user_id = s.owner_id
WHERE NOT EXISTS (
  SELECT 1 FROM activity_types at2 
  WHERE at2.id = ANY(s.activity_type_ids) 
  AND at2.user_id = s.owner_id
)
GROUP BY s.id, s.owner_id, s.viewer_id, s.activity_type_ids;

-- Now fix them by updating with owner's current activity_type_ids
UPDATE shares s
SET activity_type_ids = (
  SELECT array_agg(at.id)
  FROM activity_types at
  WHERE at.user_id = s.owner_id
)
WHERE NOT EXISTS (
  SELECT 1 FROM activity_types at2 
  WHERE at2.id = ANY(s.activity_type_ids) 
  AND at2.user_id = s.owner_id
);

-- Verify the fix
SELECT 
  s.id as share_id,
  s.owner_id,
  s.viewer_id,
  s.activity_type_ids,
  (SELECT array_agg(at.name) FROM activity_types at WHERE at.id = ANY(s.activity_type_ids)) as shared_activities
FROM shares s;
