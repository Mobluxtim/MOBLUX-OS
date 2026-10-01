CREATE TABLE "optimization_requirement_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"resolution_id" uuid NOT NULL,
	"source_hash" text NOT NULL,
	"parser_version" text NOT NULL,
	"status" text NOT NULL,
	"result" jsonb,
	"finding" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "optimization_requirement_reports_model_id_source_id_resolution_id_parser_version_unique" UNIQUE("model_id","source_id","resolution_id","parser_version")
);
--> statement-breakpoint
ALTER TABLE "optimization_requirement_reports" ADD CONSTRAINT "optimization_requirement_reports_model_id_technical_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."technical_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "optimization_requirement_reports" ADD CONSTRAINT "optimization_requirement_reports_source_id_source_files_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "optimization_requirement_reports" ADD CONSTRAINT "optimization_requirement_reports_resolution_id_material_resolution_reports_id_fk" FOREIGN KEY ("resolution_id") REFERENCES "public"."material_resolution_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "optimization_requirement_reports" ADD CONSTRAINT "optimization_requirement_reports_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE TRIGGER immutable_optimization_reports BEFORE UPDATE OR DELETE ON optimization_requirement_reports FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
--> statement-breakpoint
CREATE FUNCTION validate_optimization_ancestry() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM technical_models m JOIN material_resolution_reports r ON r.model_id=m.id JOIN source_files s ON s.project_id=m.project_id
 WHERE m.id=NEW.model_id AND r.id=NEW.resolution_id AND s.id=NEW.source_id AND s.hash=NEW.source_hash
 AND s.version_id IN (m.version_id,m.base_version_id)) THEN
 RAISE EXCEPTION 'Optimization report must preserve exact model/resolution/source ancestry';
 END IF;
 IF NEW.status NOT IN ('IMPORTED','FAILED','UNSUPPORTED') OR (NEW.status='IMPORTED') IS DISTINCT FROM (NEW.result IS NOT NULL) THEN
 RAISE EXCEPTION 'Invalid optimization report state';
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER valid_optimization_ancestry BEFORE INSERT ON optimization_requirement_reports FOR EACH ROW EXECUTE FUNCTION validate_optimization_ancestry();
