-- Louvet Content Studio: version Postgres issue des 12 migrations SQLite de la source 2026-10-16.
-- À exécuter UNE FOIS dans SQL Editor du projet Supabase, AVANT le déploiement.
-- Migration de STRUCTURE uniquement; ne migre aucune donnée client D1/R2.
BEGIN;
CREATE TABLE IF NOT EXISTS public."accounts" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "client_id" TEXT,
    "active" BIGINT DEFAULT 1 NOT NULL,
    "created" TEXT NOT NULL,
    PRIMARY KEY ("id")
);
ALTER TABLE public."accounts" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."accounts" FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS public."audit" (
    "id" TEXT NOT NULL,
    "client_id" TEXT,
    "author" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "created" TEXT NOT NULL,
    PRIMARY KEY ("id")
);
ALTER TABLE public."audit" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."audit" FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS public."beta_feedback" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "client_id" TEXT,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "request_key" TEXT NOT NULL,
    "created" TEXT NOT NULL,
    PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "beta_feedback_request_unique" ON public."beta_feedback" ("user_id", "request_key");
ALTER TABLE public."beta_feedback" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."beta_feedback" FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS public."beta_invites" (
    "client_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "claimed_by" TEXT,
    "claimed_at" TEXT,
    "expires_at" TEXT NOT NULL,
    PRIMARY KEY ("client_id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "beta_invite_claim_unique" ON public."beta_invites" ("claimed_by");
CREATE UNIQUE INDEX IF NOT EXISTS "beta_invite_token_unique" ON public."beta_invites" ("token_hash");
ALTER TABLE public."beta_invites" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."beta_invites" FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS public."beta_usage" (
    "client_id" TEXT NOT NULL,
    "image_attempts" BIGINT DEFAULT 0 NOT NULL,
    PRIMARY KEY ("client_id")
);
ALTER TABLE public."beta_usage" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."beta_usage" FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS public."billing_accounts" (
    "client_id" TEXT NOT NULL,
    "enabled" BIGINT DEFAULT 0 NOT NULL,
    "price_id" TEXT,
    "customer_id" TEXT,
    "subscription_id" TEXT,
    "stripe_mode" TEXT,
    "status" TEXT DEFAULT 'not_started' NOT NULL,
    "period_start" BIGINT DEFAULT 0 NOT NULL,
    "period_end" BIGINT DEFAULT 0 NOT NULL,
    "paid_until" BIGINT DEFAULT 0 NOT NULL,
    "delinquent_since" BIGINT,
    "grace_days" BIGINT DEFAULT 3 NOT NULL,
    "monthly_credits" BIGINT DEFAULT 30 NOT NULL,
    "override_until" BIGINT,
    "override_reason" TEXT,
    "quota_period_start" BIGINT DEFAULT 0 NOT NULL,
    "synced_at" BIGINT DEFAULT 0 NOT NULL,
    "sync_error" TEXT,
    "checkout_id" TEXT,
    "checkout_attempt" TEXT,
    "checkout_expires" BIGINT DEFAULT 0 NOT NULL,
    "customer_attempt_at" BIGINT DEFAULT 0 NOT NULL,
    "version" BIGINT DEFAULT 1 NOT NULL,
    "updated" TEXT NOT NULL,
    PRIMARY KEY ("client_id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "billing_subscription_unique" ON public."billing_accounts" ("subscription_id");
CREATE UNIQUE INDEX IF NOT EXISTS "billing_customer_unique" ON public."billing_accounts" ("customer_id");
ALTER TABLE public."billing_accounts" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."billing_accounts" FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS public."billing_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "client_id" TEXT,
    "status" TEXT NOT NULL,
    "updated" BIGINT NOT NULL,
    PRIMARY KEY ("id")
);
ALTER TABLE public."billing_events" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."billing_events" FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS public."client_deletions" (
    "client_id" TEXT NOT NULL,
    "requested_by" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "updated" TEXT NOT NULL,
    PRIMARY KEY ("client_id")
);
ALTER TABLE public."client_deletions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."client_deletions" FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS public."client_intakes" (
    "client_id" TEXT NOT NULL,
    "answers" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "revision" BIGINT NOT NULL,
    "author" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "submitted_at" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" TEXT,
    "review_note" TEXT,
    "created" TEXT NOT NULL,
    "updated" TEXT NOT NULL,
    PRIMARY KEY ("client_id")
);
ALTER TABLE public."client_intakes" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."client_intakes" FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS public."client_video_styles" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "style_id" TEXT NOT NULL,
    PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "client_video_styles_unique" ON public."client_video_styles" ("client_id", "style_id");
ALTER TABLE public."client_video_styles" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."client_video_styles" FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS public."clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "config" TEXT NOT NULL,
    "quota_limit" BIGINT DEFAULT 30 NOT NULL,
    "quota_used" BIGINT DEFAULT 0 NOT NULL,
    "active" BIGINT DEFAULT 1 NOT NULL,
    "created" TEXT NOT NULL,
    PRIMARY KEY ("id")
);
ALTER TABLE public."clients" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."clients" FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS public."corrections" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "permanent" BIGINT NOT NULL,
    "status" TEXT NOT NULL,
    "new_job_id" TEXT,
    "author" TEXT NOT NULL,
    "created" TEXT NOT NULL,
    PRIMARY KEY ("id")
);
ALTER TABLE public."corrections" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."corrections" FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS public."custom_occasions" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "angle" TEXT NOT NULL,
    "product_id" TEXT,
    "created" TEXT NOT NULL,
    PRIMARY KEY ("id")
);
ALTER TABLE public."custom_occasions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."custom_occasions" FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS public."email_outbox" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "provider_id" TEXT,
    "created" TEXT NOT NULL,
    "updated" TEXT NOT NULL,
    "kind" TEXT DEFAULT 'welcome' NOT NULL,
    "language" TEXT DEFAULT 'fr' NOT NULL,
    "copy_version" TEXT DEFAULT 'legacy' NOT NULL,
    "account_id" TEXT,
    "week_key" TEXT,
    "content" TEXT DEFAULT '{}' NOT NULL,
    PRIMARY KEY ("id")
);
ALTER TABLE public."email_outbox" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."email_outbox" FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS public."files" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "product_id" TEXT,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" BIGINT NOT NULL,
    "width" BIGINT,
    "height" BIGINT,
    "purpose" TEXT NOT NULL,
    "created" TEXT NOT NULL,
    PRIMARY KEY ("id")
);
ALTER TABLE public."files" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."files" FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS public."intake_tests" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "answers" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "revision" BIGINT NOT NULL,
    "updated" TEXT NOT NULL,
    PRIMARY KEY ("id")
);
ALTER TABLE public."intake_tests" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."intake_tests" FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS public."jobs" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "recipe_id" TEXT NOT NULL,
    "request_key" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "config" TEXT NOT NULL,
    "parent_id" TEXT,
    "created" TEXT NOT NULL,
    "updated" TEXT NOT NULL,
    PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "jobs_user_request_unique" ON public."jobs" ("user_id", "request_key");
ALTER TABLE public."jobs" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."jobs" FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS public."notifications" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "job_id" TEXT,
    "message" TEXT NOT NULL,
    "created" TEXT NOT NULL,
    PRIMARY KEY ("id")
);
ALTER TABLE public."notifications" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."notifications" FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS public."products" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "preserve" TEXT NOT NULL,
    "commercial" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "created" TEXT NOT NULL,
    PRIMARY KEY ("id")
);
ALTER TABLE public."products" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."products" FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS public."public_subscription_nonces" (
    "token_hash" TEXT NOT NULL,
    "ip_hash" TEXT NOT NULL,
    "created" TEXT NOT NULL,
    "claimed_request" TEXT,
    "identity_id" TEXT,
    PRIMARY KEY ("token_hash")
);
CREATE INDEX IF NOT EXISTS "public_subscription_nonce_created" ON public."public_subscription_nonces" ("created");
ALTER TABLE public."public_subscription_nonces" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."public_subscription_nonces" FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS public."public_subscription_requests" (
    "id" TEXT NOT NULL,
    "request_key" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "workspace_type" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "answers" TEXT NOT NULL,
    "status" TEXT DEFAULT 'pending' NOT NULL,
    "consent_at" TEXT NOT NULL,
    "created" TEXT NOT NULL,
    "ip_hash" TEXT NOT NULL,
    "mail_status" TEXT DEFAULT 'held' NOT NULL,
    "copy_version" TEXT NOT NULL,
    "provider_id" TEXT,
    "mail_error" TEXT,
    "identity_id" TEXT,
    PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "public_subscription_email" ON public."public_subscription_requests" ("email", "created");
CREATE INDEX IF NOT EXISTS "public_subscription_created" ON public."public_subscription_requests" ("created");
CREATE UNIQUE INDEX IF NOT EXISTS "public_subscription_request_key" ON public."public_subscription_requests" ("request_key");
ALTER TABLE public."public_subscription_requests" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."public_subscription_requests" FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS public."publication_posts" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "file_id" TEXT,
    "published" BIGINT DEFAULT 0 NOT NULL,
    "points_award" BIGINT,
    "version" BIGINT DEFAULT 1 NOT NULL,
    "deleted" BIGINT DEFAULT 0 NOT NULL,
    "created" TEXT NOT NULL,
    "updated" TEXT NOT NULL,
    PRIMARY KEY ("id")
);
ALTER TABLE public."publication_posts" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."publication_posts" FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS public."recipes" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" TEXT NOT NULL,
    "active" BIGINT DEFAULT 1 NOT NULL,
    "created" TEXT NOT NULL,
    PRIMARY KEY ("id")
);
ALTER TABLE public."recipes" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."recipes" FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS public."registration_profiles" (
    "client_id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "created" TEXT NOT NULL,
    PRIMARY KEY ("client_id")
);
ALTER TABLE public."registration_profiles" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."registration_profiles" FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS public."reward_events" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "delta" BIGINT NOT NULL,
    "title" TEXT NOT NULL,
    "created" TEXT NOT NULL,
    PRIMARY KEY ("id")
);
ALTER TABLE public."reward_events" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."reward_events" FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS public."rules" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "rule" TEXT NOT NULL,
    "active" BIGINT DEFAULT 1 NOT NULL,
    "source" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "created" TEXT NOT NULL,
    PRIMARY KEY ("id")
);
ALTER TABLE public."rules" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."rules" FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS public."studio_mail_facts" (
    "id" TEXT NOT NULL,
    "text_fr" TEXT NOT NULL,
    "text_es" TEXT NOT NULL,
    "source_title" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "source_date" TEXT NOT NULL,
    "approved" BIGINT DEFAULT 0 NOT NULL,
    "created" TEXT NOT NULL,
    "updated" TEXT NOT NULL,
    PRIMARY KEY ("id")
);
ALTER TABLE public."studio_mail_facts" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."studio_mail_facts" FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS public."studio_mail_members" (
    "account_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "weekly_opt_in" BIGINT DEFAULT 0 NOT NULL,
    "sync_status" TEXT DEFAULT 'pending' NOT NULL,
    "updated" TEXT NOT NULL,
    PRIMARY KEY ("account_id")
);
ALTER TABLE public."studio_mail_members" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."studio_mail_members" FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS public."studio_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated" TEXT NOT NULL,
    PRIMARY KEY ("key")
);
ALTER TABLE public."studio_settings" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."studio_settings" FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS public."tasks" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "ordinal" BIGINT NOT NULL,
    "status" TEXT NOT NULL,
    "provider_id" TEXT,
    "output_file" TEXT,
    "caption" TEXT,
    "quota_cost" BIGINT NOT NULL,
    "settled" BIGINT DEFAULT 0 NOT NULL,
    "error" TEXT,
    "usage" TEXT,
    "created" TEXT NOT NULL,
    "updated" TEXT NOT NULL,
    PRIMARY KEY ("id")
);
ALTER TABLE public."tasks" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."tasks" FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS public."video_edits" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "idea_id" TEXT,
    "user_id" TEXT NOT NULL,
    "request_key" TEXT NOT NULL,
    "brief" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "clips" TEXT NOT NULL,
    "output_file" TEXT,
    "created" TEXT NOT NULL,
    "updated" TEXT NOT NULL,
    PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "video_edits_user_request" ON public."video_edits" ("user_id", "request_key");
ALTER TABLE public."video_edits" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."video_edits" FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS public."video_ideas" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "slot" BIGINT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "updated" TEXT NOT NULL,
    PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "video_ideas_plan_slot" ON public."video_ideas" ("plan_id", "slot");
ALTER TABLE public."video_ideas" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."video_ideas" FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS public."video_plans" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "created" TEXT NOT NULL,
    PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "video_plans_client_month" ON public."video_plans" ("client_id", "month");
ALTER TABLE public."video_plans" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."video_plans" FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS public."video_renders" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "edit_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "output_file" TEXT,
    "created" TEXT NOT NULL,
    "updated" TEXT NOT NULL,
    PRIMARY KEY ("id")
);
ALTER TABLE public."video_renders" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."video_renders" FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS public."video_styles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "config" TEXT NOT NULL,
    "active" BIGINT DEFAULT 1 NOT NULL,
    "created" TEXT NOT NULL,
    "updated" TEXT NOT NULL,
    PRIMARY KEY ("id")
);
ALTER TABLE public."video_styles" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."video_styles" FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS public.upload_intents (
 id TEXT PRIMARY KEY, client_id TEXT NOT NULL, user_id TEXT NOT NULL,
 object_key TEXT UNIQUE NOT NULL, kind TEXT NOT NULL, context TEXT NOT NULL,
 filename TEXT NOT NULL, mime TEXT NOT NULL, expected_size BIGINT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending', created TEXT NOT NULL, expires TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS upload_intents_user_created ON public.upload_intents(user_id,created);
ALTER TABLE public.upload_intents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.upload_intents FROM PUBLIC, anon, authenticated;
COMMIT;
