CREATE TABLE "modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"name" text NOT NULL,
	"semester" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "modules" ADD CONSTRAINT "modules_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "modules_course_id_idx" ON "modules" USING btree ("course_id");--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_name_unique" UNIQUE("name");