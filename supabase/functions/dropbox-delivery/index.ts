import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DROPBOX_APP_KEY = Deno.env.get("DROPBOX_APP_KEY") || "";
const DROPBOX_APP_SECRET = Deno.env.get("DROPBOX_APP_SECRET") || "";

async function refreshDropboxToken(
  refreshToken: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number } | null> {
  const response = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      client_id: DROPBOX_APP_KEY,
      client_secret: DROPBOX_APP_SECRET,
    }),
  });

  if (!response.ok) {
    console.error("Token refresh failed:", await response.text());
    return null;
  }

  return response.json();
}

async function uploadToDropbox(
  accessToken: string,
  filePath: string,
  fileContent: Uint8Array
): Promise<boolean> {
  const response = await fetch(
    "https://content.dropboxapi.com/2/files/upload",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/octet-stream",
        "Dropbox-API-Arg": JSON.stringify({
          path: filePath,
          mode: "add",
          autorename: true,
          mute: false,
        }),
      },
      body: fileContent,
    }
  );

  return response.ok;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { session_id } = await req.json();

    if (!session_id) {
      return new Response(
        JSON.stringify({ error: "Missing session_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get session with event and planner info
    const { data: session, error: sessionError } = await supabase
      .from("guest_sessions")
      .select(`
        id,
        contact_value,
        events (
          id,
          name,
          planner_id,
          planners (
            id,
            dropbox_access_token,
            dropbox_refresh_token,
            dropbox_token_expires_at
          )
        )
      `)
      .eq("id", session_id)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: "Session not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const event = session.events as any;
    const planner = event.planners as any;

    if (!planner?.dropbox_access_token) {
      return new Response(
        JSON.stringify({ error: "Planner has not connected Dropbox" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if token needs refresh
    let accessToken = planner.dropbox_access_token;
    const expiresAt = new Date(planner.dropbox_token_expires_at);
    
    if (expiresAt <= new Date()) {
      const refreshed = await refreshDropboxToken(planner.dropbox_refresh_token);
      if (!refreshed) {
        return new Response(
          JSON.stringify({ error: "Failed to refresh Dropbox token" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      accessToken = refreshed.access_token;
      
      await supabase
        .from("planners")
        .update({
          dropbox_access_token: refreshed.access_token,
          dropbox_refresh_token: refreshed.refresh_token,
          dropbox_token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        })
        .eq("id", planner.id);
    }

    // Get selected media items
    const { data: mediaItems, error: mediaError } = await supabase
      .from("media_items")
      .select("id, storage_path, media_type")
      .eq("guest_session_id", session_id)
      .eq("selection_status", "selected")
      .eq("delivery_status", "pending");

    if (mediaError || !mediaItems?.length) {
      return new Response(
        JSON.stringify({ error: "No pending media items" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const guestIdentifier = session.contact_value.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 50);
    const eventName = event.name.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 50);
    let deliveredCount = 0;
    let failedCount = 0;

    for (const item of mediaItems) {
      if (!item.storage_path) continue;

      // Download from Supabase Storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("media-staging")
        .download(item.storage_path);

      if (downloadError || !fileData) {
        console.error(`Failed to download ${item.storage_path}:`, downloadError);
        failedCount++;
        continue;
      }

      const fileBuffer = await fileData.arrayBuffer();
      const ext = item.media_type === "video" ? "webm" : "jpg";
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const dropboxPath = `/${eventName}/${guestIdentifier}/${timestamp}_${item.id}.${ext}`;

      const success = await uploadToDropbox(accessToken, dropboxPath, new Uint8Array(fileBuffer));

      if (success) {
        await supabase
          .from("media_items")
          .update({ delivery_status: "delivered" })
          .eq("id", item.id);
        deliveredCount++;
      } else {
        await supabase
          .from("media_items")
          .update({ delivery_status: "failed" })
          .eq("id", item.id);
        failedCount++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        delivered: deliveredCount,
        failed: failedCount,
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
