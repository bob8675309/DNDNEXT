# P1.3 — Hidden first-execution privacy and unarmed opportunity reaction research (2026-11-03)

> **RESEARCH ONLY, NOT A PRODUCTION FIX OR RULES CERTIFICATE.** Two disposable PostgreSQL 17 / GoTrue / PostgREST real-JWT suites succeeded: [privacy run 41690025288](https://github.com/bob8675309/DNDNEXT/actions/runs/41690025288) at `c8984cfc` (cases **82–92**) and [unarmed attack run 41692165016](https://github.com/bob8675309/DNDNEXT/actions/runs/41692165016) at `4cdfd5b54af74fa877ae287c9951a45ccb475de5` (cases **93–105**). All **8/8 checks passed** at the latter source/test head. Existing cases 48–81 also ran successfully in the same Auth workflow. Draft [PR #317](https://github.com/bob8675309/DNDNEXT/pull/317) is unmerged.

## 1. First-execution leaks observed under actual signed-in JWTs

The previous five-family research guard protects original requester and replay, but does not project **fresh** End Turn or Move results for a player who must not know a hidden actor:

- **Case 83 (expected unsafe):** The source-derived, guarded `encounter_end_turn_v1` path returned `nextParticipantId` naming an `is_hidden=true` next participant to a signed-in player whose direct participant RLS query returned no row. This was a **fresh** command, not a cached replay.
- **Case 84 (expected unsafe):** The source-derived guarded `encounter_move_active_participant_v1` path returned `reactorParticipantId`, `reactionWindowId` and reaction metadata naming an `is_hidden=true` reactor that the signed-in player could not read by normal participant RLS.

These are **real-JWT scratch reproduction of disclosure behavior in the prior research model**, not evidence of an exploitation event on live DnDWeb. The original DnDWeb functions are still callable in production and their source shapes warrant production cutover review.

## 2. Alternative server-side response projection — tested, not owner-approved timing policy

[Research-only fixture](../scripts/fixtures/p1_3_hidden_activity_projection_pg17.sql) overlays the previous *scratch wrappers* after the unsafe baseline has been measured. It preserves exact original command execution and original server-side ledger result, but projects a minimal player response when a concealed next actor or reactor is detected.

```json
{"requestId":"<caller-generated-request-uuid>","notice":"Unknown Events"}
```

**No hidden actor ID, team, coordinates, reaction window ID, initiative metadata or action type** is included. This uses the owner's preferred ambiguous `Unknown Events` wording in the [owner decision ledger](TACTICAL_ENCOUNTER_OWNER_DECISIONS.md). The GM retains the authorized full response. The generic label's **moment of delivery can still reveal that something happened**. Whether to show such indicators immediately, delay/group them, or sometimes omit them remains a UX/privacy decision and a separate acceptance gate.

**Verified cases 82–92** in [runner](../scripts/test_p1_3_hidden_activity_local_jwt.mjs):

| Case | Observed behavior |
| --- | --- |
| 82 | Three distinct real GoTrue JWT identities, synthetic hidden participants |
| 83–84 | Fresh End Turn and Move **leak** source-private IDs in prior research guard (expected unsafe baseline) |
| 85 | Optional, scratch-only projection installed without changing source-exact original processors |
| 86–87 | Fresh player End Turn and Move return only `requestId` + `Unknown Events`; authoritative turn/W still changes internally |
| 88 | Exact replay is projected again; changed typed movement path is rejected |
| 89 | GM receives actual next actor, reactor and W details |
| 90 | Unauthorized JWT cannot replay or query the private source command ledger |
| 91 | R2: revoked actor controller cannot replay even an opaque result |
| 92 | Visibility transitions change projection; reconcealed result is again opaque |

**Limit:** Original raw results remain stored privately in the *synthetic* command ledger. This is not a production RLS/result-projection audit. A hidden reactor's very existence may be inferred by timing even when the response is otherwise opaque. Movement's UI pause/resume semantics require separate player testing.

## 3. Source-exact unarmed Opportunity Attack with deterministic dependencies

On 2026-11-03, SELECT-only live DnDWeb source snapshots were obtained for:

| Source-exact internal function | Live definition MD5 | Status |
| --- | --- | --- |
| `public.encounter_opportunity_attack_internal_v1` | `276e5fd1c210b3e6f532b0819b87a62b` | Original source loaded in disposable PG |
| `public.encounter_apply_damage_internal_v1` | `53afa5d760a7b6c1a4cc3f837bc7e067` | Original source loaded |
| `private.encounter_has_timed_effect_v1` | `017c626c4147737161742daedceaa694` | Original source loaded |
| `private.encounter_resolve_attack_roll_v1` | `25af82e66a082a36e8105bad0187b271` | **Not loaded**; deterministic roll test double |
| `public.encounter_weapon_profile_internal_v1` | `6b014bbd7eba8774a5f6837d2bd0b3a6` | **Not loaded**; equipped-weapon path blocked |

The original public reaction resolver was already snapshotted with MD5 `70cbfda404644c1000a6541ce8bf9c30`. [Original internal sources](../scripts/fixtures/p1_3_reaction_attack_damage_live_pg17.sql) and [scratch unarmed fixture](../scripts/fixtures/p1_3_unarmed_reaction_attack_research_pg17.sql) execute the outer reaction, attack, damage and suppression code under the existing encounter-first shared guard using **synthetic** `roll=15`, Strength 16, proficiency 2, empty equipment mitigation, and always-visible 5-ft targeting. The default guarded reaction wrapper **continues to reject Attack**. A separate explicitly named *research-only* RPC permits **unarmed attack with null weapon item** in the disposable test. No production attack surface or grants were changed.

**Verified cases 93–105** in [runner](../scripts/test_p1_3_unarmed_reaction_attack_local_jwt.mjs):

| Case | Observed behavior |
| --- | --- |
| 93–94 | Four real signed-in JWT identities; outsider, selected weapon and normal unproven Attack rejected |
| 95 | One original unarmed attack, roll 15 plus 5 bonus, 4 HP damage and one reaction expenditure |
| 96–97 | Exact same-UUID retry does not attack twice; revoked reactor loses cached-result access |
| 98–99 | Already-spent reaction and hidden target cause full rollback/rejection |
| 100–101 | Two distinct UUIDs race on W: one hit; two identical UUIDs race: one stored result and single HP debit |
| 102 | Concurrent Pass versus Attack produces one W resolution, one log and corresponding 0/4 HP effect |
| 103–104 | Source original damage processor honors synthetic bludgeoning resistance (4→2) and immunity (4→0), still spending attack reaction |
| 105 | Anonymous attack and authenticated direct internal processors denied under scratch grants |

**Fixture correction during development:** [initial run 41691062221](https://github.com/bob8675309/DNDNEXT/actions/runs/41691062221) passed prior privacy tests but failed while inserting synthetic actors because a `UNION ALL` coerced untyped controller `NULL` to text. Both controller values were cast to `NULL::uuid`; [run 41692165016](https://github.com/bob8675309/DNDNEXT/actions/runs/41692165016) then passed **all 13 cases**. This was a fixture typing error, **not** a gameplay or Supabase authorization defect.

## 4. Remaining mandatory safety gates

1. **Original weapon and attack-roll dependencies are untested.** Equipped inventory ownership, source item metadata, real advantage/disadvantage, randomly rolled criticals, concentration/effect consumption, flat mitigation, and actual combat snapshots require source-complete fixtures. The live weapon profile checks equipped item ownership and `can_edit`-based character permissions; combat-only `can_control` must be implemented and tested without access to NPC sheets, inventories or secrets.
2. **Full E/P/W/L/X/S/C and grant lock graph remains open.** The real attack-roll helper locks and deletes timed-effect X rows; test double skips this. Character S→C slot bridges and Admin/turn triggers remain uncontrolled by a globally proven protocol. A few successful concurrent schedules do not establish universal deadlock safety.
3. **Concealed event timing and first-result policy remain open.** `Unknown Events` wording was an owner preference, not permission to disclose the timing of hidden turns or reactions. A full server-owned viewer projection and browser privacy acceptance must precede gameplay release.
4. **Live bypasses still exist.** Production public cast/move/end-turn/reaction functions remain as deployed; scratch GRANT/REVOKE and source wrappers do not secure existing players.
5. **P1.3/P1.5 remain OPEN.** P1.2 R1/R2 are owner-approved policy only, R3 is unresolved; TC1 Option A was approved but its reservation/admission rule is not deployed. No production migration, public privilege change, PR merge, AI, map work, or live data edits authorized.

**Next single task:** Source-faithfully install original `encounter_weapon_profile_internal_v1`, `encounter_resolve_attack_roll_v1` and mitigation dependencies in *disposable* PG with real character/inventory ownership, timed-effect X, damage/resource C/S, plus two-session Attack versus End Turn/Move and hidden-result timing acceptance. Continue to fail closed on unproven real weapon branches; do not merge or deploy.

**Owner manual test:** None required now; GitHub-hosted CI supplies the ephemeral GoTrue stack.
