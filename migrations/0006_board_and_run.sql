CREATE TYPE "cardnews"."board_row_status" AS ENUM('draft', 'queued', 'running', 'done', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "cardnews"."run_status" AS ENUM('estimated', 'queued', 'running', 'done', 'failed', 'canceled');--> statement-breakpoint
CREATE TABLE "cardnews"."board_row_outputs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"row_id" uuid NOT NULL,
	"deck_id" uuid NOT NULL,
	"channel" "cardnews"."channel" NOT NULL,
	"ratio" "cardnews"."ratio" NOT NULL,
	"is_origin" boolean DEFAULT false NOT NULL,
	"credits_charged" integer DEFAULT 0 NOT NULL,
	"run_item_id" uuid
);
--> statement-breakpoint
CREATE TABLE "cardnews"."board_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"board_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"topic" text NOT NULL,
	"cells" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"fanout_targets" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"scheduled_at" timestamp with time zone,
	"status" "cardnews"."board_row_status" DEFAULT 'draft' NOT NULL,
	"estimated_credits" integer DEFAULT 0 NOT NULL,
	"last_run_id" uuid,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "cardnews"."boards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"period_start" date,
	"period_end" date,
	"column_config" jsonb NOT NULL,
	"default_fanout" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "cardnews"."series_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"rrule" text NOT NULL,
	"template_version_id" uuid NOT NULL,
	"fanout_preset" jsonb NOT NULL,
	"default_time_local" text DEFAULT '19:00' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cardnews"."run_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"row_id" uuid,
	"deck_id" uuid,
	"channel" "cardnews"."channel" NOT NULL,
	"is_origin" boolean NOT NULL,
	"estimated_credits" integer NOT NULL,
	"status" "cardnews"."run_status" DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "cardnews"."runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"board_id" uuid,
	"status" "cardnews"."run_status" DEFAULT 'estimated' NOT NULL,
	"scope_kind" "cardnews"."run_scope_kind" DEFAULT 'full' NOT NULL,
	"item_count" integer NOT NULL,
	"estimated_credits" integer NOT NULL,
	"charged_credits" integer DEFAULT 0 NOT NULL,
	"refunded_credits" integer DEFAULT 0 NOT NULL,
	"idempotency_key" text NOT NULL,
	"cost_snapshot" jsonb,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cardnews"."board_row_outputs" ADD CONSTRAINT "board_row_outputs_row_id_board_rows_id_fk" FOREIGN KEY ("row_id") REFERENCES "cardnews"."board_rows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardnews"."board_row_outputs" ADD CONSTRAINT "board_row_outputs_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "cardnews"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardnews"."board_rows" ADD CONSTRAINT "board_rows_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "cardnews"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardnews"."board_rows" ADD CONSTRAINT "board_rows_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "cardnews"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardnews"."boards" ADD CONSTRAINT "boards_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "cardnews"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardnews"."boards" ADD CONSTRAINT "boards_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "cardnews"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardnews"."boards" ADD CONSTRAINT "boards_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "cardnews"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardnews"."series_templates" ADD CONSTRAINT "series_templates_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "cardnews"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardnews"."series_templates" ADD CONSTRAINT "series_templates_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "cardnews"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardnews"."series_templates" ADD CONSTRAINT "series_templates_template_version_id_template_versions_id_fk" FOREIGN KEY ("template_version_id") REFERENCES "cardnews"."template_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardnews"."run_items" ADD CONSTRAINT "run_items_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "cardnews"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardnews"."run_items" ADD CONSTRAINT "run_items_row_id_board_rows_id_fk" FOREIGN KEY ("row_id") REFERENCES "cardnews"."board_rows"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardnews"."run_items" ADD CONSTRAINT "run_items_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "cardnews"."decks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardnews"."runs" ADD CONSTRAINT "runs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "cardnews"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardnews"."runs" ADD CONSTRAINT "runs_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "cardnews"."boards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardnews"."runs" ADD CONSTRAINT "runs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "cardnews"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "board_row_outputs_row_idx" ON "cardnews"."board_row_outputs" USING btree ("row_id");--> statement-breakpoint
CREATE UNIQUE INDEX "board_row_outputs_row_channel_uq" ON "cardnews"."board_row_outputs" USING btree ("row_id","channel","ratio");--> statement-breakpoint
CREATE INDEX "board_rows_board_position_idx" ON "cardnews"."board_rows" USING btree ("board_id","position");--> statement-breakpoint
CREATE INDEX "board_rows_board_status_idx" ON "cardnews"."board_rows" USING btree ("board_id","status");--> statement-breakpoint
CREATE INDEX "boards_org_period_idx" ON "cardnews"."boards" USING btree ("org_id","period_start");--> statement-breakpoint
CREATE INDEX "series_templates_project_idx" ON "cardnews"."series_templates" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "run_items_run_status_idx" ON "cardnews"."run_items" USING btree ("run_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "runs_idempotency_uq" ON "cardnews"."runs" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "runs_org_created_idx" ON "cardnews"."runs" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "runs_status_idx" ON "cardnews"."runs" USING btree ("status");