ALTER TABLE `users` ADD `verified` integer DEFAULT false;-- -> statement-breakpoint
ALTER TABLE `users` ADD `password_hash` text;-- -> statement-breakpoint
ALTER TABLE `drivers` ADD `rating` real DEFAULT 5.0;-- -> statement-breakpoint
ALTER TABLE `drivers` ADD `total_earnings` real DEFAULT 0;
