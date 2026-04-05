import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  phone: text('phone').notNull().unique(),
  fullName: text('full_name').notNull(),
  userType: text('user_type', { enum: ['passenger', 'driver'] }).notNull(),
  profileImageUrl: text('profile_image_url'),
  passwordHash: text('password_hash'),
  verified: integer('verified', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
});

export const drivers = sqliteTable('drivers', {
  id: text('id').primaryKey().references(() => users.id),
  vehicleType: text('vehicle_type', { enum: ['car', 'taxi', 'motorcycle', 'bicycle', 'rickshaw'] }).notNull(),
  vehicleBrand: text('vehicle_brand').notNull(),
  vehicleModel: text('vehicle_model').notNull(),
  vehicleYear: integer('vehicle_year').notNull(),
  licensePlate: text('license_plate').notNull().unique(),
  driverLicense: text('driver_license').notNull(),
  isVerified: integer('is_verified', { mode: 'boolean' }).default(false),
  isActive: integer('is_active', { mode: 'boolean' }).default(false),
  isBlocked: integer('is_blocked', { mode: 'boolean' }).default(false),
  totalTrips: integer('total_trips').default(0),
  rating: real('rating').default(5.0),
  totalEarnings: real('total_earnings').default(0),
  unpaidCommissionAmount: real('unpaid_commission_amount').default(0),
  baseFare: real('base_fare').default(25),
  costPerKm: real('cost_per_km').default(10),
  costPerMinute: real('cost_per_minute').default(2),
  currentLatitude: real('current_latitude'),
  currentLongitude: real('current_longitude'),
  lastLocationUpdate: text('last_location_update'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
});

export const rides = sqliteTable('rides', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  passengerId: text('passenger_id').notNull().references(() => users.id),
  driverId: text('driver_id').references(() => drivers.id),
  rideType: text('ride_type', { enum: ['ride', 'errand'] }).notNull().default('ride'),
  status: text('status', { enum: ['requested', 'accepted', 'in_progress', 'completed', 'cancelled'] }).notNull().default('requested'),
  pickupLatitude: real('pickup_latitude').notNull(),
  pickupLongitude: real('pickup_longitude').notNull(),
  pickupAddress: text('pickup_address').notNull(),
  dropoffLatitude: real('dropoff_latitude').notNull(),
  dropoffLongitude: real('dropoff_longitude').notNull(),
  dropoffAddress: text('dropoff_address').notNull(),
  distanceKm: real('distance_km'),
  estimatedDurationMinutes: integer('estimated_duration_minutes'),
  baseFare: real('base_fare').notNull(),
  totalFare: real('total_fare').notNull(),
  commissionAmount: real('commission_amount').default(0),
  commissionRate: real('commission_rate').default(0),
  errandDescription: text('errand_description'),
  errandItems: text('errand_items'),
  requestedAt: text('requested_at').default(sql`CURRENT_TIMESTAMP`),
  acceptedAt: text('accepted_at'),
  startedAt: text('started_at'),
  completedAt: text('completed_at'),
  cancelledAt: text('cancelled_at'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`)
});

export const commissionPayments = sqliteTable('commission_payments', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  driverId: text('driver_id').notNull().references(() => drivers.id),
  amount: real('amount').notNull(),
  paymentMethod: text('payment_method', { enum: ['oxxo', 'debit_card', 'credit_card', 'spei'] }).notNull(),
  status: text('status', { enum: ['pending', 'approved', 'rejected', 'cancelled'] }).notNull().default('pending'),
  mercadopagoPaymentId: text('mercadopago_payment_id'),
  mercadopagoPreferenceId: text('mercadopago_preference_id'),
  paymentUrl: text('payment_url'),
  paidAt: text('paid_at'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
});

export const ratings = sqliteTable('ratings', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  rideId: text('ride_id').notNull().references(() => rides.id),
  raterId: text('rater_id').notNull().references(() => users.id),
  ratedId: text('rated_id').notNull().references(() => users.id),
  rating: integer('rating').notNull(),
  comment: text('comment'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`)
});

export const promotions = sqliteTable('promotions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  code: text('code').notNull().unique(),
  discountType: text('discount_type', { enum: ['percentage', 'fixed_amount', 'free_ride'] }).notNull(),
  discountValue: real('discount_value').notNull(),
  maxUses: integer('max_uses').notNull(),
  currentUses: integer('current_uses').default(0),
  validFrom: text('valid_from').notNull(),
  validUntil: text('valid_until').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`)
});
