CREATE TABLE `portfolio_alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`position_id` text NOT NULL,
	`document_hash` text NOT NULL,
	`is_read` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`position_id`) REFERENCES `portfolio_positions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`document_hash`) REFERENCES `source_snapshots`(`document_hash`) ON UPDATE no action ON DELETE cascade
);
