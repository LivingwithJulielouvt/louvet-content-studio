CREATE TABLE `billing_accounts` (
	`client_id` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT 0 NOT NULL,
	`price_id` text,
	`customer_id` text,
	`subscription_id` text,
	`stripe_mode` text,
	`status` text DEFAULT 'not_started' NOT NULL,
	`period_start` integer DEFAULT 0 NOT NULL,
	`period_end` integer DEFAULT 0 NOT NULL,
	`paid_until` integer DEFAULT 0 NOT NULL,
	`delinquent_since` integer,
	`grace_days` integer DEFAULT 3 NOT NULL,
	`monthly_credits` integer DEFAULT 30 NOT NULL,
	`override_until` integer,
	`override_reason` text,
	`quota_period_start` integer DEFAULT 0 NOT NULL,
	`synced_at` integer DEFAULT 0 NOT NULL,
	`sync_error` text,
	`checkout_id` text,
	`checkout_attempt` text,
	`checkout_expires` integer DEFAULT 0 NOT NULL,
	`customer_attempt_at` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `billing_customer_unique` ON `billing_accounts` (`customer_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `billing_subscription_unique` ON `billing_accounts` (`subscription_id`);--> statement-breakpoint
CREATE TABLE `billing_events` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`client_id` text,
	`status` text NOT NULL,
	`updated` integer NOT NULL
);
