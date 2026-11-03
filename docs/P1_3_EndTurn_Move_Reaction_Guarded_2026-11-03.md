# P1.3 — Guarded End Turn, Move, Reaction Pass (2026-11-03)

**STATUS: VERIFIED IN DISPOSABLE AUTH CI ONLY. NOT DEPLOYED.** [GitHub Actions run 41679603374](https://github.com/bob8675309/DNDNEXT/actions/runs/41679603374), exact source/test SHA `82cb4481bc5830c96b7657c4f9a4f3bd14404af5`, **8/8 checks passed**. Four distinct GoTrue users; **cases 70–81 passed** in PostgreSQL 17 via PostgREST. Draft PR #317 remains unmerged. Production Supabase, grants, data, combat app and world map unchanged.

## Exact-source authority

Three live DnDWeb \`public\` function definitions were fetched SELECT-only on 2026-11-03, and unchanged bodies saved in [snapshot](../scripts/fixtures/p1_3_turn_move_reaction_live_pg17.sql).

| Source function | Live source MD5 | Existing authenticated EXECUTE | Original lock order |
| --- | --- | --- | --- |
| \`encounter_end_turn_v1\` | \`2785f688af8e200f64f18b6c421f19a6\` | yes | L → actor P → E, followed by expiry X and next P |
| \`encounter_move_active_participant_v1\` | \`1f7fc81b307800f70ab412872473aa14\` | yes | L → mover P → E, may generate W |
| \`encounter_resolve_opportunity_reaction_v1\` | \`70cbfda404644c1000a6541ce8bf9c30\` | yes | W → reactor P → mover P → E → L |

Original resolved-window reaction code returns cached W.result **before current-controller authorization**. This is a source-confirmed privacy boundary, not evidence of a production exploit.

## Research candidate

[Scratch PG17 extension](../scripts/fixtures/p1_3_turn_move_reaction_guarded_pg17.sql) layers three guarded wrappers onto the existing source-exact spell/core-action candidate, reusing one immutable request ledger and E-first, sorted P, current-principal/visibility protection. Five modeled families now: \`spell_single\`, \`core_action\`, \`move\`, \`end_turn\`, and **reaction Pass only**. The original public End Turn, Move and Reaction function bodies execute under the outer transaction and are denied directly **only in scratch grants**.

- Move validates a bounded ordered axial path of numeric integer \`q\`/\`r\`, rejects extra keys, and invokes the original reach/reaction-window/movement logic.
- End Turn prelocks all encounter participants after E, then executes original expiration and initiative changes. Exact same-owner replay succeeds across turns while controller access remains; a *newly hidden next actor* blocks replay.
- Reaction derives reactor/mover from W without trusting unlocked discovery, then guards current actor/mover and locks/rechecks W. Reuse of resolved W under a new request ID is denied. Source-unverified \`attack\` and Pass-with-weapon fail closed as \`P13_GM_ASSISTED_REACTION_ATTACK\`, without damage or resource spending.

## CI cases 70–81

| Case | Isolated result |
| --- | --- |
| 70 | Distinct GM, mover, reactor and outsider signed-in JWTs |
| 71 | Original Move triggers pending W; same UUID replays; changed movement path denied |
| 72 | Reaction Attack explicitly GM-assisted; no partial W mutation |
| 73 | Authorized Pass resolves W once; fresh UUID after resolution denied; outsider denied |
| 74 | New-UUID Move resumes after Pass; spends 5 ft; unknown path operand rejected |
| 75 | Source End Turn expires one condition and timed effect, advances next actor; old-turn replay succeeds |
| 76 | Cached End Turn result denied when next actor becomes hidden; revoked actor denied (R2) |
| 77 | Revoked reactor replay and unverifiable legacy UUID rejected (R2/R1) |
| 78 | Concurrent Move/End Turn serializes without deadlock or phantom ledger in tested schedule |
| 79 | Different IDs racing to resolve W: one Pass, other window-resolved denial |
| 80 | Same ID racing to resolve W: identical result, one W transition/log |
| 81 | Anonymous model RPCs and original unguarded direct RPCs denied in scratch grants |

**Evidence:** [source+test run 41679603374](https://github.com/bob8675309/DNDNEXT/actions/runs/41679603374), SHA `82cb4481bc5830c96b7657c4f9a4f3bd14404af5`. Previous original vulnerable baseline cases 48–55 and two-family guarded cases 56–69 remain executable within the same successful workflow. **No production safety or universal lock-order result is inferred.**

## Explicitly unproven and blocked

1. **Opportunity Attack execution is NOT tested.** The weapon instance, reach/LOS, authoritative attack roll, hit/damage/mitigation, reaction budget and effects/trigger path are not modeled. Do not silently resolve an Attack as Pass.
2. **First-execution hidden information** may be exposed by End Turn's \`nextParticipantId\` or Move's \`reactorParticipantId\`. Case 76 tests replay only. Server-owned visibility projection/denial requires owner-facing UX and independent acceptance.
3. The five-family E-first model **does not cover every old version or Admin/service/trigger/resource writer**, nor prove the global E/P/W/L/X/S/C/grant order. Timed effects, speed, geometry, damage, Admin and RLS use synthetic dependencies. Two-session schedules are limited; no global deadlock-freedom claim.
4. Production still grants direct authenticated EXECUTE on original versions; **synthetic REVOKE in the isolated stack is not a live security fix**. Atomic cutover planning remains separate and unapproved.
5. R1/R2 are owner-approved policies (2026-11-03), **not deployed**. R3 service-principal policy remains open; TC1 Option A admission and P1.5 are undeployed.

**Next single P1.3 task:** Source-trace and isolate exact Opportunity Attack/weapon/reaction resource authority, then test two-session contention and hidden next-participant/reactor visibility with real JWTs and full W/P/E/slot effects. Keep reaction Attack GM-assisted until proven. No user manual testing, Docker installation or production SQL is needed.
