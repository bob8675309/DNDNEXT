-- Canonical spell grants need a stable source identity so the same spell can be
-- granted independently by a class, subclass, species, background, or repeatable
-- feat instance.  The v3 Forge path already models this identity; add the missing
-- production columns before wiring creation/level-up to that path.

alter table public.character_spells
  add column if not exists source_key text,
  add column if not exists known boolean not null default true;

update public.character_spells
set source_key = coalesce(
  nullif(btrim(raw_payload ->> 'sourceKey'), ''),
  nullif(lower(regexp_replace(btrim(coalesce(source_label,'')), '[^a-zA-Z0-9]+', '-', 'g')), ''),
  lower(coalesce(nullif(btrim(source_type),''), 'class'))
)
where source_key is null or btrim(source_key) = '';

alter table public.character_spells
  alter column source_key set default 'class',
  alter column source_key set not null;

create unique index if not exists character_spells_source_identity_uidx
  on public.character_spells(character_id, spell_id, source_type, source_key);

create index if not exists character_spells_character_source_idx
  on public.character_spells(character_id, source_type, source_key);

comment on column public.character_spells.source_key is
  'Stable identity of the granting class/subclass/species/background/feat instance. Distinguishes independent grants of the same spell.';
comment on column public.character_spells.known is
  'Whether this source currently grants knowledge/access to the spell. Prepared state remains independent.';
