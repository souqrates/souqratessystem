import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MAX_AGE_SECONDS = 86400 * 30; // 30 days — matches session TTL

async function hmacSha256(key: ArrayBuffer | Uint8Array, msg: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(msg));
}

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyTelegramInitData(initData: string): Promise<{ ok: boolean; data?: Record<string, string>; user?: any }> {
  if (!initData || !BOT_TOKEN) return { ok: false };

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { ok: false };
  params.delete("hash");
  const originalHash = hash;

  const keys = [...params.keys()].sort();
  const dataCheckString = keys.map((k) => `${k}=${params.get(k)}`).join("\n");

  const secretKey = await hmacSha256(
    new TextEncoder().encode("WebAppData"),
    BOT_TOKEN,
  );
  const computed = await hmacSha256(new Uint8Array(secretKey), dataCheckString);
  const computedHex = bufToHex(computed);

  if (computedHex !== hash) return { ok: false };

  const authDate = parseInt(params.get("auth_date") ?? "0", 10);
  const ageSec = Math.floor(Date.now() / 1000) - authDate;
  if (ageSec > MAX_AGE_SECONDS) return { ok: false };

  const data: Record<string, string> = {};
  for (const k of keys) data[k] = params.get(k) ?? "";
  data.hash = originalHash;

  let user: any = null;
  try { user = data.user ? JSON.parse(data.user) : null; } catch { /* ignore */ }

  return { ok: true, data, user };
}

/**
 * Parse referrer telegram_id from start_param.
 * Supports two formats:
 *   ref_123456789  → referrer 123456789
 *   123456789      → referrer 123456789 (plain numeric, from legacy links)
 */
function parseReferrer(startParam: string): number | null {
  if (!startParam) return null;
  const clean = startParam.startsWith("ref_") ? startParam.slice(4) : startParam;
  const id = parseInt(clean, 10);
  return isNaN(id) || id <= 0 ? null : id;
}

async function recordReferral(
  supabase: any,
  referredTg: number,
  referrerTg: number,
  startParam: string,
) {
  // Fire-and-forget: call ref_register_referral RPC
  // This handles deduplication, bonus payment, code increment
  try {
    const code = startParam.startsWith("ref_") ? startParam.slice(4) : startParam;
    await supabase.rpc("ref_register_referral", {
      p_referred_tg: referredTg,
      p_referrer_tg: referrerTg,
      p_code: code,
    });
  } catch (_e) {
    // Non-fatal: referral recording failure never blocks login
  }
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
      return new Response(JSON.stringify({ ok: false, error: "bot_not_configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const initData: string = body.initData ?? "";

    const result = await verifyTelegramInitData(initData);
    if (!result.ok || !result.user) {
      return new Response(JSON.stringify({ ok: false, error: "invalid_init_data" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const u = result.user;

    // Rate limit: max 10 verify calls per minute per telegram_id
    if (u.id) {
      const { data: allowed } = await supabase.rpc("check_verify_rate_limit", {
        p_telegram_id: u.id,
        p_max_per_minute: 10,
      });
      if (allowed === false) {
        return new Response(JSON.stringify({ ok: false, error: "rate_limited" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    const startParam = result.data?.start_param ?? "";
    const authDate = new Date(parseInt(result.data?.auth_date ?? "0", 10) * 1000);
    const initHash = result.data?.hash ?? "";

    // Parse referrer from start_param (fix: supports both ref_XXX and plain XXX formats)
    const referrerTgId = parseReferrer(startParam);

    // Update visitor record (always)
    await supabase
      .from("manager_visitors")
      .upsert({
        telegram_id: u.id,
        first_name: u.first_name ?? "",
        username: u.username ?? "",
        last_seen: new Date().toISOString(),
        ...(referrerTgId && referrerTgId !== u.id ? { referrer_id: referrerTgId } : {}),
      }, { onConflict: "telegram_id" });

    // Reuse existing valid session
    const { data: existingValid } = await supabase
      .from("telegram_sessions")
      .select("id, expires_at")
      .eq("telegram_id", u.id)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingValid) {
      return new Response(JSON.stringify({
        ok: true,
        session_id: existingValid.id,
        telegram_id: u.id,
        user: {
          id: u.id,
          username: u.username ?? "",
          first_name: u.first_name ?? "",
          last_name: u.last_name ?? "",
          photo_url: u.photo_url ?? "",
          language_code: u.language_code ?? "en",
          is_premium: u.is_premium ?? false,
        },
        start_param: startParam,
        expires_at: existingValid.expires_at,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create new session
    const { data: inserted, error: sessErr } = await supabase
      .from("telegram_sessions")
      .insert({
        telegram_id: u.id,
        username: u.username ?? "",
        first_name: u.first_name ?? "",
        last_name: u.last_name ?? "",
        photo_url: u.photo_url ?? "",
        language_code: u.language_code ?? "en",
        is_premium: u.is_premium ?? false,
        init_data_hash: initHash,
        auth_date: authDate.toISOString(),
        start_param: startParam,
      })
      .select("id, expires_at")
      .maybeSingle();

    if (sessErr || !inserted) {
      const { data: again } = await supabase
        .from("telegram_sessions")
        .select("id, expires_at")
        .eq("telegram_id", u.id)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!again) {
        return new Response(JSON.stringify({ ok: false, error: "session_create_failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // New session created (via conflict resolution) — record referral
      if (referrerTgId && referrerTgId !== u.id) {
        await recordReferral(supabase, u.id, referrerTgId, startParam);
      }

      return new Response(JSON.stringify({
        ok: true,
        session_id: again.id,
        telegram_id: u.id,
        user: {
          id: u.id,
          username: u.username ?? "",
          first_name: u.first_name ?? "",
          last_name: u.last_name ?? "",
          photo_url: u.photo_url ?? "",
          language_code: u.language_code ?? "en",
          is_premium: u.is_premium ?? false,
        },
        start_param: startParam,
        expires_at: again.expires_at,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fresh new user session — record referral
    if (referrerTgId && referrerTgId !== u.id) {
      await recordReferral(supabase, u.id, referrerTgId, startParam);
    }

    return new Response(JSON.stringify({
      ok: true,
      session_id: inserted.id,
      telegram_id: u.id,
      user: {
        id: u.id,
        username: u.username ?? "",
        first_name: u.first_name ?? "",
        last_name: u.last_name ?? "",
        photo_url: u.photo_url ?? "",
        language_code: u.language_code ?? "en",
        is_premium: u.is_premium ?? false,
      },
      start_param: startParam,
      expires_at: inserted.expires_at,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (_e) {
    return new Response(JSON.stringify({ ok: false, error: "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
