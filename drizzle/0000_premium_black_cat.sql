CREATE TABLE IF NOT EXISTS `commission_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`driver_id` text NOT NULL,
	`amount` real NOT NULL,
	`payment_method` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`mercadopago_payment_id` text,
	`mercadopago_preference_id` text,
	`payment_url` text,
	`paid_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`driver_id`) REFERENCES `drivers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `drivers` (
	`id` text PRIMARY KEY NOT NULL,
	`vehicle_type` text NOT NULL,
	`vehicle_brand` text NOT NULL,
	`vehicle_model` text NOT NULL,
	`vehicle_year` integer NOT NULL,
	`license_plate` text NOT NULL,
	`driver_license` text NOT NULL,
	`is_verified` integer DEFAULT false,
	`is_active` integer DEFAULT false,
	`is_blocked` integer DEFAULT false,
	`total_trips` integer DEFAULT 0,
	`unpaid_commission_amount` real DEFAULT 0,
	`current_latitude` real,
	`current_longitude` real,
	`last_location_update` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `drivers_license_plate_unique` ON `drivers` (`license_plate`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `promotions` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`discount_type` text NOT NULL,
	`discount_value` real NOT NULL,
	`max_uses` integer NOT NULL,
	`current_uses` integer DEFAULT 0,
	`valid_from` text NOT NULL,
	`valid_until` text NOT NULL,
	`is_active` integer DEFAULT true,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `promotions_code_unique` ON `promotions` (`code`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `ratings` (
	`id` text PRIMARY KEY NOT NULL,
	`ride_id` text NOT NULL,
	`rater_id` text NOT NULL,
	`rated_id` text NOT NULL,
	`rating` integer NOT NULL,
	`comment` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`ride_id`) REFERENCES `rides`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`rater_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`rated_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `rides` (
	`id` text PRIMARY KEY NOT NULL,
	`passenger_id` text NOT NULL,
	`driver_id` text,
	`ride_type` text DEFAULT 'ride' NOT NULL,
	`status` text DEFAULT 'requested' NOT NULL,
	`pickup_latitude` real NOT NULL,
	`pickup_longitude` real NOT NULL,
	`pickup_address` text NOT NULL,
	`dropoff_latitude` real NOT NULL,
	`dropoff_longitude` real NOT NULL,
	`dropoff_address` text NOT NULL,
	`distance_km` real,
	`estimated_duration_minutes` integer,
	`base_fare` real NOT NULL,
	`total_fare` real NOT NULL,
	`commission_amount` real DEFAULT 0,
	`commission_rate` real DEFAULT 0,
	`errand_description` text,
	`errand_items` text,
	`requested_at` text DEFAULT CURRENT_TIMESTAMP,
	`accepted_at` text,
	`started_at` text,
	`completed_at` text,
	`cancelled_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`passenger_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`driver_id`) REFERENCES `drivers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`full_name` text NOT NULL,
	`user_type` text NOT NULL,
	`profile_image_url` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `users_email_unique` ON `users` (`email`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `users_phone_unique` ON `users` (`phone`);