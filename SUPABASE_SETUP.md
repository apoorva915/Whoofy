# Supabase Integration Setup Guide

This guide will help you integrate Supabase with your Whoofy project and set up the `aimodule` schema.

## Prerequisites

1. A Supabase project (you already have one: `benny's Project` in `chhayank-20's Org`)
2. Node.js and npm installed
3. Prisma CLI installed (already in devDependencies)

## Step 1: Get Supabase Credentials

1. Go to your Supabase project dashboard: https://supabase.com/dashboard
2. Navigate to **Settings** → **API**
3. Copy the following values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key** (under "Project API keys")
   - **service_role key** (under "Project API keys" - keep this secret!)

## Step 2: Configure Environment Variables

Add the following to your `.env` file:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Database URL (should point to your Supabase PostgreSQL database)
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-ID].supabase.co:5432/postgres
```

To get your database connection string:
1. Go to **Settings** → **Database**
2. Under "Connection string", select "URI"
3. Copy the connection string and replace `[YOUR-PASSWORD]` with your database password

## Step 3: Create the aimodule Schema

Run the setup script to create the schema:

```bash
npm run db:setup-supabase
```

This will:
- Create the `aimodule` schema in your Supabase database
- Set up proper permissions for Supabase roles (anon, authenticated, service_role)

## Step 4: Run Prisma Migrations

Generate Prisma client and push the schema:

```bash
# Generate Prisma client with the new schema
npm run db:generate

# Push the schema to database (creates tables)
npm run db:push
```

Or use migrations for production:

```bash
# Create a migration
npm run db:migrate

# Apply migrations
npx prisma migrate deploy
```

## Step 5: Verify Setup

1. **Check Supabase Dashboard:**
   - Go to **Table Editor** in your Supabase dashboard
   - You should see a dropdown to switch between `public` and `aimodule` schemas
   - Select `aimodule` schema and verify the tables are created:
     - `video_analyses`
     - `frame_analyses`
     - `video_analysis_summaries`
     - `sentiment_analyses`
     - `language_region_analyses`
     - `comment_analyses`

2. **Test the Connection:**
   ```bash
   npm run db:studio
   ```
   This opens Prisma Studio where you can view and manage your data.

## Step 6: Use Supabase Client in Your Code

Import and use the Supabase client:

```typescript
import { getSupabaseClient } from '@/config/supabase';

// Get regular client (uses anon key)
const supabase = getSupabaseClient();

// Get admin client (uses service role key - for admin operations)
import { getSupabaseAdminClient } from '@/config/supabase';
const adminSupabase = getSupabaseAdminClient();
```

## Schema Overview

The `aimodule` schema contains the following tables:

### `video_analyses`
Stores video/reel analysis sessions with metadata.

### `frame_analyses`
Stores individual frame analysis results including:
- Objects detected
- Labels, text, logos
- Brand detections
- People demographics (gender, age)
- Visual similarity scores

### `video_analysis_summaries`
Aggregated summary of all frames in a video analysis.

### `sentiment_analyses`
Stores sentiment analysis results from Gemini/OpenAI.

### `language_region_analyses`
Stores language and region detection results.

### `comment_analyses`
Stores Instagram comment analysis results.

## Using Prisma with Multiple Schemas

When querying aimodule tables, Prisma will automatically use the correct schema:

```typescript
import { prisma } from '@/config/database';

// Query aimodule schema tables
const videoAnalysis = await prisma.videoAnalysis.create({
  data: {
    reelUrl: 'https://instagram.com/reel/...',
    analysisType: 'local',
    status: 'processing',
  },
});

const frames = await prisma.frameAnalysis.findMany({
  where: {
    videoAnalysisId: videoAnalysis.id,
  },
});
```

## Troubleshooting

### Schema not found error
If you get "schema 'aimodule' does not exist":
1. Make sure you ran `npm run db:setup-supabase`
2. Check that the SQL script executed successfully
3. Verify in Supabase dashboard that the schema exists

### Permission errors
If you get permission errors:
1. Check that the SQL migration ran successfully
2. Verify the database user has CREATE SCHEMA permission
3. Check Supabase dashboard → Settings → Database → Roles

### Prisma client not recognizing schema
1. Run `npm run db:generate` again
2. Restart your development server
3. Check that `schemas = ["public", "aimodule"]` is in your `datasource db` block

## Next Steps

1. Create API endpoints to save analysis results to the database
2. Set up Supabase Row Level Security (RLS) policies if needed
3. Create indexes for better query performance
4. Set up real-time subscriptions if needed

## Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Prisma Multi-Schema Guide](https://www.prisma.io/docs/guides/database/using-multiple-schemas)
- [Supabase PostgreSQL Guide](https://supabase.com/docs/guides/database)
