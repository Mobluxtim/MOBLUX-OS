CREATE TABLE "material_technical_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"material_master_id" uuid NOT NULL,
	"policy_version" text NOT NULL,
	"result" jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "material_technical_profiles_material_master_id_policy_version_unique" UNIQUE("material_master_id","policy_version")
);
--> statement-breakpoint
ALTER TABLE "material_technical_profiles" ADD CONSTRAINT "material_technical_profiles_material_master_id_material_masters_id_fk" FOREIGN KEY ("material_master_id") REFERENCES "public"."material_masters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_technical_profiles" ADD CONSTRAINT "material_technical_profiles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE TRIGGER immutable_material_profiles BEFORE UPDATE OR DELETE ON material_technical_profiles FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
--> statement-breakpoint
CREATE FUNCTION validate_material_profile_ancestry() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM material_masters m JOIN library_snapshots s ON s.id=m.snapshot_id,
 jsonb_array_elements(s.result->'records') r
 WHERE m.id=NEW.material_master_id AND r->>'id'=m.record_id::text
 AND NEW.result->'source'->>'snapshotId'=s.id::text
 AND NEW.result->'source'->>'hash'=s.hash
 AND NEW.result->'source'->>'recordId'=m.record_id::text
 AND NEW.result->'source'->>'candidateUuid'=r->>'candidateUuid'
 AND NEW.result->'source'->>'name'=m.name
 AND NEW.result->>'policyVersion'=NEW.policy_version) THEN
 RAISE EXCEPTION 'Technical profile must preserve exact master/source ancestry and policy';
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER valid_material_profile_ancestry BEFORE INSERT ON material_technical_profiles FOR EACH ROW EXECUTE FUNCTION validate_material_profile_ancestry();
