-- Enable Row Level Security
-- Note: app.jwt_secret is managed by Supabase automatically
-- No need to set it manually

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'worker', 'viewer')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create sites table
CREATE TABLE IF NOT EXISTS sites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Completed', 'On Hold')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create site_access table (many-to-many relationship between users and sites)
CREATE TABLE IF NOT EXISTS site_access (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  access_level TEXT NOT NULL DEFAULT 'read' CHECK (access_level IN ('read', 'write', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, site_id)
);

-- Create user_site_preferences table
CREATE TABLE IF NOT EXISTS user_site_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create materials table
CREATE TABLE IF NOT EXISTS materials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  cost DECIMAL(10,2) NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create stock_history table
CREATE TABLE IF NOT EXISTS stock_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  material_id UUID REFERENCES materials(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  type TEXT NOT NULL CHECK (type IN ('Receive', 'Issue', 'Transfer', 'Add')),
  quantity DECIMAL(10,2) NOT NULL,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_sites_created_by ON sites(created_by);
CREATE INDEX IF NOT EXISTS idx_site_access_user_id ON site_access(user_id);
CREATE INDEX IF NOT EXISTS idx_site_access_site_id ON site_access(site_id);
CREATE INDEX IF NOT EXISTS idx_materials_site_id ON materials(site_id);
CREATE INDEX IF NOT EXISTS idx_stock_history_site_id ON stock_history(site_id);
CREATE INDEX IF NOT EXISTS idx_stock_history_material_id ON stock_history(material_id);
CREATE INDEX IF NOT EXISTS idx_stock_history_user_id ON stock_history(user_id);

-- Enable Row Level Security on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_site_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;

-- Basic policies that don't cause recursion
CREATE POLICY "Users can view their own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles" ON user_profiles
  FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');

-- RLS Policies for sites
DROP POLICY IF EXISTS "Users can view sites they have access to" ON sites;
DROP POLICY IF EXISTS "Admins and managers can create sites" ON sites;
DROP POLICY IF EXISTS "Admins and managers can update sites" ON sites;
DROP POLICY IF EXISTS "Only admins can delete sites" ON sites;

CREATE POLICY "Users can view sites they have access to" ON sites
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM site_access 
      WHERE user_id = auth.uid() AND site_id = sites.id
    ) OR auth.jwt() ->> 'role' = 'admin'
  );

CREATE POLICY "Admins and managers can create sites" ON sites
  FOR INSERT WITH CHECK (
    auth.jwt() ->> 'role' IN ('admin', 'manager')
  );

CREATE POLICY "Admins and managers can update sites" ON sites
  FOR UPDATE USING (
    auth.jwt() ->> 'role' IN ('admin', 'manager')
  );

CREATE POLICY "Only admins can delete sites" ON sites
  FOR DELETE USING (
    auth.jwt() ->> 'role' = 'admin'
  );

-- RLS Policies for site_access
CREATE POLICY "Users can view their own site access" ON site_access
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all site access" ON site_access
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for user_site_preferences
CREATE POLICY "Users can manage their own preferences" ON user_site_preferences
  FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for materials
DROP POLICY IF EXISTS "Users can view materials for sites they have access to" ON materials;
DROP POLICY IF EXISTS "Admins and managers can create materials" ON materials;
DROP POLICY IF EXISTS "Admins and managers can update materials" ON materials;
DROP POLICY IF EXISTS "Only admins can delete materials" ON materials;

CREATE POLICY "Users can view materials for sites they have access to" ON materials
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM site_access 
      WHERE user_id = auth.uid() AND site_id = materials.site_id
    ) OR auth.jwt() ->> 'role' = 'admin'
  );

CREATE POLICY "Admins and managers can create materials" ON materials
  FOR INSERT WITH CHECK (
    auth.jwt() ->> 'role' IN ('admin', 'manager') AND
    EXISTS (
      SELECT 1 FROM site_access 
      WHERE user_id = auth.uid() AND site_id = materials.site_id
    )
  );

CREATE POLICY "Admins and managers can update materials" ON materials
  FOR UPDATE USING (
    auth.jwt() ->> 'role' IN ('admin', 'manager') AND
    EXISTS (
      SELECT 1 FROM site_access 
      WHERE user_id = auth.uid() AND site_id = materials.site_id
    )
  );

CREATE POLICY "Only admins can delete materials" ON materials
  FOR DELETE USING (
    auth.jwt() ->> 'role' = 'admin'
  );

-- RLS Policies for stock_history
DROP POLICY IF EXISTS "Users can view stock history for sites they have access to" ON stock_history;
DROP POLICY IF EXISTS "Workers, managers, and admins can create stock history" ON stock_history;

CREATE POLICY "Users can view stock history for sites they have access to" ON stock_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM site_access 
      WHERE user_id = auth.uid() AND site_id = stock_history.site_id
    ) OR auth.jwt() ->> 'role' = 'admin'
  );

CREATE POLICY "Workers, managers, and admins can create stock history" ON stock_history
  FOR INSERT WITH CHECK (
    auth.jwt() ->> 'role' IN ('admin', 'manager', 'worker') AND
    EXISTS (
      SELECT 1 FROM site_access 
      WHERE user_id = auth.uid() AND site_id = stock_history.site_id
    )
  );

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Unknown'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'viewer')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create user profile
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sites_updated_at
  BEFORE UPDATE ON sites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_materials_updated_at
  BEFORE UPDATE ON materials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Ensure user_id column exists
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Correct RLS policy to avoid recursion
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
CREATE POLICY "Users can view their own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = user_id);