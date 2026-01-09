-- FIX SHARING POLICIES
-- Run this in Supabase SQL Editor to fix sharing functionality

-- ================================================
-- 0. First, fix the shares table column type if needed
-- ================================================

-- Check and alter the activity_type_ids column to UUID[] if it's not already
DO $$
BEGIN
  -- Try to alter the column type to UUID[]
  -- This will work if it's currently TEXT[] with valid UUIDs
  BEGIN
    ALTER TABLE shares ALTER COLUMN activity_type_ids TYPE UUID[] USING activity_type_ids::UUID[];
  EXCEPTION WHEN others THEN
    -- Column might already be UUID[] or conversion failed, that's ok
    RAISE NOTICE 'Column type change skipped: %', SQLERRM;
  END;
END $$;

-- ================================================
-- 1. Fix share_requests policies (use auth.jwt() for email)
-- ================================================

DROP POLICY IF EXISTS "Users can view requests they sent or received" ON share_requests;
DROP POLICY IF EXISTS "Users can create share requests" ON share_requests;
DROP POLICY IF EXISTS "Users can update requests sent to them" ON share_requests;
DROP POLICY IF EXISTS "Users can delete their own requests" ON share_requests;

CREATE POLICY "Users can view requests they sent or received"
  ON share_requests FOR SELECT
  USING (
    from_user_id = auth.uid() OR 
    to_email = (auth.jwt() ->> 'email')
  );

CREATE POLICY "Users can create share requests"
  ON share_requests FOR INSERT
  WITH CHECK (from_user_id = auth.uid());

CREATE POLICY "Users can update requests sent to them"
  ON share_requests FOR UPDATE
  USING (to_email = (auth.jwt() ->> 'email'));

CREATE POLICY "Users can delete their own requests"
  ON share_requests FOR DELETE
  USING (from_user_id = auth.uid());

-- ================================================
-- 2. Fix shares policies
-- ================================================

DROP POLICY IF EXISTS "Users can view shares they own or have access to" ON shares;
DROP POLICY IF EXISTS "Users can create shares they own" ON shares;
DROP POLICY IF EXISTS "Users can update their own shares" ON shares;
DROP POLICY IF EXISTS "Users can delete their own shares" ON shares;

CREATE POLICY "Users can view shares they own or have access to"
  ON shares FOR SELECT
  USING (owner_id = auth.uid() OR viewer_id = auth.uid());

CREATE POLICY "Users can create shares they own"
  ON shares FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their own shares"
  ON shares FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Users can delete their own shares"
  ON shares FOR DELETE
  USING (owner_id = auth.uid());

-- ================================================
-- 3. Fix activity_types policies (allow viewing shared)
-- ================================================

DROP POLICY IF EXISTS "Users can view their own activity types" ON activity_types;
DROP POLICY IF EXISTS "Users can view own and shared activity types" ON activity_types;

CREATE POLICY "Users can view own and shared activity types"
  ON activity_types FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM shares 
      WHERE shares.owner_id = activity_types.user_id 
      AND shares.viewer_id = auth.uid()
      AND activity_types.id = ANY(shares.activity_type_ids::uuid[])
    )
  );

-- ================================================
-- 4. Fix log_entries policies (allow viewing shared)
-- ================================================

DROP POLICY IF EXISTS "Users can view their own entries" ON log_entries;
DROP POLICY IF EXISTS "Users can view own and shared log entries" ON log_entries;

CREATE POLICY "Users can view own and shared log entries"
  ON log_entries FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM shares 
      WHERE shares.owner_id = log_entries.user_id 
      AND shares.viewer_id = auth.uid()
      AND log_entries.activity_type_id = ANY(shares.activity_type_ids::uuid[])
    )
  );

-- ================================================
-- Verify tables exist
-- ================================================

SELECT 'share_requests exists' AS status WHERE EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'share_requests');
SELECT 'shares exists' AS status WHERE EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'shares');
