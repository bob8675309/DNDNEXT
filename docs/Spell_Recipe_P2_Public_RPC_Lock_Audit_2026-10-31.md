# P2 — Public Spell-RPC Delegation, Replay, and Mixed-Lock Audit (Research Only)

_2026-10-31. Evidence: live **read-only** DnDWeb `pg_proc`, `pg_get_functiondef`, execute grants and identity arguments; GitHub production `main` `eb376a4e3a7b0a7201a0ecb8a98366c1bba4e00a`; research draft #312, based on held draft #309. This is a bounded snapshot. **No production functions or grants were changed.**_

## Recovery review before this audit

- Scanned the complete tree under `docs/`: **154 files** at PR #312 head before this audit, of which **143** are readable `.md`, `.txt`, or `.sql` source/handoff documents, and **11** are `.xlsx`/large alchemy `.json` catalogue/codex data assets. Fetched the complete text of all 143 prose/source documents and checked their section hierarchy, dates, active-status/next-task claims and subsystem relevance. The 11 alchemy datasets were **catalogued**, not individually analyzed cell-by-cell or recipe-by-recipe; no such reading is necessary to this tactical spell RPC task. For relevant spell/combat documents, inspected the actual authoritative contracts in depth. This is not a claim that every legacy historical assertion remains live.
- Governing documents: `AGENTS.md`, `docs/START_HERE_ACTIVE_HANDOFF.md`, `docs/SPELL_ENGINE_DECISIONS.md`, `docs/README.md`, `docs/Spell_Engine_PrePivot_Audit_2026-10-31.md`, `docs/Composable_Spell_Engine_AI_Readiness_2026-10-31.md`, `docs/Tactical_Spell_Mechanics_Review_2026-10-31.md`, `docs/Spell_Recipe_P1_Schema_2026-10-31.md`, `docs/Spell_Recipe_P2_Shadow_Parity_2026-10-31.md`, `docs/Spell_Recipe_P2_Transaction_Candidate_2026-10-31.md`. Also read all tactical Phase 1E–1Z status ledgers plus related Forge/progression, resource, equipment, reactions, character effects, AI/permissions and historic roadmap/docs.
- **Reconciled conflicting dated text:** The 2026-10-28 encounter workspace/rest draft was subsequently merged via #301; `docs/README.md` and `docs/DNDNext_Current_Handoff_Prompt.md` retain an older *not merged* paragraph for historical reasons. The 2026-10-24/10-09 Forge/effects/attunement “current priority” texts are superseded by the 2026-10-31 owner-approved **spell-first, XPHB-first, research-only** workstream. The #309/#312 experimental ancestry is **not** a merge into production. Historical `docs/PublicDBFunctions .txt` cannot replace live `pg_proc`.
- **No missed binding decision found:** existing server-owned targeting/geometry, attack/save/damage, conditions/expiry, action/slot bridge and signed-in permissions must remain; unsupported spell riders GM-assisted; future Admin visual editor and Actor AI later and OFF; campaign house rules versioned separately. No Forge, world/town map, rest, equipment, AI, or alchemy implementation was authorized by this continuation.

## Complete current public spell-RPC entry-point inventory

At this read-only snapshot, exactly **22** `public.encounter_cast_%` functions exist, **18** executable by the `authenticated` Postgres role, **none** by `anon`; all four ungranted internal `_pre_1v` variants remain callable by `service_role`. All run `SECURITY DEFINER` in the inspected sample; preserve explicit caller guards. See `scripts/fixtures/spell_cast_rpc_live_snapshot_p2.mjs` for all 22 exact definition MD5 fingerprints, classification and grant flags. See `scripts/audits/spell_cast_rpc_order_readonly.sql` to repeat these SELECT-only checks.

| Function group | Count | Calls/delegation and reviewed behavior | Evidence |
| --- | ---: | --- | --- |
| Public routing/wrapper functions | 8 | `encounter_cast_spell_v1`, `v4`, `v5`, `v6`, `v7`, `v8`, `v9`, `v11`: delegate to historical version/family, some via `private.encounter_enforce_spell_slot_cast_turn_v1` | Auth EXECUTE enabled on all eight |
| Standard direct command processors | 9 | `encounter_cast_spell_v1_pre_1v`, `v2`, `v3`, `v5_pre_1v`, `v6_pre_1v`, `v10`, `v11_pre_1v`, `v12`, `v13` | Four `_pre_1v` versions not directly auth-granted; the other five are public-auth callable |
| Specialized direct command processors | 5 | `encounter_cast_allocated_spell_v1` (Magic Missile), `encounter_cast_area_spell_v1` (Word of Radiance), `encounter_cast_point_area_spell_v1` (Acid Splash), `encounter_cast_directional_area_spell_v1` (Burning Hands), `v2` (Lightning Bolt) | Auth EXECUTE enabled for all five |
| **Total** | **22** | **14** command processors, **8** wrappers | **18 authenticated**, **4 internal-only**, **0 anon** |

**Confirmed ordering, all 14 direct processors:** The first `INSERT INTO public.encounter_command_requests` precedes the first `FOR UPDATE` row lock. Each reviewed processor returns `coalesce(v_existing.result, {'duplicate':true,'pending':true})` when the request ID is already used by a matching caster, **before** its `encounter_can_control_participant_v1` authorization check. Different spells have other early source/assignment checks, but that does not substitute for authorization or request-intent binding. The live result is a cross-family **authorization-order risk**, not evidence that every route can be exploited through real Auth.

### Delegation graph (confirmed from current definitions)

- `v1 → v1_pre_1v`, `v11 → v11_pre_1v`, `v5 → v5_pre_1v`, `v6 → v6_pre_1v` (their wrappers also call the slot-per-turn helper).
- The earlier single-target compatibility chain is **conditional**: `v13 → v12 → v11` for keys not handled at a higher version; `v11_pre_1v → v10 → v9 → v8 → v7 → v6 → v5 → v4 → v3 → v2 → v1` on relevant unhandled keys. `v4/v7/v8/v9` can redirect the spell they specifically recognize back to `v11` (e.g. Poison Spray, Shocking Grasp, Ray of Frost, Chill Touch). These are spell-key conditionals, **not unconditional traversal or endless recursion**.
- The directional `v2` resolver delegates non-Lightning Bolt input to `directional_area_v1`. Other specialist families are direct, not children of the single-target v13 chain. A change only to `v11` **cannot** cover these independent public endpoints.
- All 22 names above are real current PostgreSQL functions. Their MD5s represent the **definition at time of inspection**, not a signature, approval or automatic live tracking. Re-run the read-only audit after any deployment.

## Request intent must be family-specific

| Shape | Existing input | Cached-result fields inspected | Required revalidation before replay |
| --- | --- | --- | --- |
| Single target (versions 1–13) | caster, assignment, target, slot (or zero), request | `casterId`, `targetId`, `assignmentId`, `spellId`, `slotLevel`, `requestId` in the reviewed v11 result | User still controls caster and may see the target; exact actor/assignment/spell/target/slot and original `requested_by` |
| Selected area (Word of Radiance) | chosen target UUID array | `targets` and `selectedTargetCount`, but do not assume they encode the original complete chosen set in all visibility cases | Canonical ordered chosen UUID set and hidden-target filtering; compare source intent, **not only visible results/count** |
| Allocated darts (Magic Missile) | `p_allocations` JSON, slot | `allocations`, `dartCount`, `targets`, `slotPool` | Preserve allocation to each target, canonical allocation semantics, per-projectile dice and slot pool; no free edit to prior allocation |
| Point area (Acid Splash) | origin hex (q,r) | `originHex`, `originTargeting`, server-derived targets | Exact original selected hex, not merely derived damage/visible membership |
| Directional cone/line (Burning Hands/Lightning Bolt) | facing 0–5, slot | `direction`, `originHex`, `coneHexes` or `lineHexes`, slot | Exact direction/slot/caster-origin inputs; recheck LOS, cover and caller visibility; avoid inferring full actor knowledge from result |

**Important missing data contract:** The existing `encounter_command_requests` row has no reviewed canonical request-intent column, and completed result JSON may not fully reconstruct a chosen target array or all hidden impacts. Returning a previous result solely from matching request ID + caster is insufficient. A future migration might need a **validated, versioned intent fingerprint stored at initial request insertion**, but no schema change is authorized at this point. Historical pending rows and old clients require an explicit compatibility/expiry policy; fail closed rather than invent an inferred intent.

## Mixed-lock graphs and release blockers

**Historical direct processor:** `L → C → E → T`, where L is unique request-ledger insertion, C caster row, E encounter row, T selected target row(s). For leveled spells the **pre-wrapper slot guard** may additionally lock E **before** the historical processor's L.

**Research transaction candidate:** `C → [slot-turn guard E] → assignment read lock → E → T → L`. It changes the order deliberately so authorization and visibility can occur under locks before cached-result handling. The wrapper's existing slot guard is **not automatically inherited** when the private candidate is called directly.

This creates two classes of possible wait cycles during a mixed cutover:

- **Same request:** historical caller holds L and waits for C, candidate holds C and waits for L (unique-index conflict). That is a concrete lock-order inversion that can deadlock depending on scheduling.
- **Slotted spell:** a legacy wrapper's turn-slot guard can lock E then wait for C, while the candidate holds C then attempts its own E lock. This inversion must be eliminated across all live entry points before deployment.

**Corrective checkpoint during this audit:** The original private transaction candidate initially omitted the wrapper's 2024 **one-slotted-spell-per-turn** guard. The source audit caught this; `sql/candidates/20261031_fire_bolt_transaction_integrated_candidate.sql` now invokes `private.encounter_enforce_spell_slot_cast_turn_v1` **after acquiring C**, and the disposable PG16 fixture mirrors the live helper's predicate. A regression test attempts a second slotted Guiding Bolt on the same round/turn after manually restoring Action availability and must reject it. This change has **not** been deployed or real-Auth verified. A green *older* CI SHA does not prove the new guard until a new exact-head check passes.

### Safe cutover design — proposal, not approval

1. **Freeze full call surface:** versioned read-only SQL inventory, all public grants, public spell dispatch, request intent by family, ledger owner and visibility, spell-source and slot rules. Extend to other **non-spell** encounter commands that share `encounter_command_requests`; this 22-RPC audit does *not* cover those transaction owners yet.
2. **Unify authorization and lock discipline across every public writer**, not only v11. Assess whether a shared private command guard can safely run *inside* each processor, and how to preserve one lock order across caster, encounter, affected target set (sorted IDs), slot pool, and request ledger. Do not introduce an optional parallel old/new route.
3. **Atomic rollout only after owner approval and real Auth validation:** reviewed schema and per-family changes, reversible migration with explicit lock/traffic/drain strategy, exact-head tests, function grants, no compatibility bypass. Reverting functions alone may be unsafe if the new ledger representation or pending results are not backward compatible; design rollback against both code and stored request format.
4. **Staging acceptance:** nonproduction isolated GoTrue/Auth + PostgREST, two genuine signed-in ordinary users, hidden and revoked actors, same-ID changed intent, multi-target and effect visibility, one-slot-per-turn, resource mirror, competing and duplicate commands, full database snapshots/rollbacks and client acceptance. The connected Supabase list only exposed **DnDWeb production** at review; no paid staging, live test users or database changes are authorized.
5. **No premature spell-engine promotion:** P2 remains a compiler/shadow parity milestone. P3 hybrid spells and P4 authoritative executor still require separate design and acceptance; AI remains disabled.

## Current single next task

**Expand the lock graph beyond cast RPCs to every other authoritative encounter command writing `encounter_command_requests` or locking active caster/encounter rows.** Verify whether a central shared lock-order strategy can cover movement/weapon attack/turn/resource commands without regressions. Prepare real Auth acceptance design only for a truly isolated environment. Do not modify live SQL/roles/data, merge, run production casts or deploy a parallel engine without explicit owner approval.
