# DNDNext Common Character Effects — Cross-Conversation Requirements and Omission Gate
**2026-10-24. Status: read-only audit, not implementation approval.**

## Why this supplement exists
The Common Character Effects work spans three ChatGPT development conversations. Earlier decisions were recovered from conversation history/visible handoff-video excerpts and checked against repo source plus read-only DnDWeb Supabase. Full verbatim, line-by-line retrieval of both earlier conversations has **not** been verified; this supplement is a grounded **requirements coverage gate**, not an exhaustive certification.

The user's scope is **one extensible effect calculation model** for species, feats, class/subclass features, spells, equipment, magic items, potions, conditions, and crafting/enchanting outputs. The Physical Specimen Parasite Patron feature is the first demanding integration example, **not** a license to hard-code a separate parallel stat engine. Do not replace existing systems that own equipment, spell/condition durations, attunement/resources, rest choices, combat snapshots, permissions, or character progression.

## Previously requested effect dimensions, vs draft PR #251
| Dimension | Required model | PR #251 status / gap |
|---|---|---|
| Identity & source | source record, source instance, actual ownership/level/attunement, provenance | pure resolver knows `id/source/stackKey`; no authorized source adapters |
| Activation | passive, equipped, triggered, activated, consumed; Action/Bonus Action/Reaction as owned by tactical RPC | no eligibility, economy, attunement, or use enforcement |
| Operation | add, subtract, set/replace, minimum/extension, multiply, Advantage/Disadvantage; typed Resistance, immunity, vulnerability, flat DR | add/minimum/multiply + roll-mode tags only; no set/replace or typed defenses |
| Targets | scores and modifiers (different), proficiency/Expertise, saves/skills/initiative, attacks and damage (specific weapon/spell/target), AC, max/current/temp HP, conditions, vision, modes of movement | 13 numeric targets, roll tags; only Athletics/Acrobatics skills, no score/modifier, spell DC, swim/fly/burrow or typed defense target |
| Context | save ability/poison condition, attack/spell identity, damage type, skill, creature/source/target relationship, armor/weapon, conditions | resolver `when` vocabulary only `event/condition/skill`; no generic attack/target/ability/damage context |
| Lifecycle | persistent, equipment-only, activated, per-turn/use, spell duration/concentration, until-rest, rest replacement, encounter expiry | intentionally external to resolver; adapters and consumer integration absent |
| Stacking | actual source-defined nonstacking, multiple independent sources, most-beneficial result, precedence, simultaneous modifiers | same stackKey largest-absolute only; key creation and exceptional source rules still absent |
| Consumers | paper character sheet, character rolls, tactical saving throws, attack/heal/damage, speed and movement, vision | no gameplay consumers rerouted; no UI approval |

## New live catalogue key presence not included in PR #252's nine-field matrix
Read-only query against public.items_catalog (2,739 rows on 2026-10-24). These counts mean **key exists**, not equipped, usable, nonempty, or mechanically implemented.

| Key | Rows | Source example / meaning | Audit consequence |
|---|---:|---|---|
| `ability` | 49 | `Stormgirdle (Exalted)` has `static.str=21`; `Titanstone Knuckles (Exalted)` has `static.str=26`; chooser keys also exist | **score replacement** and choice/eligibility, not blanket additive bonus. Need score→modifier→skills/saves/attacks/AC dependency checks |
| `modifySpeed` | 41 | `Ascendant Scaled Ornament`: fly equal walk; `Grovelthrash (Awakened)`: burrow equal walk; `Deathwalker's Ward (Exalted)`: fly 60 | missing movement modes, equality to **effective** walking Speed, bounded tactical consumers |
| `attachedSpells` | 354 | Staff/Wand cast lists partitioned by daily or charge cost | spell-grant resource/cast authority distinct from always-on numeric bonus |
| `charges` | 220 | charge pools | require authorized per-instance spend, rest/recharge semantics, replay/idempotency |
| `recharge` / `rechargeAmount` | 258 / 200 | dawn recharge, amount | resource refresh belongs to existing time/rest/use authority; not pure arithmetic |
| `reqAttuneTags` | 221 | attunement eligibility tags | conditional eligibility gate before issuing equipment effects |
| `positive_effects` | 232 | e.g. alchemy ingredient 'Die step +1' or Effect +100% | chiefly **ingredient/crafting metadata**, not necessarily an active character effect. Carry into completed item/consumable contract, no automatic application |
| `saveDc` | 114 | e.g. Potion of Breath DC 14 | item/consumable save DC is **not** caster Spell Save DC bonus; check action/dose/application |
| `stealth` | 37 | item boolean, often armor metadata | check conditionally imposed Stealth disadvantage/suppression; some currently have presentation support |
| `duration` | 115 | item-level duration metadata | not proof of an active, timed status effect |

Existing high-risk fields from PR #252: `bonusSpellAttack` 40, `bonusSpellSaveDc` 27, `bonusProficiencyBonus` 1, `conditionImmune` 18, `immune` 14. These have no verified matching *equipped gameplay consumers* in the existing audit. `resist` 121 and `damageReductionByType` 10 have specialized tactical item mitigation; `bonusWeapon` 195 has weapon-profile consumers. Preserve those instead of replacing them.

Other fields: `bonusSavingThrow` 29, `bonusAc` 80. No production-catalog rows had top-level `bonusInitiative` or top-level `modifiers` when sampled. Therefore PR #253's successful 'real legacy resolver' fixture, while compiling **actual** legacy SQL, used **synthetic invented catalogue modifier payloads** for several numeric parity assertions. This is a real implementation-path test, **not** representative live-catalogue coverage. Follow with fixtures sampled from genuine canonical payloads and instance overrides, under source licenses.

## Non-item source families already implemented as state, but not necessarily mechanical consumers
- `docs/Wild_Heart_Aspect_Runtime_Status.md`: **Owl** gives Darkvision 60 *or increases existing range by 60*; **Panther** climb = Speed; **Salmon** swim = Speed. Persistent selected aspect survives Long Rest; Long Rest allows a replacement. Runtime choice is accepted, movement/vision gameplay consumption expressly deferred. A `minimum(60)` is **wrong** when extending existing Darkvision.
- `docs/Bestial_Soul_Runtime_Status.md`: **Swimming** swim=walk + underwater breathing; **Climbing** climb=walk plus walls/ceilings/no check; **Jumping** once per turn Strength (Athletics) check to extend jump. Always-on magical natural weapons separately bypass certain resistance/immunity. Choices expire at next qualifying Short/Long Rest. Current choice-state implementation expressly does not write tactical movement.
- `docs/Boon_Energy_Resistance_Runtime_Status.md`: two chosen typed resistances per feat **instance**; Long Rest may replace both. Shared runtime-resistance helper combines Boon, Fiendish Resilience, Dread Allegiance, but tactical consumption is an integration gate. Attacks/damage must use actual equipped + runtime + encounter affinities without duplication.
- `docs/Feat_Runtime_Expertise_Status.md`: Echoing Soul permanent skill/language acquisition and **persistent, replaceable** Expertise; Zhentarim Tactics Expertise starts after Long Rest and **expires** at next Long Rest. Existing specialized proficiency projection depends on current proficiency, must not be flattened into static +N. Action-trigger benefits (Intrusive Echoes/Retaliate) are separately deferred.
- `docs/Astral_Trance_Runtime_Status.md` and `docs/Eladrin_Runtime_Status.md`: temporary proficiency/weapon/tool sources expire automatically on next Long Rest; Eladrin season **persists** with optional replacement; seasonal Fey Step effects are not necessarily wired into tactical casting. The Forge must not persist rest-only choices as permanent training.
- `docs/Tactical_Encounter_Phase1H_Reactions_Effects_Status.md`: `encounter_conditions` supports condition keys/durations but not every mechanical 5e consequence. Condition immunity must govern **application**, and currently active conditions must govern actual roll/action/movement consumers, not just badges.
- `public.spell_effects` has 1,037 structured catalogue rows (388 damage, 347 utility, 104 condition, 89 control, 46 healing, 34 defense, 29 summon). These are **source definitions**, not 1,037 verified tactical implementations. Preserve spell cast/slot, concentration, targeting, save and effect execution authorities.
- Crafting/alchemy/enchanting must distinguish **craft-time ingredient modifiers** and the final crafted item/consumable's **runtime wearer/target effects**. Never grant a mushroom/essence's crafting +100% as a passive player bonus.

## Tactical rule trap: last migration wins
`sql/20261016_07_equipped_item_damage_mitigation.sql` had flat reduction before resistance, but `sql/20261016_08_resistance_before_flat_reduction.sql` superseded it. Read-only live inspection confirms **Resistance → highest typed flat reduction → vulnerability → temp HP → HP**, with immunity overriding damage. Campaign example: 30 Fire damage / Fire Resistance / DR 10 = **5**, not 10. The common engine must preserve this source-specific sequencing; never restore the older SQL order from an earlier file.

## Physical Specimen cross-feature gates
PR #250 handles staged +Warlock-level max HP and +5 walking Speed with bounded combat reconciliation, but not fully the other source benefits: Darkvision (including existing range rule), Advantage on saves related to the Poisoned condition, Charisma-derived Athletics/Acrobatics bonuses, triple jump distance, climb=walking Speed. Track **all six selectable benefits** and selection-limit/activation/rest rules; no UI until each gameplay consumer is verified. Prefer common source adapter into PR #251 over duplicating bespoke handlers for every subclass.

## Actionable release/testing gates
1. **Source/eligibility matrix**: genuine item catalogue + inventory merge, equip and attunement, feat acquisition instance, species/subclass source/level, spell active duration/concentration, potions/doses and crafted item provenance.
2. **Complete operation/target matrix**: ability score replacement vs bonus and derived mods; full 18 skills + Expertise/proficiency; ability saves; armor, alternative AC, shields; specific melee/ranged/magic attacks; spell attack/DC focus; vision grant vs extend; climb/swim/fly/burrow equal-to-speed or fixed mode; conditional Advantage/Disadvantage; damage types, immunity/resistance/vulnerability/DR, condition immunity, conditions.
3. **Lifecycle matrix**: permanent; first-acquisition selection; selectable after rest but persistent; expiring on rest; start-of-encounter snapshots; on turn start/end; timed buffs; concentration loss; charges/dawn recharge; use/dose/Action/Bonus Action/Reaction; retried idempotent commands.
4. **Consumer matrix**: sheet displayed values vs saved base; check/save rolls and dice logs; weapon/spell hit/damage/DC; current/max/temp HP and healing; condition applying and clearing; movement and threat/AoO; map scopes must remain separate (do not alter world map); vision/LOS; tactical snapshot resync.
5. **Proof matrix**: isolate PostgreSQL parity against **real source payload shapes** (not only invented numeric JSON), compare old/current implementation to new for each bounded field; downstream tactical regression and actual UI browser tests, privilege/ACL checks and production-shaped live-schema compatibility before any migration/merge. Do not edit current runtime authority to make tests pass.

## Status / PR topology
- #250 Physical Specimen: draft, source/encounter integration incomplete.
- #251 common resolver: draft, calculation foundation only.
- #252 this coverage ledger: draft, inventory/source audit only.
- #253 real legacy SQL numeric parity test: draft based on #251; its two isolated CI jobs passed on head `5cfeef36541d6a882144ec00aed56d30bdc5a92a` when checked 2026-10-24; its test data are synthetic and only narrow saved fields verified.

**No production database migration, consumer switch, world/town map edit, Forge layout change, or PR merge is authorized by this audit.** Preserve paper-style sheet and actual-component UI mock-up approval before player controls.
