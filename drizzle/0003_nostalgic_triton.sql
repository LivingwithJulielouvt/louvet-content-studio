CREATE TABLE `client_video_styles` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`style_id` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `client_video_styles_unique` ON `client_video_styles` (`client_id`,`style_id`);--> statement-breakpoint
CREATE TABLE `video_styles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`config` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
