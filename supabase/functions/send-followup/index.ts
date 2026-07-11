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
  if (!TWILIO_ACCOUNT_SID) return false;
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: TWILIO_FROM_NUMBER, Body: message }),
    }
  );
  return response.ok;
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!SENDGRID_API_KEY) return false;
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

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Find sessions that were reminded 24h+ ago but haven't responded
    const { data: sessions, error } = await supabase
      .from("guest_sessions")
      .select(`
        id,
        contact_method,
        contact_value,
        magic_link_token,
        reminder_sent_at,
        followup_sent_at,
        events (
          name
        )
      `)
      .not("reminder_sent_at", "is", null)
      .is("selection_completed_at", null)
      .is("followup_sent_at", null)
      .lte("reminder_sent_at", twentyFourHoursAgo.toISOString());

    if (error || !sessions?.length) {
      return new Response(
        JSON.stringify({ processed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalSent = 0;

    for (const session of sessions) {
      const event = session.events as any;
      const reviewUrl = `${SITE_URL}/review/${session.magic_link_token}`;
      const message = `Final reminder: Your photos from ${event.name} are waiting! Select which to share before they're deleted: ${reviewUrl}`;
      const emailHtml = `
        <h2>Last chance to share your photos!</h2>
        <p>You still have photos from ${event.name} waiting for review.</p>
        <p>Select which ones to share before they're deleted:</p>
        <a href="${reviewUrl}" style="display:inline-block;padding:12px 24px;background:#000;color:#fff;text-decoration:none;border-radius:8px;margin:16px 0;">Review My Photos</a>
        <p style="color:#666;font-size:12px;">Unselected photos will be permanently deleted soon.</p>
      `;

      let sent = false;
      if (session.contact_method === "phone") {
        sent = await sendSMS(session.contact_value, message);
      } else {
        sent = await sendEmail(session.contact_value, `Final reminder: Your photos from ${event.name}`, emailHtml);
      }

      if (sent) {
        await supabase
          .from("guest_sessions")
          .update({ followup_sent_at: now.toISOString() })
          .eq("id", session.id);
        totalSent++;
      }
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
