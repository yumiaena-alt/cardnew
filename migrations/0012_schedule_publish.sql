CREATE TYPE "cardnews"."schedule_status" AS ENUM('pending', 'publishing', 'published', 'failed', 'canceled');--> statement-breakpoint
CREATE TABLE "cardnews"."publications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"schedule_id" uuid,
	"deck_id" uuid NOT NULL,
	"social_account_id" uuid NOT NULL,
	"external_post_id" text NOT NULL,
	"permalink" text,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cardnews"."schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"deck_id" uuid NOT NULL,
	"social_account_id" uuid NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"caption" text,
	"hashtags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "cardnews"."schedule_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cardnews"."publications" ADD CONSTRAINT "publications_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "cardnews"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardnews"."publications" ADD CONSTRAINT "publications_schedule_id_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "cardnews"."schedules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardnews"."publications" ADD CONSTRAINT "publications_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "cardnews"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardnews"."publications" ADD CONSTRAINT "publications_social_account_id_social_accounts_id_fk" FOREIGN KEY ("social_account_id") REFERENCES "cardnews"."social_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardnews"."schedules" ADD CONSTRAINT "schedules_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "cardnews"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardnews"."schedules" ADD CONSTRAINT "schedules_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "cardnews"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardnews"."schedules" ADD CONSTRAINT "schedules_social_account_id_social_accounts_id_fk" FOREIGN KEY ("social_account_id") REFERENCES "cardnews"."social_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardnews"."schedules" ADD CONSTRAINT "schedules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "cardnews"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "publications_account_external_uq" ON "cardnews"."publications" USING btree ("social_account_id","external_post_id");--> statement-breakpoint
CREATE INDEX "publications_org_published_idx" ON "cardnews"."publications" USING btree ("org_id","published_at");--> statement-breakpoint
CREATE INDEX "schedules_due_idx" ON "cardnews"."schedules" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE INDEX "schedules_org_scheduled_idx" ON "cardnews"."schedules" USING btree ("org_id","scheduled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "schedules_deck_account_at_uq" ON "cardnews"."schedules" USING btree ("deck_id","social_account_id","scheduled_at");