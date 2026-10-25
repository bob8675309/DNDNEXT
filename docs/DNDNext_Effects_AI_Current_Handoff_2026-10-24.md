# DNDNext — Current Effects Engine + Future AI Tool Handoff
Updated: 2026-10-24. **Read this first when taking over the effects-engine work.**

> **2026-10-24 reconciled live status — read this first.** PRs **#249, #252, #254, #256 and #258 were merged into main**. Latest verified `main`: `863eb7d9809257d525af5c76be4b8d2289603052` (re-fetch before acting). Remaining **draft, unmerged, undeployed** work: independently #250 Physical Specimen; stacked **#251 → #253 → #255** generic effects and source parity; independently **#257** campaign attunement Standard-3/Unlimited policy and character-specific bonds. #255's isolated PostgreSQL test suite passed at its latest observed head. #257 remains an implementation draft until rest/prerequisite, existing magic-effect consumer, and class-exception integration are verified. No live DnDWeb SQL deployment. See [#257 attunement status](https://github.com/bob8675309/DNDNEXT/blob/feature/campaign-attunement-policy-20261024/docs/Campaign_Attunement_Policy_Status_2026-10-24.md).

## 2026-10-24 effects-engine release-readiness checkpoint

**New required next-read:** [Character_Effects_Release_Readiness_Gates_2026-10-24.md](Character_Effects_Release_Readiness_Gates_2026-10-24.md). The earlier requirements and catalogue audits remain detailed **scope/evidence records**; this file makes their outstanding **implementation, ownership, testing and acceptance gates** explicit, without declaring a whole effect family implemented when only source data or stored choices exist.

- Verified heads: PR #251 `68526d451722b1f35ccdf30b42ed42171ee86d90` → #253 `5cfeef36541d6a882144ec00aed56d30bdc5a92a` → #255 `dda0f432d963a5b6a87b65e5f6f4bbd27a860602`. #255's isolated PostgreSQL, contract and validation checks passed on **16 genuine structured item-catalogue subsets in synthetic inventory**; no live-character, source-attunement or combat consumer was switched. Re-fetch current heads.
- Separate drafts: #250 `132b0484ccc45bbcc87827db0eb483896ae446e1` Physical Specimen (HP/Speed staging is not the complete six-effect contract); #257 `081b2892290e367ff99b6c96af947e2505029a5e` campaign attunement Standard-3/Unlimited capacity and character bonds (isolated tests green, **Short Rest/eligibility and actual magical-effect gating incomplete**).
- **Live query verified:** the legacy equipment SQL exists; the draft common resolver/adapter, Physical Specimen projection and attunement table/toggle/RPC do **not** exist in DnDWeb production. Existing catalogue entries, character sheets, actor permissions and active encounter snapshots must not be changed to compensate for draft behavior.
- **Real source gaps:** ability *replacement* (`ability.static`), fly/climb/swim derived Speed (`modifySpeed`), spell attacks/DC and proficiency, poisoned-save and conditional effects, shield in the wrong equip slot, attunement eligibility and source-defined stacking need actual authoritative consumers and targeted tests—not arithmetic-only claims.
- AI can eventually consume **permission-filtered, already-authoritative** effect projections/explanations. This remains **future scope** and is never a reason to expose private SQL or give the model a game-state write path.
- Required sequence: reconcile equip/ownership/rest/bonds and production-shaped payloads → test one guarded consumer at a time → finish Physical Specimen and alternative rest source families → tactical/character sheet/permission/regression parity → actual-component UI approval and deployment decision. **Do not merge or deploy draft SQL solely because CI is green.**

- **New isolated eligibility staging:** draft [#260](https://github.com/bob8675309/DNDNEXT/pull/260) (stacked on draft #257, **not** merged into #251's calculator chain) adds service-only read-only source/equipment/attunement status and **always fails closed for magic**. All exact-head source-contract, PostgreSQL and repository checks passed at `d3f8825d9ca2df308abcf902d8cf3c4ef7a01a9e`. Existing equipment, tactical and sheet consumers remain unchanged. Production item payloads for common Protection Ring/Cloak/Boots items omit explicit attunement metadata; this is a **source normalization blocker**, not a license to grant their powers. See [#260 gate](https://github.com/bob8675309/DNDNEXT/blob/agent/passive-equipment-eligibility-readonly-20261024/docs/Passive_Equipment_Effect_Eligibility_Gate_2026-10-24.md).

## Purpose and verification limit
This is the compact takeover authority for the work spanning three ChatGPT conversations, supported by the currently available earlier-chat handoff/video excerpts, source-controlled documents and code, GitHub PR status and read-only DnDWeb Supabase checks. It **does not claim** to contain every verbatim message from the two previous chats. Where an older design document conflicts with live source, the live source wins. Re-fetch exact GitHub branch heads, latest PR status, migration ledger and database functions before acting.

Repository: bob8675309/DNDNEXT. Production/default: main (last verified SHA 863eb7d9809257d525af5c76be4b8d2289603052; **re-fetch before work**). Next.js **Pages Router**, React, Supabase/Postgres, Vercel. Supabase project DnDWeb: ucggczovhmauhshvhusx. Read-only 2026-10-24: PostgreSQL 17.4, items_catalog 2,739, inventory_items 19, spell_effects 1,037.

**Neither the draft common resolver nor the draft Physical Specimen SQL is deployed to production.** Existing equipment, tactical spells, conditions, inventory and rest authorities remain live. This is primarily a rules/integration effort, not a Character Forge redesign.

## Five-minute recovery and current PR topology

1. Read this file, `docs/README.md`, `docs/Documentation_Refresh_Manifest.md` and the opening current override of `docs/DNDNext_Current_Handoff_Prompt.md`. All older "current" sections beneath these overrides are historical checkpoints.
2. Read **main-merged** `Item_Character_Effects_Coverage_Audit_2026-10-24.md` and `Character_Effects_Cross_Conversation_Requirements_Audit_2026-10-24.md` (#252). Do **not** call these draft-only.
3. Inspect current PR descriptions, base/head, changed files, exact-head GitHub Actions and read-only live DB. Read `docs/CHATGPT_REPO_WRITE_PROCEDURE.md` before writing; approval and end-to-end compatibility gates still apply to unmerged runtime branches.
4. Follow the source catalogue → inventory/feature grant → permission/ownership/equip/attunement/rest → canonical numeric/tactical consumer → sheet/AI display pipeline. Never replace an authoritative resolver because isolated arithmetic matches.
5. For attunement, check the draft #257 source and migration status; `campaign_item_pool_settings.unlimited_attunement_enabled` does **not** exist in production until explicitly deployed. A three-vs-unlimited switch changes only attunement capacity, not gear slots.

| PR | Status | Branch dependency and purpose |
|---|---|---|
| [#249](https://github.com/bob8675309/DNDNEXT/pull/249), [#252](https://github.com/bob8675309/DNDNEXT/pull/252), [#254](https://github.com/bob8675309/DNDNEXT/pull/254), [#256](https://github.com/bob8675309/DNDNEXT/pull/256), [#258](https://github.com/bob8675309/DNDNEXT/pull/258) | **Merged main** | Workspace preflight; item/effects coverage; comprehensive handoff; current PR reconciliation |
| [#250](https://github.com/bob8675309/DNDNEXT/pull/250) | Draft | Independent Physical Specimen backend with incomplete save/vision/check/movement consumers |
| [#251](https://github.com/bob8675309/DNDNEXT/pull/251) | Draft | Common private effect evaluator + narrow equipment read model; base of #253 |
| [#253](https://github.com/bob8675309/DNDNEXT/pull/253) | Draft, base #251 | Actual legacy equipment resolver parity tests using synthetic catalogue records |
| [#255](https://github.com/bob8675309/DNDNEXT/pull/255) | Draft, base #253 | 16 genuine item-source payload subsets; isolated CI green, known gaps preserved |
| [#257](https://github.com/bob8675309/DNDNEXT/pull/257) | Draft, base main | Standard D&D 3 vs Unlimited attunement, character-item bonds, Admin switch, isolated tests. **Not yet consumer-ready or deployed** |

No current draft is authorized for production because a CI fixture passes. Any merge/deployment must preserve existing paper sheet, character Forge, equipment placements and separated world/town systems.

## Data and authority map

Source + validated import (5etools/Grim Hollow/campaign overrides)
→ canonical species/class/subclass/feat/spell/item catalogues and source IDs
→ character creation/progression grant instances or inventory ownership/equip; special runtime feature choices; spell/condition state
→ **source-aware entitlement, activation, duration, usage, attunement and event-context adapters**
→ optional pure common arithmetic/roll-mode resolver
→ existing **authoritative consumer** (sheet formulas, tactical RPC/action/save/attack/healing/damage, movement/vision, crafting)
→ projection, logs and Realtime to UI/AI context.

Do not turn this into a new general-purpose persistent effects table or alternate character-sheet save path without a separate design and migration gate.

**Current live equipment authority:** private.character_equipment_effects_v1(uuid) merges items_catalog.payload || inventory_items.card_payload (instance wins same-name keys), computes ability score/mod bonuses, AC/armor/Dex/shield, saves/checks, initiative. Authorized public wrapper: character_equipment_effects_v1(uuid). Client: utils/equipmentEffects.js (descriptive hints), utils/authoritativeEquipmentEffects.js, components/CharacterSheetPanel.js and CharacterSheet5e.js. Tactical weapons separately use encounter_weapon_profile_internal_v1 and bonusWeapon. Do not double count total equipment AC or persist computed overlays in character_sheets.sheet.

**Current live damage authority:** private.encounter_equipped_damage_mitigation_v1 and public.encounter_apply_damage_internal_v1. Actual latest campaign order is **immunity → Resistance (round down) → highest matching flat typed reduction → vulnerability → temp HP → HP**, with source-aware order and without item-prose inference. Example: 30 fire damage, Fire Resistance and flat fire reduction 10 = 5 damage. Migration sql/20261016_08_resistance_before_flat_reduction.sql overrides the order in older migration _07. Unlike the numeric resolver, mitigation examines catalogue and instance separately and combines matching sources; therefore numeric override semantics cannot be blindly reused.

**Live schema caveat:** inventory_items has is_equipped/equip_slot/card_payload but no dedicated is_attuned column. At least 221 catalogue items carry reqAttuneTags. No eligibility implementation or authoritative attunement-state path was verified; investigate rather than assuming equipped = attuned. No dedicated inventory charge column was verified; charge state may live in payload or elsewhere.

**Current rest/condition authority:** character_runtime_feature_choices, character_rest_log, encounter_conditions and encounter_timed_effects. Source-specific triggers and guarded RPCs own lifecycle. Current tactical RPC snapshots must not silently recompute persistent sheet bonuses or be rewritten by a getter.

## Complete scope of the proposed common system
The original requirement is **not just numerical equipment bonuses**. Allow source-specific adapters for:
- **Source/provenance:** species, feats, background, class/subclass, spell, item, crafted equipment, potion, enchanter, encounter condition; edition/source/level, grant-instance identity and equipped/attuned/active state.
- **Kinds/targets:** ability **score replacement** vs score bonus vs modifier, proficiency and Expertise, all 18 skills/saves, AC and variant unarmored defenses, initiative, HP/current/temp/max, Speed and movement modes, Darkvision grant vs range **extension**, attacks/weapon-specific hit and damage, spell attack/Spell Save DC, save DC of an item effect, damage dice/size/die-step, condition application/immunity, typed resistance/immunity/vulnerability/flat reduction, Advantage/Disadvantage, action-specific riders and weapon masteries.
- **Trigger/context:** affected actor/target, saving-throw ability, skill and condition, weapon/spell identity, attack subtype, damage type, creature/condition/location, one-shot uses, duration and source-specific advantage context. An item making attackers roll at Disadvantage is not a permanent bearer attack penalty.
- **Operations:** add/subtract, min/max/replace, multiplier/derived equality, choose/selection, canceling roll modes, guarded conditional effects, typed damage sequencing and authoritative events. Some effects require rule-specific RPC logic rather than a generic scalar.
- **Lifecycle/stacking:** passive, equipped/attuned, Action/Bonus Action/Reaction activation, per-use/charge, duration/concentration, per-turn/encounter, long/short-rest replacement or expiry, sourced nonstacking/most-beneficial stacking, exact provenance and request-id idempotency.
- **Consumers:** sheet display + standalone roll math, tactical save/attack/spell/damage/heal/actions, movement/LoS/vision, active snapshots, crafted consumable use, NPC/DM later AI context. The engine never authors a free-form game-state change.

**Draft PR #251 currently has only** add/minimum/multiply, condition-gated Advantage/Disadvantage, controlled stacking keys and 12 numeric targets plus three roll modes. Its equipment adapter supports saving throws, Athletics/Acrobatics, initiative only. This is a foundation, NOT evidence that the larger scope is implemented.

### Source-family examples that the first narrow audit omitted
- Wild Heart Aspect of the Wilds: **Owl** 60-ft Darkvision grant OR existing Darkvision **+60 ft**, Panther climb = effective walking Speed, Salmon swim = effective walking Speed; selection survives Long Rest, later rest opens optional replacement.
- Bestial Soul: swimming + underwater breathing, climbing with special surfaces, once-per-turn jumping skill check; natural weapons count as magical for overcoming resistance/immunity. Choice expires at **next** Short/Long Rest.
- Boon of Energy Resistance: two typed resistances, each feat acquisition instance owns its chosen pair, Long Rest may replace. Dread Allegiance/Fiendish Resilience share an existing runtime-resistance projection. Tactical consumption still needs parity proof.
- Astral Trance/Eladrin Trance: skill/weapon/tool proficiencies expire at next Long Rest; Eladrin seasonal identity instead persists and can be replaced after rest; seasonal Fey Step combat effect deferred.
- Echoing Soul: permanent acquired skills/language, and **persisting** replaceable Expertise. Zhentarim Tactics: Expertise acquired after Long Rest **expires** at next Long Rest. Expertise depends on effective proficiency; must never permanently write a temporary bonus to Forge.
- Source-owned actions: Hunter's Prey, Bestial Soul, Goliath ancestry, Aasimar, subclass riders, spell-specific conditions, weapon masteries and healing/damage stages may need their own adapters or commands. Do not conflate 'choice configured' with 'combat mechanic wired'.
- Alchemy: distinguish ingredient modifier or craft-time Effect %/Die Step/Duration/Extra Dose changes from final consumable's applied effect and doses. A mushroom with Effect +100% is not a passive character buff.
- Current live item presence includes ability (49), modifySpeed (41), attachedSpells (354), charges (220), recharge (258), reqAttuneTags (221), positive_effects (232), saveDc (114), stealth (37); plus bonusSpellAttack (40), bonusSpellSaveDc (27), bonusProficiencyBonus (1), immune (14), conditionImmune (18) **without verified matching equipped gameplay consumers**. These are counts of keys, **not proof of missing gameplay**.

Read the deeper matrix in [the main-merged cross-conversation audit](Character_Effects_Cross_Conversation_Requirements_Audit_2026-10-24.md).

## Physical Specimen remains the first strict feature integration test
Draft #250 covers source eligibility (Grim Hollow PG24 Parasite Patron XPHB Warlock 3+), six benefit options, Charisma-dependent choice count, once/Long Rest Bonus Action activation, once/Short Rest replacement, selected max HP/Speed and guarded combat HP synchronization. **Unwired or unproven** downstream consumers include poisoned-save Advantage, vision with existing Darkvision extension, Athletics/Acrobatics bonuses, jump distance, climbing movement. Do not ship the player selector until mechanics, source identity, ACL, rest and tactical consumers are validated. Mock up against **actual** Forge/Profile components first; preserve paper-style sheet and accepted art/spacing.

## Planned future AI integration — a consumer, never an authority
Source of truth: docs/DNDNEXT_AI_INTEGRATION_FOUNDATION.md (2026-10-09). The AI service itself is **not implemented**; code search found the conceptual dndnextAI interface in that document, not a connected runtime. Existing agreed direction: one provider-neutral service, initial local Ollama/llama.cpp-style text, later optional providers/desktop packaging; admin-reviewed magic item drafting first, then NPC text, then shared Actor AI, and eventually selection only among server-supplied legal tactical actions. Preserve the agreed sequence; **do not begin AI implementation because effects are being refactored**.

The shared effect system should eventually provide **read-only, server-owned tools / context builders**. Proposed **future contract, not an existing function**:
1. Authorized, visibility-filtered current-character/effect projection with sources, eligible active effects, targets and suppressed reasons. Any DM-only/actor-only facts are removed **before** model inference; AI cannot query arbitrary Supabase rows or reveal hidden encounter opponents.
2. Event-specific authoritative preview or rule explanation (e.g. why a Poisoned save is advantaged, why a ring reduced Fire damage) using the **same** server rules logic as UI/gameplay. Explain provenance, conditional eligibility, and missing support; avoid inventing final outcomes for unsupported features.
3. For magic-item drafting, AI proposes a **draft**, while existing schema, rarity/effect budgets, Smithing/Enchanting/Alchemy rules, material constraints and admin Save validate/persist. AI output is untrusted and never directly converted to trusted effect JSON.
4. For tactical decisions, encounter engine returns filtered **legalActions**, AI may suggest/choose one; the already authorized action RPC revalidates target, controller permission, range/turn/resources/state and commits/logs. The AI cannot provide arbitrary effect payloads, RNG outcomes, SQL, HP mutation or a direct state write.

The pure private SQL function from #251 is an **internal component**, not an RPC that should be exposed to models or browser users. Add a permissioned adapter and safe read model later after gameplay parity and explicit AI scope approval.

## Parity gates before any merge/integration
1. **Genuine catalogue-source payloads** + inventory instance overrides, copies/unequipped/wrong slot, attunement authority, player/NPC ownership, source edition and normalized feat grant instance. PR #253 only proves a **synthetic** payload path through the actual legacy resolver.
2. AC and dependencies: base and score replacement, raw score vs direct modifier, all 18 skills, Expertise and temporary proficiency, unarmored Monk/Barbarian, light/medium/heavy, negative Dex, shield, alternative AC, additive item ring with source-correct stacking.
3. Combat: specific weapon/ranged/natural attacks, magic bonus hit AND damage, spell attacks/DCs and item save DC, typed Resistance/flat reduction/vulnerability/immunity/condition immunity, condition consequences, one-shot advantage and source-target contexts.
4. Movement and HP: effective walking speed, climb/swim/fly/burrow, jump multiplier/check/rules, vision grant/extend, stage/activate/start/turn/rest expiry, HP reconciliation/repeated loads/concurrency, healing/temp HP, client UI/standalone rolls.
5. Rest/resources: persistent replacement vs automatic expiration; spell/concentration, charge spending and refill, potion dose/use, action/bonus/reaction economy, request-id dedup and log/version.
6. Isolation: compile/test against production-shaped PostgreSQL, compare established outputs, verify permissions/search paths and wrappers, run focused + broader CI and browser smoke. No production SQL until explicitly reviewed; no unapproved merge.

## Documentation routing / avoid stale status
- Current topology: **this handoff** → docs/README.md → docs/Documentation_Refresh_Manifest.md → specific PR document and live GitHub/Supabase.
- AI design: docs/DNDNEXT_AI_INTEGRATION_FOUNDATION.md.
- Source/equip/sheet: docs/Crafting_Equipment_CharacterSheet_Tactical_Pipeline.md; docs/Character_Sheet_Formula_Reference.md; docs/Tactical_Encounter_Equipped_Damage_Mitigation_Status.md.
- Creation and rest: docs/Unified_Character_Forge_Status.md, docs/Character_Progression_and_Higher_Level_Forge.md, docs/Pending_Rest_Runtime_Choices_Status.md, all relevant *Runtime_Status.md ledgers.
- Combat: docs/Tactical_Encounter_Combat_Roadmap_Blueprint.md, docs/Tactical_Encounter_Phase1H_Reactions_Effects_Status.md and latest tactical spell/turn ledgers, always inspect live RPC implementations.
- Items/crafting: docs/Player_Forge_Starting_Equipment_Status.md, docs/ItemCard_Visual_Standards.md, docs/Item_Art_Bible.md; docs/alchemy-brew-guide-v10.json is latest versioned JSON, while older v4–v9 guides and six .xlsx codices are **historical versions**, not equivalent active rule authorities.
- Changes: docs/CHATGPT_REPO_WRITE_PROCEDURE.md; docs/REPO_ACCESS_STANDING_RULE.md. Use exact-head GitHub blob/tree/commit with fast-forward ref update, never force, and preserve draft PR and deployment boundaries.

**World map is protected**: never touch components/MapPageClient.js, routes/movement/clock/weather/camping unless specifically approved. Town/city map is a separate surface. Character Forge and paper-style character sheet designs are protected; new UI requires actual-component mockups first. No browser-owned combat authority, no AI model-owned rules or state.
