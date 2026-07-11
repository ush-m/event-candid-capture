# Deployment Guide

## Quick Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
vercel env add VITE_DROPBOX_APP_KEY

# Deploy to production
vercel --prod
```

## Quick Deploy to Netlify

```bash
# Install Netlify CLI
npm i -g netlify-cli

# Deploy
netlify deploy --prod
```

## Supabase Setup

### 1. Create Project
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your Project URL and Anon Key

### 2. Run Migrations
Go to SQL Editor and run:
1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_cron_jobs.sql`

### 3. Deploy Edge Functions
```bash
# Install Supabase CLI
npm i -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref your-project-id

# Deploy all functions
supabase functions deploy create-session
supabase functions deploy upload-media
supabase functions deploy finalize-session
supabase functions deploy get-event-stats
supabase functions deploy get-review-session
supabase functions deploy get-event-guests
supabase functions deploy dropbox-oauth
supabase functions deploy dropbox-delivery
supabase functions deploy planner-signup
supabase functions deploy send-reminders
supabase functions deploy send-followup
supabase functions deploy cleanup-expired
```

### 4. Set Edge Function Secrets
```bash
supabase secrets set DROPBOX_APP_KEY=your-key
supabase secrets set DROPBOX_APP_SECRET=your-secret
supabase secrets set TWILIO_ACCOUNT_SID=your-sid
supabase secrets set TWILIO_AUTH_TOKEN=your-token
supabase secrets set TWILIO_FROM_NUMBER=+1xxx
supabase secrets set SENDGRID_API_KEY=your-key
supabase secrets set SENDGRID_FROM_EMAIL=noreply@yourdomain.com
supabase secrets set SITE_URL=https://your-domain.com
```

## Dropbox Setup

1. Go to [Dropbox Developer Console](https://www.dropbox.com/developers)
2. Create a new app
3. Choose "Scoped access" → "Full Dropbox"
4. Add permissions: `files.content.write`, `files.content.read`
5. Set redirect URI to: `https://your-project.supabase.co/functions/v1/dropbox-oauth`
6. Copy App Key and App Secret to your secrets

## Optional: Twilio (SMS Reminders)

1. Create account at [twilio.com](https://twilio.com)
2. Get a phone number
3. Add credentials to Edge Function secrets

## Optional: SendGrid (Email Reminders)

1. Create account at [sendgrid.com](https://sendgrid.com)
2. Create an API key
3. Verify a sender email
4. Add credentials to Edge Function secrets

## Testing Locally

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Open http://localhost:5173
```

## Production Checklist

- [ ] Supabase project created
- [ ] Migrations run successfully
- [ ] Edge Functions deployed
- [ ] Cron jobs configured (pg_cron)
- [ ] Dropbox app created and connected
- [ ] Frontend deployed (Vercel/Netlify)
- [ ] Environment variables set
- [ ] Custom domain configured (optional)
- [ ] SSL/HTTPS enabled
- [ ] Load test passed (200+ concurrent)
