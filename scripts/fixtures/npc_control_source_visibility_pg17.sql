-- Research-only production-shaped security boundary for delegated NPC control.
-- Exact access-helper decision structure sourced from live read-only pg_proc
-- on 2026-11-01. This is NOT an applied DnDWeb migration.
create or replace function private.can_access_character_v1(
  p_character_id uuid,p_permission text default 'read'
) returns boolean language sql stable security definer
set search_path to 'pg_catalog','public','private','auth'
as $real_read$
  select private.current_user_is_admin()
    or exists (
      select 1 from public.character_permissions cp
      where cp.character_id = p_character_id
        and cp.user_id = auth.uid()
        and case lower(coalesce(p_permission,'read'))
          when 'inventory' then cp.can_inventory or cp.can_edit
          when 'convert' then cp.can_convert or cp.can_edit
          when 'edit' then cp.can_edit
          else cp.can_inventory or cp.can_edit or cp.can_convert
        end
    );
$real_read$;
-- Existing live character table has NO direct authenticated SELECT grant.
-- Copying only its RLS policy while granting SELECT would misrepresent live API.
revoke select on public.characters from authenticated,anon;
alter table public.characters enable row level security;
create policy p2_chars_visible_or_assigned on public.characters for select to authenticated
using(
  not coalesce(is_hidden,false) or
  (select private.can_access_character_v1(characters.id,'read'))
);
create table public.character_sheets (
  character_id uuid primary key,sheet jsonb not null
);
alter table public.character_sheets enable row level security;
grant select on public.character_sheets to authenticated;
create policy p2_sheet_visible_or_assigned on public.character_sheets for select to authenticated
using(exists(
  select 1 from public.characters c where c.id=character_sheets.character_id
));
insert into public.character_sheets(character_id,sheet)
values(public.p2_id(32),'{"gmNotes":"NPC_SECRET_NEVER_SEND_TO_COMPANION_CONTROLLER","abilities":{"int":{"score":16}}}'::jsonb);
-- Existing spell assignments are allowed through character visibility, not
-- by a can_control grant. Source RLS can error when characters SELECT is not
-- granted; the client must never treat an error as permission granted.
alter table public.character_spells enable row level security;
grant select on public.character_spells to authenticated;
create policy p2_spell_visible_or_assigned on public.character_spells for select to authenticated
using(exists(
  select 1 from public.characters c where c.id=character_spells.character_id
));
-- Simplified inventory row visibility based on live owner/admin policy.
create table public.inventory_items(
  id uuid primary key,user_id uuid,item_name text not null
);
alter table public.inventory_items enable row level security;
grant select on public.inventory_items to authenticated;
create policy p2_items_owner_or_admin on public.inventory_items for select to authenticated
using(user_id=(select auth.uid()) or (select private.current_user_is_admin()));
insert into public.inventory_items(id,user_id,item_name)
values(public.p2_id(1998),public.p2_id(1999),'NPC_SECRET_GM_INVENTORY');
-- ONLY in the disposable LOCAL JWT fixture: expose a narrow boolean-only
-- probe to assert the real private access helper's policy contract.
create function public.p2_local_can_access_character(
  p_character_id uuid,p_permission text
) returns boolean language sql stable security definer
set search_path = pg_catalog,public,private,auth
as $probe$
select private.can_access_character_v1(p_character_id,p_permission)
$probe$;
revoke all on function public.p2_local_can_access_character(uuid,text)
from public,anon,service_role;
grant execute on function public.p2_local_can_access_character(uuid,text)
to authenticated;
-- SECURITY CHECK: testing source-policy denials must not unmask hidden NPCs.
do $acl$
begin
 if has_table_privilege('authenticated','public.characters','SELECT')
 or has_function_privilege('anon',
  'public.p2_local_can_access_character(uuid,text)','EXECUTE')
 then raise exception 'Local NPC sheet boundary mismatches production grant'; end if;
end $acl$;
notify pgrst,'reload schema';
