-- Upload Links Table for One-Time and Permanent Upload URLs
CREATE TABLE IF NOT EXISTS upload_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('temporary', 'permanent')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  used BOOLEAN DEFAULT FALSE,
  active BOOLEAN DEFAULT TRUE,
  description TEXT
);

-- Index for quick lookup by token
CREATE INDEX IF NOT EXISTS idx_upload_links_token ON upload_links(token);
CREATE INDEX IF NOT EXISTS idx_upload_links_active ON upload_links(active);
CREATE INDEX IF NOT EXISTS idx_upload_links_expires_at ON upload_links(expires_at);

-- Enable Row Level Security
ALTER TABLE upload_links ENABLE ROW LEVEL SECURITY;

-- RLS: Only admin can create, update, or delete links
CREATE POLICY "Admins can manage upload links" ON upload_links
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role = 'admin'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- RLS: Anyone can select by token (for public upload page)
CREATE POLICY "Anyone can select by token" ON upload_links
  FOR SELECT USING (true); 