-- DNDNext Crafting Attempt Reports Workspace Helper
-- Safe to run after previous crafting_attempts migrations.
-- This keeps attempt reports readable/searchable in the Craft Plans workspace.

alter table public.crafting_attempts disable row level security;

grant select, insert on table public.crafting_attempts to anon, authenticated;

create index if not exists crafting_attempts_plan_created_at_idx
on public.crafting_attempts(craft_plan_id, created_at desc);

create index if not exists crafting_attempts_result_created_at_idx
on public.crafting_attempts(result_tier, created_at desc);

create index if not exists crafting_attempts_actor_created_at_idx
on public.crafting_attempts(actor_character_name, created_at desc);

notify pgrst, 'reload schema';
