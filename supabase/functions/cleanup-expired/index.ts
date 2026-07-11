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

    const now = new Date();
    let deletedMedia = 0;
    let deletedSessions = 0;
    let purgedStorage = 0;

    // Step 1: Find events past their retention period
    const { data: expiredEvents } = await supabase
      .from("events")
      .select("id, retention_days, name");

    if (!expiredEvents?.length) {
      return new Response(
        JSON.stringify({ message: "No events to clean up", deletedMedia, deletedSessions, purgedStorage }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    for (const event of expiredEvents) {
      const retentionMs = (event.retention_days || 7) * 24 * 60 * 60 * 1000;
      const cutoffDate = new Date(now.getTime() - retentionMs);

      // Step 2: Find expired media items (rejected/undecided and past retention)
      const { data: expiredMedia } = await supabase
        .from("media_items")
        .select("id, storage_path, guest_session_id")
        .in("selection_status", ["rejected", "undecided"])
        .lt("created_at", cutoffDate.toISOString());

      if (expiredMedia?.length) {
        // Delete from storage first
        const storagePaths = expiredMedia
          .filter((m) => m.storage_path)
          .map((m) => m.storage_path!);

        if (storagePaths.length) {
          const { error: storageError } = await supabase.storage
            .from("media-staging")
            .remove(storagePaths);

          if (storageError) {
            console.error("Storage deletion error:", storageError);
          } else {
            purgedStorage += storagePaths.length;
          }
        }

        // Delete media_items records
        const mediaIds = expiredMedia.map((m) => m.id);
        const { error: deleteError } = await supabase
          .from("media_items")
          .delete()
          .in("id", mediaIds);

        if (!deleteError) {
          deletedMedia += mediaIds.length;
        }
      }

      // Step 3: Find expired sessions (token expired and no selection completed)
      const { data: expiredSessions } = await supabase
        .from("guest_sessions")
        .select("id")
        .eq("event_id", event.id)
        .is("selection_completed_at", null)
        .lt("token_expires_at", cutoffDate.toISOString());

      if (expiredSessions?.length) {
        // Delete remaining media for these sessions first
        for (const session of expiredSessions) {
          const { data: sessionMedia } = await supabase
            .from("media_items")
            .select("storage_path")
            .eq("guest_session_id", session.id);

          if (sessionMedia?.length) {
            const paths = sessionMedia
              .filter((m) => m.storage_path)
              .map((m) => m.storage_path!);

            if (paths.length) {
              await supabase.storage.from("media-staging").remove(paths);
              purgedStorage += paths.length;
            }
          }
        }

        // Delete session records (cascades to media_items)
        const sessionIds = expiredSessions.map((s) => s.id);
        const { error: sessionDeleteError } = await supabase
          .from("guest_sessions")
          .delete()
          .in("id", sessionIds);

        if (!sessionDeleteError) {
          deletedSessions += sessionIds.length;
        }
      }

      // Step 4: Anonymize contact info for completed sessions past retention
      const { data: oldCompletedSessions } = await supabase
        .from("guest_sessions")
        .select("id")
        .eq("event_id", event.id)
        .not("selection_completed_at", "is", null)
        .lt("selection_completed_at", cutoffDate.toISOString());

      if (oldCompletedSessions?.length) {
        const completedIds = oldCompletedSessions.map((s) => s.id);
        await supabase
          .from("guest_sessions")
          .update({
            contact_value: "[anonymized]",
            magic_link_token: null,
          })
          .in("id", completedIds);
      }
    }

    // Step 5: Archive events that are fully cleaned up
    const { data: emptyEvents } = await supabase
      .from("events")
      .select("id")
      .eq("status", "ended");

  if (emptyEvents?.length) {
    for (const event of emptyEvents) {
      const { count } = await supabase
        .from("media_items")
        .select("*", { count: "exact", head: true })
        .eq("guest_sessions.event_id", event.id);

      if (count === 0) {
        await supabase
          .from("events")
          .update({ status: "archived" })
          .eq("id", event.id);
      }
    }
  }

    return new Response(
      JSON.stringify({
        success: true,
        deletedMedia,
        deletedSessions,
        purgedStorage,
        timestamp: now.toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Cleanup error:", error);
    return new Response(
      JSON.stringify({ error: "Cleanup failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
