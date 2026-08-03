CREATE TABLE "cardnews"."blog_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"topic" text NOT NULL,
	"body" text NOT NULL,
	"status" "cardnews"."deck_status" DEFAULT 'drafting' NOT NULL,
	"credits_charged" integer DEFAULT 0 NOT NULL,
	"charge_key" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "cardnews"."blog_posts" ADD CONSTRAINT "blog_posts_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "cardnews"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardnews"."blog_posts" ADD CONSTRAINT "blog_posts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "cardnews"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardnews"."blog_posts" ADD CONSTRAINT "blog_posts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "cardnews"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "blog_posts_org_created_idx" ON "cardnews"."blog_posts" USING btree ("org_id","created_at");