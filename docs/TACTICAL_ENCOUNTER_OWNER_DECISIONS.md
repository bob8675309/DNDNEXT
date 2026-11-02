# Tactical Encounter Owner Decisions — Canonical Character Concurrency

> **Approved product policy, 2026-11-01: TC1 / Option A.** This is the campaign owner's choice made during P1.3 research. It supersedes earlier statements that the shared-character policy was undecided. **Policy approval is not permission to run SQL, change production combat logic, remove participant records, or merge research PRs.** See [P1.3 research](P1_3_Global_Lock_Order_Research_2026-11-01.md) and [ACTIVE_WORK](ACTIVE_WORK.md).

## TC1 — A canonical character belongs to only one active combat encounter

**Decision: Option A — Prevent overlap.** A canonical character identified by `public.characters.id` may participate in **at most one `public.encounters.status = 'active'` encounter** at any given time. There is no exception for the GM or service role to silently bypass this invariant. If attempting to activate an encounter would place a character into two active encounters, **reject that activation with a user-facing explanation** and leave both encounters' existing data unchanged.

This policy is about **one character across multiple encounters**. It does **not** prohibit a player from controlling many distinct player characters/NPCs, nor several individually authorized players from controlling one NPC. Shared NPC controller permissions **do not create extra turns or extra spell slots**. Avoid coupling encounter policies to world-map traveling, town location rosters, or background simulation.

Staging the same canonical character in two draft/ready encounters is **not automatically a policy violation**; the concurrency gate applies when starting/resuming/otherwise entering a conflicting **active** state. The exact treatment of `paused` and other non-active lifecycle states remains a **separately documented enforcement detail**: conservative design should not create a pause/resume bypass, but do not silently promote this suggestion into a second owner-approved rule without explicit review.

## Current production evidence — observation, not policy enforcement

A SELECT-only aggregate of live DnDWeb at the time of this decision found **two active encounters, four linked active participant rows, three distinct canonical characters, and one canonical character in both active encounters**. This represents **existing data violating the newly chosen policy**, not evidence of an exploited replay or double spell-slot spend. **Do not automatically delete, archive, resolve, move, hide, or retarget that character or either encounter.** GM review and a deliberate reconciliation plan are required before an enforcing migration.

No character name, UUID, encounter name or private campaign state is included in this decision ledger.

## Proposed enforcement architecture — RESEARCH, not installed

1. **Find all entry paths** that can make an encounter active or attach a canonical participant to an active encounter. At minimum, inspect `admin_start_encounter_v1`, `admin_set_encounter_status_v1`, encounter staging/participant mutations, Admin/maintenance paths and direct table privileges. Do not rely solely on a client-side warning.
2. **Serialize simultaneous activation attempts for the same canonical character.** A check such as `NOT EXISTS (other active encounter)` without a transaction-wide shared serialization mechanism can race. Evaluate a per-character lock/unique reservation or equivalent, with stable multi-character ordering and a strict release lifecycle.
3. **Align locks with P1.3 global transaction order.** Per-character reservation/locking must not introduce a new C ↔ E / participant ↔ encounter cycle with existing casts, slot bridges, reaction windows, Admin triggers, or service operations. The final order is **not yet proven**.
4. **Recheck under the lock** before accepting activation; enforce the invariant for concurrent GM Admin sessions, legacy RPC versions, future NPC delegated controls and any trusted maintenance path. Apply server-side checks regardless of UI state.
5. **Handle existing conflicting live records only after review.** First produce an authorized, read-only Admin report, decide which encounter should retain each character, then use an explicitly approved migration or GM workflow. Never auto-select an encounter based on updated timestamps or a guessed priority.
6. **Make rejection atomic.** A failed activation must not half-refresh spell slots, leave participant state changed or write a misleading combat log. Define retry/conflict errors that do not leak hidden encounter identities to unauthorized users.
7. **Check lifecycle edge cases:** activation, pause/resume, completion/archive, participant addition/removal, character deletion and characterless tokens. Canonical `character_id IS NULL` tokens must not be conflated with unique persistent characters. Define any paused reservation semantics before implementation; this decision alone does not settle them.

A cross-table uniqueness test is **not the same** as a simple partial unique index on `encounter_participants.character_id`, because active status lives in `encounters`. Evaluate a purpose-built durable reservation or transaction-safe guard only after complete schema/lock tracing.

## Acceptance fixtures before release

- Two independent GM transactions try to activate different encounters containing the same canonical character: **exactly one succeeds**, the other returns a clear conflict, with no partial state or log.
- A character in a single active encounter may be controlled by multiple **authorized** players without duplicating its action/slot ledger.
- Different characters in different encounters remain allowed, subject to each encounter's own game rules.
- Existing historical overlap is surfaced read-only and can be reconciled explicitly **without deletion by default**.
- Concurrent pause/resume and active→resolved transitions do not bypass the final reservation lifecycle.
- Concurrent spell-slot spending, rest guards, replay and reaction resolution remain atomic under the coordinated P1.3 lock protocol; rollback returns resources and commands to a consistent state.
- True signed-in user/GM tests and disposable PostgreSQL two-session races are required; static graph CI does **not** prove these behaviors.

**Status:** TC1 is owner-approved as a *product rule*. **P1.5 implementation/enforcement remains incomplete**, and P1.3 still lacks full lock-order and concurrency proof. No manual user test is required to record this decision; later isolated tests will include exact setup instructions and expected outcomes.
