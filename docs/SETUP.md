# Stryktipset AI Predictor - Setup Guide

This guide will walk you through setting up the Stryktipset AI Predictor from scratch.

## Prerequisites Checklist

Before you begin, ensure you have:

- [ ] Node.js 20 or higher installed
- [ ] A Supabase account (free tier is fine)
- [ ] An Anthropic API key
- [ ] An OpenAI API key
- [ ] Git installed

## Step-by-Step Setup

### Step 1: Create Supabase Project

1. Go to https://supabase.com and sign in
2. Click "New Project"
3. Choose your organization
4. Fill in:
   - **Project name**: `stryktipset-predictor` (or your choice)
   - **Database Password**: Generate a strong password and save it
   - **Region**: Choose closest to you
   - **Pricing Plan**: Free tier is sufficient to start
5. Click "Create new project" and wait for it to initialize (2-3 minutes)

### Step 2: Get Supabase Credentials

Once your project is ready:

1. Go to **Project Settings** (gear icon in left sidebar)
2. Navigate to **API** section
3. Copy and save:
   - **Project URL** (something like `https://xxxxx.supabase.co`)
   - **anon public** key (under "Project API keys")
4. Navigate to **Database** section
5. Scroll to **Connection string** > **URI**
6. Copy the connection string
7. Replace `[YOUR-PASSWORD]` with the database password you created

### Step 3: Enable pgvector Extension

1. In your Supabase dashboard, go to **SQL Editor**
2. Click "New query"
3. Paste and run:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
4. Click "Run" - you should see "Success. No rows returned"

### Step 4: Get API Keys

#### Anthropic (Claude AI)

1. Go to https://console.anthropic.com
2. Sign up or log in
3. Navigate to **API Keys**
4. Click "Create Key"
5. Name it (e.g., "Stryktipset Predictor")
6. Copy and save the key (starts with `sk-ant-...`)

#### OpenAI (Embeddings)

1. Go to https://platform.openai.com
2. Sign up or log in
3. Navigate to **API Keys**
4. Click "Create new secret key"
5. Name it (e.g., "Stryktipset Embeddings")
6. Copy and save the key (starts with `sk-...`)

### Step 5: Clone and Install Project

```bash
# Clone the repository
git clone <your-repo-url>
cd st-predictor

# Install dependencies
npm install
```

### Step 6: Configure Environment Variables

**CRITICAL STEP**: The `.env` file is NOT included in the repository for security reasons. You MUST create it manually.

#### Why the `.env` File Doesn't Exist

The `.env` file containing actual credentials is intentionally blocked from being committed to git (via `.gitignore`). This is a **security best practice** to prevent API keys and passwords from being exposed.

#### Create Your `.env` File

**Option 1: Copy from Example**
```bash
cp .env.example .env
```
Then fill in all values with your actual credentials.

**Option 2: Create Manually**
```bash
touch .env
```

Open `.env` in your text editor and add ALL of the following with your actual values:

```env
# Database (from Step 2)
DATABASE_URL="postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres"

# Supabase (from Step 2)
SUPABASE_URL="https://[project-ref].supabase.co"
SUPABASE_ANON_KEY="your-anon-key-here"

# AI APIs (from Step 4)
ANTHROPIC_API_KEY="sk-ant-your-key-here"
OPENAI_API_KEY="sk-your-key-here"

# Svenska Spel API (default is correct)
SVENSKA_SPEL_API_BASE_URL="https://api.spela.svenskaspel.se/draw/1/stryktipset"
```

#### Quick Reference: Where to Find Each Value

| Variable | Where to Find |
|----------|---------------|
| `DATABASE_URL` | Supabase Dashboard → Settings → Database → Connection string |
| `SUPABASE_URL` | Supabase Dashboard → Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API → anon public key |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com/ → API Keys |
| `OPENAI_API_KEY` | https://platform.openai.com/api-keys |
| `SVENSKA_SPEL_API_BASE_URL` | Use default value provided above |

**For detailed instructions** on where to find each value, see [ENV_SETUP.md](./ENV_SETUP.md)

#### Security Reminder

⚠️ **NEVER**:
- Commit `.env` to git
- Share your `.env` file
- Include API keys in screenshots
- Post your credentials anywhere public

✅ **ALWAYS**:
- Keep `.env` local only
- Use different keys for different projects
- Rotate keys if accidentally exposed
- Back up `.env` securely (password manager)

### Step 7: Verify Nuxt UI 4 Configuration

The project uses **Nuxt UI 4** with **Tailwind CSS 4**. The configuration should already be correct, but verify:

#### Check CSS File

Ensure `assets/css/main.css` exists with these exact imports:

```css
@import 'tailwindcss';
@import '@nuxt/ui';
```

#### Check Nuxt Config

Verify `nuxt.config.ts` includes:

```typescript
export default defineNuxtConfig({
  css: ['~/assets/css/main.css'],
  // ... other config
})
```

#### Check App Wrapper

Verify `app.vue` wraps the application with `<UApp>`:

```vue
<template>
  <UApp>
    <NuxtPage />
  </UApp>
</template>
```

**Why this matters**: Nuxt UI 4 requires these specific imports and the `<UApp>` wrapper for components to function correctly. Without them, UI components won't render or style properly.

### Step 8: Initialize Database

Push the Prisma schema to your Supabase database:

```bash
npm run db:push
```

You should see:
```
Your database is now in sync with your Prisma schema. Done in XXXms
✔ Generated Prisma Client
```

### Step 9: Verify Installation

Optional: Open Prisma Studio to see your database:

```bash
npm run db:studio
```

This opens a browser at http://localhost:5555 where you can view all tables.

### Step 10: Start Development Server

**Option A: Nuxt only (DOM scraping)**
```bash
npm run dev
```

**Option B: With AI Scraper (recommended)**
```bash
npm run dev:all
```

This starts both Nuxt (port 3000) and AI Scraper (port 8000).

**Option C: Separate terminals**
```bash
# Terminal 1: Nuxt
npm run dev

# Terminal 2: AI Scraper
npm run dev:ai
```

You should see:
```
Nuxt 4.0.0 with Nitro 2.x

  > Local:    http://localhost:3000/
```

### Step 11: First Use

1. Open http://localhost:3000 in your browser
2. Click "Sync Draws" to fetch current Stryktipset draws
3. Wait for draws to load (5-10 seconds)
4. Click "Generate Predictions" on a draw
5. Wait for predictions to complete (30-60 seconds per draw)
6. Explore the predictions and optimize a coupon!

## Troubleshooting

### "Cannot connect to database"

**Problem**: Database connection fails

**Solutions**:
1. Verify your DATABASE_URL is correct in `.env`
2. Check that the password in the connection string matches your Supabase password
3. Ensure your Supabase project is active (not paused)
4. Try running `npm run db:push` again

### "pgvector extension not found"

**Problem**: Error about vector type

**Solutions**:
1. Go to Supabase SQL Editor
2. Run: `CREATE EXTENSION IF NOT EXISTS vector;`
3. Run `npm run db:push` again

### "Anthropic API key invalid"

**Problem**: Claude AI predictions fail

**Solutions**:
1. Verify your ANTHROPIC_API_KEY in `.env`
2. Check the key is active in Anthropic Console
3. Ensure you have available credits
4. Restart the dev server after changing `.env`

### "OpenAI API key invalid"

**Problem**: Vector embeddings fail

**Solutions**:
1. Verify your OPENAI_API_KEY in `.env`
2. Check the key is active in OpenAI Platform
3. Ensure you have available credits
4. Restart the dev server after changing `.env`

### Scraping fails with rate limiting

**Problem**: Web scraping gets blocked

**Solutions**:
1. This is normal occasionally - the system will retry
2. Check scraper health in Analytics
3. Wait a few minutes and try again
4. Adjust rate limits in `server/services/scraper/scraper-queue.ts` if needed

### Port 3000 already in use

**Problem**: Dev server won't start

**Solutions**:
1. Stop other applications using port 3000
2. Or run with different port:
   ```bash
   PORT=3001 npm run dev
   ```

## Testing Your Setup

### Test 1: Database Connection

```bash
npm run db:studio
```

Should open Prisma Studio without errors.

### Test 2: API Sync

1. Start dev server: `npm run dev`
2. Open http://localhost:3000
3. Click "Sync Draws"
4. Should see draws appear within 10 seconds

### Test 3: Prediction Generation

1. With draws loaded, click "Generate Predictions" on an open draw
2. Wait 30-60 seconds
3. Should see prediction with probabilities

### Test 4: Scraping (Optional)

1. Go to a draw detail page
2. Click "Scrape" on a match
3. Wait 10-20 seconds
4. Should complete without errors

## Scripts Reference

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Nuxt dev server only |
| `npm run dev:ai` | Start AI Scraper service only |
| `npm run dev:all` | Start both services with concurrently |
| `npm run build` | Build for production |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run db:push` | Push Prisma schema to database |
| `npm run db:studio` | Open Prisma Studio |

## Next Steps

Once setup is complete:

1. **Read the PRD**: `docs/PRD.md` for full feature documentation
2. **Set up AI Scraper**: See [AI_SCRAPER.md](./AI_SCRAPER.md) for the hybrid AI scraper
3. **Explore the code**: Start with `server/services/` to understand the architecture
4. **Customize**: Adjust confidence thresholds, scraping delays, etc.
5. **Build history**: Let it run for a few weeks to build prediction history
6. **Monitor performance**: Check analytics regularly to see how predictions perform

## Getting Help

If you encounter issues not covered here:

1. Check server logs in the terminal
2. Check browser console (F12) for frontend errors
3. Review the error message carefully
4. Check that all environment variables are set
5. Verify all API keys are active and have credits

## Maintenance

### Updating Dependencies

```bash
npm update
```

### Backing Up Database

Use Supabase's built-in backup features in the dashboard.

### Monitoring Costs

- **Supabase**: Free tier includes 500MB database, 2GB bandwidth
- **Anthropic**: ~$0.003 per prediction (Claude 3.5 Sonnet)
- **OpenAI**: ~$0.0001 per embedding (text-embedding-3-small)

Estimated monthly cost for regular use: $5-15

---

**Setup Complete!** 🎉

You now have a fully functional AI-powered Stryktipset prediction system.

