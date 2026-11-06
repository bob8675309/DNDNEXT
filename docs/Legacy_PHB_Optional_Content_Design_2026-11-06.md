# Legacy PHB optional campaign content — research design, not deployed

**Owner decision (November 6, 2026):** make original 2014 `PHB` options toggle-able like the existing **Future weapons & armor** Admin campaign switch. Keep **2024 `XPHB` first by default**.

## Existing precedent and boundaries

The Admin page currently reads `campaign_item_pool_settings.future_tech_enabled` and writes through `set_campaign_future_tech_enabled_v1`, whose item-pool effect may reroll merchant storefronts. This is a good control/UI pattern but **not a reusable rule or table for class choices**. No merchant reroll should be coupled to subclass visibility.

## Proposed future server-owned setting

Add an independently versioned Admin-only campaign-content flag (`legacy_phb_enabled`, default false) to an appropriate settings surface after source/callsite audit. Players may read effective availability but not change it; enforce it in canonical selection/RPC validation, not just visual filtering. No backfill or release is part of this research decision.

- **Off (default):** do not offer legacy-only PHB options for new selection where a reviewed 2024-first rule applies. Preserve existing characters, earned feats/spells and PHB-granted abilities; never delete or silently convert historical records.
- **On:** visibly label and permit source-qualified PHB choices where compatible. Explicitly differentiate PHB from XPHB when edition reprints exist, and retain source identity in sheet/progression/grants.
- **Scope:** inspect class, subclass, feature, feat, background, spell and other source-referencing Forge, level-up and rules consumers before implementing 'all PHB options'. Source toggling must not turn off non-PHB third-party content unexpectedly.
- **Safety:** Admin read/write policies and default false; server-side enforcement for browser, RPC and imported/legacy sheets; subscription/cache refresh; no retroactive character mutation; revision and rollback plan.
- **Acceptance:** authenticated Admin/player/outsider toggling, existing PHB characters retained when off, same-name Champion XPHB/PHB, missing source request behavior, immutable replay and grants, level advancement, actual browser UX.

## Observed source-selection concern

The unchanged deployed handler `private.apply_character_forge_subclass_choice_v1()` (MD5 `273be29420a7274d997642e302604cb7`) selected **PHB Champion** for a source-omitted XPHB Fighter level-3 sheet in an isolated signed-in fixture at J151; explicitly requested XPHB worked. See [accepted research run](https://github.com/bob8675309/DNDNEXT/actions/runs/42223567299). The normal Forge UI currently serializes both subclass name and source, but raw RPC requests can omit the latter. This is a bounded research observation, not proof every live call selects PHB.

**Implementation decision:** postpone the global switch until source/callsite audit and a separate approved review branch; keep existing mechanics unchanged and preserve verified Forge J00–J153 coverage. This plan does NOT claim a migration, Admin toggle, or production release exists.
