CREATE FUNCTION reject_immutable_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Immutable record: % cannot be updated or deleted', TG_TABLE_NAME;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER immutable_version BEFORE UPDATE OR DELETE ON project_versions FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
--> statement-breakpoint
CREATE TRIGGER immutable_source BEFORE UPDATE OR DELETE ON source_files FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
--> statement-breakpoint
CREATE TRIGGER immutable_import BEFORE UPDATE OR DELETE ON import_attempts FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
--> statement-breakpoint
CREATE TRIGGER immutable_audit BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
--> statement-breakpoint
ALTER TABLE users ADD CONSTRAINT user_kind_valid CHECK (kind IN ('staff', 'customer'));
--> statement-breakpoint
ALTER TABLE project_versions ADD CONSTRAINT version_number_positive CHECK (number > 0);
--> statement-breakpoint
ALTER TABLE source_files ADD CONSTRAINT source_size_valid CHECK (size > 0 AND size <= 20971520);
--> statement-breakpoint
ALTER TABLE import_attempts ADD CONSTRAINT import_status_valid CHECK (status = 'PENDING_MAPPING');
