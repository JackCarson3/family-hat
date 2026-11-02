CREATE TYPE "public"."stage" AS ENUM('setup', 'sealed', 'open', 'drawn', 'emptying', 'emptied');--> statement-breakpoint
CREATE TABLE "assignments" (
	"exchange_id" uuid NOT NULL,
	"generation" integer NOT NULL,
	"giver_id" uuid NOT NULL,
	"sealed_recipient" text NOT NULL,
	CONSTRAINT "assignments_exchange_id_generation_giver_id_pk" PRIMARY KEY("exchange_id","generation","giver_id")
);
--> statement-breakpoint
CREATE TABLE "clues" (
	"participant_id" uuid PRIMARY KEY NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"participant_id" uuid NOT NULL,
	"device_hash" text NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "devices_participant_id_device_hash_pk" PRIMARY KEY("participant_id","device_hash")
);
--> statement-breakpoint
CREATE TABLE "exchanges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"public_id" text NOT NULL,
	"name" text NOT NULL,
	"family_name" text NOT NULL,
	"stage" "stage" DEFAULT 'setup' NOT NULL,
	"generation" integer DEFAULT 0 NOT NULL,
	"budget" text,
	"gift_date" text,
	"message" text DEFAULT '' NOT NULL,
	"admin_token_hash" text NOT NULL,
	"hat_code" text,
	"empty_deadline" timestamp with time zone,
	"opened_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exchanges_slug_unique" UNIQUE("slug"),
	CONSTRAINT "exchanges_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "exclusions" (
	"exchange_id" uuid NOT NULL,
	"from_id" uuid NOT NULL,
	"to_id" uuid NOT NULL,
	"source" text DEFAULT 'household' NOT NULL,
	CONSTRAINT "exclusions_from_id_to_id_pk" PRIMARY KEY("from_id","to_id")
);
--> statement-breakpoint
CREATE TABLE "notices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exchange_id" uuid NOT NULL,
	"text" text NOT NULL,
	"public" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exchange_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"household" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"invite_token_hash" text NOT NULL,
	"invite_token_sealed" text NOT NULL,
	"code_hash" text,
	"claimed_at" timestamp with time zone,
	"failed_code_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"revealed_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"slip_matched_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_exchange_id_exchanges_id_fk" FOREIGN KEY ("exchange_id") REFERENCES "public"."exchanges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_giver_id_participants_id_fk" FOREIGN KEY ("giver_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clues" ADD CONSTRAINT "clues_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exclusions" ADD CONSTRAINT "exclusions_exchange_id_exchanges_id_fk" FOREIGN KEY ("exchange_id") REFERENCES "public"."exchanges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exclusions" ADD CONSTRAINT "exclusions_from_id_participants_id_fk" FOREIGN KEY ("from_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exclusions" ADD CONSTRAINT "exclusions_to_id_participants_id_fk" FOREIGN KEY ("to_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notices" ADD CONSTRAINT "notices_exchange_id_exchanges_id_fk" FOREIGN KEY ("exchange_id") REFERENCES "public"."exchanges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_exchange_id_exchanges_id_fk" FOREIGN KEY ("exchange_id") REFERENCES "public"."exchanges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "devices_hash_idx" ON "devices" USING btree ("device_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "participants_invite_idx" ON "participants" USING btree ("invite_token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "participants_key_idx" ON "participants" USING btree ("exchange_id","key");