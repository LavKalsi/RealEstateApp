require('dotenv').config(); // <--- Load environment variables


const express = require('express');
const multer = require('multer');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');
const FormData = require('form-data');
const session = require('express-session');
const createSupabaseClient = require('./config/supabase');
const { requireAuth, requireRole, requireSiteAccess } = require('./middleware/auth');
const app = express();
const PORT = process.env.PORT || 3000;

// Helper to get authenticated Supabase client
const getSupabaseClient = (token) => {
  return createSupabaseClient(token);
};

// Multer setup for file uploads
const upload = multer({ dest: 'uploads/' });

// EJS setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Session setup
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// In-memory site store (replace with DB or n8n later)
let sites = [
  { id: '1', name: 'Main Project', address: '123 Main St', status: 'Active' },
];

// In-memory stock and material management per site
let siteMaterials = {}; // { siteId: [ { id, name, unit, cost, quantity } ] }
let stockHistory = {}; // { siteId: [ { id, materialId, type, quantity, date, user, note } ] }

// Helper to get site by ID
function getSiteById(id) {
  return sites.find(site => site.id === id);
}

// Helper to get materials for a site
function getMaterialsForSite(siteId) {
  if (!siteMaterials[siteId]) {
    siteMaterials[siteId] = [];
  }
  return siteMaterials[siteId];
}

// Helper to get stock history for a site
function getStockHistoryForSite(siteId) {
  if (!stockHistory[siteId]) {
    stockHistory[siteId] = [];
  }
  return stockHistory[siteId];
}

// Authentication routes
app.get('/login', (req, res) => {
  if (req.session.supabaseToken) {
    return res.redirect('/');
  }
  res.render('login', {
    userProfile: req.userProfile || null
  });
});

app.get('/signup', (req, res) => {
  if (req.session.supabaseToken) {
    return res.redirect('/');
  }
  res.render('signup', {
    userProfile: req.userProfile || null
  });
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Create a new Supabase client for authentication
    const supabase = createSupabaseClient();
    
    const { data: { session }, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      console.error('Auth error:', error);
      return res.status(400).json({ 
        error: error.message,
        field: error.message.includes('email') ? 'email' : 'password'
      });
    }
    
    if (!session) {
      console.error('No session returned from auth');
      return res.status(400).json({ error: 'Authentication failed' });
    }

    // Store session data
    req.session.supabaseToken = session.access_token;
    req.session.refreshToken = session.refresh_token;
    req.session.userId = session.user.id;
    
    res.json({ success: true });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/auth/signup', async (req, res) => {
  try {
    const { fullName, email, password, role } = req.body;
    
    // Create a new Supabase client for authentication
    const supabase = createSupabaseClient();
    
    // Create user account
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: role
        }
      }
    });
    
    if (error) {
      return res.status(400).json({ 
        error: error.message,
        field: error.message.includes('email') ? 'email' : 'password'
      });
    }
    
    // Create user profile
    if (data.user) {
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          user_id: data.user.id,
          full_name: fullName,
          role: role,
          email: email
        });
      
      if (profileError) {
        console.error('Profile creation error:', profileError);
      }
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Protected routes - require authentication
app.get('/', requireAuth, (req, res) => {
  res.render('index', { 
    invoice: null, 
    status: null,
    user: req.user,
    userProfile: req.userProfile
  });
});

// Upload image endpoint
app.post('/upload-invoice-image', requireAuth, upload.single('invoiceImage'), async (req, res) => {
  try {
    const n8nWebhookUrl = 'https://shardcarecubs.app.n8n.cloud/webhook/2247f975-154a-4633-b84a-4a0c83073c84';
    const fileStream = fs.createReadStream(req.file.path);
    const formData = new FormData();
    formData.append('file', fileStream, req.file.originalname);

    const response = await fetch(n8nWebhookUrl, {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders(),
    });
    const rawText = await response.text();
    console.log('Raw n8n response:', rawText);
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      data = rawText;
    }
    // Handle n8n response with 'content' field containing JSON string, possibly wrapped in markdown
    let invoice = data;
    if (invoice && typeof invoice.content === 'string') {
      let content = invoice.content.trim();
      // Remove markdown if present
      if (content.startsWith('```json')) {
        content = content.replace(/^```json/, '').replace(/```$/, '').trim();
      } else if (content.startsWith('```')) {
        content = content.replace(/^```/, '').replace(/```$/, '').trim();
      }
      try {
        invoice = JSON.parse(content);
      } catch (e) {
        invoice = {};
      }
    }
    console.log('Parsed invoice data for review page:', invoice);
    fs.unlinkSync(req.file.path);
    if (!response.ok) {
      console.error('n8n webhook error:', response.status, invoice);
      return res.status(500).json({ success: false, error: 'n8n webhook error', details: invoice });
    }
    // Store invoice in session and redirect to review page
    req.session.invoice = invoice;
    return res.json({ redirect: '/review' });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ success: false, error: 'Failed to process image.', details: err.message });
  }
});

// Extract invoice endpoint
app.post('/extract-invoice', requireAuth, async (req, res) => {
  try {
    const { success, result } = await processInvoiceData(req.body);
    if (success) {
      res.json({ success: true, redirect: '/review' });
    } else {
      res.status(500).json({ success: false, error: 'Failed to process invoice' });
    }
  } catch (err) {
    console.error('Extract error:', err);
    res.status(500).json({ success: false, error: 'Failed to process invoice' });
  }
});

// Helper function to process invoice data through n8n
async function processInvoiceData(data) {
  const n8nWebhookUrl = 'https://shardcarecubs.app.n8n.cloud/webhook/5b91870b-e072-4562-9737-6277f4ca670b';
  try {
    const response = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error(`n8n webhook error: ${response.status}`);
    }
    
    const result = await response.json();
    return { success: true, result };
  } catch (error) {
    console.error('n8n webhook error:', error);
    return { success: false, error: error.message };
  }
}

// Add a GET route for manual entry (for users who skip upload)
app.get('/manual-entry', requireAuth, (req, res) => {
  res.render('review', { invoice: null, status: null });
});

// Review page
app.get('/review', requireAuth, (req, res) => {
  const invoice = req.session.invoice;
  res.render('review', { invoice, status: null });
});

// Submit invoice endpoint
app.post('/submit-invoice', requireAuth, async (req, res) => {
  try {
    // Forward data to n8n webhook (Webhook 2)
    const n8nWebhookUrl = 'https://shardcarecubs.app.n8n.cloud/webhook/5b91870b-e072-4562-9737-6277f4ca670b';
    const response = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.json({ success: true, result: data });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to submit invoice.' });
  }
});

// Site management routes (admin/manager only)
app.get('/sites', requireAuth, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('sites')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    res.json({ sites: data || [] });
  } catch (error) {
    console.error('Fetch sites error:', error);
    res.status(500).json({ error: 'Failed to fetch sites' });
  }
});

// Add a new site
app.post('/sites', requireAuth, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { name, address, status } = req.body;
    if (!name || !address) return res.status(400).json({ error: 'Name and address required' });
    
    const { data, error } = await supabase
      .from('sites')
      .insert({
        name,
        address,
        status: status || 'Active',
        created_by: req.user.id
      })
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({ success: true, site: data });
  } catch (error) {
    console.error('Create site error:', error);
    res.status(500).json({ error: 'Failed to create site' });
  }
});

// Update site
app.post('/sites/:id', requireAuth, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address, status } = req.body;
    
    const { data, error } = await supabase
      .from('sites')
      .update({ name, address, status })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({ success: true, site: data });
  } catch (error) {
    console.error('Update site error:', error);
    res.status(500).json({ error: 'Failed to update site' });
  }
});

// Delete site
app.post('/sites/:id/delete', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabase
      .from('sites')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete site error:', error);
    res.status(500).json({ error: 'Failed to delete site' });
  }
});

// Get active site
app.get('/active-site', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('user_site_preferences')
      .select('site_id')
      .eq('user_id', req.user.id)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Active site fetch error:', error);
    }
    
    const siteId = data?.site_id;
    if (!siteId) {
      return res.json({ site: null });
    }
    
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('*')
      .eq('id', siteId)
      .single();
    
    if (siteError) throw siteError;
    
    res.json({ site });
  } catch (error) {
    console.error('Active site error:', error);
    res.status(500).json({ error: 'Failed to fetch active site' });
  }
});

// Set active site in session
app.post('/set-active-site', requireAuth, async (req, res) => {
  try {
    const { siteId } = req.body;
    
    // Check if user has access to this site
    const { data: siteAccess, error: accessError } = await supabase
      .from('site_access')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('site_id', siteId)
      .single();
    
    if (accessError && accessError.code !== 'PGRST116') {
      console.error('Site access check error:', accessError);
    }
    
    // Allow if user has access or is admin
    if (!siteAccess && req.userProfile.role !== 'admin') {
      return res.status(403).json({ error: 'No access to this site' });
    }
    
    // Update or insert user preference
    const { error } = await supabase
      .from('user_site_preferences')
      .upsert({
        user_id: req.user.id,
        site_id: siteId
      });
    
    if (error) throw error;
    
    res.json({ success: true });
  } catch (error) {
    console.error('Set active site error:', error);
    res.status(500).json({ error: 'Failed to set active site' });
  }
});

// Stock management routes
app.get('/site/:siteId/materials', requireAuth, requireSiteAccess, async (req, res) => {
  try {
    const { siteId } = req.params;
    
    const { data, error } = await supabase
      .from('materials')
      .select('*')
      .eq('site_id', siteId)
      .order('name');
    
    if (error) throw error;
    
    res.json({ materials: data || [] });
  } catch (error) {
    console.error('Fetch materials error:', error);
    res.status(500).json({ error: 'Failed to fetch materials' });
  }
});

app.get('/site/:siteId/stock-history', requireAuth, requireSiteAccess, async (req, res) => {
  try {
    const { siteId } = req.params;
    
    const { data, error } = await supabase
      .from('stock_history')
      .select('*')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (error) throw error;
    
    res.json({ history: data || [] });
  } catch (error) {
    console.error('Fetch stock history error:', error);
    res.status(500).json({ error: 'Failed to fetch stock history' });
  }
});

// Add material
app.post('/site/:siteId/materials', requireAuth, requireRole(['admin', 'manager']), requireSiteAccess, async (req, res) => {
  try {
    const { siteId } = req.params;
    const { name, unit, cost, quantity } = req.body;
    
    const { data, error } = await supabase
      .from('materials')
      .insert({
        site_id: siteId,
        name,
        unit,
        cost: parseFloat(cost),
        quantity: parseFloat(quantity)
      })
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({ success: true, material: data });
  } catch (error) {
    console.error('Add material error:', error);
    res.status(500).json({ error: 'Failed to add material' });
  }
});

// Edit material
app.post('/site/:siteId/materials/:materialId', requireAuth, requireRole(['admin', 'manager']), requireSiteAccess, async (req, res) => {
  try {
    const { materialId } = req.params;
    const { name, unit, cost } = req.body;
    
    const { data, error } = await supabase
      .from('materials')
      .update({ name, unit, cost: parseFloat(cost) })
      .eq('id', materialId)
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({ success: true, material: data });
  } catch (error) {
    console.error('Edit material error:', error);
    res.status(500).json({ error: 'Failed to edit material' });
  }
});

// Delete material
app.post('/site/:siteId/materials/:materialId/delete', requireAuth, requireRole(['admin']), requireSiteAccess, async (req, res) => {
  try {
    const { materialId } = req.params;
    
    const { error } = await supabase
      .from('materials')
      .delete()
      .eq('id', materialId);
    
    if (error) throw error;
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete material error:', error);
    res.status(500).json({ error: 'Failed to delete material' });
  }
});

// Stock operation: receive, issue, transfer
app.post('/site/:siteId/stock-op', requireAuth, requireRole(['admin', 'manager', 'worker']), requireSiteAccess, async (req, res) => {
  try {
    const { siteId } = req.params;
    const { materialId, type, quantity, note, targetSiteId } = req.body;
    const qty = parseFloat(quantity);
    
    // Get material
    const { data: material, error: materialError } = await supabase
      .from('materials')
      .select('*')
      .eq('id', materialId)
      .single();
    
    if (materialError) throw materialError;
    if (!material) return res.status(404).json({ error: 'Material not found' });
    
    if (type === 'Receive') {
      // Update material quantity
      const { error: updateError } = await supabase
        .from('materials')
        .update({ quantity: material.quantity + qty })
        .eq('id', materialId);
      
      if (updateError) throw updateError;
      
      // Add to stock history
      const { error: historyError } = await supabase
        .from('stock_history')
        .insert({
          site_id: siteId,
          material_id: materialId,
          type: 'Receive',
          quantity: qty,
          note,
          user_id: req.user.id
        });
      
      if (historyError) throw historyError;
      
    } else if (type === 'Issue') {
      if (material.quantity < qty) {
        return res.status(400).json({ error: 'Not enough stock' });
      }
      
      // Update material quantity
      const { error: updateError } = await supabase
        .from('materials')
        .update({ quantity: material.quantity - qty })
        .eq('id', materialId);
      
      if (updateError) throw updateError;
      
      // Add to stock history
      const { error: historyError } = await supabase
        .from('stock_history')
        .insert({
          site_id: siteId,
          material_id: materialId,
          type: 'Issue',
          quantity: qty,
          note,
          user_id: req.user.id
        });
      
      if (historyError) throw historyError;
      
    } else if (type === 'Transfer') {
      if (!targetSiteId) return res.status(400).json({ error: 'Target site required' });
      if (material.quantity < qty) return res.status(400).json({ error: 'Not enough stock' });
      
      // Remove from source
      const { error: updateError } = await supabase
        .from('materials')
        .update({ quantity: material.quantity - qty })
        .eq('id', materialId);
      
      if (updateError) throw updateError;
      
      // Add to stock history for source
      const { error: historyError } = await supabase
        .from('stock_history')
        .insert({
          site_id: siteId,
          material_id: materialId,
          type: 'Transfer',
          quantity: qty,
          note: `Transfer to site ${targetSiteId}`,
          user_id: req.user.id
        });
      
      if (historyError) throw historyError;
      
      // Add to target site
      const { data: targetMaterial, error: targetError } = await supabase
        .from('materials')
        .select('*')
        .eq('site_id', targetSiteId)
        .eq('name', material.name)
        .eq('unit', material.unit)
        .single();
      
      if (targetError && targetError.code !== 'PGRST116') throw targetError;
      
      if (targetMaterial) {
        // Update existing material
        const { error: updateTargetError } = await supabase
          .from('materials')
          .update({ quantity: targetMaterial.quantity + qty })
          .eq('id', targetMaterial.id);
        
        if (updateTargetError) throw updateTargetError;
      } else {
        // Create new material
        const { error: createError } = await supabase
          .from('materials')
          .insert({
            site_id: targetSiteId,
            name: material.name,
            unit: material.unit,
            cost: material.cost,
            quantity: qty
          });
        
        if (createError) throw createError;
      }
      
      // Add to stock history for target
      const { error: targetHistoryError } = await supabase
        .from('stock_history')
        .insert({
          site_id: targetSiteId,
          material_id: targetMaterial?.id || materialId,
          type: 'Receive',
          quantity: qty,
          note: `Transfer from site ${siteId}`,
          user_id: req.user.id
        });
      
      if (targetHistoryError) throw targetHistoryError;
      
    } else {
      return res.status(400).json({ error: 'Invalid operation type' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Stock operation error:', error);
    res.status(500).json({ error: 'Stock operation failed' });
  }
});

// --- Upload Links API ---
const crypto = require('crypto');

// List all upload links (admin only)
app.get('/admin/upload-links', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const supabaseClient = getSupabaseClient(req.session.supabaseToken);
    const { data, error } = await supabaseClient
      .from('upload_links')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ links: data });
  } catch (error) {
    console.error('Fetch upload links error:', error);
    res.status(500).json({ error: 'Failed to fetch upload links' });
  }
});

// Create a new upload link (admin only)
app.post('/admin/upload-links', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { type, expiresInMinutes, description } = req.body;
    if (!['temporary', 'permanent'].includes(type)) {
      return res.status(400).json({ error: 'Invalid link type' });
    }
    
    if (!req.session.supabaseToken) {
      console.error('No auth token in session');
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    let expires_at = null;
    if (type === 'temporary') {
      const minutes = parseInt(expiresInMinutes, 10) || 30;
      expires_at = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    }

    // Get authenticated Supabase client
    const supabaseClient = getSupabaseClient(req.session.supabaseToken);
    
    // Debug logs
    console.log('Session token:', req.session.supabaseToken ? 'Present' : 'Missing');
    console.log('User ID:', req.user?.id || 'Missing');
    console.log('User object:', JSON.stringify(req.user, null, 2));
    
    if (!req.user || !req.user.id) {
      console.error('Missing user information in request');
      return res.status(401).json({ error: 'User not properly authenticated' });
    }

    // Validate all required fields according to schema
    if (!token || !type || !req.user?.id) {
      console.error('Missing required fields:', { token: !!token, type: !!type, userId: !!req.user?.id });
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Match schema exactly
    const insertData = {
      token,                  // TEXT NOT NULL UNIQUE
      type,                   // TEXT NOT NULL CHECK (type IN ('temporary', 'permanent'))
      created_by: req.user.id,// UUID REFERENCES auth.users(id)
      created_at: new Date().toISOString(), // TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      expires_at,             // TIMESTAMP WITH TIME ZONE
      used: false,           // BOOLEAN DEFAULT FALSE
      active: true,          // BOOLEAN DEFAULT TRUE
      description            // TEXT
    };

    console.log('Attempting to insert:', JSON.stringify(insertData, null, 2));
    
    // Debug current user context
    const { data: userCheck, error: userCheckError } = await supabaseClient
      .from('user_profiles')
      .select('role')
      .eq('user_id', req.user.id)
      .single();
    
    console.log('Current user role check:', userCheck || 'No profile found');
    if (userCheckError) {
      console.error('Role check error:', userCheckError);
    }

    const { data, error } = await supabaseClient
      .from('upload_links')
      .insert(insertData)
      .select()
      .single();
    if (error) throw error;
    res.json({ link: data });
  } catch (error) {
    console.error('Create upload link error:', error);
    res.status(500).json({ error: 'Failed to create upload link' });
  }
});

// Delete an upload link (admin only)
app.post('/admin/upload-links/:id/delete', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const supabaseClient = getSupabaseClient(req.session.supabaseToken);
    const { error } = await supabaseClient
      .from('upload_links')
      .delete()
      .eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Delete upload link error:', error);
    res.status(500).json({ error: 'Failed to delete upload link' });
  }
});

// Validate a public upload link token (no auth required)
app.get('/upload-link/:token', async (req, res) => {
  try {
    const { token } = req.params;
    // Create an anonymous client for public access
    const supabaseClient = createSupabaseClient();
    
    const { data, error } = await supabaseClient
      .from('upload_links')
      .select('*')
      .eq('token', token)
      .single();
    if (error || !data) return res.status(404).json({ error: 'Invalid or expired link' });
    // Check expiry and usage
    if (!data.active) return res.status(410).json({ error: 'Link is inactive' });
    if (data.type === 'temporary') {
      if (data.used) return res.status(410).json({ error: 'Link already used' });
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        return res.status(410).json({ error: 'Link expired' });
      }
    }
    res.json({ link: data });
  } catch (error) {
    console.error('Validate upload link error:', error);
    res.status(500).json({ error: 'Failed to validate upload link' });
  }
});

// Mark a temporary link as used (after upload)
app.post('/upload-link/:token/mark-used', async (req, res) => {
  try {
    const { token } = req.params;
    // Create an anonymous client for public access
    const supabaseClient = createSupabaseClient();

    const { data, error } = await supabaseClient
      .from('upload_links')
      .update({ used: true, active: false })
      .eq('token', token)
      .eq('type', 'temporary')
      .select()
      .single();
    if (error || !data) return res.status(404).json({ error: 'Invalid or expired link' });
    res.json({ success: true });
  } catch (error) {
    console.error('Mark upload link used error:', error);
    res.status(500).json({ error: 'Failed to mark link as used' });
  }
});

// Admin upload links dashboard page
app.get('/admin/upload-links-dashboard', requireAuth, requireRole('admin'), (req, res) => {
  res.render('admin-upload-links', {
    user: req.user,
    userProfile: req.userProfile
  });
});

// Public upload page (no auth required)
app.get('/upload/:token', (req, res) => {
  res.render('upload-link', { token: req.params.token });
});

// Health check route
app.get('/health', async (req, res) => {
  try {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase.from('upload_links').select('count').limit(1);
    
    if (error) {
      console.error('Health check error:', error);
      return res.status(500).json({ 
        status: 'error',
        error: error.message,
        code: error.code 
      });
    }
    
    res.json({ 
      status: 'healthy',
      supabase: 'connected',
      session: req.session ? 'active' : 'none'
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ 
      status: 'error',
      error: error.message 
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});