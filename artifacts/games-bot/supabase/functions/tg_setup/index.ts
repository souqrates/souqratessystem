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
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function tgCall(method: string, body: Record<string, unknown> = {}) {
  const r = await fetch(`${API_BASE}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return await r.json().catch(() => ({}));
}

async function loadConfig(supabase: ReturnType<typeof createClient>, key: string): Promise<string> {
  const { data } = await supabase
    .from("private_security_config")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return (data?.value as string) || "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (!BOT_TOKEN) {
      return new Response(JSON.stringify({ ok: false, error: "TELEGRAM_BOT_TOKEN not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const webhookSecret = await loadConfig(supabase, "webhook_secret_token");
    const appUrl = await loadConfig(supabase, "app_url");

    const webhookUrl = `${SUPABASE_URL}/functions/v1/telegram_webhook`;

    const [me, setRes, info, commands] = await Promise.all([
      tgCall("getMe"),
      tgCall("setWebhook", {
        url: webhookUrl,
        allowed_updates: ["message", "edited_message", "callback_query", "pre_checkout_query"],
        drop_pending_updates: false,
        ...(webhookSecret ? { secret_token: webhookSecret } : {}),
      }),
      tgCall("getWebhookInfo"),
      tgCall("setMyCommands", {
        commands: [
          { command: "start",    description: "Open the app" },
          { command: "play",     description: "Jump into a game" },
          { command: "balance",  description: "See your balance" },
          { command: "withdraw", description: "Request a withdrawal" },
          { command: "invite",   description: "Get your referral link" },
          { command: "help",     description: "Show commands" },
        ],
      }),
    ]);

    let menuButtonRes = null;
    if (appUrl) {
      menuButtonRes = await tgCall("setChatMenuButton", {
        menu_button: { type: "web_app", text: "Play", web_app: { url: appUrl } },
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      webhook_url: webhookUrl,
      app_url: appUrl || "(not set)",
      secret_token_set: Boolean(webhookSecret),
      bot: me?.result?.username ?? null,
      setWebhook: setRes,
      getWebhookInfo: info,
      setMyCommands: commands,
      setMenuButton: menuButtonRes,
    }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
