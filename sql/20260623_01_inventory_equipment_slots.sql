-- Equipment diagram slot support.
-- Adds a nullable UI placement field to inventory_items without changing existing equipped behavior.

alter table public.inventory_items
  add column if not exists equip_slot text;

comment on column public.inventory_items.equip_slot is
  'Optional equipment diagram slot key for equipped inventory items. Existing is_equipped remains the source of equipped state.';

create index if not exists inventory_items_owner_equipped_slot_idx
  on public.inventory_items (owner_type, owner_id, is_equipped, equip_slot);
