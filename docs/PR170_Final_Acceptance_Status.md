# PR #170 Final Acceptance — Current Status

Status date: 2026-08-11/12
PR: #170 (`agent/character-forge-resilience-presentation`)
Status: **open and unmerged**.
Validated code head: `d2b64bd1128a0457393283a463fddd71cc7c9094`
Live database authority: `20260812042950 aven_subrace_catalog` (migration 93)

## Current acceptance checkpoint

PR #170 has progressed beyond the earlier migration-90 browser-correction checkpoint. Production is now registered through migrations 91-93 for the current Species source/presentation slice:

- 91 — `20260811062025 genasi_subrace_catalog`;
- 92 — `20260812033649 genasi_source_detail_restore`;
- 93 — `20260812042950 aven_subrace_catalog`.

Earlier runtime/progression migrations and their accepted lifecycle behavior remain authoritative for their respective systems; this continuation did not rewrite them.

## Exact-head repository gate

For exact code head `d2b64bd1128a0457393283a463fddd71cc7c9094`:

- **33/33 PR-triggered GitHub workflows completed successfully**;
- `Validate Forge source presentation` passed the existing structured-source validator, established Genasi/Dragonborn family validator, expanded Species-family validator, and production build gate;
- `Validate PR170 browser smoke corrections` passed its contract and production build;
- NPC Forge foundation, Character Forge nested choices, Player Forge source magic, starting equipment/magic, progression, runtime choices, portrait, currency, Artificer, and related regression gates all passed.

This exact code head is the runtime/source acceptance checkpoint. Later documentation-only commits do not supersede it.

## Species family / source acceptance

The current Forge Species presentation supports:

- Genasi parent with Air/Earth/Fire/Water Elemental Lineage;
- Dragonborn parent with ten XPHB ancestries plus five explicitly FTD Gem ancestries;
- Aven parent with restored Hawk-Headed/Ibis-Headed PSA subrace choices;
- XPHB Elf Drow/High Elf/Wood Elf lineage choices;
- XPHB Gnome Forest/Rock lineage choices;
- MPMM Shifter Beasthide/Longtooth/Swiftstride/Wildhunt choices;
- LFL Fairy Lorwyn/Shadowmoor lineage choices;
- LFL Kithkin Lorwyn/Shadowmoor lineage choices.

The implementation reuses existing source-choice keys/state rather than creating a second character-creation authority.

Setting/source variants are visually nested but remain their own real Species rows and keep their own ID/source/rules/save identity:

- Human (Innistrad/Ixalan/Kaladesh/Zendikar);
- Dwarf (Kaladesh);
- Elf (Kaladesh/Zendikar);
- Orc (Ixalan);
- Minotaur (Amonkhet);
- Goblin (Dankwood).

This distinction prevents older/setting variants from inheriting unrelated 2024 parent choices.

Goliath Giant Ancestry and Tiefling Fiendish Legacy remain inline. Distinct Species such as Sea Elf, Astral Elf, Eladrin, Shadar-kai, Duergar, and Deep Gnome remain independent.

## Migration 93 acceptance

Migration 93 restores the two missing PSA Aven source-derived subrace rows:

- `species:aven-hawk-headed|PSA`;
- `species:aven-ibis-headed|PSA`.

The migration was transaction-tested with an explicit rollback before deployment. After live deployment, both rows were verified with the expected `restored-after-5etools-review` source-audit metadata.

## Current production integrity

After migration 93:

- raw Species catalogue: 166;
- preferred Species view: 102;
- characters: 7;
- character_sheets: 7;
- character_spells: 30;
- character_progression: 7;
- inventory_items: 18;
- locations: 20;
- map_routes: 4;
- map_route_points: 9.

The two intended Aven catalogue rows are the only count changes from the pre-migration-93 baseline. Campaign/runtime/map counts remain unchanged.

## Browser acceptance status

The previous real signed-in browser smoke remains valid evidence for the areas it exercised, but the newly expanded Species family presentation still needs a focused browser re-smoke before final merge acceptance.

Recommended re-smoke:

- Genasi and Dragonborn regression check;
- Aven Hawk/Ibis;
- Elf Drow/High/Wood including sibling spellcasting-ability choice;
- Gnome Forest/Rock;
- Shifter four forms;
- Fairy/Kithkin Lorwyn/Shadowmoor;
- Human setting children and representative Dwarf/Elf/Orc/Minotaur/Goblin setting children;
- verify distinct Species remain top-level;
- verify Goliath/Tiefling remain inline;
- continue remaining Background/Class visual QA as needed.

## Merge rule

Do not merge PR #170 without explicit user approval. Immediately before any approved merge, re-check the exact PR head, current CI/deployment status, live migration list, relevant ACLs, and production residue.

## Protected boundaries

No work in this acceptance slice authorizes changes to `components/MapPageClient.js`, world-map behavior, town/city-map behavior, route/travel/weather, unrelated crafting/inventory execution, or tactical combat execution.
