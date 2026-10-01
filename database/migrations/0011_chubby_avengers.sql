CREATE TABLE "cost_rule_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"sequence" serial NOT NULL,
	"previous_id" uuid,
	"request_id" uuid NOT NULL,
	"payload_hash" text NOT NULL,
	"rules" jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cost_rule_versions_sequence_unique" UNIQUE("sequence"),
	CONSTRAINT "cost_rule_versions_project_id_request_id_unique" UNIQUE("project_id","request_id")
);
--> statement-breakpoint
CREATE TABLE "costing_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"model_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"rule_version_id" uuid NOT NULL,
	"inputs" jsonb NOT NULL,
	"input_key" text NOT NULL,
	"algorithm_version" text NOT NULL,
	"result" jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "costing_runs_model_id_rule_version_id_input_key_algorithm_version_unique" UNIQUE("model_id","rule_version_id","input_key","algorithm_version")
);
--> statement-breakpoint
ALTER TABLE "cost_rule_versions" ADD CONSTRAINT "cost_rule_versions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_rule_versions" ADD CONSTRAINT "cost_rule_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "costing_runs" ADD CONSTRAINT "costing_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "costing_runs" ADD CONSTRAINT "costing_runs_model_id_technical_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."technical_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "costing_runs" ADD CONSTRAINT "costing_runs_version_id_project_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."project_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "costing_runs" ADD CONSTRAINT "costing_runs_rule_version_id_cost_rule_versions_id_fk" FOREIGN KEY ("rule_version_id") REFERENCES "public"."cost_rule_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "costing_runs" ADD CONSTRAINT "costing_runs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE TRIGGER immutable_cost_rules BEFORE UPDATE OR DELETE ON cost_rule_versions FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
--> statement-breakpoint
CREATE TRIGGER immutable_cost_run BEFORE UPDATE OR DELETE ON costing_runs FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
--> statement-breakpoint
CREATE FUNCTION validate_cost_ancestry() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM technical_models m JOIN cost_rule_versions r ON r.project_id=m.project_id
 WHERE m.id=NEW.model_id AND m.version_id=NEW.version_id AND m.project_id=NEW.project_id AND r.id=NEW.rule_version_id) THEN
 RAISE EXCEPTION 'Costing model/version/rule ancestry mismatch'; END IF;
 IF NEW.inputs->>'bomId' IS NOT NULL AND NOT EXISTS (
 SELECT 1 FROM material_requirement_reports b JOIN material_resolution_reports r ON r.id=b.resolution_id
 WHERE b.id::text=NEW.inputs->>'bomId' AND r.model_id=NEW.model_id AND b.result->>'versionId'=NEW.version_id::text) THEN
 RAISE EXCEPTION 'Costing BOM ancestry mismatch'; END IF;
 IF NEW.inputs->>'optimizationId' IS NOT NULL AND NOT EXISTS (
 SELECT 1 FROM optimization_requirement_reports o WHERE o.id::text=NEW.inputs->>'optimizationId' AND o.model_id=NEW.model_id AND o.status='IMPORTED'
 AND (NEW.inputs->>'bomId' IS NULL OR EXISTS (SELECT 1 FROM material_requirement_reports b WHERE b.id::text=NEW.inputs->>'bomId' AND b.resolution_id=o.resolution_id))) THEN
 RAISE EXCEPTION 'Costing optimization ancestry mismatch'; END IF;
 IF NEW.inputs->>'hardwareId' IS NOT NULL AND NOT EXISTS (
 SELECT 1 FROM hardware_bom_reports h WHERE h.id::text=NEW.inputs->>'hardwareId' AND h.model_id=NEW.model_id AND h.version_id=NEW.version_id AND h.status='IMPORTED') THEN
 RAISE EXCEPTION 'Costing hardware ancestry mismatch'; END IF;
 IF NEW.inputs->>'machiningId' IS NOT NULL AND NOT EXISTS (
 SELECT 1 FROM machining_bom_reports m WHERE m.id::text=NEW.inputs->>'machiningId' AND m.model_id=NEW.model_id AND m.version_id=NEW.version_id AND m.status='IMPORTED') THEN
 RAISE EXCEPTION 'Costing machining ancestry mismatch'; END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER valid_cost_ancestry BEFORE INSERT ON costing_runs FOR EACH ROW EXECUTE FUNCTION validate_cost_ancestry();
--> statement-breakpoint
CREATE FUNCTION validate_cost_rule_ancestry() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.previous_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM cost_rule_versions r WHERE r.id=NEW.previous_id AND r.project_id=NEW.project_id) THEN
 RAISE EXCEPTION 'Cost rule predecessor ancestry mismatch'; END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER valid_cost_rule_ancestry BEFORE INSERT ON cost_rule_versions FOR EACH ROW EXECUTE FUNCTION validate_cost_rule_ancestry();
