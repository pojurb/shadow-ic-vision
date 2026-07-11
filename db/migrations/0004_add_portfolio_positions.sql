CREATE TABLE `portfolio_positions` (
	`id` text PRIMARY KEY NOT NULL,
	`ticker` text NOT NULL,
	`market` text NOT NULL,
	`shares` real NOT NULL,
	`average_buy_price` real NOT NULL,
	`thesis_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`thesis_id`) REFERENCES `theses`(`id`) ON UPDATE no action ON DELETE set null
);
