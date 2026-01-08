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

-- Policies for share_requests
CREATE POLICY "Users can view requests they sent or received"
  ON share_requests FOR SELECT
  USING (
    from_user_id = auth.uid() OR 
    to_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "Users can create share requests"
  ON share_requests FOR INSERT
  WITH CHECK (from_user_id = auth.uid());

CREATE POLICY "Users can update requests sent to them"
  ON share_requests FOR UPDATE
  USING (to_email = (SELECT email FROM auth.users WHERE id = auth.uid()));

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
