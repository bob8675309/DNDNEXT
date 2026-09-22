# Character Progression v3 Implementation Status

Updated: 2026-09-21

Status: **reconciliation pointer; the previous file was an accidental path-probe placeholder and contained no implementation status.**

Do not use this file as an independent progression authority. The implemented Character Progression v3 contracts are documented across the dedicated progression/Forge ledgers:

- `Character_Progression_Foundation.md` — normalized character progression, XP/level review, subclass and persistent-choice foundation;
- `Character_Progression_and_Higher_Level_Forge.md` — direct higher-level creation versus earned progression parity;
- `Unified_Character_Forge_Status.md` — current creation/progression/runtime lifecycle routing;
- `Player_Forge_Choice_Routing_and_Source_Magic_Status.md` — source-owned choice placement and magic materialization;
- feature-specific `*_Runtime_Status.md` ledgers — rest/per-use/runtime lifecycles that must not be converted into permanent progression state.

## Governing v3 boundary

Current player creation remains server-authoritative through `create_player_character_v3`.

Earned progression must converge with direct creation for persistent source-owned acquisitions at the same attained level while preserving lifecycle distinctions:

- permanent acquisition/attained-level choice → Forge/progression authority;
- proficiency-dependent permanent choice → Training;
- spellbook-dependent permanent choice → Spells/progression;
- rest-configurable or rest-expiring choice → runtime authority;
- per-use/per-cast choice → action/spell resolver.

Do not create a second v3 progression state model merely because a new presentation control is added.

## Live-state rule

Before changing progression:

1. inspect current source callers and validators;
2. inspect the relevant live Supabase functions/grants/catalogue rows;
3. verify current migration state rather than relying on historical migration numbers in old ledgers;
4. keep tactical/world/crafting boundaries separate unless explicitly in scope.

At the 2026-09-21 documentation reconciliation, live Supabase had 218 registered migrations; the latest was `20260921185225 admin_site_activity_hardening_v1`. That latest migration is unrelated to progression but demonstrates why old migration-number headers must not be treated as current database authority.
