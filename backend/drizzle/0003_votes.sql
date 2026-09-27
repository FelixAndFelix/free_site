CREATE TYPE "public"."vote_value" AS ENUM('free', 'possible', 'impossible');--> statement-breakpoint
CREATE TABLE "votes" (
	"user_id" uuid NOT NULL,
	"module_id" uuid NOT NULL,
	"vote_value" "vote_value" NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "votes_user_id_module_id_pk" PRIMARY KEY("user_id","module_id")
);
--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "votes_module_id_idx" ON "votes" USING btree ("module_id");