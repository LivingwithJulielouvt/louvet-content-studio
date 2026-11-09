CREATE TABLE `video_renders` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`edit_id` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text NOT NULL,
	`error` text,
	`output_file` text,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
