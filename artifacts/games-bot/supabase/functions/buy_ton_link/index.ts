import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MOONPAY_SECRET = Deno.env.get("MOONPAY_SECRET_KEY") ?? "";

async function signMoonpayUrl(url: string): Promise<string> {
  if (!MOONPAY_SECRET) return url;
  const u = new URL(url);
  const query = u.search;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(MOONPAY_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(query));
  const b64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
  u.searchParams.set("signature", b64);
  return u.toString();
}

const MIN_TON = 0.1;
const MAX_TON = 5_000;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.headers.get("X-Warmup") === "1") {
    return new Response(JSON.stringify({ ok: true, warm: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const sessionId: string = body.session_id ?? "";
    const amountTon: number = Number(body.amount_ton ?? 0);

    if (!sessionId || !Number.isFinite(amountTon) || amountTon < MIN_TON || amountTon > MAX_TON) {
      return new Response(JSON.stringify({ ok: false, error: "invalid_params" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: tgId, error: sessErr } = await supabase.rpc("pay_resolve_session", {
      p_session_id: sessionId,
    });
    if (sessErr || !tgId) {
      return new Response(JSON.stringify({ ok: false, error: "unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: intent, error: rpcErr } = await supabase.rpc("pay_buy_with_ton", {
      p_session_id: sessionId,
      p_amount_ton: amountTon,
      p_source: "moonpay",
    });
    if (rpcErr) {
      return new Response(JSON.stringify({ ok: false, error: "rpc_failed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: baseRow } = await supabase
      .from("economy_settings").select("value").eq("key", "moonpay_base_url").maybeSingle();
    const { data: keyRow } = await supabase
      .from("economy_settings").select("value").eq("key", "moonpay_api_key").maybeSingle();
    const { data: ccyRow } = await supabase
      .from("economy_settings").select("value").eq("key", "moonpay_currency").maybeSingle();

    const baseUrl = (baseRow?.value as string) || "https://buy.moonpay.com";
    const apiKey = (keyRow?.value as string) || "";
    const currency = (ccyRow?.value as string) || "ton";

    if (!apiKey) {
      return new Response(JSON.stringify({
        ok: false,
        error: "moonpay_not_configured",
        intent_id: intent.intent_id,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const params = new URLSearchParams({
      apiKey,
      currencyCode: currency,
      walletAddress: intent.expected_address,
      walletAddressTag: intent.memo,
      quoteCurrencyAmount: String(amountTon),
      externalTransactionId: intent.intent_id,
      redirectURL: `https://t.me/`,
    });

    const url = `${baseUrl}?${params.toString()}`;
    const signed = await signMoonpayUrl(url);

    return new Response(JSON.stringify({
      ok: true,
      intent_id: intent.intent_id,
      amount_ton: amountTon,
      expected_sc: intent.expected_sc,
      url: signed,
      address: intent.expected_address,
      memo: intent.memo,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (_e) {
    return new Response(JSON.stringify({ ok: false, error: "internal_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
