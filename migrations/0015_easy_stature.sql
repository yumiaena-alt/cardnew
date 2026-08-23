CREATE TYPE "cardnews"."art_style" AS ENUM('soft-webtoon', 'bold-comic', 'sketch-diary', 'minimal-line');--> statement-breakpoint
CREATE TYPE "cardnews"."run_mode" AS ENUM('cardnews', 'toon');--> statement-breakpoint
CREATE TYPE "cardnews"."toon_formula_source" AS ENUM('learned', 'preset');--> statement-breakpoint
CREATE TABLE "cardnews"."toon_characters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"appearance" jsonb NOT NULL,
	"art_style" "cardnews"."art_style" DEFAULT 'soft-webtoon' NOT NULL,
	"anchor_prompt" text NOT NULL,
	"seed" integer NOT NULL,
	"reference_path" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cardnews"."toon_formulas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"source" "cardnews"."toon_formula_source" DEFAULT 'learned' NOT NULL,
	"beats" jsonb NOT NULL,
	"hook_patterns" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tone_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pacing" text DEFAULT 'steady' NOT NULL,
	"summary" text NOT NULL,
	"reference_count" integer DEFAULT 0 NOT NULL,
	"rights_confirmed_at" timestamp with time zone NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cardnews"."toon_storyboards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"deck_id" uuid,
	"character_id" uuid NOT NULL,
	"formula_id" uuid,
	"topic" text NOT NULL,
	"ratio" "cardnews"."ratio" NOT NULL,
	"hook" text NOT NULL,
	"logline" text NOT NULL,
	"cuts" jsonb NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"hashtags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cardnews"."run_items" ADD COLUMN "mode" "cardnews"."run_mode" DEFAULT 'cardnews' NOT NULL;--> statement-breakpoint
ALTER TABLE "cardnews"."run_items" ADD COLUMN "toon" jsonb;--> statement-breakpoint
ALTER TABLE "cardnews"."toon_characters" ADD CONSTRAINT "toon_characters_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "cardnews"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardnews"."toon_characters" ADD CONSTRAINT "toon_characters_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "cardnews"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardnews"."toon_formulas" ADD CONSTRAINT "toon_formulas_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "cardnews"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardnews"."toon_formulas" ADD CONSTRAINT "toon_formulas_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "cardnews"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardnews"."toon_storyboards" ADD CONSTRAINT "toon_storyboards_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "cardnews"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardnews"."toon_storyboards" ADD CONSTRAINT "toon_storyboards_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "cardnews"."decks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardnews"."toon_storyboards" ADD CONSTRAINT "toon_storyboards_character_id_toon_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "cardnews"."toon_characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardnews"."toon_storyboards" ADD CONSTRAINT "toon_storyboards_formula_id_toon_formulas_id_fk" FOREIGN KEY ("formula_id") REFERENCES "cardnews"."toon_formulas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "toon_characters_org_idx" ON "cardnews"."toon_characters" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "toon_formulas_org_idx" ON "cardnews"."toon_formulas" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "toon_storyboards_org_idx" ON "cardnews"."toon_storyboards" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "toon_storyboards_deck_idx" ON "cardnews"."toon_storyboards" USING btree ("deck_id");