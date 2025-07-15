-- First, let's create a debug function
CREATE OR REPLACE FUNCTION debug_rls_check() RETURNS TRIGGER AS $$
BEGIN
    RAISE NOTICE 'RLS Check - Operation: %, Auth UID: %, Current User: %', 
        TG_OP,
        auth.uid(),
        current_user;

    -- Log the user's role from user_profiles
    RAISE NOTICE 'User role from profiles: %',
        (SELECT role FROM user_profiles WHERE user_id = auth.uid());
    
    -- Log the policy check result
    RAISE NOTICE 'Policy check result: %',
        EXISTS (
            SELECT 1 
            FROM user_profiles 
            WHERE user_id = auth.uid() 
            AND role = 'admin'
        );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can manage upload links" ON upload_links;
DROP POLICY IF EXISTS "Anyone can select by token" ON upload_links;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS debug_rls_trigger ON upload_links;

-- Create the debug trigger
CREATE TRIGGER debug_rls_trigger
    BEFORE INSERT OR UPDATE OR DELETE ON upload_links
    FOR EACH ROW
    EXECUTE FUNCTION debug_rls_check();

-- Recreate the policies with explicit INSERT permission
CREATE POLICY "admin_insert_policy" ON upload_links
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 
            FROM user_profiles 
            WHERE user_id = auth.uid() 
            AND role = 'admin'
        )
    );

CREATE POLICY "admin_modify_policy" ON upload_links
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 
            FROM user_profiles 
            WHERE user_id = auth.uid() 
            AND role = 'admin'
        )
    );

CREATE POLICY "public_select_policy" ON upload_links
    FOR SELECT
    USING (true);

-- Make sure permissions are correct
GRANT ALL ON upload_links TO authenticated;
GRANT SELECT ON upload_links TO anon;

-- Ensure RLS is enabled
ALTER TABLE upload_links ENABLE ROW LEVEL SECURITY;

-- Add a test user if needed (replace with your admin user ID)
INSERT INTO user_profiles (id, user_id, full_name, email, role, created_at, updated_at)
VALUES 
    (
        '58e8fd52-6d0c-4fc6-9d97-033e8a95fcea', 
        '1f569f4a-02c0-4c20-b442-d759e64cb7fc',
        'Admin User',  -- Add full_name
        'ops.shard@carecubs.in',  -- Add email
        'admin',
        NOW(),
        NOW()
    )
ON CONFLICT (id) DO UPDATE 
SET 
    role = 'admin',
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    updated_at = NOW();
