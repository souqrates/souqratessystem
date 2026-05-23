import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

if (!BOT_TOKEN) {
  console.error("[stars_invoice] TELEGRAM_BOT_TOKEN is not configured");
}

async function tg(method: string, body: Record<string, unknown>) {
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return await r.json().catch(() => ({}));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.headers.get("X-Warmup") === "1") {
    return new Response(JSON.stringify({ ok: true, warm: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    if (!BOT_TOKEN) {
      return new Response(JSON.stringify({ ok: false, error: "bot_not_configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const sessionId: string = body.session_id ?? "";
    const amountStars: number = Number(body.amount_stars ?? 0);

    const MAX_STARS = 100000;
    if (!sessionId || !Number.isFinite(amountStars) || !Number.isInteger(amountStars) || amountStars <= 0 || amountStars > MAX_STARS) {
      return new Response(JSON.stringify({ ok: false, error: "invalid_params" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Validate session belongs to a real user
    const { data: tgId, error: sessErr } = await supabase.rpc("pay_resolve_session", {
      p_session_id: sessionId,
    });
    if (sessErr || !tgId) {
      return new Response(JSON.stringify({ ok: false, error: "unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: invoiceRow, error: invErr } = await supabase.rpc("pay_buy_with_stars_idempotent", {
      p_session_id: sessionId,
      p_amount_stars: amountStars,
    });
    if (invErr) {
      return new Response(JSON.stringify({ ok: false, error: "invoice_init_failed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const payload: string = invoiceRow.payload;
    const expectedSc: number = invoiceRow.expected_sc;

    const linkRes = await tg("createInvoiceLink", {
      title: invoiceRow.title || "Skill Coins",
      description: invoiceRow.description || `${amountStars} Stars -> ${expectedSc} SC`,
      payload,
      provider_token: "",
      currency: "XTR",
      prices: [{ label: `${expectedSc} SC`, amount: amountStars }],
    });

    if (!linkRes?.ok) {
      return new Response(JSON.stringify({ ok: false, error: "invoice_link_failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      ok: true,
      invoice_id: invoiceRow.invoice_id,
      invoice_link: linkRes.result,
      payload,
      amount_stars: amountStars,
      expected_sc: expectedSc,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (_e) {
    console.error("[stars_invoice] Error:", _e);
    return new Response(JSON.stringify({ ok: false, error: "internal_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
