-- Fix for user_profiles policies
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;

CREATE POLICY "Users can view their own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles" ON user_profiles
  FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');

-- Fix for sites policies
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

-- Fix for site_access policies
DROP POLICY IF EXISTS "Users can view their own site access" ON site_access;
DROP POLICY IF EXISTS "Admins can manage all site access" ON site_access;

CREATE POLICY "Users can view their own site access" ON site_access
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all site access" ON site_access
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'admin'
  );

-- Fix for materials policies
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

-- Fix for stock_history policies
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

-- Fix for upload_links policies
DROP POLICY IF EXISTS "Admins can manage upload links" ON upload_links;
DROP POLICY IF EXISTS "Anyone can select by token" ON upload_links;

CREATE POLICY "Admins can manage upload links" ON upload_links
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'admin'
  ) WITH CHECK (
    auth.jwt() ->> 'role' = 'admin'
  );

CREATE POLICY "Anyone can select by token" ON upload_links
  FOR SELECT USING (true);
