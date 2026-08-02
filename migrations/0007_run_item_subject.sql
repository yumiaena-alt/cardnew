ALTER TABLE "cardnews"."run_items" ADD COLUMN "topic" text NOT NULL;--> statement-breakpoint
ALTER TABLE "cardnews"."run_items" ADD COLUMN "ratio" "cardnews"."ratio" NOT NULL;--> statement-breakpoint
ALTER TABLE "cardnews"."run_items" ADD COLUMN "template_version_id" uuid;--> statement-breakpoint
ALTER TABLE "cardnews"."run_items" ADD CONSTRAINT "run_items_template_version_id_template_versions_id_fk" FOREIGN KEY ("template_version_id") REFERENCES "cardnews"."template_versions"("id") ON DELETE no action ON UPDATE no action;