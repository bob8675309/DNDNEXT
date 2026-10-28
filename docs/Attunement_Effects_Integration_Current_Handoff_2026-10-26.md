# DNDNext — Current Attunement, Equipment Effects and Spell Focus Handoff

## Latest #295 — authenticated Attack authorization preflight

**2026-10-27 draft #295 — authenticated Attack caller proof (not an attack endpoint).** Read-only live Supabase authorization inspection confirms `encounter_can_control_participant_v1` allows controlled player/character edit/admin and intentionally **bypasses** participant ownership for `service_role`. The #293/#294 private candidate expects `auth.uid()`, which service credentials do not inherently preserve; do not inject browser-provided user IDs or assume service-role requests are authenticated player calls. #295 adds a separate authenticated-only SECURITY DEFINER **read-only caller preflight**, checking verified-request context role+UID, actual controller, active turn and source attack budget; grants only to `authenticated`, denies service/anon, never calls the executor. Isolated PG16 tests use exact canonical control source and simulated JWT claims under real SQL roles (they do **not** verify JWT signatures or signed-in browser behavior). Full [Authenticated Attack Caller Boundary](Authenticated_Attack_Caller_Boundary_2026-10-27.md). All #267→#295 remain draft, undeployed and gameplay-disabled.


## Latest draft #294 — production helper parity

**Draft #294 (2026-10-27): live-sourced attack-roll/damage parity.** Read-only production inspection confirmed later versions of the tactical helpers than the July foundational migration: roll consumes both Guiding Bolt Advantage (target) and Vicious Mockery Disadvantage (attacker); damage consults structured equipped-item resistance and highest flat typed reduction, with **immunity → resistance (floor) → flat → vulnerability → temp HP → HP**. #294 installs exact current helper bodies in an isolated PG16 fixture (never production), tests cancellation, damage ordering, savepoint rollback and idempotent multiattack via the private #293 candidate, and exposes full mitigation/Vicious Mockery fields in the candidate result. This **does not** activate Extra Attack or a public combat endpoint. The #293 service-role versus auth.uid identity blocker and item custody ambiguities persist. See [Canonical_Roll_Damage_Parity_2026-10-27.md](Canonical_Roll_Damage_Parity_2026-10-27.md). #267→#294 remain unmerged drafts.


## 2026-10-27 Atomic Attack candidate, draft #293

Draft [#293](https://github.com/bob8675309/DNDNEXT/pull/293), stacked on #292, adds a **service-role-only, unconnected atomic weapon attack execution candidate** with source-budgeted attack ordinals, a single Action spend on the first weapon attack, exact request replay, canonical roll/damage helper calls and transactional log/effect/HP rollback. Unlike #291-#292 read-only shadows, this candidate performs writes **only when explicitly invoked in an isolated test environment**; it is NOT deployed, callable by browser roles or wired into combat. Tests use deterministic roll/damage doubles and synthetic targeting, not full production parity. Attunement, hand interaction costs, class/subclass/multiclass features and full signed-in combat tests remain blockers. [Technical document](Attack_Action_Atomic_Weapon_Candidate_2026-10-27.md). Keep readiness false and all #267→#293 unmerged.


## 2026-10-27 leaf #292 — canonical weapon resolver read-only preflight

Draft [#292](https://github.com/bob8675309/DNDNEXT/pull/292), on #291, adds `private.encounter_weapon_event_resolver_preflight_shadow_v1`, a service-only stable preflight for the next source-derived Attack slot. It calls only canonical **read-only** `encounter_weapon_profile_internal_v1` and `encounter_targeting_context_internal_v1`, reproducing range, cover/LOS and dodging context without reserving an attack slot. **Critical hazard found:** real `private.encounter_resolve_attack_roll_v1` CONSUMES one-shot Guiding Bolt advantage and logs `effect_consumed` before damage, so the preview must NEVER call it or existing attack/damage writers. Exact catalogue source key is required because the current canonical weapon profile can fall back to item display-name matching; physical custody is narrower than the legacy shared-account view. This is NOT real Multiattack, Action spending, attack or focus enforcement. See [Attack_Resolver_Preflight_Parity_2026-10-27.md](Attack_Resolver_Preflight_Parity_2026-10-27.md). All #267→#292 work remains staged and undeployed.



## 2026-10-27 next leaf — PR #291 server-derived Attack slot sequence SHADOW

Draft [#291](https://github.com/bob8675309/DNDNEXT/pull/291) extends #290's canonical Extra Attack gap audit with a **server-derived, idempotent shadow attack-action sequence**. `character_progression` + EXACT `class_catalog.source` and `class_feature_catalog` base-class feature records resolve Fighter PHB/XPHB 5/11/20 into 2/3/4 attack slots, plus Barbarian/Monk/Paladin/Ranger base level-5 grant. Mismatched source, forged subclass features, missing required tier and unsupported classes fail closed. Two guarded authenticated RPCs open one participant-turn shadow session and record ordered simulated slots with exact request replay; there is **no** real roll, target, HP/damage, action spend, equipment swap, spell, focus bonus or canonical combat writer integration. Class/subclass exception parity, Action Surge, multiclass, per-attack draw/stow, Shield Utilize and signed-in tactical testing remain blockers. [Full technical document](Attack_Action_Source_Budget_Shadow_2026-10-27.md). #267→#291 remain staged drafts, no production migration.



## Latest staged PR #290 — canonical Attack-action sequencing blocker (2026-10-26)

Draft [#290](https://github.com/bob8675309/DNDNEXT/pull/290) documents and regression-checks a **fundamental live writer limitation** found by read-only Supabase function inspection: `encounter_weapon_attack_v1` and `encounter_unarmed_strike_v1` each spend `action_available=false` after one individual attack, with no per-Attack-action sequence/remaining-attacks model. Extra Attack therefore cannot safely work through those existing single-attack writers. The `encounter_use_core_action_v1` whitelist supports only Dash/Disengage/Dodge; no Shield Utilize handler was found in the inspected public function inventory. Draft #290 adds a service-only read-only diagnostic of canonical weapon/unarmed event logs (exact actor/round/turn, command linkage), **not** an Attack or spell consumer. All Extra Attack/Shield/interaction readiness flags remain false. The #288 one-shadow-change-per-turn quota is **not** a 2024 D&D rule. Fixing the Attack-action/per-attack event state is a prerequisite for real hand/equipment interaction costs. Read [Canonical_Attack_Action_Sequence_Gap_2026-10-26.md](Canonical_Attack_Action_Sequence_Gap_2026-10-26.md). No live writer, map, Forge, inventory, spell, Action or HP changed; #267→#290 remain draft.



## Latest staged PR #289 — exact Two-Handed/Versatile/Shield and spell component evidence (2026-10-26)

Draft [#289](https://github.com/bob8675309/DNDNEXT/pull/289) adds a **private read-only** rules-source audit after #288. Read-only live DB evidence confirms the item property array is `items_catalog.payload.property` (**singular**): `Greatsword|XPHB` and `Longbow|XPHB` include `2H`, while `Longsword|XPHB` and `Quarterstaff|XPHB` contain `V`. Spells use normalized `components_s`, `components_m` and `material_text`. The new function audits exactly identified equipped/captured items, potential two-handed ATTACK grip conflict when both hands are occupied, separate Shield Utilize action context (including Animated Shield exceptions), and potential S/M spell hand restrictions. No action/equip/shield/hand/focus legality is asserted or charged. 2024 rules permit an equip/unequip interaction **per attack in the Attack action**, not an arbitrary per-turn budget; #288's single shadow change per turn remains a deliberate **test quota only**. Full tests and source links: [Encounter_Hand_Rules_Constraints_Shadow_2026-10-26.md](Encounter_Hand_Rules_Constraints_Shadow_2026-10-26.md). #267→#289 remain unmerged/undeployed. Next: reconcile actual Attack events, shields and somatic/War Caster/focus exceptions before any real consumer integration.



## Latest stacked draft #288 — transactional SHADOW hand command (2026-10-26)

Draft [#288](https://github.com/bob8675309/DNDNEXT/pull/288), based on #287, adds a participant/encounter/turn-version guarded **transactional shadow-only hand transition** and exact-request-UUID replay ledger. It locks participant+encounter, then inventory and snapshot, changes ONLY the encounter hand shadow rows, increments shadow snapshot version and supports no-change/draw/stow/replace with duplicate/reused-request protection and a conservative **one applied SHADOW change per participant/round/turn test quota**. It **does not** spend real Action/Bonus/Reaction, alter the main combat log/HP/slots, certify held/worn status, or turn on focus/attunement consumers. This quota is not a D&D rule. The current source, fixture, and unresolved real-action/dual-wield/shield rules are documented in [Encounter_Hand_Transition_Command_Shadow_2026-10-26.md](Encounter_Hand_Transition_Command_Shadow_2026-10-26.md). All #267→#288 branches remain unmerged draft; latest exact-head CI must be consulted before merging.



## Latest stacked draft #287 — encounter hand snapshot and turn preflight (2026-10-26)

Draft [#287](https://github.com/bob8675309/DNDNEXT/pull/287), on #286, adds a **precombat participant-scoped versioned copy** of intended main/off hand item IDs and a read-only transition preview requiring the active undefeated encounter participant and matching version. The copy is only allowed during `draft`/`ready`/`initiative`, and never auto-runs at combat start. Any later physical item owner/equip/slot/source change **invalidates the entire snapshot and increments its version**; an active turn cannot silently recapture. The preview distinguishes no-change/draw/stow/replace requests but **does not execute them**, consume action/bonus/reaction economy, grant held/worn truth, or enable spell focus effects. See [Encounter_Hand_Snapshot_Transition_Preflight_2026-10-26.md](Encounter_Hand_Snapshot_Transition_Preflight_2026-10-26.md). The #267→#287 leaf remains unmerged/undeployed, all effects/active-hand readiness flags false. Next task: agree transactional active-turn hand transitions and exact D&D interaction rules, action/event costs, two-handed/shield focus conditions and race-safe item transfer before any real consumer.



## 2026-10-26 next staged layer — PR #286

The current leaf is draft [#286](https://github.com/bob8675309/DNDNEXT/pull/286), stacked on #285. Directly inspected canonical `set_character_inventory_equipment_v1` and `EquipmentDiagram`: physical gear slots are `weapon_1`–`weapon_3`, not actual main/off hands. `character_hand_loadout_staging_v1` now stages exact equipped inventory UUIDs as explicit **main/off hand intentions**, via character-permissioned RPCs and an active-combat lock. Ambiguous shared-account custody is rejected, duplicate same-item hands are rejected, and slot/owner/equip/source edits invalidate declarations without touching physical equipment or combat. **A staged hand intention is NOT action-time active holding or authorization to use a focus:** `activeHoldVerified=false`, `combatSnapshotVerified=false` and `focusConsumerEnforced=false` remain mandatory. No production SQL or UI integration. Tests, migration and later RLS/action-time work are documented in [Character_Hand_Loadout_Staging_2026-10-26.md](Character_Hand_Loadout_Staging_2026-10-26.md). The draft chain #267→#286 remains unmerged; rest authorization, physical custody, cast-time swaps, spell acquisition and stacking are still blocking.



## 7. 2026-10-26 continuation — #285 exact spell catalogue list and hand-slot conflict evidence

**Draft #285**, stacked on #284, adds a private read-only exact-spell catalogue membership/hand-slot comparison. Live `spells_catalog.classes text[]` includes Warlock on both `eldritch-blast|PHB` and `eldritch-blast|XPHB`. This can **confirm a spell is listed for a class in that exact catalogue entry**, not that the character earned it from that class. `classGrantVerified=false` remains mandatory. The new read model checks exact spell ID, progressions and assignment source, and distinguishes missing class list, membership mismatch, class/source mismatch and nonclass acquisition.

It also inspects all items equipped in explicit `main_hand`/`off_hand` slots, catches multiple records claiming one hand and shared-account item ambiguity, and marks `weapon_N` focus slots as unresolved rather than assuming active holding. **`activeHandsVerified=false` even when an item is the only occupant.** No focus math, spell slots, combat or inventory state changed. Full fixture/details: [Attuned_Spell_List_Hand_Evidence_2026-10-26.md](Attuned_Spell_List_Hand_Evidence_2026-10-26.md). Stacked #267→#285 remains entirely draft. The old next-slice wording above is historical once #285 is opened; the new next task is designing real held/worn-at-execution authority and per-spell acquisition provenance with RLS and concurrency acceptance before any consumer activation.

**Exact-head PR #285 verification must be checked independently; this prose is not evidence of deployment.**

**Reconciled 2026-10-26. Current active continuation for draft PR #284.**

> **Start here when resuming effects work.** This ledger supersedes the October 24 *active-work* sections of `DNDNext_Effects_AI_Current_Handoff_2026-10-24.md`, `DNDNext_Current_Handoff_Prompt.md`, `Current_Development_Status_and_Roadmap.md` and the top of `README.md` for this feature only. Their architecture, protected boundaries and historical records remain valid. **GitHub current state + exact branch head + read-only live Supabase checks outrank this static ledger.** Do not interpret a passing fixture or Vercel preview as production deployment.

Repository: `bob8675309/DNDNEXT`. Next.js **Pages Router** / React / Supabase Postgres / Vercel. Live DB project: `ucggczovhmauhshvhusx`. This work is **draft-only and unmerged**, with no attunement or effects SQL deployed to live DB. The optional attunement campaign rule remains **OFF by default**. No world-map or town/city-map code should be changed as part of this work.

## 1. Active PR graph — do not merge an intermediate stacked head into main

The current branch/PRs were verified open, draft and unmerged on 2026-10-26. The later draft branches contain the earlier branch changes because their **PR base is the previous draft branch**, not `main`. Always confirm each head and base afresh before merging or retargeting. A single green leaf PR does not certify its ancestors for production.

| PR | Function and current status |
| --- | --- |
| [#266](https://github.com/bob8675309/DNDNEXT/pull/266) | **Independent draft**, guarded Short/Long Rest activity popup and canonical recovery. Needs eventual coordination with #267+. |
| [#267](https://github.com/bob8675309/DNDNEXT/pull/267) | Stages Admin optional attunement ON/OFF, default OFF, limit **three**; not live. Replaces **superseded [#257](https://github.com/bob8675309/DNDNEXT/pull/257)** standard/unlimited prototype (also still open draft; don't deploy both designs). |
| [#268](https://github.com/bob8675309/DNDNEXT/pull/268) | Server-side character selection, max three unique eligible equipped magic IDs, RLS/auth/RPC, combat guard, per-character ownership and shared-account claim exclusion. `effectsEnforced=false`. |
| [#269](https://github.com/bob8675309/DNDNEXT/pull/269) | Attune/Unattune and count integrated into **existing player Equipment Diagram / ItemCard**, avoiding a redundant inventory picker. |
| [#270](https://github.com/bob8675309/DNDNEXT/pull/270) | Rest activity navigates to the existing **character-scoped Inventory/Equipment Manager**. Rest URL/context is presentation, **not** server-rest authorization. |
| [#271](https://github.com/bob8675309/DNDNEXT/pull/271) | Read-only item effect eligibility shadow, fourth-item regression. **Not** a consuming resolver. |
| [#272](https://github.com/bob8675309/DNDNEXT/pull/272) | Admin Dashboard attunement readiness display and guarded configuration. Do not change readiness to “enforced” prematurely. |
| [#273](https://github.com/bob8675309/DNDNEXT/pull/273) | Physical armor/shield preservation versus separate magical riders, read-only checks. |
| [#274](https://github.com/bob8675309/DNDNEXT/pull/274) | **Private trusted source gate** `character_magic_effect_source_gate_shadow_v1` uses real inventory, source identity, per-character selection, character versus account ownership, and conservative shared-account ambiguity. |
| [#275](https://github.com/bob8675309/DNDNEXT/pull/275) | Tactical Resistance + flat damage reduction shadow. Preserves canonical **Resistance before DR** (30 Fire → 15 resisted → 5 after DR10). Writer untouched. |
| [#276](https://github.com/bob8675309/DNDNEXT/pull/276) | Direct numeric AC and saving throw shadow against original equipment resolver; physical protection remains. |
| [#277](https://github.com/bob8675309/DNDNEXT/pull/277) | Ability score/modifier + STR/DEX effects shadow; medium/light/heavy and unarmored DEX AC, manual AC override unresolved. |
| [#278](https://github.com/bob8675309/DNDNEXT/pull/278) | Magic armor/shield physical `ac` versus magical `bonusAc` catalogue/instance source audit. Dwarven Plate and Arrow-Catching Shield tested; unknown physical enhancement provenance remains blocked. |
| [#279](https://github.com/bob8675309/DNDNEXT/pull/279) | Tactical weapon attack/damage comparison. Ranged, finesse, proficiencies, actual dice/range, shared ownership and unclassified `smith_tier`. |
| [#280](https://github.com/bob8675309/DNDNEXT/pull/280) | **Separate player-sheet weapon builder** comparison: Rage, Pact/Hexblade CHA, finesse, thrown modes, and no caller-inventory mutation. OFF works without selection rows. |
| [#281](https://github.com/bob8675309/DNDNEXT/pull/281) | **Separate player-sheet spell action builder** comparison: cast stat/proficiency, cantrips, prepared spells, healing/damage metadata, override precedence including 0. Not a tactical writer. |
| [#282](https://github.com/bob8675309/DNDNEXT/pull/282) | Tactical aggregate spellcasting profile and focus raw bonus audit. Class/condition/stacking not applied; spell slot snapshot preserved. |
| [#283](https://github.com/bob8675309/DNDNEXT/pull/283) | **One spell assignment** tactical preflight, exact character ownership, casting ability, per-spell attack/DC overrides, Warlock Rod/Wizard Grimoire/Wand/Amulet scopes. Neither casts nor invokes profile v2. |
| **#284 (this branch)** | **Private read-only focus physical condition and spell origin signal audit**, plus up-to-date project documentation. Item slot is a **hint**, not active-held or worn proof; class-label match is not spell-list membership proof; multiple sources are not automatically stacked. |

**Parallel, separate work:** [#250](https://github.com/bob8675309/DNDNEXT/pull/250) Physical Specimen; common numeric effects [#251](https://github.com/bob8675309/DNDNEXT/pull/251) → [#253](https://github.com/bob8675309/DNDNEXT/pull/253) → [#255](https://github.com/bob8675309/DNDNEXT/pull/255). The common chain has genuine catalogue parity fixtures but does **not** replace the authoritative runtime consumer, and must be reconciled with the optional attunement branch before integration. Superseded [#257](https://github.com/bob8675309/DNDNEXT/pull/257)–[#265](https://github.com/bob8675309/DNDNEXT/pull/265) should never be treated as a second active attunement implementation.

## 2. What existing live gameplay still does

- **Character/Inventory:** the authoritative `inventory_items` plus `items_catalog.payload || inventory_items.card_payload`; item instance overrides matching keys. `is_equipped` and `equip_slot` are *physical* state; they do not prove per-turn active held state nor consume an attunement slot. Existing physical equipment slot restrictions remain unchanged.
- **Campaign configuration:** OFF means all current equipment and magic effects behave normally. ON is still **not wired into live effect consumers**. The selection RPC allows three candidate bonds when staged, but choosing IDs is not itself magic-effect suppression.
- **Character sheet:** `private.character_equipment_effects_v1` remains authoritative for abilities/AC/saves. `utils/characterSheetActions.js` independently builds player weapon and spell quick actions. Pact, Rage, thrown/finesse, ability choices and explicit per-spell overrides must be preserved.
- **Tactical weapons:** `public.encounter_weapon_profile_internal_v1` computes attack and magic bonuses; actual weapon attack writer remains unchanged. `smith_tier` may be a physical craft/temper bonus; do not classify it magically without evidence.
- **Damage:** tactical Resistance → flat DR → remaining consequences is the current corrected consumer order. Item resistance/DR shadows are comparisons, not replacement damage writers.
- **Tactical spells:** `public.encounter_spellcasting_profile_v1` is a read-only profile; `v2` calls `private.sync_character_spell_slots_v1` and therefore **is not safe for a read-only diagnostic**. `pages/encounters/combat.js` dispatches spell-specific `encounter_cast_spell_v1`–`v13` plus other area/effect RPCs. Reviewed writers sometimes compute their own raw-score attack/DC and honor `character_spells.attack_bonus_override` / `save_dc_override`; aggregate profile parity does not prove execution parity.
- **Rest:** canonical Short/Long Rest recovery RPC remains intact. An inventory link from the Camp & Downtime popup is not a server-side proof that an attunement change occurs at a valid rest opportunity. A solution must avoid introducing arbitrary hour timers if the owner has not requested them.
- **Shared accounts:** an account-owned item may appear in multiple editable characters' legacy equipment. A selected magic rider belongs to **one** character, but that alone does not solve physical custody/visibility in legacy consumers.

## 3. Current magic focus evidence and conservative signals

Read-only live catalogue evidence: `+1 Rod of the Pact Keeper|XDMG` carries `bonusSpellAttack=+1` and `bonusSpellSaveDc=+1`; its description says **while holding** and Warlock spells. `+1 Wand of the War Mage|XDMG` carries an attack-only bonus and requires **holding**; it must not increase save DCs or save-only spells. `+1 Arcane Grimoire|TCE` applies to **Wizard spells while holding**. `+1 Amulet of the Devout|TCE` describes a **worn** holy symbol. These descriptions provide *rules context*, not machine-proven entitlement. Existing spell catalogue assignments have `source_type`, `source_label`, and `casting_stat`, but an assignment label alone does not prove the spell is on the named class's list (multiclass, item-granted and exceptions exist).

Read-only production inventory aggregate on 2026-10-26 shows equipped sources in `weapon_1`, `weapon_2`, `weapon_3`, `off_hand`, `body`, and `shoulders` (among others). **A slot named `weapon_1` does not prove a rod is actively held**. The new `private.encounter_attuned_focus_provenance_shadow_v1` returns *signals*:
- `main_hand`/`off_hand`: `hand_slot_candidate_not_active_hold_proof`;
- `weapon_N`: `weapon_slot_does_not_prove_active_hold`;
- plausible neck/accessory worn slots: `wear_slot_candidate_not_worn_proof`;
- incompatible slot: `slot_not_sufficient_for_required_condition`.
It also compares class progression and spell assignment source label, but returns `class_label_matches_progression_but_spell_list_unverified` even on an apparent match. All `heldOrWornVerified`, `spellSourceVerified`, `stackingVerified`, `focusBonusApplied`, and `consumerEnforced` remain **false**. Multiple selected plausible foci are flagged for a future stacking rule, **never summed**.

## 4. Verified tests and strict limits

The stacked drafts carry isolated PostgreSQL16 suites and Node source-parity/contract validators. Observed passing checkpoints:
- #275: legacy mitigation parity and selected-source removal without changing damage writer;
- #276–#278: physical armor/DEX/saves and catalogue `ac` vs `bonusAc`;
- #279–#280: tactical/player sheet weapons, Pact/Hexblade, Rage, finesse, smithing warnings;
- #281–#283: player/tactical spell profiles, class-conditional focus *candidates*, override preservation, unchanged encounter slot snapshots;
- #284: source provenance and equip-slot signals, class assignment label, shared state and no stacking (*verify exact HEAD CI before marking passed*).

All CI cases so far use staged PR branches and synthetic/disposable fixture records informed by actual catalogue structures. Passing checks do not establish real browser/production execution behavior; no signed-in end-to-end gameplay attunement tests or actual ON effects enforcement have been completed. Vercel READY only means the preview built.

## 5. Release blockers in dependency order

1. Reconcile #266 independent rest dialog with #267→#284 chain, and implement **server-authorized rest opportunity** for attunement changes that cannot be bypassed via a URL. Preserve battle/combat locks and canonical rest recovery.
2. Establish authoritative **current actively held/worn state**, hands, equipment slot consistency, item/VAR provenance, and shared-account physical custody before applying focus magic.
3. Verify spell-list/provenance for class, subclass, multiclass, species and item-granted spells; classify source-specific focus requirements and legal stacking/bonus types **per exact spell/action**.
4. Reconcile common effect resolver #251→#255 with actual equipment/weapon/spell consumers. Special class effects, magic armor archetype bonuses, smith tier, rider dice and duration/charge state remain open.
5. Build safe, server-side **consumer** adapters for sheet, tactical attacks/damage, spell attack/DC/cast handlers and action/slot/condition/status paths. Do not rewrite active encounter snapshots or synchronize persistent slots in shadow/preview code. Attunement OFF must retain exact existing behavior; ON must gate **only eligible magical properties**, not physical equipment.
6. Run signed-in Admin and player browser verification, multiple characters/account-shared items, tactical HP/log/turn/slot/cast/resistance/cover regression, equipment drag/drop, rest recovery and UI states. Confirm exact-head GitHub Actions and Vercel preview, then seek explicit release approval.

## 6. Non-negotiable maintenance discipline

Read this file and `docs/README.md` before touching the attunement code. Inspect live Supabase **read-only first**; use isolated PostgreSQL fixtures for staged SQL. Update this ledger, the top of `docs/DNDNext_Current_Handoff_Prompt.md`, `docs/Current_Development_Status_and_Roadmap.md`, `docs/DNDNext_Effects_AI_Current_Handoff_2026-10-24.md`, `docs/Documentation_Refresh_Manifest.md` and `docs/README.md` whenever active state changes. Link the exact draft PR, head and test result. Do not silently rename/migrate live SQL, claim readiness, merge to `main`, or touch world-map/town-map or Character Forge without a separate scoped approval.

**Next sensible slice after #284:** design explicit held/worn event authority and assignment spell-source claims without bypassing character permissions or duplicating physical equipment. Only then plan a narrowly guarded spell focus consumer, initially OFF parity and no automatic focus stacking.

**#293 authorization integration gap:** the candidate is service-role-only but requires `auth.uid()` and participant control. Standard server service credentials might not supply an end-user UID. The PG16 fixture injects a test UID, **not** a production identity bridge. Do not expose the candidate or bypass its user authorization checks; establish a trusted caller identity protocol and signed-in tests first.
