# ⚠️ Database Migration Warning

## Current Situation

Your Supabase database has **13 tables with existing data** that are not defined in your Prisma schema:

- `accounts` (8 rows)
- `brand_profiles` (4 rows)
- `campaign_assignments` (1 row)
- `campaigns` (19 rows)
- `clipping_campaign_details` (1 row)
- `creator_profiles` (3 rows)
- `instagram_posts` (10 rows)
- `instagram_verifications` (1 row)
- `notifications` (21 rows)
- `social_profiles` (2 rows)
- `ugc_campaign_details` (10 rows)
- `users` (8 rows)
- `wallets` (3 rows)

**Total: ~91 rows of data at risk**

## Why This Is Happening

Your Prisma schema only defines:
- `Campaign`, `Creator`, `Submission`, `VerificationResult` (in `public` schema)
- `VideoAnalysis`, `FrameAnalysis`, etc. (in `aimodule` schema)

Prisma `db push` wants to drop any tables not in your schema to match it exactly.

## Options

### Option 1: Use Migrations (Recommended - Safer)

Migrations allow you to create new tables without dropping existing ones:

```bash
# Create a migration for the aimodule schema only
npm run db:migrate

# Name it something like: "add_aimodule_schema"
```

This will:
- ✅ Create the `aimodule` schema tables
- ✅ Keep all existing tables intact
- ✅ Allow you to review changes before applying

### Option 2: Add Missing Tables to Prisma Schema

If you need these tables, add them to your `prisma/schema.prisma`:

```prisma
model Account {
  // ... define fields based on your existing table structure
  @@schema("public")
}

model BrandProfile {
  // ... define fields
  @@schema("public")
}

// ... etc for all 13 tables
```

Then run `prisma db pull` to introspect the existing database structure first.

### Option 3: Proceed with Caution (NOT RECOMMENDED)

If you're sure you don't need the existing data:

1. **Backup your database first:**
   ```bash
   # Use Supabase dashboard → Settings → Database → Backups
   # Or use pg_dump
   ```

2. Then answer `y` to the prompt

## Recommended Next Steps

1. **Cancel the current operation** (press `N` or Ctrl+C)

2. **Use migrations instead:**
   ```bash
   npm run db:migrate
   ```

3. **Verify tables in Supabase dashboard:**
   - Check that existing tables are still there
   - Verify new `aimodule` schema tables are created

## Need Help?

If you're unsure which tables you need:
1. Check your application code for references to these tables
2. Review your Supabase dashboard to see what's using them
3. Consider keeping them in the schema if they're part of your application
