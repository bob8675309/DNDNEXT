# P2 Private Encounter-First Core Action — Transaction Candidate

_2026-11-01; research-only draft PR #312, stacked on held #309. Not approved for production or public RPC replacement. Production inspection SELECT-only; no production schema, function, role, data or deployment changes._

## Why this candidate exists

The immediately preceding [command replay baseline](Spell_Recipe_P2_Command_Replay_Baseline_2026-11-01.md) reproduced with real signed-in GoTrue JWTs that current public `encounter_use_core_action_v1` returns a completed Dash result to a different NPC controller invoking the same request ID with Dodge and to the original controller **after** NPC permissions are revoked. The original public source does not bind the cached result to `requested_by` or immutable typed action intent. The original body is left UNCHANGED in `scripts/fixtures/encounter_core_action_live_replay_pg17.sql` for differential tests. A green baseline reproduces **known-unsafe behavior**, not a successful security patch.

## Held implementation

`sql/candidates/20261101_core_action_encounter_first_private_candidate.sql` adds only `private.encounter_core_action_transaction_candidate_v1(uuid,text,uuid)`, explicitly revoking direct EXECUTE from PUBLIC, anon, authenticated and service_role. **No public production-facing replacement or grant is included.** The function requires **`public.encounter_command_requests.request_intent JSONB`**, a versioned authoritative input column **absent from the live production ledger**. That column is added **only in disposable PG16 and local Supabase PG17 tests**, not as a production migration.

The candidate's intended command authority:

1. Validate participant/request ID and strict Dash, Disengage, Dodge vocabulary, reject anonymous non-service callers.
2. Resolve participant's encounter ID without a lock solely to identify which encounter to lock; lock **encounter E FOR UPDATE first**, followed by actual participant C FOR UPDATE, then confirm the actor still belongs to that encounter. A concurrent encounter change fails closed.
3. Recheck the caller's **current** ability to control the participant via existing server `encounter_can_control_participant_v1` before reading any saved result; this covers granted shared NPC controllers and their immediate revocation.
4. Compute a typed JSONB intent with `version=1`, canonical encounter ID, participant ID, `core_action` and the exact requested Dash/Disengage/Dodge action.
5. Read ledger entry FOR UPDATE **after** control and actor locks. Only return a **completed** cached result if request type, actor, encounter, original requester, full versioned intent and returned action agree. Foreign requester, a different core action, a different actor, or old rows with no typed intent fail closed. A matching pending/untrusted result fails with SQLSTATE `55000`, never an apparently successful pending placeholder.
6. For a genuinely new request only, enforce the existing active turn, not defeated and available Action checks, insert the canonical ledger request, then perform the original actor effects, combat log and encounter version update inside the same SQL transaction.
7. Preserve original result fields (`requestId`, `action`, `actionAvailable`, `movementBonusFt`, `disengaged`, `dodging`). Exact same-authorized completed replay spends no action, makes no new log, performs no new roll and does not increment encounter version.

The candidate handles same-actor concurrent requests by serializing on the encounter E lock. It **does not establish that all other legacy RPCs now obey the same order**. Older attack/spell/turn/movement/reaction commands still use ledger-first or actor-first locks; releasing one encounter-first command in production alongside them could create deadlock cycles with trigger-side actor/resource locks. Existing **cross-encounter persistent character-slot** locking, a globally colliding request UUID, reaction-window timing, and any compatibility with old pending/untyped requests still require independent architecture and migration review.

## Disposable acceptance

- `scripts/fixtures/encounter_core_action_candidate_pg16_checks.sql` imports this exact private function into an isolated PostgreSQL 16 research database (mock identity, **not** GoTrue) and tests Dash + Dodge + Disengage original effects, exact completed owner replay, another controller's denied replay, action mismatch, revocation, legacy unversioned request rejection, and once-only log and version. Only the fixture has a one-column typed intent schema extension and an explicitly marked temporary mock authenticated bridge.
- `scripts/fixtures/encounter_core_action_candidate_pg17.sql` installs the same private SQL **in free disposable local Supabase**, checks that no normal role has direct EXECUTE, and creates a **local-only public bridge** `p2_local_core_action_candidate` callable by real signed-in test accounts. This bridge is not a deployable app RPC.
- `scripts/test_npc_delegated_control_local_auth.mjs` retains the **actual old vulnerable public core action baseline**, then checks private candidate behavior using three genuine GoTrue identities. Two concurrent exact requests by the same authorized user must return identical completed Dash; another authorized NPC controller is denied on the same request; an action switch, legacy null intent and correct-but-pending typed result fail closed; revoked owner fails with the same still-valid JWT. Two different controllers issuing distinct core actions concurrently must consume **exactly one** available Action and produce only one new log and version increment.
- `scripts/validate_encounter_core_action_candidate_p2.mjs` asserts source-level E→C→authorization→ledger order, typed intent and ungranted function plus executable JWT regression coverage.

These tests are research evidence only. Even a green real-JWT run is **not a test of the candidate installed among the complete production trigger/ledger command network**. The PG16 mock-role test must not be described as a signed Auth test. Existing production core-action SQL, all other public command RPCs, and the campaign world/character systems remain untouched.

## Required coordinated release work — not authorized

A public rollout would first need the GM's permission for the NPC ready-spell visibility policy and decision on a single physical character participating in two active encounters, then a reviewed **global** lock order and canonical request-intent policy for all public direct cast/weapon/turn/reaction commands. Existing unversioned ledger rows cannot silently be interpreted as new canonical intents. Options for migration/retention, pending request handling, live rollbacks, replay revocation semantics and aggregate resource locks must be explicitly reviewed and rehearsed in a full isolated schema, with genuine Auth and browser acceptance. Do not install the research helper or schema by itself and do not merge held #309/#312.

**Single next task:** Inspect the remaining complete public command/trigger call graph for lock cycles and mixed-version rollout ordering, then prepare **another private, ungranted encounter-first weapon/move/reaction candidate** only after selecting a common lock/intent contract. Keep all production permissions, core action function and gameplay unchanged.
