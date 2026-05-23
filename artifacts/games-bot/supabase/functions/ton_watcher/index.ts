import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TONCENTER_KEY = Deno.env.get("TONCENTER_API_KEY") ?? "";

const USDT_MASTER   = "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs";
const MAX_DEPOSIT_TON = 10_000;
// Scale: process more pending deposits per run (was implicit 200, keep 200)
const MAX_PENDING_PER_RUN = 200;

interface TonTx {
  hash: string;
  in_msg?: { source: string; destination: string; value: string; message?: string };
  out_msgs?: Array<{ destination: string; value: string; message?: string }>;
  utime: number;
}

interface JettonTransfer {
  transaction_hash: string;
  jetton_master: string;
  amount: string;
  comment?: string;
  utime: number;
}

async function fetchTonTransactions(address: string, limit = 80): Promise<TonTx[]> {
  const url = new URL("https://toncenter.com/api/v2/getTransactions");
  url.searchParams.set("address", address);
  url.searchParams.set("limit", String(limit));
  if (TONCENTER_KEY) url.searchParams.set("api_key", TONCENTER_KEY);
  try {
    const r = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
    const j = await r.json().catch(() => ({}));
    if (!j?.ok) return [];
    return (j.result as TonTx[]) || [];
  } catch (err) {
    console.error("[ton_watcher] fetchTonTransactions failed:", err);
    return [];
  }
}

async function fetchUsdtTransfers(address: string): Promise<JettonTransfer[]> {
  try {
    const url = `https://tonapi.io/v2/accounts/${encodeURIComponent(address)}/jettons/${encodeURIComponent(USDT_MASTER)}/history?limit=50`;
    const r = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return [];
    const j = await r.json().catch(() => ({}));
    const transfers: JettonTransfer[] = [];
    for (const ev of j?.events || []) {
      for (const action of ev?.actions || []) {
        if (action?.type !== "JettonTransfer") continue;
        const jt = action?.JettonTransfer;
        if (!jt) continue;
        if (
          jt?.jetton?.address !== USDT_MASTER &&
          jt?.jetton?.address !== "0:b113a994b5024a16719f69139328eb759596c38a25f59028b146fecdc3621dfe"
        ) continue;
        transfers.push({
          transaction_hash: ev.event_id || ev.lt || "",
          jetton_master: USDT_MASTER,
          amount: jt.amount || "0",
          comment: jt.comment || "",
          utime: ev.timestamp || 0,
        });
      }
    }
    return transfers;
  } catch (err) {
    console.error("[ton_watcher] fetchUsdtTransfers failed:", err);
    return [];
  }
}

function atomicToDecimal(units: string, decimals: number): number {
  const s = units.replace(/[^0-9]/g, "") || "0";
  if (s.length <= decimals) {
    const padded = s.padStart(decimals + 1, "0");
    return parseFloat(`0.${padded.slice(1)}`);
  }
  const intPart  = s.slice(0, s.length - decimals);
  const fracPart = s.slice(s.length - decimals);
  const result   = parseFloat(`${intPart}.${fracPart}`);
  return isFinite(result) ? result : MAX_DEPOSIT_TON + 1;
}

function verifyServiceAuth(req: Request): boolean {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  return token === SERVICE_ROLE;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.headers.get("X-Warmup") === "1") {
    return new Response(JSON.stringify({ ok: true, warm: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    if (!verifyServiceAuth(req)) {
      return new Response(JSON.stringify({ ok: false, error: "unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // ── Check watcher is enabled ──────────────────────────────────────────
    const { data: enabledRow } = await supabase
      .from("economy_settings").select("value").eq("key", "ton_watcher_enabled").maybeSingle();
    if ((enabledRow?.value as string) !== "true") {
      return new Response(JSON.stringify({ ok: true, skipped: "watcher_disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Load config in parallel ───────────────────────────────────────────
    const [addrRow, scRateRow, scUsdtRow] = await Promise.all([
      supabase.from("economy_settings").select("value").eq("key", "ton_deposit_address").maybeSingle(),
      supabase.from("economy_settings").select("value").eq("key", "sc_per_ton").maybeSingle(),
      supabase.from("economy_settings").select("value").eq("key", "sc_per_usdt").maybeSingle(),
    ]);
    const address  = (addrRow.data?.value as string) || "";
    if (!address) {
      // Push to DLQ so operator is notified
      await supabase.rpc("dlq_push", {
        p_operation: "ton_watcher_config",
        p_payload:   { key: "ton_deposit_address" },
        p_error_msg: "ton_deposit_address not configured",
      });
      return new Response(JSON.stringify({ ok: false, error: "no_deposit_address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const scPerTon  = Number(scRateRow.data?.value  || "500") || 500;
    const scPerUsdt = Number(scUsdtRow.data?.value  || "500") || 500;

    // ── Load pending intents ──────────────────────────────────────────────
    const { data: pending } = await supabase
      .from("ton_deposit_intents")
      .select("*")
      .eq("status", "awaiting")
      .gt("expires_at", new Date().toISOString())
      .limit(MAX_PENDING_PER_RUN);

    // Expire stale intents regardless
    await supabase
      .from("ton_deposit_intents")
      .update({ status: "expired" })
      .eq("status", "awaiting")
      .lt("expires_at", new Date().toISOString());

    if (!pending || pending.length === 0) {
      return new Response(JSON.stringify({ ok: true, matched: 0, pending: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Fetch blockchain data in parallel ─────────────────────────────────
    const [txs, usdtTransfers] = await Promise.all([
      fetchTonTransactions(address, 80),
      fetchUsdtTransfers(address),
    ]);

    // If both fetches returned empty (network failure), push DLQ
    if (txs.length === 0 && usdtTransfers.length === 0 && pending.length > 0) {
      await supabase.rpc("dlq_push", {
        p_operation:   "ton_watcher_fetch",
        p_payload:     { address, pending_count: pending.length },
        p_error_msg:   "Both TonCenter and TonAPI returned empty — possible network failure",
        p_max_attempts: 3,
      });
      return new Response(
        JSON.stringify({ ok: false, error: "blockchain_fetch_failed", pending: pending.length }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Match intents against transactions ────────────────────────────────
    let matched = 0;
    const matchFailures: { intent_id: string; memo: string; error: string }[] = [];

    for (const intent of pending) {
      const memo = (intent.memo as string) || "";
      if (!memo || memo.length < 6) continue;

      const tonTx  = txs.find(t =>
        t.in_msg?.message &&
        String(t.in_msg.message).trim() === memo &&
        t.in_msg.destination === address
      );
      const usdtTx = usdtTransfers.find(t =>
        t.comment && String(t.comment).trim() === memo
      );

      let txHash      = "";
      let observedTon = 0;
      let currency    = "TON";

      if (tonTx?.in_msg) {
        observedTon = atomicToDecimal(tonTx.in_msg.value, 9);
        txHash      = tonTx.hash;
        currency    = "TON";
      } else if (usdtTx) {
        observedTon = atomicToDecimal(usdtTx.amount, 6);
        txHash      = usdtTx.transaction_hash;
        currency    = "USDT";
      } else {
        continue; // Not found yet — will be retried next tick
      }

      if (observedTon <= 0 || observedTon > MAX_DEPOSIT_TON) continue;

      const { data: applyResult, error: applyErr } = await supabase.rpc("pay_apply_ton_deposit", {
        p_intent_id:    intent.id,
        p_tx_hash:      txHash,
        p_observed_ton: observedTon,
        p_currency:     currency,
      });

      if (applyErr || !applyResult?.ok) {
        // Push failed application to DLQ for manual review
        matchFailures.push({
          intent_id: intent.id,
          memo,
          error: applyErr?.message ?? applyResult?.error ?? "apply_failed",
        });
        continue;
      }

      matched += 1;

      const rateForCurrency = currency === "USDT" ? scPerUsdt : scPerTon;
      const scCredited  = applyResult.sc_credited ?? Math.round(observedTon * rateForCurrency);
      const amountLabel = currency === "USDT"
        ? `${observedTon.toFixed(2)} USDT`
        : `${observedTon.toFixed(4)} TON`;

      await supabase.from("telegram_outbox").insert({
        telegram_id: intent.user_telegram_id,
        message: `✅ <b>Deposit Confirmed!</b>\n\n💰 Amount: <b>${amountLabel}</b>\n🎮 Points Added: <b>+${scCredited.toLocaleString()} SKZ</b>\n\nYour points have been added. Good luck! 🚀`,
        parse_mode: "HTML",
      });
    }

    // Push all match failures to DLQ in one batch
    if (matchFailures.length > 0) {
      console.error("[ton_watcher] match failures:", JSON.stringify(matchFailures));
      await Promise.allSettled(
        matchFailures.map((f) =>
          supabase.rpc("dlq_push", {
            p_operation:   "ton_deposit_apply",
            p_payload:     { intent_id: f.intent_id, memo: f.memo },
            p_error_msg:   f.error,
            p_max_attempts: 5,
          })
        )
      );
    }

    return new Response(
      JSON.stringify({ ok: true, matched, failed: matchFailures.length, scanned_pending: pending.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[ton_watcher] unhandled error:", err);
    // Even top-level crashes go to DLQ
    try {
      const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
      await sb.rpc("dlq_push", {
        p_operation: "ton_watcher_crash",
        p_payload:   {},
        p_error_msg: String(err),
      });
    } catch { /* best effort */ }

    return new Response(JSON.stringify({ ok: false, error: "internal_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
