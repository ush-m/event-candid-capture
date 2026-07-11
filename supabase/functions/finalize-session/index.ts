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
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      client_id: DROPBOX_APP_KEY,
      client_secret: DROPBOX_APP_SECRET,
    }),
  });
  if (!response.ok) return null;
  return response.json();
}

async function uploadToDropbox(
  accessToken: string,
  filePath: string,
  fileContent: Uint8Array
): Promise<boolean> {
  const response = await fetch("https://content.dropboxapi.com/2/files/upload", {
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
  });
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

    const { session_id, selected_media_ids, mode } = await req.json();

    if (!session_id || !selected_media_ids || !mode) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["save_and_share", "share_only"].includes(mode)) {
      return new Response(
        JSON.stringify({ error: "Invalid mode" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all media items for this session
    const { data: allMedia, error: mediaError } = await supabase
      .from("media_items")
      .select("id")
      .eq("guest_session_id", session_id);

    if (mediaError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch media" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark selected items
    if (selected_media_ids.length > 0) {
      const { error: selectError } = await supabase
        .from("media_items")
        .update({
          selection_status: "selected",
          delivery_status: "pending",
        })
        .in("id", selected_media_ids)
        .eq("guest_session_id", session_id);

      if (selectError) console.error("Select update error:", selectError);
    }

    // Mark unselected items as rejected
    const unselectedIds =
      allMedia?.filter((m) => !selected_media_ids.includes(m.id)).map((m) => m.id) || [];

    if (unselectedIds.length > 0) {
      const { error: rejectError } = await supabase
        .from("media_items")
        .update({ selection_status: "rejected" })
        .in("id", unselectedIds)
        .eq("guest_session_id", session_id);

      if (rejectError) console.error("Reject update error:", rejectError);
    }

    // Update session
    await supabase
      .from("guest_sessions")
      .update({ selection_completed_at: new Date().toISOString() })
      .eq("id", session_id);

    // Get planner + event info for Dropbox delivery
    const { data: session } = await supabase
      .from("guest_sessions")
      .select(`
        id,
        contact_value,
        events (
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

    let deliveredCount = 0;
    let failedCount = 0;

    if (session) {
      const event = session.events as any;
      const planner = event?.planners as any;

      if (planner?.dropbox_access_token && selected_media_ids.length > 0) {
        let accessToken = planner.dropbox_access_token;

        // Refresh token if expired
        if (new Date(planner.dropbox_token_expires_at) <= new Date()) {
          const refreshed = await refreshDropboxToken(planner.dropbox_refresh_token);
          if (refreshed) {
            accessToken = refreshed.access_token;
            await supabase
              .from("planners")
              .update({
                dropbox_access_token: refreshed.access_token,
                dropbox_refresh_token: refreshed.refresh_token,
                dropbox_token_expires_at: new Date(
                  Date.now() + refreshed.expires_in * 1000
                ).toISOString(),
              })
              .eq("id", planner.id);
          }
        }

        // Get selected media with storage paths
        const { data: selectedMedia } = await supabase
          .from("media_items")
          .select("id, storage_path, media_type")
          .in("id", selected_media_ids)
          .eq("guest_session_id", session_id);

        const guestIdentifier = session.contact_value
          .replace(/[^a-zA-Z0-9]/g, "_")
          .substring(0, 50);
        const eventName = event.name.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 50);

        for (const item of selectedMedia || []) {
          if (!item.storage_path) continue;

          const { data: fileData, error: downloadError } = await supabase.storage
            .from("media-staging")
            .download(item.storage_path);

          if (downloadError || !fileData) {
            failedCount++;
            continue;
          }

          const fileBuffer = await fileData.arrayBuffer();
          const ext = item.media_type === "video" ? "webm" : "jpg";
          const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
          const dropboxPath = `/${eventName}/${guestIdentifier}/${timestamp}_${item.id}.${ext}`;

          const success = await uploadToDropbox(
            accessToken,
            dropboxPath,
            new Uint8Array(fileBuffer)
          );

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
      }
    }

    const { data: selectedMedia } = await supabase
      .from("media_items")
      .select("storage_path, media_type")
      .eq("guest_session_id", session_id)
      .eq("selection_status", "selected");

    return new Response(
      JSON.stringify({
        success: true,
        selected_count: selectedMedia?.length || 0,
        delivered: deliveredCount,
        failed: failedCount,
        mode,
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
