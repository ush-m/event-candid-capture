import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
const TWILIO_FROM_NUMBER = Deno.env.get("TWILIO_FROM_NUMBER") || "";
const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY") || "";
const SENDGRID_FROM_EMAIL = Deno.env.get("SENDGRID_FROM_EMAIL") || "";
const SITE_URL = Deno.env.get("SITE_URL") || "http://localhost:5173";

async function sendSMS(to: string, message: string): Promise<boolean> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.log("Twilio not configured, skipping SMS");
    return false;
  }

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: to,
        From: TWILIO_FROM_NUMBER,
        Body: message,
      }),
    }
  );

  return response.ok;
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.log("SendGrid not configured, skipping email");
    return false;
  }

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SENDGRID_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: SENDGRID_FROM_EMAIL, name: "Event Candid Capture" },
      subject,
      content: [{ type: "text/html", value: html }],
    }),
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

    // Find events that need reminders
    const now = new Date();
    const { data: events, error: eventsError } = await supabase
      .from("events")
      .select("id, name, end_time, reminder_buffer_minutes")
      .eq("status", "active")
      .not("end_time", "is", null);

    if (eventsError || !events?.length) {
      return new Response(
        JSON.stringify({ processed: 0, message: "No events to process" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalSent = 0;

    for (const event of events) {
      const endTime = new Date(event.end_time);
      const reminderTime = new Date(endTime.getTime() + (event.reminder_buffer_minutes || 30) * 60000);

      // Check if it's time to send reminders
      if (now < reminderTime) continue;

      // Find sessions that haven't been reminded and have media
      const { data: sessions } = await supabase
        .from("guest_sessions")
        .select(`
          id,
          contact_method,
          contact_value,
          magic_link_token,
          reminder_sent_at
        `)
        .eq("event_id", event.id)
        .is("reminder_sent_at", null)
        .is("selection_completed_at", null);

      if (!sessions?.length) continue;

      for (const session of sessions) {
        // Check if session has any staged media
        const { count } = await supabase
          .from("media_items")
          .select("*", { count: "exact", head: true })
          .eq("guest_session_id", session.id)
          .eq("sync_status", "staged");

        if (!count || count === 0) continue;

        const reviewUrl = `${SITE_URL}/review/${session.magic_link_token}`;
        const message = `Your photos from ${event.name} are ready to review! Tap to select which ones to share: ${reviewUrl}`;
        const emailHtml = `
          <h2>Your photos from ${event.name} are ready!</h2>
          <p>You captured ${count} photo${count > 1 ? "s" : ""} at ${event.name}.</p>
          <p>Review and select which ones to share with the event organizer:</p>
          <a href="${reviewUrl}" style="display:inline-block;padding:12px 24px;background:#000;color:#fff;text-decoration:none;border-radius:8px;margin:16px 0;">Review My Photos</a>
          <p style="color:#666;font-size:12px;margin-top:24px;">This link expires in 14 days. Unselected photos will be deleted after 7 days.</p>
        `;

        let sent = false;
        if (session.contact_method === "phone") {
          sent = await sendSMS(session.contact_value, message);
        } else {
          sent = await sendEmail(session.contact_value, `Your photos from ${event.name}`, emailHtml);
        }

        if (sent) {
          await supabase
            .from("guest_sessions")
            .update({ reminder_sent_at: now.toISOString() })
            .eq("id", session.id);
          totalSent++;
        }
      }

      // Mark event as ended if reminders are sent
      await supabase
        .from("events")
        .update({ status: "ended" })
        .eq("id", event.id);
    }

    return new Response(
      JSON.stringify({ processed: totalSent }),
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
