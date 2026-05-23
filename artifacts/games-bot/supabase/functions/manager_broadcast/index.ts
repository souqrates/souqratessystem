import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const BOT_TOKEN    = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const API_BASE     = `https://api.telegram.org/bot${BOT_TOKEN}`;

const supa = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

interface SendArgs {
  admin_id: number;
  passcode: string;
  broadcast_id: string;
}

async function tg(method: string, body: Record<string, unknown>) {
  const r = await fetch(`${API_BASE}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return await r.json().catch(() => ({ ok: false }));
}

function buildReplyMarkup(text: string, url: string) {
  if (!text || !url) return undefined;
  return { inline_keyboard: [[{ text, url }]] };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    if (!BOT_TOKEN) {
      return new Response(JSON.stringify({ ok: false, error: "TELEGRAM_BOT_TOKEN not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const payload = (await req.json().catch(() => ({}))) as Partial<SendArgs>;
    const admin_id = Number(payload.admin_id);
    const passcode = String(payload.passcode || "");
    const broadcast_id = String(payload.broadcast_id || "");

    if (!admin_id || !passcode || !broadcast_id) {
      return new Response(JSON.stringify({ ok: false, error: "missing_fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Verify admin via the passcode RPC. If this fails, abort.
    const auth = await supa.rpc("manager_web_login", { p_telegram_id: admin_id, p_passcode: passcode });
    const ok = Array.isArray(auth.data) && auth.data.length > 0;
    if (auth.error || !ok) {
      return new Response(JSON.stringify({ ok: false, error: "unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Load broadcast
    const { data: bRows, error: bErr } = await supa
      .from("telegram_broadcasts")
      .select("id,message,parse_mode,inline_button_text,inline_button_url,status")
      .eq("id", broadcast_id)
      .limit(1);
    if (bErr || !bRows || bRows.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: "broadcast_not_found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const broadcast = bRows[0];
    if (broadcast.status === "done" || broadcast.status === "sending") {
      return new Response(JSON.stringify({ ok: true, already: true, status: broadcast.status }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Atomic transition: only one worker can move pending → sending
    const { data: claim } = await supa
      .from("telegram_broadcasts")
      .update({ status: "sending" })
      .eq("id", broadcast_id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (!claim) {
      return new Response(JSON.stringify({ ok: true, already: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const reply_markup = buildReplyMarkup(broadcast.inline_button_text, broadcast.inline_button_url);

    // Recipients
    const { data: recipients, error: rErr } = await supa.rpc("manager_get_broadcast_recipients",
      { p_admin_id: admin_id, p_id: broadcast_id });
    if (rErr) {
      await supa.rpc("manager_update_broadcast_status", {
        p_admin_id: admin_id, p_id: broadcast_id, p_status: "failed",
        p_sent: 0, p_failed: 0, p_error: rErr.message,
      });
      return new Response(JSON.stringify({ ok: false, error: rErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let sent = 0;
    let failed = 0;
    let lastErr = "";

    for (const row of (recipients || [])) {
      const chat_id = Number((row as { telegram_id: number }).telegram_id);
      if (!chat_id) { failed++; continue; }
      const body: Record<string, unknown> = {
        chat_id,
        text: broadcast.message,
        parse_mode: broadcast.parse_mode || "HTML",
        disable_web_page_preview: false,
      };
      if (reply_markup) body.reply_markup = reply_markup;
      const r = await tg("sendMessage", body);
      if ((r as { ok?: boolean }).ok) sent++;
      else {
        failed++;
        lastErr = (r as { description?: string }).description || "send_failed";
      }
      // 30/sec global throughput cap on the bot API
      await new Promise((res) => setTimeout(res, 35));
    }

    await supa.rpc("manager_update_broadcast_status", {
      p_admin_id: admin_id, p_id: broadcast_id, p_status: "done",
      p_sent: sent, p_failed: failed, p_error: failed ? lastErr : "",
    });

    return new Response(JSON.stringify({ ok: true, sent, failed }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
