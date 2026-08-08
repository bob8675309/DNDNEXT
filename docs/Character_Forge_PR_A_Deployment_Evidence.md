# Character Forge PR A — Deployment Evidence

Status date: 2026-08-08
PR: #170 (`agent/character-forge-resilience-presentation`)

## Acceptance state

PR #170 remains **open and unmerged**. CI/build success plus rollback-only production proofs are regression/authority evidence, not final authenticated browser acceptance.

The active design rule is creation/progression parity for persistent source-owned decisions, with rest/per-use/informational choices modeled separately as runtime state.

## Current production authority summary

### Earned progression

The active Level Up UI completes through `complete_character_level_up_v5`.

Connected persistent families include General feats/Epic Boons, simple class choices, Bard Magical Secrets, Lore Magical Discoveries, Draconic Elemental Affinity, Champion Fighting Style, Metamagic, Mystic Arcanum, Magic Initiate replacement, Eldritch Invocations/Lessons, Battle Master maneuvers, Wizard Savant, and Wizard Signature Spells.

Direct authenticated v3/v4 level-up completion is revoked. Legacy v1/v2 execute grants remain a tracked cleanup item after confirmed nonuse.

### Runtime cadence

Live runtime-cadence migrations include:

- 44 — Wizard Spell Mastery;
- 45 — class-granted Weapon Mastery;
- 46 — per-instance Weapon Master feat current weapon + combined mastery projection.

These keep permanent acquisition history separate from current Long-Rest-reconfigurable state.

### Player creation / starting magic

Live migrations 47-48 complete the shared Player Forge Spell-step boundary.

The browser now calls `create_player_character_v3` rather than stopping at v2. v3 owns exact native class-list, Background-expanded, Eldritch Knight, and Arcane Trickster starting magic. Species/feat/class-feature spell grants remain separate source-owned systems.

Migration 48 removes the stale explicit `anon` execute grant from v3.

## Major live migrations in this PR checkpoint

- 38-39 — Battle Master maneuver normalization/progression;
- 40-41 — Wizard Savant progression + higher-level Forge chronology;
- 42 — Wizard Signature Spells authority;
- 43 — Signature free-cast resource labels;
- 44 — Wizard Spell Mastery runtime;
- 45 — class Weapon Mastery runtime;
- 46 — Weapon Master feat runtime and combined projection;
- 47 — Player Forge v3 multi-source starting-magic completion;
- 48 — Player Forge v3 authenticated-only ACL cleanup.

## Wizard evidence

### Savant

Savant spellbook additions remain `class-feature` provenance with `wizardSpellbook=true`. Higher-level Forge replays historical acquisitions at 3/3/5/7/9/11/13/15/17; earned progression uses the same spellbook boundary; cantrips are excluded; cross-provenance duplicates fail closed.

### Signature Spells

Signature is two level-3 spells from the final normalized spellbook. It overlays existing assignments, preserves provenance, and supplies one `short_rest` free cast per spell.

Rollback evidence includes:

- existing-row overlay without membership inflation;
- Short Rest restoring spent Signature uses;
- duplicate/wrong-level/non-spellbook rejection;
- direct level-20 Abjurer Forge chronology using Savant-granted Counterspell as Signature;
- authenticated Wizard 19→20 v5 progression using spells learned in that same transition as Signature;
- matching session/event/progression history.

### Spell Mastery

Migration 44 models Spell Mastery as runtime Long-Rest configuration.

Rollback evidence includes:

- one eligible level-1 + one level-2 Action spell from the actual spellbook;
- always-prepared/at-will overlay with no finite use counter;
- no replacement before a new Long Rest;
- exactly one same-level replacement after a new Long Rest;
- restoration of the old spell's prior prepared/availability state;
- rejection of two-at-once, wrong-level, non-Action, non-spellbook, and active-encounter changes.

See `Wizard_Spell_Mastery_Runtime_Status.md`.

## Weapon Mastery evidence

Migration 45 provides class-granted runtime mastery capacity and one-change-per-new-Long-Rest semantics.

Migration 46 gives each Weapon Master feat instance an independent runtime current weapon and computes `sheet.weaponMasteries` as the union of class + feat runtime sources without rewriting permanent feat acquisition history.

Production rollback evidence covers immediate initial configuration, no-op preservation, Short-Rest rejection, one Long-Rest replacement, same-rest lockout, immutable acquisition history, and combined projection preservation.

## Player Forge v3 starting-magic evidence

### Source/build gate

The implementation introduced a dedicated `Validate Player Forge v3 starting magic` workflow.

The exact implementation head before migration 47 passed:

- dedicated v3 starting-magic semantic assertions;
- unified Character Forge assertions;
- security-hardening Forge endpoint assertions;
- Character Forge resilience assertions;
- tactical resource-bridge regression assertions;
- the repository production `npm run build:vercel` gate after `npm ci` with validation Supabase environment placeholders;
- broader NPC Forge / progression workflows at the same implementation checkpoint.

Migration 47's replacement functions were compiled against live production schema inside an explicit transaction and rolled back before deployment.

### Native Wizard proof

A real authenticated call to `create_player_character_v3` created a synthetic level-1 Wizard in a rollback transaction with:

- 3 cantrips;
- 6 level-1 Wizard spells;
- exactly 4 prepared leveled spells.

Verified 9 exact v3 starting-magic rows, Intelligence casting, no surviving v2 proxy rows, and correct cantrip/preparation state.

### Background-expanded proof

A level-1 Wizard used **Entangle** as one of the six spellbook selections.

Entangle's preferred row is Druid/Ranger, not Wizard, proving actual Background-expanded access.

Verified:

- normal Wizard spell-count slot consumption;
- temporary native v2 proxy removed;
- exact Entangle row stored as class-source Wizard casting with `accessType='background-expanded'`;
- prepared count still exact.

### Eldritch Knight proof

A level-3 Fighter / Eldritch Knight created through v3 produced:

- 2 subclass-source Wizard cantrips;
- 3 prepared subclass-source level-1 Wizard spells;
- Intelligence casting;
- no class-source proxy residue.

### Arcane Trickster proof

A level-3 Rogue / Arcane Trickster created through v3 produced:

- fixed Mage Hand exactly once;
- 2 additional subclass-source Wizard cantrips;
- 3 prepared subclass-source level-1 Wizard spells;
- Intelligence casting.

### Fail-closed proof

The real v3 RPC rejected atomically:

- an undeclared Background-expanded spell;
- an invalid Arcane Trickster fixed spell;
- duplicate exact starting-magic selection.

Each rejection left no temporary v2 character/spell residue.

### ACL proof

After migration 47, an audit detected a stale explicit `anon` grant on v3. The function already rejected `auth.uid() IS NULL`, but migration 48 removed the grant so ACLs match v1/v2.

Current creation execute surfaces:

- v1: authenticated + service_role;
- v2: authenticated + service_role;
- v3: authenticated + service_role;
- no v3 anonymous execute grant.

## Final production integrity checkpoint

After migrations 47-48 and all rollback fixtures:

- 7 characters;
- 7 character sheets;
- 30 character-spell assignments;
- 7 character-progression rows;
- 0 open level-up sessions;
- 0 QA `startingMagic=true` rows;
- 0 synthetic `__v3_*` characters;
- 20 locations;
- 4 map routes;
- 9 map route points.

No world-map, town/city-map, route/travel/weather, tactical combat, or crafting runtime behavior changed in the starting-magic slice.

## Remaining acceptance blockers

1. Remaining runtime cadence families such as Astral Trance, Circle-of-the-Land choices, Primal Companion, Dread Allegiance, Fiendish Resilience, and per-use Steps of the Fey.
2. Source-backed starting equipment packages and higher-level starting wealth/equipment.
3. Character-scoped starting currency.
4. Artificer wildcard Magic Item Plan concrete-item instances.
5. Remaining persistent Species / Background / Class / Feat / Subclass coverage and conditional-choice UI audit.
6. Audit/revoke obsolete authenticated level-up completion RPC generations when confirmed unused.
7. Final authenticated browser acceptance.
8. Merge PR #170 only after those gates close.

## Protected boundaries

This work has not modified world-map, town/city-map, route/travel/weather, encounter/combat, or unrelated crafting runtime behavior. `components/MapPageClient.js` remains outside this PR slice.
