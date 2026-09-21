# Next Chat Handoff — 2026-09-21

Use this as the concise takeover note. Then read the current override at the top of `DNDNext_Current_Handoff_Prompt.md`.

## Production state

Repository: `bob8675309/DNDNEXT`

Current production `main`:

`320671a22b83432177dcc67e9efd035f3c3ccc5d`

That commit merged PR #195:

**Gate unauthenticated navbar and add admin activity view**

Production Vercel:

- deployment: `dpl_ETZZCzVZq8Cpw56Fndf9pfYmp5B8`;
- state at handoff: **READY**.

PR #195 is closed/merged.

Read:

- `Auth_Navigation_Admin_Activity_Status.md`.

## Live Supabase

Project:

- `DnDWeb`;
- ref: `ucggczovhmauhshvhusx`.

Latest relevant registered migrations:

- `20260921152546 admin_site_activity_v1`;
- `20260921153151 admin_site_activity_acl_fix`;
- `20260921153328 admin_site_activity_retention_v1`;
- `20260921185225 admin_site_activity_hardening_v1`.

Important final-state details:

- anonymous visit recording is intentionally callable from the public client but bounded inside Postgres;
- at most 12 **new** anonymous visitor rows per minute;
- at most 2,500 retained anonymous visitor rows;
- direct activity-table access remains revoked from anon/authenticated;
- anonymous users cannot execute the admin read RPC;
- authenticated callers can reach the admin read RPC, but its internal admin guard fails closed for non-admins;
- anonymous browser activity and each signed-in account use separate browser visitor UUIDs;
- current `auth.uid()` is authoritative for activity attribution;
- pre-hardening attributed browser rows were reset to anonymous because the previous shared browser key could cross auth states.

Do not rewrite the already-applied SQL history. The controlling final hardening file is:

`sql/20260921_04_admin_site_activity_hardening_v1.sql`.

## Active work: subclass Tarot selector

PR #194 remains **open / unmerged**:

- title: `Refine subclass Tarot carousel interaction and clarity`;
- branch: `agent/subclass-carousel-drag-crisp-20260918`;
- reviewed head: `f21a81435946b1ae8ec6112e5376062cfc2b62f4`;
- exact-head preview: `dndnext-86xs3s1d4-pauls-projects-2016aa54.vercel.app`;
- preview state at handoff: **READY**.

Always re-fetch PR #194 and its deployment before changing or merging it.

Read:

- `Character_Forge_Subclass_Tarot_Flexible_Ring_Status.md`.

## Locked Tarot architecture

Paul explicitly replaced the earlier conflicting fixed-count experiments with this rule:

> **One physical table ring. N subclasses = N equally spaced cards. One exact front hero position. All other presentation comes from where the card sits on that ring.**

Do not restore old “3 cards,” “5 cards,” “7 cards,” or “9 visible cards” rules.

Current implementation principles:

- spacing = `360° / subclass count`;
- every subclass remains on the same ring;
- no fixed visible-card cap;
- ring radius expands mildly for dense catalogues;
- card physical size eases down mildly for dense catalogues;
- only the exact front-center card receives hero treatment;
- all non-hero cards remain at their natural carousel position;
- rear cards are smaller/dimmer and show the ornate back;
- card bottom-center is the table-contact anchor;
- clicking a face-up card rotates that exact card to the hero position;
- explicit eligible clicks use the existing subclass selection authority;
- carousel motion by itself never persists a subclass;
- Tarot artwork remains native `840 × 1440`;
- positive orbit Z translation is removed to protect sharpness.

Expected examples:

- Monster Hunter / 4 options: 0°, 90°, 180°, 270°;
- Wizard / dense catalogue: same ring with smaller equal angular spacing.

## Visual target

The user's supplied cathedral + runic-table screenshot is the visual source of truth.

The Tarot deck should be preserved.

The surrounding:

- cathedral background;
- runic table;
- lighting;
- stage artwork;
- non-card decoration

may be replaced/reworked if necessary to match the target better.

The user does **not** want more concept/mock-up images. Work on the real modal.

## Immediate next steps

If continuing PR #194:

1. re-fetch `main`, PR #194 head, changed-file scope, mergeability, and exact-head Vercel state;
2. test Monster Hunter's 4-card ring in-browser;
3. test Wizard's dense ring in-browser;
4. inspect card spacing, table-foot anchoring, hero-only emphasis, rear backs, sharpness, and drag/flick continuity;
5. compare the live selector directly against the supplied target screenshot;
6. adjust stage art only if geometry is already correct but the existing stage prevents the target look;
7. run `scripts/validate_class_subclass_browser.mjs` plus relevant Forge regressions;
8. merge PR #194 only after explicit user approval and exact-head validation.

## Protected boundaries

Do not touch the world map unless Paul explicitly asks.

Do not mix world-map and town/city-map behavior.

Subclass Tarot presentation work does not authorize changes to:

- tactical movement/combat authority;
- crafting;
- inventory;
- merchants/economy;
- unrelated Supabase schema;
- route/travel/weather/camp/world-clock systems.

## Documentation cleanup

The docs directory contains useful historical ledgers with stale PR/checkpoint headers.

Current trust order:

1. live Supabase + current GitHub source/deploy state;
2. `DNDNext_Current_Handoff_Prompt.md` 2026-09-21 override;
3. `Character_Forge_Subclass_Tarot_Flexible_Ring_Status.md`;
4. `Auth_Navigation_Admin_Activity_Status.md`;
5. `Documentation_Refresh_Manifest.md` and `docs/README.md`;
6. older subsystem/history docs.

When documentation standardization resumes, reconcile old ledgers in place or clearly mark them historical. Do not let stale fixed-card carousel descriptions override the current flexible-ring architecture.
