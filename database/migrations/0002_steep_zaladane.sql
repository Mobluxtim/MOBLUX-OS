CREATE TABLE "csv_import_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"profile" text NOT NULL,
	"status" text NOT NULL,
	"result" jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "csv_import_attempts_source_id_request_id_unique" UNIQUE("source_id","request_id")
);
--> statement-breakpoint
ALTER TABLE "csv_import_attempts" ADD CONSTRAINT "csv_import_attempts_source_id_source_files_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "csv_import_attempts" ADD CONSTRAINT "csv_import_attempts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE TRIGGER immutable_csv_import BEFORE UPDATE OR DELETE ON csv_import_attempts FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
--> statement-breakpoint
ALTER TABLE csv_import_attempts ADD CONSTRAINT csv_import_status_valid CHECK (status IN ('NEEDS_REVIEW', 'FAILED'));
--> statement-breakpoint
ALTER TABLE csv_import_attempts ADD CONSTRAINT csv_import_profile_valid CHECK (profile IN ('polyboard-cabinets-7/v1', 'polyboard-cutting-18/v1'));
--> statement-breakpoint
ALTER TABLE csv_import_attempts ADD CONSTRAINT csv_import_result_matches CHECK (result->>'status' = status AND result->>'profile' = profile AND result->>'manufacturingVerified' = 'false');
