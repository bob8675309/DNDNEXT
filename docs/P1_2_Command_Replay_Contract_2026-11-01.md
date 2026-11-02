# P1.2 — Canonical Tactical Command Intent, Authorization and Replay Contract

> **PROPOSED; OWNER REVIEW REQUIRED.** Prepared 2026-11-01 from `main` `7727d75a92abb5904fdb7fd4e109accfe8e4603f` and live **SELECT-only** DnDWeb metadata. This document does **not** describe an installed fix, passing signed-in behavior, or permission to change production SQL. Read the [P1.1 live census](P1_1_Tactical_Command_Authority_Live_Audit_2026-11-01.md) and [owner spell-engine decisions](SPELL_ENGINE_DECISIONS.md) first. Held [PR #312](https://github.com/bob8675309/DNDNEXT/pull/312) remains research-only.

## A. Non-negotiable rules and current evidence

**Existing owner requirements:** 2024 XPHB-first source-qualified spell identity; server-owned targeting, rolls, HP, action/bonus/reaction economy, conditions, resource authority; GM-assisted unsupported mechanics. A GM can grant multiple players combat control of the *same NPC*, separately per player/NPC; combat control **does not confer editing, inventory, secret knowledge or Admin**, and must not create additional actions. World/town maps are separate and out of scope. Optional AI remains off.

**Current production observations (not contract behavior):** 22 public spell-cast names, with 14 direct command-ledger processors and eight routing wrappers. Eight additional non-spell ledger writers; 22 direct public inserters total, 18 authenticated-executable, and none of the 22 examines `v_existing.requested_by` on cached replay. Admin effect and saving throw have earlier permission checks; resolved reaction windows can return before a permission check. Legacy client routes differ. The ledger has `request_id UUID` globally primary, `command_type`, `encounter_id`, `participant_id`, nullable `requested_by`, and result JSON; no persisted immutable original request intent. **SELECT-only counts at this checkpoint: 78 rows, 20 with `requested_by IS NULL`, zero `result IS NULL`.** Null requester origin is unknown; do not backfill a fabricated owner.

**P1.2 goal:** specify typed immutable request ownership, safe cached-result access, and behavior for old/pending/revoked requests **before** choosing a coordinated SQL migration. No core-action-only hotfix.

## B. Server-canonical immutable request envelope (proposal)

```json
{
  "schemaVersion": "combat-request/v1",
  "requestId": "globally unique UUID",
  "encounterId": "server-validated encounter UUID",
  "actorParticipantId": "server-validated actor UUID",
  "commandFamily": "versioned enumerated family",
  "commandVersion": "approved semantic handler version",
  "principalKind": "authenticated_user",
  "requestedBy": "server-derived auth.uid()",
  "canonicalIntent": {"typed": "family-specific operands"},
  "canonicalFingerprint": "hash of complete versioned envelope"
}
```

The example contains descriptive placeholders, **not valid values**. A client may submit a request UUID and typed operands but cannot establish its own principal, actor authority or encounter identity. On first acceptance, bind the server-derived identity, canonical original inputs and version in one atomic transaction. The fingerprint must cover **requester, actor, encounter, family, rule version and exact typed operands**; persist normalized inputs so the hash is not the only audit evidence. No cross-actor, cross-user, cross-encounter or cross-family reuse of an existing UUID. Service-role events need an explicitly identified, audited service principal, **not** permission to impersonate cached human requests.

**Canonical normalization:** validate UUIDs, bounded integers, enumerations, source-qualified spell key and assigned canonical spell source. Reject extra unknown operands, duplicate selected targets, duplicate Magic Missile allocation targets and invalid values rather than silently fixing them. JSON property order is not material. **Movement hex order is material**; selected-area target UUIDs may be sorted after duplicate rejection; allocated darts are keyed by unique target and preserve counts. Store *input* origin/direction/targets, not only derived LOS, damage or visible log text.

## C. Every command shape, including legacy aliases

| Family | Installed command path(s) | Required immutable typed operands beyond actor/encounter/principal |
| --- | --- | --- |
| `core_action` | `encounter_use_core_action_v1` | `action = dash / disengage / dodge` |
| `move` | `encounter_move_active_participant_v1` | Ordered `path:[{q,r}]`; strict integer axial coordinates |
| `end_turn` | `encounter_end_turn_v1` | Empty operand map; original actor and encounter still mandatory |
| `weapon_attack` | `encounter_weapon_attack_v1` | Target participant UUID; equipped inventory **instance** UUID |
| `unarmed_strike` | `encounter_unarmed_strike_v1` | Target participant UUID |
| `reaction` | `encounter_resolve_opportunity_reaction_v1` | Window UUID; `choice=attack/pass`; weapon instance UUID or null; validate linked reactor/mover |
| `save` | `encounter_roll_save_v1` | Ability enum, integer DC, optional source participant UUID |
| `admin_effect` | `admin_apply_encounter_effect_v1` | Source and target UUIDs; **strict versioned effect JSON**, Admin authority |
| `spell_single` | `encounter_cast_spell_v1..v13`, including eight wrappers and four `*_pre_1v` variants | Assignment UUID; accepted source-qualified spell; target UUID; slot level; semantic handler version |
| `spell_selected_area` | `encounter_cast_area_spell_v1` | Assignment/source; unique selected target UUID set; slot level |
| `spell_allocated` | `encounter_cast_allocated_spell_v1` | Assignment/source; unique `{targetId,darts}` Magic Missile allocations; slot level |
| `spell_point` | `encounter_cast_point_area_spell_v1` | Assignment/source; original origin `q,r`; slot level |
| `spell_directional` | `encounter_cast_directional_area_spell_v1/v2` | Assignment/source; original integer direction **0–5**; slot level |

`spell_cast` as a ledger `command_type` is **insufficient**: one request might represent a different target, area hex, line direction or dart allocation. Every public spell wrapper must enter the **same** guarded identity and replay protocol; an older v1–v12 function cannot remain an unguarded alternate route. Existing Admin encounter setup/staging/turn-marker writers and character rest/slot/use/level-up/progression writers **lack this shared command ledger**; P1.3 must inventory all their lock/trigger conflicts, and P1.8 decides whether to wrap them or preserve other robust transactional controls.

## D. Current authorization versus original ownership

1. **First execution:** verify authenticated identity, current actor controller/GM authority, encounter and turn/window status, target legality, server spell assignment/source, action budget and resources *inside* the agreed atomic transaction. Client `canControl` is display state only.
2. **Every replay:** before reading/disclosing any cached result or resolved-window payload, check the caller's current permission for that actor, encounter and result visibility. Also require the *same original human requester* and identical canonical envelope. Replayed results are **not** transferable between two users authorized for one companion.
3. **Revocation:** if control was revoked, do not return the cached private result even if the original caller once had permission. This is **proposed**, to be ratified under decision R2.
4. **Already completed:** a legitimate same-owner, same-intent retry after the turn/round advanced should return the stored result if current authority/visibility still permits it. Do **not** re-require unused action economy for a historical duplicate and do **not** reroll, move, spend slots or write a second log.
5. **Privacy:** raw result JSON may contain hidden enemy info, NPC spell profiles, GM-only effects or allocation targets. A current controller may still lack permission to see all original fields. Provide a server-owned visibility projection or deny the cached replay where safe projection has not been proven. A SECURITY DEFINER RPC cannot rely on table RLS to sanitize its result.
6. **Permissions concurrency:** live `encounter_can_control_participant_v1` checks the single direct `controller_user_id`, Admin status or `character_permissions.can_edit`; the **new per-player NPC `can_control` permission is held on PR #312 only**. Future authority needs transaction-safe revocation (P1.3) and must preserve existing player ownership while separating NPC combat control from editing.

## E. Replay decision table — proposed external outcomes

| Situation | Proposed response | Side effects |
| --- | --- | --- |
| New request; valid current owner and intent | Execute once; atomically commit identity and result | Exactly one accepted command |
| Same UUID / same user / actor / encounter / family / canonical intent / result complete; currently authorized and visible | `REPLAY_RESULT` with safe projection | **None** |
| Same UUID with different actor, encounter, user, action, target, path, weapon, assignment, slot or other typed operand | `REQUEST_ID_CONFLICT` without prior response details | **None** |
| Original requester no longer controls actor | `REPLAY_ACCESS_DENIED`; no cached payload | **None** |
| Another player legitimately controls same NPC, but reuses first player's UUID | Deny; new controller needs own request ID | **None** |
| Previously resolved reaction window, wrong controller | Deny **before** returning window.result | **None** |
| Result exists but currently hidden/private content cannot be projected safely | Redact via proven projection or deny | **None** |
| Same original authorized retry after turn advanced or encounter resolved | Return past authorized result, **not a new turn action**, subject to current visibility | **None** |
| Committed request row with `result IS NULL` | Bounded wait / retry-later; no false duplicate success; explicit recovery only | **None** |
| Old committed row lacks original requester OR provable typed intent | `LEGACY_REQUEST_UNVERIFIABLE` (R1 proposed) | **None** |
| Prior attempt rolled back and **no ledger row committed** | Only re-execute after fresh current checks and proper serialization | At most one |
| Service/Admin calls | Separate identified privileged event, audited; never silently impersonate prior human request | Policy-specific |

All error strings here are **proposed error codes**, not existing RPC behavior. Unauthorized UUID probing must not leak request presence, target IDs, hidden actors or original identity. Keep detailed diagnostics in an Admin-only audit channel.

## F. Legacy and pending transition policy

Live ledger aggregate has 78 rows and **20 null requesters**. Neither the result JSON nor current permissions can prove original human identity or original inputs. Do not infer null requester means service-role, do not auto-bind those rows to an arbitrary current admin, and do not generate a fake intent fingerprint from only the outcome. Historical records must remain intact for audit, but normal replay of unverifiable ones should fail closed (R1). New commands always require fresh UUIDs and current permissions. Existing legitimate current clients need documented retry/409 messaging; no hidden migration to silent reroll.

A duplicate blocked on an uncommitted insert may wait on a unique index before seeing committed state. A **persisted** null result is a different unresolved state; neither is permission to call the effect a second time. P1.3 and P1.8 must define bounded waits, transaction abort recovery and rollback without duplicate side effects.

## G. Explicit cross-command lock and resource handoff to P1.3

**Not a selected lock algorithm:** candidate ordering should consider encounter → involved participant UUIDs in deterministic order → reaction window/ledger/resource rows, but must be proven across **every existing writer and trigger** before implementation. Observed incompatible legacy orders include ledger→actor→encounter, reaction window→reactor→mover→encounter→ledger, Admin encounter→participants, and slot spend→persistent character pool through triggers. The slotted spell turn guard and timed-effect turn-start trigger can acquire extra row locks. A standalone private core-action or Fire Bolt candidate cannot be promoted ahead of this global compatibility proof.

P1.3 must test permission changes racing with command execution, request collision across two sessions, sorted multi-target locking and rollback/deadlock retries. **P1.5 is deliberately reserved for the separate owner policy about one canonical character participating in multiple active encounters.** Allowing many NPCs controlled by one player, or many players controlling one NPC, does not settle that different situation.

## H. Decision gates and release blockers

- **R1 (proposed yes):** Reject cached retries for historic rows without provable requester and original typed intent, preserving their records for Admin audit.
- **R2 (proposed yes):** A revoked controller cannot retrieve old private results through the command RPC even if they executed them originally.
- **R3 (proposed):** Trusted service calls need explicit service identity and audited scope, never a null-user super-replay exception.
- **R4 (separate P1.5 owner decision):** Allow one canonical character in two simultaneous active encounters with globally serialized resources, or forbid the overlap. No decision is presumed here.

**P1.2 is NOT marked complete until the owner reviews R1–R4 and contract details.** Next action: review this proposal and static matrix, approve or amend the proposed behaviors, then begin a **separate P1.3 global lock-order proof**. Do not change live SQL, public EXECUTE grants, NPC permissions, spell engine or world/town map as part of approval of these documents.
