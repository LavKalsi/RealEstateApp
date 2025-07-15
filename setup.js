const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up Real Estate Invoice Processor with Supabase...\n');

// Check if .env already exists
if (fs.existsSync('.env')) {
  console.log('⚠️  .env file already exists. Skipping environment setup.');
} else {
  console.log('📝 Creating .env file...');
  
  const envContent = `# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here

# Session Configuration
SESSION_SECRET=your-super-secret-session-key-here

# Environment
NODE_ENV=development
`;

  fs.writeFileSync('.env', envContent);
  console.log('✅ .env file created successfully!');
  console.log('📋 Please update the .env file with your actual Supabase credentials.\n');
}

console.log('📚 Next steps:');
console.log('1. Go to https://supabase.com and create a new project');
console.log('2. Get your Project URL and anon key from Settings → API');
console.log('3. Update the .env file with your credentials');
console.log('4. Run the SQL schema from supabase-schema.sql in your Supabase SQL Editor');
console.log('5. Run: npm install');
console.log('6. Run: npm start');
console.log('\n�� Happy coding!'); 