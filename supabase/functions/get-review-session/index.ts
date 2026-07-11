import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Missing token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find session by magic link token
    const { data: session, error: sessionError } = await supabase
      .from("guest_sessions")
      .select(`
        id,
        event_id,
        contact_method,
        contact_value,
        selection_completed_at,
        token_expires_at,
        events (
          id,
          name,
          end_time,
          status
        )
      `)
      .eq("magic_link_token", token)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired link" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check token expiry
    if (session.token_expires_at && new Date(session.token_expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "This link has expired" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already completed
    if (session.selection_completed_at) {
      return new Response(
        JSON.stringify({
          session_id: session.id,
          event_name: (session.events as any)?.name || "Event",
          already_completed: true,
          media: [],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get staged media items for this session
    const { data: mediaItems, error: mediaError } = await supabase
      .from("media_items")
      .select("id, media_type, storage_path, captured_at")
      .eq("guest_session_id", session.id)
      .eq("sync_status", "staged")
      .order("captured_at", { ascending: true });

    if (mediaError) {
      console.error("Media fetch error:", mediaError);
      return new Response(
        JSON.stringify({ error: "Failed to load media" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate signed URLs for each media item
    const mediaWithUrls = await Promise.all(
      (mediaItems || []).map(async (item) => {
        if (!item.storage_path) return { ...item, url: null };

        const { data: urlData } = await supabase.storage
          .from("media-staging")
          .createSignedUrl(item.storage_path, 3600); // 1 hour expiry

        return {
          id: item.id,
          media_type: item.media_type,
          captured_at: item.captured_at,
          url: urlData?.signedUrl || null,
        };
      })
    );

    return new Response(
      JSON.stringify({
        session_id: session.id,
        event_name: (session.events as any)?.name || "Event",
        already_completed: false,
        media: mediaWithUrls,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
