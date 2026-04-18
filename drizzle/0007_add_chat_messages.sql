CREATE TABLE `ride_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`ride_id` text NOT NULL,
	`sender_id` text NOT NULL,
	`text` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`ride_id`) REFERENCES `rides`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ratings_ride_rater_rated_unique` ON `ratings` (`ride_id`,`rater_id`,`rated_id`);