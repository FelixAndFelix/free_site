CREATE TABLE "vote_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_id" uuid NOT NULL,
	"from_value" "vote_value",
	"to_value" "vote_value",
	"changed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vote_changes" ADD CONSTRAINT "vote_changes_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vote_changes_module_id_changed_at_idx" ON "vote_changes" USING btree ("module_id","changed_at");