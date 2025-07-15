// config/supabase.js
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables. Please set SUPABASE_URL and SUPABASE_ANON_KEY in your .env file.');
  process.exit(1);
}

// Create a Supabase client creator function
const createSupabaseClient = (accessToken) => {
  // Add debug logging
  console.log('Creating Supabase client with token:', accessToken ? 'Present' : 'Missing');

  const options = {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false
    },
    global: {
      headers: accessToken ? {
        Authorization: `Bearer ${accessToken}`,
        // Ensure authenticated context is passed
        'apikey': process.env.SUPABASE_ANON_KEY,
        'X-Client-Info': 'supabase-js'
      } : {}
    }
  };

  try {
    return createClient(supabaseUrl, supabaseAnonKey, options);
  } catch (error) {
    console.error('Supabase client creation error:', error);
    throw error;
  }
};

module.exports = createSupabaseClient;
