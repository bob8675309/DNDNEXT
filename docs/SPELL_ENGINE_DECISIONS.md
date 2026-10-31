# DNDNext — Spell Engine Owner Decisions and Non-Negotiable Contracts
_Last confirmed by campaign owner: 2026-10-31. These are product decisions, not evidence that implementation exists._

## Approval record — six questions answered

The owner explicitly accepted the proposed composable spell architecture and answered all six pre-pivot questions. Do **not** ask these again in a new chat unless proposing a material change or the owner reverses a decision.

| ID | Decision | Concrete implementation interpretation |
| --- | --- | --- |
| D1 — rules/source priority | **2024 XPHB first.** Consult older PHB, Grim Hollow, other catalogue sources **only when needed for information**, without silently combining or replacing the 2024 rule for a source-qualified spell. | Start the reviewed spell recipes with `spell-key|XPHB`. Keep every source/edition's identity and rules independent, never substitute 2014 mechanics into 2024 spells. Missing evidence remains marked unknown until reviewed. |
| D2 — initial integration scope | **Spells first**, with a framework that can later serve other effects; avoid unnecessary expansion into unrelated systems now. | No simultaneous overhaul of feats, NPC abilities, species traits, potions, items or crafting. Design typed reusable primitives and trusted source adapters so later consumers can opt in after their own tests. |
| D3 — unsupported mechanics | **Only fully supported, reviewed spells are automated.** Otherwise retain explicit GM-assisted resolution. | No partial-resolution output presented as an authoritative full cast; no permissive fallback that spends actions/resources yet ignores mechanics. |
| D4 — visual homebrew authoring | **Yes, eventually an Admin visual spell/effect recipe builder.** | Recipes may be composed from reviewed operations after the schema stabilizes. Future editor submits validated, versioned drafts; it never evaluates arbitrary SQL/JS, installs unreviewed effects, overwrites source spells or bypasses GM review. |
| D5 — Actor AI | **Yes: future opt-in autonomous NPC/monster turns, GM controls, manual mode and AI-off mode.** | Future local/provider-neutral AI chooses from the same permissioned legal-action options as humans and submits the same guarded command. AI does not create attack results, invent actions, reroll server dice, access hidden/DM data or persist changes independently. AI implementation remains a separate, later workstream. |
| D6 — campaign house rules | **Preserve original spell/source definitions.** | Store optional campaign overrides separately, explicitly versioned and attributable to the GM. Never mutate imported canonical definitions to implement a house rule; resolve effective rule overlays at execution after authorization. |

**Note on D1/D2 wording:** The owner answered “yes, only fall back to other sources for info when needed” in the same sequence as XPHB-first and spells-first. Treat this as both a source-precedence restriction and a constraint against prematurely expanding other systems. If an exact, consequential conflict later appears, document it and ask about that *specific* conflict rather than reopening all six decisions.

## Architecture contract (locked direction, implementation not yet approved for live use)

1. **Geometry/targets:** Creature, object, point/hex, line/ray, cone, sphere/radius, emanation, cube and zones, with explicit origin, line of sight, cover and target-choice semantics.
2. **Resolution:** Attack, saving throw, automatic hit, shared vs independent dice, advantage/disadvantage, critical, half/none-on-save, conditional branches and repeat/sequence semantics.
3. **Effects:** Typed damage and mitigation, healing/temp HP, conditions, speed or movement, one-shot benefits/penalties, terrain, duration, concentration and expiry via existing authoritative state/consumers.
4. **Source/cost:** Source edition, class/species/feat/item grant, known/prepared, casting ability, at-will vs slot/charge, action economy, total character level vs slot level scaling, existing persistent/encounter resource ledgers.
5. **Lifecycle and provenance:** Stable versioned recipe identity; source-owned condition/expiry; provenance and revalidation; idempotent transaction and logs.
6. **Human + AI interface:** Shared server-generated legal actions and parameter bounds, human visual controls or future model selector, one authoritative server command path. AI results and narration may be visibility-filtered; they must not control the rules.

**Reuse existing functions; do not create a competing damage, resource, geometry, condition, equipment or common character-effects authority.** Current helpers and special-case spell RPCs provide golden-reference behavior. The new recipe graph should orchestrate trusted primitives, not be an unconstrained general-purpose programming language. The UI can preview; only the server can resolve and persist.

**Do not turn all 1,037 imported catalogue rows into automatic executable recipes.** The existing `spell_effects` table currently holds one broad descriptive row per spell, not executable composition. The importer's metadata is insufficient to reliably infer all D&D exceptions. Catalogue coverage, rules completeness and deployed automation must have separate completion figures.

## Incremental delivery plan

| Milestone | Deliverable | Acceptance gate |
| --- | --- | --- |
| P0 — audit and decisions | Read-only pre-pivot audit, source-of-truth mapping, approved six decisions; record explicit unknowns. | This document and `Spell_Engine_PrePivot_Audit_2026-10-31.md`; compare against live/source each session. |
| P1 — formal spec | Versioned **closed schema** for primitive nodes, branch/repeat/roll scopes, geometry, scaling, grants, resource costs, events and error/fallback semantics. Include valid/invalid synthetic recipes and server-vs-client responsibility table. | Schema parser/validator rejects unknown operations, arbitrary effect payload, invalid edition, unbounded nesting/repeats, impossible target combinations; no game writes. |
| P2 — shadow evaluator | Pure bounded compiler/planner that creates source/target/roll/effect plans and compares to existing tested spells. Do not replace actual RPCs. | Parity across Fire Bolt, Sacred Flame, Magic Missile, Acid Splash, Word of Radiance, Burning Hands, Lightning Bolt and held Eldritch Blast; property and source fixtures, hidden targets, rejection, round-off, roll scopes. |
| P3 — hybrid/lifecycle proof | Scorching Ray (rays/upcasting), Ice Knife (attack+area save even on miss); later conditions/concentration/reactions as explicit milestones. | Disposable Postgres/Auth + concurrency tests, event and expiry behavior; any unimplemented rider fails closed. |
| P4 — integration | Server-authoritative executor and legal-action discovery, existing guarded commands preserved and migrated **one spell at a time** after parity. | Genuine signed-in browser acceptance, authorization, state/slot mirroring, no duplicate charge/damage, action/turn limits, concealed info, rollback; owner decides promotion. |
| P5 — authoring and future AI | Versioned Admin recipe editor and, separately, permissioned tools for a future local-first Actor AI. | No independent AI gameplay path, opt-in controls, GM override and AI-off, reviewed publication gates; separate explicit authorization. |

The original AI project sequence remains: finish Character Forge acceptance, start with local/admin-only magic-item draft proof, NPC dialogue, shared Actor AI and only later tactical autonomy. Designing a compatible action contract now does **not** change that product rollout order.

## Reuse matrix — important established exceptions

- **Eldritch Blast:** Independent ranged spell attack per beam; character-level scaling; bound Warlock invocation only when genuinely acquired; research code not a live cast.
- **Scorching Ray:** Independently rolled rays, slot/upcast scaling and target allocation; not a cantrip, not eligible for Agonizing Blast merely because it shares attack logic.
- **Fireball / Acid Splash:** Point-area geometry, cover and saves; null catalogue area metadata does *not* negate a source-defined area.
- **Word of Radiance:** Caster emanation with chosen creatures, one shared damage roll and independent saves.
- **Magic Missile:** Allocated automatic-hit darts, no attack rolls; reaction Shield currently GM-assisted where unresolved.
- **Ice Knife:** Initial attack; explosion originates at the impacted target regardless of hit/miss; independent secondary saves.
- **Shocking Grasp / Ray of Frost / Chill Touch / Mind Sliver / Guiding Bolt / Vicious Mockery:** Different expiry triggers and single-use effects; reuse existing `encounter_timed_effects` and condition/attack/save consumers; do not flatten into immediate damage.
- **Healing Word:** Bonus Action, 2024 slotted-spell-per-turn restrictions, healing lock and persistent-slot mirroring.
- **Equipment and attunement:** Optional campaign attunement is OFF by default, ON implies the owner-preferred simple three-item limit. Earlier elaborate attunement research was superseded; physical equip slots remain separate.
- **Character effects:** Archived pure `private.resolve_effect_bundle_v1` and parity tests are reference work **not deployed**. Numeric stacking and source-gating are not the same as executing an active spell.
- **Dice presentation:** Any realistic 3D die animation renders outcomes and never determines authoritative tactical rolls.

## Scope and approvals

**Safe without further release approval:** Read Docs and live schema, research existing source, make isolated documentation/spec/tests, create or update a research draft branch/PR, run free disposable local/Postgres and GitHub checks within account free limits.

**Requires explicit owner approval:** Merge into `main`, production database migration/function grant, paid hosted staging or service, production game data changes, broad existing subsystem rewrite, autonomous AI activation, destructive branch/deployment operations or map changes.

**Protected:** Next.js Pages Router; Bootstrap+SCSS (no Tailwind); world and town/city maps segregated, no touching world map absent prior discussion; campaign data and current live equipment/Forge/tactical/rest/merchant behavior; service-side authentication and DM-only information.

For each continuation use [START_HERE_ACTIVE_HANDOFF.md](START_HERE_ACTIVE_HANDOFF.md) first. For reasons and unknowns see [Spell_Engine_PrePivot_Audit_2026-10-31.md](Spell_Engine_PrePivot_Audit_2026-10-31.md) and [Composable_Spell_Engine_AI_Readiness_2026-10-31.md](Composable_Spell_Engine_AI_Readiness_2026-10-31.md).
