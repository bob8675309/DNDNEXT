# DNDNext Spell Engine — Pre-pivot Architecture Audit
_Date: 2026-10-31. Status: scoped read-only evidence and provisional recommendations; **not** a migration, approved implementation, or release._

## Audit method and verification limits

Inspected current working-tree and source-control Docs on the research branch `work/eldritch-blast-los-regression-20261030`, including:
- docs/README.md; Documentation_Refresh_Manifest.md; Current_Development_Status_and_Roadmap.md; DNDNext_Current_Handoff_Prompt.md; Consolidated_Development_Archive_2026-10-30.md and Archived_Branch_Cleanup_Safety_2026-10-30.md.
- DNDNEXT_AI_INTEGRATION_FOUNDATION.md; DNDNext_Effects_AI_Current_Handoff_2026-10-24.md; Composable_Spell_Engine_AI_Readiness_2026-10-31.md; Character_Effects_Cross_Conversation_Requirements_Audit_2026-10-24.md; Tactical_Spell_Mechanics_Review_2026-10-31.md.
- Tactical_Encounter_Combat_Roadmap_Blueprint.md; tactical Phase 1G/1H/1I/1J and Phase 1K–1Z spell ledgers; Tactical_Character_Resource_Bridge_Status.md; Release_Candidate_Encounter_Workspace_Rest_2026-10-28.md.
- Spell_Magic_System_Foundation.md; Player_Forge_Starting_Magic_v3_Status.md; Player_Forge_Choice_Routing_and_Source_Magic_Status.md; Character_Progression_and_Higher_Level_Forge.md; Unified_Character_Forge_Status.md; Wizard_Memorize_Spell_Runtime_Status.md; Wizard_Spell_Mastery_Runtime_Status.md; Pending_Rest_Runtime_Choices_Status.md.
- Crafting_Equipment_CharacterSheet_Tactical_Pipeline.md; Item_Character_Effects_Coverage_Audit_2026-10-24.md; Tactical_Encounter_Equipped_Damage_Mitigation_Status.md; Realistic_Dice_Roller_Architecture_Roadmap.md; Security_Hardening_Roadmap_Status.md; Rest_Activity_Popup_Status_2026-10-25.md.
- Historical research branch `dda0f432d963a5b6a87b65e5f6f4bbd27a860602`: `sql/20261023_08_common_effect_resolver_v1.sql`, its behavioral fixtures, and `docs/Common_Character_Effects_Engine_Design_2026-10-23.md`; historical `docs/Character_Effects_Release_Readiness_Gates_2026-10-24.md` at `38e4441052c7b4e41058ca646464017fb01bb139` and archived `Player_Rest_Activities_Optional_Attunement_2026-10-25.md`.

This is a **scoped architecture audit** of relevant handoffs and mechanical ledgers, **not** a claim that every art, merchant, sprite or historical Doc has been read line by line, that all imported D&D text is verified, or that every legacy RPC has been fully behavior-tested. Inspect the exact production function definitions and relevant migrations before changing an authority. Historical documentation statuses can be stale.

### Live read-only evidence (2026-10-31)
- `public.spells_catalog` has **1,037** spell rows.
- `public.spell_effects` has **1,037** rows; **zero** have `effect_index <> 0`. These are broad catalogue effect definitions, **not executable sequences**.
- No live `private.resolve_effect_bundle_v1` and no experimental `public.encounter_cast_eldritch_blast_candidate_v1` are installed.
- Live public schema currently has **22** functions with names matching `encounter_cast_%`. This is a naming count, not a full list of supported spells.
- Current default branch `main` was `75c387e9276739f04b56d7fa96e4041931b3d9f4` when inspected; research PR #309 is draft, unmerged and based on `work/consolidated-encounter-research-20261030`.
- Old PRs #251/#253/#255 (common effects) and #257 (superseded attunement) are **closed/unmerged** as of this check. PRs #267/#268 (simpler optional attunement), #266 (rest popup), #300 (workspace) were also closed as original drafts; #301 (workspace/rest release candidate) was **merged into main**. Preserve old research via the consolidated archive's multi-parent ancestry; this does **not** mean those files are present or executable in the active worktree.

## Technical finding: a new all-encompassing effect engine would be the wrong next step

The proposed spell recipe interpreter is **distinct** from the historical pure character-effects calculator:
- `private.resolve_effect_bundle_v1` from closed PR #251 was **pure, private, immutable arithmetic** over bounded source effects, covering numeric add/minimum/multiply and roll-mode selection. It did not own acquisition, permissions, resource use, concentration, timing, combat or persistence. Its `stackKey` largest-magnitude mechanism is **not** universal D&D stacking semantics. Its later source-parity research #253/#255 is archived, not live.
- The **existing tactical generic effect envelope** `encounter_resolve_effect_internal_v1` from Phase 1H already combines a server-authorized save, typed damage, healing and/or condition. It is a reusable *execution primitive*, not a complete versioned spell grammar. Its existing state models `encounter_conditions` and `encounter_timed_effects` must stay authoritative until individually replaced with proven parity.
- Existing live `encounter_apply_damage_internal_v1`, `private.encounter_equipped_damage_mitigation_v1`, attack/save/LOS/area helpers, character spell-slot bridge, and guarded cast RPC families must be reused or wrapped, not independently recomputed.

**Recommendation:** use bounded, source-qualified **spell recipes** to orchestrate existing, tested **tactical operations**. A separate, optional pure numeric character-effects calculator may supply resolved modifiers after source eligibility validation. The two layers must not both claim ownership of damage ordering, source grants, duration, or resource spending.

## Evidence-backed requirements before accepting a spell interpreter

| Boundary | Existing working/deferred behavior | Required gate |
| --- | --- | --- |
| **Source/edition/character entitlement** | XPHB and PHB versions differ (for example Inflict Wounds). `character_spells` stores origin, known/prepared/always-available, source labels, grants and casting stat. Forge v3, feat/species/background magic, Wizard spellbook, Spell Mastery and Memorize Spell have separate grants. | Exact `spell_id` and `spell_key|source`, source-aware known/prepared/ownership, source-specific at-will/limited use and upcast policy; no mere string match. |
| **Scaling and resources** | Cantrips depend on **total character level** in 2024 rules; leveled spell dice may depend on slot level; single-slot-per-turn authority exists; encounter-slot decrements mirror the persistent character ledger in one transaction; rest is disabled during active combat. | Distinguish class, total character and slot scaling. Preserve Pact Magic and mixed/multiclass/multiple-source pools; never duplicate slot tracking or refill during profile reads. |
| **Geometry and target origin** | Server owns axial LOS, cover, range, creature/object validation, point-origin sphere, chosen-target emanation, directional cone/line, occupancy; multi-hex footprint and more complex terrain remain future work. | Reuse authoritative hex sets. Specify source-versus-impact-origin cover, cover on Dex saves, area propagation, friendly selection, repeated target allowed/forbidden, target count, hidden results, and no client targeting authority. |
| **Resolution and RNG** | Attack can be normal, Advantage/Disadvantage or critical. AoE rolls once for simultaneous damage with independent saves; Eldritch Blast/Scorching Ray roll independent attacks; Magic Missile allocates separate darts; effects such as Guiding Bolt and Vicious Mockery modify/consume next attack. | Recipe must explicitly state **roll scopes**, attack/save/auto-hit, branch order and critical/half/negate stage. Server RNG stays authoritative; 3D dice visualization is presentation only. |
| **Conditions and timing** | Phase 1O–1U introduced target-turn-start, source-turn-start, source-turn-end, target-turn-end and one-shot effect consumption. Reaction windows can suspend movement; conditions don't all have implemented mechanical consequences. | Versioned encounter events, source/target/provenance, expiry rules, interruption/continuations, condition immunity and concentration/lifecycle. No assumption that every effect finishes in one transaction. |
| **Atomicity/concurrency** | Action vs Bonus Action vs Reaction; one slotted spell per turn; target locks; combat command request UUIDs; idempotent replay; Realtime state refresh. Some archived atomic Attack research still had failing fixtures and is not merged. | Lock/validate before spending resources, deterministic multi-target locking, idempotency across retries, stable command ledger/version/log, no partial rolls/state, stale action options revalidated. |
| **Visibility/security** | Hidden participant masking is essential in area results/logs; source/DM/player permissions differ. Public spell catalogue is read-only under RLS. `SECURITY DEFINER` cast RPCs require independent ACL/controller safeguards. | Filter hidden targets/counts and DM-only knowledge *before* model input or player output. Never let any AI author an effect recipe, spoof an authenticated controller, access arbitrary SQL or bypass game RPC authorization. |
| **Equipment and common effects** | Catalogue vs inventory instance override differs between sheet arithmetic and typed damage mitigation; attunement, magical bonuses, charges, crafting ingredients and target-specific roll modes need source adapters. | Reuse actual equipped/attuned/active source authority, highest typed flat DR, Resistance before flat reduction, condition immunity and specific caster-focus eligibility; not generic unconditional modifier addition. |
| **Optional attunement** | Later owner direction **supersedes** older elaborate PR #257: campaign setting OFF by default; optional simple three-item cap (from draft #267/#268), separate from physical equipment slots. | New engine must respect OFF; don't silently enforce superseded bond/custody constraints or turn magic items off. Advanced exceptions are later choices. |
| **AI and humans** | DNDNEXT_AI_INTEGRATION_FOUNDATION.md proposes provider-neutral local inference, initial magic-item drafts then NPC dialogue then Actor AI and tactical legal-action selection. AI tool is not implemented. | A **shared permissioned, versioned `listLegalEncounterActions` read model**, bounded target/point options, and same executor for human and AI. AI chooses from server-approved options; backend revalidates. Narrative stays nonauthoritative until specifically accepted. |
| **UI/operability** | Existing 19 reviewed XPHB tactical adapters, manual/GM-assisted fallback, compatibility RPCs, Combat & Spells, map preview, no live Eldritch Blast casting. | Maintain existing UI and battle board; compose controls from reviewed recipe metadata but never use the client as rules executor. Preserve GM override, accessibility and honest unsupported-state messaging. |
| **Lifecycle and versioning** | Persistent effects/ongoing spells could outlive a source catalogue change or code deployment. Realtime notifications are not authoritative state. | Persist source edition/recipe schema version/recipe identity or hash at cast; bind ongoing states to that version and enable deterministic combat-log replay/explanation without rerolling. |
| **Content/ownership** | Spell source importer preserves `raw_payload`, source editions, descriptions and metadata; source Docs warn to use licensed/allowed content only. | Manually verify reviewed executable recipes and downstream public distribution rights. The imported spell text, `attack_type` and `area_type` are not a trustworthy automatic rules compiler. |

## Architecture recommendation (provisional)

**Do NOT write hundreds of special RPCs. Do NOT implement a universal free-form programming language or try to predefine every possible fantasy effect.** Begin with a small **closed, typed primitive vocabulary**, reviewed spell definitions and the mechanics already proven by existing combat helpers.

1. Design **immutable, allowlisted recipe definitions**, including edition, source, prerequisites, target/geometry type, costs, scaling source, execution nodes, roll scopes, per-node failure/trigger semantics, and stable version identity.
2. Provide a **pure compiler/validator and preview read model** in testable application code, but keep all authoritative writes and RNG in the server/database action transaction. Decide precise language/deployment seams only after profiling and comparing existing PostgreSQL contracts—neither an all-PL/pgSQL JSON interpreter nor a JS-only combat simulator should be assumed.
3. Prototype against six existing mechanics families—single attack (Fire Bolt), single saving throw (Sacred Flame), auto-hit allocations (Magic Missile), chosen-target Emanation (Word of Radiance), directional Cone/Line (Burning Hands/Lightning Bolt), point-origin Sphere (Acid Splash)—**plus** the held Eldritch Blast independent-beam candidate; next use Scorching Ray and Ice Knife as **composability probes**, not production additions.
4. Cover timed effects and reactions using **existing event/lifecycle authority** in a second layer. Model condition gating and concentration explicitly; use manual/GM-assisted fallback whenever complete rules are missing rather than silently partial-automating.
5. Add a server-owned **legal-action discovery/read model**, shared by human UI and future Actor AI. A two-stage selector can handle large geometry/target option spaces. Never put inference inside open game-state transactions.
6. Migrate one tested adapter at a time by comparing the old and new results in disposable PostgreSQL/Auth sessions; retain old public RPC contracts until parity and browser tests pass. Include real character-source payloads and multi-account permission/hidden masking, not only synthetic arithmetic.

### Hard rule: release evidence levels
A catalogue effect record is **not** an executable spell. A validated recipe **is not** proof of source entitlement. A pure-calculation test **is not** proof of tactical behavior. Signed-JWT local fixtures **are not** a full production replica. Green CI **is not** browser acceptance or owner authorization to merge/deploy.

## Owner decisions — resolved 2026-10-31 (do not re-ask)

The campaign owner answered all six. **[SPELL_ENGINE_DECISIONS.md](SPELL_ENGINE_DECISIONS.md) is the permanent, reviewed decision record** and [START_HERE_ACTIVE_HANDOFF.md](START_HERE_ACTIVE_HANDOFF.md) is the current resumption/checkpoint procedure.

1. **Source:** 2024 XPHB first; only consult other source editions for missing information when needed; preserve source-qualified rule versions rather than silently mixing.
2. **Scope:** Implement tactical spells first, designing reusable primitives for features, items and other consumers later; do not expand unrelated systems now.
3. **Unsupported:** If a full spell mechanic is not implemented and validated, it remains GM-assisted. No partial cast presented as complete.
4. **Authoring:** A future Admin visual spell/effect composition builder is approved, after a vetted recipe schema and publication/validation gates exist.
5. **AI:** Future opt-in autonomous NPC/monster actions, GM controls, manual mode and AI-off; **same legal-action and guarded execution path as humans**, never model-authored rules or unrestricted data.
6. **House rules:** Preserve source spell definitions; store explicit versioned campaign-specific overrides separately.

**Important:** This audit's earlier recommendations and open questions have now been resolved as above. It still does not prove the engine has been implemented, nor does it authorize a production migration.

## Safeguards

This document changes no runtime code, databases, Supabase roles, world/town maps or production branch. Never merge draft PR #309 into production, install research SQL, connect paid staging or introduce an AI model dependency without separate explicit user authorization. Preserve free local GitHub Actions regression workflow and existing human control path.
