-- Approved 2024 Basic Rules source facts only; exact canonical source keys.
-- SOURCE READ MODEL. Staged on draft #260; no effect, rest, action or DB writes.
-- Keep in sync with scripts/fixtures/verified_item_attunement_2024.json.
-- D&D Beyond 2024 Basic Rules, Magic Items A–Z:
-- https://www.dndbeyond.com/sources/dnd/br-2024/magic-items-a-z
-- DO NOT generalize 2014 Ring of Fire Resistance to 2024 Ring of Resistance:
-- the 2024 Ring of Resistance explicitly does NOT require attunement.
create or replace function private.verified_item_attunement_rule_v1(p_item_key text)
returns jsonb
language sql
immutable
security invoker
set search_path=pg_catalog,public,private
as $f$
select case p_item_key
 when 'Ring of Protection|XDMG' then
  '{"attunement":"required","source":"br-2024","heading":"Ring of Protection","classKeys":[]}'::jsonb
 when 'Cloak of Protection|XDMG' then
  '{"attunement":"required","source":"br-2024","heading":"Cloak of Protection","classKeys":[]}'::jsonb
 when 'Boots of Speed|XDMG' then
  '{"attunement":"required","source":"br-2024","heading":"Boots of Speed","classKeys":[]}'::jsonb
 when 'Staff of Power|XDMG' then
  '{"attunement":"required","source":"br-2024","heading":"Staff of Power","classKeys":["sorcerer","warlock","wizard"]}'::jsonb
 else '{"attunement":"unknown","source":"not_verified"}'::jsonb
end;
$f$;
revoke all on function private.verified_item_attunement_rule_v1(text)
from public,anon,authenticated;
grant execute on function private.verified_item_attunement_rule_v1(text)
to service_role;
comment on function private.verified_item_attunement_rule_v1(text) is
'Curated 2024 exact item-key requirement source facts; service-only and never authorizes any magic, bond, action, or game-state mutation.';
