CREATE TABLE `public_subscription_nonces` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`ip_hash` text NOT NULL,
	`created` text NOT NULL,
	`claimed_request` text
);
--> statement-breakpoint
CREATE INDEX `public_subscription_nonce_created` ON `public_subscription_nonces` (`created`);--> statement-breakpoint
CREATE TABLE `public_subscription_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`request_key` text NOT NULL,
	`first_name` text NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`workspace_type` text NOT NULL,
	`language` text NOT NULL,
	`answers` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`consent_at` text NOT NULL,
	`created` text NOT NULL,
	`ip_hash` text NOT NULL,
	`mail_status` text DEFAULT 'held' NOT NULL,
	`copy_version` text NOT NULL,
	`provider_id` text,
	`mail_error` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `public_subscription_request_key` ON `public_subscription_requests` (`request_key`);--> statement-breakpoint
CREATE INDEX `public_subscription_created` ON `public_subscription_requests` (`created`);--> statement-breakpoint
CREATE INDEX `public_subscription_email` ON `public_subscription_requests` (`email`,`created`);