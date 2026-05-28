-- SOUQRATES SYSTEM — Complete schema for Supabase
-- Apply this in Supabase Dashboard → SQL Editor → New query → Run
-- Safe to run on empty DB. Tables wrapped in IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS "users" (
    "id" serial PRIMARY KEY NOT NULL,
    "telegram_id" bigint NOT NULL,
    "username" text,
    "first_name" text NOT NULL,
    "last_name" text,
    "language_code" text DEFAULT 'ar',
    "is_premium" boolean DEFAULT false,
    "is_blocked" boolean DEFAULT false,
    "referrer_id" integer,
    "xp" integer DEFAULT 0 NOT NULL,
    "level" integer DEFAULT 1 NOT NULL,
    "total_games_played" integer DEFAULT 0 NOT NULL,
    "total_games_won" integer DEFAULT 0 NOT NULL,
    "created_at" timestamptz DEFAULT now() NOT NULL,
    "updated_at" timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT "users_telegram_id_unique" UNIQUE("telegram_id")
);

CREATE TABLE IF NOT EXISTS "wallets" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer NOT NULL,
    "balance_skz" numeric(18,2) DEFAULT '0' NOT NULL,
    "referral_balance_skz" numeric(18,2) DEFAULT '0' NOT NULL,
    "total_earned_from_referrals_skz" numeric(18,2) DEFAULT '0' NOT NULL,
    "balance_stars" numeric(18,0) DEFAULT '0' NOT NULL,
    "balance_usdt" numeric(18,6) DEFAULT '0' NOT NULL,
    "balance_ton" numeric(18,9) DEFAULT '0' NOT NULL,
    "total_earned_skz" numeric(18,2) DEFAULT '0' NOT NULL,
    "total_withdrawn_skz" numeric(18,2) DEFAULT '0' NOT NULL,
    "total_earned" numeric(18,6) DEFAULT '0' NOT NULL,
    "total_withdrawn" numeric(18,6) DEFAULT '0' NOT NULL,
    "updated_at" timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT "wallets_user_id_unique" UNIQUE("user_id")
);

CREATE TABLE IF NOT EXISTS "transactions" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer NOT NULL,
    "type" text NOT NULL,
    "currency" text NOT NULL,
    "amount" numeric(18,9) NOT NULL,
    "fee" numeric(18,9) DEFAULT '0' NOT NULL,
    "status" text DEFAULT 'pending' NOT NULL,
    "source_bot" text,
    "reference_id" text,
    "idempotency_key" text,
    "description" text,
    "metadata" text,
    "created_at" timestamptz DEFAULT now() NOT NULL,
    "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "bots" (
    "id" serial PRIMARY KEY NOT NULL,
    "slug" text NOT NULL,
    "name" text NOT NULL,
    "description" text,
    "commission_rate" numeric(5,4) DEFAULT '0.1000' NOT NULL,
    "is_active" boolean DEFAULT true,
    "api_key" text NOT NULL,
    "webhook_secret" text NOT NULL,
    "total_volume_usdt" numeric(18,6) DEFAULT '0' NOT NULL,
    "total_commission_usdt" numeric(18,6) DEFAULT '0' NOT NULL,
    "created_at" timestamptz DEFAULT now() NOT NULL,
    "updated_at" timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT "bots_slug_unique" UNIQUE("slug"),
    CONSTRAINT "bots_api_key_unique" UNIQUE("api_key")
);

CREATE TABLE IF NOT EXISTS "commissions" (
    "id" serial PRIMARY KEY NOT NULL,
    "transaction_id" integer NOT NULL,
    "bot_slug" text NOT NULL,
    "user_id" integer NOT NULL,
    "game_id" integer,
    "gross_amount" numeric(18,9) NOT NULL,
    "commission_rate" numeric(5,4) NOT NULL,
    "commission_amount" numeric(18,9) NOT NULL,
    "net_amount" numeric(18,9) NOT NULL,
    "currency" text NOT NULL,
    "status" text DEFAULT 'settled' NOT NULL,
    "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "withdrawals" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer NOT NULL,
    "currency" text NOT NULL,
    "amount" numeric(18,9) NOT NULL,
    "fee" numeric(18,9) DEFAULT '0' NOT NULL,
    "net_amount" numeric(18,9) NOT NULL,
    "method" text NOT NULL,
    "address" text,
    "tx_hash" text,
    "status" text DEFAULT 'pending' NOT NULL,
    "processed_at" timestamptz,
    "rejected_reason" text,
    "created_at" timestamptz DEFAULT now() NOT NULL,
    "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "platform_settings" (
    "id" serial PRIMARY KEY NOT NULL,
    "key" text NOT NULL,
    "value" text NOT NULL,
    "description" text,
    "updated_at" timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT "platform_settings_key_unique" UNIQUE("key")
);

CREATE TABLE IF NOT EXISTS "commission_overrides" (
    "id" serial PRIMARY KEY NOT NULL,
    "telegram_id" bigint NOT NULL,
    "bot_slug" text NOT NULL,
    "commission_rate" numeric(5,4) NOT NULL,
    "note" text,
    "created_at" timestamptz DEFAULT now() NOT NULL,
    "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "bot_texts" (
    "id" serial PRIMARY KEY NOT NULL,
    "bot_slug" text NOT NULL,
    "key" text NOT NULL,
    "label" text NOT NULL,
    "draft_value" text DEFAULT '' NOT NULL,
    "published_value" text DEFAULT '' NOT NULL,
    "created_at" timestamptz DEFAULT now() NOT NULL,
    "updated_at" timestamptz DEFAULT now() NOT NULL,
    "published_at" timestamptz
);

CREATE TABLE IF NOT EXISTS "broadcasts" (
    "id" serial PRIMARY KEY NOT NULL,
    "bot_slug" text DEFAULT 'mother-bot' NOT NULL,
    "audience" text NOT NULL,
    "target_value" text,
    "body" text NOT NULL,
    "status" text DEFAULT 'pending' NOT NULL,
    "sent_count" integer DEFAULT 0 NOT NULL,
    "failed_count" integer DEFAULT 0 NOT NULL,
    "total_count" integer DEFAULT 0 NOT NULL,
    "error" text,
    "created_by" text DEFAULT 'superadmin' NOT NULL,
    "created_at" timestamptz DEFAULT now() NOT NULL,
    "started_at" timestamptz,
    "completed_at" timestamptz
);

CREATE TABLE IF NOT EXISTS "external_links" (
    "id" serial PRIMARY KEY NOT NULL,
    "key" text NOT NULL,
    "label" text NOT NULL,
    "url" text NOT NULL,
    "category" text DEFAULT 'general' NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "notes" text,
    "created_at" timestamptz DEFAULT now() NOT NULL,
    "updated_at" timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT "external_links_key_unique" UNIQUE("key")
);

CREATE TABLE IF NOT EXISTS "error_logs" (
    "id" serial PRIMARY KEY NOT NULL,
    "source" text NOT NULL,
    "level" text DEFAULT 'error' NOT NULL,
    "message" text NOT NULL,
    "stack" text,
    "metadata" jsonb,
    "user_telegram_id" bigint,
    "resolved" boolean DEFAULT false NOT NULL,
    "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "game_configs" (
    "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    "game_id" integer NOT NULL,
    "name" text NOT NULL,
    "emoji" text DEFAULT '' NOT NULL,
    "difficulty" text DEFAULT 'Medium' NOT NULL,
    "color" text DEFAULT '' NOT NULL,
    "draft_is_visible" boolean DEFAULT true NOT NULL,
    "draft_image_url" text DEFAULT '' NOT NULL,
    "draft_description" text DEFAULT '' NOT NULL,
    "draft_entry_fee" numeric(18,4) DEFAULT '10' NOT NULL,
    "draft_win_amount" numeric(18,4) DEFAULT '30' NOT NULL,
    "draft_target_score" integer DEFAULT 0 NOT NULL,
    "draft_max_score" integer DEFAULT 0 NOT NULL,
    "draft_score_per_correct" integer DEFAULT 1 NOT NULL,
    "draft_score_per_wrong" integer DEFAULT 0 NOT NULL,
    "draft_duration_seconds" integer DEFAULT 60 NOT NULL,
    "draft_price_tiers" jsonb DEFAULT '[]' NOT NULL,
    "draft_texts" jsonb DEFAULT '{}' NOT NULL,
    "draft_params" jsonb DEFAULT '{}' NOT NULL,
    "published_is_visible" boolean DEFAULT true NOT NULL,
    "published_image_url" text DEFAULT '' NOT NULL,
    "published_description" text DEFAULT '' NOT NULL,
    "published_entry_fee" numeric(18,4) DEFAULT '10' NOT NULL,
    "published_win_amount" numeric(18,4) DEFAULT '30' NOT NULL,
    "published_target_score" integer DEFAULT 0 NOT NULL,
    "published_max_score" integer DEFAULT 0 NOT NULL,
    "published_score_per_correct" integer DEFAULT 1 NOT NULL,
    "published_score_per_wrong" integer DEFAULT 0 NOT NULL,
    "published_duration_seconds" integer DEFAULT 60 NOT NULL,
    "published_price_tiers" jsonb DEFAULT '[]' NOT NULL,
    "published_texts" jsonb DEFAULT '{}' NOT NULL,
    "published_params" jsonb DEFAULT '{}' NOT NULL,
    "has_unpublished_changes" boolean DEFAULT false NOT NULL,
    "created_at" timestamptz DEFAULT now() NOT NULL,
    "updated_at" timestamptz DEFAULT now() NOT NULL,
    "published_at" timestamptz
);

CREATE TABLE IF NOT EXISTS "agreement_settings" (
    "id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
    "content" text NOT NULL,
    "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "agreement_signatures" (
    "id" serial PRIMARY KEY NOT NULL,
    "name" text NOT NULL,
    "email" text NOT NULL,
    "phone" text,
    "notes" text,
    "signature_data_url" text NOT NULL,
    "agreement_content" text NOT NULL,
    "ip_address" text,
    "user_agent" text,
    "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "digital_products" (
    "id" serial PRIMARY KEY NOT NULL,
    "publisher_telegram_id" bigint NOT NULL,
    "category_id" integer,
    "title" text NOT NULL,
    "description" text DEFAULT '' NOT NULL,
    "cover_url" text,
    "file_url" text NOT NULL,
    "file_size" integer DEFAULT 0 NOT NULL,
    "price_usdt" numeric(18,6) NOT NULL,
    "status" text DEFAULT 'pending' NOT NULL,
    "rejection_reason" text,
    "sales_count" integer DEFAULT 0 NOT NULL,
    "rating" numeric(3,2) DEFAULT '0' NOT NULL,
    "rating_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamptz DEFAULT now() NOT NULL,
    "approved_at" timestamptz,
    "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "product_categories" (
    "id" serial PRIMARY KEY NOT NULL,
    "slug" text NOT NULL,
    "name_ar" text NOT NULL,
    "icon" text DEFAULT '📚' NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "product_purchases" (
    "id" serial PRIMARY KEY NOT NULL,
    "product_id" integer NOT NULL,
    "buyer_telegram_id" bigint NOT NULL,
    "price_paid" numeric(18,6) NOT NULL,
    "commission_amount" numeric(18,6) NOT NULL,
    "net_to_publisher" numeric(18,6) NOT NULL,
    "transaction_id" integer,
    "download_token" text NOT NULL,
    "download_expires_at" timestamptz NOT NULL,
    "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "contestants" (
    "id" serial PRIMARY KEY NOT NULL,
    "contest_id" integer NOT NULL,
    "name" text NOT NULL,
    "bio" text DEFAULT '' NOT NULL,
    "photo_url" text,
    "vote_count" integer DEFAULT 0 NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_disqualified" boolean DEFAULT false NOT NULL,
    "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "contests" (
    "id" serial PRIMARY KEY NOT NULL,
    "title" text NOT NULL,
    "description" text DEFAULT '' NOT NULL,
    "cover_url" text,
    "status" text DEFAULT 'draft' NOT NULL,
    "starts_at" timestamptz,
    "ends_at" timestamptz,
    "total_votes" integer DEFAULT 0 NOT NULL,
    "created_at" timestamptz DEFAULT now() NOT NULL,
    "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "daily_free_vote_usage" (
    "id" serial PRIMARY KEY NOT NULL,
    "telegram_id" bigint NOT NULL,
    "vote_date_utc" text NOT NULL,
    "contest_id" integer NOT NULL,
    "vote_id" integer,
    "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "vote_grants" (
    "id" serial PRIMARY KEY NOT NULL,
    "telegram_id" bigint NOT NULL,
    "source" text NOT NULL,
    "pack_id" integer,
    "ref_id" text,
    "votes_granted" integer NOT NULL,
    "votes_used" integer DEFAULT 0 NOT NULL,
    "price_paid" numeric(18,2) DEFAULT '0' NOT NULL,
    "bonus_file_url" text,
    "bonus_file_name" text,
    "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "vote_packs" (
    "id" serial PRIMARY KEY NOT NULL,
    "name" text NOT NULL,
    "description" text DEFAULT '' NOT NULL,
    "votes" integer NOT NULL,
    "bonus_votes" integer DEFAULT 0 NOT NULL,
    "price_skz" numeric(18,2) NOT NULL,
    "bonus_file_url" text,
    "bonus_file_name" text,
    "bonus_description" text,
    "cover_url" text,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamptz DEFAULT now() NOT NULL,
    "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "votes" (
    "id" serial PRIMARY KEY NOT NULL,
    "contest_id" integer NOT NULL,
    "contestant_id" integer NOT NULL,
    "voter_telegram_id" bigint NOT NULL,
    "vote_count" integer NOT NULL,
    "source" text NOT NULL,
    "grant_id" integer,
    "ip_hash" text,
    "is_void" boolean DEFAULT false NOT NULL,
    "voided_at" timestamptz,
    "void_reason" text,
    "created_at" timestamptz DEFAULT now() NOT NULL
);

-- Integrations table (external service configs, encrypted at rest)
CREATE TABLE IF NOT EXISTS "integrations" (
    "slug" text PRIMARY KEY NOT NULL,
    "enabled" boolean DEFAULT false NOT NULL,
    "config" jsonb DEFAULT '{}' NOT NULL,
    "last_test_at" timestamptz,
    "last_test_status" text,
    "last_test_error" text,
    "last_test_metadata" jsonb,
    "updated_at" timestamptz DEFAULT now() NOT NULL
);

-- Sub-agents / partner program
CREATE TABLE IF NOT EXISTS "sub_agents" (
    "id" serial PRIMARY KEY NOT NULL,
    "telegram_id" bigint NOT NULL,
    "full_name" text NOT NULL,
    "dob" date NOT NULL,
    "country" text NOT NULL,
    "phone" text NOT NULL,
    "email" text,
    "address" text NOT NULL,
    "id_photo_path" text NOT NULL,
    "status" text DEFAULT 'pending' NOT NULL,
    "tier_level" integer,
    "total_sales_skz" numeric(18,2) DEFAULT '0' NOT NULL,
    "total_customers" integer DEFAULT 0 NOT NULL,
    "approved_at" timestamptz,
    "approved_by" text,
    "rejected_at" timestamptz,
    "rejected_reason" text,
    "notes" text,
    "created_at" timestamptz DEFAULT now() NOT NULL,
    "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "sub_agent_tiers" (
    "level" integer PRIMARY KEY NOT NULL,
    "name" text NOT NULL,
    "color" text DEFAULT '#888' NOT NULL,
    "min_sales_skz" numeric(18,2) DEFAULT '0' NOT NULL,
    "min_customers" integer DEFAULT 0 NOT NULL,
    "discount_rate" numeric(5,4) DEFAULT '0' NOT NULL,
    "perks" jsonb DEFAULT '[]' NOT NULL,
    "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "sub_agent_sales" (
    "id" serial PRIMARY KEY NOT NULL,
    "sub_agent_id" integer NOT NULL,
    "customer_telegram_id" bigint NOT NULL,
    "skz_amount" numeric(18,2) NOT NULL,
    "transaction_id" integer,
    "note" text,
    "idempotency_key" text,
    "created_at" timestamptz DEFAULT now() NOT NULL
);

-- Admin audit log
CREATE TABLE IF NOT EXISTS "admin_audit_log" (
    "id" serial PRIMARY KEY NOT NULL,
    "actor_role" text NOT NULL,
    "actor_token_hash" text,
    "action" text NOT NULL,
    "target_type" text,
    "target_id" text,
    "payload" jsonb,
    "ip" text,
    "user_agent" text,
    "success" integer DEFAULT 1 NOT NULL,
    "error_message" text,
    "created_at" timestamptz DEFAULT now() NOT NULL
);

-- Withdrawal address whitelist (24h cooldown on new addresses)
CREATE TABLE IF NOT EXISTS "withdrawal_addresses" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer NOT NULL,
    "network" text NOT NULL,
    "address" text NOT NULL,
    "label" text,
    "added_at" timestamptz DEFAULT now() NOT NULL,
    "usable_at" timestamptz NOT NULL,
    "revoked_at" timestamptz
);

-- Indexes (CREATE INDEX IF NOT EXISTS is supported in PG12+)
CREATE INDEX IF NOT EXISTS "wallets_user_idx" ON "wallets" ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "tx_idempotency_uniq" ON "transactions" ("source_bot","idempotency_key") WHERE "idempotency_key" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "tx_user_created_idx" ON "transactions" ("user_id","created_at");
CREATE INDEX IF NOT EXISTS "tx_bot_created_idx" ON "transactions" ("source_bot","created_at");
CREATE INDEX IF NOT EXISTS "tx_user_ref_idx" ON "transactions" ("user_id","reference_id");
CREATE UNIQUE INDEX IF NOT EXISTS "commission_overrides_user_bot_uniq" ON "commission_overrides" ("telegram_id","bot_slug");
CREATE UNIQUE INDEX IF NOT EXISTS "bot_texts_bot_key_uniq" ON "bot_texts" ("bot_slug","key");
CREATE UNIQUE INDEX IF NOT EXISTS "game_configs_game_id_uniq" ON "game_configs" ("game_id");
CREATE INDEX IF NOT EXISTS "digital_products_status_idx" ON "digital_products" ("status");
CREATE INDEX IF NOT EXISTS "digital_products_category_idx" ON "digital_products" ("category_id");
CREATE INDEX IF NOT EXISTS "digital_products_publisher_idx" ON "digital_products" ("publisher_telegram_id");
CREATE UNIQUE INDEX IF NOT EXISTS "product_categories_slug_uniq" ON "product_categories" ("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "product_purchases_token_uniq" ON "product_purchases" ("download_token");
CREATE INDEX IF NOT EXISTS "product_purchases_buyer_idx" ON "product_purchases" ("buyer_telegram_id");
CREATE INDEX IF NOT EXISTS "product_purchases_product_idx" ON "product_purchases" ("product_id");
CREATE INDEX IF NOT EXISTS "contestants_contest_idx" ON "contestants" ("contest_id");
CREATE INDEX IF NOT EXISTS "contests_status_idx" ON "contests" ("status");
CREATE UNIQUE INDEX IF NOT EXISTS "contests_one_active_uniq" ON "contests" ("status") WHERE status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS "daily_free_vote_user_date_uniq" ON "daily_free_vote_usage" ("telegram_id","vote_date_utc");
CREATE INDEX IF NOT EXISTS "vote_grants_user_idx" ON "vote_grants" ("telegram_id");
CREATE INDEX IF NOT EXISTS "votes_contest_idx" ON "votes" ("contest_id");
CREATE INDEX IF NOT EXISTS "votes_contestant_idx" ON "votes" ("contestant_id");
CREATE INDEX IF NOT EXISTS "votes_voter_idx" ON "votes" ("voter_telegram_id");
CREATE INDEX IF NOT EXISTS "votes_created_idx" ON "votes" ("created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "sub_agents_telegram_id_uniq" ON "sub_agents" ("telegram_id");
CREATE INDEX IF NOT EXISTS "sub_agents_status_idx" ON "sub_agents" ("status");
CREATE INDEX IF NOT EXISTS "sub_agent_sales_agent_idx" ON "sub_agent_sales" ("sub_agent_id");
CREATE INDEX IF NOT EXISTS "sub_agent_sales_customer_idx" ON "sub_agent_sales" ("customer_telegram_id");
CREATE UNIQUE INDEX IF NOT EXISTS "sub_agent_sales_agent_idem_uniq" ON "sub_agent_sales" ("sub_agent_id","idempotency_key") WHERE "idempotency_key" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "audit_created_idx" ON "admin_audit_log" ("created_at");
CREATE INDEX IF NOT EXISTS "audit_action_idx" ON "admin_audit_log" ("action");
CREATE INDEX IF NOT EXISTS "audit_target_idx" ON "admin_audit_log" ("target_type","target_id");
CREATE UNIQUE INDEX IF NOT EXISTS "withdrawal_addresses_user_net_addr_uniq" ON "withdrawal_addresses" ("user_id","network","address");
CREATE INDEX IF NOT EXISTS "withdrawal_addresses_user_idx" ON "withdrawal_addresses" ("user_id");

-- Seed 7 sub-agent tiers with default thresholds
INSERT INTO "sub_agent_tiers" ("level","name","color","min_sales_skz","min_customers","discount_rate","perks")
VALUES
  (1,'برونز','#CD7F32','0','0','0.02','[]'),
  (2,'فضة','#C0C0C0','5000','10','0.04','[]'),
  (3,'ذهب','#FFD700','15000','30','0.06','[]'),
  (4,'بلاتين','#E5E4E2','35000','75','0.08','[]'),
  (5,'ماسي','#B9F2FF','75000','150','0.10','[]'),
  (6,'نجم','#FF6B35','150000','300','0.13','[]'),
  (7,'أسطوري','#9B59B6','300000','600','0.16','[]')
ON CONFLICT (level) DO NOTHING;
