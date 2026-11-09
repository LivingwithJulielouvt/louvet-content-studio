CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`client_id` text,
	`active` integer DEFAULT 1 NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `audit` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text,
	`author` text NOT NULL,
	`action` text NOT NULL,
	`target` text NOT NULL,
	`detail` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`code_hash` text NOT NULL,
	`config` text NOT NULL,
	`quota_limit` integer DEFAULT 30 NOT NULL,
	`quota_used` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `corrections` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`job_id` text NOT NULL,
	`task_id` text NOT NULL,
	`comment` text NOT NULL,
	`permanent` integer NOT NULL,
	`status` text NOT NULL,
	`new_job_id` text,
	`author` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`product_id` text,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`width` integer,
	`height` integer,
	`purpose` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`user_id` text NOT NULL,
	`product_id` text NOT NULL,
	`recipe_id` text NOT NULL,
	`request_key` text NOT NULL,
	`status` text NOT NULL,
	`config` text NOT NULL,
	`parent_id` text,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jobs_user_request_unique` ON `jobs` (`user_id`,`request_key`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`job_id` text,
	`message` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`preserve` text NOT NULL,
	`commercial` text NOT NULL,
	`brand` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `recipes` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`name` text NOT NULL,
	`config` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rules` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`product_id` text NOT NULL,
	`rule` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`source` text NOT NULL,
	`author` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`job_id` text NOT NULL,
	`kind` text NOT NULL,
	`ordinal` integer NOT NULL,
	`status` text NOT NULL,
	`provider_id` text,
	`output_file` text,
	`caption` text,
	`quota_cost` integer NOT NULL,
	`settled` integer DEFAULT 0 NOT NULL,
	`error` text,
	`usage` text,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
