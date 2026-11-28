-- Disposable test authority only. The original grant rows remain the claims.
CREATE TABLE private.i2j_effect_baseline (
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  effect_type text NOT NULL,
  effect_key text NOT NULL,
  preexisting boolean,
  PRIMARY KEY (character_id,effect_type,effect_key)
);
REVOKE ALL ON private.i2j_effect_baseline FROM PUBLIC,anon,authenticated;

CREATE FUNCTION private.i2j_proficiency_effect_keys(effects jsonb)
RETURNS TABLE(effect_type text,effect_key text,introduced boolean)
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,private AS $$
  SELECT effect->>'type', private.normalize_player_choice_name_v1(
    coalesce(effect->>'skill',effect->>'tool',effect->>'weapon','')),
    CASE WHEN jsonb_typeof(effect->'introduced')='boolean'
      THEN (effect->>'introduced')::boolean END
  FROM jsonb_array_elements(effects) effect
  WHERE effect->>'type' IN ('skill-proficiency','tool-proficiency','weapon-proficiency');
$$;

-- The canonical authority has already applied the effect when the grant is
-- inserted. A prior active claim without a baseline is ambiguous, even when
-- one historical row claims to have introduced the effect.
CREATE FUNCTION private.i2j_track_effect_baseline()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,private AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    INSERT INTO private.i2j_effect_baseline(character_id,effect_type,effect_key,preexisting)
    SELECT NEW.character_id,k.effect_type,k.effect_key,
      CASE WHEN NOT private.other_character_option_effect_claim_v1(
        NEW.character_id,NEW.instance_key,k.effect_type,k.effect_key)
      THEN NOT k.introduced END
    FROM private.i2j_proficiency_effect_keys(NEW.effects) k
    WHERE k.effect_key<>''
    ON CONFLICT (character_id,effect_type,effect_key) DO NOTHING;
    RETURN NEW;
  END IF;

  DELETE FROM private.i2j_effect_baseline b
  USING private.i2j_proficiency_effect_keys(OLD.effects) k
  WHERE b.character_id=OLD.character_id AND b.effect_type=k.effect_type AND b.effect_key=k.effect_key
    AND NOT private.other_character_option_effect_claim_v1(
      OLD.character_id,OLD.instance_key,k.effect_type,k.effect_key);
  RETURN OLD;
END;
$$;

CREATE FUNCTION private.i2j_managed_effect_introduced(p_character uuid,p_effect jsonb)
RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog,private AS $$
  SELECT EXISTS (
    SELECT 1 FROM private.i2j_proficiency_effect_keys(jsonb_build_array(p_effect)) k
    JOIN private.i2j_effect_baseline b USING(effect_type,effect_key)
    WHERE b.character_id=p_character AND b.preexisting IS FALSE
  );
$$;

REVOKE ALL ON FUNCTION private.i2j_proficiency_effect_keys(jsonb),
  private.i2j_track_effect_baseline(), private.i2j_managed_effect_introduced(uuid,jsonb)
FROM PUBLIC,anon,authenticated;

CREATE TRIGGER i2j_effect_baseline_lifecycle
AFTER INSERT OR DELETE ON public.character_option_grant_instances
FOR EACH ROW EXECUTE FUNCTION private.i2j_track_effect_baseline();
