CREATE TABLE "app_chat" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_id" varchar NOT NULL,
	"chat_name" text,
	"platform" text DEFAULT 'telegram',
	CONSTRAINT "app_chat_chat_id_unique" UNIQUE("chat_id")
);
--> statement-breakpoint
CREATE TABLE "app_message_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_table_id" uuid,
	"message_id" text,
	"content" text,
	"ai_response" text,
	"processed" boolean DEFAULT false,
	"createdAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "app_rumour" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_table_id" uuid,
	"msg_content" text NOT NULL,
	"embedding" jsonb,
	"status" text DEFAULT 'pending',
	"factCheckSource" text,
	"factCheckResult" text,
	"source_link" text,
	"riskScore" integer,
	"rumour_location" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "app_rumour_match" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"similarity" integer,
	"count" integer DEFAULT 1,
	"createdAt" timestamp DEFAULT now(),
	"rumourId" uuid
);
--> statement-breakpoint
DROP TABLE "auth"."sso_domains" CASCADE;--> statement-breakpoint
DROP TABLE "auth"."saml_providers" CASCADE;--> statement-breakpoint
DROP TABLE "auth"."sso_providers" CASCADE;--> statement-breakpoint
DROP TABLE "auth"."instances" CASCADE;--> statement-breakpoint
DROP TABLE "auth"."schema_migrations" CASCADE;--> statement-breakpoint
DROP TABLE "UserProfile" CASCADE;--> statement-breakpoint
DROP TABLE "auth"."mfa_factors" CASCADE;--> statement-breakpoint
DROP TABLE "auth"."refresh_tokens" CASCADE;--> statement-breakpoint
DROP POLICY "Users can insert their own profile." ON "profiles" CASCADE;--> statement-breakpoint
DROP POLICY "Public profiles are viewable by everyone." ON "profiles" CASCADE;--> statement-breakpoint
DROP TABLE "profiles" CASCADE;--> statement-breakpoint
DROP TABLE "auth"."users" CASCADE;--> statement-breakpoint
DROP TABLE "auth"."audit_log_entries" CASCADE;--> statement-breakpoint
DROP TABLE "auth"."saml_relay_states" CASCADE;--> statement-breakpoint
DROP TABLE "auth"."mfa_amr_claims" CASCADE;--> statement-breakpoint
DROP TABLE "auth"."flow_state" CASCADE;--> statement-breakpoint
DROP TABLE "auth"."identities" CASCADE;--> statement-breakpoint
DROP TABLE "auth"."one_time_tokens" CASCADE;--> statement-breakpoint
DROP TABLE "auth"."mfa_challenges" CASCADE;--> statement-breakpoint
DROP TABLE "auth"."oauth_clients" CASCADE;--> statement-breakpoint
DROP TABLE "auth"."sessions" CASCADE;--> statement-breakpoint
DROP TABLE "auth"."oauth_consents" CASCADE;--> statement-breakpoint
DROP TABLE "auth"."oauth_authorizations" CASCADE;--> statement-breakpoint
DROP TABLE "Chat" CASCADE;--> statement-breakpoint
DROP TABLE "Rumour" CASCADE;--> statement-breakpoint
DROP TABLE "RumourMatch" CASCADE;--> statement-breakpoint
DROP TABLE "MessageLog" CASCADE;--> statement-breakpoint
ALTER TABLE "app_message_log" ADD CONSTRAINT "app_message_log_chat_table_id_app_chat_id_fk" FOREIGN KEY ("chat_table_id") REFERENCES "public"."app_chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_rumour" ADD CONSTRAINT "app_rumour_chat_table_id_app_chat_id_fk" FOREIGN KEY ("chat_table_id") REFERENCES "public"."app_chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_rumour_match" ADD CONSTRAINT "app_rumour_match_rumourId_app_rumour_id_fk" FOREIGN KEY ("rumourId") REFERENCES "public"."app_rumour"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
DROP TYPE "auth"."aal_level";--> statement-breakpoint
DROP TYPE "auth"."code_challenge_method";--> statement-breakpoint
DROP TYPE "auth"."factor_status";--> statement-breakpoint
DROP TYPE "auth"."factor_type";--> statement-breakpoint
DROP TYPE "auth"."oauth_authorization_status";--> statement-breakpoint
DROP TYPE "auth"."oauth_client_type";--> statement-breakpoint
DROP TYPE "auth"."oauth_registration_type";--> statement-breakpoint
DROP TYPE "auth"."oauth_response_type";--> statement-breakpoint
DROP TYPE "auth"."one_time_token_type";--> statement-breakpoint
DROP SCHEMA "auth";
