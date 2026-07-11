# Phase 6: Retention, Hardening & Testing

## Retention Cleanup

### Automated Cleanup (Supabase pg_cron)
Run the migration `002_cron_jobs.sql` to set up:
- **Daily cleanup** (2 AM UTC): Purges expired media, sessions, and anonymizes old contact info
- **Reminder check** (every 5 min): Sends initial reminders to guests
- **Follow-up check** (every 15 min): Sends 24h follow-up reminders

### Manual Cleanup
```bash
curl -X POST \
  https://your-project.supabase.co/functions/v1/cleanup-expired \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

### What Gets Cleaned Up
| Item | Retention Period | Action |
|---|---|---|
| Rejected/undecided media | Event retention_days (default 7) | Deleted from storage + DB |
| Expired sessions | Token expiry (default 14 days) | Session + all media deleted |
| Completed sessions | Past retention period | Contact info anonymized |
| Ended events | All sessions cleaned | Status set to "archived" |

## Edge-Case Hardening

### Offline Handling
- `OfflineBanner` component shows connection status
- All captures persist to IndexedDB regardless of connectivity
- Background sync retries with exponential backoff
- QuotaExceededError prompts user to free space

### Error Recovery
- All Edge Functions return structured error responses
- Storage upload failures trigger cleanup of orphaned DB records
- Dropbox token refresh failures queue items for retry
- Session creation handles duplicate contact detection

### Security
- Row Level Security on all tables
- Public endpoints rate-limited by design (session-based)
- Dropbox tokens encrypted at rest
- Contact info anonymized after retention period

## Load Testing

### Prerequisites
```bash
# Install k6
brew install k6
```

### Running Tests
```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_ANON_KEY="your-anon-key"
export EVENT_ID="your-test-event-id"

k6 run loadtest/capture_load_test.js
```

### Expected Results
| Metric | Target |
|---|---|
| Concurrent sessions | 200+ |
| Session creation p95 | < 300ms |
| Upload p95 | < 500ms |
| Error rate | < 5% |
| No data loss | All captures persisted |

### Monitoring During Tests
1. Supabase Dashboard → Database → Connection pool
2. Edge Functions → Logs
3. Storage → Upload rate
4. pg_stat_activity for active queries

## Environment Variables Reference

### Frontend (.env)
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_DROPBOX_APP_KEY=your-dropbox-app-key
```

### Edge Functions (Supabase Secrets)
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DROPBOX_APP_KEY=your-dropbox-app-key
DROPBOX_APP_SECRET=your-dropbox-app-secret
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_FROM_NUMBER=+1xxx
SENDGRID_API_KEY=your-sendgrid-key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
SITE_URL=https://your-domain.com
```

## Production Checklist

- [ ] Supabase project created and migration run
- [ ] Edge Functions deployed
- [ ] Cron jobs configured
- [ ] Dropbox app created and credentials added
- [ ] Twilio/SendGrid configured (optional for reminders)
- [ ] Custom domain configured (optional)
- [ ] Load test passed at 200+ concurrent users
- [ ] PWA icons generated and added
- [ ] SSL/HTTPS enabled
