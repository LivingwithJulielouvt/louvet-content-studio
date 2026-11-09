CREATE TABLE `client_intakes` (
	`client_id` text PRIMARY KEY NOT NULL,
	`answers` text NOT NULL,
	`status` text NOT NULL,
	`revision` integer NOT NULL,
	`author` text NOT NULL,
	`language` text NOT NULL,
	`submitted_at` text,
	`reviewed_by` text,
	`reviewed_at` text,
	`review_note` text,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
