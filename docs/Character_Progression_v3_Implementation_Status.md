# Character Progression v3 Implementation Status

Updated: 2026-10-08

Status: **reconciliation pointer.** The previous `main` file was an accidental path-probe placeholder and contained no implementation status.

Do not use this file as an independent progression authority. Character Progression v3 contracts are documented across the dedicated progression/Forge ledgers:

- `Character_Progression_Foundation.md` — normalized progression, XP/level review, subclass and persistent-choice foundation;
- `Character_Progression_and_Higher_Level_Forge.md` — direct higher-level creation versus earned progression parity;
- `Unified_Character_Forge_Status.md` — shared creation/progression/runtime lifecycle routing;
- `Player_Forge_Choice_Routing_and_Source_Magic_Status.md` — source-owned choice placement and magic materialization;
- feature-specific `*_Runtime_Status.md` ledgers — rest/per-use/runtime lifecycles that must not be converted into permanent progression state.

## Governing v3 boundary

Player creation remains server-authoritative through `create_player_character_v3`.

Earned progression must converge with direct creation for persistent source-owned acquisitions at the same attained level while preserving lifecycle distinctions:

- permanent acquisition / attained-level choice → Forge/progression authority;
- proficiency-dependent permanent choice → Training;
- spellbook-dependent permanent choice → Spells/progression;
- rest-configurable or rest-expiring choice → runtime authority;
- per-use/per-cast choice → action/spell resolver.

Do not create a second progression state model merely because a new presentation control is added.

## 2026-10-08 Forge/level-up reconciliation

Merged PR #202 extends the existing shared choice model rather than creating a parallel path:

- Metamagic Adept requires two distinct source-backed Metamagic selections;
- earned level-up loads the canonical Metamagic option catalogue before validating nested feat choices;
- unsupported Metamagic Adept replacement cadence is not advertised;
- Eldritch Invocation option details use the current player-facing guide/summary fallback when imported descriptions are absent;
- Forge spell browsing uses the established list + shared SpellCard presentation without changing spell ownership authority.

These are presentation/choice-routing changes over existing server-authoritative creation/progression contracts; they do not create new database authority.

## Live-state rule

Before changing progression:

1. inspect current source callers and focused validators;
2. inspect the relevant live Supabase functions/grants/catalogue rows when database-backed behavior is in scope;
3. verify current migration state rather than relying on historical migration counts in old ledgers;
4. preserve world/town/tactical/crafting boundaries unless explicitly in scope.

Live source and live Supabase authority outrank old checkpoint prose.
