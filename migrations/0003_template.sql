CREATE TYPE "cardnews"."template_source" AS ENUM('system', 'learned', 'forked');--> statement-breakpoint
CREATE TABLE "cardnews"."design_learnings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"source_asset_ids" jsonb NOT NULL,
	"ratio" "cardnews"."ratio" NOT NULL,
	"custom_instruction" text,
	"produced_template_id" uuid,
	"rights_confirmed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cardnews"."template_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"layouts" jsonb NOT NULL,
	"tokens" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cardnews"."templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"name" text NOT NULL,
	"source" "cardnews"."template_source" DEFAULT 'system' NOT NULL,
	"ratio" "cardnews"."ratio" NOT NULL,
	"default_panel_count" integer DEFAULT 6 NOT NULL,
	"style_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"preview_path" text,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cardnews"."design_learnings" ADD CONSTRAINT "design_learnings_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "cardnews"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardnews"."design_learnings" ADD CONSTRAINT "design_learnings_produced_template_id_templates_id_fk" FOREIGN KEY ("produced_template_id") REFERENCES "cardnews"."templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardnews"."template_versions" ADD CONSTRAINT "template_versions_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "cardnews"."templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardnews"."templates" ADD CONSTRAINT "templates_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "cardnews"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "design_learnings_org_idx" ON "cardnews"."design_learnings" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "template_versions_template_version_uq" ON "cardnews"."template_versions" USING btree ("template_id","version");--> statement-breakpoint
CREATE INDEX "templates_org_ratio_idx" ON "cardnews"."templates" USING btree ("org_id","ratio");--> statement-breakpoint
CREATE INDEX "templates_source_idx" ON "cardnews"."templates" USING btree ("source");