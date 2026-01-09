-- Check if activity_type_ids in shares actually exist in activity_types table

-- For each share, check if the activity_type_ids exist
SELECT 
  s.id as share_id,
  s.owner_id,
  s.viewer_id,
  s.activity_type_ids,
  at.id as found_activity_id,
  at.name as activity_name,
  at.user_id as activity_owner
FROM shares s
LEFT JOIN activity_types at ON at.id = ANY(s.activity_type_ids) AND at.user_id = s.owner_id;

-- Show all activity_types per user
SELECT user_id, id, name FROM activity_types ORDER BY user_id, name;

-- Check which activity_type_ids from shares don't exist
SELECT 
  s.id as share_id,
  s.owner_id,
  unnest(s.activity_type_ids) as activity_type_id
FROM shares s
WHERE NOT EXISTS (
  SELECT 1 FROM activity_types at 
  WHERE at.id = ANY(s.activity_type_ids) 
  AND at.user_id = s.owner_id
);
