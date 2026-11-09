# NPC Profile & GM Dossier — Stacked Client Cutover (2026-11-04)

> **DRAFT ONLY / MUST NOT SHIP INDEPENDENTLY.** The source branch is based on the still-unmerged P1.3 security research PR #321, *not* production main. The centered Profile UX is separately unmerged PR #320. No live SQL, RLS, grants, secrets, map behavior or gameplay effects have been modified.

## GM product decisions preserved

An NPC interaction opens its Profile first anywhere in DNDNext; the `/npcs` page remains GM management. The GM may curate player-visible lore and independently publish selected clues. **GM Secrets** remain GM-only, never automatically available to a controller, inventory user, co-editor or creator. **Player-authored private backstory** belongs only to the verified original creator, while that creator retains active `can_edit`, and the GM. Another fully authorized sheet editor must not read it. Existing 7 legacy `characters.secret` values are not migrated or modified.

## Staged frontend changes

- `components/NpcPanel.js`: replaces general raw `characters` lore query and legacy `loadCharacterSecrets` with `get_npc_profile_visible_v1(uuid)` for ordinary users and the independently authorized `get_npc_dossier_admin_v1(uuid)` for GM. No unsafe fallback. Only GM / an explicitly authorized `can_edit` sheet viewer requests the canonical sheet, and the **database RLS** still makes the final decision. Player-visible lore is derived only from the allowlisted `lore` JSON returned by the safe RPC; `profileReveal.secret` no longer toggles legacy GM Secret publication. Shop, Inventory, CharacterSheetPanel and Profile tabs keep their existing handlers.
- `pages/npcs.js`: basic NPC/merchant roster does not bulk-fetch private lore or all GM secrets. The selected Admin character's full narrative/legacy GM Secret comes via `get_npc_dossier_admin_v1`. Existing GM notes and sheet editor stay separate. The old `set_character_secret_v1` is only invoked by the Admin save action, never by an ordinary character editor. This preserves the distinct NPC management screen without rewriting map/town movement logic.
- `components/CreatorBackstoryPanel.js`: a separate small editor appears only if the current authenticated user is authorized by `can_edit_creator_backstory_v1`. It reads and writes **only** `character_backstory_secrets`, with unchanged table RLS rechecking every request; it neither receives nor writes `characters.secret`. A co-editor cannot claim provenance or view the creator's content through this component.
- SQL stage-three research adds only a narrow authenticated **permission status** RPC. No user-supplied creator IDs. It is not installed anywhere live.

## Release blocks and required acceptance

1. **Coordinated release only:** source-referenced stage-one sheet RLS + safe public Profile, stage-two GM dossier and private-lore column permissions, stage-three creator/GM backstory storage, original secret RPC restriction and canonical creator-insert trigger must be reviewed as **one migration sequence**. A frontend build cannot certify a partial API rollout.
2. **Original Forge parity:** prior PG17 V19–V23 genuinely exercised an authenticated **reduced creation wrapper** at the common character INSERT, not the actual `create_character_v1` / `create_player_character_v1/v2/v3`. Exact original creation, Admin NPC notice, starting inventory, class options, spell choices and rollback/retry require full source regression, including global CP/CS/G/I lock order.
3. **Admin/consumer parity:** legacy charactersDb helper, player Profile fallback, class/spellbook features, Forge secret payload routing, other SECURITY DEFINER serializers and arbitrary GM-private content nested inside full `sheet` JSON remain unreviewed or only partially reviewed. **GM-only note audiences and curated clue editing UI** need explicit tests. This draft's selected Admin dossier and creator-only editor are only part of the full migration.
4. **Browser tests still needed:** NPC/merchant Profile-first from map and town, wide centered overlay when combined with PR #320, Shop↔Profile, inventory links, Admin NPC permissions/GM notes, legitimate creator backstory save and co-editor denial, GM curated clue publish/withdraw, responsive scroll, keyboard focus and z-index. No browser UI test is claimed.
5. **Rollback and owner approval:** none of the SQL is a numbered production migration, none is deployed, and no existing secret is copied or deleted. Do not alter live data or production grants, merge, or deploy until accepted and tested with both signed-in GM and player.

## CI

The stacked PR runs a new static reader/privilege surface guard, existing CharacterInteraction/map/town UI regressions, and a real Next.js build. The separate inherited P1.3 local GoTrue workflow tests the additional creator-only permission RPC against GM/creator/co-editor/outsider/anon. The old negative baselines remain expected and are not described as fixed in production.
