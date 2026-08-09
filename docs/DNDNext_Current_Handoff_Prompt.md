# DNDNext Current Handoff Prompt

Updated: 2026-08-09

Repository: `bob8675309/DNDNEXT`

Active PR: **#170 — Refine Character Forge resilience, source choices, spells, and player authority**

Active branch: `agent/character-forge-resilience-presentation`

Stack: Next.js Pages Router + Supabase/Postgres.

## Mandatory startup

Before changing anything:

1. inspect current PR head and exact-head CI/Vercel;
2. inspect live Supabase migrations/schema/data/grants for the requested slice;
3. read `docs/README.md`, `docs/Documentation_Refresh_Manifest.md`, and the relevant dedicated ledger;
4. reconcile source, live DB, and docs;
5. verify every helper, hook, state variable, prop, and RPC argument is defined and passed.

GitHub/Supabase outrank prior-chat prose.

## Protected boundaries

- Do not mix world-map behavior with town/city-map behavior.
- Do not touch the world map unless explicitly requested.
- `components/MapPageClient.js` is outside current Forge/progression/runtime scope.
- Do not alter route/travel/weather, unrelated crafting/inventory, or tactical action execution.
- Prefer additive migrations over rewriting deployed history.
- Test risky DB work in rollback and prove zero residue.

## Current live checkpoint

Supabase is accepted through **migration 82**.

Latest migrations:

- 78 `armorer_armor_model_runtime` — `20260809220732`;
- 79 `bestial_soul_runtime` — `20260809231431`;
- 80 `bestial_soul_option_resolver_fix` — `20260809231912`;
- 81 `wild_heart_aspect_runtime` — `20260809232923`;
- 82 `hunter_prey_runtime` — `20260809234244`.

## Closed/accepted recent slices

### Armor Model

Read `Armorer_Armor_Model_Runtime_Status.md`.

- EFA/TCE source-specific model sets.
- Initial choice immediate.
- Smith's Tools possession is current-schema proxy for “tools in hand.”
- Later change after newer Short or Long Rest.
- State only; no armor/AC/combat mutation.

### Bestial Soul

Read `Bestial_Soul_Runtime_Status.md`.

- PHB Barbarian / TCE Beast / level 6+ only.
- Swimming / Climbing / Jumping.
- First choice requires post-acquisition Short/Long Rest.
- Choice expires at next Short/Long Rest.
- No movement fields are mutated.

### Aspect of the Wilds

Read `Wild_Heart_Aspect_Runtime_Status.md`.

- XPHB Barbarian / XPHB Wild Heart / level 6+ only.
- Owl / Panther / Salmon.
- Initial choice immediate.
- Short Rest does not authorize change.
- Newer Long Rest authorizes one optional change.
- Current aspect persists until changed.
- No Darkvision/speed/world-travel/tactical movement mutation.

### Hunter's Prey

Read `Hunters_Prey_Runtime_Status.md`.

This feature has an edition split:

- **PHB Ranger / PHB Hunter / level 3:** permanent acquisition choice among Colossus Slayer, Giant Killer, Horde Breaker. This remains Forge/progression authority.
- **XPHB Ranger / XPHB Hunter / level 3:** immediate choice between Colossus Slayer and Horde Breaker; a newer Short Rest or Long Rest can replace the current option with the other one.

Accepted XPHB runtime behavior:

- initial choice immediate;
- current option persists until changed;
- newer Short/Long Rest authorizes one optional replacement;
- one rest cannot be reused;
- active encounter blocks configuration;
- PHB Hunter remains runtime-ineligible;
- runtime key `ranger-hunter-hunters-prey`;
- projection `runtimeFeatures.huntersPrey`;
- no Colossus Slayer damage / Horde Breaker extra-attack combat implementation in this slice.

Migration-82 candidate head `173b593679942e0813c484f138a9a41f14081da3` passed all 29 PR workflows and Vercel before deployment. Deployed rollback proof passed edition/source gating, immediate Colossus Slayer, Short-Rest Horde Breaker replacement, Long-Rest Colossus Slayer replacement, same-rest/encounter guards, ACLs, projection, and unchanged combat fields.

Current protected baseline after rollback acceptance:

- 7 characters;
- 7 sheets;
- 30 character-spell rows;
- 7 progression rows;
- 18 inventory rows;
- 20 locations;
- 4 routes;
- 9 route points.

## Immediate next slice

Audit **Defensive Tactics** next.

Before writing:

1. inspect exact `class_feature_catalog` source record(s), class/subclass edition, level, option structure, and cadence text;
2. inspect current Forge parser/presentation/runtime storage;
3. classify permanent acquisition versus rest replacement/expiry from source;
4. state a bounded patch plan before writes;
5. compile candidate DDL in rollback;
6. run synthetic candidate lifecycle;
7. patch migration/client/validator/workflow together;
8. verify helpers/hooks/state/props/RPC args;
9. require exact-head CI/build/Vercel;
10. deploy only after green gates;
11. rerun against deployed functions;
12. prove ACLs and zero residue;
13. update docs/PR only after acceptance.

Known queue after Defensive Tactics: Phantom Whispers of the Dead.

## Delivery discipline

Never call a runtime slice accepted merely because DDL applied. Acceptance requires source verification, exact-head gates, deployed behavior proof, ACL checks, and zero-residue integrity.
