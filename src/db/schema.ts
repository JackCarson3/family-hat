import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Secrecy rule for this schema: no table stores a giver next to their
 * recipient in readable form. The only pairing data is `assignments.sealedRecipient`,
 * which is AES-GCM encrypted and bound to (exchange, generation, giver).
 */

export const stage = pgEnum("stage", [
  "setup", // people and rules being entered
  "sealed", // assignment generated; links out; hat locked
  "open", // drawing night: draws allowed
  "drawn", // everyone confirmed
  "emptying", // Empty the hat: slip entry timer running
  "emptied", // every slip matched; names tumbled out
]);

export const exchanges = pgTable("exchanges", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  familyName: text("family_name").notNull(),
  stage: stage("stage").notNull().default("setup"),
  generation: integer("generation").notNull().default(0),
  budget: text("budget"),
  giftDate: text("gift_date"),
  message: text("message").notNull().default(""),
  adminTokenHash: text("admin_token_hash").notNull(),
  hatCode: text("hat_code"),
  emptyDeadline: timestamp("empty_deadline", { withTimezone: true }),
  openedAt: timestamp("opened_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const participants = pgTable(
  "participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    exchangeId: uuid("exchange_id").notNull().references(() => exchanges.id, { onDelete: "cascade" }),
    key: text("key").notNull(), // stable config id, e.g. "jack"
    name: text("name").notNull(),
    household: text("household").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    inviteTokenHash: text("invite_token_hash").notNull(),
    inviteTokenSealed: text("invite_token_sealed").notNull(), // so the organizer can re-share
    codeHash: text("code_hash"),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    failedCodeAttempts: integer("failed_code_attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    revealedAt: timestamp("revealed_at", { withTimezone: true }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    slipMatchedAt: timestamp("slip_matched_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("participants_invite_idx").on(t.inviteTokenHash),
    uniqueIndex("participants_key_idx").on(t.exchangeId, t.key),
  ],
);

/** A browser that has unlocked a participant. One device can unlock several people. */
export const devices = pgTable(
  "devices",
  {
    participantId: uuid("participant_id").notNull().references(() => participants.id, { onDelete: "cascade" }),
    deviceHash: text("device_hash").notNull(),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.participantId, t.deviceHash] }), index("devices_hash_idx").on(t.deviceHash)],
);

export const exclusions = pgTable(
  "exclusions",
  {
    exchangeId: uuid("exchange_id").notNull().references(() => exchanges.id, { onDelete: "cascade" }),
    fromId: uuid("from_id").notNull().references(() => participants.id, { onDelete: "cascade" }),
    toId: uuid("to_id").notNull().references(() => participants.id, { onDelete: "cascade" }),
    source: text("source").notNull().default("household"),
  },
  (t) => [primaryKey({ columns: [t.fromId, t.toId] })],
);

export const assignments = pgTable(
  "assignments",
  {
    exchangeId: uuid("exchange_id").notNull().references(() => exchanges.id, { onDelete: "cascade" }),
    generation: integer("generation").notNull(),
    giverId: uuid("giver_id").notNull().references(() => participants.id, { onDelete: "cascade" }),
    sealedRecipient: text("sealed_recipient").notNull(),
  },
  (t) => [primaryKey({ columns: [t.exchangeId, t.generation, t.giverId] })],
);

export const clues = pgTable("clues", {
  participantId: uuid("participant_id")
    .primaryKey()
    .references(() => participants.id, { onDelete: "cascade" }),
  answers: jsonb("answers").$type<Record<string, string>>().notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Public announcements shown on the hat (new link, code reset, hat refilled). */
export const notices = pgTable("notices", {
  id: uuid("id").primaryKey().defaultRandom(),
  exchangeId: uuid("exchange_id").notNull().references(() => exchanges.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  public: boolean("public").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
