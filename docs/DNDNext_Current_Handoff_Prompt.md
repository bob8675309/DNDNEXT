# DNDNext Next-Chat Handoff Brief

## Latest isolated Attack permission hardening — stacked draft (2026-10-28)

Following green #298 regression jobs, the atomic Attack candidate stages a **post-participant-lock** authorization check against current controller, character edit permission (matching row locked `FOR SHARE`), or admin. The service-only execution grant and fail-closed authenticated-role hold remain unchanged. No production RPC, API endpoint, role grant or live combat path is enabled. See [identity boundary](Attack_Action_Identity_Boundary_2026-10-27.md).


## 2026-10-28 isolated Attack identity regression follow-up

The #296 fail-closed role guard caused expected PG16 fixture failures because old tests lacked a synthetic authenticated role. A stacked follow-up now restores isolated regression execution by mocking `auth.role()` only within disposable PG16, while adding explicit service-role rejection and no-write checks. This proves no signed-in JWT authentication or production authorization. Do not deploy or enable the atomic Attack candidate. See [identity boundary handoff](Attack_Action_Identity_Boundary_2026-10-27.md).


## NEW DRAFT — atomic Attack identity security hold (2026-10-27)

On a child branch of #294, the candidate now rejects `service_role` execution before participant locking because live `encounter_can_control_participant_v1` trusts that role unconditionally. Only an `authenticated` request context can pass the new guard, while the EXECUTE grant remains service-role-only: this **intentionally prevents candidate execution**, not a completed user authorization bridge. See [Attack_Action_Identity_Boundary_2026-10-27.md](Attack_Action_Identity_Boundary_2026-10-27.md). Existing #294 test results must not be attributed to this new branch. No production SQL or browser API changes.


## Latest draft #294 — production helper parity

**Latest draft #294 (2026-10-27):** Source-audited live roll/damage helpers differ from old July baseline. Final roll helper consumes next-attack Guiding Bolt Advantage and Vicious Mockery Disadvantage and cancels them together; final damage helper reads equipped-item resistance/highest typed flat reduction, applying Resistance first then flat before Vulnerability and temp HP. Exact helper bodies now tested in disposable PG16 including effect/HP/log rollback and #293 idempotent candidate. No live code or production migration, no browser RPC or complete class/focus/hand enforcement. The private candidate still requires a trusted user identity not established for service-role callers. Read [Canonical_Roll_Damage_Parity_2026-10-27.md](Canonical_Roll_Damage_Parity_2026-10-27.md) before attempting endpoint integration.


## 2026-10-27 Atomic Attack candidate, draft #293

Current leaf [#293](https://github.com/bob8675309/DNDNEXT/pull/293) (stacked on #292) contains a **private service-role-only atomic weapon attack candidate** with one Action spend and per-attack event ledger, tested using isolated deterministic helper doubles. It is NOT accessible to browser callers, never deployed, and does not replace the legacy weapon/unarmed writers. Do not merge or activate without complete class/grip/hand/attunement rules, real effect/damage parity and signed-in combat regression. [New technical handoff](Attack_Action_Atomic_Weapon_Candidate_2026-10-27.md).


## Latest source-aligned combat handoff — #292 (2026-10-27)

Current stacked draft [#292](https://github.com/bob8675309/DNDNEXT/pull/292) introduces a service-only **read-only** bridge between #291 simulated Attack ordinal and the real `encounter_weapon_profile_internal_v1` / `encounter_targeting_context_internal_v1` outputs. It does not call the real attack roll helper because that consumes Guiding Bolt one-shot advantage; it also does not reserve attacks, roll, spend Action or damage. Exact catalogue ID matches and character custody guard more strictly than the legacy weapon profile's item-name fallback. [Attack_Resolver_Preflight_Parity_2026-10-27.md](Attack_Resolver_Preflight_Parity_2026-10-27.md). No production SQL, and combat/attunement readiness remains false.



## 2026-10-27 continuation — #291 source-derived Extra Attack budget SHADOW

Newest stacked draft [#291](https://github.com/bob8675309/DNDNEXT/pull/291) introduces a server-sourced class/feature capacity check and ordered idempotent *simulated* attack slots, never trusting browser-supplied counts. Fighter PHB/XPHB 5/11/20 and standard base-class level-5 Extra Attack tiers are probed; subclass grants/Attack replacements and multiclass remain explicitly unsupported. Existing real `encounter_weapon_attack_v1` still spends an Action per attack; this branch does not replace it, charge an Action or roll damage. Exact staging details in [Attack_Action_Source_Budget_Shadow_2026-10-27.md](Attack_Action_Source_Budget_Shadow_2026-10-27.md) and [master handoff](Attunement_Effects_Integration_Current_Handoff_2026-10-26.md). All #267→#291 PRs remain draft; no production migration.



## Newest verified architectural gap — #290 Attack action sequence (2026-10-26)

Before implementing an active hand/focus consumer, review [PR #290](https://github.com/bob8675309/DNDNEXT/pull/290) and [Canonical_Attack_Action_Sequence_Gap_2026-10-26.md](Canonical_Attack_Action_Sequence_Gap_2026-10-26.md). Read-only production source inspection confirms the existing weapon/unarmed RPC consumes the whole Action on **one** resolved attack, with no Extra Attack per-action event ledger or weapon interaction count. Core action RPC supports Dash, Disengage and Dodge, not Shield Utilize. The new private event-log audit merely reports existing events and preserves `extraAttackExecutionSupported=false`, `combatConsumerEnforced=false`; it does not spend or create actions. All optional attunement/source/hand/effects PRs #267→#290 remain staged drafts, never merged or applied live.



## Latest action rules evidence — PR #289 (2026-10-26)

Draft [#289](https://github.com/bob8675309/DNDNEXT/pull/289) adds private exact-source `2H` versus `V`/Shield and typed S/M spell component diagnostics. It does NOT charge Attack/Utilize, declare cast legality, prove two-hand attack grip, authorize a spell focus, or replace battleboard writers. 2024 Attack action equip/unequip interactions occur per attack; the #288 single-transition-per-turn **test quota is not canonical action economy**. Required post-shadow work: transactional actual Attack/Shield action costs, two-hand and somatic/material exceptions, source magic and rest permissions. Read [Encounter_Hand_Rules_Constraints_Shadow_2026-10-26.md](Encounter_Hand_Rules_Constraints_Shadow_2026-10-26.md) and [current master handoff](Attunement_Effects_Integration_Current_Handoff_2026-10-26.md).



## Newest hand-state work — draft #288 (2026-10-26)

After #287 precombat snapshot and dry-run, staged [#288](https://github.com/bob8675309/DNDNEXT/pull/288) now writes **only shadow participant-hand rows** in a locked transaction, with exact UUID idempotency, turn/version guards, source item custody and stale rejection. It is a concurrency/invalidation proof, **NOT** active-held authorization, a 2024 D&D action-spending implementation, or gameplay focus/attunement enforcement. Its experimental quota is one applied change per participant-turn but cannot be used as canonical action economy. See [Encounter_Hand_Transition_Command_Shadow_2026-10-26.md](Encounter_Hand_Transition_Command_Shadow_2026-10-26.md); Admin readiness flags must stay false and production DB/world/town maps remain untouched.



## Current continuation — #287 encounter hand lifecycle preflight (2026-10-26)

The latest leaf [#287](https://github.com/bob8675309/DNDNEXT/pull/287) is **draft-only**. It captures #286 character hand staging into an encounter participant **before combat**, separately from the canonical equipped `weapon_1`–`weapon_3` slots. Active-turn `preview_encounter_hand_transition_shadow_v1` checks control/turn, exact inventory ID and snapshot version but **never executes** draw/stow/switch or spends action resources. Item owner/slot/source changes invalidate the entire captured version and cannot be recaptured while combat is active. See [Encounter_Hand_Snapshot_Transition_Preflight_2026-10-26.md](Encounter_Hand_Snapshot_Transition_Preflight_2026-10-26.md) and [master effects handoff](Attunement_Effects_Integration_Current_Handoff_2026-10-26.md). All magic focus, held-state and attunement consumer readiness remain false.



## Most recent staged work — #286 (2026-10-26)

Current leaf [#286](https://github.com/bob8675309/DNDNEXT/pull/286) stages a user's **precombat hand intentions** using separate `main`/`off` records referencing exact equipped inventory IDs; it does not change physical `weapon_1`–`weapon_3` equipment positions or authorize spell-focus effects. The loadout write checks actual character permissions, item ownership and exclusivity, server combat lock and item-row concurrency; updates to an item invalidate stale declarations. **No action-time holding verification or game consumers exist**. Leave Admin `effectsEnforced`/readiness false, and do not merge/deploy this draft independently. Full scope and tests: [Character_Hand_Loadout_Staging_2026-10-26.md](Character_Hand_Loadout_Staging_2026-10-26.md) and [current effects ledger](Attunement_Effects_Integration_Current_Handoff_2026-10-26.md).



## 2026-10-26 continuation — #285

The next stacked draft, [#285](https://github.com/bob8675309/DNDNEXT/pull/285), adds an exact `spells_catalog.classes text[]` check and an inventory hand-slot collision audit in private, service-only diagnostic SQL. A catalogue class match is *not* proof of a character class spell grant; an equipped main/off-hand or weapon slot is *not* proof the item is actively held. Do not enable magic focus bonuses, assume stacking, rewrite spell-slot snapshots or mark Admin readiness true. See [Attuned_Spell_List_Hand_Evidence_2026-10-26.md](Attuned_Spell_List_Hand_Evidence_2026-10-26.md) and [the current ledger](Attunement_Effects_Integration_Current_Handoff_2026-10-26.md).



Updated: 2026-10-26

## ACTIVE 2026-10-26 handoff override — effects and optional attunement

**Read [Attunement_Effects_Integration_Current_Handoff_2026-10-26.md](Attunement_Effects_Integration_Current_Handoff_2026-10-26.md) before any attunement/effects/Inventory/Rest/weapon/spellcasting change.** This is the current status ledger and supersedes the *old active-status dates* below without erasing historical implementation records.

- Stacked **draft** PRs [#267](https://github.com/bob8675309/DNDNEXT/pull/267)–[#283](https://github.com/bob8675309/DNDNEXT/pull/283), new **#284** for held/worn and spell-source evidence; standalone [#266](https://github.com/bob8675309/DNDNEXT/pull/266) rest popup to integrate. [#257](https://github.com/bob8675309/DNDNEXT/pull/257) is **superseded**, still draft; never merge its standard/unlimited attunement model with the OFF-by-default three-item model.
- Existing player Inventory/Equipment Manager is the attunement selector, not a recreated picker. A rest navigation link is **not** a signed server rest authorization. Selection can be saved in the staged model, but its `effectsEnforced`/consumer readiness remains **false**; no production SQL has been applied.
- All later effect math, AC/DEX, Resistance/DR, weapons, sheet spells, tactical spellcasting/foci and slot/override comparisons are *read-only diagnostic branches*. Existing live resolvers/writers and original rest/encounter resources are authoritative; no actual three-item magic-property suppression occurs in production.
- In real inventory, `weapon_1`, `weapon_2`, `off_hand` and accessory slots are physical evidence **not** active held/worn proof. Exact spell class list, focus stacking, account ownership/custody, rest privilege and damage/conditions all remain release blockers. `encounter_spellcasting_profile_v2` may sync persistent spell slots; never call it from an inert test/probe.
- Keep world travel/weather/time simulation separate from town/city maps and tactical encounters. No uncontrolled Forge, paper sheet, ItemCard or equipment-drag redesign.
- Re-fetch current `main`, draft base/head, exact-head CI, Vercel and read-only Supabase before any implementation; no merge/deployment until owner approves a fully verified, source-aware integration.

**All “authoritative” headings below are historical checkpoints for earlier dates.**



Repository: `bob8675309/DNDNEXT`

Stack: Next.js **Pages Router** 16.1.6, React 19, Supabase/Postgres, Bootstrap/SCSS, Vercel.

## 2026-10-24 current verified continuation — effects, attunement, and PR dependencies

**Read [DNDNext_Effects_AI_Current_Handoff_2026-10-24.md](DNDNext_Effects_AI_Current_Handoff_2026-10-24.md) first**, then [docs/README.md](README.md). Earlier dated "authoritative" checkpoints below are **historical records**; they do not override this current branch/deployment ledger.

- Last verified `main` is `0e925958b49505e010a011b1de4d6de28f30b7b7`, updated after merging #249, #252, #254 and #256. Re-fetch before any change. Those four PRs are CLOSED/MERGED, not active drafts.
- Open draft topology: **#250** Physical Specimen independently; **#251** pure effect calculation and equipment adapter → **#253** real legacy-resolver fixture → **#255** 16 genuine catalogue-source payloads. #255's isolated source/SQL checks were green at the last verified head but do not establish production-readiness.
- **#257** independently stages the requested Admin Dashboard Standard D&D (three item) versus Unlimited attunement switch, character-specific attunement bonds, guarded commands and tests. The setting does not affect `is_equipped` or `equip_slot`; no live migration is deployed. Rest, class exceptions, full source prerequisites and all runtime-effect consumers remain required pre-merge gates.
- Actual magic bonuses have multiple authorities: catalogue+instance `card_payload` numeric equipment; weapon profiles; typed tactical mitigation; spellcasting and conditioned runtimes. Never double count magic item bonuses or translate ItemCard prose directly into gameplay.
- Source/provenance, permission, equip state, attunement, Short Rest, use/charges, concentration, encounter snapshots, class prerequisites and correct target are distinct obligations. Numerical effect parity does not imply legal activation.
- AI design in [DNDNEXT_AI_INTEGRATION_FOUNDATION.md](DNDNEXT_AI_INTEGRATION_FOUNDATION.md) is **future** provider-neutral architecture. It can consume read-only, visibility-filtered effects/rules context later; do not implement AI or give it independent DB/gameplay authority as part of this work.
- No uncontrolled changes to world-map vs town-map routes, Character Forge art/spacing, NPC/Player Forge parity, original paper character sheet, tactical encounter snapshots, or live Supabase. Any PR requires exact-head CI, comparison and owner review appropriate to its impact.

## 2026-10-18 item-art recovery override — use this before older item-art notes

Production `main` was consolidated by PR #230 at `69a8cd27cc87706704e75417ff8ff0d082c7001f`, including the portrait-library work, ItemCard/Forge readability fixes, and the first 66 ItemCard art masters.

A full conversation-to-repository reconciliation then found **60 previously accepted ItemCard images** that had been generated/packaged but missed from that merge. PR #233 (`recover-missed-item-art-20261018`) is the bounded recovery pass.

Recovery scope:
- Foundation Batch 07: 30 masters
- Foundation Batch 08: 20 masters
- Foundation Batch 09: 10 masters
- expected library after merge: **126 total masters**
- all production files live under `public/item-art/masters/`
- all recovered repo masters are exact 1024×1024 PNGs
- no runtime item-rule, crafting, merchant-stock, economy, movement, world-map, town/city-map, or database-authority changes

The recovery used the established Dropbox → one-shot GitHub Actions bridge. PR #232 was transfer-only and was closed without merge after the workflow verified the expected branch head, all three ZIP SHA-256 values, every individual PNG SHA-256, exact filenames, PNG signatures, exact dimensions, and the exact 60-file diff before pushing the binary commit to the recovery branch.

The canonical checklist is `docs/Item_Art_Bible.md`. It now records all Foundation Batches 01–09 and the duplicate-prevention gate. The two rune-stone variants are intentionally retained as separate accepted masters unless Paul explicitly chooses to collapse them later.

Always re-fetch current `main`, PR #233 exact head/checks, and Vercel before merge or further item-art mutation.

## 2026-10-11 authoritative override — use this before every older checkpoint below

Current production authority is `main` at `5937d5e960e8de117be6f5605754306137f0ae0a` (merged PR #208).

- PR #207 is merged and retained the accepted spell-browser, prerequisite, Training/Class-choice, source-rule, and transactional starting-market foundation.
- PR #208 is merged and production-deployed.
- Exact PR #208 head `6da80428cb6403f63e8586eec8a944f9dc80dbd0` passed **17 / 17** triggered GitHub workflows before merge.
- Vercel production deployment `dpl_3f2vpd1AcmgWXkLEpc4Kv8swJ1tF` is **READY** and `/profile` returned HTTP 200.
- Live Supabase migration `20261011142727 player_forge_homebrew_starting_budget` is registered.
- The Player Forge Equipment ruleset seam is now explicit: `dndnext-homebrew` is the player-facing default with a **300 gp minimum starting market purse**; `vanilla` retains imported class/background cash alternatives, and legacy Package A/B/C source data/payload support remains available for the future campaign-wide ruleset switch.
- Starting-market checkout remains server-authoritative: live merchant/storefront state, stock, quantity, and current price are revalidated transactionally at character creation; inventory/currency remain character-scoped.
- Starting Level sits above the Subclass Browser rather than covering Class hero art.
- selected and source-granted Feat rows share the teal pinned presentation; quick list-row Select/Deselect controls use the existing Bonus Feat authority, while Granted/Locked states remain protected.
- source-owned Spell helper text is larger; completed source-owned selectors auto-collapse but remain manually reopenable.
- browser review can deep-link to a Forge step with `?forgeStep=equipment` or another step name/number. This is navigation only and does not bypass creation validation.
- The Equipment storefront is portrait-aware, but production currently has one enabled storefront merchant and no populated storefront portrait. Do not invent placeholder merchants/art; add merchant NPCs and approved shop portraits as a deliberate content/art pass.

Post-migration verification showed the 300 gp server floor and ruleset guard live, with the existing production counts unchanged by the migration: 7 characters, 18 inventory rows, 0 character-currency rows, 1 enabled storefront merchant, and 16 stock rows / quantity 16.

Supabase security-advisor output still contains broader pre-existing RLS/SECURITY DEFINER warnings unrelated to PR #208; do not conflate those with this migration.

Always re-fetch current `main`, live Supabase, and Vercel before mutation.

## 2026-10-09 authoritative override — use this before every older checkpoint below

Current production authority is consolidated on `main`.

- PR #199 (floating ruined-library subclass Tarot selector) is merged.
- PR #202 (Metamagic Adept, invocation details, Forge spell browsing) is merged.
- All 36 required new Grim Hollow expansion Tarot cards are installed and mapped on `main`.
- PR #203 (Grim Hollow Player's Guide spells/items/subclasses) is now folded into `main` after reconciliation.
- Live Grim Hollow catalogue authority: 101 spells, 40 subclasses / 258 subclass-feature rows, and 106 items; the full item seeder preserves reviewed `price_gp` instead of treating raw 5etools cp values as gp.
- Grim Hollow Player's Guide Tarot rollout: complete at **36 / 36** new cards; no creation batch remains.
- The restored authoritative art-direction file is `CHARACTER_FORGE_TAROT_SUBCLASS_CARD_STANDARD.md`.
- The restored current artwork maintenance handoff is `CHARACTER_FORGE_TAROT_SUBCLASS_ART_HANDOFF.md`.
- `Character_Progression_v3_Implementation_Status.md` is no longer the accidental path-probe placeholder; it now points to the real progression authority and records the merged PR #202 choice-routing state.
- Current production checkpoint `3b4cb1113b170d703f4f161f8ac149a3e7f2ffe9` (PR #204) is deployed READY on Vercel and `/profile` returned HTTP 200.

Current source of truth for the Grim Hollow art queue is `Next_Chat_Handoff_2026-10-07_Grim_Hollow_Tarot.md` (updated in place on 2026-10-08) plus the artwork checklist/status docs.

The Grim Hollow source catalogue is production content. All 36 new non-Monster-Hunter subclass identities are runtime-visible and now have dedicated approved Tarot cards; current runtime fallback count is 0.

Always re-fetch current `main` before writing; do not treat any recorded SHA as permanently current.

### 2026-10-09 next product direction — finish Forge, preserve AI readiness

The next broad development priority is to finish/reconcile the ten-step Character Forge on current `main` before implementing the planned AI subsystem.

Use `docs/Unified_Character_Forge_Status.md` for the shared Forge authority and `docs/DNDNEXT_AI_INTEGRATION_FOUNDATION.md` for the agreed future local-AI direction.

While finishing Forge, preserve stable canonical ids, source/provenance metadata, structured lifecycle-aware choices, explicit ownership/permission boundaries, and reusable read models. Do not add an AI-specific save path or duplicate character state.

Planned AI work after the Forge completion pass:

1. local admin magic-item drafting into the existing item-creation modal;
2. one text-only NPC conversation proof;
3. shared Actor AI for NPCs/monsters;
4. later bounded encounter decisions selected only from encounter-engine-generated legal actions;
5. eventual downloadable local-model packaging.

Existing DNDNext validation/persistence remains authoritative. AI is a creative/reasoning layer, never a replacement for Forge, crafting, combat, inventory, or database authority.


### 2026-10-11 Forge UX / Equipment follow-up — PR #208

PR #207 is merged to `main`. The next bounded browser-review follow-up is PR #208 on `agent/forge-ux-equipment-homebrew-20261011`.

This follow-up moves Starting Level off the Class hero art, gives Feat rows direct Select/Deselect controls while preserving source-granted ownership, enlarges source-owned Spell helper text, auto-collapses completed source-owned Spell selectors, and adds `?forgeStep=<step>` browser-review deep links.

Equipment now has an explicit ruleset seam:
- default player-facing ruleset: `dndnext-homebrew`;
- homebrew starting-market floor: **300 gp** before existing higher-level wealth;
- `vanilla` preserves imported class/background cash alternatives;
- legacy Package A/B/C source data/payload support is retained for the future global vanilla/homebrew ruleset switch;
- merchant stock/price checkout, character-scoped inventory/currency, and server authority remain unchanged.

Do not add synthetic merchant records or placeholder shop portraits merely to fill the new selector. Production had one enabled storefront merchant and no populated storefront portrait at this checkpoint; merchant NPC/portrait expansion should be a deliberate content/art batch.

### 2026-10-09 active Forge browser-review follow-up — PR #207

Current bounded work is PR #207 on `agent/forge-spell-browser-readability-20261009`.

Scope:

- slightly larger Background dossier text and removal of its redundant bottom routing note;
- compact sortable one-line Forge spell catalogue;
- client-side hard ceilings for class cantrip/leveled-spell selection while retaining v3 server validation;
- less-zoomed Forge SpellCard chrome;
- structured player-facing spell rules using existing catalogue/raw payload;
- Light/Finesse/Reach expansion for imported item-property shorthand;
- one scroll body with a collapsed Spell Progression section;
- Training Current Selection cards now use intrinsic content height instead of a forced viewport-height empty tail;
- Fighting Style choices preserve the complete imported feat description rather than the generic source-backed placeholder;
- class/subclass optional-feature rules were audited end-to-end and exact source descriptions are now available for all **218 / 218** currently referenced option identities;
- Battle Master maneuvers, Arcane Shots, Rune Knight runes, Four Elements disciplines, Pact Boons, Eldritch Invocations, Metamagic, and Grim Hollow optional-feature families now resolve source-backed rules through the shared class-option authority;
- the player Background catalogue now stretches through the available desktop height instead of stopping at the generic list cap, and its implementation-facing source-routing note is removed;
- Training's Skills / Feats / Class Choices tabs now show a player-facing completion fraction below the existing status badge instead of the tiny implementation subtitles. Skills intentionally counts a fixed Background skill grant as one completed source unit, so the Acolyte + Ranger example begins at **1/4** and advances to **4/4** as the three shared Class Skill / Trade Skill picks are completed;
- Expertise keeps the existing controls beside proficient Skills and is also mirrored into **Class Choices** using the same canonical class-choice group/state. The Current Selection panel explains that Expertise doubles the Proficiency Bonus for checks using the chosen proficient skill and identifies the granting class feature;
- implementation-facing Training helper prose, including the long Trade Skill compatibility paragraph and redundant bottom helper strip, is no longer shown to players;
- Training list/detail typography was increased moderately, and dense Class Choice feature text now renders as readable titled sections rather than one small wall of prose.

The source/provenance and `create_player_character_v3` boundaries are unchanged. This second screenshot-driven UX slice is presentation/routing only and adds no new Supabase write. The latest browser-review pass did add two narrowly scoped live source-rule enrichment SQL files: `20261009_01_enrich_class_feature_option_rules.sql` and `20261009_02_backfill_referenced_optional_feature_rules.sql`. They repair descriptions/source metadata only; they do not alter legal-choice counts, prerequisites already curated by DNDNext, progression ownership, save paths, or unrelated game systems.

Pinned upstream rule sources for this pass are `5etools-mirror-3/5etools-src@8c026b807fac21862a309379a0c3228a0683198b` and `TheGiddyLimit/homebrew@ab4012f136dc1224c45d6c13c1d8f71b543c34bb`. Live post-apply audit is **218 referenced optional-feature identities / 218 with descriptions / 0 missing**; preferred Fighting Style feats are **17 / 17** described.


## 2026-10-01 authoritative override — use this before every older checkpoint below

The older PR #176/#193/#194 sections remain useful architecture/history, but they are no longer the active work checkpoint.

### Current GitHub / deployment state

- current `main`: `ab8c5ce6df1fabd906890b38bcfee16deac2ca0d`;
- active work: PR #199 — **Polish floating ruined-library subclass Tarot selector**;
- branch: `agent/subclass-tarot-scene-rebuild-20260922`;
- validated runtime head before this documentation update: `5ad44348198a5b299a81ec9ff349cbb1db942ad4`;
- PR state at this checkpoint: **open / mergeable / unmerged**;
- all **12/12** PR-triggered GitHub workflows completed successfully at `5ad44348198a5b299a81ec9ff349cbb1db942ad4`;
- exact-head Vercel deployment `5rFeEKFPQ4UFCWeowSAbyfNYVe9M`: **READY / success**;
- preview host: `dndnext-git-agent-subclass-tarot-9aeaa6-pauls-projects-2016aa54.vercel.app`;
- PR #199 contains no Supabase migration/data change.

Documentation-only commits after `89197828b6ae9945ac436da4339ef910c379eb4c` may advance the branch SHA without changing runtime behavior. Always re-fetch the exact PR head before writing, validating, deploying, or merging.

### Current Character Forge Class / subclass architecture

The active selector is a **floating Tarot carousel in a dark, smoky ruined gothic library**. The retired physical runic-table/contact model must not be restored.

The Class step now has two independent viewport-floating detail models:

- `classFeatureDetail` → **Class Feature** panel;
- `subclassCodexDetail` → **Subclass Codex**.

They deliberately do not replace each other. The Codex and Feature panel may be open simultaneously.

Routing is intentionally split:

- subclass inspection → `onSubclassDetail` / Subclass Codex;
- class/subclass feature inspection → `onFeatureDetail` / Class Feature panel;
- Codex Progression feature pills may open the Feature panel while leaving the Codex open.

Desktop reading targets are currently about **720px** for the Subclass Codex and **520px** for the Class Feature panel. Preserve independent drag/close state and readability.

Subclass selection authority is unchanged: carousel movement never persists a subclass; explicit eligible selection still flows through the existing guide model and `model.selectSubclass(option)`.

### Validator reconciliation completed

The PR #199 Class changes exposed stale literal expectations in older validators. Those contracts were reconciled to the accepted architecture without weakening runtime authority:

- `validate_class_browser_polish.mjs` now expects the independent Subclass Codex callback and current selector import shape;
- `validate_pr170_browser_smoke_corrections.mjs` validates structural independent `<details>` disclosure instead of obsolete prose literals;
- `validate_class_subclass_browser.mjs` now guards `onSubclassDetail` rather than the retired shared Feature callback;
- `validate_artificer_mockup_lock.mjs` now preserves the same split callback contract.

At `5ad44348198a5b299a81ec9ff349cbb1db942ad4`, all 12 triggered workflows and Vercel pass.

### 2026-10-02 subclass completeness / Codex repair

Paul's browser videos exposed a source-presentation bug rather than missing live catalogue data.

Live read-only Supabase inspection confirmed that Winter Walker, Bladesinger, and the affected examples already had their source-backed feature/lore rows. The resolver had been treating **every subclass row with `raw_payload.header = null` as an introduction**. That is invalid for newer imports: 65 of 275 subclass source groups contain more than one null-header row, so valid same-level features were being hidden by `guideSubclassFeatures()` and the first alphabetical null-header row could be shown as lore.

The accepted repair:

- identifies a subclass introduction by normalized subclass identity plus a null-header requirement, rather than null-header alone;
- preserves wrapper names such as College/Circle/Oath/Way/Order, Domain, Patron, Sorcery, Magic, and Bloodline;
- keeps same-name real feature rows with non-null headers visible, including Kensei and Mystic Soul Knife edge cases;
- restores Winter Walker level-3 `Frigid Explorer`, `Hunter's Rime`, and `Winter Walker Spells` while retaining `Fortifying Soul`, `Chilling Retribution`, and `Frozen Haunt`;
- restores Bladesinger's `Bladesong` and `Training in War and Song` instead of misclassifying them as lore;
- expands the player-facing internal-reference sanitizer so mixed-case/long source codes such as `FRHoF` and `UATheMysticClass` no longer leak pipe-reference metadata into Codex text;
- requires whole-word spell-grant verbs, preventing text such as “again ... spell slot” from falsely classifying `Frozen Haunt` as a spell-grant feature;
- therefore resolves Winter Walker's structured spell grants to Ice Knife (3), Hold Person (5), Remove Curse (9), Ice Storm (13), and Cone of Cold (17), instead of the false Hunter's Mark result;
- moves the Codex Tarot backdrop down slightly by changing its vertical object position from 28% to 20%, so the artwork is less top-cropped.

Read-only catalogue audit after the new introduction identity rule found one source group with no intro candidate: the SCAG Totem Warrior supplemental Elk/Tiger fragment, which contains only supplemental features and no standalone lore row. No database write was required.

Validated runtime head: `5cebb825bfc57ce0a00fb32020845259c3e69ada`.

At that exact runtime head:

- all **12/12** triggered GitHub workflows passed;
- Vercel deployment `FEDUUsrMw2PGavNWwgDb3GwXovkV` is **READY / success**;
- PR #199 remains open / mergeable / unmerged;
- no Supabase migration/data write and no world-map, town/city-map, tactical, crafting, inventory, merchant, economy, travel, weather, camp, or clock change was made.

### 2026-10-02 Codex finishing pass

Paul approved the consolidated Codex direction from browser review.

The Subclass Codex now has only three top-level tabs:

- **Overview** — owns both lore and feature browsing. The left reading pane shows source-backed lore; the right feature index swaps the left pane into the selected feature and provides **Back to lore**.
- **Progression** — remains the combined class/subclass progression table and still opens the independent Class Feature panel.
- **Spells** — now follows the established Profile → Spellbook interaction instead of a flat grid of spell cards.

The Spells tab uses a two-pane workspace:

- left: compact selectable subclass-spell list with level/school/source plus grant/status tags;
- right: the shared existing `SpellCard` in compact mode, so casting time, range, components, duration, damage/area, description, source, and other catalogue metadata use the same presentation language as the profile spellbook;
- explicit subclass level grants and special Dunamancy access stay visible in the selection context.

The redundant standalone **Features** and **Lore** tabs are removed because Overview already provides both functions.

Tarot backdrop framing is also changed structurally rather than by another percentage tweak:

- the backdrop now begins at the top of the Codex body, behind the navigation strip;
- the navigation strip is opaque and sits above the artwork;
- therefore only the portion below the navigation border is visible;
- the Tarot image is top-aligned with a top transform origin, placing the portrait/faces lower in the visible crop.

Validated runtime head: `5ad44348198a5b299a81ec9ff349cbb1db942ad4`.

At that exact runtime head:

- **12/12** triggered GitHub workflows passed;
- Vercel deployment `5rFeEKFPQ4UFCWeowSAbyfNYVe9M` is **READY / success**;
- no Supabase migration/data write or protected-subsystem change was made.

### Immediate continuation

Continue browser acceptance of PR #199 rather than reopening old architecture:

- verify Subclass Codex + Class Feature panel can remain open together;
- verify Feature-panel readability and independent drag/close behavior;
- verify the three-tab Codex: Overview / Progression / Spells;
- verify Overview lore/feature swap behavior and the Profile-style two-pane Spells workspace;
- verify the Tarot backdrop begins behind the nav strip and the visible portrait crop sits lower;
- test Wizard / dense catalogue and a four-option class;
- test slow drag, fast flick/snap, arrows/keyboard, side-card click → hero/select, responsive layouts, and reduced motion.

Do not merge PR #199 without Paul's explicit approval.

## 2026-09-21 authoritative override — use this before every older checkpoint below

Older sections remain useful architecture/history, but their PR numbers and accepted-main checkpoints are stale.

### Accepted PR #195 runtime checkpoint

PR #195 — **Gate unauthenticated navbar and add admin activity view** — is merged.

- runtime code checkpoint merged by PR #195: `320671a22b83432177dcc67e9efd035f3c3ccc5d`;
- documentation-only commits may advance `main` beyond that SHA without changing runtime behavior; always re-fetch current `main` before work;
- validated PR #195 head: `30befd23507081fcbaa3b06c6634b1022d404ab7`;
- production Vercel deployment: `dpl_ETZZCzVZq8Cpw56Fndf9pfYmp5B8`;
- production state at this handoff: **READY**.

Read `Auth_Navigation_Admin_Activity_Status.md` before changing navbar auth exposure or the admin activity tracker.

Important PR #195 behavior now on production:

- signed-out users do not receive campaign/private navbar links;
- admins have the recent site-activity surface;
- activity tracking stores no IP, user-agent, fingerprint, or precise location;
- live anonymous visit ingestion is bounded in Postgres;
- anonymous and per-account browser visitor keys are separated;
- the current auth state is authoritative for account attribution.

### Live Supabase checkpoint

Project remains `DnDWeb` / `ucggczovhmauhshvhusx`.

Latest relevant registered migrations are now:

- `20260921152546 admin_site_activity_v1`;
- `20260921153151 admin_site_activity_acl_fix`;
- `20260921153328 admin_site_activity_retention_v1`;
- `20260921185225 admin_site_activity_hardening_v1`.

The old 214-migration / `20260814161314` checkpoint below is historical.

### Current active Character Forge work

PR #194 — **Refine subclass Tarot carousel interaction and clarity** — remains **open / unmerged**.

- branch: `agent/subclass-carousel-drag-crisp-20260918`;
- reviewed head: `f21a81435946b1ae8ec6112e5376062cfc2b62f4`;
- exact-head Vercel preview: `dndnext-86xs3s1d4-pauls-projects-2016aa54.vercel.app`;
- preview state at this handoff: **READY**.

Read `Character_Forge_Subclass_Tarot_Flexible_Ring_Status.md` before changing the subclass selector.

The current controlling carousel architecture is **not** a fixed 3/5/7/9-card presentation. It is:

> **One physical table ring. N subclasses = N evenly spaced cards. One exact front hero position. Presentation derives from each card's angle/depth on that ring.**

Important consequences:

- no fixed visible-card cap;
- Monster Hunter's four cards naturally occupy four 90° positions;
- Wizard's large deck uses the same ring at smaller angular intervals;
- only the exact front card receives hero treatment;
- rear cards remain on the ring and use the ornate back;
- clicking a face-up card rotates that card to the hero position;
- carousel movement alone must never persist a subclass;
- native Tarot art remains `840 × 1440`;
- the supplied cathedral/runic-table screenshot is the visual target;
- stage/background/table artwork may be replaced if necessary, but preserve the Tarot deck.

### Immediate next-chat task

Start by re-fetching:

1. current `main`;
2. PR #194 current head/mergeability;
3. PR #194 exact-head Vercel state;
4. live Supabase only if the requested work touches database-backed behavior.

If Paul continues Tarot work, compare the current PR #194 preview against the supplied target and test both:

- Monster Hunter / another 4-option class;
- Wizard / a dense subclass catalogue.

Do not revive old fixed-card-count rules from historical chat or stale docs.

If Paul instead asks for documentation cleanup, use this override plus the two new focused status documents to reconcile older ledgers systematically rather than rewriting history blindly.

## 2026-09-18 current override — read this before older checkpoint prose

The older sections below retain useful architecture/history, but their PR-number checkpoint is stale. Current active Character Forge subclass work is **PR #193**, branch `agent/subclass-tarot-approved-batch-20260916`, open and unmerged.

Current implementation checkpoint before this documentation refresh:

`49b6a0486878748f5d9c3147eb51fdbe16358451` — `Harden runic carousel preview effects [deploy-preview]`

Current accepted state:

- the full runtime-visible subclass Tarot deck is complete at **149/149** dedicated cards;
- the resolver ledger contains **152 normalized installed concepts** because historical compatibility identities/explicit aliases remain represented;
- current runtime-visible generic/class fallback count is **0**;
- the subclass selector is now the approved **runic circular Tarot gallery** rather than the old compact two-column selector;
- four cards are prominent on the front arc at desktop scale; all remaining choices continue around the same circular orbit as smaller/dimmer rear cards;
- Left/Right advances exactly one option and wraps continuously without duplicated scroll rails or recentering;
- selection, eligibility, persistence, progression, and Supabase authority remain unchanged;
- the 2026-09-18 implementation checkpoint passed the Class-browser/subclass validators and Vercel Preview `dpl_5kcUtbeqoWqsY7iBMaLeyb81buaX` is READY; `/profile` returned HTTP 200.

Read these current focused documents before changing subclass presentation/art:

- `docs/CHARACTER_FORGE_CLASS_SUBCLASS_SELECTOR_ARTWORK.md`
- `docs/CHARACTER_FORGE_SUBCLASS_ARTWORK_STATUS.md`
- `docs/CHARACTER_FORGE_TAROT_SUBCLASS_ARTWORK_CHECKLIST.md`
- `docs/CHARACTER_FORGE_TAROT_SUBCLASS_CARD_STANDARD.md`

The standing world-map boundary is unchanged: **do not touch world-map behavior unless Paul explicitly requests it, and never mix world-map behavior with town/city-map behavior.**

Always re-fetch PR #193 and current `main` before writing or merging. Source + exact-head CI/deployment outrank this recorded SHA if the branch moves.

## Current authoritative checkpoint

Accepted runtime/code baseline on `main`:

`a2aecdd354346926afdf33efb1af320581563b68` — merged Character Forge **Background** polish/art system (PR #175).

Active work is **not on `main`**. The current open continuation branch is:

- PR #176 — `agent/training-tab-redesign` — still **open / unmerged**.

PR #176 began as the player Training redesign and has since accumulated broader Character Forge browser-review work, including later Class/Abilities presentation polish. Immediately before the 2026-08-30 documentation-only Realistic Dice handoff updates, the remote PR head was:

`9447be566f8383e8227c6fccb37a0bde2bdbe078`

Documentation commits made after that checkpoint advance the branch. **Always re-fetch the exact current PR head before writing, validating, deploying, or merging.**

Recent accepted Forge chain:

- PR #170 — unified Character Forge / progression / runtime foundation — merged `599c4de7397ba6e4bbbb0a061d551d80c3570be7`.
- PR #171 — Species artwork/presentation, Profile/Forge window continuation, Heritage/Profile integration — merged `ed93331b946dffee1e63183e969f115d0c8a1a18`.
- PR #172 — Eladrin/Hexblood/shared Species readability refinements — merged `8b62e38cc4de490dd4a02b57b0e9448baff3e5ef`.
- PR #173 — source-backed Simic Hybrid Animal Enhancement descriptions — merged `8c37e30063d2523a5f488073d3ea60c5571c7182`.
- PR #175 — Background layout, source-choice polish, and reusable Background art system — merged `a2aecdd354346926afdf33efb1af320581563b68`.
- PR #176 — **active / unmerged** Character Forge browser-review continuation.

Species and Background are accepted enough to freeze unless a concrete browser regression is reproduced. Current Character Forge work should stay incremental and exact-head validated.

## Most important new future plan: Realistic Dice Roller

Read:

- `docs/Realistic_Dice_Roller_Architecture_Roadmap.md`

This is now the controlling design document for the planned reusable Realistic Dice subsystem.

The current Abilities page contains a CSS-based dice-tray/result-die prototype. It is **not the final architecture**. The next reusable dice implementation should support:

- Forge ability generation;
- Character Sheet checks/saves/initiative;
- damage/healing dice later;
- future tactical combat roll presentation;
- true d6, d8, d10, d12, and d20 geometry;
- a Forge-only aggregate `resultCube` for generated totals such as 4d6-drop-lowest results.

Locked architectural rule:

> **D&D rules/RPCs/Forge generation determine the outcome. The Realistic Dice physics engine only visualizes that already-known outcome.**

Do not let client rigid-body physics become authoritative for attacks, saves, damage, initiative, generated ability scores, tactical movement, LOS, or any other rules result.

### Current dice prototype files

At the pre-documentation PR checkpoint, relevant Forge files include:

- `components/NpcForgeAbilityStep.js`;
- `styles/character-forge-ability-dice-tray.css`;
- `styles/character-forge-ability-dice-bounce.css`;
- style imports in `pages/_app.js`.

The current prototype usefully preserves:

- six generated totals;
- hidden results until the player rolls;
- hover math showing individual dice and the dropped die;
- drag/select assignment into ability slots;
- reroll behavior;
- reduced-motion presentation.

Preserve those behaviors while replacing the CSS trajectory system later.

### Realistic Dice implementation boundary

Do **not** keep widening PR #176 into the permanent physics-engine PR.

Once Paul accepts the current Forge checkpoint, the Realistic Dice Core should be implemented on a **new bounded branch/PR from the accepted Forge state**. Documentation about that future system can live on #176, but the actual Three/Rapier subsystem deserves a separate review boundary.

Preferred initial technology direction, subject to a fresh compatibility check at implementation time:

- `three`;
- `@react-three/fiber`;
- direct `@dimforge/rapier3d-compat`.

Initial Realistic Dice Phase 1 should require **no Supabase migration** and should not touch the world map, town/city maps, tactical movement/pathfinding, crafting, inventory, merchants, or economy.

## Copy-ready takeover instruction

You are taking over DNDNext as a senior developer and technical advisor. Before changing anything, inspect current GitHub `main`, PR #176 and its exact head, the live Supabase project, CI, and Vercel. Then read this brief plus `Realistic_Dice_Roller_Architecture_Roadmap.md` and the dedicated ledger for whichever Forge/tactical subsystem you are touching. Reconcile source, live data, validators, deployment state, and documentation before writing. Preserve working systems and verify every helper, hook, state variable, prop, callback, RPC argument, dice-contract field, and physics-world reference is defined and passed correctly. Do not touch the world map unless Paul explicitly requests world-map work, and never mix world-map behavior with town/city-map behavior.

GitHub, live Supabase, current source, exact-head validators, and deployed behavior outrank prose when they disagree.

## Mandatory startup sequence

1. Inspect `main`, PR #176, exact remote head, changed-file scope, GitHub workflows, and Vercel state.
2. Inspect Supabase project `ucggczovhmauhshvhusx` (`DnDWeb`) and only the tables/functions relevant to the requested subsystem.
3. Read `docs/README.md`, `Documentation_Refresh_Manifest.md`, this file, and the dedicated active subsystem ledger.
4. If continuing dice work, read `Realistic_Dice_Roller_Architecture_Roadmap.md` in full before proposing code.
5. Inspect the existing consumer path end to end before extending/replacing presentation.
6. Preserve existing source-choice/runtime/persistence authority; do not create parallel state for presentation convenience.
7. Continue on the current branch only when the requested change belongs to its accepted scope. For the actual reusable Realistic Dice engine, use a dedicated branch/PR after the current Forge checkpoint is accepted.
8. Run focused validators plus regression/protected-boundary checks and verify Vercel exact-head readiness.
9. Before merge, re-read the PR head, confirm all triggered checks succeeded, and use an expected-head guard.
10. Never use a merge action as a substitute for finding branch-write tooling.

## Non-negotiable boundaries

- World-map and town/city-map behavior are separate systems.
- `components/MapPageClient.js`, world travel, routes, weather, camps, and world clock are protected unless Paul explicitly asks for world-map work.
- A Forge/UI/dice patch does not authorize route, travel, tactical movement, crafting-runtime, inventory, merchant, or economy changes.
- Tactical encounter rule resolution remains server/RPC authoritative.
- Dice rigid-body collisions must **not** replace `encounterHex`, pathing, occupancy, LOS, cover, or turn/action rules.
- Do not convert rest-configurable or per-use decisions into permanent Character Forge choices.
- Persistent source choices must reuse existing source-choice authority; do not add duplicate React or database state.
- Prefer additive database migrations. Never rewrite already-deployed migration history.
- Never expose a Supabase service-role key to the browser.

## Live Supabase checkpoint

Project: `DnDWeb` / `ucggczovhmauhshvhusx`.

The prior migration-ledger checkpoint was 214 records with latest registered migration `20260814161314 grim_hollow_heritage_catalog_support`. Some repository SQL effects may be live under different migration-ledger naming, so inspect live effects before any database action and do not re-run already-correct production SQL by assumption.

The Realistic Dice Phase 1 architecture does not require a database write. Tactical integration later should consume the existing authoritative encounter RPC/combat-log result path rather than inventing a second roll authority.

Relevant tactical live objects already include:

- `encounters`;
- `encounter_participants`;
- `encounter_combat_log`;
- `encounter_command_requests`;
- encounter conditions/effects/spell-slot/reaction/map tables;
- `encounter_weapon_attack_v1`;
- `encounter_unarmed_strike_v1`;
- `encounter_roll_save_v1`;
- current encounter spell-casting RPC family;
- `encounter_move_active_participant_v1`.

## How the site fits together

| Area | Primary entry points | Authority / important boundary |
| --- | --- | --- |
| Global shell | `pages/_app.js`, `components/AppNavbar.js` | Mounts persistent Profile/Forge shell and global runtime surfaces. A future global dice host should be considered only after multiple consumers exist. |
| Auth/profile | `pages/login.js`, `pages/signup.js`, `pages/profile.js`, `PlayerCharacterProfilePanelUnified.js` | Supabase Auth plus player/profile/permission rows; stale async identity loads must not overwrite the active character. |
| Shared Character Forge | `NewNpcModalV3.js`, `NewNpcModalV3Refined.js`, `NpcForgeStepContent.js` | One creation architecture for NPCs and players. Player creation uses existing creation RPC authority. |
| Forge context/choices | Species/Class/Source choice contexts | Explanation and canonical choices are separated by lifecycle/placement. Existing context state serializes into the creation payload. |
| Abilities / current dice prototype | `NpcForgeAbilityStep.js`, `character-forge-ability-dice-tray.css`, `character-forge-ability-dice-bounce.css` | Existing Forge roll objects are math authority. Current motion is presentation only; planned Realistic Dice replaces presentation, not generation/allocation. |
| Training | `NpcForgeTrainingStep.js`, preserved `NpcForgeTrainingStepBase.js`, player Training modules | Player redesign on PR #176; NPC legacy path remains intentionally isolated unless deliberately reconciled. |
| Character/profile sheet | shared Profile/Sheet panels, `CharacterInteractionPanel.js`, `CharacterSheetPanel.js`, `CharacterSheet5e.js`, `pages/npcs.js` | Canonical character sheet, features, spellbook, equipment, runtime choices, permissions. Existing `onRoll` callback path is the future dice adapter seam. |
| Inventory/equipment/crafting | `pages/inventory.js`, `EquipmentDiagram.js`, `CraftingWorkspace.js`, crafting RPCs | Canonical inventory/equip/crafting authority. Dice work does not alter recipes/formulas/consumption. |
| World map | `pages/map.js`, `components/MapPageClient.js` | Protected world-location/travel/weather/camp/clock system. Do not embed dice rules/physics here. |
| Town/city | `pages/town/[id].js`, `TownSheet.js` | Local town profiles, merchants, crafters, interaction. Keep separate from world-map behavior. |
| Tactical encounters | `pages/encounters/*`, `components/encounter/*`, `utils/encounterHex.js`, encounter RPCs | Separate server-authoritative turn/action/spell/reaction/movement authority. Future dice adapter consumes resolved rolls only. |
| Tactical roll presentation | `TacticalAttackResultPanel.js`, combat log | Existing result/log seam that can later feed a tactical dice overlay. |
| Admin/content | `pages/admin*`, item/spell/class/species/background catalogues | Source/catalogue administration. Inspect live catalogue rows before one-off UI hardcoding. |
| Validation/deploy | `scripts/validate_*.mjs`, `.github/workflows/*`, Vercel | Focused semantic validators + exact-head deployment are acceptance gates. |

## Character Forge architecture

Player steps:

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

Choice placement follows lifecycle/dependency:

- permanent Species identity/lineage decisions → Species source-choice authority;
- skills, tools/craft proficiencies, Expertise, and proficiency-dependent choices → **Training**;
- specific Bonus Feat selection → **Training**;
- spell-centric Species/Background/Feat/Class choices → Spells;
- persistent higher-level acquisitions → Forge/progression;
- rest-configurable persistent choices → runtime panels/state;
- next-rest-expiring choices → rest-cycle runtime authority;
- per-use transformations/combat choices → action/spell UI;
- informational features → presentation only.

Direct creation at level N and earned progression to level N should converge on the same source-owned state.

## Character Sheet roll architecture relevant to future dice

`CharacterSheet5e` already performs/structures sheet checks and calls `onRoll`. `CharacterSheetPanel` forwards that callback, and `NpcPanel`/player profile presentation stores/displays the result through `CharacterSheetRollResult`.

Future `CharacterSheetDiceOverlay` should adapt that structured result first. Do not rewrite save/skill/initiative formulas solely to add 3D dice.

A later separate project may decide whether local sheet RNG should move server-side. The dice visualization contract should survive that change because it consumes a resolved result rather than owning RNG.

## Tactical roll architecture relevant to future dice

`EncounterTurnBoard` is an authoritative tactical **hex presentation**, not a physics simulation. Movement, blocking, pathing, targeting lines, area shapes, and participants are represented in discrete encounter coordinates.

`TacticalAttackResultPanel` already reads `encounter_combat_log` and formats resolved attack information. The combat log currently carries roll-oriented fields such as `roll`, `secondRoll`, `attackRoll`, `damageRoll`, `saveRoll`, `healingRoll`, `critical`, `total`, and `requestId` depending on event type.

Future tactical dice should:

- animate the RPC/log result;
- optionally use `requestId` as visual-seed input;
- never reroll the attack/save/damage independently on the client;
- never change movement/path/LOS/collision rules.

## Accepted Species baseline

Species is frozen as the accepted baseline unless a concrete defect is reproduced. Key accepted behaviors include full-height searchable catalogue, parent/child reveal, high-resolution artwork, semantic facts, Common implicit language handling, source-driven Size/Language/lineage choices, Darkvision guidance, affinity-aware Dragonborn copy, structured Aasimar/Goliath/Eladrin/Hexblood presentation, source-backed Simic choices, and guided Continue validation.

`Gift of the Aetherborn` remains source-backed and unchanged for now. Future acquisition belongs to Game-Master-defined quest/NPC dialogue progression rather than a universal Forge prerequisite.

## Accepted Background baseline

Background redesign/polish is merged and accepted. The visual system uses reusable family banners/crests/icons and compact grant/feature presentation. Do not re-open broad Background layout work unless a specific defect is reproduced.

Audit for omissions/parsing/routing mistakes, not subjective rebalancing. House-rule rebalance is a separate decision.

## Training subledger

`Character_Forge_Training_Redesign_Status.md` remains the detailed Training design/history ledger for PR #176. It is no longer the only document needed to understand the branch because later Forge browser polish also exists.

Continue to preserve:

- player/NPC Training isolation;
- source-owned proficiency/tool/feat choices;
- the large player Skills / Feats toggle direction;
- mapped tool↔Trade Skill no-double-spend behavior;
- existing completion/Continue authority.

Do not regress Training while working on Abilities/dice presentation.

## Immediate future development plan

Unless a production regression intervenes:

1. **Finish browser acceptance of the current PR #176 Forge checkpoint.** Do not reconstruct old work from chat; inspect the exact current branch and preview.
2. Keep the current CSS ability dice tray as the temporary prototype until the reusable subsystem is ready.
3. After Paul accepts the Forge checkpoint, branch a dedicated **Realistic Dice Core** PR from that accepted commit.
4. Implement Realistic Dice Phase 1 exactly as scoped in `Realistic_Dice_Roller_Architecture_Roadmap.md`:
   - normalized roll-resolution contract;
   - d6/d8/d10/d12/d20 + `resultCube` geometry;
   - Three/R3F/direct Rapier world;
   - true die-to-die and tray collisions;
   - authoritative-result final face guidance;
   - fallback/reduced-motion path;
   - Forge adapter only;
   - no Supabase/map/tactical/crafting runtime changes.
5. Browser-tune repeated rolls until paths/collisions/settling are genuinely varied and natural.
6. After Phase 1 is accepted, add the Character Sheet adapter in a separate reviewable phase.
7. When tactical work resumes, add a tactical dice adapter that consumes existing server-authoritative combat-log results.
8. Consider a global `DiceOverlayHost` only after at least two real consumers justify it.
9. Continue the remaining Forge slices and broader crafting redesign according to user priority; do not mix those projects into the dice core without an explicit scope decision.

## Documents to read by task

- Current precedence/status: `README.md`, `Documentation_Refresh_Manifest.md`, this brief.
- **Realistic Dice controlling plan:** `Realistic_Dice_Roller_Architecture_Roadmap.md`.
- Training history/contract: `Character_Forge_Training_Redesign_Status.md`, `Character_Forge_Training_Browser_Implementation_2026-08-21.md`.
- Accepted Background audit/history: `Character_Forge_Background_Audit.md`.
- Accepted Species baseline: `Forge_Post170_Species_Artwork_Status.md`.
- Shared source rendering: `Forge_Source_Presentation_and_Species_Variants_Status.md`.
- Unified creation/progression/runtime: `Unified_Character_Forge_Status.md`.
- Starting magic / source-choice routing: `Player_Forge_Choice_Routing_and_Source_Magic_Status.md`.
- Sheet/equipment/crafting: `Crafting_Equipment_CharacterSheet_Tactical_Pipeline.md`, `Character_Sheet_Formula_Reference.md`.
- Tactical combat: `Tactical_Encounter_Combat_Roadmap_Blueprint.md` plus current tactical phase ledgers and live encounter source/RPCs.
- Town/crafter: `Town_Crafter_Current_Status.md`, `Town_Route_Profile_Parent_Bake_Checklist.md`.
- GitHub/Supabase write discipline: `CHATGPT_REPO_WRITE_PROCEDURE.md`.

## Publishing discipline

Use exact-head guarded, non-forced GitHub writes. After every coherent slice:

1. inspect changed paths;
2. run applicable focused workflows/regressions;
3. verify protected boundaries and symbol/prop/callback integrity;
4. for dice work, also verify result-contract fields, physics-world lifecycle, face mapping, fallbacks, and consumer adapter wiring;
5. confirm exact Vercel deployment if triggered;
6. re-read PR head immediately before merge;
7. merge only the validated expected head.

## 2026-10-19 Grim Hollow Player's Guide Species checkpoint

PR #234 (`grim-hollow-species-import-20261018`) imports the previously omitted Player's Guide Species catalogue. The live Supabase migration `20261019013551 grim_hollow_pg24_species_catalog` is applied and verified at 17/17 rows.

Ten names are new catalogue Species: Accursed, Arisen, Disembodied, Downcast, Dreamer, Grudgel, Laneshi, Ogresh, Wechselkind, and Wulven. Seven existing-name identities are retained as separate source variants with explicit `(Grim Hollow)` labels: Dhampir, Dragonborn, Dwarf, Elf, Gnome, Halfling, and Human.

Each row uses the existing Grim Hollow Heritage source-choice authority with the full 107-trait catalogue and eight required picks. Traditional source suggestions are preserved and marked in the picker; they are suggestions, not a forced package. The source's optional Small-size 5-foot Speed reduction for an additional traditional trait is preserved in metadata/raw source data but is not automatically executed by runtime yet.

Exact validated PR head before this documentation checkpoint: `d32044570e10a6a191a51a6c125c3a755f136f30`. Re-fetch the live PR head before any write, validation claim, or merge. PR #234 remains open and must not be merged without explicit approval.
