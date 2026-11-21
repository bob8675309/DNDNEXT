# C34 — NPC interaction tiers, inventory permissions, and encounter-only control

**Core interaction tiers and item-consent behavior OWNER-AGREED as a design direction; detailed grant scope and runtime migration still require review. NOT a migration or gameplay change.** Prepared November 21, 2026 on held draft #379 while working on B14-P2–P5 inventory and future NPC quest item send/request. No deployed SQL, page, encounter, world map, merge, or paid-agent change.

## Product intent from owner

Players should interact with an NPC at different trust levels:

1. Ordinary acquaintance/shopkeeper: inspect *public profile*, talk and shop through merchant **stock**, but **not** read NPC's private backpack or modify their equipment. A skill-based theft/pickpocket action is a separate contested action, **never** inventory read permission.
2. Hired henchman/sidekick: player commands this NPC in combat, sees gear and backpack read-only, but cannot equip/unequip, pilfer, transfer out or edit character data merely by hiring.
3. Trusted or allied NPC: the GM or an authoritative approved story/event can expand selected inventory/gear management permissions; relations can improve or worsen.
4. Fully delegated companion: player can manage NPC gameplay inventory/equipment and item sends within owner-validated allowances. This **still does not** disclose GM-only secrets, unpublished creator Story, arbitrary personal data, or blanket admin/write access.
5. Temporary forced control (e.g. *Dominate Person*): authority exists **only on the relevant encounter participant** during the valid effect. It must not implicitly grant NPC's backpack, shop stock, currency, secrets, long-term equipment movement or persistent character permission. Revert cleanly when the effect ends.

**Existing owner transfer choice remains:** No player-character→other player-character on one account. Player may donate existing character-owned gear to explicitly controlled NPC henchman/sidekick under independently tested P4 transfer; other-player/trade systems remain. The future NPC quest system will use item sends *and* item requests; an NPC request is not an inventory transfer and must be settled by server.

## Proposed UX tiers: templates only, not authority bits

| UI preset | Profile/dialogue and storefront | Visible worn gear | Backpack (read-only) | Tactical control | Equip/unequip | Remove/transfer NPC-owned items | Sheet edits |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 Acquaintance / shopkeeper | Yes, public/stock only | Public visual cues only | No | No | No | No | No |
| 1 Hired combat companion | Yes | Yes | Yes | Yes | No | No | No |
| 2 Trusted ally | Yes | Yes | Yes | Yes, if assigned | GM-toggleable | **No by default** | No |
| 3 Fully delegated companion | Yes | Yes | Yes | Yes | Yes | Yes, if explicitly granted | Separate explicit grant |
| Temporary spell/controller overlay | Public baseline only | Combat-visible only | No new right | While valid effect | No | No | No |

A tier is a convenience **preset for the GM UI**, not the security decision or permanent integer on a character. Permit overrides: a noncombat quartermaster might be allowed to manage equipment but not fight; a combat-dominated enemy has only command access; a hired NPC can expose possessions read-only without transfer rights. **Disposition** (hostile/neutral/hired/friendly/loyal, loyalty score or quest relationship) is narrative state and must not automatically equal an access grant. The NPC should retain control of its own property absent an explicitly permitted transfer.

## Proposed capability vocabulary (server-authorized)

- **Perception/presentation:** `view_public_profile`, `talk`, `browse_storefront` (separate from personal backpack), `view_worn_equipment`, `view_backpack`, `view_tactical_actions`.
- **Combat:** `issue_encounter_commands` (per participant, one turn budget), `see_available_combat_spells` (currently known/usable subset, not private unprepared spells), optionally `manage_combat_resources` as allowed by tactical engine. Do not give player access to arbitrary creature Sheet just to take a turn.
- **Inventory actions:** `send_item_to_npc`, `reorder_or_equip_gear`, `withdraw_npc_item`, `dispose_or_sell_npc_item`, `grant_inventory_item` are **distinct**. Being allowed to GIVE an item must not imply the ability to TAKE one. Viewing backpack does not authorize taking. Trust tier 2 can enable outfit changes without allowing removal to another owner.
- **Character authorship:** `edit_character_sheet`, `convert_character`, `edit_story` and GM-private/creator-secret visibility are separate. A full gameplay companion is **not** automatically a creator/GM.
- **Quest:** `offer_item`, `request_item`, `respond_to_item_request` become future context-bound actions; no automatic accepting, item minting, quest completion or reward issuance.

Return server-filtered booleans/actions in one authorized `get_npc_interaction_context`-style projection plus redacted visible data. **Do not** infer backend permissions from visible UI buttons, NPC role/tag, apparent friendliness or client-supplied effect IDs. Separate public data, merchant `character_stock`, visible equipped item summary and private `inventory_items` queries/response redaction. Exact source row access must be checked on every mutation.

## Grants and time-limited effects — two sources, one resolver

**Permanent or campaign-duration grant:** for a specified `character_id`, `grantee_user_id` (and future explicitly scoped group if approved), `capability`, `source_type` (`gm`, `hire_contract`, `quest_reward`, `npc_consent`), `source_id`, `granted_by`, `starts_at`, `expires_at`, `revoked_at`, optional context restriction. A GM-approved tier assignment applies multiple explicit capabilities transactionally. Every change is auditable; user-editable JWT metadata cannot grant authority. Contract end, death/dismissal or GM revoke invalidates the grant without changing player account.
  
**Encounter-only control effect:** tie a control override to `encounter_id`, `participant_id`, `controller_user_id`, `source_participant_id` or spell effect, priority, `starts_at`, rule-specific expiry/validity. Grant *only* `issue_encounter_commands` with constraints while the spell remains in force. Derive it from authoritative encounter condition/effect/turn state, never by persisting a permanent `character_permissions.can_control=true`. Preserve original controller for restoration; handle competing charm/command effects and GM override deterministically. Individual spell saves, concentration, command restrictions, immunity, expiry and turn rules are edition/spell-specific and require separate rule/effect acceptance. Prevent cached authorized results from remaining visible after revocation. Two controllers may be authorized for a hireling but one authoritative action/slot ledger applies; a dominating controller overrides only under the spell's actual precedence.

**Policy resolution:** server `effectiveCapabilities(actorUserId, npcCharacterId, encounterId?, actionContext?)` checks authenticated identity, admin role, hidden NPC/Forge `player-character` taxonomy, persistent grants/current relationship contract, valid encounter-only effects, scope and revocation, and action-specific constraints. For multi-source grants use additive positive grants but enforce global never-actions (e.g. same-account PC destination) and effect-specific restrictions before granting. Avoid relying on a single `tier >= N` rule. Lock current permission/effect rows before mutation; fixed lock ordering, fresh authorization before request-replay cache, and concurrency tests are mandatory.

## Sleight of Hand / unauthorized pilfering

Model as a **server-resolved attempted action**, not a grant to `view_backpack` or a direct `inventory_items` SELECT. The player should not see the NPC's entire backpack simply to choose an unknown hidden object. Rules may let them target a visible pouch, known item or random discoverable object; outcomes (find nothing, success, noticed/hostile, item transfer) are determined by GM/adjudication or authorized skill contest. Successful theft performs one audited item transfer and inventory mutation only after validation of reach, awareness, skill result, source item and destination. The victim may remain unaware (narrative state), but the database never exposes secret rows in advance. Future quest/story consequences are separate event consumers. This is a design choice, not proof of current skill mechanics.

## Source-verified engineering constraints

- Read-only production `public.character_permissions` currently has `can_inventory`, `can_edit`, `can_convert` (no `can_control`). Held draft PR312 `sql/candidates/20261101_npc_delegated_control_candidate.sql` adds combat-only `can_control`, independently from `can_edit`; this source is not yet production SQL. Its `admin_set_npc_control_v1` checks `kind` without excluding `player-character`-tagged Forge PCs; needs repair in its **own approved integration**, not a clandestine patch. Preserves original NPC spellbook v1/v2 restricted known/available-spell view for delegated controllers and one action budget.
- Original `private.can_access_character_v1(...,'inventory')` allows `can_inventory OR can_edit`, not view-only. Source `components/NpcPanel.js` explicitly sets **`canView=canManage=can_inventory||can_edit`**. Current equipment panel then sets `canTransfer=canManage||isAdmin`. **This is a specific incompatible seam**: a hired controller must be able to read backpack but not manage/transfer. Requires careful RPC/RLS projection changes, not just hiding buttons.
- Current shared `CharacterInteractionPanel` exposes Profile/Sheet/Inventory/Spells/Shop tabs. Keep profile-first behavior, separate character shop stock vs private inventory, creator secrets and private GM narration. PR345 source has signed privacy tests for NPC Sheet/Story/Inventory. Don't expose secrets to a controller, friend or dominated enemy.
- Live `encounter_participants.controller_user_id` exists, and `encounter_conditions`, `encounter_timed_effects` with source participant and duration metadata exist (RLS). The original control RPC authorizes controller user or `can_edit` and the broad `is_admin(uid)`; proposed PR312 adds `can_control`. Use an **encounter-level authority resolver** for spell grants, do not rewrite `controller_user_id` or give `can_inventory` from a charm. Tactical command replay and multi-controller lock race contracts in #312/#317 must remain intact.
- Signed B14-P4 disposable real GoTrue/PG17 tests `bedf62272ff7ba604ff38b97f70cd0c83735bc8f` / Actions #44939531819 PASS **character-owned gear → controlled henchmen donation without NPC inventory read**. Owner's **new hired companion UX** adds readonly backpack visibility; this is *not* implemented by P4 and will need its own signed privacy tests. Future P5 item requests are pure DTO research, not a quest runtime.
- `public.character_stock` is merchant stock, different from `public.inventory_items`. Ordinary dialogue/shopping must never expose the merchant's backpack. Original historical direct inventory transfer and UI fallback exist; no production security fix has occurred.

## When to implement

**NOW (during current B14 inventory authorization research):** settle capability vocabulary, permission-tier presets, two independent visibility scopes (worn gear and backpack), source taxonomy/tag rules, command vs item action matrix and test-driven interface contract. Keep edits **docs/test candidate only** until all source-preservation and owner decisions accepted. Extend the versioned one-RPC context to produce read-only vs manage vs take vs give permissions **with genuine signed tests** before integrating the inventory page. This avoids a painful permission migration just after inventory cutover.

**NEXT (narrow authorization integration, only with owner-go):** implement audited GM grant/revoke & read-only NPC inventory projection + permissioned equipment actions, reconcile held PR312 and PR318 admin panels and PR345 profile/privacy source. Stage actual browser hired/trusted/owner/GM/outsider signed tests. Introduce revocable timed hire contracts as needed.

**LATER (separate tactical/quest feature work):** spell effect→temporary controller adapter linked to actual spell engine and per-encounter replay authorization; faction affinity/loyalty relationship rules; Sleight of Hand theft adjudication; NPC quest item request/consent/reward settlement. Don't block current inventory security acceptance on full NPC AI or Dominate Person implementation.

## Decisions to confirm before final schema/API design

1. **Hired NPC backpack read-only:** is the full contents list visible immediately upon hire, or only observed/declared possessions? Current user prompt suggests full read-only, pending final design confirmation.
2. **GM-controlled grant scope:** should hire/friend/loyalty be granted per player *account*, per player *character*, or per party? A user's account may own several Forge PCs; should not accidentally inherit companion rights across them.
3. **Full-companion transfer rights:** can a full companion's personal items be withdrawn freely, or must certain NPC-owned/quest/attuned items remain protected? Source gear, equipped items and quest items may need restrictions.
4. **Dominated enemies:** should temporary control allow commands to spend consumables already equipped/carried during tactical resolution (if permitted by spell), without ever providing long-term item extraction? Strongly recommend YES within authoritative spell command constraints; NO to persistent ownership transfer.

No decision above justifies production SQL, protected map changes, merge, deploy, or authorizing background agents.
