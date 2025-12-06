# Deployment Guide

This guide covers deploying the Stryktipset AI Predictor to Vercel with Supabase database.

## Overview

The project uses:
- **Vercel**: Hosting and automatic deployments
- **GitHub Actions**: CI/CD pipeline for validation
- **Supabase**: PostgreSQL database with Prisma ORM
- **Git Hooks (Husky)**: Pre-commit validation

## Pre-Deployment Checklist

Before deploying, ensure you have:

- [x] GitHub repository with code pushed
- [x] Supabase project created
- [x] Anthropic API key (for Claude)
- [x] OpenAI API key (for embeddings)
- [x] All environment variables documented in `.env.example`

## Initial Vercel Setup

### 1. Create Vercel Account

1. Go to https://vercel.com/signup
2. Sign up with your GitHub account
3. Authorize Vercel to access your repositories

### 2. Import Project

1. Click **"Add New..."** → **"Project"**
2. Select your GitHub repository
3. Vercel will auto-detect Nuxt.js framework

### 3. Configure Build Settings

**Framework Preset**: Nuxt.js (auto-detected)

**Build Configuration**:
- **Build Command**: `npm run vercel-build`
- **Output Directory**: `.output/public` (auto-detected)
- **Install Command**: `npm install` (default)
- **Development Command**: `npm run dev` (auto-detected)

Click **"Deploy"** - this first deployment will fail due to missing environment variables.

### 4. Configure Environment Variables

Go to **Project Settings** → **Environment Variables**.

Add the following variables for **Production**, **Preview**, and **Development**:

#### Required Variables

| Variable | Value | Where to Get |
|----------|-------|--------------|
| `DATABASE_URL` | `postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres` | Supabase → Settings → Database → Connection string |
| `SUPABASE_URL` | `https://[PROJECT-REF].supabase.co` | Supabase → Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | `eyJ...` | Supabase → Settings → API → anon public key |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | https://console.anthropic.com/ |
| `OPENAI_API_KEY` | `sk-proj-...` | https://platform.openai.com/api-keys |
| `SVENSKA_SPEL_API_BASE_URL` | `https://api.svenskaspel.se/draw/1` | Default value |

#### Optional Variables

| Variable | Value | Notes |
|----------|-------|-------|
| `PROXY_LIST` | Comma-separated proxy URLs | For scraping anti-detection |

**Important**: Make sure to add variables to **all three environments** (Production, Preview, Development).

### 5. Redeploy

After adding environment variables:

1. Go to **Deployments** tab
2. Click the three dots (**...**) on the failed deployment
3. Select **"Redeploy"**
4. Wait for build to complete

## GitHub Actions Setup

### Enable GitHub Actions

GitHub Actions are enabled automatically when you push the workflow files.

### Required Workflows

The project includes these workflows:

#### `.github/workflows/ci.yml` - Main CI Pipeline

Runs on every PR and push to `main`:
- ESLint validation
- Prettier formatting check
- TypeScript type checking
- Prisma schema validation
- Build verification

#### `.github/workflows/db-check.yml` - Database Validation

Runs when `prisma/schema.prisma` changes:
- Validates Prisma schema
- Checks for formatting issues
- Generates Prisma client

### Viewing Workflow Status

1. Go to your GitHub repository
2. Click **"Actions"** tab
3. View workflow runs and logs

## Git Hooks (Pre-Commit)

The project uses Husky + lint-staged to run checks before every commit.

### What Runs on Commit

When you run `git commit`, the following automatically runs on staged files:

1. **ESLint**: Fixes linting issues
2. **Prettier**: Formats code
3. **TypeScript**: Type checks

### Setup Git Hooks

After cloning the repository:

```bash
npm install  # Automatically sets up Husky via prepare script
```

### Skipping Hooks (Not Recommended)

If you need to bypass hooks in an emergency:

```bash
git commit --no-verify -m "Emergency fix"
```

**Warning**: This skips all validation. Use only when absolutely necessary.

## Database Migration Strategy

### Development Workflow

1. **Make schema changes** in `prisma/schema.prisma`
2. **Push to database**:
   ```bash
   npm run db:push  # Quick iteration, no migration file
   ```
3. **Test locally**
4. **When ready, create migration**:
   ```bash
   npx prisma migrate dev --name add_new_feature
   ```
5. **Commit migration files**:
   ```bash
   git add prisma/migrations/
   git commit -m "Add database migration for new feature"
   ```

### Production Deployment

**Option A: Manual Migration (Recommended)**

After deploying to Vercel:

```bash
# Set production DATABASE_URL locally
export DATABASE_URL="postgresql://..."

# Deploy migrations
npm run db:migrate:deploy
```

**Option B: Vercel Build Command**

Modify `vercel.json` to run migrations during build:

```json
{
  "buildCommand": "prisma migrate deploy && npm run vercel-build"
}
```

**Warning**: This can cause deployment failures if migrations fail.

**Option C: GitHub Actions Workflow**

Create `.github/workflows/deploy-migrations.yml` to run migrations automatically.

### Migration Best Practices

- ✅ Test migrations locally first
- ✅ Create backup before running production migrations
- ✅ Use `prisma migrate deploy` (not `dev`) in production
- ✅ Keep migrations small and incremental
- ❌ Never edit existing migration files
- ❌ Don't use `db:push` in production

**For detailed migration history and troubleshooting**, see [DATABASE_CHANGES.md](./DATABASE_CHANGES.md)

## Deployment Workflow

### Feature Development

1. Create feature branch:
   ```bash
   git checkout -b feature/new-feature
   ```

2. Make changes (hooks run automatically on commit)

3. Push to GitHub:
   ```bash
   git push origin feature/new-feature
   ```

4. Open Pull Request
   - GitHub Actions runs CI checks
   - Vercel creates preview deployment
   - Review preview URL in PR comments

5. After approval, merge to `main`
   - GitHub Actions validates again
   - Vercel deploys to production
   - Production URL updates automatically

### Preview Deployments

Every PR gets a unique preview URL:
- Format: `https://st-predictor-<branch>-<random>.vercel.app`
- Isolated environment with preview database (optional)
- Perfect for testing before production

### Production Deployment

Merging to `main` triggers production deployment:
- URL: `https://st-predictor.vercel.app` (or your custom domain)
- Automatic HTTPS
- Global CDN distribution
- Zero-downtime deployments

## Environment Separation

### Recommended Setup

**Production**:
- Supabase production database
- Production API keys
- Strict rate limits

**Preview (PR deployments)**:
- Separate Supabase project OR same database with preview tables
- Development API keys
- Relaxed rate limits

**Local Development**:
- Local `.env` file
- Development database (can be same as preview)
- Test API keys

## Monitoring and Debugging

### Vercel Dashboard

Access at https://vercel.com/dashboard

**Features**:
- Real-time deployment logs
- Function logs (Nuxt server functions)
- Performance analytics
- Error tracking

### Viewing Logs

1. Go to Vercel project
2. Click **"Deployments"**
3. Select a deployment
4. View **"Building"** and **"Runtime Logs"**

### Common Issues

#### Build Fails: "Cannot find module"

**Cause**: Missing dependency in `package.json`

**Fix**:
```bash
npm install <missing-package> --save
git commit -am "Add missing dependency"
git push
```

#### Build Fails: Prisma Error

**Cause**: `DATABASE_URL` not set or invalid

**Fix**:
1. Check Vercel environment variables
2. Verify DATABASE_URL format
3. Test connection locally

#### Runtime Error: API Key Invalid

**Cause**: Environment variables not accessible at runtime

**Fix**:
1. Ensure variables are in Vercel settings
2. Verify `nuxt.config.ts` exposes them via `runtimeConfig`
3. Redeploy after adding variables

## Custom Domain Setup

### Add Custom Domain

1. Go to Vercel project → **Settings** → **Domains**
2. Enter your domain (e.g., `stryktipset.example.com`)
3. Follow Vercel's DNS configuration instructions
4. Wait for DNS propagation (5-60 minutes)
5. HTTPS certificate automatically provisioned

### DNS Configuration

If using external DNS provider:

**Option A: CNAME Record**
```
Type: CNAME
Name: stryktipset (or www)
Value: cname.vercel-dns.com
```

**Option B: A Records** (for apex domain)
```
Type: A
Name: @
Value: 76.76.21.21
```

## Performance Optimization

### Build Optimization

Vercel automatically:
- ✅ Minifies JavaScript
- ✅ Optimizes images
- ✅ Enables compression
- ✅ Serves from global CDN

### Database Connection Pooling

Use Supabase connection pooler (already configured in `DATABASE_URL`):
- Prevents connection exhaustion
- Handles serverless function scaling
- Recommended for production

### Caching Strategy

Configure in `nuxt.config.ts`:
```typescript
export default defineNuxtConfig({
  routeRules: {
    '/api/draws/current': { swr: 3600 }, // Cache for 1 hour
    '/api/performance/**': { swr: 600 }, // Cache for 10 minutes
  }
})
```

## Security Checklist

Before going live:

- [ ] All environment variables configured in Vercel
- [ ] No secrets committed to git
- [ ] HTTPS enabled (automatic with Vercel)
- [ ] Security headers configured (in `vercel.json`)
- [ ] API keys use minimum required permissions
- [ ] Database uses strong password
- [ ] Supabase Row Level Security enabled (if needed)
- [ ] Rate limiting implemented for scraping
- [ ] Error messages don't expose sensitive data

## Rollback Strategy

### Instant Rollback

If production deployment has issues:

1. Go to Vercel → **Deployments**
2. Find last working deployment
3. Click three dots (**...**)
4. Select **"Promote to Production"**
5. Instant rollback (< 10 seconds)

### Database Rollback

If migrations cause issues:

1. Identify problematic migration
2. Create new migration to revert changes
3. Deploy revert migration
4. Test thoroughly before redeploying

**Warning**: Never delete migration files or edit migration history.

## Cost Estimation

### Vercel Pricing

**Hobby Plan** (Free):
- Unlimited deployments
- 100 GB bandwidth/month
- 100 hours serverless function execution/month
- 6,000 serverless function invocations/day

**Pro Plan** ($20/month):
- Everything in Hobby
- Unlimited bandwidth
- 1,000 hours function execution/month
- 100,000 function invocations/day
- Team collaboration

### Expected Costs

For personal use (weekly predictions):
- **Vercel**: $0/month (Hobby plan sufficient)
- **Supabase**: $0/month (Free tier: 500MB database, 2GB bandwidth)
- **Claude API**: ~$2-5/month (13 predictions/week)
- **OpenAI**: ~$0.10/month (embeddings)

**Total**: ~$2-5/month

## Support and Troubleshooting

### Vercel Support

- Documentation: https://vercel.com/docs
- Community: https://github.com/vercel/vercel/discussions
- Status: https://vercel-status.com

### Project-Specific Help

See also:
- [ENV_SETUP.md](./ENV_SETUP.md) - Environment variables guide
- [SETUP.md](./SETUP.md) - Local development setup
- [DATABASE_CHANGES.md](./DATABASE_CHANGES.md) - Database migrations and schema
- [SCRAPER_GUIDE.md](./SCRAPER_GUIDE.md) - Web scraper implementation
- [API_INTEGRATION.md](./API_INTEGRATION.md) - Svenska Spel API integration
- [README.md](../README.md) - Project overview

### Getting Help

If you encounter issues:

1. Check Vercel deployment logs
2. Review GitHub Actions workflow logs
3. Verify all environment variables
4. Test locally with production database
5. Check Supabase logs for database errors

## Appendix: Complete Deployment Commands

```bash
# Local development
npm install
npm run dev

# Build locally (test before deploy)
npm run build
npm run preview

# Database operations
npm run db:push              # Quick schema sync (development)
npm run db:migrate:deploy    # Deploy migrations (production)
npm run db:studio            # Open Prisma Studio

# Code quality
npm run lint                 # Check linting
npm run lint:fix             # Fix linting issues
npm run format               # Format all files
npm run typecheck            # Type check TypeScript

# Vercel CLI (optional)
npm install -g vercel
vercel login
vercel                       # Deploy to preview
vercel --prod                # Deploy to production
```

## Next Steps

After successful deployment:

1. ✅ Test all features in production
2. ✅ Run initial data sync
3. ✅ Test scraping functionality
4. ✅ Generate first predictions
5. ✅ Monitor performance and errors
6. ✅ Set up monitoring alerts (optional)
7. ✅ Configure custom domain (optional)

Congratulations! Your Stryktipset AI Predictor is now live! 🎉

