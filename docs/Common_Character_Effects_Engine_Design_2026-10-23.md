# DNDNext — Common Character Effects Foundation

**Status:** Separate draft PR, read-only pure backend calculation; not wired to any production caller. No schema tables, character writes, live Supabase changes, UI modifications or world/town-map changes.

## Preserve existing authorities

Do not replace `private.character_equipment_effects_v1` (mature armor, equipment, ability and skill calculations), `spell_effects` definitions, `encounter_conditions` and `encounter_timed_effects` (combat duration and condition lifecycle), `character_runtime_feature_choices` (feature selection and rest state), or encounter-local immutable combat snapshots. The common evaluator is **under** source adapters, never an alternate owner of their data.

## First reusable function

`private.resolve_effect_bundle_v1(p_base jsonb,p_effects jsonb,p_context jsonb default '{}')` is `IMMUTABLE SECURITY INVOKER`, private-schema, execute-restricted to server code. It has no character ID or tables; it is purely arithmetic. Only a trusted source adapter may create its normalized inputs after checking ownership, entitlement, activation, lifetime and concentration/action economy as appropriate. Never trust raw client-provided effect JSON as gameplay authority.

An input instance has stable `id`, `source`, `stackKey`, `target`, `op`, numeric `value` when relevant, and optional `when` comparisons to authoritative event context. Supported numeric operators: `add`, `minimum`, `multiply`. Supported roll operations: `advantage`, `disadvantage`. Conditional event keys in v1: `event`, `condition`, `skill`. Unrecognized structures fail closed.

The first target vocabulary includes `max_hp`, `speed_ft`, `darkvision_ft`, `ac`, `initiative`, `athletics_check`, `acrobatics_check`, `jump_multiplier`, `climb_speed_ft`, `saving_throw_bonus`, `attack_roll_bonus`, `damage_bonus`, and roll tags `saving_throw`, `ability_check`, `attack_roll`.

**Stacking contract:** identical `stackKey` instances contribute only the largest absolute magnitude; different groups combine. The source adapter chooses stack keys according to actual D&D stacking rules, never from a guessed item name. Operations apply as **base + additions → minimum floor → multiplication**. Advantage and Disadvantage cancel at resolution. Output includes `stats`, `rollModes`, `appliedEffects` for provenance, and skipped/duplicate counts.

Example:
```json
[
  {"id":"parasite:hp","source":"feature:parasite","stackKey":"parasite:hp","target":"max_hp","op":"add","value":3},
  {"id":"longstrider:1","source":"spell:longstrider","stackKey":"spell:longstrider:speed","target":"speed_ft","op":"add","value":10},
  {"id":"parasite:poison","source":"feature:parasite","stackKey":"parasite:poison","target":"saving_throw","op":"advantage","when":{"event":"saving_throw","condition":"poisoned"}}
]
```

The adapter supplies **resolved numeric values**, e.g. Warlock class level 3 → 3 HP. Arbitrary formula strings are not evaluated.

## Explicitly NOT implemented by this first slice

- Duration, expiration, concentration, spell slots, activation timing, permission, item equipment rules, class/subclass eligibility, stacking exception clauses or rules-text interpretation.
- Cross-stat dependency (`climb_speed_ft` equal to effective Speed), damage/healing/current-HP reconciliation, encounter movement legality, vision provenance or save/skill roll integration. Those need source-aware adapters and tactical regression tests.
- Same-magnitude duplicate provenance currently retains the first; numeric values remain equivalent. Stable tie-breaking is required before broader adoption.
- No existing sheet or combat calculation has been switched to this resolver; PR #250 is an **integration reference**, not a permanent pattern to copy into each class feature.

## Development order

1. Isolated Postgres contract tests for numeric stacking, same-spell duplicate prevention, condition-scoped saving throw Advantage and fail-closed parsing. This PR.
2. Side-by-side adapters for existing numeric equipment effects and Physical Specimen; verify parity with unchanged results, without publishing new UI.
3. Adapters for spells, potions, species and encounter conditions that preserve source activation/expiry/encounter command authority.
4. After parity is established, migrate **individual consumer calculations** to the common resolver in small PRs. Do not broadly replace the equipment resolver, combat snapshot, or effects tables.
5. User-approved **real-component** Forge/Profile mock-ups before any UI changes. Paper-style character sheet dimensions/artwork remain intact.

All tests run in isolated PostgreSQL; no production migrations until compatibility and security review.
