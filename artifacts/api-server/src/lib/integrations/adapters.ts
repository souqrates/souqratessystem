import { fetchWithTimeout, describeError } from "./http";
import type { IntegrationAdapter } from "./types";

// ─────────────────────────────────────────────────────────────────────────
// Tier 1 — أساسي لتحمّل الملايين
// ─────────────────────────────────────────────────────────────────────────

const upstashRedis: IntegrationAdapter = {
  slug: "upstash_redis",
  name: "Upstash Redis",
  brand: "Upstash",
  category: "infra",
  tier: 1,
  description:
    "كاش وrate-limit لا-حالة عبر REST. يخفّض ضغط Postgres ويُسرّع القراءات الساخنة. ضروري للملايين.",
  signupUrl: "https://console.upstash.com/redis",
  docsUrl: "https://docs.upstash.com/redis",
  pricing: "مجاني 10k أمر/يوم، ثم ≈$0.20 لكل 100k أمر",
  fields: [
    {
      key: "rest_url",
      label: "REST URL",
      type: "url",
      required: true,
      placeholder: "https://xxx.upstash.io",
      help: "من تبويب REST API في Console Upstash",
    },
    {
      key: "rest_token",
      label: "REST Token",
      type: "password",
      required: true,
      secret: true,
    },
  ],
  async test(cfg): Promise<{ ok: boolean; error?: string; metadata?: Record<string, unknown> }> {
    if (!cfg.rest_url || !cfg.rest_token) return { ok: false, error: "missing fields" };
    try {
      const r = await fetchWithTimeout(`${cfg.rest_url.replace(/\/$/, "")}/ping`, {
        headers: { Authorization: `Bearer ${cfg.rest_token}` },
      });
      if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
      const j = (await r.json()) as { result?: string };
      if (j.result !== "PONG") return { ok: false, error: `unexpected response: ${JSON.stringify(j)}` };
      return { ok: true, metadata: { ping: "PONG" } };
    } catch (e) {
      return { ok: false, error: describeError(e) };
    }
  },
};

const sentry: IntegrationAdapter = {
  slug: "sentry",
  name: "Sentry",
  brand: "Sentry",
  category: "monitoring",
  tier: 1,
  description:
    "تتبّع الأخطاء لـ API + Python bots. ترى الأعطال فور حدوثها بدل ما تكتشفها من شكاوى المستخدمين.",
  signupUrl: "https://sentry.io/signup/",
  docsUrl: "https://docs.sentry.io/",
  pricing: "مجاني 5k حدث/شهر، Team $26 لـ 50k",
  fields: [
    {
      key: "dsn",
      label: "DSN",
      type: "password",
      required: true,
      secret: true,
      placeholder: "https://xxx@oXXX.ingest.sentry.io/YYY",
      help: "من Settings → Projects → Client Keys (DSN)",
    },
    {
      key: "environment",
      label: "Environment",
      type: "text",
      default: "production",
    },
    {
      key: "traces_sample_rate",
      label: "Traces sample rate (0–1)",
      type: "text",
      default: "0.1",
      help: "نسبة الطلبات التي تُسجَّل كـ trace كاملة. 0.1 = 10%",
    },
  ],
  async test(cfg) {
    if (!cfg.dsn) return { ok: false, error: "missing dsn" };
    // DSN shape: https://<publicKey>@<host>/<projectId>
    try {
      const u = new URL(cfg.dsn);
      if (!u.username) return { ok: false, error: "DSN missing public key" };
      const projectId = u.pathname.replace(/^\//, "");
      if (!projectId) return { ok: false, error: "DSN missing project id" };
      // Sentry's ingest endpoint requires auth. Pass the DSN public key as
      // ?sentry_key=… so the server identifies the project. A GET on the
      // store endpoint with a valid key returns 400 ("method not allowed"
      // body but 400 status). 401/403 means the key/project is wrong.
      // The Sentry ingest host must end in sentry.io (any region). Accept
      // only well-known Sentry response codes: 405 (method not allowed) or
      // 400 (Sentry-specific "method not allowed" with body). 200 is NOT a
      // valid response from this endpoint — accepting it would false-pass
      // a misrouted DSN whose host happens to return 200 to a GET.
      if (!/(^|\.)sentry\.io$/i.test(u.host)) {
        return { ok: false, error: `unexpected DSN host: ${u.host}` };
      }
      const ingest = `${u.protocol}//${u.host}/api/${projectId}/store/?sentry_key=${encodeURIComponent(u.username)}`;
      const r = await fetchWithTimeout(ingest, { method: "GET" });
      if (r.status === 405 || r.status === 400) {
        return { ok: true, metadata: { host: u.host, projectId } };
      }
      return { ok: false, error: `ingest returned ${r.status}` };
    } catch (e) {
      return { ok: false, error: describeError(e) };
    }
  },
};

const cloudflare: IntegrationAdapter = {
  slug: "cloudflare",
  name: "Cloudflare",
  brand: "Cloudflare",
  category: "infra",
  tier: 1,
  description:
    "DNS + CDN + DDoS مجاني للأبد. ضع الدومين خلف Cloudflare ثم احصل على API token هنا لإدارة DNS/Cache برمجياً.",
  signupUrl: "https://dash.cloudflare.com/sign-up",
  docsUrl: "https://developers.cloudflare.com/api/",
  pricing: "مجاني للأساسيات (Pro $20/شهر للأمان المتقدم)",
  fields: [
    {
      key: "api_token",
      label: "API Token",
      type: "password",
      required: true,
      secret: true,
      help: "من My Profile → API Tokens. صلاحية Zone:Read على الأقل لاختبار الاتصال.",
    },
    {
      key: "zone_id",
      label: "Zone ID (اختياري)",
      type: "text",
      help: "إذا أردت تطهير الكاش برمجياً، الصق Zone ID لدومينك",
    },
  ],
  async test(cfg) {
    if (!cfg.api_token) return { ok: false, error: "missing token" };
    try {
      // /zones works for BOTH user-scoped and account-scoped tokens as long
      // as the token has Zone:Read. /user/tokens/verify rejects
      // account-scoped tokens with code 1000, which is misleading.
      // If a specific zone_id is configured, probe it directly so a token
      // that can list zones but lacks access to *this* zone is rejected.
      const zoneId = typeof cfg["zone_id"] === "string" ? (cfg["zone_id"] as string).trim() : "";
      const probeUrl = zoneId
        ? `https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zoneId)}`
        : "https://api.cloudflare.com/client/v4/zones?per_page=1";
      const r = await fetchWithTimeout(probeUrl, {
        headers: { Authorization: `Bearer ${cfg.api_token}` },
      });
      const j = (await r.json()) as {
        success?: boolean;
        result?: Array<unknown> | { name?: string; status?: string };
        errors?: Array<{ message: string }>;
      };
      if (!j.success) {
        return { ok: false, error: j.errors?.[0]?.message ?? `HTTP ${r.status}` };
      }
      if (zoneId && !Array.isArray(j.result)) {
        return { ok: true, metadata: { zone: j.result?.name, status: j.result?.status } };
      }
      return { ok: true, metadata: { zones_visible: Array.isArray(j.result) ? j.result.length : 0 } };
    } catch (e) {
      return { ok: false, error: describeError(e) };
    }
  },
};

const cloudflareTurnstile: IntegrationAdapter = {
  slug: "cloudflare_turnstile",
  name: "Cloudflare Turnstile",
  brand: "Cloudflare",
  category: "security",
  tier: 1,
  description:
    "Captcha خفيّ بدون شعار مزعج. يحمي تسجيل الدخول والإيداع من البوتات. مجاني بالكامل.",
  signupUrl: "https://dash.cloudflare.com/?to=/:account/turnstile",
  docsUrl: "https://developers.cloudflare.com/turnstile/",
  pricing: "مجاني بدون حدود تقريباً",
  fields: [
    { key: "site_key", label: "Site Key", type: "text", required: true, placeholder: "0x4AAA..." },
    { key: "secret_key", label: "Secret Key", type: "password", required: true, secret: true },
  ],
  async test(cfg) {
    if (!cfg.secret_key) return { ok: false, error: "missing secret_key" };
    try {
      // Probe with the dummy "always-fail" response: provider must reply
      // with success=false + "invalid-input-response". Any other shape ⇒
      // our secret is bogus or rejected.
      const form = new URLSearchParams();
      form.set("secret", cfg.secret_key);
      form.set("response", "dummy-token-for-probe");
      const r = await fetchWithTimeout(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        { method: "POST", body: form },
      );
      const j = (await r.json()) as { success?: boolean; "error-codes"?: string[] };
      // Cloudflare's documented test secrets ("always pass" / "always fail")
      // return success:true even for the dummy probe token. Real secrets
      // return success:false + "invalid-input-response" since the probe
      // token is invalid. Either case ⇒ the secret reached Cloudflare and
      // wasn't rejected as bogus.
      if (j.success === true) {
        return { ok: true, metadata: { siteverify: "reachable (test secret detected)" } };
      }
      if (j.success === false && (j["error-codes"] ?? []).includes("invalid-input-response")) {
        return { ok: true, metadata: { siteverify: "reachable, secret accepted" } };
      }
      if ((j["error-codes"] ?? []).includes("invalid-input-secret")) {
        return { ok: false, error: "invalid secret_key" };
      }
      return { ok: false, error: `unexpected: ${JSON.stringify(j)}` };
    } catch (e) {
      return { ok: false, error: describeError(e) };
    }
  },
};

const betterStack: IntegrationAdapter = {
  slug: "betterstack",
  name: "Better Stack (Logtail + Uptime)",
  brand: "Better Stack",
  category: "monitoring",
  tier: 1,
  description:
    "Logs مجمّعة + monitor للـ uptime مع تنبيهات. خصوصاً مفيد عبر بوتاتك المتعددة.",
  signupUrl: "https://betterstack.com/users/sign-up",
  docsUrl: "https://betterstack.com/docs/",
  pricing: "مجاني 1GB logs/شهر + 10 monitors",
  fields: [
    {
      key: "logs_source_token",
      label: "Logs Source Token",
      type: "password",
      required: true,
      secret: true,
      help: "من Telemetry → Sources → اختر source → Source Token",
    },
    {
      key: "logs_ingest_host",
      label: "Logs Ingest Host",
      type: "text",
      default: "in.logs.betterstack.com",
    },
  ],
  async test(cfg) {
    if (!cfg.logs_source_token) return { ok: false, error: "missing token" };
    const host = (cfg.logs_ingest_host || "in.logs.betterstack.com").replace(/^https?:\/\//, "");
    try {
      // Send a single probe log line — accepted ⇒ token valid.
      const r = await fetchWithTimeout(`https://${host}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.logs_source_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dt: new Date().toISOString(),
          level: "info",
          message: "souqrates integration test probe",
        }),
      });
      if (r.status === 202 || r.status === 200) {
        return { ok: true, metadata: { ingested: true } };
      }
      return { ok: false, error: `HTTP ${r.status}` };
    } catch (e) {
      return { ok: false, error: describeError(e) };
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Tier 2 — احترافي
// ─────────────────────────────────────────────────────────────────────────

const resend: IntegrationAdapter = {
  slug: "resend",
  name: "Resend",
  brand: "Resend",
  category: "comms",
  tier: 2,
  description:
    "إرسال البريد للإيصالات وتنبيهات الأدمن. أبسط واجهة في السوق وسعر معقول.",
  signupUrl: "https://resend.com/signup",
  docsUrl: "https://resend.com/docs",
  pricing: "مجاني 3k/شهر، Pro $20 لـ 50k",
  fields: [
    { key: "api_key", label: "API Key", type: "password", required: true, secret: true, placeholder: "re_..." },
    {
      key: "from_email",
      label: "From Email",
      type: "text",
      required: true,
      placeholder: "noreply@yourdomain.com",
      help: "يجب أن يكون الدومين موثّقاً في Resend",
    },
  ],
  async test(cfg) {
    if (!cfg.api_key) return { ok: false, error: "missing api_key" };
    try {
      const r = await fetchWithTimeout("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${cfg.api_key}` },
      });
      // A 401 with name=restricted_api_key means the key authenticated
      // correctly but lacks the "domains" scope — i.e. it's a sending-only
      // key. That is a perfectly valid setup for transactional email, so we
      // treat it as success.
      if (r.status === 401) {
        try {
          const err = (await r.json()) as { name?: string; message?: string };
          if (err.name === "restricted_api_key") {
            return { ok: true, metadata: { scope: "sending_only" } };
          }
        } catch {}
        return { ok: false, error: "invalid api_key" };
      }
      if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
      const j = (await r.json()) as { data?: Array<{ name: string; status: string }> };
      const domains = j.data ?? [];
      const verified = domains.filter((d) => d.status === "verified").length;
      return { ok: true, metadata: { total_domains: domains.length, verified } };
    } catch (e) {
      return { ok: false, error: describeError(e) };
    }
  },
};

const posthog: IntegrationAdapter = {
  slug: "posthog",
  name: "PostHog",
  brand: "PostHog",
  category: "analytics",
  tier: 2,
  description:
    "تحليلات سلوك المستخدم + funnels + session replay. سخيّ في الـ free tier.",
  signupUrl: "https://app.posthog.com/signup",
  docsUrl: "https://posthog.com/docs",
  pricing: "مجاني 1M حدث/شهر",
  fields: [
    {
      key: "host",
      label: "Host",
      type: "select",
      default: "https://us.i.posthog.com",
      options: [
        { value: "https://us.i.posthog.com", label: "US Cloud" },
        { value: "https://eu.i.posthog.com", label: "EU Cloud" },
      ],
    },
    { key: "project_api_key", label: "Project API Key", type: "password", required: true, secret: true, placeholder: "phc_..." },
  ],
  async test(cfg) {
    if (!cfg.project_api_key) return { ok: false, error: "missing project_api_key" };
    const host = (cfg.host || "https://us.i.posthog.com").replace(/\/$/, "");
    try {
      // PostHog accepts /capture/ with the project key; 200 ⇒ valid.
      const r = await fetchWithTimeout(`${host}/capture/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: cfg.project_api_key,
          event: "souqrates_integration_probe",
          distinct_id: "integration-test",
          properties: { test: true },
        }),
      });
      if (r.status === 200) return { ok: true, metadata: { capture: "accepted" } };
      return { ok: false, error: `HTTP ${r.status}` };
    } catch (e) {
      return { ok: false, error: describeError(e) };
    }
  },
};

const onesignal: IntegrationAdapter = {
  slug: "onesignal",
  name: "OneSignal",
  brand: "OneSignal",
  category: "comms",
  tier: 2,
  description:
    "Push notifications للويب والموبايل. مجاني حتى 10k مشترك.",
  signupUrl: "https://app.onesignal.com/signup",
  docsUrl: "https://documentation.onesignal.com/",
  pricing: "مجاني ≤10k مشترك",
  fields: [
    { key: "app_id", label: "App ID", type: "text", required: true },
    { key: "rest_api_key", label: "REST API Key", type: "password", required: true, secret: true },
  ],
  async test(cfg) {
    if (!cfg.app_id || !cfg.rest_api_key) return { ok: false, error: "missing fields" };
    try {
      const r = await fetchWithTimeout(`https://api.onesignal.com/apps/${encodeURIComponent(cfg.app_id)}`, {
        headers: { Authorization: `Key ${cfg.rest_api_key}` },
      });
      if (r.status === 401 || r.status === 403) return { ok: false, error: "invalid rest_api_key" };
      if (r.status === 404) return { ok: false, error: "app_id not found" };
      if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
      const j = (await r.json()) as { name?: string; players?: number };
      return { ok: true, metadata: { app: j.name, subscribers: j.players } };
    } catch (e) {
      return { ok: false, error: describeError(e) };
    }
  },
};

const bunny: IntegrationAdapter = {
  slug: "bunny",
  name: "Bunny.net Storage + CDN",
  brand: "Bunny.net",
  category: "storage",
  tier: 2,
  description:
    "CDN + تخزين للكتب والصور بسعر زهيد. يُستخدم بديلاً اقتصادياً لـ Cloudflare R2 وS3.",
  signupUrl: "https://bunny.net/?ref=signup",
  docsUrl: "https://docs.bunny.net/",
  pricing: "≈ $1/شهر للتخزين، CDN $0.005/GB",
  fields: [
    { key: "storage_zone", label: "Storage Zone Name", type: "text", required: true },
    {
      key: "storage_region",
      label: "Region",
      type: "select",
      default: "storage",
      options: [
        { value: "storage", label: "Falkenstein (EU)" },
        { value: "ny.storage", label: "New York" },
        { value: "la.storage", label: "Los Angeles" },
        { value: "sg.storage", label: "Singapore" },
      ],
    },
    { key: "access_key", label: "Access Key (Storage password)", type: "password", required: true, secret: true },
    { key: "pull_zone_url", label: "Pull Zone URL", type: "url", required: false, placeholder: "https://yourzone.b-cdn.net" },
  ],
  async test(cfg) {
    if (!cfg.storage_zone || !cfg.access_key) return { ok: false, error: "missing fields" };
    const region = cfg.storage_region || "storage";
    try {
      // List the root of the zone — auth-only endpoint, fast, no side effects.
      const r = await fetchWithTimeout(
        `https://${region}.bunnycdn.com/${encodeURIComponent(cfg.storage_zone)}/`,
        { headers: { AccessKey: cfg.access_key, Accept: "application/json" } },
      );
      if (r.status === 401) return { ok: false, error: "invalid access_key" };
      if (r.status === 404) return { ok: false, error: "storage_zone or region wrong" };
      if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
      return { ok: true, metadata: { zone: cfg.storage_zone, region } };
    } catch (e) {
      return { ok: false, error: describeError(e) };
    }
  },
};

const openrouter: IntegrationAdapter = {
  slug: "openrouter",
  name: "OpenRouter",
  brand: "OpenRouter",
  category: "ai",
  tier: 2,
  description:
    "Aggregator لكل نماذج LLM بأرخص الأسعار. يستخدمه ai-bot للتبديل بين Claude/GPT/Llama حسب التكلفة.",
  signupUrl: "https://openrouter.ai/keys",
  docsUrl: "https://openrouter.ai/docs",
  pricing: "Pay-per-use، أرخص نماذج من $0.10/مليون token",
  fields: [
    { key: "api_key", label: "API Key", type: "password", required: true, secret: true, placeholder: "sk-or-..." },
    {
      key: "default_model",
      label: "Default Model",
      type: "text",
      default: "anthropic/claude-3.5-haiku",
      help: "مثال: anthropic/claude-3.5-haiku أو meta-llama/llama-3.1-8b-instruct",
    },
  ],
  async test(cfg) {
    if (!cfg.api_key) return { ok: false, error: "missing api_key" };
    try {
      const r = await fetchWithTimeout("https://openrouter.ai/api/v1/auth/key", {
        headers: { Authorization: `Bearer ${cfg.api_key}` },
      });
      if (r.status === 401) return { ok: false, error: "invalid api_key" };
      if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
      const j = (await r.json()) as { data?: { label?: string; usage?: number; limit?: number | null } };
      return {
        ok: true,
        metadata: {
          label: j.data?.label,
          usage_usd: j.data?.usage,
          limit_usd: j.data?.limit,
        },
      };
    } catch (e) {
      return { ok: false, error: describeError(e) };
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Payments — Cryptomus (card-to-crypto deposits + crypto payouts)
// ─────────────────────────────────────────────────────────────────────────

const cryptomus: IntegrationAdapter = {
  slug: "cryptomus",
  name: "Cryptomus",
  brand: "Cryptomus",
  category: "payments",
  tier: 1,
  description:
    "بوابة دفع: المستخدم يدفع بالبطاقة → نستلم USDT/TON على محفظتنا. تستخدم أيضاً للسحب التلقائي (payout API).",
  signupUrl: "https://app.cryptomus.com/signup",
  docsUrl: "https://doc.cryptomus.com/business/",
  pricing: "0.4% على الإيداع، رسوم شبكة فقط على السحب",
  fields: [
    { key: "merchant_id", label: "Merchant ID", type: "text", required: true, placeholder: "UUID من Settings → API" },
    { key: "payment_api_key", label: "Payment API Key", type: "password", required: true, secret: true },
    {
      key: "payout_api_key",
      label: "Payout API Key",
      type: "password",
      secret: true,
      help: "اختياري للآن — مطلوب لاحقاً لتفعيل السحب التلقائي",
    },
    {
      key: "webhook_api_key",
      label: "Webhook Signing Key",
      type: "password",
      secret: true,
      help: "اتركه فارغاً لاستخدام Payment API Key (افتراضي Cryptomus)",
    },
    {
      key: "default_network",
      label: "الشبكة الافتراضية للإيداع",
      type: "select",
      default: "tron",
      options: [
        { value: "tron", label: "Tron (USDT TRC20) — الأرخص" },
        { value: "ton", label: "TON" },
        { value: "eth", label: "Ethereum (USDT ERC20)" },
        { value: "bsc", label: "BSC (USDT BEP20)" },
      ],
    },
    {
      key: "public_webhook_base",
      label: "Public Webhook Base URL",
      type: "url",
      required: true,
      placeholder: "https://your-app.replit.app",
      help: "Cryptomus يرفض الـ callbacks على localhost. ضع الـ HTTPS الرئيسي.",
    },
  ],
  async test(cfg) {
    if (!cfg.merchant_id || !cfg.payment_api_key) {
      return { ok: false, error: "missing merchant_id or payment_api_key" };
    }
    try {
      // /v1/balance is the cheapest authenticated read — returns the merchant
      // balance per currency. Confirms creds without creating any side-effect.
      const body = JSON.stringify({});
      const b64 = Buffer.from(body, "utf8").toString("base64");
      const sign = (await import("crypto"))
        .createHash("md5")
        .update(b64 + cfg.payment_api_key)
        .digest("hex");
      const r = await fetchWithTimeout("https://api.cryptomus.com/v1/balance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          merchant: cfg.merchant_id,
          sign,
        },
        body,
      });
      if (r.status === 401 || r.status === 403) return { ok: false, error: "invalid credentials" };
      if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
      const j = (await r.json()) as { state?: number; message?: string; result?: unknown };
      if (j.state !== 0) return { ok: false, error: j.message ?? "gateway rejected" };
      return { ok: true, metadata: { balance_endpoint: "ok" } };
    } catch (e) {
      return { ok: false, error: describeError(e) };
    }
  },
};

export const ALL_ADAPTERS: IntegrationAdapter[] = [
  upstashRedis,
  sentry,
  cloudflare,
  cloudflareTurnstile,
  betterStack,
  resend,
  posthog,
  onesignal,
  bunny,
  openrouter,
  // cryptomus: removed (content restrictions). Card top-ups now route to
  // @wallet — see artifacts/mother-bot/src/bot.py:cb_topup_card.
];
