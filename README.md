# Real Estate Invoice Processor with Authentication

A full-stack web application for processing real estate invoices with role-based authentication and stock management.

## Features

- **Authentication System**: Login/signup with role-based permissions
- **Invoice Processing**: Upload images/PDFs with OCR extraction
- **Camera Capture**: Capture invoice photos using webcam
- **Site Management**: Create and manage multiple project sites
- **Stock Management**: Track materials and stock operations
- **Role-Based Access Control**: Different permissions for different user roles
- **Dark/Light Mode**: Toggle between themes

## User Roles & Permissions

### Admin
- Full access to all features
- Can create, edit, and delete sites
- Can manage all users and their access
- Can perform all stock operations
- Can delete materials

### Manager
- Can create and edit sites
- Can manage materials and stock
- Can perform stock operations (receive, issue, transfer)
- Cannot delete sites or materials

### Worker
- Can view sites they have access to
- Can perform stock operations (receive, issue, transfer)
- Cannot manage sites or materials

### Viewer
- Read-only access to sites they have access to
- Can view stock and history
- Cannot perform any modifications

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Set up Supabase

1. **Create a Supabase Project**:
   - Go to [supabase.com](https://supabase.com)
   - Sign up/login and create a new project
   - Wait for the project to be ready

2. **Get Your Supabase Credentials**:
   - Go to Settings → API in your Supabase dashboard
   - Copy your Project URL and anon/public key

3. **Set up Environment Variables**:
   Create a `.env` file in your project root:
   ```env
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   SESSION_SECRET=your_session_secret_key
   NODE_ENV=development
   ```

4. **Set up Database Schema**:
   - Go to SQL Editor in your Supabase dashboard
   - Copy and paste the contents of `supabase-schema.sql`
   - Run the SQL to create all tables and policies

### 3. Configure Authentication

1. **Enable Email Authentication**:
   - Go to Authentication → Settings in Supabase
   - Enable "Enable email confirmations" if you want email verification
   - Or disable it for easier testing

2. **Set up Site URLs** (Optional):
   - Go to Authentication → URL Configuration
   - Add your site URL (e.g., `http://localhost:3000`)

### 4. Create Initial Admin User

1. **Sign up through the application**:
   - Start your application: `npm start`
   - Go to `http://localhost:3000/signup`
   - Create an account with the "admin" role

2. **Or create directly in Supabase**:
   - Go to Authentication → Users in Supabase
   - Create a user manually
   - Update their profile in the `user_profiles` table to set role as 'admin'

### 5. Run the Application

```bash
npm start
```

The application will be available at `http://localhost:3000`

## Database Schema

The application uses the following tables:

- **user_profiles**: User information and roles
- **sites**: Project sites
- **site_access**: Many-to-many relationship between users and sites
- **user_site_preferences**: User's preferred active site
- **materials**: Materials for each site
- **stock_history**: History of stock operations

## API Endpoints

### Authentication
- `POST /auth/login` - User login
- `POST /auth/signup` - User registration
- `POST /auth/logout` - User logout

### Sites (Admin/Manager only)
- `GET /sites` - List all sites
- `POST /sites` - Create new site
- `POST /sites/:id` - Update site
- `POST /sites/:id/delete` - Delete site (Admin only)

### Stock Management
- `GET /site/:siteId/materials` - Get materials for site
- `POST /site/:siteId/materials` - Add material (Admin/Manager)
- `POST /site/:siteId/materials/:id` - Update material (Admin/Manager)
- `POST /site/:siteId/materials/:id/delete` - Delete material (Admin only)
- `GET /site/:siteId/stock-history` - Get stock history
- `POST /site/:siteId/stock-op` - Perform stock operation

### Invoice Processing
- `POST /upload-invoice-image` - Upload invoice image
- `POST /submit-invoice` - Submit invoice data

## Security Features

- **Row Level Security (RLS)**: Database-level security policies
- **Role-based Access Control**: Different permissions per user role
- **Session Management**: Secure session handling
- **Input Validation**: Server-side validation for all inputs
- **CSRF Protection**: Built-in protection against CSRF attacks

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_URL` | Your Supabase project URL | Yes |
| `SUPABASE_ANON_KEY` | Your Supabase anon/public key | Yes |
| `SESSION_SECRET` | Secret key for session encryption | Yes |
| `NODE_ENV` | Environment (development/production) | No |

## Troubleshooting

### Common Issues

1. **"Missing Supabase environment variables"**:
   - Make sure you have a `.env` file with the correct Supabase credentials

2. **"Authentication failed"**:
   - Check that your Supabase project is active
   - Verify your API keys are correct
   - Ensure email authentication is enabled in Supabase

3. **"Permission denied" errors**:
   - Check that RLS policies are properly set up
   - Verify user roles are correctly assigned
   - Ensure users have proper site access

4. **Database connection issues**:
   - Verify your Supabase project is not paused
   - Check that the database schema has been applied correctly

### Getting Help

If you encounter issues:
1. Check the browser console for JavaScript errors
2. Check the server logs for backend errors
3. Verify your Supabase dashboard for any issues
4. Ensure all environment variables are set correctly

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the ISC License. 