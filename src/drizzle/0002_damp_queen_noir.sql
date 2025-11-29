ALTER TABLE "app_message_log" RENAME COLUMN "createdAt" TO "created_at";--> statement-breakpoint
ALTER TABLE "app_rumour" RENAME COLUMN "factCheckSource" TO "fact_check_source";--> statement-breakpoint
ALTER TABLE "app_rumour" RENAME COLUMN "factCheckResult" TO "fact_check_result";--> statement-breakpoint
ALTER TABLE "app_rumour" RENAME COLUMN "riskScore" TO "risk_score";--> statement-breakpoint
ALTER TABLE "app_rumour_match" RENAME COLUMN "createdAt" TO "normalized";--> statement-breakpoint
ALTER TABLE "app_rumour_match" DROP CONSTRAINT "app_rumour_match_rumourId_app_rumour_id_fk";
--> statement-breakpoint
ALTER TABLE "app_chat" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "app_rumour_match" ADD COLUMN "broadcasted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "app_rumour_match" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "app_rumour_match" ADD COLUMN "rumour_id" uuid;--> statement-breakpoint
ALTER TABLE "app_rumour_match" ADD CONSTRAINT "app_rumour_match_rumour_id_app_rumour_id_fk" FOREIGN KEY ("rumour_id") REFERENCES "public"."app_rumour"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_rumour_match" DROP COLUMN "rumourId";--> statement-breakpoint
ALTER TABLE "app_rumour_match" ADD CONSTRAINT "app_rumour_match_normalized_unique" UNIQUE("normalized");