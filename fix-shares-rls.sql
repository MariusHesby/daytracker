-- Fix RLS policies on shares table to allow mutual friendship creation
-- The current policy only allows INSERT where owner_id = auth.uid(),
-- but adding a friend requires creating TWO rows (one in each direction).
-- This fix allows a user to also insert/delete shares where they are the viewer.

-- Run this in Supabase SQL Editor

-- ================================================
-- Fix shares INSERT policy
-- ================================================
DROP POLICY IF EXISTS "Users can create shares they own" ON shares;

CREATE POLICY "Users can create shares they own or are viewer of"
  ON shares FOR INSERT
  WITH CHECK (owner_id = auth.uid() OR viewer_id = auth.uid());

-- ================================================
-- Fix shares DELETE policy
-- ================================================
DROP POLICY IF EXISTS "Users can delete their own shares" ON shares;

CREATE POLICY "Users can delete shares they are part of"
  ON shares FOR DELETE
  USING (owner_id = auth.uid() OR viewer_id = auth.uid());

-- ================================================
-- Verify the policies
-- ================================================
SELECT policyname, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'shares';
