CREATE TABLE "material_requirement_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resolution_id" uuid NOT NULL,
	"algorithm_version" text NOT NULL,
	"result" jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "material_requirement_reports_resolution_id_algorithm_version_unique" UNIQUE("resolution_id","algorithm_version")
);
--> statement-breakpoint
ALTER TABLE "material_requirement_reports" ADD CONSTRAINT "material_requirement_reports_resolution_id_material_resolution_reports_id_fk" FOREIGN KEY ("resolution_id") REFERENCES "public"."material_resolution_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_requirement_reports" ADD CONSTRAINT "material_requirement_reports_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE TRIGGER immutable_material_requirements BEFORE UPDATE OR DELETE ON material_requirement_reports FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
--> statement-breakpoint
CREATE FUNCTION validate_material_requirement_ancestry() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM material_resolution_reports r JOIN technical_models m ON m.id=r.model_id
 WHERE r.id=NEW.resolution_id AND NEW.result->>'modelId'=m.id::text AND NEW.result->>'versionId'=m.version_id::text) THEN
 RAISE EXCEPTION 'Material requirements must reference the exact resolved model/version';
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER valid_material_requirement_ancestry BEFORE INSERT ON material_requirement_reports FOR EACH ROW EXECUTE FUNCTION validate_material_requirement_ancestry();
