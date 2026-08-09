# DNDNext Current Handoff Prompt

Status: copy-ready project handoff, reconciled 2026-08-08

---

## Copy from here

You are taking over `bob8675309/DNDNEXT` as senior developer, technical advisor, and implementation owner.

DNDNext is a Next.js Pages Router + Supabase D&D campaign platform using Bootstrap/SCSS. Treat current GitHub state, live Supabase schema/functions/data, source validators, and living `docs/` handoffs as the evidence base. Do not trust old conversation summaries when current state can be inspected.

### Required first actions

Before changing anything:

1. Inspect current `main`, PR #170, branch head, changed-file boundary, and exact CI status.
2. Inspect live Supabase read-only for schema/function/RLS/data questions.
3. Read `docs/Documentation_Refresh_Manifest.md`.
4. For Character Forge/progression/runtime work, read the status documents listed there, especially:
   - `Player_Forge_Starting_Magic_v3_Status.md`
   - `Player_Forge_Starting_Equipment_Status.md`
   - `Astral_Trance_Runtime_Status.md`
   - `Primal_Companion_Runtime_Status.md`
   - `Dread_Allegiance_Runtime_Status.md`
   - `Fiendish_Resilience_Runtime_Status.md`
   - `Circle_of_the_Land_Runtime_Status.md`
   - `Artificer_Magic_Item_Plans_Status.md`
5. Reconcile docs against current source/live Supabase before assuming a blocker is still open.

### Non-negotiable boundaries

- Do not mix world-map behavior with town/city-map behavior.
- Do not touch world-map behavior or `components/MapPageClient.js` unless explicitly requested.
- Do not modify encounter/combat/tactical snapshot/damage authority unless that subsystem is explicitly brought into scope.
- Smiths handle physical gear; Enchanters handle magical A/B/C slots.
- Generic NPCs do not become crafters without an appropriate role.
- Supabase normalized state remains authoritative.
- Browser state previews/collects choices but does not bypass guarded database authority.
- Realtime is synchronization, not authority.
- Preserve working systems; avoid broad rewrites.
- Verify every helper/hook/state/prop/RPC argument is defined and passed at every use site.
- Keep unrelated changes out of the active branch.

### Delivery workflow

For each bounded database/runtime slice:

1. inspect exact imported/live source;
2. stage migration + client;
3. add semantic/build gates;
4. compile/execute against live schema inside rollback;
5. require exact-head CI/build;
6. apply migration;
7. run public/helper rollback behavior proofs;
8. verify zero residue/integrity/ACLs;
9. reconcile docs and PR.

Proceed when the user says “proceed”; do not repeatedly request confirmation already given.

## Active PR

PR #170 (`agent/character-forge-resilience-presentation`) remains **open and unmerged**.

Do not restart completed Forge consolidation, starting magic/equipment/currency, Wizard/Weapon-Mastery runtime, Astral Trance, Primal Companion, Dread Allegiance, Fiendish Resilience, Circle of the Land, or Artificer Magic Item Plan work unless current source/live evidence contradicts the recorded acceptance state.

## Governing parity/cadence model

Persistent direct level-N creation and earned level-N progression should converge.

- persistent creation/attained-level choice → authoritative Forge/progression state;
- proficiency-dependent permanent choice → Training placement;
- permanent spellbook-dependent choice → Spells placement;
- Long-/Short-Rest configurable choice → guarded runtime state;
- per-use choice → spell/action resolver;
- informational feature → display only.

## Live migration checkpoint through 62

### 38-46

Battle Master, Wizard Savant, Signature Spells, Spell Mastery, class Weapon Mastery, and Weapon Master feat runtime authority are live and documented.

### 47-48 — Player Forge starting magic

`create_player_character_v3` is shared Player Forge creation authority. Native class-list spells, Background-expanded access, Eldritch Knight, and Arcane Trickster starting magic are server-authoritative. v3 is authenticated/service-role only.

### 49-51 — starting equipment / currency

Player mode includes source-backed Equipment. Starter gear becomes character-owned canonical inventory and starts unequipped. Character money is `character_currency` copper, not `player_wallets`. Higher-level magic-item quantities are DM guidance only.

The post-create `CharacterCurrencyBadge` is also complete and character-scoped.

### 52-54 — Astral Trance

AAG Astral Elf runtime choice. After Long Rest choose one skill + one legal weapon/tool proficiency. Pair expires at next Long Rest. Short Rest persists. Permanent proficiency state is not rewritten.

### 55 — Primal Companion

XPHB Ranger / Beast Master runtime identity. Initial Land/Sea/Sky + appearance is immediate. Current beast persists until changed; a newer Long Rest opens one replacement. Active encounter blocks change. No companion-statblock/minion DB was invented.

### 56 — Dread Allegiance

XPHB Rogue / Scion of the Three. Initial choice immediate; newer Long Rest permits one linked-package replacement:

- Bane → Psychic + Minor Illusion;
- Bhaal → Poison + Blade Ward;
- Myrkul → Necrotic + Chill Touch.

Cantrip authority is exactly one Intelligence-based `class-feature` spell row. Runtime resistance is exposed through `private.character_runtime_damage_resistances_v1`.

### 57 — Fiendish Resilience

XPHB Fiend Patron Warlock. First choice requires a Short or Long Rest after feature acquisition. Current resistance persists; each later Short or Long Rest permits one replacement. Force is excluded.

### 58-59 — Circle of the Land

Circle spell packages are parsed directly from imported XPHB `Circle Spells` source tables. Four lands resolve: Arid, Polar, Temperate, Tropical.

A qualifying Long Rest opens one land choice for that rest cycle. The current-level package materializes as Wisdom `class-feature` spells, always prepared. At the next Long Rest the old package is automatically removed and configuration reopens. Short Rest preserves it.

### Runtime panel composition

During the Artificer gate, exact-head validators revealed a real reachability regression caused by later full-file updates overwriting earlier imports.

The corrected sheet chain is:

`CharacterSheetPanel → CharacterAstralTrancePanel → CharacterDreadAllegiancePanel → CharacterFiendishResiliencePanel → CharacterCircleLandPanel → CharacterCurrencyBadge`

`CharacterPrimalCompanionPanel` remains directly mounted separately.

Each chained parent always renders its downstream child even when its own feature is ineligible. This prevents one class/species filter from hiding later runtime panels.

The restored chain passed all exact-head subsystem/build gates before Artificer deployment.

### 60-62 — Artificer Magic Item Plans

EFA `Replicate Magic Item` is now normalized persistent class-option authority.

Migration 60 derives **56** plans directly from imported EFA source tables and materializes each learned plan as one `character_class_option_grant_instances` row.

Plan capacity:

- level 2 → 4;
- level 6 → 5;
- level 10 → 6;
- level 14 → 7;
- level 18 → 8.

Direct higher-level Forge slot chronology is `[2,2,2,2,6,10,14,18]`.

Whenever an Artificer gains an Artificer level, one existing plan may optionally be replaced.

Three wildcard families bind a concrete canonical `items_catalog.id` under the plan instance:

1. Common magic item except Potion/Scroll/cursed;
2. Uncommon non-cursed Wondrous Item;
3. Rare non-cursed Wondrous Item.

Each repeat of the same wildcard must select a different concrete item.

**Learning a plan never creates inventory.** Plans are knowledge. Inventory/crafting is a separate downstream system.

Migration 61 adds a defensive legacy-sheet projection parent guard.

Migration 62 corrects the first live catalogue audit: rarity alone had allowed an alchemy reagent to appear as a Common wildcard candidate. No user plan existed at the time. Final magic-item identity requires imported item type, Wondrous marker, or canonical Wondrous Item type.

Final wildcard pools:

- Common: 105;
- Uncommon Wondrous: 173;
- Rare Wondrous: 200.

Deployed rollback proofs passed:

- direct EFA Artificer 2 with four plan slots;
- same Common wildcard learned twice using two different concrete items;
- normalized four-plan sheet projection;
- no inventory delta;
- Artificer 5→6 exposes exactly one new slot + optional replacement;
- one new plan + one replacement gives five total instances;
- replacement preserves instance key;
- no inventory delta;
- alchemy reagent rejection;
- wildcard-without-child rejection;
- fixed-plan-with-child rejection;
- same wildcard/same concrete item repeat rejection;
- non-Artificer payload rejection;
- zero QA residue.

See `docs/Artificer_Magic_Item_Plans_Status.md`.

## Steps of the Fey classification

The imported XPHB source ties Steps of the Fey choices to **each Misty Step cast**. It is per-use spell/action state.

Do not add it to Character Forge or `character_runtime_feature_choices`.

Actual Step-effect execution belongs in the Misty Step action resolver and remains deferred until spell/combat action work is explicitly in scope.

## Current integrity checkpoint

After migration 62 and rollback fixtures:

- 7 characters;
- 7 character sheets;
- 30 character-spell rows;
- 7 progression rows;
- 0 open level-up sessions;
- 18 inventory rows;
- 0 live Artificer plan instances;
- 0 QA proof characters;
- 56 normalized EFA plans;
- 20 locations;
- 4 routes;
- 9 route points.

Private Artificer helpers are service-role only. `complete_character_level_up_v5` is authenticated/service-role only.

`get_character_level_class_choice_options_v2` still has a pre-existing anonymous execute grant. Migrations 60-62 did not create it; include it in progression RPC/ACL cleanup.

## Immediate remaining PR #170 work

Do **not** reopen completed migration 38-62 slices without contradictory evidence.

Current blockers:

1. final persistent/conditional Species / Background / Class / Feat / Subclass coverage and UI audit;
2. obsolete/authenticated progression RPC + ACL cleanup, including the anonymous class-choice getter grant;
3. final authenticated browser acceptance;
4. Steps of the Fey per-cast integration only when spell/combat execution is explicitly in scope;
5. tactical consumption of `character_runtime_damage_resistances_v1` only when encounter/combat is explicitly in scope;
6. merge PR #170 only after closure gates are satisfied.

### Recommended next implementation slice

Run the **final persistent/conditional source-choice coverage audit** across Species, Background, Class, Feat, and Subclass. Classify every source-owned choice as persistent, rest-configurable, per-use, or informational and compare direct higher-level Forge against earned progression.

Keep that audit read-only first. Only patch uncovered gaps that are source-backed and within the non-combat Character Forge/progression boundary.

After coverage closes, perform the progression RPC/ACL cleanup and authenticated browser acceptance.

## Documentation precedence

1. live Supabase schema/functions/protected data;
2. current repository source/validators;
3. `Documentation_Refresh_Manifest.md` + detailed PR #170 status documents;
4. platform-wide roadmap/tactical ledgers;
5. historical exports only as provenance.

## End copy
