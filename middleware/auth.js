const createSupabaseClient = require('../config/supabase');

// Middleware to check if user is authenticated
const requireAuth = async (req, res, next) => {
  const token = req.session.supabaseToken;
  
  if (!token) {
    return res.redirect('/login');
  }

  try {
    // Create a new Supabase client with the user's token
    const supabase = createSupabaseClient(token);
    
    // Verify the token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      req.session.destroy();
      return res.redirect('/login');
    }
    
    if (!user || !user.id) {
      req.session.destroy();
      return res.redirect('/login');
    }

    // Get user profile with role
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, user_id, role')
      .eq('user_id', user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      req.session.destroy();
      return res.redirect('/login');
    }

    // Only allow users with valid profiles and roles
    if (!profile || !profile.role) {
      req.session.destroy();
      return res.redirect('/login');
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: profile.role
    };
    req.userProfile = profile;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    req.session.destroy();
    res.redirect('/login');
  }
};

// Middleware to check if user has specific role
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || !req.userProfile) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const userRole = req.userProfile.role;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

// Middleware to check if user can access specific site
const requireSiteAccess = async (req, res, next) => {
  const siteId = req.params.siteId || req.body.siteId;
  
  if (!siteId) {
    return res.status(400).json({ error: 'Site ID required' });
  }

  try {
    const supabase = createSupabaseClient(req.session.supabaseToken);
    
    // Admin has access to all sites
    if (req.userProfile.role === 'admin') {
      return next();
    }

    const { data: access, error } = await supabase
      .from('site_access')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('site_id', siteId)
      .single();

    if (error && error.code !== 'PGRST116') {
      return res.status(500).json({ error: 'Error checking site access' });
    }

    if (!access) {
      return res.status(403).json({ error: 'No access to this site' });
    }

    next();
  } catch (error) {
    res.status(500).json({ error: 'Error checking site access' });
  }
};

module.exports = { requireAuth, requireRole, requireSiteAccess };