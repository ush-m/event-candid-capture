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

    const formData = await req.formData();
    const session_id = formData.get("session_id") as string;
    const media_id = formData.get("media_id") as string;
    const media_type = formData.get("media_type") as string;
    const file = formData.get("file") as File;
    const captured_at = formData.get("captured_at") as string;

    if (!session_id || !media_id || !media_type || !file || !captured_at) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get event_id from session
    const { data: session, error: sessionError } = await supabase
      .from("guest_sessions")
      .select("event_id")
      .eq("id", session_id)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: "Session not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upload to storage
    const ext = media_type === "video" ? "webm" : "jpg";
    const storagePath = `events/${session.event_id}/guests/${session_id}/${media_id}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("media-staging")
      .upload(storagePath, file, {
        contentType: media_type === "video" ? "video/webm" : "image/jpeg",
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(
        JSON.stringify({ error: "Upload failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert media item record
    const { error: insertError } = await supabase.from("media_items").insert({
      id: media_id,
      guest_session_id: session_id,
      media_type,
      storage_path: storagePath,
      file_size: file.size,
      sync_status: "staged",
      captured_at: captured_at,
    });

    if (insertError) {
      console.error("Insert error:", insertError);
      // Storage file exists but DB insert failed - cleanup
      await supabase.storage.from("media-staging").remove([storagePath]);
      return new Response(
        JSON.stringify({ error: "Failed to record media" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        storage_path: storagePath,
        media_id 
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
