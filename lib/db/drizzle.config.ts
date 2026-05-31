import { defineConfig } from "drizzle-kit";
import path from "path";

const resolvedDbUrl = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;

if (!resolvedDbUrl) {
  throw new Error("Neither POSTGRES_URL nor DATABASE_URL is set. Ensure the database is provisioned.");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  out: path.join(__dirname, "./migrations"),
  dialect: "postgresql",
  dbCredentials: {
    url: resolvedDbUrl,
  },
  tablesFilter: [
    "users",
    "wallets",
    "transactions",
    "bots",
    "commissions",
    "withdrawals",
    "platform_settings",
    "commission_overrides",
    "bot_texts",
    "broadcasts",
    "external_links",
    "error_logs",
    "game_configs",
    "agreement_settings",
    "agreement_signatures",
    "digital_products",
    "product_categories",
    "product_purchases",
    "contests",
    "contestants",
    "vote_packs",
    "vote_grants",
    "votes",
    "daily_free_vote_usage",
    "withdrawal_addresses",
    "admin_audit_log",
    "integrations",
    "sub_agents",
    "sub_agent_tiers",
    "sub_agent_sales",
  ],
});
