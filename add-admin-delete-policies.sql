-- Add admin delete policies for all tables
-- Run this migration in Supabase SQL Editor
-- Replace the admin email if needed

-- Define admin email
DO $$
DECLARE
  admin_email TEXT := 'marius.r.hesby@gmail.com';
BEGIN
  -- We'll use this in the policies below
END $$;

-- Drop existing delete policies if they exist and recreate with admin access

-- Profiles table
DROP POLICY IF EXISTS "Admin can delete any profile" ON profiles;
CREATE POLICY "Admin can delete any profile" ON profiles
  FOR DELETE USING (
    auth.jwt() ->> 'email' = 'marius.r.hesby@gmail.com'
  );

-- Log entries table
DROP POLICY IF EXISTS "Admin can delete any log entry" ON log_entries;
CREATE POLICY "Admin can delete any log entry" ON log_entries
  FOR DELETE USING (
    auth.jwt() ->> 'email' = 'marius.r.hesby@gmail.com'
  );

-- Activity types table
DROP POLICY IF EXISTS "Admin can delete any activity type" ON activity_types;
CREATE POLICY "Admin can delete any activity type" ON activity_types
  FOR DELETE USING (
    auth.jwt() ->> 'email' = 'marius.r.hesby@gmail.com'
  );

-- Suggestions table
DROP POLICY IF EXISTS "Admin can delete any suggestion" ON suggestions;
CREATE POLICY "Admin can delete any suggestion" ON suggestions
  FOR DELETE USING (
    auth.jwt() ->> 'email' = 'marius.r.hesby@gmail.com'
  );

-- Locked days table
DROP POLICY IF EXISTS "Admin can delete any locked day" ON locked_days;
CREATE POLICY "Admin can delete any locked day" ON locked_days
  FOR DELETE USING (
    auth.jwt() ->> 'email' = 'marius.r.hesby@gmail.com'
  );

-- Shared access table (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shared_access') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admin can delete any shared access" ON shared_access';
    EXECUTE 'CREATE POLICY "Admin can delete any shared access" ON shared_access
      FOR DELETE USING (
        auth.jwt() ->> ''email'' = ''marius.r.hesby@gmail.com''
      )';
  END IF;
END $$;

-- Verify policies were created
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE policyname LIKE 'Admin can delete%'
ORDER BY tablename;
