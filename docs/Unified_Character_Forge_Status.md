# Unified NPC and Player Character Forge Status

Status date: 2026-08-16

Accepted runtime/code baseline: `8c37e30063d2523a5f488073d3ea60c5571c7182`

Merged continuation chain:

- PR #170 — unified Character Forge/progression/runtime foundation — `599c4de7397ba6e4bbbb0a061d551d80c3570be7`;
- PR #171 — Species/Profile/Forge continuation — `ed93331b946dffee1e63183e969f115d0c8a1a18`;
- PR #172 — Species readability refinements — `8b62e38cc4de490dd4a02b57b0e9448baff3e5ef`;
- PR #173 — Simic Animal Enhancement source descriptions — `8c37e30063d2523a5f488073d3ea60c5571c7182`.

Latest registered live migration at this status refresh: `20260814161314 grim_hollow_heritage_catalog_support`.

## Governing architecture

The shared Character Forge is the intended creation surface for NPCs and player-owned characters. Persistent source-owned state should converge between direct creation at level N and earned progression to level N.

That parity rule does **not** convert every source decision into permanent creation state:

- persistent acquisition/attained-level choices → Forge/progression authority;
- proficiency-dependent permanent choices → Training authority;
- spellbook-dependent permanent choices → Spells/progression authority;
- rest-configurable persistent choices → runtime authority;
- next-rest-expiring choices → rest-cycle runtime authority;
- per-use/per-cast choices → action/spell resolver;
- narrative unlocks that depend on campaign events → quest/dialogue authority when that subsystem exists;
- informational/always-on features → presentation/consumer logic.

## Shared Forge entry points

The active architecture is shared rather than maintaining two competing creator implementations.

Primary files include:

- `components/NewNpcModalV3.js` — controller/state/orchestration;
- `components/NewNpcModalV3Refined.js` — shared presentation shell;
- `components/NpcForgeStepContent.js` — step-specific left/workspace UI;
- `components/NpcForgeContextPanelRefined.js` — right-side explanation and embedded source choices;
- `components/NpcForgeSourceChoiceFields.js` / `NpcForgeEmbeddedSourceChoices.js` — canonical source-choice rendering;
- `components/NpcForgeSpeciesChoiceContext.js`, `NpcForgeClassChoiceContext.js`, `NpcForgeSourceChoiceContext.js` — existing choice authorities;
- player creation RPC `create_player_character_v3`;
- NPC creation RPC `create_character_v1`.

Do not add a second save path because a new control looks different.

## Player Forge steps

1. Species;
2. Background;
3. Class;
4. Abilities;
5. Training;
6. Spells;
7. Equipment;
8. Identity;
9. Story;
10. Review.

Current placement rules:

- Species — identity, lore, fixed facts, ancestry/lineage and other permanent Species choices;
- Background — background identity/source grants and readable Feature content;
- Class — class/subclass explanation and progression preview;
- Abilities — score generation/allocation only;
- Training → Skills & Proficiencies — skill/tool/expertise-type permanent choices;
- Training → Feats & Class Abilities — feat/class-feature acquisition decisions;
- Spells — class magic plus spell-centric Species/Feat/Background/Class decisions;
- Equipment — starting equipment/currency and legal item decisions;
- Identity/Story — character-facing identity and narrative fields;
- Review — final unresolved-choice validation and creation summary.

## Creation authority

Player creation remains server-authoritative through `create_player_character_v3`.

Established creation systems include:

- exact starting class/subclass spell selection and fixed/expanded access;
- source-owned feat/species/background magic with provenance;
- starting equipment and character-scoped currency;
- source-choice / feat-instance persistence;
- higher-level direct creation with attained-level choices;
- portrait choice and multi-character account support;
- canonical validation of unresolved required choices before creation.

NPC creation remains routed through `create_character_v1` and shares the presentation/choice architecture where lifecycle semantics match.

## Earned progression authority

The Level Up path composes source-owned persistent acquisition/replacement work transactionally. Established families include feats/boons, subclass entry, class spells, Metamagic, Mystic Arcanum, Eldritch Invocations, Battle Master maneuvers, Wizard Savant chronology, Wizard Signature Spells, Artificer Magic Item Plans, and other source-owned attained-level choices.

Direct creation at level N and progression to level N should converge on equivalent persistent source state rather than maintaining separate rule implementations.

## Source-owned magic

Species/Feat/Background spell decisions route through the Spells step and materialize through existing source-magic authority rather than custom component state.

Accepted regression families include:

- Astral Elf / Astral Fire;
- Deep Gnome / Gift of the Svirfneblin;
- Witherbloom Student / Strixhaven Initiate;
- Magic Initiate;
- deterministic highest eligible casting ability where the source allows Intelligence/Wisdom/Charisma.

## Runtime authority

Rest-cycle and replaceable choices remain outside permanent Forge authority when the source lifecycle requires it.

Representative established families include:

- Wizard Spell Mastery;
- Weapon Mastery / Weapon Master;
- Astral Trance;
- Githyanki Astral Knowledge;
- Khoravar Skill Versatility;
- Primal Companion;
- Dread Allegiance;
- Fiendish Resilience;
- Circle Spells;
- Armorer Armor Model;
- Bestial Soul;
- Wild Heart Aspect;
- Hunter's Prey;
- Defensive Tactics;
- Whispers of the Dead;
- Eladrin starting/current season and Long-Rest replacement authority.

The always-reachable sheet/runtime chain must keep unrelated runtime panels reachable even if one feature is ineligible. Every feature-specific RPC argument must be passed explicitly.

## Accepted Species checkpoint

Species is no longer the active broad redesign surface. PRs #171–#173 establish the accepted baseline.

Key accepted behavior:

- parent/child catalogue presentation does not replace canonical species identity;
- high-resolution Forge-only portraits coexist with stable non-Forge artwork aliases;
- semantic facts promote Speed, Size, Creature Type, Vision, Languages, and Gender & Alignment;
- source Size/Language/lineage choices reuse existing source-choice state;
- Dragonborn damage affinity reaches player-facing rule copy;
- Aasimar transformations are readable information, not false permanent locks;
- Goliath Giant Ancestry uses compact options with selected detail;
- Eladrin Seasonal Fey Step avoids duplicated season walls of text and preserves starting/Long-Rest runtime authority;
- Hexblood Eerie Token exposes its simultaneous benefits as structured information;
- Simic Hybrid Animal Enhancement options now retain canonical source descriptions at levels 1 and 5 without changing their keys or second-pick distinctness;
- Profile portrait framing/bleed and Character Forge/Profile window behavior were browser-accepted.

Do not perform another broad Species redesign without a concrete defect.

### Aetherborn Gift decision

`Gift of the Aetherborn` remains present and unchanged for now. Its eventual **unlock** should be campaign-driven through future quest/NPC dialogue systems. The Game Master decides the actual research, quest, NPC, payment, item, sacrifice, or other narrative condition. Do not hardcode a universal acquisition requirement or create a parallel Forge persistence model before the narrative system exists.

## Current live database checkpoint

Supabase project: `DnDWeb` / `ucggczovhmauhshvhusx`.

At this refresh:

- `supabase_migrations.schema_migrations` contains 214 rows;
- latest registered migration is `20260814161314 grim_hollow_heritage_catalog_support`.

Do not infer deployment state from old numbered repo migrations alone. Inspect live functions, grants, RLS, catalogue rows, and migration records relevant to the requested subsystem.

Some later repository SQL effects are already live even when the exact repo filename is not the migration-ledger name. Do not reapply live-correct SQL merely to repair naming provenance.

## Current continuation

The next active Forge review should be **Background**, on a fresh branch from the exact current `main` head.

Background review should begin with:

- live preferred background catalogue/source data;
- `NpcForgeStepContent.js`;
- `NpcForgeContextPanelRefined.js`;
- `utils/backgroundMechanics.js`;
- shared source-choice rendering/placement;
- existing background validators and production-build gates.

Preserve the current Background policy: setting-specific options may be hidden by campaign/admin policy rather than destructively removed; `Feature:` content remains meaningful; Suggested Characteristics stay out of the player-facing Forge; permanent skills/feats/spells resolve in their proper lifecycle steps rather than creating duplicate controls.

After Background, continue Class → Abilities → Training → Spells → Equipment → Identity → Story → Review as separate bounded slices unless a higher-priority production defect intervenes.

## Protected boundaries

This work does not authorize changes to:

- world-map behavior;
- town/city-map behavior;
- `components/MapPageClient.js`;
- route/travel/weather/camp/clock logic;
- tactical encounter/combat execution;
- unrelated crafting/inventory/merchant behavior.

A Forge patch must remain inside the Forge/source/runtime authority actually required by the request.
