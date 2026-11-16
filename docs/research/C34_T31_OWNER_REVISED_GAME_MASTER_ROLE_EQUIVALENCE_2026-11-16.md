# C34 T31 — Owner-revised Admin / GM / DM equal GAME administration

**Decision November 16, 2026 (CST):** Owner has withdrawn the previous design distinction that gave Admin NPC dossier, player-character administration or world-map gameplay controls while GM and DM were allowed commerce only. All three role strings `admin`, `gm`, `dm` now mean the same **campaign/game-management authority**: view private NPC and player dossiers/sheets/Story, administer game characters/inventory, stock/gold and game travel/encounter controls. An ordinary `player`, noncanonical role or unsigned actor receives no game-master privilege. This does **not** grant GitHub/Vercel account settings, database service-role keys or other developer infrastructure privileges.

## Historical source and why client-only changes are insufficient

- T29 originally implemented **commerce-only GM/DM** on disposable PG17. Its exact source and signed role negatives remain immutable evidence of the **superseded decision**; it is not the new policy.
- T30 built an unmounted strict Admin dossier/travel reader; its six source negatives and original server source are likewise **preserved as historical prior-contract evidence**, not the current owner requirement.
- The true original #345 Stage2 `get_npc_dossier_admin_v1` delegates authorization to `private.current_user_is_admin()`; Stage3 `get_character_secrets_v1`, `set_character_secret_v1`, GM clue RLS, player-creator Story and editor Sheet visibility share it. Simply showing GM/DM a dossier button would be an authorization mismatch.
- Hosted `private.current_user_is_admin()` currently checks strict `admin`; other source functions also contain independent hardcoded role checks. A full production authorization audit remains mandatory. Do **not** change hosted helpers, maps, production RLS or all security definitions by global find/replace.

## Current bounded T31 research implementation

1. Keep T29's and T30's original executable tests in their original workflow order. **After** all historical tests run, install a strictly disposable PG17 research override of `private.current_user_is_admin()` that recognizes current signed `user_profiles.role IN ('admin','gm','dm')`. Fail closed unless exact original synthetic `private.test_admins` helper, Stage2/Stage3 RPCs, T29 commerce helpers, original buyer SHA and PG17 fixture are present.
2. Supersede only the T29 helper restrictions in scratch: GM/DM inherit Admin's existing game-stock and game-wallet target authority. Never modify the original full wallet, stock, reroll or atomic buyer function bodies; keep the original Stage1–3 SQL blobs byte-identical.
3. New unmounted `t31GameManagerRoleProfileCandidate.mjs` validates a trusted no-target-UID role-projection RPC; client auth and actor-generation rechecks prevent using prior-actor, demoted or manipulated privileges. The existing T21 source-safe reader handles public/Sheet/Story, original Stage2 handles private dossier on the server.
4. Offline Node and full genuine signed local PG17/GoTrue/PostgREST tests cover all three managers' same dossier/secret/creator Story/sheet/commerce target permissions and player/editor/unknown/uppercase/anon denials, demotion, account switch, secret-not-public and unchanged original buyer. The existing real Next/Chromium/3-page PDF T1–T30 regressions run before T31. **Signed outcome not assumed until actual final-head CI passes.**
5. None of this mounts on `pages/town/[id].js`, `pages/npcs.js`, `_app.js` or world map; original SQL functions and client are not installed on live DnDWeb. `NEXT_PUBLIC_C34_T28_P2_TOWN_SHOP` remains OFF.

## Forward compatibility / release gates

This step proves only the game-master role equivalence for the covered local source-authenticated systems. It does not yet certify all existing encounter, route/weather, Admin notifications, inventory delegated DML or other hardcoded role checks. Before actual rollout, inventory exact source and per-RPC game-admin authorization gates and coordinate every dependent policy with Stage1–3 and safe frontend readers; ensure role demotion is immediately enforced, separate campaign-scoped permissions from future multi-campaign ownership if needed, and complete independent PostgreSQL plus all Storage restoration.

**Next:** verify genuine signed T31 Actions job, correct only reproducible fixture/provenance errors without erasing old tests, then prepare a town-only mounted research UI probe with the *new* game-manager role semantics and a server-API authorization coverage matrix. Do not merge #379 or write production SQL without a separate release decision.
