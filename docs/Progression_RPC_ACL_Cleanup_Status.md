# Progression RPC ACL Cleanup — Status

Status: **deployed and accepted** on PR #170.

## Scope

The bounded progression/class-choice RPC audit found that current client compatibility code still references v1, v2, and v3 class-choice getter surfaces. The remaining anonymous exposure in that specific compatibility family was `public.get_character_level_class_choice_options_v2(...)`.

Deleting or renaming v2 would have broken a live fallback path, so migration 85 hardened privileges only.

## Migration 85

`progression_rpc_acl_cleanup` (`20260810002421`) performs, for every v2 overload:

- revoke EXECUTE from `PUBLIC`;
- revoke EXECUTE from `anon`;
- explicitly grant EXECUTE to `authenticated`;
- explicitly grant EXECUTE to `service_role`;
- fail closed if the expected v2 compatibility function is absent.

The function body and signature are not replaced by this migration.

## Acceptance

Pre-deploy and deployed checks proved:

- v2 remains present;
- anonymous execute is false;
- authenticated/service-role execute remains enabled;
- v1/v3 compatibility references remain in client source;
- v1/v3 remain non-anonymous in the audited class-choice getter family;
- an actual PostgreSQL `authenticated` role with JWT claims successfully invoked the retained v2 overload using its live signature;
- rollback fixtures left zero residue;
- protected production counts were unchanged.

This ledger covers the **bounded class-choice compatibility cleanup** only. Supabase security advisors still report other older SECURITY DEFINER surfaces elsewhere in the project; those require separate source/usage audits and are not authorization to broaden PR #170 into unrelated systems.

## Protected boundaries

No world-map, town/city-map, route/travel/weather, crafting/inventory, or tactical combat execution behavior is changed here.
