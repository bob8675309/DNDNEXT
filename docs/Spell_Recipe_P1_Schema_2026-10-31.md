# Phase P1 — Closed, Source-Qualified Tactical Spell Recipe Schema v1

> **Documentation preserved on `main`; source code remains research-only.** The P1 validator, compiler preflight, synthetic fixtures, Node tests and CI wiring are not deployed to `main` or the live DB. They remain in unmerged [PR #309](https://github.com/bob8675309/DNDNEXT/pull/309) at research commit [`a240066`](https://github.com/bob8675309/DNDNEXT/commit/a24006624380570bd693a768e97a0c689f1d42b5). This spec does not authorize spell casting.
_Status: **research-only prototype contract**, 2026-10-31. Not deployed. No interpreter, RPC or AI enabled._

## Ownership and purpose

This is the first bounded, **data-only** input contract for the approved composable spell engine. See [SPELL_ENGINE_DECISIONS.md](SPELL_ENGINE_DECISIONS.md) for the locked owner choices and [Spell_Engine_PrePivot_Audit_2026-10-31.md](Spell_Engine_PrePivot_Audit_2026-10-31.md) for existing authoritative responsibilities.

Code:
- `utils/spellRecipes/validateSpellRecipe.mjs`: **pure structural validator**, no database/auth, rolls, spell outcomes or mutation.
- `scripts/fixtures/spell_recipe_p1_examples.mjs`: **12 illustrative spell-shaped fixtures**, deliberately *not* canonical reviewed/released spells.
- `scripts/validate_spell_recipe_schema_p1.mjs`: deterministic Node.js tests (valid and unsafe/invalid fixtures).
- `.github/workflows/validate-eldritch-blast-candidate.yml`: existing **free** research CI, extended to run this validator.

**IMPORTANT:** The current `public.spell_effects` table is a descriptive import with one row per spell and `effect_index=0`. It is **not** a source of executable recipes, and this P1 format is **not** a migration to replace it. Existing `encounter_cast_*`, roll/save, geometry, typed damage, action/slot, condition and command log functions remain completely untouched.

## Contract v1 — strict fields and finite operations

A recipe is a bounded plain JSON object:

```json
{
  "schemaVersion": 1,
  "recipeVersion": 1,
  "spell": {"key":"fire-bolt|XPHB","ruleset":"2024","level":0},
  "cost": {"action":"action","resource":{"kind":"none"}},
  "targeting": {
    "mode":"creature","origin":"caster","rangeFeet":120,
    "lineOfSight":"required","cover":"attack-ac",
    "geometry":{"shape":"single"},
    "maxTargets":1,"allowRepeatedTargets":false
  },
  "entry":"attack",
  "steps":[
    {"id":"attack","op":"attack","attackType":"ranged-spell",
     "target":"selected","onHit":"damage","onMiss":"$end"},
    {"id":"damage","op":"damage","damageType":"fire","dice":{
       "quantity":{"kind":"fixed","value":1},"sides":10,
       "rollScope":"once-per-attack"},
     "fraction":"full","rollGroup":"fire-bolt-roll","next":"$end"}
  ]
}
```

Only `2024` ruleset and exactly `|XPHB` source-qualified lowercase identifiers are accepted at P1. This is **intentional**, per the owner's source policy, not a claim that other editions are incompatible forever. The release schema will require a reviewed edition/source registry and explicit migrations for new allowed spell sources.

| Section | Allowed kinds / semantics | Not included |
| --- | --- | --- |
| Action cost | `action`, `bonus-action`, `reaction`; resource `none` for cantrip or `spell-slot` at minimum spell level for leveled spells | Actual Action/slot spending, innate/at-will/charge/ritual/multiple-pool authorization |
| Selection | `creature`, `object`, `point`, `self`; explicit range (5-ft increments), LOS, `attack-ac`/`dex-save`/`none` cover, target count and repeat policy | Runtime visibility, unoccupied hex, DM-known targets, friendly-foe filters, creatures not targeted by a point-AoE, actual 5e exceptions |
| Geometry | `single`, `sphere`, `cone`, `line`, `emanation`, `cube` with required bounded dimensions | Actual hex enumeration, terrain and multi-hex creatures; these remain in existing encounter engine |
| Resolution | `attack` (melee/ranged), `save` (six abilities), `auto-hit`, `repeat` | Authoritative RNG, critical/Advantage/Disadvantage, modifier eligibility, Shield/reactions, source grants and feature filters |
| Effects | `damage`, `heal`, `area` | Real HP/conditions, summons, persistent zones, non-immediate effects, duration/concentration/lifecycle, typed resistance math |
| Quantities | `fixed`, `character-level-tiers`, `slot-level`; finite max and ordered tiers; bounded die size | Runtime level or slot value acquisition, upcast eligibility, feat-derived exceptions |
| Flow | Forward-only references to a later step or `$end`; repeat defines finite `body` and `after` | A compiled interpreter, arbitrary loops, functions, JS/SQL expressions or user-authored RPC names |

**Repeat semantics to implement in P2:** The reviewed `repeat.body` is a bounded forward-only subflow, terminating at `$end`. Each repetition selects according to the reviewed target policy and separately executes the body, then `after`. P1 only validates the references and bounds: **it does not presently prove that a shared node is not reachable both as a loop body and as an outside branch**. A compiler must establish and test loop-scoping and effect ordering before any executable promotion.

**Fraction and roll scopes:** A damage step explicitly specifies `fraction: "full"|"half"`, a strictly bounded `rollGroup` ID, and `dice.rollScope` (once-per-cast, once-per-target, once-per-attack, once-per-projectile). Two conditional damage branches can use the same rollGroup and identical dice/type/bonus to describe the **same cached roll** with different fractions (e.g., Fireball save-for-half). This avoids rerolling area damage per creature and preserves separate beam attack damage. P1 does not actually cache or roll anything.

**Critical security note:** `validateSpellRecipe` never says a spell can be cast. Its `ok:true` means **only** that the input conforms to structural P1 vocabulary. No recipe, even syntactically valid, is trusted until manually checked against source rules, formally reviewed/published, tied to canonical assignment/grant/provenance, and executed through a permissioned server command with authenticated actor, legal target, resource, timing, dice, conditions, and version checks. Future Actor AI may only choose from server-issued legal options; it cannot submit arbitrary recipes or effect nodes.

## P1 fixture matrix (illustrative, not gameplay acceptance)

| Prototype | Demonstrated composition | Known rule gap / reviewer gate |
| --- | --- | --- |
| Fire Bolt | Single ranged attack; cantrip-tier damage | Real target/object options and features |
| Sacred Flame | Target Dex save, damage only on failure | Cover/visibility exceptions and saves |
| Eldritch Blast | Per-beam independently rolled attacks; character-level repeats | Invocation eligibility, beam target selection, exact rolled damage |
| Scorching Ray | Per-ray attacks; slot-level count | Class/source/grants, slot/resource transaction |
| Magic Missile | Auto-hit allocated darts; slot-level count | Roll-scope interpretation, Shield/reaction resolution |
| Ice Knife | Attack hit → piercing; **hit or miss** → impact-area Dex saves and cold | Secondary target selection, mixed damage handling, timing |
| Fireball | Point-origin sphere; Dex save full/half on one damage roll | LOS/cover/terrain and simultaneous damage ordering |
| Word of Radiance | Caster emanation; saving throws and shared roll | Actual chosen creature exclusions and friendly selection |
| Burning Hands | Cone and Dex-save full/half | Directional hex geometry, partial cover |
| Lightning Bolt | Line and Dex-save full/half | Blocking, extended area path and map terrain |
| Acid Splash | Point-origin small sphere, save-based damage | Source edition, occupied hex and source-specific targeting |
| Healing Word | Bonus Action healing target | **Spellcasting modifier not represented:** the fixture is *incomplete* and must never be promoted without feature/ability-source binding |

These are intentionally **shape examples only**. Even when an example says “Fireball,” it is not canonical Fireball content and is not fully eligible for an `approved` status. Side effects, concentration, conditions and persistent durations are deliberately **not** representable in P1; the engine must stay GM-assisted for such cases until reviewed extensions are implemented.

## P1 compiler preflight — scoped graph, roll identity and immutable manifest

New research-only code:
- `utils/spellRecipes/preflightSpellRecipe.mjs`: pure graph analyzer calling the P1 validator and returning either bounded errors or a **frozen, non-executable manifest**.
- `scripts/validate_spell_recipe_preflight_p1.mjs`: positive fixtures, boundary injections, same-path roll-cache corruption, nesting/operation budgets and deterministic identity tests.

**Lexical execution scopes:** `repeat.body` creates a named child scope (`loop:<step-id>`), and its `$end` returns control to the repeat *without* finishing the surrounding spell. The repeat's `after` belongs to its parent scope. A graph node may be shared across hit/miss or save-success/failure branches **within one scope**, but may never be referenced from both inside and outside a repeat. This admits Ice Knife's hit/miss explosion join and rejects an Eldritch Blast beam's damage being entered from the cast's outer path.

**Bounded work and nesting:** P1 restricts lexical repeat depth to 3 and conservatively estimates the maximum node visits across branches and all allowed levels/slot upcasts. A recipe exceeding 256 potential operations fails preflight even if the schema itself was valid. This is a pre-execution cap and does not authorize resource spending.

**Roll caching safety:** P1 refuses a `rollGroup` reused across separate loop scopes or on two nodes reachable on a *single sequential execution path*. Shared `rollGroup` on mutually exclusive save outcomes is valid (Fireball full/half), and the manifest records cache partitions (cast/target/attack/projectile) rather than making dice rolls. When implemented, the executor must use actual server-owned cast, target, attack or projectile identities to enforce the scope; the manifest alone cannot supply real die results.

**Fingerprint / recipe revision:** SHA-256 of canonical JSON (object keys sorted, array order preserved), including source-qualified spell key, ruleset, schema version, recipeVersion, node definitions and order. Two semantically equivalent JavaScript key orderings hash identically; any approved version or dice change changes the fingerprint. The returned manifest is deeply frozen; it cannot be modified after preflight. **A fingerprint is not a cryptographic signature, publication permission, source entitlement, or a proof of D&D rules parity.** A future trusted review registry must explicitly approve a fingerprint per source version.

**Remaining gaps:** No executable graph interpreter, no persisted recipe catalogue, no trusted publication workflow, no account auth, no geometric hex query, no actual roll cache, no resource actions or AI action discovery. Nested/multi-target semantics and spell-specific feature modifiers still require existing source/RPC behavior parity. Do not merge experimental gameplay code or insert SQL based on P1 alone.

## Safeguards, acceptance and continuation

Structural invariants: strict JSON-only plain objects, no extra keys anywhere, no functions, prototypes, cycles, arbitrary code or source spoofing, <=32 steps, <=12 nesting, <=16 repetition, <=20 selected targets, finite ranges/quantities, no dangling or backward/cyclic graph references, no unreachable steps, compatible shared rollGroup definitions, canonical source/edition, appropriate slot/cantrip cost.

**P1 acceptance:** Node validation passes on all synthetic examples and rejects representative malformed/hostile variants. This proves **schema safety**, NOT spell-rule correctness, server execution, browser acceptance or a usable AI action menu.

**Next:** P1 **compiler preflight**, defining loop-scope, branch join, immutable recipe identity/checksum and structural plan output, followed by P2 behavior parity with existing spell RPCs. Before changing any live spell behavior, test against production-equivalent geometry, exact damage/slot functions and signed-in Auth, including hidden-player visibility, concurrent turns and idempotency. Stay on draft research; do not merge experimental source to main.

**Release and cost:** Research branch only, no production SQL or deployment, no paid services, no map changes, no AI model connection; preserve existing adapters and GM-assisted fallback.
