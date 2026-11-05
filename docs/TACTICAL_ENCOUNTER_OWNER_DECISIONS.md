# Tactical Encounter Owner Decisions — Character Concurrency and Command Replay

> **Approved tactical policies:** TC1 / Option A (2026-11-01); P1.2 R1 and R2 (2026-11-03). **Policy approval is not implementation or deployment authorization.**

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

## TC1 implementation path confirmed by live source (read-only)

`admin_set_encounter_status_v1` sends staged→active through `admin_start_encounter_v1`, but **paused→active** uses a separate direct update. Both must eventually apply the same concurrency-safe TC1 admission/serialization. The isolated [PG16 model test](P1_3_Option_A_Concurrency_Model_2026-11-01.md) passed eight synthetic scenarios; it does not authorize or validate deployed enforcement.

## P1.2 — Immutable combat-command replay and revocation (owner-approved 2026-11-03)

**Status: R1 and R2 APPROVED by the campaign owner on 2026-11-03.** These are binding security policies for future tactical-command implementation. They do **not** approve a SQL migration, `EXECUTE` grant or revocation, application deployment, PR merge, live data alteration, or rollout. The authoritative technical envelope remains the [P1.2 command replay contract](P1_2_Command_Replay_Contract_2026-11-01.md); validation and global locking remain under [P1.3 research](ACTIVE_WORK.md).

### R1 — Fail closed on unverifiable historical replay

When an existing/historical command-request row lacks sufficient trustworthy evidence to prove **both its original requester and its exact original typed command intent**, **refuse to replay that request**. Preserve its original database record for Admin/audit review; do not delete it, invent a requester, reconstruct original intent from the result alone, silently grant ownership of the request UUID, or rerun/spend the Action, reaction, spell slot or other resource through that UUID. A new valid command must use a fresh request ID and satisfy current authorization and action rules. The user-facing failure must not disclose private record content.

**Owner decision:** Approve — fail closed while preserving the historic record for audit.

### R2 — Revoke access to cached private combat results when control is lost

If a player or other human controller no longer has permission to control the relevant actor, **deny access to the previously cached private combat-command result via the command API**, even if that same controller originally executed the command. Every replay must recheck **current** actor/encounter authority and result visibility before returning cached JSON. A previously valid request ID is not a permanent entitlement to hidden combat data. No replay denial may execute the original action again or spend additional resources.

**Owner decision:** Approve — revoke cached-result access with loss of control.

### Explicit limits of this approval

- These approvals settle **R1 and R2 only**, not every detail of the P1.2 envelope, API error-code design, visibility redaction/projection, service-principal handling, or production migration.
- **R3 remains unresolved:** the policy for trusted service calls, explicitly identified service principals and audited scope still requires separate review. **R4/TC1 Option A was already approved** on 2026-11-01; its P1.5 enforcement and reconciliation are not deployed.
- The two-family guarded replay experiment on [draft PR #317](https://github.com/bob8675309/DNDNEXT/pull/317) has passing disposable real-JWT tests ([research report](P1_3_Guarded_Replay_Two_Family_Candidate_2026-11-03.md)), but it is **research only**. Original production RPCs and their grants are unchanged and the global P1.3 transaction/lock-order proof is incomplete.
- **No production deployment, Supabase SQL/grant change, merge into `main`, or live character/encounter test has been authorized.**

## Concealed tactical activity — player-facing wording (owner preference, 2026-11-03)

When a combat event must be acknowledged in the **player** interface but the underlying participant or action is concealed, use the neutral display label **"Unknown Events"** rather than **"Unknown combatant's turn"**. This wording is intentionally ambiguous: the label itself should not tell players whether a hidden combatant, hazard, or another concealed event caused it.

- The GM's authorized view continues to show the actual participant and event information.
- This is a **presentation preference**, not authorization to reveal identifiers, team, initiative placement, coordinates, event type, action details, or reaction-window metadata to unauthorized players.
- The exact timing, grouping and visibility projection of concealed events—including whether an indicator should appear for every hidden turn—remain **security/UX acceptance questions**, not settled policy. They require source-derived first-execution and replay privacy tests before deployment.
- Applies only to the tactical encounter UI, not the world-map or town-map systems.
- **No implementation, database/grant change, merge or production deployment is authorized by this preference.**

## Open question — full visible NPC sheets for player accounts (research finding 2026-11-03, NOT DECIDED)

Deployed `character_sheets_select_visible_or_assigned` and `characters_select_visible_or_assigned` RLS predicates permit a signed-in player to select the **entire sheet for a visible NPC** (source-faithful synthetic JWT case 151, [test report](P1_3_Grant_Revoke_Controller_and_RLS_2026-11-03.md)). Hidden NPC sheets were denied to unrelated JWT users in the modeled setup. **No live sheet was read and no real-world disclosure was established.**

**Owner decision required:** Should all players be permitted to read full character sheets for visible NPCs, or should player access be limited to explicitly disclosed statistics/public summaries, with full sheets retained for GM/authorized editors? Do not assume either answer or adjust live RLS grants until explicitly approved and tested. This is separate from the `Unknown Events` concealment-wording preference. P1.3/P1.5 and production permissions remain unchanged.

## Character creation, Admin notices and adaptable permissions — owner decision (2026-11-04)

**Approved product behavior:** Reuse the existing shared Forge for primary PCs, alternate characters and player-created underlings; **do not require GM approval before creation**. Notify Admins after every successful new player-character creation. The GM can then use the NPC management page to change character permissions, assign control and add GM-private notes. A notification is informational, not a pending approval or automatic permission change. Independent player/combat/GM-private rights remain required. The owner authorizes **reviewing and, if needed, redesigning the permission model for clarity, security and efficiency**, but still requires a tested coordinated migration and release review before live SQL or RLS changes.

**Source-backed direction and full acceptance contract:** [Character Creation, Admin Notices and Delegated Rights](CHARACTER_CREATION_ADMIN_NOTICE_AND_DELEGATED_RIGHTS_2026-11-04.md). This **supersedes** the earlier 2026-11-04 research-only wording that imposed a pending-underling approval gate, without rewriting historical findings or claiming installation. Preserve `create_player_character_v3` source authority, the existing transaction-owned `player_character_created` level event, current private note RLS, and existing player grants during any migration. New tests D05–D06/D25–D32 are proposals, not executed.

## NPC interaction: Profile-first, player-safe lore and optional expanded character views (2026-11-04)

**Owner clarification:** When a user interacts with an NPC, **open that NPC's Profile first**. The screenshot of the broad character Profile page illustrates the desired shared presentation language, but its final layout and width are not yet approved. Keep the same entry behavior for merchants; storefront, character sheet, inventory and other action views are subsequent explicit choices, not the initial click destination. This does **not** authorize changes to the world-map click handlers or map rendering during P1.3 research.

**Live source inspection (main `51c351a`):** `components/MapPageClient.js` already opens `CharacterInteractionPanel` in the right-hand `npcPanel` offcanvas for ordinary NPC/merchant map clicks, starting in `profile`. `components/PlayerCharacterProfilePanelUnified.js` uses the same `CharacterInteractionPanel` for a large self-character overlay; `components/NpcPanel.js` implements `NPC Dossier & Player Reveals` for Admin and `Known Lore` for others. These are distinct host layouts for a shared interaction core, not proof the UI is visually finalized.

**Critical privacy distinction:** `NpcPanel.js` currently fetches `character_sheets.sheet` before React hides unrevealed lore. The present production RLS is known to allow the complete sheet of any visible NPC to be read by unrelated signed-in users. Hiding `Known Lore` cards in React is *not* server privacy. Keep the GM's private notes and unrevealed data out of unauthorized API payloads through a tested server-side player-safe profile projection plus independently authorized full-sheet views. Do not solve by hiding tabs alone or by granting `can_edit` merely for combat.

**Still open UX decision:** Should NPC interaction use the existing map-side offcanvas, a wider modal/overlay like the screenshot, or responsive sizing depending on content? The user explicitly says the UI/layout is not settled. Do not assume a redesigned width, automatically expose all character tabs to visitors, or patch world map before discussing the intended UI shell.


## Owner decision — GM Secrets vs player-editable backstory secrets (2026-11-04)

**Approved by GM:** Separate private **GM Secrets** from **player-editable character backstory secrets** as different access-controlled sources. Full character-sheet edit, inventory access, conversion, temporary party/NPC control and shared combat control **must not implicitly grant access to GM Secrets**. This supersedes current implementation semantics where `can_edit` can call `get_character_secrets_v1`/`set_character_secret_v1`. It does **not** authorize changing deployed grants, functions, data or production SQL without review.

- **GM Secrets:** Existing legacy `public.characters.secret` entries are classified as GM-controlled; only authenticated GM/Admin may read or change them through a dedicated trusted server capability. Existing `character_notes` audiences remain separate and require audit for truly GM-private notes. Never put GM secrets in a player-readable raw `character_sheets.sheet` JSON field.
- **Character backstory secrets:** Separate persistence owned by the character; GM and authorized sheet editor(s) may draft/revise them, independently of the GM-secret store. `can_inventory`, `can_convert` and `can_control` by themselves do not expose this data. Because shared sheet editors can see it, the UI must explain this scope.
- **Player-facing revelation:** The GM may author a *separate, sanitized clue* and explicitly publish or withdraw it. Revealing does not copy or change the GM Secret. A player-editable `sheet.profileReveal.secret` flag alone must never publish a GM Secret or private note.
- **Legacy storage:** 2026-11-04 read-only snapshot found **7 non-empty `characters.secret` among 15 characters**, and **0 top-level `sheet.secret` keys among 10 sheets**. No values were inspected. No automatic migration/deletion/overwrite, schema conversion, or default-public classification is authorized.
- **Legacy source compatibility gate:** Current `create_player_character_v2` (called by v3) and old NPC Forge write a `secret` payload into `characters.secret`; the Forge/player UI must route future player-authored secrets to the independent backstory store instead before any real cutover. Existing privileged tagged-PC reader(s) `get_my_player_character_v1`/`get_my_player_characters_v2` serialize `characters.secret` and must be filtered; GM-only original secret RPCs and all Admin editor views must be migrated coherently.
- **Evidence:** P1.3 [draft #321](https://github.com/bob8675309/DNDNEXT/pull/321) has **unapplied** stage-three SQL `20261104_gm_vs_player_backstory_secrets_stage3.sql`, adding independent authoring/reveal records, Admin-only legacy Secret APIs and sanitized tagged-PC readers, plus genuine local JWT test cases V09–V15. Only an exact-head green CI run can establish those specific cases; neither SQL nor UI is deployed. The centered Profile UI remains separately unmerged draft #320; global CP/CS/E/P/L/G/I lock proof remains unproven.

**Release requirement:** all legacy source consumers and public Profile paths must be cut over and browser-tested, with signed-in Admin/editor/controller/outsider authorization and rollback. Continue P1.3 research only; do not execute data-destructive production changes without GM review.

## Owner clarification — only creator + GM can access authored backstory secrets (2026-11-04)

**GM clarification:** When multiple players can edit the same underling or alternate character, only the **verified original creator** and the **GM** may view/edit its player-authored private backstory secret. Other `can_edit` collaborators receive no access to that specific private record; nor do inventory, conversion, temporary NPC control or encounter participants. This explicitly supersedes the earlier provisional language “GM and authorized sheet editor(s)”. Ordinary sheet/inventory/combat collaboration remains separate and must continue working.

- **Creator identity is not inferred from a sheet edit grant:** There is currently no trustworthy `creator_user_id` association on the deployed character or permission rows. Research models a private, immutable `character_id → creator_user_id` claim bound from `auth.uid()` by the **trusted authoritative creation transaction**, not from browser-supplied IDs or the first person to gain `can_edit`. Creator binding may not be reassigned by another sheet editor.
- **Creator access additionally requires an active character edit grant.** Revoke that grant and access to the private authored backstory ends, without deleting the content; the GM retains access.
- **Legacy/unattributed characters fail closed:** Only the GM may view their private backstory until the creator is established through a separately approved and audited workflow. No automatic conversion of existing `characters.secret`, sheet fields or campaign notes.
- **Separate secret classifications continue:** Existing `characters.secret` is GM-only; a public clue requires an independent GM publication action. Neither a co-editor nor a creator may disclose GM Secrets by toggling `profileReveal.secret`.
- **Draft research:** [PR #321](https://github.com/bob8675309/DNDNEXT/pull/321) now models private creator provenance and a creator-or-GM row-authorization helper with a separate signed-in co-editor. Cases V16–V18 target co-editor denial, immutable creator identity and GM-only unattributed legacy behavior. Verification requires a green run at the exact source head. This is **not deployed**. Real NPC/player/underling/alternate Forge creation RPCs still need an authoritative creator-binding call, compatible retries and browser migration.

**No approval for production schema, grant, migration, data rewrite, merge or deployment is inferred.** Continue source-faithful tests and return to owner before any large destructive data change.
