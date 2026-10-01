CREATE TABLE "machining_bom_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"source_hash" text NOT NULL,
	"parser_version" text NOT NULL,
	"status" text NOT NULL,
	"result" jsonb,
	"finding" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "machining_bom_reports_version_id_source_id_parser_version_unique" UNIQUE("version_id","source_id","parser_version")
);
--> statement-breakpoint
ALTER TABLE "machining_bom_reports" ADD CONSTRAINT "machining_bom_reports_model_id_technical_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."technical_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machining_bom_reports" ADD CONSTRAINT "machining_bom_reports_version_id_project_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."project_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machining_bom_reports" ADD CONSTRAINT "machining_bom_reports_source_id_source_files_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machining_bom_reports" ADD CONSTRAINT "machining_bom_reports_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE TRIGGER immutable_machining_bom BEFORE UPDATE OR DELETE ON machining_bom_reports FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
--> statement-breakpoint
CREATE FUNCTION validate_machining_bom_ancestry() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM technical_models m JOIN source_files s ON s.project_id=m.project_id
 WHERE m.id=NEW.model_id AND m.version_id=NEW.version_id AND s.id=NEW.source_id AND s.hash=NEW.source_hash
 AND s.version_id IN (m.version_id,m.base_version_id)) THEN
 RAISE EXCEPTION 'Machining BOM must preserve exact project version/model/source ancestry';
 END IF;
 IF NEW.status NOT IN ('IMPORTED','FAILED','UNSUPPORTED') OR (NEW.status='IMPORTED') IS DISTINCT FROM (NEW.result IS NOT NULL) THEN
 RAISE EXCEPTION 'Invalid Machining BOM status';
 END IF;
 IF NEW.result IS NOT NULL AND EXISTS (
 SELECT 1 FROM jsonb_array_elements(NEW.result->'parts') r WHERE r->>'partId' IS NOT NULL AND NOT EXISTS (
 SELECT 1 FROM parts p WHERE p.id::text=r->>'partId' AND p.version_id=NEW.version_id
 AND p.cabinet_id::text IS NOT DISTINCT FROM r->>'cabinetId'
 AND p.source_id::text=r->'csvEvidence'->>'sourceId' AND p.report_id::text=r->'csvEvidence'->>'reportId'
 AND p.source_row=(r->'csvEvidence'->>'row')::integer AND p.source_line=(r->'csvEvidence'->>'line')::integer
 )) THEN RAISE EXCEPTION 'Machining Part ancestry mismatch'; END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER valid_machining_bom_ancestry BEFORE INSERT ON machining_bom_reports FOR EACH ROW EXECUTE FUNCTION validate_machining_bom_ancestry();
