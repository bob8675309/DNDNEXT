-- Correct source-choice normalization after live source-catalog smoke testing.
-- Standalone catalog keys such as acrobatics|XPHB should drop their source suffix,
-- while complete feature documents containing many pipe-delimited references must retain
-- all text so choices such as Riposte can be found anywhere in the source payload.

create or replace function private.normalize_player_choice_name_v1(p_value text)
returns text
language sql
immutable
parallel safe
as $$
  select regexp_replace(
    lower(
      case
        when coalesce(btrim(p_value), '') ~ '^[^|[:space:]{}\[\]":,]+\|[^|[:space:]{}\[\]":,]+(?:\|.*)?$'
          then split_part(btrim(p_value), '|', 1)
        else coalesce(btrim(p_value), '')
      end
    ),
    '[^a-z0-9]+',
    '',
    'g'
  );
$$;

revoke all on function private.normalize_player_choice_name_v1(text) from public, anon, authenticated;
grant execute on function private.normalize_player_choice_name_v1(text) to service_role;
