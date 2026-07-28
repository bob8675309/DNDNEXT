# Tactical Encounter Phase 1M — False Life

Status: **SERVER + COMBAT UI DEPLOYED / POSTDEPLOY VALIDATED**

Phase 1M adds the reviewed XPHB version of **False Life** as a self-only, one-Action, one-slot tactical spell adapter using existing Temporary HP state.

## Canonical contract

- key: `false-life|XPHB`
- source: `XPHB`
- level: 1
- classes: Artificer, Sorcerer, Wizard
- casting time: 1 Action
- range: Self
- duration: Instantaneous
- effect: `2d4 + 4` Temporary HP
- upcasting: `+5` Temporary HP per slot level above 1
- concentration: no.

Existing Temporary HP remains GM-assisted: the adapter does not stack or silently replace an existing pool.

## Resolver

Repository migration:

- `sql/20260728_03_tactical_false_life.sql`

Production migration:

- `20260728042006 tactical_false_life`

Versioned RPC:

- `public.encounter_cast_spell_v5(caster, assignment, target, slot_level, request_id)`

v5 owns only `false-life|xphb` and delegates the five prior reviewed spell adapters to v4.

Guardrails include exact XPHB/class-source validation, prepared-or-always-available state, self target, active-turn/controller authority, legal single slot pool, Action availability, blocking incapacitating conditions, request idempotency, server-authoritative logging, and anonymous execute revocation.

## Build and deployment gates

The server-bearing Phase 1M head `30cd5a224de715cf862541387c09fa47d90cc1fe` received a real green Vercel build before the account temporarily hit its build-rate limit.

The combat UI was then isolated and validated on `phase1m-false-life-ui`. Its code-bearing head built successfully before being merged into `main`. The final production retry on `main` completed successfully at:

- `22aae9a5d7873c878359ad9e9e32a8a76a308e96`
- Vercel deployment: `https://vercel.com/pauls-projects-2016aa54/dndnext/Gu1SaHA4sFrRnbYguS1UTk9eHxKV`

Thus the earlier build-rate-limit hold is resolved; Phase 1M server and combat UI are both production-deployed.

## Postdeploy rollback validation

The deployed resolver was exercised transactionally with persistent **Pip Quillspark** using canonical Wizard level-1 spell slots.

Verified:

- Pip began with 3 level-1 slots;
- level-1 False Life granted a legal 6–12 Temporary HP from `2d4 + 4`;
- level-1 upcast bonus was 0;
- exactly one slot and one Action were spent;
- participant Temporary HP matched the resolver result;
- duplicate request ID returned the stored result without extra spend;
- casting while existing Temporary HP was present failed closed;
- the rejected cast preserved existing Temporary HP, Action, and slot state;
- all temporary tactical fixture rows and the temporary assignment rolled back.

Execution privileges were rechecked:

- v5 authenticated: `true`
- v5 anon: `false`
- v5 service role: `true`.

## Persistent reviewed assignment

Pip Quillspark retains the reviewed canonical assignment:

- assignment id: `36a8925d-495e-42a8-a0ad-b10085b7a76d`
- source type: `class`
- source label: `Wizard`
- prepared: `true`
- casting stat: `int`.

## Combat UI

The Phase 1M combat UI adds self-target selection, selected-slot Temporary HP preview, existing-Temporary-HP preflight, v5 routing, result/log output, and the False Life rule panel while preserving the earlier v1-v4 routes.

## Deferred

Still GM-assisted/manual after Phase 1M:

- replacing/choosing between competing Temporary HP pools;
- AoE, lines, cones, emanations, and persistent areas;
- concentration;
- repeated saves/effects;
- half-damage-on-success spells until Phase 1N;
- persistent save/attack modifiers;
- spell-created conditions or riders;
- forced movement and teleportation;
- reaction spells;
- summons;
- Bonus Action spellcasting and broader spell-per-turn semantics;
- item/feat/background spell-resource semantics;
- multiclass or multiple spell-slot-pool selection.

Phase 1M is complete and production-validated.