# Environment Variables Setup Guide

This guide explains all environment variables required for the Stryktipset AI Predictor.

## Quick Start

1. Copy the example file:
   ```bash
   cp .env.example .env
   ```

2. Fill in all values using the detailed instructions below.

## Required Environment Variables

### Database Configuration

#### `DATABASE_URL`
**Purpose**: Connection string for Supabase PostgreSQL database

**Format**:
```
postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

**Where to find**:
1. Go to https://supabase.com/dashboard
2. Select your project
3. Navigate to: **Settings** → **Database**
4. Under **Connection string**, copy the **Transaction** pooler string
5. Select **Session mode** from the dropdown
6. Replace `[YOUR-PASSWORD]` with your actual database password

**Example**:
```
DATABASE_URL="postgresql://postgres:MySecurePassword123@db.abcdefghijk.supabase.co:5432/postgres"
```

---

### Supabase Configuration

#### `SUPABASE_URL`
**Purpose**: Your Supabase project URL for client connections

**Format**:
```
https://[PROJECT-REF].supabase.co
```

**Where to find**:
1. Supabase Dashboard → **Settings** → **API**
2. Copy the **Project URL**

**Example**:
```
SUPABASE_URL="https://abcdefghijk.supabase.co"
```

#### `SUPABASE_ANON_KEY`
**Purpose**: Public anonymous key for Supabase client (safe for client-side use)

**Format**: Long JWT token starting with `eyJ...`

**Where to find**:
1. Supabase Dashboard → **Settings** → **API**
2. Under **Project API keys**, copy the **anon** **public** key

**Example**:
```
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE2Nzg5MDEyMzQsImV4cCI6MTk5NDQ3NzIzNH0.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

---

### AI API Keys

#### `ANTHROPIC_API_KEY`
**Purpose**: Claude AI API key for match predictions and reasoning

**Format**: Starts with `sk-ant-api03-`

**Where to get**:
1. Visit https://console.anthropic.com/
2. Sign up or log in
3. Navigate to **API Keys**
4. Click **Create Key**
5. Copy the key immediately (it won't be shown again)

**Pricing**: Pay-as-you-go (approximately $0.02-0.05 per prediction)

**Example**:
```
ANTHROPIC_API_KEY="sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

#### `OPENAI_API_KEY`
**Purpose**: OpenAI API key for generating vector embeddings (similarity search)

**Format**: Starts with `sk-proj-` or `sk-`

**Where to get**:
1. Visit https://platform.openai.com/api-keys
2. Sign up or log in
3. Click **Create new secret key**
4. Name it (e.g., "Stryktipset Embeddings")
5. Copy the key immediately

**Pricing**: Pay-as-you-go (embeddings are very cheap: ~$0.0001 per match)

**Example**:
```
OPENAI_API_KEY="sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

---

### Svenska Spel API

#### `SVENSKA_SPEL_API_BASE_URL`
**Purpose**: Base URL for Svenska Spel's public API (product-specific endpoint)

**Default value** (usually correct):
```
SVENSKA_SPEL_API_BASE_URL="https://api.spela.svenskaspel.se/draw/1/stryktipset"
```

**Note**: This is a public API endpoint and rarely changes. The URL includes the product name (`stryktipset`) as required by the API. Only modify if Svenska Spel updates their API structure.

---

### Optional: Proxy Configuration

#### `PROXY_LIST`
**Purpose**: Comma-separated list of proxy servers for web scraping (anti-detection)

**Format**:
```
http://user:pass@proxy1.example.com:8080,http://user:pass@proxy2.example.com:8080
```

**When to use**:
- If you get rate-limited or blocked by Svenska Spel's website
- If you want to distribute scraping across multiple IP addresses
- For high-frequency scraping (not needed for weekly use)

**Where to get**:
- Residential proxy providers: Bright Data, Smartproxy, Oxylabs
- Datacenter proxies: ProxyRack, Proxy-Seller
- Free proxies: Not recommended (unreliable)

**Example**:
```
PROXY_LIST="http://user:password@proxy.example.com:8080"
```

**Note**: Leave empty if you don't need proxies. The system works fine without them for personal use.

---

## Security Best Practices

### DO:
✅ Keep `.env` file in project root (already in `.gitignore`)
✅ Use different API keys for development and production
✅ Rotate API keys if they're accidentally exposed
✅ Use environment-specific `.env` files if needed
✅ Back up your `.env` file securely (password manager, encrypted storage)

### DON'T:
❌ Commit `.env` to git or any version control
❌ Share API keys in screenshots or logs
❌ Use the same keys across multiple projects
❌ Store keys in plain text outside of `.env` file
❌ Share your `.env` file via email or chat

---

## Verification

After setting up your `.env` file, verify it works:

1. **Check file exists**:
   ```bash
   ls -la .env
   ```

2. **Verify format** (should show variable names only):
   ```bash
   grep -v '^#' .env | grep -v '^$'
   ```

3. **Test database connection**:
   ```bash
   npm run db:push
   ```
   Should show: "✔ Your database is now in sync"

4. **Start development server**:
   ```bash
   npm run dev
   ```
   Should start without errors

---

## Troubleshooting

### Error: "PrismaClientInitializationError: Invalid DATABASE_URL"
- Check DATABASE_URL format matches exactly: `postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres`
- Ensure no spaces or quotes inside the URL
- Verify password is correct

### Error: "Invalid API key" (Anthropic/OpenAI)
- Confirm key starts with correct prefix (`sk-ant-api03-` or `sk-proj-`)
- Check key wasn't truncated when copying
- Verify key hasn't been revoked in the provider dashboard

### Error: "Failed to fetch from Supabase"
- Verify SUPABASE_URL and SUPABASE_ANON_KEY are correct
- Check Supabase project is not paused (free tier limitation)
- Ensure pgvector extension is enabled

### Scraping fails repeatedly
- Check SVENSKA_SPEL_API_BASE_URL is correct
- Consider adding PROXY_LIST if being rate-limited
- Verify website structure hasn't changed

---

## Example Complete `.env` File

```env
# Database
DATABASE_URL="postgresql://postgres:MySecurePassword123@db.abcdefghijk.supabase.co:5432/postgres"

# Supabase
SUPABASE_URL="https://abcdefghijk.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ey...xxxxx"

# AI Services
ANTHROPIC_API_KEY="sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
OPENAI_API_KEY="sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# Svenska Spel API
SVENSKA_SPEL_API_BASE_URL="https://api.spela.svenskaspel.se/draw/1/stryktipset"

# Optional: Proxies (leave empty if not needed)
PROXY_LIST=""
```

---

## Cost Estimation

**Monthly costs for typical usage** (checking draws once a week):

| Service | Usage | Estimated Cost |
|---------|-------|----------------|
| Supabase Free Tier | Database + pgvector | $0/month |
| Claude AI (Anthropic) | ~13 predictions/week | ~$2-5/month |
| OpenAI Embeddings | ~13 embeddings/week | ~$0.10/month |
| Svenska Spel API | Public API | Free |
| **Total** | | **~$2-5/month** |

**Note**: Costs scale with usage. If you regenerate predictions multiple times or analyze historical data, costs will increase proportionally.

---

## Need Help?

If you're still having issues:
1. Double-check all values match the examples above
2. Ensure no extra spaces or quotes
3. Verify all services are active and not suspended
4. Check the main [SETUP.md](./SETUP.md) for additional troubleshooting steps

