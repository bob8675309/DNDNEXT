# DNDNext Current Handoff Prompt

Status: copy-ready project handoff, reconciled 2026-08-09

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
   - `Unified_Character_Forge_Status.md`
   - `Player_Forge_Starting_Magic_v3_Status.md`
   - `Player_Forge_Starting_Equipment_Status.md`
   - `Astral_Trance_Runtime_Status.md`
   - `Species_Rest_Proficiency_Runtime_Status.md`
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

Do not restart completed Forge consolidation, starting magic/equipment/currency, Wizard/Weapon-Mastery runtime, Astral Trance, Primal Companion, Dread Allegiance, Fiendish Resilience, Circle of the Land, Artificer Magic Item Plans, or the Githyanki/Khoravar proficiency runtime slice unless current source/live evidence contradicts the recorded acceptance state.

## Governing parity/cadence model

Persistent direct level-N creation and earned level-N progression should converge.

- persistent creation/attained-level choice → authoritative Forge/progression state;
- proficiency-dependent permanent choice → Training placement;
- permanent spellbook-dependent choice → Spells placement;
- Long-/Short-Rest configurable choice → guarded runtime state;
- per-use choice → spell/action resolver;
- informational feature → display only.

## Live migration checkpoint through 66

### 38-46 — progression/Wizard/Weapon authority

Battle Master, Wizard Savant, Signature Spells, Spell Mastery, class Weapon Mastery, and Weapon Master feat runtime authority are live and documented.

### 47-51 — Player Forge creation authority

`create_player_character_v3` is shared Player Forge creation authority. Native class-list spells, Background-expanded access, Eldritch Knight, and Arcane Trickster starting magic are server-authoritative.

Starter gear becomes character-owned canonical inventory and starts unequipped. Character money is `character_currency` copper, not `player_wallets`. Higher-level magic-item quantities remain DM guidance only. `CharacterCurrencyBadge` is character-scoped.

### 52-59 — established runtime cadence

- Astral Trance: post-Long-Rest skill + weapon/tool pair; expires next Long Rest.
- Primal Companion: current beast persists; newer Long Rest opens replacement.
- Dread Allegiance: linked allegiance/resistance/cantrip persists; newer Long Rest opens replacement.
- Fiendish Resilience: first choice after qualifying Short/Long Rest; later qualifying rest opens replacement.
- Circle of the Land: land spell package expires automatically at next Long Rest and must be chosen again.

Steps of the Fey is source-classified as per-Misty-Step action state and remains outside this non-combat slice.

### Runtime panel composition

The corrected sheet chain remains:

`CharacterSheetPanel → CharacterAstralTrancePanel → CharacterDreadAllegiancePanel → CharacterFiendishResiliencePanel → CharacterCircleLandPanel → CharacterCurrencyBadge`

`CharacterPrimalCompanionPanel` and `CharacterSpeciesRestProficiencyPanel` are separate direct mounts.

Each chained parent must render its downstream child even when its own feature is ineligible.

### 60-62 — EFA Artificer Magic Item Plans

EFA `Replicate Magic Item` is normalized persistent class-option authority.

- 56 source-derived plans;
- capacity 4/5/6/7/8 at Artificer 2/6/10/14/18;
- direct higher-level slot chronology `[2,2,2,2,6,10,14,18]`;
- one optional replacement whenever an Artificer gains an Artificer level;
- wildcard plans bind a canonical item identity but never create inventory.

Final wildcard pools are 105 Common / 173 Uncommon Wondrous / 200 Rare Wondrous.

See `docs/Artificer_Magic_Item_Plans_Status.md`.

### 63-66 — Species rest proficiency authority

#### MPMM Githyanki — Astral Knowledge

Astral Knowledge is not a permanent Forge choice. After a completed Long Rest, choose one skill + one source-legal PHB weapon/tool proficiency. The pair expires automatically when the next Long Rest finishes.

#### EFA Khoravar — Skill Versatility

Player Forge collects one initial skill-or-tool choice, but a deferred progression trigger materializes it as runtime state rather than permanent proficiency data. The current choice persists until replaced after a newer Long Rest.

#### Correction sequence

- 63 — runtime foundation;
- 64 — explicit anonymous public-RPC EXECUTE cleanup;
- 65 — canonical DNDNext rest key correction to `long_rest`;
- 66 — missing `runtimeProficiencies` parent compatibility fix.

No real Githyanki/Khoravar runtime row existed while the correction migrations were applied.

Deployed rollback proofs passed for both Species families, including actual `complete_character_rest_v1(..., 'long_rest')`, direct shared-Forge Khoravar materialization, automatic Githyanki expiry, replacement timing, invalid-option rejection, non-destructive permanent proficiencies, and zero residue.

See `docs/Species_Rest_Proficiency_Runtime_Status.md`.

## Current integrity checkpoint

After migration 66 and rollback fixtures:

- 7 characters;
- 7 character sheets;
- 30 character-spell rows;
- 7 progression rows;
- 18 inventory rows;
- 0 live Githyanki/Khoravar Species runtime rows;
- 0 Species QA proof characters;
- 20 locations;
- 4 routes;
- 9 route points.

The final migration-66 source candidate passed all 18 relevant GitHub workflows, including the dedicated Species semantic gate and production build.

Vercel is currently blocked by the account build-rate limit rather than a code build failure.

`get_character_level_class_choice_options_v2` still has a pre-existing anonymous execute grant. Include it in the progression RPC/ACL cleanup before PR closure.

## Immediate remaining PR #170 work

Do **not** reopen completed migration 38-66 slices without contradictory evidence.

Current blockers:

1. continue the final source-choice coverage audit:
   - XPHB High Elf replaceable Wizard cantrip;
   - EFA Khoravar Fey Gift replaceable cantrip;
   - Eladrin season/trance choices;
   - Boon of Energy Resistance;
   - Echoing Soul / Zhentarim Tactics Long-Rest Expertise;
   - Cartomancer Hidden Ace;
   - remaining class/subclass runtime families already excluded from permanent Forge state;
2. confirm/correct Echoing Soul's separate permanent acquisition count if the imported/source audit proves it under-modeled;
3. obsolete/authenticated progression RPC + ACL cleanup, including the anonymous class-choice getter;
4. final authenticated browser acceptance;
5. Steps of the Fey per-cast integration only when spell/combat execution is explicitly in scope;
6. tactical consumption of canonical runtime damage resistance only when encounter/combat is explicitly in scope;
7. merge PR #170 only after closure gates are satisfied.

### Recommended next implementation slice

Continue the final source-choice coverage audit read-only first. The next likely bounded Species slice is the Long-Rest replaceable cantrip family: XPHB High Elf and EFA Khoravar Fey Gift. Inspect current source/Forge/spell authority before designing storage so the permanent spellcasting-ability choice is not accidentally conflated with the replaceable cantrip.

After source-choice coverage closes, perform progression RPC/ACL cleanup and authenticated browser acceptance.

## Documentation precedence

1. live Supabase schema/functions/protected data;
2. current repository source/validators;
3. `Documentation_Refresh_Manifest.md` + detailed PR #170 status documents;
4. platform-wide roadmap/tactical ledgers;
5. historical exports only as provenance.

## End copy
