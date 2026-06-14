-- DNDNext crafting workflow v6 hotfix
-- Admin-only catalog stock is virtual and must not be consumed from inventory.

update public.craft_plans as plan
set selected_materials = sanitized.materials,
    plan_payload = jsonb_set(
      coalesce(plan.plan_payload, '{}'::jsonb),
      '{selected_materials}',
      sanitized.materials,
      true
    ),
    result_item_payload = jsonb_set(
      coalesce(plan.result_item_payload, '{}'::jsonb),
      '{selected_materials}',
      sanitized.materials,
      true
    ),
    updated_at = now()
from lateral (
  select coalesce(
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
  from jsonb_array_elements(coalesce(plan.selected_materials, '[]'::jsonb)) with ordinality as entries(material, ordinal)
) as sanitized
where exists (
  select 1
  from jsonb_array_elements(coalesce(plan.selected_materials, '[]'::jsonb)) as material
  where coalesce(material->>'inventory_item_id', '') like 'catalog-%'
);
