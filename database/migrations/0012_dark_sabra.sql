CREATE TABLE "client_presentations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_presentations_version_id_unique" UNIQUE("version_id")
);
--> statement-breakpoint
CREATE TABLE "presentation_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"provenance" text NOT NULL,
	"hash" text NOT NULL,
	"display_hash" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"object_key" text NOT NULL,
	"object_version" text,
	"display_key" text NOT NULL,
	"display_version" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "presentation_assets_object_key_unique" UNIQUE("object_key"),
	CONSTRAINT "presentation_assets_display_key_unique" UNIQUE("display_key"),
	CONSTRAINT "presentation_assets_version_id_request_id_unique" UNIQUE("version_id","request_id")
);
--> statement-breakpoint
CREATE TABLE "presentation_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"presentation_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"previous_id" uuid,
	"request_id" uuid NOT NULL,
	"payload_hash" text NOT NULL,
	"content_hash" text NOT NULL,
	"content" jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "presentation_revisions_presentation_id_number_unique" UNIQUE("presentation_id","number"),
	CONSTRAINT "presentation_revisions_presentation_id_request_id_unique" UNIQUE("presentation_id","request_id")
);
--> statement-breakpoint
ALTER TABLE "client_presentations" ADD CONSTRAINT "client_presentations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_presentations" ADD CONSTRAINT "client_presentations_project_id_version_id_project_versions_project_id_id_fk" FOREIGN KEY ("project_id","version_id") REFERENCES "public"."project_versions"("project_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presentation_assets" ADD CONSTRAINT "presentation_assets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presentation_assets" ADD CONSTRAINT "presentation_assets_project_id_version_id_project_versions_project_id_id_fk" FOREIGN KEY ("project_id","version_id") REFERENCES "public"."project_versions"("project_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presentation_revisions" ADD CONSTRAINT "presentation_revisions_presentation_id_client_presentations_id_fk" FOREIGN KEY ("presentation_id") REFERENCES "public"."client_presentations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presentation_revisions" ADD CONSTRAINT "presentation_revisions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE TRIGGER immutable_client_presentation BEFORE UPDATE OR DELETE ON client_presentations FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
--> statement-breakpoint
CREATE TRIGGER immutable_presentation_revision BEFORE UPDATE OR DELETE ON presentation_revisions FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
--> statement-breakpoint
CREATE TRIGGER immutable_presentation_asset BEFORE UPDATE OR DELETE ON presentation_assets FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
--> statement-breakpoint
CREATE FUNCTION validate_presentation_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_version uuid;
BEGIN
 SELECT version_id INTO target_version FROM client_presentations WHERE id=NEW.presentation_id;
 IF NEW.number < 1 OR (NEW.number=1 AND NEW.previous_id IS NOT NULL) OR (NEW.number>1 AND NOT EXISTS(SELECT 1 FROM presentation_revisions r WHERE r.id=NEW.previous_id AND r.presentation_id=NEW.presentation_id AND r.number=NEW.number-1)) THEN
 RAISE EXCEPTION 'Presentation predecessor ancestry mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.content->'media') m WHERE NOT EXISTS(SELECT 1 FROM presentation_assets a WHERE a.id::text=m->>'assetId' AND a.version_id=target_version)) THEN
 RAISE EXCEPTION 'Presentation media ancestry mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.content->'items') i WHERE i->'reference'->>'kind'='HARDWARE' AND NOT EXISTS(SELECT 1 FROM hardware_bom_reports h WHERE h.id::text=i->'reference'->>'reportId' AND h.version_id=target_version AND h.status='IMPORTED' AND (i->'reference'->>'itemIndex')::integer>=0 AND (i->'reference'->>'itemIndex')::integer<jsonb_array_length(h.result->'items'))) THEN
 RAISE EXCEPTION 'Presentation hardware ancestry mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.content->'items') i WHERE i->'reference'->>'kind'='MATERIAL' AND NOT EXISTS(SELECT 1 FROM material_resolution_reports r JOIN technical_models t ON t.id=r.model_id, jsonb_array_elements(r.results) m WHERE t.version_id=target_version AND m->>'materialMasterId'=i->'reference'->>'materialMasterId')) THEN
 RAISE EXCEPTION 'Presentation material ancestry mismatch'; END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER valid_presentation_revision BEFORE INSERT ON presentation_revisions FOR EACH ROW EXECUTE FUNCTION validate_presentation_revision();
