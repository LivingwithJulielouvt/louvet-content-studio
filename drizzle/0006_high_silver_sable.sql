CREATE TABLE `email_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`recipient` text NOT NULL,
	`first_name` text NOT NULL,
	`status` text NOT NULL,
	`error` text,
	`provider_id` text,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `intake_tests` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`admin_id` text NOT NULL,
	`answers` text NOT NULL,
	`status` text NOT NULL,
	`revision` integer NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `publication_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`date` text NOT NULL,
	`platform` text NOT NULL,
	`title` text NOT NULL,
	`caption` text NOT NULL,
	`file_id` text,
	`published` integer DEFAULT 0 NOT NULL,
	`points_award` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`deleted` integer DEFAULT 0 NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `registration_profiles` (
	`client_id` text PRIMARY KEY NOT NULL,
	`first_name` text NOT NULL,
	`email` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reward_events` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`post_id` text NOT NULL,
	`delta` integer NOT NULL,
	`title` text NOT NULL,
	`created` text NOT NULL
);
