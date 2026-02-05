-- Allow deleting locations without being blocked by characters pointing at them.
-- We preserve characters and simply clear their pointers.

-- NOTE: Adjusts these FK columns to ON DELETE SET NULL:
--   characters.location_id
--   characters.last_known_location_id
--   characters.projected_destination_id

ALTER TABLE public.characters
  DROP CONSTRAINT IF EXISTS characters_location_id_fkey,
  ADD CONSTRAINT characters_location_id_fkey
    FOREIGN KEY (location_id)
    REFERENCES public.locations(id)
    ON DELETE SET NULL;

ALTER TABLE public.characters
  DROP CONSTRAINT IF EXISTS characters_last_known_location_id_fkey,
  ADD CONSTRAINT characters_last_known_location_id_fkey
    FOREIGN KEY (last_known_location_id)
    REFERENCES public.locations(id)
    ON DELETE SET NULL;

ALTER TABLE public.characters
  DROP CONSTRAINT IF EXISTS characters_projected_destination_id_fkey,
  ADD CONSTRAINT characters_projected_destination_id_fkey
    FOREIGN KEY (projected_destination_id)
    REFERENCES public.locations(id)
    ON DELETE SET NULL;
