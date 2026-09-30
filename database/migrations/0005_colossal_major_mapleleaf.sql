CREATE TABLE "library_activations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sequence" serial NOT NULL,
	"category" text NOT NULL,
	"snapshot_id" uuid,
	"reason" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "library_activations_sequence_unique" UNIQUE("sequence")
);
--> statement-breakpoint
CREATE TABLE "material_masters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" text NOT NULL,
	"name" text NOT NULL,
	"thickness" text NOT NULL,
	"unit" text NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"record_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "material_masters_snapshot_id_record_id_unique" UNIQUE("snapshot_id","record_id")
);
--> statement-breakpoint
CREATE TABLE "material_resolution_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_id" uuid NOT NULL,
	"input_key" text NOT NULL,
	"resolver_version" text NOT NULL,
	"snapshots" jsonb NOT NULL,
	"results" jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "material_resolution_reports_model_id_input_key_resolver_version_unique" UNIQUE("model_id","input_key","resolver_version")
);
--> statement-breakpoint
ALTER TABLE "library_activations" ADD CONSTRAINT "library_activations_snapshot_id_library_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."library_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_activations" ADD CONSTRAINT "library_activations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_masters" ADD CONSTRAINT "material_masters_snapshot_id_library_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."library_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_masters" ADD CONSTRAINT "material_masters_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_resolution_reports" ADD CONSTRAINT "material_resolution_reports_model_id_technical_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."technical_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_resolution_reports" ADD CONSTRAINT "material_resolution_reports_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE TRIGGER immutable_library_activation BEFORE UPDATE OR DELETE ON library_activations FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
--> statement-breakpoint
CREATE TRIGGER immutable_material_master BEFORE UPDATE OR DELETE ON material_masters FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
--> statement-breakpoint
CREATE TRIGGER immutable_material_resolution BEFORE UPDATE OR DELETE ON material_resolution_reports FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
--> statement-breakpoint
CREATE FUNCTION validate_library_activation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.category NOT IN ('PANEL','EDGE','BAR') OR (NEW.snapshot_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM library_snapshots s WHERE s.id=NEW.snapshot_id AND s.category=NEW.category AND s.status='NEEDS_REVIEW')) THEN
  RAISE EXCEPTION 'Invalid active library category/snapshot';
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER valid_library_activation BEFORE INSERT ON library_activations FOR EACH ROW EXECUTE FUNCTION validate_library_activation();
--> statement-breakpoint
CREATE FUNCTION validate_material_master() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM library_snapshots s, jsonb_array_elements(s.result->'records') r
 WHERE s.id=NEW.snapshot_id AND s.status='NEEDS_REVIEW' AND s.category=NEW.category AND r->>'id'=NEW.record_id::text
 AND r->>'name'=NEW.name AND r->'thickness'->>'confidence'='CORROBORATED'
 AND r->'thickness'->>'unit'=NEW.unit AND (r->'thickness'->>'value')::numeric=NEW.thickness::numeric) THEN
  RAISE EXCEPTION 'Material master requires corroborated source evidence';
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER valid_material_master BEFORE INSERT ON material_masters FOR EACH ROW EXECUTE FUNCTION validate_material_master();
