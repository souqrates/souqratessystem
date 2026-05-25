CREATE TABLE "users" (
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
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_telegram_id_unique" UNIQUE("telegram_id")
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"balance_skz" numeric(18, 2) DEFAULT '0' NOT NULL,
	"referral_balance_skz" numeric(18, 2) DEFAULT '0' NOT NULL,
	"total_earned_from_referrals_skz" numeric(18, 2) DEFAULT '0' NOT NULL,
	"balance_stars" numeric(18, 0) DEFAULT '0' NOT NULL,
	"balance_usdt" numeric(18, 6) DEFAULT '0' NOT NULL,
	"balance_ton" numeric(18, 9) DEFAULT '0' NOT NULL,
	"total_earned_skz" numeric(18, 2) DEFAULT '0' NOT NULL,
	"total_withdrawn_skz" numeric(18, 2) DEFAULT '0' NOT NULL,
	"total_earned" numeric(18, 6) DEFAULT '0' NOT NULL,
	"total_withdrawn" numeric(18, 6) DEFAULT '0' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallets_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" text NOT NULL,
	"currency" text NOT NULL,
	"amount" numeric(18, 9) NOT NULL,
	"fee" numeric(18, 9) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"source_bot" text,
	"reference_id" text,
	"idempotency_key" text,
	"description" text,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bots" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"commission_rate" numeric(5, 4) DEFAULT '0.1000' NOT NULL,
	"is_active" boolean DEFAULT true,
	"api_key" text NOT NULL,
	"webhook_secret" text NOT NULL,
	"total_volume_usdt" numeric(18, 6) DEFAULT '0' NOT NULL,
	"total_commission_usdt" numeric(18, 6) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bots_slug_unique" UNIQUE("slug"),
	CONSTRAINT "bots_api_key_unique" UNIQUE("api_key")
);
--> statement-breakpoint
CREATE TABLE "commissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"transaction_id" integer NOT NULL,
	"bot_slug" text NOT NULL,
	"user_id" integer NOT NULL,
	"game_id" integer,
	"gross_amount" numeric(18, 9) NOT NULL,
	"commission_rate" numeric(5, 4) NOT NULL,
	"commission_amount" numeric(18, 9) NOT NULL,
	"net_amount" numeric(18, 9) NOT NULL,
	"currency" text NOT NULL,
	"status" text DEFAULT 'settled' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "withdrawals" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"currency" text NOT NULL,
	"amount" numeric(18, 9) NOT NULL,
	"fee" numeric(18, 9) DEFAULT '0' NOT NULL,
	"net_amount" numeric(18, 9) NOT NULL,
	"method" text NOT NULL,
	"address" text,
	"tx_hash" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"processed_at" timestamp with time zone,
	"rejected_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "commission_overrides" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_id" bigint NOT NULL,
	"bot_slug" text NOT NULL,
	"commission_rate" numeric(5, 4) NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bot_texts" (
	"id" serial PRIMARY KEY NOT NULL,
	"bot_slug" text NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"draft_value" text DEFAULT '' NOT NULL,
	"published_value" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "broadcasts" (
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
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "external_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"url" text NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "external_links_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "error_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"level" text DEFAULT 'error' NOT NULL,
	"message" text NOT NULL,
	"stack" text,
	"metadata" jsonb,
	"user_telegram_id" bigint,
	"resolved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_configs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "game_configs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"game_id" integer NOT NULL,
	"name" text NOT NULL,
	"emoji" text DEFAULT '' NOT NULL,
	"difficulty" text DEFAULT 'Medium' NOT NULL,
	"color" text DEFAULT '' NOT NULL,
	"draft_is_visible" boolean DEFAULT true NOT NULL,
	"draft_image_url" text DEFAULT '' NOT NULL,
	"draft_description" text DEFAULT '' NOT NULL,
	"draft_entry_fee" numeric(18, 4) DEFAULT '10' NOT NULL,
	"draft_win_amount" numeric(18, 4) DEFAULT '30' NOT NULL,
	"draft_target_score" integer DEFAULT 0 NOT NULL,
	"draft_max_score" integer DEFAULT 0 NOT NULL,
	"draft_score_per_correct" integer DEFAULT 1 NOT NULL,
	"draft_score_per_wrong" integer DEFAULT 0 NOT NULL,
	"draft_duration_seconds" integer DEFAULT 60 NOT NULL,
	"draft_price_tiers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"draft_texts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"draft_params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"published_is_visible" boolean DEFAULT true NOT NULL,
	"published_image_url" text DEFAULT '' NOT NULL,
	"published_description" text DEFAULT '' NOT NULL,
	"published_entry_fee" numeric(18, 4) DEFAULT '10' NOT NULL,
	"published_win_amount" numeric(18, 4) DEFAULT '30' NOT NULL,
	"published_target_score" integer DEFAULT 0 NOT NULL,
	"published_max_score" integer DEFAULT 0 NOT NULL,
	"published_score_per_correct" integer DEFAULT 1 NOT NULL,
	"published_score_per_wrong" integer DEFAULT 0 NOT NULL,
	"published_duration_seconds" integer DEFAULT 60 NOT NULL,
	"published_price_tiers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"published_texts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"published_params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"has_unpublished_changes" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "agreement_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"content" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agreement_signatures" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"notes" text,
	"signature_data_url" text NOT NULL,
	"agreement_content" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "digital_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"publisher_telegram_id" bigint NOT NULL,
	"category_id" integer,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"cover_url" text,
	"file_url" text NOT NULL,
	"file_size" integer DEFAULT 0 NOT NULL,
	"price_usdt" numeric(18, 6) NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"sales_count" integer DEFAULT 0 NOT NULL,
	"rating" numeric(3, 2) DEFAULT '0' NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name_ar" text NOT NULL,
	"icon" text DEFAULT '📚' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_purchases" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"buyer_telegram_id" bigint NOT NULL,
	"price_paid" numeric(18, 6) NOT NULL,
	"commission_amount" numeric(18, 6) NOT NULL,
	"net_to_publisher" numeric(18, 6) NOT NULL,
	"transaction_id" integer,
	"download_token" text NOT NULL,
	"download_expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contestants" (
	"id" serial PRIMARY KEY NOT NULL,
	"contest_id" integer NOT NULL,
	"name" text NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"photo_url" text,
	"vote_count" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_disqualified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contests" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"cover_url" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"total_votes" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_free_vote_usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_id" bigint NOT NULL,
	"vote_date_utc" text NOT NULL,
	"contest_id" integer NOT NULL,
	"vote_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vote_grants" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_id" bigint NOT NULL,
	"source" text NOT NULL,
	"pack_id" integer,
	"ref_id" text,
	"votes_granted" integer NOT NULL,
	"votes_used" integer DEFAULT 0 NOT NULL,
	"price_paid" numeric(18, 2) DEFAULT '0' NOT NULL,
	"bonus_file_url" text,
	"bonus_file_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vote_packs" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"votes" integer NOT NULL,
	"bonus_votes" integer DEFAULT 0 NOT NULL,
	"price_skz" numeric(18, 2) NOT NULL,
	"bonus_file_url" text,
	"bonus_file_name" text,
	"bonus_description" text,
	"cover_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"contest_id" integer NOT NULL,
	"contestant_id" integer NOT NULL,
	"voter_telegram_id" bigint NOT NULL,
	"vote_count" integer NOT NULL,
	"source" text NOT NULL,
	"grant_id" integer,
	"ip_hash" text,
	"is_void" boolean DEFAULT false NOT NULL,
	"voided_at" timestamp with time zone,
	"void_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "wallets_user_idx" ON "wallets" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tx_idempotency_uniq" ON "transactions" USING btree ("source_bot","idempotency_key") WHERE "transactions"."idempotency_key" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "tx_user_created_idx" ON "transactions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "tx_bot_created_idx" ON "transactions" USING btree ("source_bot","created_at");--> statement-breakpoint
CREATE INDEX "tx_user_ref_idx" ON "transactions" USING btree ("user_id","reference_id");--> statement-breakpoint
CREATE UNIQUE INDEX "commission_overrides_user_bot_uniq" ON "commission_overrides" USING btree ("telegram_id","bot_slug");--> statement-breakpoint
CREATE UNIQUE INDEX "bot_texts_bot_key_uniq" ON "bot_texts" USING btree ("bot_slug","key");--> statement-breakpoint
CREATE UNIQUE INDEX "game_configs_game_id_uniq" ON "game_configs" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "digital_products_status_idx" ON "digital_products" USING btree ("status");--> statement-breakpoint
CREATE INDEX "digital_products_category_idx" ON "digital_products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "digital_products_publisher_idx" ON "digital_products" USING btree ("publisher_telegram_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_categories_slug_uniq" ON "product_categories" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "product_purchases_token_uniq" ON "product_purchases" USING btree ("download_token");--> statement-breakpoint
CREATE INDEX "product_purchases_buyer_idx" ON "product_purchases" USING btree ("buyer_telegram_id");--> statement-breakpoint
CREATE INDEX "product_purchases_product_idx" ON "product_purchases" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "contestants_contest_idx" ON "contestants" USING btree ("contest_id");--> statement-breakpoint
CREATE INDEX "contests_status_idx" ON "contests" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "contests_one_active_uniq" ON "contests" USING btree ("status") WHERE status = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "daily_free_vote_user_date_uniq" ON "daily_free_vote_usage" USING btree ("telegram_id","vote_date_utc");--> statement-breakpoint
CREATE INDEX "vote_grants_user_idx" ON "vote_grants" USING btree ("telegram_id");--> statement-breakpoint
CREATE INDEX "votes_contest_idx" ON "votes" USING btree ("contest_id");--> statement-breakpoint
CREATE INDEX "votes_contestant_idx" ON "votes" USING btree ("contestant_id");--> statement-breakpoint
CREATE INDEX "votes_voter_idx" ON "votes" USING btree ("voter_telegram_id");--> statement-breakpoint
CREATE INDEX "votes_created_idx" ON "votes" USING btree ("created_at");