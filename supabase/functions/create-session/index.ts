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

    const { event_id, contact_method, contact_value } = await req.json();

    if (!event_id || !contact_method || !contact_value) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if event exists and is active
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, name, status")
      .eq("id", event_id)
      .single();

    if (eventError || !event) {
      return new Response(
        JSON.stringify({ error: "Event not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for existing session with same contact
    const { data: existingSession } = await supabase
      .from("guest_sessions")
      .select("id, magic_link_token, token_expires_at")
      .eq("event_id", event_id)
      .eq("contact_value", contact_value)
      .single();

    if (existingSession) {
      // Check if token is still valid
      if (existingSession.token_expires_at && new Date(existingSession.token_expires_at) > new Date()) {
        return new Response(
          JSON.stringify({
            session_id: existingSession.id,
            magic_link_token: existingSession.magic_link_token,
            event_name: event.name,
            is_existing: true,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Create new session
    const tokenExpiresAt = new Date();
    tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 14); // 14 days

    const { data: newSession, error: sessionError } = await supabase
      .from("guest_sessions")
      .insert({
        event_id,
        contact_method,
        contact_value,
        token_expires_at: tokenExpiresAt.toISOString(),
      })
      .select("id, magic_link_token")
      .single();

    if (sessionError) {
      console.error("Session creation error:", sessionError);
      return new Response(
        JSON.stringify({ error: "Failed to create session" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        session_id: newSession.id,
        magic_link_token: newSession.magic_link_token,
        event_name: event.name,
        is_existing: false,
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
