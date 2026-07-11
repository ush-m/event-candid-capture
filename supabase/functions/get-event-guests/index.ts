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

    // Get all guest sessions for this event with media counts
    const { data: sessions, error: sessionsError } = await supabase
      .from("guest_sessions")
      .select(`
        id,
        contact_method,
        contact_value,
        created_at,
        reminder_sent_at,
        followup_sent_at,
        selection_completed_at
      `)
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });

    if (sessionsError) {
      console.error("Sessions fetch error:", sessionsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch guests" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get media counts and delivery status for each session
    const guests = await Promise.all(
      (sessions || []).map(async (session) => {
        const { count: totalMedia } = await supabase
          .from("media_items")
          .select("*", { count: "exact", head: true })
          .eq("guest_session_id", session.id)
          .eq("sync_status", "staged");

        const { count: sharedMedia } = await supabase
          .from("media_items")
          .select("*", { count: "exact", head: true })
          .eq("guest_session_id", session.id)
          .eq("selection_status", "selected");

        const { count: deliveredMedia } = await supabase
          .from("media_items")
          .select("*", { count: "exact", head: true })
          .eq("guest_session_id", session.id)
          .eq("delivery_status", "delivered");

        const { count: failedMedia } = await supabase
          .from("media_items")
          .select("*", { count: "exact", head: true })
          .eq("guest_session_id", session.id)
          .eq("delivery_status", "failed");

        return {
          id: session.id,
          contact_method: session.contact_method,
          contact_value: session.contact_value,
          created_at: session.created_at,
          reminder_sent_at: session.reminder_sent_at,
          selection_completed_at: session.selection_completed_at,
          total_media: totalMedia || 0,
          shared_media: sharedMedia || 0,
          delivered_media: deliveredMedia || 0,
          failed_media: failedMedia || 0,
          status: session.selection_completed_at
            ? "completed"
            : session.reminder_sent_at
            ? "reminded"
            : "pending",
        };
      })
    );

    return new Response(
      JSON.stringify({ guests }),
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
