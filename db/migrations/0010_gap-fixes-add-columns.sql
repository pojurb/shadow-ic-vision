PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_portfolio_positions` (
	`id` text PRIMARY KEY NOT NULL,
	`ticker` text NOT NULL,
	`market` text NOT NULL,
	`status` text DEFAULT 'watchlist' NOT NULL,
	`shares` real,
	`average_buy_price` real,
	`thesis_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`thesis_id`) REFERENCES `theses`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_portfolio_positions`("id", "ticker", "market", "status", "shares", "average_buy_price", "thesis_id", "created_at", "updated_at") SELECT "id", "ticker", "market", 'watchlist', "shares", "average_buy_price", "thesis_id", "created_at", "updated_at" FROM `portfolio_positions`;--> statement-breakpoint
DROP TABLE `portfolio_positions`;--> statement-breakpoint
ALTER TABLE `__new_portfolio_positions` RENAME TO `portfolio_positions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `decisions` ADD `evidence_ids` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `decisions` ADD `alternatives` text DEFAULT '[]' NOT NULL;