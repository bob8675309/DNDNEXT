# Tactical Spell Execution Mechanics — Catalog Audit

> **Historical research specification preserved on `main` for continuity.** The referenced `utils/tacticalSpellMechanicsReview.mjs` and its tests are **research-branch implementation**, not part of production `main`. Refer to [draft PR #309](https://github.com/bob8675309/DNDNEXT/pull/309) and verify current source before using any family classification. This document neither grants spellcasting permissions nor installs executable recipes.

_Last reviewed: October 31, 2026. Research only; not an executable ruleset._

## Source of truth and scope
Read-only live Supabase `public.spells_catalog` inspection: **1,037** total spell rows from **18** source identifiers; **391** XPHB/2024 spells. Of those XPHB spells, **24** have a nonempty `attack_type`, **154** have at least one saving-throw ability, **34** have a nonempty `area_type`, and **23** have a nonempty `healing_dice`. These fields are **overlapping signals**, not mutually exclusive categories or authorization grants. In particular, the XPHB **Fireball** catalogue entry currently has `area_type = NULL` despite specifying a sphere in its description. Automated classification based only on `area_type`, damage dice, school, or spell name is unsafe.

The live combat page's exact XPHB reviewed-adapter whitelist contains **19** spells. That is a UI support list, *not* proof of end-to-end rules parity for every feature. Eldritch Blast is **not** in it. Its staged planner and server candidate remain unmerged and uninstalled on production. Source-qualified keys such as `fire-bolt|XPHB` and `fire-bolt|PHB` must never be treated as interchangeable. The XPHB/PHB editions may differ in damage, range, attack type, timing and riders.

## How we decide
Every potential combat adapter must be reviewed in the following order:

1. **Canonical source:** Confirm `spell_key`, `source`, edition, spell assignment, acquisition and known/prepared requirements. Avoid substring/name-only matching.
2. **Action economy and resources:** Action, Bonus Action, Reaction, ritual, concentration, duration, spell slots, Pact Magic, upcast and class-level or total-character-level scaling. Distinguish *casting* from later-turn actions.
3. **Resolution shape:** One attack roll, independent multiple attacks, automatic hits, saving throws, mixed attack + saves, point/line/cone/emanation, healing, persistent effects or special modes.
4. **Targets and geometry:** Same/different target reuse, object vs creature, line of sight, cover, reach, friendly fire, number limits, origin, teleport/displacement and targeting on misses.
5. **Effects and riders:** Dice by type, temporary HP, resistances/immune/vulnerable, conditional leaps/exploding dice, ongoing damage, conditions and concentration. Only apply class/subclass/feat/invocation modifiers when the source-bound feature **explicitly qualifies**.
6. **Release gate:** A reviewed server-authoritative implementation, source contract, executable PostgreSQL fixtures, two-user signed JWT and UI tests, action/slot/log atomicity and idempotency. **Audit categories alone never make a spell castable.**

## Actual XPHB attack-capable catalogue entries (24)
This is a **mechanics audit**, not an implementation promise.

| Family | Spells | Reuse and additional review |
| --- | --- | --- |
| Ranged single roll, ordinary/known rider | Fire Bolt, Poison Spray, Ray of Frost, Guiding Bolt, Ray of Sickness, Starry Wisp | Reuse accuracy, cover/LOS, damage; review each spell's speed, poison, advantage, light or ignition rider separately |
| Melee single roll with special rider | Chill Touch, Shocking Grasp, Thorn Whip | Reuse attack/damage; review opportunity-attack suppression, heal denial, pull distance/reach |
| Independent multiple attacks | **Eldritch Blast**, **Scorching Ray**, Steel Wind Strike | Shared per-attack engine, **different** beam/ray count, character-level vs slot-level scaling, target constraints, melee vs ranged, teleport |
| Conditional chain or extra dice | Chromatic Orb, Sorcerous Burst | Damage-type selection, leap/bounce or exploding dice require dedicated rules |
| Attack plus secondary area/save | Ice Knife | Explosion can apply hit or miss; secondary save and affected creatures differ from first attack |
| Delayed, repeatable or persistent | Witch Bolt, Melf's Acid Arrow, Produce Flame, Flame Blade, Spiritual Weapon, Vampiric Touch, Grasping Vine, Bigby's Hand, Mordenkainen's Sword | Later-turn events, duration/concentration, conditional damage, healing, grappling, entity/mode handling—not one-shot Eldritch Blast copies |

## Other mechanics families outside the attack field
| Example | Correct candidate family |
| --- | --- |
| Magic Missile | Auto-hit allocated projectiles, **no d20 attack roll** |
| Fireball | Point-origin spherical area, Dexterity save; `area_type` is currently missing |
| Burning Hands / Lightning Bolt | Cone / line saving-throw geometry |
| Acid Splash / Word of Radiance | Selective save targets / emanation |
| Healing Word / Mass Healing Word | Bonus Action, healing and target restrictions, no hostile attack |
| Many buffs, summons, transformations, illusions | Dedicated duration, concentration, entity, condition or GM-adjudication family |

## AI-compatible composable engine direction (2026-10-31)

The campaign owner approved pivoting from adding more spell-specific casting functions to a **source-qualified, declarative spell recipe/interpreter** made from shared targeting, resolution, effect and lifecycle nodes. The human tactical UI and future local-first Actor AI must consume the **same server-generated legal actions** and guarded action executor; AI must never author spell-rule payloads or bypass permission, hidden-information or state-change authority. **Design-only research** is specified in [Composable_Spell_Engine_AI_Readiness_2026-10-31.md](Composable_Spell_Engine_AI_Readiness_2026-10-31.md). Before enabling new spells (including Scorching Ray), establish recipe/interpreter parity and reconcile the separate draft common character-effects resolver. Existing production RPCs remain intact.

## Implementation priority and separation of concerns
- **Already has reviewed adapter:** Preserve existing 19 XPHB adapters; do not refactor their action logic merely to force them into Eldritch Blast architecture.
- **Finish Eldritch Blast:** Complete remaining effects and user-interface release gates first.
- **Next promising multi-attack candidate: Scorching Ray**, because it shares independent ranged attacks and per-ray targets. However its **three initial rays, spell-slot consumption, and upcast ray counts** are not Eldritch Blast's cantrip/level scaling, and **Agonizing Blast must not be copied over**.
- **Separately review unusual multi-attacks:** Steel Wind Strike is melee, distinct-target based and teleports the caster.
- **Defer conditional/hybrid/persistent spells:** Chromatic Orb, Ice Knife, Witch Bolt, spiritual-summoned effects and concentration spells need new effect interpreters; no assumption that `attack_type` makes them simple.
- **Existing area/save/heal/auto-hit pipelines:** Continue using their own tested resolvers; only share low-level geometry, damage, mitigation, permissions and transaction primitives when semantically correct.

## Research artifact
`utils/tacticalSpellMechanicsReview.mjs` is a *pure, read-only* catalogue-review helper. It returns a **review family**, not a list of enabled spells or executable RPC names. `scripts/validate_tactical_spell_mechanics_review.mjs` pins the 24 XPHB attack entries, 22 manually reviewed exceptions, eight other special shapes, and the current 19-adapter whitelist. Adding catalogue spells or changing these rules requires deliberate manual review; runtime spell cast authorization remains entirely server-controlled.

**Safety:** No live database writes, hosted staging charges, world-map or town-map changes. Work is confined to unmerged draft PR #309.
