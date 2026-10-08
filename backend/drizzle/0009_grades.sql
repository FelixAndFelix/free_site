CREATE TABLE "grades" (
	"user_id" uuid NOT NULL,
	"module_id" uuid NOT NULL,
	"grade_tenths" integer NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "grades_user_id_module_id_pk" PRIMARY KEY("user_id","module_id")
);
--> statement-breakpoint
ALTER TABLE "grades" ADD CONSTRAINT "grades_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grades" ADD CONSTRAINT "grades_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "grades_module_id_idx" ON "grades" USING btree ("module_id");