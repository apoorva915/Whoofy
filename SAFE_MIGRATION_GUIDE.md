# 🛡️ Safe Migration Guide - DO NOT RESET DATABASE

## ⚠️ Current Situation

Prisma detected that your database has:
- **Existing tables** (accounts, campaigns, users, etc.) with data
- **Existing migrations** that aren't in your local migrations folder
- **Schema drift** between your Prisma schema and the actual database

**DO NOT answer `y` to reset** - this will DELETE ALL YOUR DATA!

## ✅ Safe Solution: Baseline Your Database

### Option 1: Introspect Existing Database (Recommended)

This will add all existing tables to your Prisma schema:

```bash
# 1. Cancel current operation (press N)

# 2. Pull existing schema from database
npx prisma db pull

# This will update your schema.prisma with all existing tables
# Review the changes carefully

# 3. Generate Prisma client
npm run db:generate

# 4. Create migration for ONLY the aimodule schema
npx prisma migrate dev --create-only --name add_aimodule_schema
```

Then manually edit the migration file to ONLY include the `aimodule` schema creation, not any changes to existing tables.

### Option 2: Mark Existing Migrations as Applied

If you want to keep your current schema and just add aimodule:

```bash
# 1. Cancel current operation (press N)

# 2. Mark all existing migrations as applied (so Prisma knows they exist)
npx prisma migrate resolve --applied 20250722141600_add_all_models
npx prisma migrate resolve --applied 20250723105037_add_password_field
npx prisma migrate resolve --applied 20250724072044_refactor_user_and_add_profiles
npx prisma migrate resolve --applied 20250724084057_added_contact_no
npx prisma migrate resolve --applied 20250724094712_add_bio_and_links_to_promoter_profile
npx prisma migrate resolve --applied 20250724125644_add_notification_module
npx prisma migrate resolve --applied 20250725061245_add_reel_submission
npx prisma migrate resolve --applied 20250728135130_major_change
npx prisma migrate resolve --applied 20250806065245_add_social_profiles_and_posts
npx prisma migrate resolve --applied 20250819064349_apify_intigration
npx prisma migrate resolve --applied 20250819081456_added_ig_verification_code
npx prisma migrate resolve --applied 20250820002328_added_video_play_count
npx prisma migrate resolve --applied 20250820011440_added_ai_training_data
npx prisma migrate resolve --applied 20260110113237_add_campaign_comments
npx prisma migrate resolve --applied 20260110115425_add_campaign_visibility

# 3. Now create a new migration for aimodule schema only
npx prisma migrate dev --name add_aimodule_schema
```

### Option 3: Use SQL Directly (Safest for Adding aimodule)

Since you already created the aimodule schema, you can just create the tables directly:

```bash
# 1. Cancel current operation (press N)

# 2. The aimodule schema already exists (from setup-supabase script)

# 3. Generate Prisma client (it will work even without migrations)
npm run db:generate

# 4. Use Prisma Studio to verify tables exist
npm run db:studio
```

Then manually create tables using SQL in Supabase dashboard, or use `prisma db push --accept-data-loss` but ONLY for the aimodule schema.

## 🎯 Recommended Approach

**For now, the safest thing is:**

1. **Cancel the migration** (press `N`)
2. **Your aimodule schema already exists** (from `npm run db:setup-supabase`)
3. **Generate Prisma client:**
   ```bash
   npm run db:generate
   ```
4. **Use Prisma Studio to verify:**
   ```bash
   npm run db:studio
   ```
5. **If tables don't exist in aimodule schema**, create them manually via SQL in Supabase dashboard

## 📝 What Tables Should Exist in aimodule Schema

After setup, you should have:
- `video_analyses`
- `frame_analyses`
- `video_analysis_summaries`
- `sentiment_analyses`
- `language_region_analyses`
- `comment_analyses`

## ⚠️ Important Notes

- **Never use `prisma migrate reset` or answer `y` to reset** if you have production data
- **Always backup** before major schema changes
- **Use migrations** for version control, but be careful with drift detection
- **Consider using `prisma db pull`** to sync your schema with existing database

## 🔍 Verify Your Setup

After following the steps:

1. Check Supabase dashboard → Table Editor → Switch to `aimodule` schema
2. Verify all 6 tables exist
3. Test Prisma client:
   ```typescript
   import { prisma } from '@/config/database';
   const count = await prisma.videoAnalysis.count();
   console.log('Video analyses:', count);
   ```
