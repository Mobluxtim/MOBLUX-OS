CREATE TABLE "payment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"payload_hash" text NOT NULL,
	"action" text NOT NULL,
	"reason" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_events_payment_id_action_unique" UNIQUE("payment_id","action"),
	CONSTRAINT "payment_events_payment_id_request_id_unique" UNIQUE("payment_id","request_id")
);
--> statement-breakpoint
CREATE TABLE "payment_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"previous_id" uuid,
	"request_id" uuid NOT NULL,
	"payload_hash" text NOT NULL,
	"reason" text NOT NULL,
	"currency" text NOT NULL,
	"quote_total" text NOT NULL,
	"algorithm" text NOT NULL,
	"milestones" jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_plans_quote_id_number_unique" UNIQUE("quote_id","number"),
	CONSTRAINT "payment_plans_quote_id_request_id_unique" UNIQUE("quote_id","request_id")
);
--> statement-breakpoint
CREATE TABLE "payment_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"milestone_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"payload_hash" text NOT NULL,
	"amount" text NOT NULL,
	"currency" text NOT NULL,
	"payment_date" text NOT NULL,
	"method" text NOT NULL,
	"reference" text NOT NULL,
	"evidence_source_id" uuid,
	"internal_note" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_reports_plan_id_request_id_unique" UNIQUE("plan_id","request_id")
);
--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_payment_id_payment_reports_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_plans" ADD CONSTRAINT "payment_plans_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_plans" ADD CONSTRAINT "payment_plans_version_id_project_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."project_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_plans" ADD CONSTRAINT "payment_plans_quote_id_quote_versions_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quote_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_plans" ADD CONSTRAINT "payment_plans_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_reports" ADD CONSTRAINT "payment_reports_plan_id_payment_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."payment_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_reports" ADD CONSTRAINT "payment_reports_evidence_source_id_source_files_id_fk" FOREIGN KEY ("evidence_source_id") REFERENCES "public"."source_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_reports" ADD CONSTRAINT "payment_reports_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['payment_plans','payment_reports','payment_events'] LOOP EXECUTE format('CREATE TRIGGER immutable_payment BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION reject_immutable_change()',t); END LOOP; END $$;
--> statement-breakpoint
CREATE FUNCTION validate_payment_plan() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM quote_versions q WHERE q.id=NEW.quote_id AND q.project_id=NEW.project_id AND q.version_id=NEW.version_id AND q.content->>'currency'=NEW.currency AND q.result->>'status'='COMPLETE' AND q.result->'totals'->>'withVat'=NEW.quote_total) THEN RAISE EXCEPTION 'Payment plan quote ancestry mismatch'; END IF;
 IF NEW.number<1 OR (NEW.number=1 AND NEW.previous_id IS NOT NULL) OR (NEW.number>1 AND NOT EXISTS(SELECT 1 FROM payment_plans p WHERE p.id=NEW.previous_id AND p.quote_id=NEW.quote_id AND p.number=NEW.number-1)) THEN RAISE EXCEPTION 'Payment plan predecessor mismatch'; END IF;
 IF jsonb_array_length(NEW.milestones)<1 OR jsonb_array_length(NEW.milestones)>50 OR EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.milestones) m WHERE m->>'currency'<>NEW.currency OR (m->>'amount')::numeric<=0) OR (SELECT count(*) FROM jsonb_array_elements(NEW.milestones))<>(SELECT count(DISTINCT m->>'id') FROM jsonb_array_elements(NEW.milestones) m) THEN RAISE EXCEPTION 'Invalid payment milestones'; END IF;
 RETURN NEW; END $$;
--> statement-breakpoint
CREATE TRIGGER valid_payment_plan BEFORE INSERT ON payment_plans FOR EACH ROW EXECUTE FUNCTION validate_payment_plan();
--> statement-breakpoint
CREATE FUNCTION validate_payment_report() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM payment_plans p WHERE p.id=NEW.plan_id AND p.currency=NEW.currency AND EXISTS(SELECT 1 FROM jsonb_array_elements(p.milestones) m WHERE m->>'id'=NEW.milestone_id::text) AND (NEW.evidence_source_id IS NULL OR EXISTS(SELECT 1 FROM source_files f WHERE f.id=NEW.evidence_source_id AND f.project_id=p.project_id AND f.version_id=p.version_id))) OR NEW.amount !~ '^\d{1,12}(\.\d{1,6})?$' OR NEW.amount::numeric<=0 THEN RAISE EXCEPTION 'Payment report evidence/amount mismatch'; END IF;
 RETURN NEW; END $$;
--> statement-breakpoint
CREATE TRIGGER valid_payment_report BEFORE INSERT ON payment_reports FOR EACH ROW EXECUTE FUNCTION validate_payment_report();
--> statement-breakpoint
CREATE FUNCTION validate_payment_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.action NOT IN ('CONFIRMED','REVERSED') OR length(trim(NEW.reason))=0 OR (NEW.action='REVERSED' AND NOT EXISTS(SELECT 1 FROM payment_events WHERE payment_id=NEW.payment_id AND action='CONFIRMED')) OR (NEW.action='CONFIRMED' AND EXISTS(SELECT 1 FROM payment_events WHERE payment_id=NEW.payment_id AND action='REVERSED')) THEN RAISE EXCEPTION 'Invalid payment transition'; END IF; RETURN NEW; END $$;
--> statement-breakpoint
CREATE TRIGGER valid_payment_event BEFORE INSERT ON payment_events FOR EACH ROW EXECUTE FUNCTION validate_payment_event();
