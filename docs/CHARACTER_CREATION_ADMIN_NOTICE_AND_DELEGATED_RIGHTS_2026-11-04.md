# Character Creation, Admin Notices and Delegated Rights — Owner Decision (2026-11-04)

> **OWNER PRODUCT DECISION, NOT A DEPLOYMENT APPROVAL.** This supersedes the 2026-11-04 draft P1.3 statement that every player-created underling must remain pending until GM approval. Preserve the original research wording as historical context; use this document for current implementation intent. Existing P1.3 global transaction and permission-security gates still apply.

## 1. Reuse the established Forge and create immediately

- Continue using the unified `components/NewNpcModalV3.js` / `NewNpcModalV3Refined.js` presentation and the **server-authoritative `public.create_player_character_v3`** RPC for a player creating a primary PC, an alternate, or an underling. The owner **does not require creation-time GM approval**. Preserve all ten current Forge steps, source-choice validation, species/class progression, original idempotency and starting-equipment/rules behavior.
- The existing player creation stores the canonical character in `public.characters` with `kind='npc'`, `player-character` tags and `is_hidden=true`; `create_player_character_v3` invokes v2, whose current permissions and side effects include immediate `can_edit=true`, `can_inventory=true`, progression/starting gear and a `character_level_events` event. **Do not arbitrarily strip current creator access or create a separate half-built draft character.** Existing one-character assumptions in account/Profile/Forge consumers need testing before allowing multiple same-player alternates.
- After creation, the GM must be able to find that canonical record in **`/npcs`**, including hidden player-created records, inspect the available sheet, set/revoke independently scoped controls, and add GM-private notes **without rebuilding the character**. Any separate NPC/PC labels are presentation/ownership classifications, not a duplicate character row.
- The NPC roster in `pages/npcs.js` currently loads `kind='npc'`, which matches Forge player records, but authenticated `characters` table SELECT privileges require genuine JWT verification. Do not claim that an Admin can already reach every such record merely because the query exists.

## 2. Admin notice on each successful player creation — informational, not approval

- Show an **Admin-area new character notice** when an authenticated player creates a character. The notice must include creator display identity (when authorized), character name/type, creation timestamp, and a direct `/npcs?focus=npc:<character-uuid>` deep link. Provide an unread/new indicator and reviewed/dismissed behavior scoped to each GM/Admin. The notice **must not block creation** or change grants.
- **Reuse existing transactional evidence rather than trusting the browser:** `public.create_player_character_v3` calls v2; v2 inserts `public.character_level_events` with `event_type='player_character_created'`, `created_by` and `character_id`. This row is durable, tied to successful creation, and protected from direct authenticated SELECT/INSERT by current privileges/RLS. On 2026-11-04 live SELECT-only count showed **five such events**, not a user audit.
- Prefer a small **Admin-only projection/read RPC** over `character_level_events`, with per-admin reviewed/read receipts if persistent unread state is required. Authenticate GM server-side in the RPC, return only display-safe metadata, and do not expose raw event `details` or private sheet/notes. Avoid a second player-writable creation-notification API.
- Repeated calls with the same `creation_request_id` / idempotent `create_player_character_v2` result must produce only one creation event and **one notice**. Failed/rolled-back Forge submissions must produce none. Test concurrent duplicate retries and player-created alternates. Do not reuse the existing `get_recent_site_activity_v1` visitor tracker as a creation event source: it only summarizes account/site visits.
- Admin display may reuse the visual surface of `pages/admin/activity.js` or add a focused Admin inbox; retain the existing privacy-minimized visitor tracking and its RLS. Avoid unnecessary user-profile or character payload duplication.

## 3. Post-creation GM notes and permission management

- `pages/npcs.js` already has `character_notes` with `private` and `shared` scope. Live `character_notes_select_audience` allows Admin or author for private notes; unrelated players cannot read them under that policy. Treat **GM-authored private notes** as the starting implementation for GM-only information. Existing private notes by a player are not the same as GM notes, even though Admin can see them.
- Keep GM secrets in explicitly protected fields/notes. **Do not place new GM notes in `characters.secret` or unrestricted `character_sheets.sheet`** without correcting and proving all source-reader projections. Current signed-in `get_my_player_characters_v2` returns `to_jsonb(c)` plus the entire sheet to qualifying tagged player-character users; `encounter_spellcasting_profile_v1/v2` are separate read/side-effect paths.
- Admin management should present **effective access**, including separate `can_edit`, `can_inventory`, `can_convert`, research `can_control`, active encounter `controller_user_id`, and any future scoped grants, rather than falsely implying a single delegated toggle fully revokes a player's controls.
- A change to combat delegation must not silently change sheet editing, progression, raw inventory or GM notes. Temporary companion control needs explicit expiration/revocation; full handoff can grant more rights deliberately. Multiple players may share control of one NPC, but cannot double-spend its Action/Reaction/resources.

## 4. Owner authorizes evaluating an efficient permissions rework

**Design authorization:** The GM supports reworking/replacing the permission architecture where this improves safety, clarity and efficiency. **Not permission to apply a production migration or remove legacy grants unreviewed.**

Preferred candidate: a centrally evaluated **capability-based grant** model scoped by canonical character and authenticated user, with explicitly named rights (`combat.control`, `sheet.view`, `sheet.edit`, `inventory.view`, `inventory.manage`, `progression.manage`, `notes.gm.view` if GM, `notes.shared.view`) and, where necessary, encounter/character-specific scope, `expires_at`, `granted_by`, `revoked_at` and audit metadata. The full set is a **proposal**, not an approved database schema. GM status must be separately verified, not granted by a player-controlled field.

**Migration discipline:** inventory and audit the current `character_permissions` flags, direct encounter controller links, RPCs, RLS and SECURITY DEFINER functions; define a compatibility evaluator for existing grants; add new capabilities without automatic broadening; transition one consumer/read surface at a time in a reviewed coordinated cutover; test full and temporary grants against real signed-in JWTs and global E/P/L/I/G/W/X/S/C locks; perform an exact authorization-diff and reversible rollback. **Do not backfill `can_edit` to `can_control` by default**, prematurely delete existing grants or expose source sheet data through a UI-only concealment rule.

## 5. Source-verified checkpoint and remaining gates

| Source | Read-only observation 2026-11-04 |
| --- | --- |
| `components/NewNpcModalV3.js` | Player mode calls `create_player_character_v3` and preserves existing Forge payload validation. |
| `public.create_player_character_v3` | MD5 `6ba73e6f12fcf826cc0a739cce45ff40`; invokes `create_player_character_v2` (MD5 `0351f0a00acae023278e1b8b065b00c9`). |
| `public.character_level_events` | Event has `character_id`, `created_by`, `event_type`, `created_at`; `player_character_created` has five live rows at checkpoint. Authenticated table SELECT/INSERT are disabled. |
| `pages/npcs.js` | Queries `characters.kind='npc'`; has selection and private/shared note editor. No shipped unified delegated permission editor was verified on this page. |
| `character_notes` | Private author/Admin read; shared scoped audiences. Live Admin/author authorization is on the database, not only React. |
| `pages/admin/activity.js` | Reads `get_recent_site_activity_v1` for 30-day site visitors/accounts; not character-created notices. |
| `get_my_player_characters_v2` | MD5 `deca87aaad0dce214743c87cdca03f36`, full `to_jsonb(c)` and `character_sheet` response; must not be confused with private GM projection. |

New and revised **proposed, not executed** test cases reside in `scripts/fixtures/p1_3_delegation_acceptance_matrix.json`, particularly D05–D06 and D25–D32. They must test nonblocking creation, Admin notices, idempotency, GM notes, effective rights and backwards compatibility.

**Current next engineering task remains P1.3**: source-derived G-revocation versus original inventory operations under two-session disposable PG17/GoTrue, including legacy grant semantics; integrate the above capability model into the authorization acceptance plan. Do not touch live permissions, `main`, combat, maps or production deployments without a separate reviewed release decision.

## NPC Profile-first interaction — owner clarification (2026-11-04)

The default interaction path for any NPC or merchant is **Profile first**. The character panel shown in the owner-provided screenshot is an example of the broad, shared character presentation, but its visual layout is provisional. Do not substitute a full sheet at first contact or force navigation to NPC management or a storefront. NPC/merchant clicks on the world map already open the `CharacterInteractionPanel` through the existing right-side `npcPanel` offcanvas; `PlayerCharacterProfilePanelUnified` renders the same core in a larger player-profile overlay. Protect the current map behavior until the GM confirms any layout change.

The existing `NpcPanel` has a GM `NPC Dossier & Player Reveals` checklist and non-GM `Known Lore`, but it currently fetches full `character_sheets.sheet` and filters revelations in React. That is **not sufficient authorization**, given the live visible-NPC RLS full-sheet read issue. A safe server projection is a required P1.3 privacy gate; only explicitly granted sections/full-sheet views should be fetched by non-admin accounts. The owner has not specified offcanvas vs wide-modal geometry, nor whether the existing tabs should be repurposed; treat layout as open.

## GM/private secret vs player backstory — confirmed owner choice (2026-11-04)

Owner approved **separate GM Secrets from player-editable backstory secrets**. Legacy `characters.secret` is GM-only and must not be readable/mutable via `can_edit` or full tagged-PC serialization; no existing 7 filled values are to be rewritten or deleted. New player backstory secrets have distinct GM/editor authority and a separate GM-authored explicit public clue channel. Existing Forge `create_player_character_v2` stores its draft `secret` in the old field, so this source mapping and NPC/Forge editor UI must change before deploying any split. A current `can_edit` is not permission for GM-private notes. Reference [owner decision](TACTICAL_ENCOUNTER_OWNER_DECISIONS.md) and [draft #321](https://github.com/bob8675309/DNDNEXT/pull/321). No live SQL/permissions changes authorized.

## Owner clarification — only creator + GM can access authored backstory secrets (2026-11-04)

An underling's private, player-authored backstory secret belongs to its **original authenticated creator**, with GM override; **other players with `can_edit` must not see or edit it**. Creator must also retain active sheet-edit authorization. No reliable creator marker exists in current live character schema; the trusted create transaction must capture an immutable `auth.uid()` attribution, never a user-submitted creator claim. Legacy/unattributed records remain GM-only pending explicit audit. This supersedes earlier co-editor scope in the GM/private secret owner decision. Cross-branch research: [draft #321](https://github.com/bob8675309/DNDNEXT/pull/321); not a deployed capability. Preserve the character-creation Admin notice and NPC page GM post-creation notes/permissions workflow as separately approved.

## Verified creator trigger and private Profile client staging (2026-11-04)

Research PR #321 now includes an **unapplied `AFTER INSERT` trigger** on the canonical `characters` table to record `auth.uid()` in private immutable creator attribution in the same transaction, rather than rewriting four deployed Forge functions. Source read-only review confirms Admin NPC `create_character_v1`, player character v1/v2, and v3 through v2 share that insertion. Reduced signed-in replay/rollback/creator-spoof tests V19–V23 passed [CI 41965391804](https://github.com/bob8675309/DNDNEXT/actions/runs/41965391804). No actual original Forge RPC was executed against this new trigger yet; completion of actual source parity and P1.3 lock graph is mandatory.

Separate stacked [draft PR #322](https://github.com/bob8675309/DNDNEXT/pull/322) prepares player-safe shared Profile data, selected GM dossier access, private creator-only editor, and GM-only legacy Secret UI/printing. First SHA `8570322c` passed full Next.js build and 25 signed-in test cases including V24 creator-only capability check; follow-up GM-only rendering patch is subject to new CI. It is **not** a release approval or a production API dependency to deploy independently. The prior Admin new-character notice requirements and post-creation NPC page GM notes/permission editing remain approved and must be preserved. No live DB/data/grants/merges/deployments.
