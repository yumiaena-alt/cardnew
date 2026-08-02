CREATE TYPE "cardnews"."deck_status" AS ENUM('drafting', 'ready', 'scheduled', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "cardnews"."run_scope_kind" AS ENUM('full', 'panel', 'slot');--> statement-breakpoint
CREATE TABLE "cardnews"."deck_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deck_id" uuid NOT NULL,
	"parent_version_id" uuid,
	"label" text NOT NULL,
	"template_version_id" uuid,
	"run_id" uuid,
	"credits_charged" integer DEFAULT 0 NOT NULL,
	"scope_kind" "cardnews"."run_scope_kind" DEFAULT 'full' NOT NULL,
	"scope_detail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cardnews"."decks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"topic" text NOT NULL,
	"channel" "cardnews"."channel" NOT NULL,
	"ratio" "cardnews"."ratio" NOT NULL,
	"status" "cardnews"."deck_status" DEFAULT 'drafting' NOT NULL,
	"active_version_id" uuid,
	"topic_embedding" jsonb,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "cardnews"."panels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_id" uuid NOT NULL,
	"index" integer NOT NULL,
	"role" text DEFAULT 'body' NOT NULL,
	"slots" jsonb NOT NULL,
	"render_path" text,
	"blur_data_url" text
);
--> statement-breakpoint
ALTER TABLE "cardnews"."deck_versions" ADD CONSTRAINT "deck_versions_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "cardnews"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardnews"."deck_versions" ADD CONSTRAINT "deck_versions_template_version_id_template_versions_id_fk" FOREIGN KEY ("template_version_id") REFERENCES "cardnews"."template_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardnews"."decks" ADD CONSTRAINT "decks_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "cardnews"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardnews"."decks" ADD CONSTRAINT "decks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "cardnews"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardnews"."decks" ADD CONSTRAINT "decks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "cardnews"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardnews"."panels" ADD CONSTRAINT "panels_version_id_deck_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "cardnews"."deck_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deck_versions_deck_idx" ON "cardnews"."deck_versions" USING btree ("deck_id");--> statement-breakpoint
CREATE INDEX "deck_versions_parent_idx" ON "cardnews"."deck_versions" USING btree ("parent_version_id");--> statement-breakpoint
CREATE INDEX "decks_org_status_idx" ON "cardnews"."decks" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "decks_project_created_idx" ON "cardnews"."decks" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "panels_version_index_uq" ON "cardnews"."panels" USING btree ("version_id","index");