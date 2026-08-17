# Character Forge Background Audit

Status: formatting/readability pass on PR #175 (`agent/background-source-choice-polish`).

Scope: all 75 preferred Backgrounds currently exposed by `character_option_catalog_preferred`. This pass is intentionally about **correct structure, choice ownership, readable source rules, and wasted-space reduction**. A later pass can add more visual identity/art/presence after the layout is browser-approved.

## Formatting rules applied to the entire catalogue

- Background story is a compact hero/intro rather than another large rule box.
- Skills, tools, languages, and Origin feat are summarized in a two-column **Background Grants** grid.
- Fixed grants no longer consume a full-width row merely to display one word such as `Giant`.
- Tool details remain available behind a small disclosure so practical uses/crafting information is preserved without occupying the page by default.
- Only the selected Origin feat is expanded. Large choice pools use a compact selector instead of rendering every feat description at once.
- Raw source prerequisite objects are never printed in the player Background dossier.
- Player-facing routing says where a decision is completed; internal text such as `Forge routing.` is not shown.
- Grant-only Background feature rows that merely repeat the Origin feat are suppressed when the Origin feat already has its own card.
- Dense feat source entries are reconstructed as named sections and tables rather than flattened into a single wall of text.
- Background spell lists remain collapsible and spell names keep hover/focus help.
- `Building a … Character`, Suggested Characteristics, and orphaned optional random-table lead-ins remain excluded from the Forge.

## One-by-one catalogue review

| Background | Source | Audit result / formatting treatment |
|---|---|---|
| Acolyte | XPHB | Compact 2024 grant layout. Magic Initiate remains fixed to **Cleric** and its spell choices route to Spells. |
| Anthropologist | ToA | Adept Linguist remains a collapsible feature. Cultural Chameleon source detail is kept compact; Suggested Characteristics remain suppressed. |
| Artisan | XPHB | Compact 2024 grant layout. Artisan tool choice stays in Background; Crafter proficiency choices route to Training. |
| Astral Drifter | AAG | Divine Contact stays collapsible. Short Longevity note is retained as a small supplemental feature rather than promoted to a large panel. |
| Athlete | MOT | Echoes of Victory stays as the mechanical feature. Favored Event random-table prose remains pruned from the creator. |
| Carouser | ABH | Tireless Reveler is presented as the single selected feat detail rather than a full-page prose block. |
| Charlatan | XPHB | Skills/tool stay compact. Skilled no longer shows three Background dropdowns; its three proficiency choices route to Training with player-facing copy. |
| City Watch | SCAG | Watcher's Eye is a collapsed feature beneath the compact grants grid. |
| Clan Crafter | SCAG | Fixed Dwarvish and variable language/tool grants are compact. Tool detail explains practical use. DnDNext Craft Expertise remains clearly labeled as a campaign rule. |
| Cloistered Scholar | SCAG | Library Access remains available as one collapsed feature; no empty filler panels. |
| Courtier | SCAG | Court Functionary remains a single collapsed feature beneath compact grants. |
| Criminal | XPHB | Compact 2024 grant layout; Alert detail is collapsed until requested. |
| Custom Background | PHB | Two arbitrary skill choices continue to route to Training. Legacy mixed language/tool customization and arbitrary feature borrowing remain a known compatibility edge, not falsely marked complete. |
| Entertainer | XPHB | Musical Instrument grant remains compact; Musician's three instrument choices route to Training. |
| Faceless | BGDIA | Dual Personalities remains the mechanical feature. Faceless Persona is retained as supporting source detail in a collapsed section rather than always-open prose. |
| Faction Agent | SCAG | Safe Haven remains one collapsed feature; core grants remain compact. |
| Failed Merchant | AI | Supply Chain stays as one collapsed feature; source story and grants no longer create repeated full-width rows. |
| Far Traveler | SCAG | All Eyes on You remains the feature. `Why Are You Here?` stays secondary/collapsed instead of competing with required choices. |
| Farmer | XPHB | Compact 2024 grant layout; Tough detail stays collapsed. |
| Feylost | WBtW | Feywild Connection remains the feature. Fey Mark/Feywild Visitor source material stays secondary; Character Traits are not dumped into the creator. |
| Fisher | GoS | Harvest the Water remains the feature. Fishing Tale optional table material remains pruned from the creator surface. |
| Folk Hero | PHB | Rustic Hospitality stays available; Specialty optional-table material remains pruned. Artisan tool + land vehicle grants remain readable. |
| Gambler | AI | Never Tell Me the Odds remains one collapsed feature with compact core grants. |
| Gate Warden | SatO | Planar Infusion remains the Background feature. **Scion of the Outer Planes** now uses one five-option planar package selector keeping resistance + cantrip together. |
| Giant Foundling | BGG | Redundant grant-only Strike feature row is removed when the Origin feat card is present. **Strike of the Giants** is now one six-option Giant Strike choice instead of six effects flattened into prose. |
| Guard | XPHB | Compact 2024 grant layout; Alert stays collapsed. |
| Guide | XPHB | Compact 2024 grant layout. Magic Initiate remains fixed to **Druid** and spell choices route to Spells. |
| Guild Artisan | PHB | Guild Membership stays available. Specialty optional-table material remains pruned; artisan tool choice stays compact. |
| Haunted One | RHW | Survivor remains visible. Large Dark Gift feat pool uses a compact selector; only the chosen Dark Gift's rules are displayed. |
| Hermit | XPHB | Compact 2024 grant layout; Herbalism Kit practical use stays behind tool info; Healer detail is collapsed. |
| Inheritor | SCAG | Inheritance remains available. Musical Instrument/Gaming Set choice remains a real one-of choice with tool descriptions available on demand. |
| Inquisitor | PSI | Legal Authority remains a single collapsed feature; tool/language grants stay compact. |
| Investigator | RHW | Sharp Eye remains visible. Dark Gift pool uses the same compact selector treatment as Haunted One. |
| Knight of the Order | SCAG | Knightly Regard remains one collapsed feature; language/tool grants no longer create oversized rows. |
| Lorehold Student | SCC | Lorehold Initiate stays source-backed; duplicated spell-table prose is suppressed. Spell choices remain on Spells; expanded list stays collapsible. |
| Lorwyn Expert | LFL | Child of the Sun is presented as one feat detail instead of an always-open prose wall. |
| Mage of High Sorcery | DSotDQ | Redundant grant-only feature row is suppressed. **Initiate of High Sorcery** no longer renders three generic Background spell dropdowns: Moon + Wizard cantrip + two moon spells route to Spells. |
| Marine | GoS | Steady remains the feature. Hardship Endured stays secondary/collapsed instead of becoming an always-open wall. |
| Mercenary Veteran | SCAG | Mercenary Life remains one collapsed feature; core grants stay compact. |
| Merchant | XPHB | Compact 2024 grant layout; Lucky is a collapsed feat detail. |
| Mist Wanderer | RHW | Dark Gift pool uses the compact selector and displays only the selected feat's rules. |
| Noble | XPHB | Compact 2024 grant layout; Skilled choices route to Training. |
| Outlander | PHB | Wanderer remains the feature. Specialty optional-table material remains pruned. |
| Planar Philosopher | SatO | Conviction remains the feature. Factions of Sigil is reconstructed from its named list as compact faction cards rather than a 12-entry wall of prose. Scion planar package choice is structured. |
| Prismari Student | SCC | Prismari Initiate stays source-backed; duplicate spell-table prose is suppressed; actual spell choices remain on Spells. |
| Quandrix Student | SCC | Quandrix Initiate stays source-backed; duplicate spell-table prose is suppressed; actual spell choices remain on Spells. |
| Rewarded | BMT | Fortune's Favor remains the feature. Lucky/Magic Initiate/Skilled choice uses compact feat buttons; only the selected feat is expanded. Rewarded Trinkets table material remains pruned. |
| Ruined | BMT | Still Standing remains the feature. Alert/Skilled/Tough choice uses compact feat buttons; only the selected feat is expanded. Ruined Trinkets table material remains pruned. |
| Rune Carver | BGG | Fixed Giant language is compact. Redundant Rune Shaper grant row is suppressed. Rune Styles is promoted to a named **Rune style & medium** choice section. Rune Shaper is sectioned into Comprehend Languages / Rune Magic with the Rune→Spell mapping rendered as a real table. |
| Sage | XPHB | Compact 2024 grant layout. Magic Initiate remains fixed to **Wizard** and its spell choices route to Spells. |
| Sailor | XPHB | Compact 2024 grant layout; Tavern Brawler detail stays collapsed. |
| Scribe | XPHB | Compact 2024 grant layout; Skilled proficiency choices route to Training. |
| Shadowmoor Expert | LFL | Shadowmoor Hexer is shown as one selected feat detail rather than an always-open block. |
| Shipwright | GoS | I'll Patch It! remains the feature. Life at Sea stays secondary/collapsed. Water-vehicle proficiency remains compact. |
| Silverquill Student | SCC | Silverquill Initiate stays source-backed; duplicate spell-table prose is suppressed; actual spell choices remain on Spells. |
| Smuggler | GoS | Down Low remains the feature. Claim to Fame optional table material remains pruned from the creator. |
| Soldier | XPHB | Compact 2024 grant layout; Savage Attacker detail stays collapsed. |
| Spirit Medium | RHW | Dark Gift choice no longer expands the entire feat catalogue. A compact selector is used and only the selected Dark Gift is shown. |
| Urban Bounty Hunter | SCAG | Variable skill choices continue to Training without consuming class allowance. Two tool choices remain in Background and use compact source-backed controls. Ear to the Ground stays collapsed. |
| Urchin | PHB | City Secrets remains one collapsed feature; fixed grants stay compact. |
| Uthgardt Tribe Member | SCAG | Uthgardt Heritage remains the feature; optional Suggested Characteristics remain suppressed. |
| Vampire Devotee | ABH | Vampire's Plaything is one collapsed feat detail; fixed grants remain compact. |
| Vampire Survivor | ABH | Vampire Hunter is one collapsed feat detail; Woodcarver's Tools practical use is available behind tool info. |
| Variant City Watch (Investigator) | SCAG | Watcher's Eye remains one collapsed feature; variant does not get duplicate formatting. |
| Variant Criminal (Spy) | PHB | Spy Contact remains the feature; Specialty optional-table material stays pruned. |
| Variant Entertainer (Gladiator) | PHB | By Popular Demand remains the feature; Specialty optional-table material stays pruned; tool choices remain compact. |
| Variant Guild Artisan (Guild Merchant) | PHB | Guild Membership remains the feature; Specialty optional-table material stays pruned; mixed artisan/navigation grants stay compact. |
| Variant Noble (Knight) | PHB | Retainers remains the mechanical feature. The short Knight explanatory source section is secondary/collapsed rather than always occupying the page. |
| Variant Noble (Retainers) | PHB | Retainers remains the feature; no duplicate Suggested Characteristics material is shown. |
| Variant Sailor (Pirate) | PHB | Bad Reputation remains one collapsed feature; water-vehicle proficiency stays compact. |
| Waterdhavian Noble | SCAG | Kept in Style remains one collapsed feature; fixed grant rows stay compact. |
| Wayfarer | XPHB | Compact 2024 grant layout; Lucky detail stays collapsed. |
| Wildspacer | AAG | Wildspace Adaptation remains the feature. Close Encounter optional source table material remains pruned. |
| Witchlight Hand | WBtW | Carnival Fixture remains the feature. Carnival Companion stays secondary/collapsed; Character Traits are not dumped into the creator. Tool choice remains compact. |
| Witherbloom Student | SCC | Witherbloom Initiate stays source-backed; duplicate spell-table prose is suppressed; actual spell choices remain on Spells. |

## Browser-review targets for this pass

The highest-value spot checks are:

1. **Giant Foundling** — one Giant Strike selector; no raw prerequisite JSON; no duplicate grant-only feature row.
2. **Rune Carver** — compact Giant language, named Rune Style section, structured Rune Shaper sections/table.
3. **Charlatan** — no `Forge routing.` sentence and no Skilled proficiency dropdowns on Background.
4. **Mage of High Sorcery** — no generic Background spell dropdowns; moon/spell decisions appear on Spells.
5. **Spirit Medium / Haunted One / Investigator / Mist Wanderer** — Dark Gift catalogue is a compact selector rather than every feat description at once.
6. **Planar Philosopher / Gate Warden** — Scion package is one plane choice with resistance + cantrip kept together; Factions of Sigil is carded when displayed.
7. **Rewarded / Ruined** — compact multi-feat selector with only the selected feat expanded.
8. **Clan Crafter** — compact fixed/variable grants and readable Craft Expertise/tool explanation.

## Deliberately deferred visual-presence pass

After the formatting is accepted in-browser, the Background tab can receive a separate visual pass inspired by the Class guide: stronger source/book identity, a more distinctive Background hero, subtle category emblems/ornament, and richer left-list selected/hover states. That pass should not re-open the rules-routing work above.
