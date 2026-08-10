# PR #170 Browser Smoke Corrections — Status

Status date: 2026-08-10
PR: #170 (`agent/character-forge-resilience-presentation`)
Status: implementation and migration 90 deployed/rollback-accepted; user re-smoke required before treating the corrected presentation as accepted.

## Source of this pass

A real signed-in browser smoke exposed concrete issues in the player sheet and Player Character Forge:

- XPHB Barbarian Rage was not restored by the standalone sheet Rest RPC;
- Deep Gnome Gift of the Svirfneblin could leave a meaningless INT/WIS/CHA prompt before the first level-gated spell grant;
- Strixhaven/Witherbloom presentation contained non-mechanical spell-flavor text and weak secondary-text contrast;
- background expanded-spell names did not expose spell descriptions;
- long Class feature option lists could open but ancestor click handling made them difficult/impossible to collapse;
- the Class feature detail dock did not remain useful through a very tall guide;
- Species Bonus feat selection was being mixed with feat-owned nested decisions on Abilities;
- same-name subclass reprints could appear more than once;
- Artificer Magic Item Plan availability and wildcard item detail needed clearer player-facing presentation.

These observations are real browser evidence for the pre-fix build. They are not evidence that the corrected build has already passed a second browser smoke.

## Migration 90 — Rage rest restoration

`sql/20260810_90_rest_class_feature_restoration.sql` extends the existing standalone sheet Rest RPC without changing encounter/tactical behavior.

`private.restore_character_rest_action_state_v1(uuid,text)` currently handles the source-backed class action state that the sheet actually persists: Barbarian Rage.

Accepted semantics:

- XPHB Barbarian Short Rest: regain one expended Rage use, capped at the current maximum;
- XPHB Barbarian Long Rest: regain all expended Rage uses;
- PHB Barbarian Short Rest: no Rage-use restoration;
- PHB Barbarian Long Rest: regain all expended Rage uses;
- a rest ends the sheet-side active Rage state;
- `complete_character_rest_v1` returns the updated character sheet and reports `restoredClassFeatureUses`;
- the existing rest-log active-encounter insert guard remains in the transaction, so a prohibited rest rolls the whole operation back atomically.

The migration does not mutate encounter participants, tactical resources, map state, routes, travel, or weather.

### Deployed proof

Migration 90 is registered live as `rest_class_feature_restoration` (`20260810205646`).

Rollback-only tests against the deployed functions proved:

- XPHB 1/3 + Short Rest -> 2/3, restored 1, Rage inactive;
- another XPHB Short Rest -> 3/3, restored 1;
- XPHB Short Rest at maximum -> remains 3/3, restored 0;
- XPHB 1/3 + Long Rest -> 3/3, restored 2;
- PHB 1/3 + Short Rest -> remains 1/3, restored 0;
- PHB 1/3 + Long Rest -> 3/3, restored 2;
- the authenticated owner-facing public Rest RPC from a 2/3 XPHB state returned `restoredClassFeatureUses=1` and an updated sheet containing 3/3 Rage.

All fixtures rolled back. Varges was not directly repaired by QA; his real production sheet remains at the user-observed 2/3 until the player performs another normal qualifying rest.

### ACL

- anon execute on `public.complete_character_rest_v1(uuid,text)` — false;
- authenticated/service_role execute on the public Rest RPC — true;
- anon/authenticated execute on the private Rage restoration helper — false;
- service_role execute on the private helper — true.

## Forge corrections

### Deep Gnome

A Deep Gnome Gift of the Svirfneblin source group is suppressed when the generic parser has no active spell grant and would otherwise leave only a casting-ability field. At actual spell-grant levels, the spell-routed source group remains and the established automatic best-eligible casting-ability policy applies.

### Witherbloom / background presentation

For SCC background feature display only, the non-mechanical trailing spell-customization flavor paragraph is removed. Imported source data is not rewritten.

The expanded spell list now resolves shown spell names against `spells_catalog` and exposes source-backed description/casting/range/duration help on hover or keyboard focus.

Player Forge secondary rules/help text was raised to a substantially brighter contrast while preserving visual hierarchy.

### Class guide disclosure and sticky detail rail

Nested long-list `<details>` disclosures stop click/key propagation so opening or closing the list does not trigger the ancestor feature-card click path.

The Player Forge Class workspace is stretched through the tall guide and the Class feature dock is sticky within the desktop layout. Responsive layouts restore normal static placement.

### Species Bonus feat routing

Abilities owns the Species Bonus package selection itself. When the player chooses the feat package, Abilities acknowledges the selected feat and tells the player that feat-owned follow-up choices are completed in **Training → Feats & Class Abilities**.

Spell-centric feat decisions still route to Spells where appropriate.

### Subclass deduplication

Same normalized subclass names produce one player-facing option.

The compatibility rule is deliberately two-stage:

1. a complete definition beats a newer but incomplete placeholder;
2. when both same-name definitions are usable/complete, the newest known publication source wins.

This preserves the existing progression guard against losing a complete supplemental subclass merely because a later-source placeholder row exists.

### Artificer Magic Item Plans

The EFA Artificer catalogue currently contains 56 normalized plans. The Forge keeps server-backed level eligibility intact and now shows:

- how many of the full catalogue are available at the selected starting Artificer level;
- later plan unlocks grouped by Artificer level as informational progression planning;
- future plans remain non-selectable until their minimum level is actually met;
- wildcard plans retain their canonical `items_catalog` eligibility filters;
- wildcard item detail prefers the full canonical item description and shows rarity/type/attunement where present;
- the rich choice view displays the size of the current canonical legal item pool.

Live catalogue distribution at this checkpoint is 16 plans available from Artificer 2, 22 additional plans at 6, 11 additional plans at 10, and 7 additional plans at 14. The current canonical wildcard pools remain 105 Common, 173 Uncommon Wondrous, and 200 Rare Wondrous eligible items.

## Repository gates

Code head `98b55355ed92d3d3309c09b8c534095d13859089` completed **32/32 PR-triggered GitHub workflows successfully** and Vercel reported success before migration 90 deployment.

The dedicated smoke validator covers migration markers, Deep Gnome suppression, Species Bonus feat routing, same-name subclass reprint behavior, Artificer future-plan non-selectability, sticky/contrast/hover presentation markers, and the protected-map boundary.

## Production integrity after deployed rollback acceptance

- characters: 7
- character_sheets: 7
- character_spells: 30
- character_progression: 7
- inventory_items: 18
- character_rest_log: 2 legitimate user rest rows
- Varges Rage: 2/3 (unchanged by QA)
- locations: 20
- map_routes: 4
- map_route_points: 9

The two rest rows are real user actions from browser smoke and are intentionally retained. Rollback QA added no persistent rest rows.

## Re-smoke targets

The corrected build still needs user confirmation for:

- Varges normal Long Rest from a spent Rage state restores to maximum; XPHB Short Rest restores one spent Rage;
- Deep Gnome level 1 no longer asks for a meaningless spellcasting ability, while level-gated magic still resolves correctly at levels 3/5;
- Witherbloom flavor cleanup, higher contrast, and spell description hover/focus;
- long Class option lists open and close normally;
- the Class feature detail dock remains available while scrolling a tall guide;
- Species Bonus feat is acknowledged on Abilities while feat-owned decisions resolve later;
- duplicate same-name subclasses are gone and the best/newest complete definition is retained;
- Artificer plans show current availability, later unlocks, and canonical item detail without unlocking future plans early.

## Protected boundaries

This pass does not authorize or modify `components/MapPageClient.js`, world-map behavior, town/city-map behavior, routes/travel/weather, unrelated crafting execution, or tactical combat execution.
