import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function uploadMedia(
  eventId: string,
  guestSessionId: string,
  mediaId: string,
  blob: Blob,
  mediaType: string
): Promise<string> {
  const ext = mediaType === 'video' ? 'webm' : 'jpg';
  const path = `events/${eventId}/guests/${guestSessionId}/${mediaId}.${ext}`;
  
  const { error } = await supabase.storage
    .from('media-staging')
    .upload(path, blob, {
      contentType: mediaType === 'video' ? 'video/webm' : 'image/jpeg',
      upsert: false,
    });

  if (error) throw error;
  return path;
}
