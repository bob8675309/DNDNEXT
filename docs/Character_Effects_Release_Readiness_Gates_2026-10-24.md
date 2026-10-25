# Character Effects Engine — Integration and Release Readiness Gates
**Reviewed 2026-10-24; documentation-only. Not a deployment or game-feature approval.**

> **2026-10-25 USER PRODUCT DIRECTION — SUPERSEDES ATTUNEMENT PLAN BELOW:** [Player Rest Activities and Optional Attunement](Player_Rest_Activities_Optional_Attunement_2026-10-25.md). The game already has two combat-guarded Short/Long Rest recovery buttons. Future single rest activity dialog offers Rest & Recover, optional Attune/Change Magic Items, and later Crafting. **Attunement OFF by default**; ON is a simple three-magic-item capacity option. Normal resting and magic while OFF must **not** depend on #260–#265's hour-long focus/DM-approval stack. Those PRs are historical experimental drafts, **not approved release dependencies**. Do not merge/deploy them based on passing isolated CI. Draft #257 currently defaults Standard-3 and needs redesign. Independent draft #266 corrects rest confirmation copy only. Re-fetch live branches and deployed state.



## Authority and intended end state

DNDNext should gain a **reusable, source-aware effects calculation and explanation layer** shared by canonical character sheets/rolls, tactical mechanics, items/crafting, rest/feature state, and **eventually** permission-filtered AI context. This is **not** a promise to automate every spell/class ability in one PR or to replace existing equipment, combat, rest, spell or crafting ownership. The pure SQL resolver never decides eligibility or commits gameplay state.

**Read in this order:** [current handoff](DNDNext_Effects_AI_Current_Handoff_2026-10-24.md) → this gate → [effects coverage](Item_Character_Effects_Coverage_Audit_2026-10-24.md) and [cross-chat requirements](Character_Effects_Cross_Conversation_Requirements_Audit_2026-10-24.md) → relevant source/consumer ledger. Live GitHub, live Supabase and exact-head CI supersede dated descriptions.

### Verified repository and live anchors (point-in-time only)

- Main was **863eb7d9809257d525af5c76be4b8d2289603052**, after merged #249, #252, #254, #256 and **#258** (documentation/coverage/handoff; #258 updated top-level status). Re-fetch.
- DnDWeb Supabase (read-only): PostgreSQL 17.4; 2,739 catalogue items, 19 inventory instances, 15 characters, 1,037 spell-effect **definitions**. These counts are not coverage percentages. Legacy `private.character_equipment_effects_v1(uuid)` exists. The draft common resolver, adapter, Physical Specimen projection, and attunement table/admin setting are **not deployed**.
- Draft dependency graph: **#251 → #253 → #255** (common private calculation → existing SQL synthetic parity → 16 real structured item-payload-subset parity). **#250** Physical Specimen and **#257** Standard-3/Unlimited attunement remain **independent draft** workstreams, not dependencies already merged into the chain. #255 exact head `dda0f432d963a5b6a87b65e5f6f4bbd27a860602` passed isolated PostgreSQL, contracts and validation. #257 exact head `081b2892290e367ff99b6c96af947e2505029a5e` passed source-contract and isolated PostgreSQL tests. Neither passing suite proves gameplay completeness.
- PR #252's detailed audits are **merged into main**. #253/#255 test-gate documents and #251/#250/#257 designs are **in draft branches** until merged. Never infer that a draft migration or function is live because its file is available on GitHub.

## What "implemented" means

Use precise labels:
- **Source present**: canonical JSON/source text describes an effect; no proof it is active.
- **State supported**: progression/rest/attunement/condition record can hold a choice or bond; no proof the effect changes gameplay.
- **Numeric calculation proved**: isolated arithmetic on documented inputs reproduces tested old behavior; no proof of permission/eligibility or a connected consumer.
- **Authoritative consumer connected**: actual sheet/check/save/spell/weapon/damage/movement code applies only **eligible, active, context-appropriate** effects, verified against trusted source and requests.
- **Release-ready**: security, lifecycle, duplicate/stacking, concurrency, data compatibility, UI smoke and in-encounter regression gates pass at the same reviewed head, and the owner approves the rollout.

**Never describe an entire feature as implemented merely because it has an active selection, tooltip, structured catalogue key, or green isolated fixture.**

## Current cross-system coverage / blockers

| Workstream | Evidence | Remaining release gate |
|---|---|---|
| **Pure common resolver, PR #251** | Private pure arithmetic handles add/minimum/multiply, scoped Advantage/Disadvantage, fixed numeric/roll vocabulary, provenance and bounded stack keys | Trusted source adapters, rule-specific stacking and event context, no untrusted direct RPC; downstream consumers remain unchanged |
| **Legacy equipment parity, PRs #253/#255** | Actual legacy SQL executes against synthetic inventory, with 16 selected **real structured catalogue subsets** in #255; saves/AC/armor/overrides tested | Actual character/production-shaped entitlement and attunement, all 18 skill contexts, alternative/unarmored AC, weapon/spell effects and tactical consumers; snapshot **omits prose and complete source payloads** |
| **Item eligibility / attunement, PR #257** | Draft character-item bonds, standard cap of 3 vs unlimited, admin switch, owner/duplicate/cap/concurrency/transfer checks; isolated tests green | Standard Short Rest timing, source/class prerequisites, cursed/end conditions, Artificer capacity exceptions, *actual magic-bonus consumers*, multi-character/slot compatibility and UI approval. **Not deployed** |
| **Physical Specimen, PR #250** | Six Grim Hollow benefits, source/selection/rest scaffolding, staged HP/speed/tactical calculation and encounter-start reconciliation | Poisoned-save Advantage, existing Darkvision +60 vs grant, CHA Athletics/Acrobatics, jumping, climbing, source/turn actions, end-to-end HP/rest/permission/encounter tests and approved controls |
| **Existing numeric sheet/equipment** | Authoritative catalogue+instance merge computes legacy bonuses; sheet formulas belong to existing code | No double count, ability **score replacement** distinct from additive score/mod, proficiency and Expertise, no erroneous shield slot, original Monk/Barbarian unarmored rules; avoid overwriting persistent sheet or active encounter snapshots |
| **Typed combat mitigation** | Existing live item Resistance and flat typed reduction; **Resistance before highest flat reduction**, then vulnerability/temp HP/HP | Cross-source affinity/immunity/condition immunity and lifecycle; do not interpret item prose or replace the specialized damage authority |
| **Movement/vision** | Canonical features/items include Darkvision grants/extensions and effective-Speed-dependent climbing/swimming/flying/burrowing | Event-aware derived movement, legal tactical/path/LOS/check consumers and rest/encounter refresh; no world-map edits |
| **Spells, conditions and per-use effects** | Live `spell_effects` definitions; specialized encounter condition/timed effect and charge/rest primitives | Cast legality, targets, concentration, event/turn expiry, reaction/bonus action, one-shot roll modes, healing, immunity and DC application per supported mechanic—not an automatic 1,037-spell integration |
| **Crafting and consumables** | Smithing/Enchanting/Alchemy have their own build/budget/ingredient authority | Differentiate craft-time material tags/bonuses from **final** item/consumable runtime effects, doses, duration, grants, failure and inventory provenance |
| **Future AI tool** | `DNDNEXT_AI_INTEGRATION_FOUNDATION.md` defines provider-neutral, future read-only context/legality architecture | After real authoritative effects parity: permission-filtered explanations/context and server-supplied legal actions only; AI cannot mint bonuses, bypass eligibility, query raw DB, or directly mutate combat |

### Concrete regressions already exposed (do not silently "fix" through a new resolver)

1. **An equipped Shield in an invalid `back` slot receives Shield AC in the legacy equipment SQL.** PR #255 pins that legacy observation; it is *not* approval of the rule. Enforcing allowed slots must also review equipment mutation, character sheet, tactical AC, and regression expectations.
2. A magic item with `ability.static.con=20` does **not** get that stat replacement projected through the legacy numeric resolver. `modifySpeed.equal.fly="walk"`, `bonusSpellSaveDc` and `bonusProficiencyBonus` also lack matching legacy numeric projections in the sampled test. Do not claim that unrecognized keys have gameplay support.
3. The numeric equipment resolver uses **catalogue || instance** (inventory same-name key overrides). Equipped damage mitigation examines catalogue and instance payloads independently; resistance/DR does **not** necessarily follow the same override rules.
4. The old numeric resolver treats `is_equipped` as sufficient for some **magic** bonuses; the attunement work is not yet connected to the consumer. Correct bond tracking must not suppress mundane armor/shield/weapon behavior nor accidentally activate unbonded magic properties.
5. The shared function's `stackKey` largest-magnitude behavior is a technical mechanism, **not** a universal 5e stacking rule. Source-specific nonstacking, repeated-item interactions and identical spells require validated keys and precedence.


### New verified staged eligibility bridge — PR #260 (still NOT active)

Draft [PR #260](https://github.com/bob8675309/DNDNEXT/pull/260) is **based on draft #257**, not on main or #251. Recorded head `d3f8825d9ca2df308abcf902d8cf3c4ef7a01a9e` passed exact-head source-contracts, isolated PostgreSQL and validation tests. It adds a private, `SECURITY INVOKER`, **service-role-only, read-only** `private.passive_equipment_source_gate_v1(character_id,item_id)` source projection. It checks actual character ownership, ambiguity when two editable characters share a player-owned item, structured source identity, conservative item-slot compatibility, and recorded character-item bonds.

**Crucially, it returns `eligibleForPassiveMagic=false` in every case.** Source-specific Short Rest, class/item prerequisites and actual gameplay consumers remain unwired. It independently identifies an eligible **mundane armor/shield AC candidate** and does not rewrite existing AC calculations. The existing `set_character_inventory_equipment_v1` validates a legal **slot name**, not item-category compatibility; valid-slotted gear authority still needs targeted repair.

Read-only live source sampling identified a critical ingestion gap: `Ring of Protection|XDMG`, `Cloak of Protection|XDMG`, `Boots of Speed|XDMG` and `Ring of Fire Resistance|XDMG` lack structured `reqAttune`, `reqAttuneTags` and `attunement`; `Staff of Power|XDMG` has structured class-specific `reqAttuneTags`. Absence of metadata is **unknown**, not proof attunement is unnecessary. This blocks approval of #257/#260 as an effect activation system until source facts are verified and normalized. Refer to [PR #260 status ledger](https://github.com/bob8675309/DNDNEXT/blob/agent/passive-equipment-eligibility-readonly-20261024/docs/Passive_Equipment_Effect_Eligibility_Gate_2026-10-24.md).

### 2026-10-24 source-edition correction — verified PR #261

**Draft [PR #261](https://github.com/bob8675309/DNDNEXT/pull/261)** is stacked **#257 → #260 → #261**, separate from the common resolver test chain **#251 → #253 → #255**. Its exact head `6577ef5de9ffa73dcce78b00565a0f54a530808f` passed **isolated PostgreSQL, source-contracts and validation**.

- It adds four small **source-cited 2024 requirements for exact XDMG item keys**: Ring of Protection, Cloak of Protection, Boots of Speed, and Staff of Power (Sorcerer/Warlock/Wizard only). It corrects previously missing structured attunement facts **inside a private service-only source read model**. It has **not** changed `items_catalog`, production SQL or any current magic-item consumer.
- **Edition-specific exception:** the official **2024 Ring of Resistance does *not* require attunement**, whereas the **2014 Ring of Fire Resistance** did. DNDNext's typed XDMG campaign resistance variants also have custom mitigation rules and **remain unclassified pending an explicit edition/campaign mapping**. A missing imported flag is not sufficient evidence in either direction. Official 2024 rules: [Magic Items A–Z](https://www.dndbeyond.com/sources/dnd/br-2024/magic-items-a-z).
- The read-only projection distinguishes verified required, unknown and explicit source conflicts, and **always returns `eligibleForPassiveMagic=false`**, regardless of bond state. Its private registry is not the player-facing attunement write RPC: Short Rest, eligibility, class prerequisites, transfer/end lifecycle and *actual* effect consumers are still incomplete. See [draft PR #261's gate ledger](https://github.com/bob8675309/DNDNEXT/blob/agent/verified-attunement-source-rules-20261024/docs/Verified_Attunement_Source_Rules_Gate_2026-10-24.md).
- **Remaining dependency:** normalize these verified source facts into the guarded attunement **bond creation/rest workflow** and eventual #251 effects adapter without weakening the fail-closed gate. Test source conflict, 2014/2024 aliases, genuine characters/encounters and preexisting Resistance-before-flat-DR behavior before any production merge.


### Tested focused-rest and canonical-class evidence — draft PR #262

**Draft [PR #262](https://github.com/bob8675309/DNDNEXT/pull/262)** is stacked on #261 → #260 → #257. Exact head `50f7cbd6a7d92061eedb4e0d3269edc766fe31fd` passed isolated PostgreSQL, source-contract and validation checks.

- A service-only read model uses `character_progression.class_id` → `class_catalog` to check the exact class prerequisites from verified #261 item keys (e.g. Staff of Power). It rejects Fighter, recognizes Wizard, and treats Boots of Speed as having no class prerequisite.
- The current authoritative `complete_character_rest_v1` only records a generic rest/resource log. **It does not attest focused item contact, exclusive attention, a distinct identification rest, interruption or a full attunement hour.** Read-only live inspection found 7 historical rest rows, none bearing focus evidence. **No existing Short Rest automatically creates a magic-item bond.**
- A separate private parser can classify an explicitly server-authored `details.attunementFocus` future receipt with one item, 60+ uninterrupted minutes, contact and separate identification. Fixtures reject false/incomplete/foreign/second-item/Long-Rest/short-duration/interrupted cases. The future rest writer has **not** been implemented, so no production rest currently satisfies that protocol.
- The helper always reports `attunementReady=false`. It never writes an attunement bond, changes a combat sheet, validates the Artificer 4/5/6 exception, or grants magical bonuses. Keep all affected drafts unmerged/undeployed. [#262 detailed gate](https://github.com/bob8675309/DNDNEXT/blob/agent/attunement-rest-and-class-evidence-20261024/docs/Attunement_Rest_Class_Evidence_Gate_2026-10-24.md).

**Next actual integration:** design a trusted rest-focus begin/complete flow and event-time model with owner review; test against canonical Short/Long Rest log triggers/active-encounter guard. Then enforce the verified source+class+one-rest rules in #257's attunement write RPC; connect to #251's effects adapter only after source/consumer parity. No user-authored rest evidence or AI-owned state changes.


### Verified staged world-clock focus sessions — draft PR #263

Draft [PR #263](https://github.com/bob8675309/DNDNEXT/pull/263) stacks on **#262 → #261 → #260 → #257**, independent of the #251 → #253 → #255 arithmetic/parity chain. Exact head `9f3ec8aa67047b108ce1c881783e6fb747dead69` passed isolated PostgreSQL, source-contract, repository and Vercel comment checks.

DNDNext's `world_state(id=1).world_time` uses an accelerated campaign clock (read-only snapshot `time_scale=4`), whereas `character_rest_log.completed_at` uses server wall time. **They are not interchangeable.** The new service-only private focus-attempt model records an authoritative **world-time** start, enforces one active attempt per character and request-id replay protection, checks exact source/ownership/class and the existing active-encounter resource guard, and can inspect whether **one game-world hour** has passed. It rejects wrong item/owner, conflicts, time regression, item transfer and aborted sessions. It **does not** produce a canonical completed-rest receipt, detect later interruptions, verify physical contact or separate item identification, bind items, or activate magic; `attunementQualified=false` and `canCreateBond=false` are unconditional.

**Unresolved integration:** #262's evidence parser currently compares **real** rest timestamps against one hour; a future guarded rest producer must define/test the clock conversion and validated attunement focus, interruption, identification and Short Rest action together. Do not modify world-map movement or time simulation to solve this. [Full PR #263 gate](https://github.com/bob8675309/DNDNEXT/blob/agent/attunement-world-clock-focus-sessions-20261024/docs/Attunement_World_Clock_Focus_Status_2026-10-24.md).


### Canonical focused Short Rest correlation — staged draft PR #264

[PR #264](https://github.com/bob8675309/DNDNEXT/pull/264) is **draft/unmerged/undeployed**, stacked on **#263 → #262 → #261 → #260 → #257** and separate from the arithmetic chain **#251 → #253 → #255**. Exact tested head: `b731a9644c2c217fb8f95332eb0c107d88c20c6c`. Its isolated PostgreSQL, source-contract, repository and Vercel checks **passed**.

- The canonical `public.complete_character_rest_v1(uuid,text)` logic is preserved exactly with only **additive** `restResult.restLogId`. A source-parity validator compares the copied function to `sql/20260810_90_rest_class_feature_restoration.sql` to prevent accidental restoration changes.
- Private, **service-only** `record_attunement_focused_short_rest_v1(character,attempt)` requires an actual authenticated **admin** principal, ordinary character progression authority, character/item locks, source/owner/class and **game-world hour** eligibility. It calls the canonical rest and atomically stores a **unique exact rest-log ID** on that focus attempt, then labels it `rest_logged_unverified`. Replays return the same ID without another resource restoration.
- Failure at the canonical rest's active-encounter guard rolls back spell-slot and limited-use restoration **and** the focus link. Tests validate canonical slot/use amounts and safe transactional rollback.
- **No attunement bond and no magic effect are authorized by a completed rest link.** Physical item contact, interruptions during the elapsed period, separate identification, curses, transfer-out-and-back, class/cap exceptions and DM attestation remain unresolved. The world-clock link does **not** satisfy #262's older **real-timestamp** `attunementFocus` parser. Do not infer one game hour from `character_rest_log.completed_at`.
- The canonical rest RPC is a current production authority and its new return field would be a **real API contract change** if merged. This change still requires owner review, production-shaped schema/role compatibility, actual signed-in admin/player browser tests and an active tactical encounter check before merging/deploying.

[PR #264 source/risks ledger](https://github.com/bob8675309/DNDNEXT/blob/agent/canonical-attunement-rest-log-bridge-20261024/docs/Attunement_Canonical_Rest_Bridge_Gate_2026-10-24.md).


### Manual GM attestation and custody continuity — draft PR #265

Draft [PR #265](https://github.com/bob8675309/DNDNEXT/pull/265) stacks on **#264 → #263 → #262 → #261 → #260 → #257**, separate from the effects math chain **#251 → #253 → #255**. Tested head `df8b311153b707ad2ee2f6a3a1d27282b9922597` passed isolated PostgreSQL, source-contract, repo and Vercel checks. **Unmerged and undeployed.**

- A private service-only, **authenticated-admin** review ledger binds a DM decision to the **exact canonical Short Rest** already recorded in #264. Positive and negative outcomes record a responsible reviewer, contact continuity and identification-separate confirmations, an accountable reason, and review time in the campaign world clock. A player or service key without an actual admin principal cannot approve. Recorded decisions are immutable and replay-idempotent.
- This is **human DM adjudication**, not automated proof of continuity or absence of interruption. The live event tables do **not** establish continuous physical item contact throughout the world-time hour. The 2024 rules specify interruptions including Initiative, taking damage and non-cantrip spellcasting; the DM must assess events the server cannot fully establish. [2024 Short Rest](https://www.dndbeyond.com/sources/dnd/br-2024/rules-glossary/), [2024 Attunement](https://www.dndbeyond.com/sources/dnd/br-2024/equipment).
- A targeted transfer trigger now marks active/rest-logged focus **invalidated on any ownership transfer**, including transfer-away-then-back: a matching start/end owner cannot revive historical focus. Tests cover player/service refusal, admin approvals and denials, active-encounter block, contradictory-review rejection, source/rest ID, irreversible custody invalidation and no extra rest or bond.
- **Hard stop remains:** `attunementReady=false`, `canCreateBond=false`, and no magic effects, even after an admin approves. A review must **not** silently activate the original #257 boolean-only attunement writer. That writer requires replacement/guarding, Artificer capacity/source/curse/lifecycle proof, signed-in UI and combat consumer parity before deployment.

[PR #265 detailed gate](https://github.com/bob8675309/DNDNEXT/blob/agent/attunement-gm-adjudication-and-transfer-20261024/docs/Attunement_GM_Review_Transfer_Gate_2026-10-24.md).

## Next recommended work, in dependency order

1. **Read-only owner/state map:** inventory ownership across Player/NPC/merchant; canonical equipment slot/attunement/rest authorities and the active-consumer routes. Confirm live schema, source-edition precedence and class/feature eligibility. Review #257 separately before any merge.
2. **Bounded eligibility contract + parity tests:** equip vs attuned vs carried; Short Rest receipt and status, three/unlimited and class-specific cap; migration/backfill policy, source per-item prerequisites, cancellation and transfer; rejected/unequipped/duplicate/foreign/old items. Isolate in Postgres first.
3. **Prove one end-to-end eligible effect** against a real consumer at a time: representative saving-throw modifier first, then guarded spell attack/DC or ability replacement after source-based eligibility and derived-math parity. Include hit/damage, class- and target-specific spell bonuses, skill/save and affected event context. No bulk runtime replacement.
4. **Complete Physical Specimen six-benefit parity** through the common source-aware interface where valid, preserving #250's action/HP and rest owner. Also test Wild Heart, Bestial Soul, Boon Resistance, Astral Trance and temporary/permanent Expertise distinctions as **different source lifecycles**, not copy-pasted feature handlers.
5. **Combat regression gate:** immunity, Resistance-before-DR, vulnerability, shields/unarmored AC, max/current/temp HP, weapon profile, condition application, reaction/bonus actions, concentration, turn-start/end, duplicate request IDs and authoritative logs.
6. **User-visible acceptance and rollout:** source-matched active/inactive/provenance explanations, existing sheet/Forge/NPC visual contracts, actual-component UI mock-up approval before re-layout, signed-in player/admin and active-encounter smoke, exact-head CI and security review. Do not merge/apply live SQL automatically.

## Technical / security boundaries

- Canonical: `public.characters`, `character_sheets.sheet` **base**, `items_catalog`, `inventory_items`, class/species/feat/spell sources, `character_runtime_feature_choices`, rest logs, spell state, encounter participants/commands/conditions. Preserve each system's owner; all protected reads and mutations require proper actor/controller context.
- The **draft** `private.resolve_effect_bundle_v1(jsonb,jsonb,jsonb)` is not public browser or model API; its `source/id/stackKey/when` input is **not** a substitute for entitlement, usage or eligibility checks. Private arithmetic may be reused behind a *trusted server adapter* once proved.
- No unsolicited SQL migrations, attunement backfill, encounter snapshot rewrite, character-sheet or Forge UI changes. **No map changes:** `components/MapPageClient.js`, world-route/time/weather/camps and separate town/city map behavior remain protected.
- Use [CHATGPT_REPO_WRITE_PROCEDURE.md](CHATGPT_REPO_WRITE_PROCEDURE.md); branch from newly fetched main, compare exact files, no force-push, run relevant checks and obtain owner approval for any runtime merge/deployment.
