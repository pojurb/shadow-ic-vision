CREATE TABLE `ingestion_leases` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ingestion_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`trigger` text NOT NULL,
	`status` text NOT NULL,
	`tracked_company_count` integer DEFAULT 0 NOT NULL,
	`new_document_count` integer DEFAULT 0 NOT NULL,
	`error_code` text,
	`error` text,
	`started_at` text NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE TABLE `source_cursors` (
	`market` text NOT NULL,
	`ticker` text NOT NULL,
	`last_publish_date` text,
	`last_document_id` text,
	`checked_at` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`market`, `ticker`)
);
--> statement-breakpoint
CREATE TABLE `source_discoveries` (
	`document_hash` text NOT NULL,
	`discovered_from_url` text NOT NULL,
	`discovery_method` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`document_hash`, `discovered_from_url`),
	FOREIGN KEY (`document_hash`) REFERENCES `source_snapshots`(`document_hash`) ON UPDATE no action ON DELETE cascade
);
