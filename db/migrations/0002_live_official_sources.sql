ALTER TABLE `evidence` ADD `interpretation_status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `research_jobs` ADD `error_code` text;--> statement-breakpoint
ALTER TABLE `research_jobs` ADD `source_mode` text DEFAULT 'mock' NOT NULL;--> statement-breakpoint
CREATE TABLE `source_snapshots` (
	`document_hash` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`market` text NOT NULL,
	`ticker` text NOT NULL,
	`source_url` text NOT NULL,
	`source_name` text NOT NULL,
	`source_tier` text NOT NULL,
	`source_format` text NOT NULL,
	`content_type` text NOT NULL,
	`http_status` integer NOT NULL,
	`publish_date` text,
	`retrieval_timestamp` text NOT NULL,
	`storage_path` text NOT NULL,
	`source_mode` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);--> statement-breakpoint
CREATE TABLE `research_job_sources` (
	`job_id` text NOT NULL,
	`document_hash` text NOT NULL,
	`outcome` text NOT NULL,
	`error_code` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`job_id`, `document_hash`),
	FOREIGN KEY (`job_id`) REFERENCES `research_jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`document_hash`) REFERENCES `source_snapshots`(`document_hash`) ON UPDATE no action ON DELETE restrict
);
