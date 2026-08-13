# Hunter's Prey Runtime Status

Updated: 2026-08-09

Status: **live and rollback-accepted through migration 82**

## Edition split

Hunter's Prey is intentionally modeled differently by source edition.

### PHB Hunter

PHB Ranger / PHB Hunter gains Hunter's Prey at level 3 as a permanent acquisition choice among:

- Colossus Slayer
- Giant Killer
- Horde Breaker

There is no rest-replacement rule in the PHB source. This choice therefore remains permanent Character Forge/progression authority and is **not** managed by the Hunter's Prey runtime RPCs.

### XPHB Hunter

XPHB Ranger / XPHB Hunter gains Hunter's Prey at level 3 as an immediate choice between:

- Colossus Slayer
- Horde Breaker

Whenever the character finishes a Short Rest or Long Rest, the XPHB source permits replacing the chosen option with the other one.

## Accepted XPHB lifecycle

- XPHB Ranger + XPHB Hunter + level 3+ only.
- Initial choice is available immediately when the feature is gained.
- Current option persists across rests until changed.
- A strictly newer Short Rest or Long Rest authorizes one optional replacement.
- One qualifying rest cannot be reused for a second replacement.
- Invalid attempts do not consume the rest opportunity.
- Active encounters block configuration.
- PHB Hunter remains runtime-ineligible.

## Runtime authority

Migration 82: `hunter_prey_runtime` (`20260809234244`).

Functions:

- `private.hunter_prey_options_v1()`;
- `private.hunter_prey_context_v1(uuid)`;
- `private.sync_hunter_prey_projection_v1(uuid,jsonb)`;
- `public.get_character_hunter_prey_v1(uuid)`;
- `public.configure_character_hunter_prey_v1(uuid,text)`.

Normalized state:

- feature key: `ranger-hunter-hunters-prey`;
- cadence: `short_or_long_rest`;
- projection: `runtimeFeatures.huntersPrey`.

The XPHB option resolver derives Colossus Slayer and Horde Breaker from the exact XPHB Hunter's Prey source record and cleans inline source tags for display.

## Forge/progression authority split

The existing source-text parser already preserves the edition split:

- PHB source has no rest-reconfiguration wording, so its option-node choice remains `cadence='creation'` and stays in Forge/progression state;
- XPHB source includes Short/Long-Rest replacement wording, so `restReconfigurableText` classifies it as runtime-only and permanent Forge choice extraction suppresses it.

The validator explicitly protects this split and forbids adding a hard-coded global `Hunter's Prey` parser rule that would accidentally convert the PHB permanent choice into runtime state.

## Combat boundary

This slice stores only the selected XPHB Hunter's Prey option. It does not implement:

- Colossus Slayer damage;
- Horde Breaker extra attacks;
- attack targeting or action economy;
- tactical combat resolution.

Those effects remain feature/action-layer consumers for future combat integration.

## Validation and deployed proof

Candidate source head: `173b593679942e0813c484f138a9a41f14081da3`.

Before deployment:

- candidate DDL compiled against live schema inside rollback;
- XPHB option resolver returned exactly Colossus Slayer / Horde Breaker;
- PHB/XPHB rollback lifecycle passed;
- all 29 PR workflows passed;
- dedicated Hunter's Prey semantic/build gate passed;
- Vercel passed.

After migration 82 was applied, a rolled-back deployed fixture dynamically resolved current PHB/XPHB Ranger class IDs and proved:

- XPHB Hunter 3 is eligible;
- PHB Hunter 3 is runtime-ineligible;
- non-Hunter XPHB Ranger is ineligible;
- initial Colossus Slayer can be chosen immediately;
- immediate replacement is rejected;
- a newer Short Rest preserves Colossus Slayer and enables one replacement;
- active encounter blocks replacement without consuming that opportunity;
- Colossus Slayer → Horde Breaker succeeds;
- the same Short Rest cannot be reused;
- a newer Long Rest preserves Horde Breaker and enables one replacement;
- Horde Breaker → Colossus Slayer succeeds;
- the same Long Rest cannot be reused;
- one normalized runtime row exists inside the fixture;
- sheet projection ends at Colossus Slayer;
- synthetic combat fields remain unchanged;
- public/private ACL expectations pass.

## Production integrity

After rollback-only acceptance:

- 7 characters;
- 7 character sheets;
- 30 character-spell rows;
- 7 progression rows;
- 18 inventory rows;
- 0 live Hunter's Prey runtime rows;
- 0 Hunter QA characters;
- 20 locations;
- 4 map routes;
- 9 map route points;
- live XPHB Hunter's Prey option count = 2.

## Status

Hunter's Prey is **closed/accepted**. Do not reopen it without contradictory live/source evidence.

The next bounded family audit is Defensive Tactics.
