-- Share requests table
CREATE TABLE IF NOT EXISTS share_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_email TEXT NOT NULL,
  to_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Shares table (accepted permissions)
CREATE TABLE IF NOT EXISTS shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type_ids TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(owner_id, viewer_id)
);

-- Enable RLS
ALTER TABLE share_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE shares ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (in case they exist)
DROP POLICY IF EXISTS "Users can view requests they sent or received" ON share_requests;
DROP POLICY IF EXISTS "Users can create share requests" ON share_requests;
DROP POLICY IF EXISTS "Users can update requests sent to them" ON share_requests;
DROP POLICY IF EXISTS "Users can delete their own requests" ON share_requests;

-- Policies for share_requests (using auth.jwt() for email to avoid subquery issues)
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

-- Policies for shares
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

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_share_requests_to_email ON share_requests(to_email);
CREATE INDEX IF NOT EXISTS idx_shares_viewer ON shares(viewer_id);
CREATE INDEX IF NOT EXISTS idx_shares_owner ON shares(owner_id);

-- IMPORTANT: Run these policies to allow viewing shared data
-- This updates the existing activity_types and log_entries policies

-- First, drop any existing conflicting policies
DROP POLICY IF EXISTS "Users can view their own activity types" ON activity_types;
DROP POLICY IF EXISTS "Users can view own and shared activity types" ON activity_types;
DROP POLICY IF EXISTS "Users can view their own entries" ON log_entries;
DROP POLICY IF EXISTS "Users can view own and shared log entries" ON log_entries;

-- Allow viewing shared activity types
CREATE POLICY "Users can view own and shared activity types"
  ON activity_types FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM shares 
      WHERE shares.owner_id = activity_types.user_id 
      AND shares.viewer_id = auth.uid()
      AND activity_types.id::text = ANY(shares.activity_type_ids)
    )
  );

-- Allow viewing shared log entries
CREATE POLICY "Users can view own and shared log entries"
  ON log_entries FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM shares 
      WHERE shares.owner_id = log_entries.user_id 
      AND shares.viewer_id = auth.uid()
      AND log_entries.activity_type_id::text = ANY(shares.activity_type_ids)
    )
  );
