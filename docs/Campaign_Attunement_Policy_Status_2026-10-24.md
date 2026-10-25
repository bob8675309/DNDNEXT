# Campaign Attunement Policy — Staged Implementation Status (2026-10-24)

**Status: DRAFT, NOT DEPLOYED.** The repository's new campaign setting and character-item attunement storage are staged for isolated tests. **Do not merge/deploy or advertise full D&D rules as active yet.**

## User-approved behavior
- On the Admin Dashboard, next to **Future weapons & armor**, provide an independent **Attunement capacity** switch:
  - **Standard D&D** (default): at most **three** attuned magic items per character.
  - **Unlimited**: remove the number cap, **not** equipment placement restrictions.
- One head/helm, one pair of boots, one armor/body slot, other existing equipped slots keep all their rules. Attuning a carried magic item never auto-equips it. Equipping an item never auto-attunes it.
- Standard D&D also requires a Short Rest with the item, one copy of the same magic item per creature, item-specific prerequisites, and ending attunement conditions. Artificer class features may increase the normal capacity. The switch is intended to change **only** the cap.

## Source-to-state authority and current implementation
- Campaign config is stored in `campaign_item_pool_settings.unlimited_attunement_enabled` and updated only by `set_campaign_unlimited_attunement_v1` after admin validation. Its RPC does **not** reroll merchants; that is exclusive to future-tech settings.
- Bonds are stored by `character_item_attunements(character_id, inventory_item_id)`, not a global `inventory_items.is_attuned` flag: player-owned inventory may belong to the player account, with multiple characters sharing that owner ID. Each item may have only one bond.
- `private.item_requires_attunement_v1` merges canonical catalogue payload and item-instance overrides and detects structured `reqAttune`, `reqAttuneTags`, `attunement`; **source prose is never executable authority**.
- `get_character_attunement_items_v1` returns authorized character-specific candidates, count and cap. `set_character_item_attunement_v1` checks inventory permission, actual character/item ownership, valid attunement source, duplicates, 3-limit, and concurrency. Owner transfers automatically end previous bonds. Downshifting to Standard is rejected if any character has >3 bonds; users must voluntarily end extras.
- `CharacterAttunementPanel` is a compact, non-printing subpanel above the original paper-style sheet, using existing card styling. `pages/admin.js` keeps the future-tech switch working even if the new migration is not present.

## Mandatory unresolved release gates (must NOT be marked complete by green isolated tests)
1. **Actual attunement gameplay eligibility:** connect the standard Short Rest timing (one item per Short Rest), source/class restrictions, curse/end-of-bond behavior, and class-based exceptions such as Artificer 4/5/6 capacity at feature levels. The initial backend enforces default three/unlimited and owner/duplicate guards, **not** those additional prerequisites. The UI explicitly identifies rest as a required rule, but cannot enforce it yet.
2. **Consumer gating:** existing authoritative equipment numeric stats, tactical weapon, damage mitigation, spell/DC, and derived sheet display do not yet uniformly require item bonds where rules require attunement. An equipment-only item must still give its **mundane** AC/damage if not attuned, but *magic* bonuses and powers must be gated; avoid incorrectly dropping an equipped shield's mundane AC.
3. **Equipment-slot truth:** review existing inventory direct updates and `set_character_inventory_equipment_v1` separately. Neither this migration nor this toggle changes `is_equipped`/`equip_slot`. Backend slot exclusivity must remain authoritative and must not be mistaken for the attunement cap.
4. **Player multi-character handoff:** verify that `character_permissions.can_edit` and the character-to-player inventory association remain correct for multiclass/alternate characters and item transfers; item may be attuned to one character only.
5. **Live compatibility and presentation:** existing equipped items do not receive invented retroactive bonds, and no existing magic effect is silently disabled by this migration. UX mockup/acceptance should use the actual CharacterSheetPanel, NPC/Profile presentation, and the original Forge styling. The sheet must remain printable.
6. **Regressions:** isolated Postgres migration fixture, ACL denial, duplicate item, three vs unlimited, downgrade, transfer, status reads, concurrent writes, source override and no equip-slot changes; then side-by-side production-shaped behavior checks before deployment.
7. **Publication:** exact-head PR checks, migration review, live ACL/database compare and GM review. A passing isolated test is necessary but not sufficient for release.

## Run and review
`node scripts/validate_campaign_attunement_policy.mjs` checks documented source seams. The GitHub workflow `Validate Campaign Attunement Policy` runs that validator and an **isolated PostgreSQL 16** fixture. Neither touches DnDWeb production.

Source references: `sql/20261024_02_campaign_attunement_policy.sql`, `components/CharacterAttunementPanel.js`, `components/CharacterSheetPanel.js`, `pages/admin.js`, `scripts/fixtures/campaign_attunement_policy_behavior.sql`.

Existing draft stack unaffected: #250 (Physical Specimen) independent; #251 Common Effects → #253 actual equipment SQL parity → #255 genuine catalogue test data. #249, #252, #254, #256 documentation/audits were merged to main. This attunement feature branch must remain a **separate draft PR** until complete eligibility/consumer tests and owner acceptance.
