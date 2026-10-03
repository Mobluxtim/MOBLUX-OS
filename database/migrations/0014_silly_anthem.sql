CREATE TABLE "portal_accesses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"payload_hash" text NOT NULL,
	"token_hash" text NOT NULL,
	"contact_name" text NOT NULL,
	"contact_email" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "portal_accesses_request_id_unique" UNIQUE("request_id"),
	CONSTRAINT "portal_accesses_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "portal_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"access_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"payload_hash" text NOT NULL,
	"action" text NOT NULL,
	"message" text,
	"approved_content" jsonb,
	"content_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "portal_actions_access_id_request_id_unique" UNIQUE("access_id","request_id")
);
--> statement-breakpoint
CREATE TABLE "portal_revocations" (
	"access_id" uuid PRIMARY KEY NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_session_ends" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"access_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "portal_sessions_access_id_unique" UNIQUE("access_id")
);
--> statement-breakpoint
CREATE TABLE "portal_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"presentation_id" uuid NOT NULL,
	"content" jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"evidence" jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "portal_snapshots_project_id_quote_id_unique" UNIQUE("project_id","quote_id")
);
--> statement-breakpoint
CREATE TABLE "portal_supersessions" (
	"snapshot_id" uuid PRIMARY KEY NOT NULL,
	"replacement_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "portal_accesses" ADD CONSTRAINT "portal_accesses_snapshot_id_portal_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."portal_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_accesses" ADD CONSTRAINT "portal_accesses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_actions" ADD CONSTRAINT "portal_actions_snapshot_id_portal_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."portal_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_actions" ADD CONSTRAINT "portal_actions_access_id_portal_accesses_id_fk" FOREIGN KEY ("access_id") REFERENCES "public"."portal_accesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_revocations" ADD CONSTRAINT "portal_revocations_access_id_portal_accesses_id_fk" FOREIGN KEY ("access_id") REFERENCES "public"."portal_accesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_revocations" ADD CONSTRAINT "portal_revocations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_session_ends" ADD CONSTRAINT "portal_session_ends_token_hash_portal_sessions_token_hash_fk" FOREIGN KEY ("token_hash") REFERENCES "public"."portal_sessions"("token_hash") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_sessions" ADD CONSTRAINT "portal_sessions_access_id_portal_accesses_id_fk" FOREIGN KEY ("access_id") REFERENCES "public"."portal_accesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_snapshots" ADD CONSTRAINT "portal_snapshots_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_snapshots" ADD CONSTRAINT "portal_snapshots_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_snapshots" ADD CONSTRAINT "portal_snapshots_version_id_project_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."project_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_snapshots" ADD CONSTRAINT "portal_snapshots_quote_id_quote_versions_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quote_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_snapshots" ADD CONSTRAINT "portal_snapshots_presentation_id_presentation_revisions_id_fk" FOREIGN KEY ("presentation_id") REFERENCES "public"."presentation_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_snapshots" ADD CONSTRAINT "portal_snapshots_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_supersessions" ADD CONSTRAINT "portal_supersessions_snapshot_id_portal_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."portal_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_supersessions" ADD CONSTRAINT "portal_supersessions_replacement_id_portal_snapshots_id_fk" FOREIGN KEY ("replacement_id") REFERENCES "public"."portal_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_supersessions" ADD CONSTRAINT "portal_supersessions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['portal_snapshots','portal_accesses','portal_sessions','portal_session_ends','portal_revocations','portal_supersessions','portal_actions'] LOOP EXECUTE format('CREATE TRIGGER immutable_portal BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION reject_immutable_change()',t); END LOOP; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX one_portal_approval ON portal_actions(snapshot_id) WHERE action='APPROVE';
--> statement-breakpoint
CREATE FUNCTION validate_portal_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM projects p JOIN quote_versions q ON q.project_id=p.id WHERE p.id=NEW.project_id AND p.customer_id=NEW.customer_id AND q.id=NEW.quote_id AND q.version_id=NEW.version_id AND q.presentation_revision_id=NEW.presentation_id AND q.result->>'status'='COMPLETE') THEN RAISE EXCEPTION 'Portal snapshot ancestry mismatch'; END IF;
 RETURN NEW; END $$;
--> statement-breakpoint
CREATE TRIGGER valid_portal_snapshot BEFORE INSERT ON portal_snapshots FOR EACH ROW EXECUTE FUNCTION validate_portal_snapshot();
--> statement-breakpoint
CREATE FUNCTION validate_portal_action() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM portal_accesses a JOIN portal_snapshots s ON s.id=a.snapshot_id WHERE a.id=NEW.access_id AND s.id=NEW.snapshot_id AND s.content_hash=NEW.content_hash AND a.expires_at>now() AND NOT EXISTS(SELECT 1 FROM portal_revocations r WHERE r.access_id=a.id) AND NOT EXISTS(SELECT 1 FROM portal_supersessions x WHERE x.snapshot_id=s.id) AND ((NEW.action='APPROVE' AND NEW.approved_content=s.content AND NEW.message IS NULL) OR (NEW.action='REQUEST_CHANGES' AND NEW.approved_content IS NULL AND length(trim(NEW.message)) BETWEEN 1 AND 4000))) THEN RAISE EXCEPTION 'Portal action evidence mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM portal_actions WHERE snapshot_id=NEW.snapshot_id AND action='APPROVE') THEN RAISE EXCEPTION 'Portal snapshot already approved'; END IF;
 RETURN NEW; END $$;
--> statement-breakpoint
CREATE TRIGGER valid_portal_action BEFORE INSERT ON portal_actions FOR EACH ROW EXECUTE FUNCTION validate_portal_action();
--> statement-breakpoint
CREATE FUNCTION validate_portal_supersession() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.snapshot_id=NEW.replacement_id OR NOT EXISTS(SELECT 1 FROM portal_snapshots a JOIN portal_snapshots b ON a.project_id=b.project_id WHERE a.id=NEW.snapshot_id AND b.id=NEW.replacement_id) THEN RAISE EXCEPTION 'Portal replacement ancestry mismatch'; END IF; RETURN NEW; END $$;
--> statement-breakpoint
CREATE TRIGGER valid_portal_supersession BEFORE INSERT ON portal_supersessions FOR EACH ROW EXECUTE FUNCTION validate_portal_supersession();
