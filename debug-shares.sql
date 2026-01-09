-- DEBUG: Check shares and activity_type_ids
-- Run this in Supabase SQL Editor to see what's in the shares table

-- Show all shares with their activity_type_ids
SELECT 
  s.id,
  s.owner_id,
  s.viewer_id,
  s.activity_type_ids,
  array_length(s.activity_type_ids, 1) as num_activities,
  sr.from_email as owner_email,
  sr.to_email as viewer_email
FROM shares s
LEFT JOIN share_requests sr ON (sr.from_user_id = s.owner_id OR sr.from_user_id = s.viewer_id)
GROUP BY s.id, s.owner_id, s.viewer_id, s.activity_type_ids, sr.from_email, sr.to_email;

-- Show all share_requests
SELECT * FROM share_requests ORDER BY created_at DESC;

-- Show all shares
SELECT * FROM shares;
