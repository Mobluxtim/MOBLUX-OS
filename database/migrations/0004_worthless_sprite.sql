CREATE TABLE "library_match_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_id" uuid NOT NULL,
	"snapshot_ids" jsonb NOT NULL,
	"matcher_version" text NOT NULL,
	"input_key" text NOT NULL,
	"results" jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "library_match_reports_model_id_input_key_matcher_version_unique" UNIQUE("model_id","input_key","matcher_version")
);
--> statement-breakpoint
CREATE TABLE "library_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" text NOT NULL,
	"filename" text NOT NULL,
	"hash" text NOT NULL,
	"size" integer NOT NULL,
	"parser_version" text NOT NULL,
	"object_key" text NOT NULL,
	"object_version" text,
	"status" text NOT NULL,
	"record_count" integer NOT NULL,
	"result" jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "library_snapshots_object_key_unique" UNIQUE("object_key"),
	CONSTRAINT "library_snapshots_category_hash_parser_version_unique" UNIQUE("category","hash","parser_version")
);
--> statement-breakpoint
ALTER TABLE "library_match_reports" ADD CONSTRAINT "library_match_reports_model_id_technical_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."technical_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_match_reports" ADD CONSTRAINT "library_match_reports_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_snapshots" ADD CONSTRAINT "library_snapshots_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE TRIGGER immutable_library_snapshot BEFORE UPDATE OR DELETE ON library_snapshots FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
--> statement-breakpoint
CREATE TRIGGER immutable_library_match BEFORE UPDATE OR DELETE ON library_match_reports FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
--> statement-breakpoint
ALTER TABLE library_snapshots ADD CONSTRAINT library_snapshot_valid CHECK (
 category IN ('PANEL', 'EDGE', 'BAR') AND status IN ('NEEDS_REVIEW', 'FAILED') AND size > 0 AND size <= 262144
 AND record_count BETWEEN 0 AND 2000 AND record_count = jsonb_array_length(result->'records')
 AND status = result->>'status' AND record_count = (result->>'recordCount')::int
 AND (status <> 'FAILED' OR record_count = 0));
