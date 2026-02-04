-- Allow deleting locations without being blocked by "last known" pointers.
-- This keeps characters intact and simply clears the pointer.

ALTER TABLE public.characters
  DROP CONSTRAINT IF EXISTS characters_last_known_location_id_fkey,
  ADD CONSTRAINT characters_last_known_location_id_fkey
    FOREIGN KEY (last_known_location_id)
    REFERENCES public.locations(id)
    ON DELETE SET NULL;

ALTER TABLE public.characters
  DROP CONSTRAINT IF EXISTS characters_last_known_location_id_fk,
  ADD CONSTRAINT characters_last_known_location_id_fk
    FOREIGN KEY (last_known_location_id)
    REFERENCES public.locations(id)
    ON DELETE SET NULL;

ALTER TABLE public.characters
  DROP CONSTRAINT IF EXISTS characters_location_id_fkey,
  ADD CONSTRAINT characters_location_id_fkey
    FOREIGN KEY (location_id)
    REFERENCES public.locations(id)
    ON DELETE SET NULL;

ALTER TABLE public.characters
  DROP CONSTRAINT IF EXISTS characters_last_location_id_fkey,
  ADD CONSTRAINT characters_last_location_id_fkey
    FOREIGN KEY (last_location_id)
    REFERENCES public.locations(id)
    ON DELETE SET NULL;
