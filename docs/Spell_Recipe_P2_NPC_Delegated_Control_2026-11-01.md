# P2 — Delegated NPC, Familiar, and Sidekick Control (Research Candidate)

_2026-11-01. User-requested requirement, incorporated into the existing P2 authorization and encounter-safety workstream. **Held draft PR #312 only.** Not deployed, no production migration, new grant, user assignment or public combat action change._

## Binding player/admin behavior

- A player can control **their own player character plus any number of individually authorized NPCs**, such as pets, familiars, sidekicks, henchmen or allied NPCs.
- **More than one player may control the same NPC**, subject to the normal turn/action/reaction spending constraints. The encounter backend remains authoritative for which creature is acting; granting control does not create additional turns.
- The GM assigns or removes NPC access in the admin NPC-management panel at `/npcs`. The control toggle is **per player per NPC**, not a global "player can control all NPCs" switch.
- **Combat control is not character editing, inventory transfer, knowledge of secrets or Admin.** A companion controller can move, take actions and spend the NPC's server-owned resources only through authorized encounter actions. No auto-play or AI actor is enabled.
- A player's own character keeps its existing direct `controller_user_id` or `character_permissions.can_edit` access. Historical editing grants must not be removed silently.
- A player controlling several **different** actors in the same encounter is **NOT** the same as **one character present in multiple active encounters**. The latter remains a separate, unresolved shared-resource concurrency policy.

## Verified production foundations (read-only)

The live schema currently has `public.character_permissions(character_id,user_id,can_inventory,can_edit,can_convert)` with primary key `(character_id,user_id)` and admin-only write RLS, self/admin read RLS. It has **no `can_control` column**. `encounter_participants.controller_user_id` can designate one encounter-specific controller and `public.encounter_can_control_participant_v1` also permits `can_edit`. Combat command RPCs call this existing server-side function for authorization (but historic cached-replay early returns are separately unsafe and not repaired here).

The admin can read `public.user_profiles(id,role)`, `public.players(user_id,name)` and `public.character_permissions` under existing RLS. The NPC management page is `pages/npcs.js`, with a right-hand details panel; `components/character/CharacterInteractionPanel.js` is a separate profile/dialog wrapper. Its `isAdmin` presentation prop must **never** be trusted as backend authorization.

## Held implementation

- `sql/candidates/20261101_npc_delegated_control_candidate.sql` is a **review-only candidate SQL file**, not an applied migration. It adds independent `can_control boolean NOT NULL DEFAULT false`, backfills existing `can_edit` grants to retain historic control, and defines `admin_set_npc_control_v1`. The RPC validates real Admin state server-side, requires an NPC or merchant character, modifies only the can_control field on the chosen `character_permissions` row, preserves all existing edit/inventory/convert flags and relies on the real FK to `auth.users` for a valid player account.
- It extends `encounter_can_control_participant_v1` to accept `can_control` **alongside** existing Admin, direct encounter controller and `can_edit` paths. It also adjusts the hidden encounter-participant SELECT RLS policy so a specifically assigned NPC controller may see their own token. It **does not broaden access to hidden source character sheets or GM notes**. Role grants restrict new admin RPC to authenticated accounts; inside it actual Admin authorization is required. All SQL needs privilege/security review before staging.
- `components/NpcControlPermissionsPanel.js` displays a small player list with persistent battle-control toggles, current edit/direct-controller warnings, server-confirmed results, error and retry behavior. `pages/npcs.js` mounts it in the NPC details panel only when the page has confirmed Admin. The UI calls the scoped RPC, not direct permission-table writes or client-side encounter patches. It does not create an unbounded user/actor controller roster.
- The toggle controls **only** the new delegated `can_control` bit. The user-visible label warns when a separate `can_edit=true` or `controller_user_id` path continues to permit control. For a true full revocation, Admin must also remove those independently authorized paths in the appropriate existing workflows. Do **not** silently clear character edit or existing encounter assignments.
- A character may be an NPC/familiar/sidekick via its existing `kind='npc'` plus normal description/role metadata; no new species, character kind, subclass, pet AI or map mechanics was invented.

## Test and acceptance boundaries

- `scripts/fixtures/npc_delegated_control_p2_pg16_checks.sql` imports the real candidate SQL into the existing **disposable PG16** test database, with explicit mock `auth.uid()`, mock Admin role helper and simplified table/RLS fixtures. It tests Admin-only grants, false grant to ordinary players, PC vs NPC target limits, one player controlling a PC+companion, two players controlling one companion, direct owner preservation, old `can_edit` compatibility, revocation scoped to one user, hidden encounter token read with/without grant, and no accidental `can_edit` grant. It is **NOT** real GoTrue-issued JWT acceptance or a complete live schema simulation.
- `scripts/validate_npc_delegated_control_p2.mjs` statically checks the candidate's backend/UI boundaries. The research GitHub workflow now runs these checks. The release-candidate workflow is configured to run a full Next.js production build when NPC panel files change. Exact-head CI must be checked before reporting success.
- Required later staging: real Admin and two player accounts signed in through GoTrue; confirm hidden token RLS without revealing secrets, server-side rejection of unauthorized commands, multiple controllers' last-action race (only one Action), merchant vs NPC restrictions, existing editor/direct-controller semantics, logout/permission-revocation refresh and a reliable UI update after selection switches. Pay particular attention to the old pre-authorization replay issues in other spell/attack/reaction RPCs; **delegated access must not be used to bypass unresolved replay hardening**.

## Critical unresolved questions for eventual production acceptance

1. **Ownership and encounter-specific controllers**: the new grant is additive. A revoked NPC toggle does not override `controller_user_id` or `can_edit`; document how an Admin will edit those separate paths. If the owner requires an absolute "deny control" override, a separate explicit deny policy and migration are needed.
2. **NPC player list**: the research UI uses `user_profiles` with player role and labels from `players`. Players without a matching name are displayed with a shortened ID. Future account display names and roster pagination can be improved without changing the authorization contract.
3. **Cross-encounter resource policy**: one player controlling multiple actors **does not imply** a single NPC should appear in multiple active encounters. Current production does contain an overlapping-character case and still needs a separate policy before universal encounter transaction changes.
4. **Production rollout**: no live `can_control` column exists yet. The held UI will display a query error if deployed before the reviewed candidate schema/RPC; **do not merge UI alone into production**. Owner approval, staged migration, RLS and regression checks, and rollback/compatibility review are required.

**Next task:** maintain the P2 spell/encounter authority effort and evaluate overlapping active-character resource policy, now including delegated controllers and their revocation semantics. Do not automatically collapse NPC control into `can_edit` or modify world/town movement.
