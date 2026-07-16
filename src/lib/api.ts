import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const FUNCTIONS_BASE = `${supabaseUrl}/functions/v1`;

async function callFunction(name: string, body: Record<string, unknown>) {
  const response = await fetch(`${FUNCTIONS_BASE}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `Function ${name} failed`);
  }

  return response.json();
}

export async function createSession(
  eventId: string,
  contactMethod: string,
  contactValue: string
) {
  return callFunction('create-session', {
    event_id: eventId,
    contact_method: contactMethod,
    contact_value: contactValue,
  });
}

export async function uploadMedia(
  sessionId: string,
  mediaId: string,
  mediaType: string,
  blob: Blob,
  capturedAt: string
) {
  console.log(`[API] uploadMedia: session=${sessionId}, media=${mediaId}, type=${mediaType}, size=${blob.size}`);

  const formData = new FormData();
  formData.append('session_id', sessionId);
  formData.append('media_id', mediaId);
  formData.append('media_type', mediaType);
  formData.append('file', blob, `file.${mediaType === 'video' ? 'webm' : 'jpg'}`);
  formData.append('captured_at', capturedAt);

  let response: Response;
  try {
    response = await fetch(`${FUNCTIONS_BASE}/upload-media`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: formData,
    });
  } catch (fetchErr) {
    console.error(`[API] uploadMedia fetch failed:`, fetchErr);
    throw new Error(`Network error: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)}`);
  }

  console.log(`[API] uploadMedia response: ${response.status} ${response.statusText}`);

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'unable to read body');
    console.error(`[API] uploadMedia error body:`, errorBody);
    let parsed: { error?: string } = {};
    try { parsed = JSON.parse(errorBody); } catch {}
    throw new Error(parsed.error || `Server error ${response.status}`);
  }

  return response.json();
}

export async function finalizeSession(
  sessionId: string,
  selectedMediaIds: string[],
  mode: 'save_and_share' | 'share_only'
) {
  return callFunction('finalize-session', {
    session_id: sessionId,
    selected_media_ids: selectedMediaIds,
    mode,
  });
}

export async function getReviewSession(token: string) {
  const response = await fetch(
    `${FUNCTIONS_BASE}/get-review-session?token=${token}`,
    {
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to load session' }));
    throw new Error(error.error || 'Failed to load session');
  }

  return response.json();
}

export async function getEventStats(eventId: string) {
  const response = await fetch(
    `${FUNCTIONS_BASE}/get-event-stats?event_id=${eventId}`,
    {
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch stats' }));
    throw new Error(error.error || 'Failed to fetch stats');
  }

  return response.json();
}

export interface RemoteMediaItem {
  id: string;
  media_type: string;
  storage_path: string;
  file_size: number;
  sync_status: string;
  captured_at: string;
  created_at: string;
  signed_url: string | null;
}

export async function fetchSessionMedia(sessionId: string): Promise<RemoteMediaItem[]> {
  const response = await fetch(
    `${FUNCTIONS_BASE}/get-session-media?session_id=${sessionId}`,
    {
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch media' }));
    throw new Error(error.error || 'Failed to fetch media');
  }

  const data = await response.json();
  return data.items || [];
}
