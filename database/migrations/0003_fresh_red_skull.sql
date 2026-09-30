CREATE TABLE "cabinets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_id" uuid NOT NULL,
	"report_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"source_row" integer NOT NULL,
	"source_line" integer NOT NULL,
	"name" text NOT NULL,
	"quantity" integer NOT NULL,
	"dimensions" jsonb NOT NULL,
	CONSTRAINT "cabinets_version_id_id_unique" UNIQUE("version_id","id"),
	CONSTRAINT "cabinets_version_id_report_id_source_row_unique" UNIQUE("version_id","report_id","source_row")
);
--> statement-breakpoint
CREATE TABLE "edge_data" (
	"version_id" uuid NOT NULL,
	"part_id" uuid NOT NULL,
	"slot" integer NOT NULL,
	"material" text NOT NULL,
	"thickness" text NOT NULL,
	"unit" text NOT NULL,
	"side" text,
	CONSTRAINT "edge_data_part_id_slot_pk" PRIMARY KEY("part_id","slot")
);
--> statement-breakpoint
CREATE TABLE "technical_materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_id" uuid NOT NULL,
	"key" text NOT NULL,
	"description" text NOT NULL,
	"thickness" text NOT NULL,
	"unit" text NOT NULL,
	CONSTRAINT "technical_materials_version_id_id_unique" UNIQUE("version_id","id"),
	CONSTRAINT "technical_materials_version_id_key_unique" UNIQUE("version_id","key")
);
--> statement-breakpoint
CREATE TABLE "parts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_id" uuid NOT NULL,
	"cabinet_id" uuid,
	"material_id" uuid NOT NULL,
	"report_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"source_row" integer NOT NULL,
	"source_line" integer NOT NULL,
	"link_status" text NOT NULL,
	"data" jsonb NOT NULL,
	CONSTRAINT "parts_version_id_id_unique" UNIQUE("version_id","id"),
	CONSTRAINT "parts_version_id_report_id_source_row_unique" UNIQUE("version_id","report_id","source_row")
);
--> statement-breakpoint
CREATE TABLE "technical_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"base_version_id" uuid NOT NULL,
	"cabinet_report_id" uuid NOT NULL,
	"part_report_id" uuid NOT NULL,
	"normalizer" text NOT NULL,
	"summary" jsonb NOT NULL,
	"issues" jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "technical_models_version_id_unique" UNIQUE("version_id"),
	CONSTRAINT "technical_models_project_id_cabinet_report_id_part_report_id_normalizer_unique" UNIQUE("project_id","cabinet_report_id","part_report_id","normalizer")
);
--> statement-breakpoint
ALTER TABLE "cabinets" ADD CONSTRAINT "cabinets_version_id_project_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."project_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cabinets" ADD CONSTRAINT "cabinets_report_id_csv_import_attempts_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."csv_import_attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cabinets" ADD CONSTRAINT "cabinets_source_id_source_files_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edge_data" ADD CONSTRAINT "edge_data_version_id_part_id_parts_version_id_id_fk" FOREIGN KEY ("version_id","part_id") REFERENCES "public"."parts"("version_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technical_materials" ADD CONSTRAINT "technical_materials_version_id_project_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."project_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parts" ADD CONSTRAINT "parts_version_id_project_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."project_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parts" ADD CONSTRAINT "parts_report_id_csv_import_attempts_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."csv_import_attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parts" ADD CONSTRAINT "parts_source_id_source_files_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parts" ADD CONSTRAINT "parts_version_id_cabinet_id_cabinets_version_id_id_fk" FOREIGN KEY ("version_id","cabinet_id") REFERENCES "public"."cabinets"("version_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parts" ADD CONSTRAINT "parts_version_id_material_id_technical_materials_version_id_id_fk" FOREIGN KEY ("version_id","material_id") REFERENCES "public"."technical_materials"("version_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technical_models" ADD CONSTRAINT "technical_models_cabinet_report_id_csv_import_attempts_id_fk" FOREIGN KEY ("cabinet_report_id") REFERENCES "public"."csv_import_attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technical_models" ADD CONSTRAINT "technical_models_part_report_id_csv_import_attempts_id_fk" FOREIGN KEY ("part_report_id") REFERENCES "public"."csv_import_attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technical_models" ADD CONSTRAINT "technical_models_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technical_models" ADD CONSTRAINT "technical_models_project_id_version_id_project_versions_project_id_id_fk" FOREIGN KEY ("project_id","version_id") REFERENCES "public"."project_versions"("project_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technical_models" ADD CONSTRAINT "technical_models_project_id_base_version_id_project_versions_project_id_id_fk" FOREIGN KEY ("project_id","base_version_id") REFERENCES "public"."project_versions"("project_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE FUNCTION guard_technical_insert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.version_id::text, 1));
  IF NOT EXISTS (SELECT 1 FROM project_versions WHERE id = NEW.version_id AND snapshot->'normalizedData'->>'modelId' IS NOT NULL) THEN
    RAISE EXCEPTION 'Technical rows require a new normalized version';
  END IF;
  IF EXISTS (SELECT 1 FROM technical_models WHERE version_id = NEW.version_id) THEN
    RAISE EXCEPTION 'Technical model is sealed; create a new version';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER guard_cabinet_insert BEFORE INSERT ON cabinets FOR EACH ROW EXECUTE FUNCTION guard_technical_insert();
--> statement-breakpoint
CREATE TRIGGER guard_part_insert BEFORE INSERT ON parts FOR EACH ROW EXECUTE FUNCTION guard_technical_insert();
--> statement-breakpoint
CREATE TRIGGER guard_material_insert BEFORE INSERT ON technical_materials FOR EACH ROW EXECUTE FUNCTION guard_technical_insert();
--> statement-breakpoint
CREATE TRIGGER guard_edge_insert BEFORE INSERT ON edge_data FOR EACH ROW EXECUTE FUNCTION guard_technical_insert();
--> statement-breakpoint
CREATE TRIGGER guard_model_insert BEFORE INSERT ON technical_models FOR EACH ROW EXECUTE FUNCTION guard_technical_insert();
--> statement-breakpoint
CREATE TRIGGER immutable_cabinet BEFORE UPDATE OR DELETE ON cabinets FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
--> statement-breakpoint
CREATE TRIGGER immutable_part BEFORE UPDATE OR DELETE ON parts FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
--> statement-breakpoint
CREATE TRIGGER immutable_material BEFORE UPDATE OR DELETE ON technical_materials FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
--> statement-breakpoint
CREATE TRIGGER immutable_edge BEFORE UPDATE OR DELETE ON edge_data FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
--> statement-breakpoint
CREATE TRIGGER immutable_model BEFORE UPDATE OR DELETE ON technical_models FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
--> statement-breakpoint
ALTER TABLE parts ADD CONSTRAINT part_link_valid CHECK ((link_status = 'LINKED' AND cabinet_id IS NOT NULL) OR (link_status IN ('AMBIGUOUS','UNMAPPED') AND cabinet_id IS NULL));
--> statement-breakpoint
ALTER TABLE parts ADD CONSTRAINT part_locator_valid CHECK (source_row > 0 AND source_line > 0);
--> statement-breakpoint
ALTER TABLE cabinets ADD CONSTRAINT cabinet_locator_quantity_valid CHECK (source_row > 0 AND source_line > 0 AND quantity > 0);
--> statement-breakpoint
ALTER TABLE edge_data ADD CONSTRAINT edge_raw_slot_valid CHECK (slot BETWEEN 1 AND 4 AND side IS NULL AND unit = 'mm');
--> statement-breakpoint
ALTER TABLE technical_materials ADD CONSTRAINT material_unit_valid CHECK (unit = 'mm');
