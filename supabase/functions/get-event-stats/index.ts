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
    const eventId = url.searchParams.get("event_id");

    if (!eventId) {
      return new Response(
        JSON.stringify({ error: "Missing event_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get event details
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      return new Response(
        JSON.stringify({ error: "Event not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get session stats
    const { count: totalSessions } = await supabase
      .from("guest_sessions")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId);

    const { count: completedSessions } = await supabase
      .from("guest_sessions")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId)
      .not("selection_completed_at", "is", null);

    // Get media stats
    const { count: totalMedia } = await supabase
      .from("media_items")
      .select("*", { count: "exact", head: true })
      .eq("guest_sessions.event_id", eventId);

    const { count: stagedMedia } = await supabase
      .from("media_items")
      .select("*", { count: "exact", head: true })
      .eq("guest_sessions.event_id", eventId)
      .eq("sync_status", "staged");

    const { count: sharedMedia } = await supabase
      .from("media_items")
      .select("*", { count: "exact", head: true })
      .eq("guest_sessions.event_id", eventId)
      .eq("selection_status", "selected");

    return new Response(
      JSON.stringify({
        event: {
          id: event.id,
          name: event.name,
          start_time: event.start_time,
          end_time: event.end_time,
          status: event.status,
        },
        stats: {
          total_sessions: totalSessions || 0,
          completed_sessions: completedSessions || 0,
          response_rate: totalSessions ? Math.round(((completedSessions || 0) / totalSessions) * 100) : 0,
          total_media: totalMedia || 0,
          staged_media: stagedMedia || 0,
          shared_media: sharedMedia || 0,
        },
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
