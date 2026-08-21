# Character Forge Training Redesign Status

Updated: 2026-08-20

Status: active implementation on PR #176 (`agent/training-tab-redesign`). Do not merge until browser-reviewed against the approved compact Training mockup and the remaining checklist below is either complete or explicitly deferred.

## Current accepted Forge baseline

- Species is accepted/frozen unless a concrete regression is reproduced.
- Background is accepted and merged to `main` in commit `a2aecdd354346926afdf33efb1af320581563b68` (PR #175). Its shared banner/crest/icon art system is now part of the baseline.
- Training is the active slice. PR #176 is the only intended work branch for this redesign.
- NPC Forge continues through the preserved legacy Training implementation; the new player Training surface must not silently alter NPC creation behavior.

## User-approved Training visual contract

The approved layout is deliberately quieter than the earlier dashboard-style attempts:

1. a compact top progress/tally strip;
2. one left-side `Training Picks` surface containing every decision;
3. one right-side `Current Selection` surface used only for explanation/context;
4. no decision controls portaled into the right rail;
5. compact section rows rather than oversized independent dashboards;
6. subtle use of the repo-owned Training asset kit under `public/ui/forge/training/`;
7. responsive collapse without changing ownership or persistence.

Current player selection order is intended to read roughly as:

- Background grants / unresolved Background proficiency choices;
- Class Skills;
- Training Choices;
- Trade Skills / craft skills;
- Feat Choices and feat-owned follow-ups.

## Locked modeling decisions

### Bonus Feat

- Abilities chooses only the **Bonus Feat package** as an alternative to the ability-score bonus packages.
- The actual feat is resolved in **Training**.
- Training must count an unresolved Bonus Feat in its completion state and block Continue until the feat is chosen.
- Feat-owned nested choices remain source-owned and must reuse existing class/source-choice authority rather than parallel state.

### Tool proficiency and craft/trade skill

The user has now chosen a stronger unification rule than the earlier PR text:

- a proficiency with a crafting tool is intended to grant the corresponding campaign **Craft/Trade Skill**;
- a Craft/Trade Skill and its associated tool proficiency should not require two separate player picks;
- Backgrounds/classes/feats that grant or allow a tool choice should route that unresolved proficiency choice to Training, where the corresponding craft/trade proficiency is resolved with the other Training choices;
- this is a player-facing ownership/routing change first; do **not** rewrite crafting recipes, material consumption, merchant/economy behavior, or world/town systems as part of the Training patch.

Current campaign craft families already represented in the UI are:

- Alchemy ↔ Alchemist's Supplies;
- Smithing ↔ Smith's Tools;
- Scribe/Scribing ↔ Calligrapher's Supplies;
- Enchanting ↔ Enchanter's Tools.

Longer-term design goal: every meaningful crafting tool could eventually become its own craft skill with recipes/progression. That is desirable but is a large crafting-system project and is **not required to finish the Training tab**.

## Background source audit rule

Do not rebalance Backgrounds by intuition while fixing Training routing. First compare the preferred live catalogue row to its imported `raw_payload` / source metadata.

Confirmed live examples on 2026-08-20:

- **Athlete (MOT)** really does contain `Languages: One of your choice` plus `Vehicles (land)` in its source payload. The language is not currently evidence of an import bug.
- **Mist Wanderer (RHW)** really does grant `Choose one kind of Artisan's Tools` in its source payload.
- **Clan Crafter (SCAG)** really does grant one artisan-tool proficiency plus its language rule.
- **Rune Carver (BGG)** really does grant one artisan-tool proficiency and Giant.

Therefore: audit all 75 preferred Backgrounds for omissions, incorrect parsing, duplicate presentation, and wrong choice placement, but do not silently normalize their relative power. Any house-rule balance pass must be a separate explicit decision.

## Training top tally redesign

The current four independent counters are hard to parse. Replace them with one primary completion tally that can be expanded/clicked to show provenance.

Target concept:

`Skill & Training Selections — X / Y resolved`

Expanded breakdown should identify where grants/required choices come from, for example:

- Background fixed skill grants;
- Background unresolved proficiency choices;
- Class skill allowance;
- source/feature Training choices;
- Craft/Trade Skill grants or choices;
- Bonus/Origin/other feat choice requirements.

Important: the total must be computed from existing authorities, not by inventing a second counter state. The breakdown must distinguish **granted** proficiencies from **player selections still required**.

## Feat chooser redesign

The raw browser `<select>` is not acceptable as the final presentation for large feat pools.

Reuse the interaction language already established in the Profile panel `Feats & Boons Catalogue`:

- searchable compact feat list/catalogue;
- source/category tags;
- selected feat detail on the right/current-selection surface;
- prerequisites and benefit text clearly formatted;
- only eligible/relevant feat pools for the owning grant when possible;
- feat-owned follow-up decisions remain below/with the selected feat and preserve existing source-choice authority;
- no giant native dropdown containing the entire feat catalogue.

The Training tab may share helper/model code with the Profile catalogue where safe, but should not duplicate player-owned grant/remove controls or Profile-only admin behavior.

## Implementation checklist

### A. Documentation / handoff

- [x] Record accepted Background merge and Training PR #176 as the active slice.
- [x] Record Bonus Feat ownership: package in Abilities, specific feat in Training.
- [x] Record tool/craft unification direction and the longer-term granular crafting-tool goal.
- [x] Record source-audit rule and confirmed Athlete/Mist Wanderer examples.
- [x] Update `DNDNext_Current_Handoff_Prompt.md`, `docs/README.md`, and `Documentation_Refresh_Manifest.md` to point here.
- [x] Mark `Character_Forge_Background_Audit.md` as accepted/merged rather than active.

### B. Background proficiency routing into Training

- [ ] Inventory every preferred Background's fixed and variable `skills`, `tools`, and `languages` from the live preferred catalogue.
- [ ] Distinguish fixed grants from unresolved choices without changing source data.
- [ ] Remove player-facing tool dropdowns from Background where the choice is intended to resolve in Training; Background should acknowledge the grant/required Training choice instead.
- [ ] Preserve fixed tools as grants and make them visible in Training provenance.
- [ ] Map crafting-tool grants/choices to the corresponding Craft/Trade Skill when a canonical mapping exists.
- [ ] Preserve non-crafting tool proficiencies and vehicle/instrument cases without forcing them into the four current craft families.
- [ ] Add focused regression coverage for Background → Training proficiency ownership.

### C. Unified Skill & Training tally

- [ ] Replace the four confusing headline counters with one primary resolved/required tally.
- [ ] Make the tally clickable/expandable to show provenance by Background/Class/Feature/Craft/Feat.
- [ ] Ensure fixed grants do not consume selectable allowance.
- [ ] Ensure unresolved variable Background grants do count as outstanding work.
- [ ] Ensure Bonus Feat contributes to unresolved Training completion when selected in Abilities.
- [ ] Keep Continue guidance pointed at the first unresolved required choice.

### D. Trade/Craft Skill presentation and authority

- [ ] Rename/present the subsection consistently as `Trade Skills` or `Craft Skills` (choose one label and use it consistently).
- [ ] Keep it visually parallel to Class Skills instead of a separate oversized crafting dashboard.
- [ ] Make a canonical tool ↔ craft mapping helper rather than scattering string comparisons through JSX.
- [ ] Treat a mapped crafting-tool proficiency grant as the corresponding craft proficiency for player creation.
- [ ] Prevent double-spending when both the tool and craft would otherwise be selected.
- [ ] Do not change recipe tables, crafting material formulas, attempt RPCs, merchants, or economy in this PR.

### E. Feat selection presentation

- [ ] Replace giant native feat dropdown with compact catalogue/list-detail chooser.
- [ ] Reuse Profile Feats & Boons catalogue styling/model helpers where safe.
- [ ] Add search and useful source/category information.
- [ ] Show prerequisites and selected-feat rules in `Current Selection`.
- [ ] Preserve owner-specific eligibility and nested feat choices.
- [ ] Verify Bonus Feat, Origin feat, background feat, and class/feature feat cases independently.

### F. Source audit / balance verification

- [ ] Audit all 75 preferred Backgrounds against `metadata` and `raw_payload` for skill/tool/language/feat omissions.
- [ ] Record actual source oddities (such as Athlete's language) rather than "fixing" them by feel.
- [ ] Correct only verified source/import/presentation/routing errors in this pass.
- [ ] Keep any campaign rebalance proposals in a separate documented backlog.

### G. Validation / acceptance

- [ ] Verify all new helpers, hooks, props, callbacks, and state references are defined and passed.
- [ ] Run Training redesign validator.
- [ ] Run nested Character Forge choice validator.
- [ ] Run Background source-choice validator.
- [ ] Run unified Forge/browser-smoke validators.
- [ ] Run Species/Human, starting-equipment, starting-magic, portrait, source-magic, and NPC Forge regression gates triggered by the branch.
- [ ] Verify Vercel exact-head deployment is READY.
- [ ] Browser-test at minimum: Athlete, Mist Wanderer, Clan Crafter, Rune Carver, Charlatan/Skilled, an ordinary class, Artificer/crafting-heavy case, and Bonus Feat flow.
- [ ] Confirm no world-map, town/city-map, travel, tactical, crafting-runtime, inventory, merchant, or economy files were changed accidentally.
- [ ] Do not merge PR #176 until user visual/behavior review is accepted.

## Current branch / deployment checkpoint

At the time this ledger was created:

- `main`: `a2aecdd354346926afdf33efb1af320581563b68` — accepted Background merge;
- active PR: #176 — `agent/training-tab-redesign`;
- documented head before this ledger commit: `4e2c93d77fd3e1f7c0d3b08ef7a75051203bc368`;
- exact Vercel deployment for that head was READY;
- all 13 triggered Forge regression workflows were green after stale copy-based assertions were updated to the new Bonus Feat routing contract.

Always re-read the current PR head before continuing; later commits in this checklist will advance it.

## Protected boundaries

This Training work does **not** authorize changes to:

- `components/MapPageClient.js` or world map/travel/weather/camp/clock logic;
- town/city map behavior;
- encounter action execution;
- crafting recipe/material/attempt formulas or consumption;
- inventory/equipment authority;
- merchants/economy;
- unrelated runtime/rest systems.

The future unified crafting-material redesign remains a separate post-Forge project.