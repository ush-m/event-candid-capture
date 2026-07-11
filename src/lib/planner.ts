import { supabase } from './supabase';

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Auth helpers
export async function signUp(email: string, password: string) {
  const response = await fetch(`${FUNCTIONS_BASE}/planner-signup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Signup failed' }));
    throw new Error(error.error || 'Signup failed');
  }

  return response.json();
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// Dropbox OAuth
export function getDropboxAuthUrl(plannerId: string) {
  const appId = import.meta.env.VITE_DROPBOX_APP_KEY || '';
  const redirectUri = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dropbox-oauth`;
  
  return `https://www.dropbox.com/oauth2/authorize?client_id=${appId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&state=${plannerId}&token_access_type=offline`;
}

export async function isDropboxConnected(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;

  const { data } = await supabase
    .from('planners')
    .select('dropbox_access_token')
    .eq('id', user.id)
    .single();

  return !!data?.dropbox_access_token;
}

// Events
export async function createEvent(eventData: {
  name: string;
  start_time: string;
  end_time?: string;
  reminder_buffer_minutes?: number;
  retention_days?: number;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('events')
    .insert({
      planner_id: user.id,
      ...eventData,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getEvents() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('planner_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getEvent(eventId: string) {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single();

  if (error) throw error;
  return data;
}

export async function updateEvent(eventId: string, updates: {
  name?: string;
  end_time?: string;
  status?: string;
}) {
  const { data, error } = await supabase
    .from('events')
    .update(updates)
    .eq('id', eventId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Event stats
export async function getEventStats(eventId: string) {
  const response = await fetch(
    `${FUNCTIONS_BASE}/get-event-stats?event_id=${eventId}`,
    {
      headers: {
        'Authorization': `Bearer ${ANON_KEY}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch stats' }));
    throw new Error(error.error || 'Failed to fetch stats');
  }

  return response.json();
}

// End event
export async function endEvent(eventId: string) {
  return updateEvent(eventId, {
    end_time: new Date().toISOString(),
    status: 'ended',
  });
}

// Event guests
export async function getEventGuests(eventId: string) {
  const response = await fetch(
    `${FUNCTIONS_BASE}/get-event-guests?event_id=${eventId}`,
    {
      headers: {
        'Authorization': `Bearer ${ANON_KEY}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch guests' }));
    throw new Error(error.error || 'Failed to fetch guests');
  }

  return response.json();
}

// Event stats for dashboard preview
export async function getEventsWithStats() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const { data: events, error } = await supabase
    .from('events')
    .select('*')
    .eq('planner_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const eventsWithStats = await Promise.all(
    (events || []).map(async (event) => {
      const { count: sessionCount } = await supabase
        .from('guest_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', event.id);

      const { count: mediaCount } = await supabase
        .from('media_items')
        .select('*', { count: 'exact', head: true })
        .eq('guest_sessions.event_id', event.id)
        .eq('sync_status', 'staged');

      const { count: sharedCount } = await supabase
        .from('media_items')
        .select('*', { count: 'exact', head: true })
        .eq('guest_sessions.event_id', event.id)
        .eq('selection_status', 'selected');

      return {
        ...event,
        session_count: sessionCount || 0,
        media_count: mediaCount || 0,
        shared_count: sharedCount || 0,
      };
    })
  );

  return eventsWithStats;
}
