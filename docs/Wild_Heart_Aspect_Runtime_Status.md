# Wild Heart — Aspect of the Wilds Runtime Status

Updated: 2026-08-09

Status: **live and rollback-accepted through migration 81**

## Source authority

Imported source:

- feature: `Aspect of the Wilds`;
- source: `XPHB`;
- class: Barbarian;
- class source: `XPHB`;
- subclass: `Wild Heart`;
- subclass source: `XPHB`;
- level: 6.

The source grants one immediate choice and says that whenever the character finishes a Long Rest, the choice can be changed.

Source-derived options:

- Owl — Darkvision 60 ft.; if Darkvision already exists, its range increases by 60 ft.;
- Panther — Climb Speed equals Speed;
- Salmon — Swim Speed equals Speed.

## Accepted lifecycle

Aspect of the Wilds is persistent runtime state with Long-Rest replacement.

- Initial selection is available immediately when the feature is gained.
- The current aspect does **not** expire at a Long Rest.
- A newer Long Rest authorizes one optional change.
- If the player does not change the aspect, the current choice remains active indefinitely.
- Short Rests do not authorize replacement.
- One qualifying Long Rest authorizes at most one completed change.
- Invalid attempts do not consume that opportunity.
- Active encounters block configuration.

## Runtime authority

Migration 81: `wild_heart_aspect_runtime` (`20260809232923`).

Functions:

- `private.wild_heart_aspect_options_v1()`;
- `private.wild_heart_aspect_context_v1(uuid)`;
- `private.sync_wild_heart_aspect_projection_v1(uuid,jsonb)`;
- `public.get_character_wild_heart_aspect_v1(uuid)`;
- `public.configure_character_wild_heart_aspect_v1(uuid,text)`.

Normalized state:

- feature key: `barbarian-wild-heart-aspect-of-the-wilds`;
- cadence: `long_rest`;
- projection: `runtimeFeatures.wildHeartAspectOfTheWilds`.

The option resolver reads the exact XPHB source record and cleans inline source tags for display.

## Forge and consumer boundaries

The existing source-text cadence parser recognizes the Long-Rest replacement language, so Aspect of the Wilds is not frozen into permanent Character Forge creation state.

This slice stores only the normalized aspect. It does not mutate:

- base Darkvision;
- walking/climb/swim speed fields;
- species data;
- world travel behavior;
- tactical movement or combat calculations.

Consumers can read the normalized current aspect later when those systems are explicitly in scope.

## Candidate and deployed proof

Candidate source head: `0c51a7ab905a623106f9d1a77b71912a0a2b0508`.

Before deployment:

- source resolver returned exactly Owl / Panther / Salmon;
- rollback lifecycle passed;
- all 28 PR workflows passed;
- dedicated Aspect semantic/build gate passed;
- Vercel passed.

After migration 81 was applied, a rolled-back deployed fixture proved:

- XPHB Wild Heart Barbarian 6 is eligible;
- PHB Barbarian and non-Wild-Heart XPHB Barbarian are ineligible;
- initial Owl selection works immediately;
- immediate replacement is rejected;
- Short Rest leaves Owl active and does not enable replacement;
- Long Rest leaves Owl active and enables one change;
- active encounter blocks change without consuming the opportunity;
- Owl → Panther succeeds;
- the same Long Rest cannot be reused;
- a second Long Rest leaves Panther active and enables one change;
- Panther → Salmon succeeds;
- the second Long Rest cannot be reused;
- one normalized runtime row exists inside the fixture;
- sheet projection ends at Salmon;
- base speed/Darkvision remain unchanged and no swim/climb fields are manufactured;
- public/private ACL expectations pass.

## Production integrity

After rollback-only acceptance:

- 7 characters;
- 7 character sheets;
- 30 character-spell rows;
- 7 progression rows;
- 18 inventory rows;
- 0 live Aspect runtime rows;
- 0 Aspect QA characters;
- 20 locations;
- 4 map routes;
- 9 map route points;
- source option count = 3.

## Status

Aspect of the Wilds is **closed/accepted**. Do not reopen it without contradictory live/source evidence.
