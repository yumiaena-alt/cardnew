CREATE TABLE "cardnews"."dm_automations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"name" text NOT NULL,
	"external_post_id" text,
	"keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"message" text NOT NULL,
	"link_url" text,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cardnews"."dm_sends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"automation_id" uuid NOT NULL,
	"external_comment_id" text NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"error_message" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cardnews"."social_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"channel" "cardnews"."channel" NOT NULL,
	"external_id" text NOT NULL,
	"handle" text NOT NULL,
	"access_token_cipher" text,
	"token_expires_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cardnews"."dm_automations" ADD CONSTRAINT "dm_automations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "cardnews"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardnews"."dm_automations" ADD CONSTRAINT "dm_automations_account_id_social_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "cardnews"."social_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardnews"."dm_sends" ADD CONSTRAINT "dm_sends_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "cardnews"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardnews"."dm_sends" ADD CONSTRAINT "dm_sends_automation_id_dm_automations_id_fk" FOREIGN KEY ("automation_id") REFERENCES "cardnews"."dm_automations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardnews"."social_accounts" ADD CONSTRAINT "social_accounts_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "cardnews"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardnews"."social_accounts" ADD CONSTRAINT "social_accounts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "cardnews"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dm_automations_org_idx" ON "cardnews"."dm_automations" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dm_sends_comment_uq" ON "cardnews"."dm_sends" USING btree ("external_comment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "social_accounts_channel_external_uq" ON "cardnews"."social_accounts" USING btree ("channel","external_id");--> statement-breakpoint
CREATE INDEX "social_accounts_org_idx" ON "cardnews"."social_accounts" USING btree ("org_id");