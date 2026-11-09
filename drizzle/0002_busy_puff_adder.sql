CREATE TABLE `custom_occasions` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`date` text NOT NULL,
	`title` text NOT NULL,
	`angle` text NOT NULL,
	`product_id` text,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `video_edits` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`idea_id` text,
	`user_id` text NOT NULL,
	`request_key` text NOT NULL,
	`brief` text NOT NULL,
	`status` text NOT NULL,
	`clips` text NOT NULL,
	`output_file` text,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `video_edits_user_request` ON `video_edits` (`user_id`,`request_key`);--> statement-breakpoint
CREATE TABLE `video_ideas` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`slot` integer NOT NULL,
	`content` text NOT NULL,
	`status` text NOT NULL,
	`notes` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `video_ideas_plan_slot` ON `video_ideas` (`plan_id`,`slot`);--> statement-breakpoint
CREATE TABLE `video_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`month` text NOT NULL,
	`source` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `video_plans_client_month` ON `video_plans` (`client_id`,`month`);