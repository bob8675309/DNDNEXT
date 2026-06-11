-- v9 bomb area and saving-throw metadata.
-- Safe/idempotent; v8 must already have created the individual bomb recipes.
BEGIN;
WITH seed AS (
  SELECT * FROM jsonb_to_recordset($alchemy_v9$[{"name":"Bomb of Blindness","base_area_feet":10,"area_shape":"radius cloud","save_ability":"Constitution"},{"name":"Bomb of Charm","base_area_feet":10,"area_shape":"radius cloud","save_ability":"Wisdom"},{"name":"Bomb of Confusion","base_area_feet":10,"area_shape":"radius cloud","save_ability":"Wisdom"},{"name":"Bomb of Deafness","base_area_feet":10,"area_shape":"radius cloud","save_ability":"Constitution"},{"name":"Bomb of Fear","base_area_feet":10,"area_shape":"radius cloud","save_ability":"Wisdom"},{"name":"Bomb of Paralysis","base_area_feet":10,"area_shape":"radius cloud","save_ability":"Constitution"},{"name":"Bomb of Petrification","base_area_feet":10,"area_shape":"radius cloud","save_ability":"Constitution"},{"name":"Bomb of Poisoning","base_area_feet":10,"area_shape":"radius cloud","save_ability":"Constitution"},{"name":"Bomb of Restraint","base_area_feet":10,"area_shape":"radius cloud","save_ability":"Dexterity"},{"name":"Bomb of Stunning","base_area_feet":10,"area_shape":"radius cloud","save_ability":"Constitution"},{"name":"Bomb of Acid","base_area_feet":10,"area_shape":"radius burst","save_ability":"Dexterity"},{"name":"Bomb of Cold","base_area_feet":10,"area_shape":"radius burst","save_ability":"Dexterity"},{"name":"Bomb of Fire","base_area_feet":10,"area_shape":"radius burst","save_ability":"Dexterity"},{"name":"Bomb of Force","base_area_feet":10,"area_shape":"radius burst","save_ability":"Dexterity"},{"name":"Bomb of Lightning","base_area_feet":10,"area_shape":"radius burst","save_ability":"Dexterity"},{"name":"Bomb of Necrotic","base_area_feet":10,"area_shape":"radius burst","save_ability":"Constitution"},{"name":"Bomb of Poison","base_area_feet":10,"area_shape":"radius burst","save_ability":"Constitution"},{"name":"Bomb of Psychic","base_area_feet":10,"area_shape":"radius burst","save_ability":"Wisdom"},{"name":"Bomb of Radiant","base_area_feet":10,"area_shape":"radius burst","save_ability":"Dexterity"},{"name":"Bomb of Thunder","base_area_feet":10,"area_shape":"radius burst","save_ability":"Constitution"}]$alchemy_v9$::jsonb)
    AS x(name text, base_area_feet numeric, area_shape text, save_ability text)
)
UPDATE public.recipes target
SET base_area_feet=seed.base_area_feet,
    area_shape=seed.area_shape,
    save_ability=seed.save_ability,
    updated_at=now()
FROM seed
WHERE lower(target.name)=lower(seed.name)
  AND target.alchemy_section='Bombs';
COMMIT;
