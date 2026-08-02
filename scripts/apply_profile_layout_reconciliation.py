from pathlib import Path
import re


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return source.replace(old, new, 1)


def replace_regex_once(source: str, pattern: str, new: str, label: str) -> str:
    compiled = re.compile(pattern, re.S)
    matches = list(compiled.finditer(source))
    if len(matches) != 1:
        raise RuntimeError(f"{label}: expected one match, found {len(matches)}")
    return compiled.sub(new, source, count=1)


panel_path = Path("components/NpcPanel.js")
panel = panel_path.read_text(encoding="utf-8")

profile_left = '''          <div className="npc-left">
            <div className="npc-card npc-profile-description-card">
              <div className="npc-card-title">Description</div>
              <div className="npc-profile-description-with-portrait">
                <div
                  className={`npc-profile-description-thumb ${canChangePortrait ? "can-change-portrait" : ""}`}
                  role={canChangePortrait ? "button" : undefined}
                  tabIndex={canChangePortrait ? 0 : undefined}
                  title={canChangePortrait ? "Double-click to change portrait" : undefined}
                  onDoubleClick={() => canChangePortrait ? setPortraitPickerOpen(true) : null}
                  onKeyDown={(event) => {
                    if (!canChangePortrait) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setPortraitPickerOpen(true);
                    }
                  }}
                >
                  {portrait.url ? <img src={portrait.url} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <div className="npc-portrait-placeholder">Portrait</div>}
                </div>
                <div className="npc-profile-description-text">
                  {loading && !blurb ? <div className="text-muted">Loading…</div> : err && !blurb ? <div className="text-danger">{err}</div> : blurb ? <div className="npc-text">{blurb}</div> : <div className="text-muted">No description yet.</div>}
                </div>
              </div>
            </div>
          </div>

          <div className="npc-right">'''

panel = replace_regex_once(
    panel,
    r'''          <div className="npc-left">\n.*?\n          </div>\n\n          <div className="npc-right">''',
    profile_left,
    "shared profile left column",
)
panel = replace_once(
    panel,
    "        {visibleLoreFields.length ? (",
    '        {visibleLoreFields.some((entry) => entry.key !== "description") ? (',
    "supplemental lore condition",
)
panel = replace_once(
    panel,
    "            {visibleLoreFields.map((entry) => {",
    '            {visibleLoreFields.filter((entry) => entry.key !== "description").map((entry) => {',
    "supplemental lore mapping",
)
panel_path.write_text(panel, encoding="utf-8")

profile_css_path = Path("styles/npc-profile-panel.css")
profile_css = profile_css_path.read_text(encoding="utf-8")
profile_marker = "/* ===== Inline profile Description portrait v1 ===== */"
if profile_marker not in profile_css:
    profile_css += '''

/* ===== Inline profile Description portrait v1 ===== */
.npc-profile-description-card {
  overflow: hidden;
}

.npc-profile-description-with-portrait {
  display: block;
}

.npc-profile-description-with-portrait::after {
  content: "";
  display: block;
  clear: both;
}

.npc-profile-description-thumb {
  float: left;
  width: min(42%, 170px);
  min-width: 118px;
  max-width: 170px;
  aspect-ratio: 3 / 4;
  margin: 0.15rem 0.9rem 0.55rem 0;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 12px;
  overflow: hidden;
  color: rgba(255, 255, 255, 0.64);
  background: rgba(255, 255, 255, 0.04);
  display: flex;
  align-items: center;
  justify-content: center;
}

.npc-profile-description-thumb.can-change-portrait {
  cursor: pointer;
}

.npc-profile-description-thumb.can-change-portrait:hover,
.npc-profile-description-thumb.can-change-portrait:focus-visible {
  outline: 2px solid rgba(255, 210, 109, 0.9);
  outline-offset: 2px;
  box-shadow: 0 0 24px rgba(214, 169, 83, 0.16);
}

.npc-profile-description-thumb img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center top;
}

.npc-profile-description-text {
  min-height: 7.5rem;
  line-height: 1.55;
}

@media (max-width: 575px) {
  .npc-profile-description-thumb {
    width: 122px;
    min-width: 104px;
    max-width: 44%;
  }
}
'''
profile_css_path.write_text(profile_css, encoding="utf-8")

sheet_css_path = Path("styles/character-sheet-enhancements.css")
sheet_css = sheet_css_path.read_text(encoding="utf-8")
sheet_css = replace_once(
    sheet_css,
    ".csheet-pinned-description {\n  display: grid;\n  gap: 0.55rem;",
    ".csheet-pinned-description {\n  align-content: start;\n  display: grid;\n  gap: 0.55rem;\n  justify-items: stretch;",
    "pinned description alignment",
)
sheet_css = replace_once(
    sheet_css,
    ".csheet-pinned-description__head {\n  display: flex;\n  align-items: flex-start;\n  justify-content: space-between;\n  gap: 0.75rem;",
    ".csheet-pinned-description__head {\n  display: flex;\n  align-items: flex-start;\n  justify-content: space-between;\n  gap: 0.75rem;\n  margin-bottom: 0.12rem;",
    "pinned description header spacing",
)
sheet_css = replace_once(
    sheet_css,
    ".csheet-pinned-description p {\n  margin: 0;\n  color: rgba(255, 255, 255, 0.72);\n  font-size: 0.76rem;",
    ".csheet-pinned-description p {\n  margin: 0;\n  color: rgba(255, 255, 255, 0.78);\n  font-size: 0.82rem;",
    "pinned description body size",
)
sheet_css_path.write_text(sheet_css, encoding="utf-8")

validator_path = Path("scripts/validate_npc_sheet_action_parity.mjs")
validator = validator_path.read_text(encoding="utf-8")
validator = replace_once(
    validator,
    'const css = read("styles/character-sheet-actions.css");\nconst runner = read("scripts/vercel_build_v2.mjs");',
    'const css = read("styles/character-sheet-actions.css");\nconst profileCss = read("styles/npc-profile-panel.css");\nconst sheetEnhancements = read("styles/character-sheet-enhancements.css");\nconst runner = read("scripts/vercel_build_v2.mjs");',
    "validator style inputs",
)
validator = replace_once(
    validator,
    'assert(css.includes(".csheet-action-group__body") && css.includes(".csheet-action-group__chevron"), "Action subsection styles are missing");\nassert(runner.includes(\'validate_npc_sheet_action_parity.mjs\'), "Production build runner must include the NPC action parity validator");',
    'assert(css.includes(".csheet-action-group__body") && css.includes(".csheet-action-group__chevron"), "Action subsection styles are missing");\nassert(panel.includes("npc-profile-description-with-portrait") && panel.includes("npc-profile-description-thumb"), "Shared Profile view must keep the portrait inside the Description card");\nassert(!panel.includes(\'<div className="npc-card-title">About</div>\'), "Shared Profile view must not retain the duplicate About card");\nassert(panel.includes(\'visibleLoreFields.filter((entry) => entry.key !== "description")\'), "Description must not be duplicated in the supplemental lore grid");\nassert(profileCss.includes("Inline profile Description portrait v1") && profileCss.includes("object-position: center top"), "Shared Profile portrait layout styles are missing");\nassert(sheetEnhancements.includes("align-content: start") && sheetEnhancements.includes("font-size: 0.82rem"), "Pinned Description must stay top-aligned with readable body text");\nassert(runner.includes(\'validate_npc_sheet_action_parity.mjs\'), "Production build runner must include the NPC action parity validator");',
    "profile and pinned-description assertions",
)
validator_path.write_text(validator, encoding="utf-8")

roadmap_path = Path("docs/Current_Development_Status_and_Roadmap.md")
roadmap = roadmap_path.read_text(encoding="utf-8")
roadmap = replace_once(
    roadmap,
    "- Production runtime baseline: `c99cd630fcbc2a6dd7a504f843945f4e62684eeb` (PR #138 merge).",
    "- Production runtime baseline entering this reconciliation: `6f57b8f5827e5b286bf9b7fa66b1108436c8285d` (PR #147 merge).",
    "roadmap runtime baseline",
)
roadmap = replace_once(
    roadmap,
    "- PRs #136-#138 exact-head previews and merged `main` production Vercel deployments: green.",
    "- PRs #136-#147 exact-head previews and merged `main` production Vercel deployments: green.",
    "roadmap deployment range",
)
roadmap = replace_once(
    roadmap,
    "- Protected live baseline: 5 characters, 17 character-spell assignments, 1 encounter map, 5 encounter sessions, 16 participants, 20 combat-log rows, and 2 resolved reaction windows. One smoke encounter remains active at Round 6 / Version 63.",
    "- Protected live baseline: 7 characters, 7 character sheets, 3 Auth users, 3 player profiles, 3 character permissions, 32 character-spell assignments, 18 inventory items, 1 encounter map, 5 encounters, 16 participants, 20 combat-log rows, and 2 resolved reaction windows. One smoke encounter remains active at Round 6 / Version 63.",
    "roadmap live baseline",
)
roadmap = replace_once(
    roadmap,
    "- Profile-panel Class, Sheet & Rolls, Inventory, Spellbook, optional Shop, and optional Craft surfaces.",
    "- Profile-panel Class, Sheet & Rolls, Inventory, Spellbook, optional Shop, and optional Craft surfaces. The direct `/npcs` page and shared Profile panel place the portrait inside the Description content card with text wrapping below it; the old separate full-height portrait/About duplication is retired.",
    "roadmap profile surfaces",
)
roadmap = replace_once(
    roadmap,
    "- Sheet & Rolls now derives a vertical quick-action list from canonical weapons, known cantrips, prepared spells, and resolved feature rows; standalone clicks calculate or display roll math, while encounter execution remains routed through guarded tactical authority. The direct `/npcs` sheet and embedded NPC profile panel share the same action inputs and attack/damage result presentation, and each action category can be collapsed independently.",
    "- Sheet & Rolls now derives a vertical quick-action list from canonical weapons, known cantrips, prepared spells, and resolved feature rows; standalone clicks calculate or display roll math, while encounter execution remains routed through guarded tactical authority. The direct `/npcs` sheet and embedded NPC profile panel share the same action inputs and high-contrast attack/damage result presentation, each action category can be collapsed independently, dual melee/thrown weapons explain the mode pill in Details, and the pinned Description stays top-aligned with slightly larger body text.",
    "roadmap sheet action status",
)
roadmap = replace_once(
    roadmap,
    "- Create two additional player accounts in separate browser sessions; the live project still has one Auth user and one Admin/player profile.",
    "- Account provisioning is complete: the live project now has three Auth users and three player profiles.",
    "roadmap account provisioning",
)
roadmap = replace_once(
    roadmap,
    "- Move profile portrait placement into the Description content layout if still outstanding.\n- Normalize merchant/crafter/profile portrait sizing.",
    "- Direct `/npcs` and shared Profile portrait placement are source-owned inside the Description content layout; text wraps beside and below the portrait.\n- Merchant, crafter, and profile portrait sizing/bleed are source-owned. Treat them as complete unless a new browser reproduction identifies a specific regression.",
    "roadmap portrait backlog",
)
roadmap_path.write_text(roadmap, encoding="utf-8")

deferred_path = Path("docs/Deferred_UI_Polish_Backlog.md")
deferred = deferred_path.read_text(encoding="utf-8")
deferred = replace_once(
    deferred,
    "This file tracks known follow-up items that should not be mixed into build-runner cleanup unless they become blocking. Keep these separate from source-bake cleanup to reduce regression risk.",
    "Reconciled: 2026-08-02. This file distinguishes verified completed presentation work from remaining follow-up items. Do not reopen completed items without a current browser reproduction.",
    "deferred backlog introduction",
)
deferred = replace_regex_once(
    deferred,
    r'''### NPC profile portrait placement\n\n.*?\n\n### Merchant / profile portrait sizing pass\n\n.*?\n\n## Merchant admin / storefront follow-up''',
    '''### NPC profile portrait placement — COMPLETE

- The direct `/npcs` page uses an inline portrait inside the Description card, with narrative text wrapping beside and below it.
- The shared Profile panel uses the same content model and no longer keeps a separate full-height portrait plus duplicate About/Description card.
- Source ownership: `pages/npcs.js`, `components/NpcPanel.js`, `styles/npc-page-controls.css`, and `styles/npc-profile-panel.css`.
- Reopen only for a specific current browser regression; keep Profile, Sheet & Rolls, Inventory, Shop, and Craft routing unchanged.

### Merchant / profile portrait sizing pass — COMPLETE

- Profile portrait sizing and responsive behavior are source-owned.
- Crafter and merchant portrait sizing/bleed are source-owned in `profile-craft-crafter-frame.css` and `profile-portrait-bleed-overrides.css`.
- Reopen only with a current screenshot and route-specific reproduction; do not change stock, purchase, crafting, or inventory semantics during a visual pass.

## Sheet & Rolls presentation status

- Combined attack and attached damage output uses the shared high-contrast roll-result component.
- Weapons, Cantrips, Prepared Spells, and Abilities can be collapsed independently while keeping each subheader visible.
- Dual melee/thrown weapon Details explicitly explain the mode-pill toggle.
- The pinned Description content stays at the top-left with a small header buffer and slightly larger body text.
- Live spell descriptions contain no literal bracketed source marker such as `[XPHB]`; 75 class-feature catalog rows still lack descriptions and remain content-repair debt rather than a sheet-layout defect.

## Merchant admin / storefront follow-up''',
    "completed portrait sections",
)
deferred_path.write_text(deferred, encoding="utf-8")

selection_doc_path = Path("docs/NPC_Character_Sheet_Selection_Reconciliation.md")
selection_doc = selection_doc_path.read_text(encoding="utf-8")
selection_doc = replace_once(
    selection_doc,
    "Updated: 2026-08-01  ",
    "Updated: 2026-08-02  ",
    "selection doc date",
)
selection_doc = replace_once(
    selection_doc,
    "- PR #136 exact-head and merged-production Vercel deployments passed.\n- The campaign owner tested rapid character switching plus tab-away/tab-return on the preview and reported that the failure no longer reproduced.\n- The accepted runtime baseline is merge commit `7e912a6fb79731b1dd436c53fb93051bccb6cb75`.",
    "- PR #136 exact-head and merged-production Vercel deployments passed.\n- PRs #137-#147 preserved the selection/auth-lock boundary while adding linked-profile stale-result guards, encounter controller setup, shared Sheet & Rolls action parity, and the canonical enchanting source bake.\n- The campaign owner tested rapid character switching plus tab-away/tab-return on the preview and reported that the failure no longer reproduced.\n- Direct `/npcs` and the shared Profile panel now keep portraits inside the Description content layout without changing sheet-selection ownership.\n- The exact current production anchor is recorded in `Current_Development_Status_and_Roadmap.md`.",
    "selection accepted baseline",
)
selection_doc = replace_once(
    selection_doc,
    "- each app-shell subscriber uses a macrotask handoff and cancels deferred work during supersession and cleanup.",
    "- each app-shell subscriber uses a macrotask handoff and cancels deferred work during supersession and cleanup;\n- the shared Profile panel keeps the portrait inside Description and does not duplicate the Description field in supplemental lore;\n- the pinned sheet Description remains top-aligned and readable.",
    "selection regression list",
)
selection_doc_path.write_text(selection_doc, encoding="utf-8")

print("Profile layout, pinned Description styling, validators, and documentation reconciled.")
