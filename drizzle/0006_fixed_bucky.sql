CREATE TABLE `rating_summary` (
	`user_id` text PRIMARY KEY NOT NULL,
	`average_rating` real DEFAULT 5,
	`total_ratings` integer DEFAULT 0,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
