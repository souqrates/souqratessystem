/**
 * Cloudflare DNS setup for SOUQRATES SYSTEM.
 *
 * Idempotent: lists existing records, updates if changed, creates if missing,
 * and never deletes anything you didn't explicitly ask for.
 *
 * Required env:
 *   CLOUDFLARE_API_TOKEN  — token with Zone:DNS:Edit permission on souqrates.com
 *   CLOUDFLARE_ZONE_ID    — zone id from Cloudflare dashboard
 *   TARGET_IP             — VPS IP (default: 194.163.155.52 — Contabo)
 *   BASE_DOMAIN           — root domain (default: souqrates.com)
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run dns:setup        # apply
 *   pnpm --filter @workspace/scripts run dns:setup -- --dry-run
 */

type DnsRecord = {
  name: string;       // full subdomain (e.g. api.souqrates.com)
  proxied: boolean;   // true = Cloudflare proxy on (orange cloud)
  purpose: string;    // human-readable note
};

const BASE     = process.env.BASE_DOMAIN || "souqrates.com";
const IP       = process.env.TARGET_IP   || "194.163.155.52";
const TOKEN    = process.env.CLOUDFLARE_API_TOKEN || "";
const ZONE_ID  = process.env.CLOUDFLARE_ZONE_ID || "";
const DRY_RUN  = process.argv.includes("--dry-run");
const API      = "https://api.cloudflare.com/client/v4";

const RECORDS: DnsRecord[] = [
  { name: `api.${BASE}`,       proxied: true,  purpose: "Express API server"          },
  { name: `admin.${BASE}`,     proxied: true,  purpose: "Super-admin panel"           },
  { name: `books.${BASE}`,     proxied: true,  purpose: "SOUQRATES SOUQ web"          },
  { name: `contests.${BASE}`,  proxied: true,  purpose: "SOUQRATES STAGE web"         },
  { name: `games.${BASE}`,     proxied: true,  purpose: "SOUQRATES SKILLZ web"        },
  { name: `subagents.${BASE}`, proxied: true,  purpose: "SUB-AGENTS web"              },
  // Telegram webhook MUST be DNS-only (Telegram's IPs ≠ Cloudflare's IP set)
  { name: `tg.${BASE}`,        proxied: false, purpose: "Telegram webhook (DNS-only)" },
];

function die(msg: string): never {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

async function cf<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Authorization": `Bearer ${TOKEN}`,
      "Content-Type":  "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok || json?.success === false) {
    const err = json?.errors?.map((e: any) => `[${e.code}] ${e.message}`).join("; ") || text;
    die(`Cloudflare ${method} ${path} → ${res.status}: ${err}`);
  }
  return json as T;
}

type CfRecord = { id: string; name: string; type: string; content: string; proxied: boolean; ttl: number };

async function main() {
  if (!TOKEN)   die("CLOUDFLARE_API_TOKEN not set");
  if (!ZONE_ID) die("CLOUDFLARE_ZONE_ID not set");

  console.log(`▶ Zone:   ${ZONE_ID}`);
  console.log(`▶ Domain: ${BASE}`);
  console.log(`▶ Target: ${IP}`);
  console.log(`▶ Mode:   ${DRY_RUN ? "DRY-RUN (لا تغييرات)" : "APPLY"}`);
  console.log();

  // Fetch all existing A records in this zone (one page is plenty for our scale)
  const list = await cf<{ result: CfRecord[] }>(
    "GET",
    `/zones/${ZONE_ID}/dns_records?type=A&per_page=100`,
  );
  const byName = new Map<string, CfRecord>();
  for (const r of list.result) byName.set(r.name, r);

  let created = 0, updated = 0, unchanged = 0;
  for (const want of RECORDS) {
    const existing = byName.get(want.name);
    const desired = {
      type:    "A" as const,
      name:    want.name,
      content: IP,
      ttl:     1,                // 1 = auto (required when proxied)
      proxied: want.proxied,
      comment: `souqrates-system: ${want.purpose}`,
    };

    if (!existing) {
      console.log(`+ CREATE  ${want.name.padEnd(28)} → ${IP}  ${want.proxied ? "🟠 proxied" : "⚪ dns-only"}  (${want.purpose})`);
      if (!DRY_RUN) await cf("POST", `/zones/${ZONE_ID}/dns_records`, desired);
      created++;
      continue;
    }

    const changed =
      existing.content !== IP ||
      existing.proxied !== want.proxied ||
      existing.type    !== "A";

    if (!changed) {
      console.log(`= OK      ${want.name.padEnd(28)} → ${IP}  ${want.proxied ? "🟠" : "⚪"}`);
      unchanged++;
      continue;
    }

    console.log(`~ UPDATE  ${want.name.padEnd(28)} ${existing.content}→${IP}  proxied:${existing.proxied}→${want.proxied}`);
    if (!DRY_RUN) await cf("PUT", `/zones/${ZONE_ID}/dns_records/${existing.id}`, desired);
    updated++;
  }

  console.log();
  console.log(`✅ Done. created=${created} updated=${updated} unchanged=${unchanged} total=${RECORDS.length}`);
  if (DRY_RUN) console.log("ℹ️  Dry-run — لا تغييرات فعلية. أعِد التشغيل بدون --dry-run للتطبيق.");
}

main().catch((e) => die(String(e?.message || e)));
