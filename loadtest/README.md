# Load Testing for Event Candid Capture

## Prerequisites
Install k6: https://k6.io/docs/get-started/installation/

## Setup

1. Create a test event and get the event ID:
```sql
INSERT INTO events (id, planner_id, name, start_time, end_time)
VALUES ('test-event-id', (SELECT id FROM planners LIMIT 1), 'Load Test Event', NOW(), NOW() + INTERVAL '1 hour')
RETURNING id;
```

2. Get your Supabase URL and anon key from the dashboard.

## Running the Test

```bash
export BASE_URL="https://your-project.supabase.co"
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_ANON_KEY="your-anon-key"
export EVENT_ID="test-event-id"

k6 run loadtest/capture_load_test.js
```

## Test Scenarios

### capture_load_test.js
- Ramps from 0 to 200 concurrent VUs over 3.5 minutes
- Each VU creates a session and captures 1-5 photos
- **Thresholds**: p95 latency < 500ms, failure rate < 5%

## Monitoring

During the test, monitor in Supabase Dashboard:
- Database connections (should stay under 60)
- Edge Function invocations
- Storage upload rate
- Auth rate limits

## Expected Results

| Metric | Target |
|---|---|
| Concurrent sessions | 200+ |
| Session creation p95 | < 300ms |
| Upload p95 | < 500ms |
| Error rate | < 5% |
| No data loss | All captures persisted |
