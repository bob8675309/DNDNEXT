# Bestial Soul Runtime Status

Updated: 2026-08-09

Status: **live and rollback-accepted through migrations 79-80**

## Source authority

Imported source record:

- feature: `Bestial Soul`;
- source: `TCE`;
- class: Barbarian;
- class source: `PHB`;
- subclass: Path of the Beast / `Beast`;
- subclass source: `TCE`;
- level: 6.

The feature has two distinct parts:

1. Form of the Beast natural weapons count as magical for overcoming resistance/immunity. This is always-on feature text and is **not** a configurable choice.
2. Whenever the character finishes a Short Rest or Long Rest, choose one adaptation that lasts until the next Short Rest or Long Rest.

The three source adaptations are:

- Swimming — swimming speed equals walking speed and underwater breathing;
- Climbing — climbing speed equals walking speed and difficult/ceiling climbing without a check;
- Jumping — once per turn, a Strength (Athletics) check can extend a jump.

## Accepted lifecycle

Bestial Soul is a rest-created, next-rest-expiring runtime choice.

- PHB Barbarian + TCE Beast + level 6+ only.
- XPHB Barbarian is ineligible.
- The first adaptation requires a Short Rest or Long Rest strictly newer than feature acquisition.
- One qualifying rest authorizes one successful selection.
- A selected adaptation is active only while its anchor is still the newest qualifying rest.
- As soon as a newer Short/Long Rest exists, the old stored selection is treated as inactive/expired, even before the new choice is made.
- The newer rest then authorizes exactly one new selection.
- Invalid attempts do not consume that rest opportunity.
- Active encounters block configuration.

This intentionally differs from Armor Model, whose initial selection exists immediately and only later changes are rest-gated.

## Runtime authority

Migration 79: `bestial_soul_runtime` (`20260809231431`).

Migration 80: `bestial_soul_option_resolver_fix` (`20260809231912`).

Public/private authority:

- `private.bestial_soul_options_v1()`;
- `private.bestial_soul_context_v1(uuid)`;
- `private.sync_bestial_soul_projection_v1(uuid,jsonb)`;
- `public.get_character_bestial_soul_v1(uuid)`;
- `public.configure_character_bestial_soul_v1(uuid,text)`.

Normalized state:

- feature key: `barbarian-beast-bestial-soul`;
- cadence: `short_or_long_rest`;
- projection: `runtimeFeatures.bestialSoul`;
- state records `expiresAtNextQualifyingRest=true`.

Acquisition time uses the shared progression helper:

`private.character_class_feature_acquired_at_v1(character_id,'barbarian','PHB',feature_level)`.

## Source resolver correction

Migration 79 originally assumed Bestial Soul's imported `entries` contained named child entry objects. Deployed rollback acceptance proved that assumption wrong: the actual source stores the adaptations as three plain-text items inside a `type='list'` node.

The failed QA transactions rolled back completely; no synthetic data remained.

Migration 80 corrects only the private option resolver. It:

- reads the exact PHB Barbarian / TCE Beast Bestial Soul source record;
- extracts `list.items[*]`;
- cleans inline 5etools tags generically;
- derives stable Swimming/Climbing/Jumping labels from each item's source mechanic;
- returns the exact source text as each option description.

Public lifecycle semantics from migration 79 were not changed.

This additive follow-up preserves deployed migration history rather than editing migration 79 in place.

## Forge behavior

Bestial Soul does not need a hard-coded parser exception. The existing source-text cadence classifier recognizes the source phrase “When you finish a short or long rest, choose...” as rest-reconfigurable.

Permanent class-choice output remains filtered to `cadence === 'creation'`, so Bestial Soul is not frozen into Character Forge creation/progression state.

## Client composition

`CharacterBestialSoulPanel` is mounted after `CharacterArmorerArmorModelPanel` in the always-reachable runtime chain hosted by `CharacterCurrencyBadge`.

It:

- receives `characterId` explicitly;
- loads `get_character_bestial_soul_v1`;
- calls `configure_character_bestial_soul_v1` with `p_character_id` and `p_benefit_key`;
- shows active, expired, and rest-required states;
- renders source-derived option details;
- does not rewrite character movement values.

All hooks/state variables/RPC arguments are locally defined.

## Movement/combat boundary

This slice stores the chosen adaptation only. It does not mutate:

- base walking speed;
- `swimSpeed` or `climbSpeed` fields;
- species movement data;
- inventory;
- world travel behavior;
- tactical movement/action resolution.

The always-on magical natural-weapon clause also remains outside this choice-state slice. Tactical consumers can read the normalized feature/source later when combat integration is explicitly in scope.

## Exact-head validation

Final resolver-fix source head before deployment:

`d40371c2f2bf66d8dcf40141ada9cd62f8686517` — `Repair Bestial Soul source option resolver`.

At that exact head:

- all 27 PR workflows passed;
- the Bestial Soul semantic validator passed;
- Armor Model and currency composition guards passed;
- progression/Forge validators passed;
- production build gates passed;
- Vercel passed.

## Deployed rollback proof

After migrations 79-80 were live, a fully rolled-back fixture dynamically resolved current PHB/XPHB Barbarian class IDs and proved:

- exactly three source options;
- PHB/TCE Beast level 6 is eligible;
- XPHB Beast is ineligible;
- non-Beast PHB Barbarian is ineligible;
- pre-rest configuration is rejected;
- a public Short Rest unlocks selection;
- Swimming can be selected;
- the same rest cannot be reused;
- a newer public Long Rest immediately makes Swimming inactive/expired and unlocks the next choice;
- an active encounter rejects configuration without consuming that rest opportunity;
- after leaving the encounter, Climbing can be selected;
- the same rest cannot be reused;
- a strictly later Short Rest permits Jumping;
- the same later rest cannot be reused;
- exactly one normalized Bestial runtime row exists inside the fixture;
- `runtimeFeatures.bestialSoul.benefitName` ends as `Jumping`;
- base `speed` stays 30 and no `swimSpeed` / `climbSpeed` fields are added.

Because PostgreSQL `now()` is transaction-stable, later synthetic rest receipts used explicit later timestamps inside the rollback transaction.

## ACL proof

Deployed checks passed:

- `anon` cannot execute the getter;
- `authenticated` can execute the guarded getter;
- `anon` cannot execute configure;
- `authenticated` can execute the guarded configure RPC;
- `anon` cannot execute the private option resolver.

## Zero-residue production integrity

After the final deployed rollback proof:

- characters: **7**;
- character sheets: **7**;
- character-spell rows: **30**;
- progression rows: **7**;
- inventory rows: **18**;
- live Bestial Soul runtime rows: **0**;
- Bestial QA characters: **0**;
- locations: **20**;
- map routes: **4**;
- map route points: **9**;
- live Bestial option count: **3**.

## Status

Bestial Soul is **closed/accepted**. The next bounded family audit should inspect source before deciding implementation; Aspect of the Wilds is the next known candidate.
