CREATE TABLE "quote_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"previous_id" uuid,
	"presentation_revision_id" uuid,
	"request_id" uuid NOT NULL,
	"payload_hash" text NOT NULL,
	"content_hash" text NOT NULL,
	"algorithm_version" text NOT NULL,
	"content" jsonb NOT NULL,
	"result" jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_versions_version_id_number_unique" UNIQUE("version_id","number"),
	CONSTRAINT "quote_versions_version_id_request_id_unique" UNIQUE("version_id","request_id")
);
--> statement-breakpoint
ALTER TABLE "quote_versions" ADD CONSTRAINT "quote_versions_presentation_revision_id_presentation_revisions_id_fk" FOREIGN KEY ("presentation_revision_id") REFERENCES "public"."presentation_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD CONSTRAINT "quote_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD CONSTRAINT "quote_versions_project_id_version_id_project_versions_project_id_id_fk" FOREIGN KEY ("project_id","version_id") REFERENCES "public"."project_versions"("project_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE TRIGGER immutable_quote_version BEFORE UPDATE OR DELETE ON quote_versions FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
--> statement-breakpoint
CREATE FUNCTION validate_quote_version() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE presentation_content jsonb;
BEGIN
 IF NEW.number<1 OR (NEW.number=1 AND NEW.previous_id IS NOT NULL) OR (NEW.number>1 AND NOT EXISTS(SELECT 1 FROM quote_versions q WHERE q.id=NEW.previous_id AND q.project_id=NEW.project_id AND q.version_id=NEW.version_id AND q.number=NEW.number-1)) THEN
 RAISE EXCEPTION 'Quote predecessor ancestry mismatch'; END IF;
 IF NEW.presentation_revision_id IS NOT NULL THEN
 SELECT r.content INTO presentation_content FROM presentation_revisions r JOIN client_presentations p ON p.id=r.presentation_id WHERE r.id=NEW.presentation_revision_id AND p.project_id=NEW.project_id AND p.version_id=NEW.version_id;
 IF presentation_content IS NULL THEN RAISE EXCEPTION 'Quote presentation ancestry mismatch'; END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.content->'lines') l WHERE l->>'presentationSectionId' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(presentation_content->'sections') s WHERE s->>'id'=l->>'presentationSectionId' AND s->>'visibility'='CLIENT_PRESENTATION')) THEN
 RAISE EXCEPTION 'Quote presentation section ancestry mismatch'; END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER valid_quote_version BEFORE INSERT ON quote_versions FOR EACH ROW EXECUTE FUNCTION validate_quote_version();
