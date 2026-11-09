# C3.3 — Official NPC three-page PDF visual QA (2026-11-08 UTC)

**Scope:** Draft [PR #345](https://github.com/bob8675309/DNDNEXT/pull/345) only; original `NpcPanel` to `CharacterSheetPanel` print path and official three-page PDF implementation remain intact. This is a synthetic output and rendering check, **not** production browser-print or live SQL release approval.

## Source evidence

- Base application on `main` `9437b9d0a2bedc3ba78110c612543f6033674a72`; active branch source before this QA was `9031eeaa62443f19fef3857028fb7a3182b34069`.
- Existing signed role and coeditor real-PDF-byte browser gate: [C3.3 joint true-local run #42447779245](https://github.com/bob8675309/DNDNEXT/actions/runs/42447779245), which did **not** rasterize each PDF page.
- New original template and original `pdf-lib` generation on synthetic standard player-safe, synthetic GM-authorized, and synthetic deliberately dense models: [successful exact-code-head visual QA #42452124502](https://github.com/bob8675309/DNDNEXT/actions/runs/42452124502) on `4a3df1a393aaef65c2e91ffe70f283d7ae20c5d5`. The run creates all three 3-page PDFs; Poppler `pdftotext` validates actual PDF text and `pdftoppm` rasterizes five page previews. Artifact: [c33-official-npc-pdf-visual-qa](https://github.com/bob8675309/DNDNEXT/actions/runs/42452124502/artifacts/13606375226) (7-day retention).
- These are synthetic-only PDFs. The GM test string is a deliberately fabricated marker; no user campaign data or credentials were used.

## Actual page-by-page observations

- **Standard page 2, public vs GM:** Both are readable; standard public profile prints no `Secret:` and the synthetic GM-only marker prints only when explicitly supplied in the authorized fixture. This synthetic test independently checks generator data placement; authorization correctness still rests on the prior signed browser/JWT tests.
- **Dense page 1:** Character identity, ability/save/skill, attacks, features, and first inventory rows are legible within official form boxes. The equipment box truncates to an ellipsis when 36 items cannot fit.
- **Dense page 2:** The initial print implementation silently omitted remaining features after page-two continuation filled. Bounded fix reserves the final line and prints `+13 more features - see digital sheet` in this synthetic case. Very long prose, eight notes, and inventory recaps continue to ellipsize inside fixed height sections; no promise of full lossless transcript.
- **Dense page 3:** Initial layout painted `+N more` counters over the last printed spell name in overfull spell groups. Bounded fix reserves a separate final row per overfull level, displaying `+N more spells (digital sheet)`. Page-3 visual review verified the markers no longer overwrite a spell name.
- Five synthetic previews inspected directly: `public-standard-2`, `gm-standard-2`, `public-dense-1`, `public-dense-2`, `public-dense-3`. Existing official template and three-page count were unchanged.

## Code and regression checks

- `scripts/browser/verify_c33_npc_pdf_visual.mjs` builds and checks the real PDFs, negative synthetic secret boundary, three-page counts, output texts, dense feature/spell indicators, and real rasterizations.
- `.github/workflows/validate-c3-3-npc-pdf-visual.yml` installs Poppler, runs the test on PRs and optionally workflow dispatch, and retains synthetic PDF and JPG artifacts for seven days.
- `utils/officialCharacterSheetPdf.js` contains the only application-source change: print overflow reserve/count and dedicated spell-marker row. No `CharacterSheetPanel`, Forge, RLS, auth, inventory, town, merchant, world map, tactical, or runtime authorization code changed in this QA.
- First visual runner failed before generation because Poppler was missing; the workflow now installs it. Second run failed in dense case because the newly introduced footer referred to `bold` instead of its passed `boldFont`; corrected. Successful run #42452124502 kept both failure paths visible as historical CI evidence.

## Limits and remaining work

- Long narrative/notes/inventory are still abbreviated inside fixed form fields; choosing extra continuation pages vs strict official three-page output is an **owner product decision**, not a hidden print regression fix.
- 1100px page-image inspection is not a physical printer, all browser PDF viewers, fonts other than embedded default Helvetica, actual campaign data, or all accessibility/readability scenarios.
- No complete original 31 Forge-trigger catalog, blank-initial Forge flow, production migration rollback, merchant checkout, or whole-app release gate is established by this work.
- **Single next task:** construct the read-only, separately owner-reviewed coordinated NPC three-stage privacy + inventory CHECK/RLS + compatible client rollout/rollback checklist with exact preflight fingerprints and negative security tests, **without applying it**.
- No merge to `main`, live Supabase/Vercel action, world-map change, paid AI action, or production deployment.
