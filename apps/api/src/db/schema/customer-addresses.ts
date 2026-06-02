import {
  boolean,
  doublePrecision,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { customers } from "./customers.js";

/**
 * customer_addresses table
 *
 * Stores delivery addresses for customer accounts. Each customer can have
 * multiple addresses; one address can be designated as the default.
 *
 * Address components are stored as structured columns (not a single text blob)
 * to enable delivery serviceability checks and structured display on the
 * storefront (Phase 4 CONTEXT.md Specific Ideas).
 *
 * lat/lng/placeId are populated from Google Places Autocomplete when the
 * customer uses the address picker (Phase 4, PlacesAutocompleteInput).
 * They remain nullable for manually-entered addresses.
 *
 * FK cascade: deleting a customer hard-deletes all their saved addresses.
 *
 * Covers AUTH-01, AUTH-03 (customer account management scope).
 */
export const customerAddresses = pgTable("customer_addresses", {
  id: uuid("id").defaultRandom().primaryKey(),

  /**
   * FK to the customer who owns this address.
   * Cascade delete: removing a customer removes all their addresses.
   */
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),

  /**
   * Optional human-readable label for the address (e.g. "Home", "Work").
   * Shown in the address selector on checkout.
   */
  label: text("label"),

  /** Street address line (house number, street name, locality). */
  street: text("street").notNull(),

  /** City / district. */
  city: text("city").notNull(),

  /** State / province. */
  state: text("state").notNull(),

  /** Postal / PIN code. Stored as text to preserve leading zeros (e.g. "01001"). */
  pincode: text("pincode").notNull(),

  /** ISO country name or code. */
  country: text("country").notNull(),

  /**
   * Latitude from Google Places (nullable — not available for manual entries).
   * Used for delivery serviceability checks (Phase 8).
   */
  lat: doublePrecision("lat"),

  /**
   * Longitude from Google Places (nullable — not available for manual entries).
   * Used for delivery serviceability checks (Phase 8).
   */
  lng: doublePrecision("lng"),

  /**
   * Google Places place_id (nullable).
   * Stored to enable future reverse-geocoding or place refresh without
   * prompting the user to re-enter the address.
   */
  placeId: text("place_id"),

  /**
   * Whether this is the customer's default delivery address.
   * NOTE (Phase 4): Multiple addresses may have isDefault=true.
   * Single-default enforcement is deferred to Phase 5 / checkout flow.
   * Defaults to false.
   */
  isDefault: boolean("is_default").notNull().default(false),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** TypeScript type for inserting a new customer address row */
export type InsertCustomerAddress = typeof customerAddresses.$inferInsert;

/** TypeScript type for selecting a customer address row */
export type SelectCustomerAddress = typeof customerAddresses.$inferSelect;
