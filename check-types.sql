-- STEP 1: Check data types first
-- Run this to see what types your columns have

SELECT 
  column_name, 
  data_type, 
  udt_name
FROM information_schema.columns 
WHERE table_name IN ('activity_types', 'log_entries', 'shares')
  AND column_name IN ('id', 'activity_type_id', 'activity_type_ids', 'user_id', 'owner_id', 'viewer_id')
ORDER BY table_name, column_name;

-- STEP 2: Check if shares table has correct definition
SELECT column_name, data_type, udt_name 
FROM information_schema.columns 
WHERE table_name = 'shares';
