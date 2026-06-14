-- DNDNext crafting workflow v6 hotfix
-- Admin-only catalog stock is virtual and must not be consumed from inventory.

with sanitized as (
  select
    plan.id,
    coalesce(
      jsonb_agg(
        case
          when coalesce(material->>'inventory_item_id', '') like 'catalog-%' then
            jsonb_set(
              jsonb_set(
                jsonb_set(
                  material || jsonb_build_object('virtual_catalog_id', material->>'inventory_item_id'),
                  '{inventory_item_id}',
                  'null'::jsonb,
                  true
                ),
                '{quantity_required}',
                '0'::jsonb,
                true
              ),
              '{is_admin_virtual}',
              'true'::jsonb,
              true
            )
          else material
        end
        order by ordinal
      ),
      '[]'::jsonb
    ) as materials
  from public.craft_plans as plan
  cross join lateral jsonb_array_elements(coalesce(plan.selected_materials, '[]'::jsonb))
    with ordinality as entries(material, ordinal)
  where exists (
    select 1
    from jsonb_array_elements(coalesce(plan.selected_materials, '[]'::jsonb)) as candidate
    where coalesce(candidate->>'inventory_item_id', '') like 'catalog-%'
  )
  group by plan.id
)
update public.craft_plans as plan
set selected_materials = sanitized.materials,
    plan_payload = jsonb_set(coalesce(plan.plan_payload, '{}'::jsonb), '{selected_materials}', sanitized.materials, true),
    result_item_payload = jsonb_set(coalesce(plan.result_item_payload, '{}'::jsonb), '{selected_materials}', sanitized.materials, true),
    updated_at = now()
from sanitized
where plan.id = sanitized.id;
