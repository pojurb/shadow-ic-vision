CREATE TABLE `discovery_candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`market` text NOT NULL,
	`ticker` text NOT NULL,
	`candidate_url` text NOT NULL,
	`discovered_via` text DEFAULT 'web_search' NOT NULL,
	`search_query` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`rejection_reason` text,
	`resulting_document_hash` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`resulting_document_hash`) REFERENCES `source_snapshots`(`document_hash`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `discovery_candidates_market_ticker_url_unique` ON `discovery_candidates` (`market`,`ticker`,`candidate_url`);