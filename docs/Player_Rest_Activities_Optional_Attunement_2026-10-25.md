# Player Rest Activities and Optional Attunement — Current Product Direction

**Owner clarification: 2026-10-25. Highest-priority requirement for rest and attunement UI.** This supersedes the proposed complexity of the #260–#265 attunement-evidence stack. It does not erase their historical tests or authorize any deployment.

## Player magic-item selector — validated draft PR #268

[Draft PR #268](https://github.com/bob8675309/DNDNEXT/pull/268), based on [#267](https://github.com/bob8675309/DNDNEXT/pull/267), integrates the tested rest-activity popup from separate [#266](https://github.com/bob8675309/DNDNEXT/pull/266). **All five exact-head checks passed** at `14ff07e331723022a489ecb811ffc1ea26e4fb77` (PostgreSQL16, source contracts, app/build validations, Vercel comments). It is **draft/unmerged/undeployed**.

- With optional attunement OFF (default), the player sees no magic-item selection activity, and Short/Long Rest continues to call the ordinary canonical recovery RPC. The ON-only **Attune / Change Magic Items** activity lists equipped magic sources and permits selecting up to **three**.
- New guarded PostgreSQL commands `get_character_rest_magic_choices_v1` / `set_character_rest_magic_choices_v1` check authenticated character permissions, per-item equipped status, catalogue/VAR source-key coherence, unique character inventory custody, active combat, campaign ON mode, and a maximum of **three distinct selected IDs** under serialized transactions. Ownership transfer or unequipping clears stale selections. No inventory or slot mutations are performed; shared-account ambiguous items and unknown sources are disabled.
- **Current consumer boundary:** saved selections **do not yet change any magical bonuses**. RPC responds `effectsEnforced=false`. When Admin turns ON with more than three already-equipped magical items, no items are deleted/unequipped and no bonuses are silently suppressed. The later effect-source consumer pass must honor OFF-mode parity and ON-mode item eligibility across sheet/spells/tactical before this is a complete gameplay rule.
- Reconcile overlapping independent rest popup PR #266 and Admin configuration PR #267 before merge; PR #268 intentionally carries #266 UI code because its base is #267, but it must **not** generate duplicate PR merges. Keep strict attunement #257–#265 as superseded research, not dependencies.

[PR #268 detailed source/readiness status](https://github.com/bob8675309/DNDNEXT/blob/feature/rest-magic-selection-20261025/docs/Optional_Rest_Magic_Item_Selection_2026-10-25.md).


## Admin optional-attunement setting — validated draft PR #267

[Draft PR #267](https://github.com/bob8675309/DNDNEXT/pull/267) is a **main-based, separate replacement setting** for the superseded #257 capacity prototype. Tested head `ab54907259974288bba5855d60703e19f4a17458` passed **five** exact-head checks (PostgreSQL16, source contract, application builds and preview comments).

- Adds `campaign_item_pool_settings.attunement_enabled` (default **false**) and a database-constrained `attunement_max_items = 3`, preserving `future_tech_enabled`. Admin Dashboard gets an **Enable attunement limit** switch showing authoritative ON/OFF and cap.
- The update RPC `set_campaign_attunement_rule_v1` demands a signed-in admin; ordinary players, anonymous callers and service credentials without an admin principal cannot change it. Direct browser UPDATE grants remain denied. Missing migrations or request errors are reported, not silently treated as a successful OFF state.
- **This is configuration, not enforcement.** At this checkpoint a GM can store ON (three-item policy configured), but no player attunement choices, magic-effect suppression, NPC equipment rules, or existing inventory/bonus calculations are changed. The Admin card states this limitation explicitly. Keep the PR **draft/undeployed** until the user has reviewed non-destructive ON transition, picker, cap enforcement and consumer parity.
- PR #266's rest-activity popup is a separate draft with `attunementEnabled=false` until a real eligible item-selection action exists. Ordinary Rest & Recover stays independent of the toggle.

[PR #267 implementation and outstanding gates](https://github.com/bob8675309/DNDNEXT/blob/feature/optional-attunement-admin-setting-20261025/docs/Optional_Attunement_Admin_Setting_2026-10-25.md).

## Implemented draft UI checkpoint — PR #266

Draft [PR #266](https://github.com/bob8675309/DNDNEXT/pull/266) is **independent of the superseded #257–#265 attunement stack** and based on main. Its current implementation at `cf40e453872af39e352e65baf3f2adb84c0570fc` passed both repository/build validation jobs and the Vercel Preview Comments check.

- The existing Short/Long Rest buttons remain in `CharacterSheetResourceTracker`. `CharacterSheetEnhancements` opens a single **Camp & Downtime** activity dialog instead of `window.confirm`; **Rest & Recover** deliberately invokes the **unchanged** `complete_character_rest_v1` with the correct rest type.
- Rest is still disabled by the existing Character Sheet encounter state and guarded by the server's canonical active-encounter rest protection. RPC failures leave the dialog open with an error; a synchronous submit lock prevents accidental rapid double submission.
- **Crafting** is presented as a disabled coming-later activity. The component supports a gated informative attunement placeholder but passes `attunementEnabled=false` and exposes **no active attunement action** today. No admin ON/OFF toggle or magic cap is deployed.
- The dialog uses purple/dark sheet styling, responsive layout, focus trap/return, Escape, cancel, backdrop dismissal and print exclusion. An actual player/admin browser visual and combat smoke test is **still required**. No SQL, crafting, NPC, encounter, map or AI changes were made.

[PR #266 detailed implementation ledger](https://github.com/bob8675309/DNDNEXT/blob/fix/rest-button-copy-and-combat-contract-20261025/docs/Rest_Activity_Popup_Status_2026-10-25.md). Next separately draft the OFF-by-default **Enable Attunement** admin option and genuine three-magic-item capacity enforcement; do **not** repurpose the older `unlimited_attunement_enabled` prototype's default-on scheme.

## Experience the player should have

- The Character Sheet already has **Short Rest** and **Long Rest** buttons. They call `complete_character_rest_v1`. Keep both as the primary player actions and use the existing restoration authority for eligible spells and class/other limited-use abilities. **Neither requires attunement, DM signoff, a running 60-minute timer, or a prior item-focused rest.**
- **Never allow either rest during active combat.** Both the Character Sheet state and canonical server encounter guard must continue enforcing this, even if the UI is bypassed.
- Clicking either button should eventually open **one simple rest-activity dialog** (consistent with the current Character Sheet), with options such as **Rest & Recover**, **Attune / Change Magic Items** (only when attunement rules are enabled), **Work on Crafting** (not enabled until actual crafting integration), and extensible later activities. Keep the recovery flow obvious and default; a crafting or attunement choice must not silently negate legitimate short/long resource recovery. Avoid extra sequential confirmations unless they prevent a meaningful mistake.
- Resting represents characters stopping to sleep, relax, and engage in suitable camp downtime. Crafting is a future activity within the rest experience; do not implement a duplicate crafting engine in the rest dialog.
- **Future location enforcement:** Long Rest at appropriate camps, inns, towns, and similar safe places; Short Rest may also be allowed in other situations at GM discretion. This is planned for tactical-board and later locations; do not impose map/location checks now. **No world-map or town-map changes** are authorized here.

## Attunement is an optional campaign capacity rule — not a separate rest system

- **Admin Attunement toggle: OFF by default for this campaign.** The GM does not ordinarily use attunement. With the rule OFF, a character's magic equipment functions as allowed by normal inventory/equipment-slot, ownership, source and encounter rules, **without** creating magic-item bonds or going through a rest attunement flow.
- With the rule **ON**, use a simple default **three magic items per character** as the active/equipped attunement capacity, consistent with the earlier three-item setting. Players can choose / change which magic items occupy the limited capacity during the optional **Attune / Change Magic Items** rest activity. This is a campaign-friendly house-rule capacity, not a commitment to enforce every sourcebook-specific attunement prerequisite.
- **Physical equipment placement remains independent:** no unlimited helmets, armor, boots, or weapons. The toggle limits eligible magical-item capacity, **not** the number or kind of body slots.
- The GM must be able to toggle the rule OFF/ON from the **Admin Dashboard** without causing spontaneous equipment deletion or changing item ownership. Plan and test how to handle existing characters with more than three eligible magic items before the ON switch is deployed; do not silently destroy/unequip items or retroactively suppress benefits.
- Do not automatically treat magic items that lack imported `reqAttune` flags as unusable **while the optional rule is OFF**. Exact 2024 item sources and exotic source-specific attunement conditions are no longer a prerequisite for ordinary recovery or the OFF mode.
- Avoid implementing Artificer extended capacity, class exclusions, cursed items and exception rules as prerequisites for the **first simple optional toggle** without another owner decision. Preserve source information for future optional advanced rules.

## What current GitHub draft code gets wrong

- **Draft #257** uses `unlimited_attunement_enabled=false` by default (**Standard 3**) and labels the Admin switch **Unlimited attunement**. The clarified default/UI is **Attunement OFF**; flip semantics and default as part of an explicitly reviewed replacement before release. Its `CharacterAttunementPanel` allows direct item toggles outside a rest. This should become an activity in the rest dialog, not a permanent intrusive sheet block.
- **Drafts #260–#265** add source-specific positive attunement facts, class prerequisites, exclusive focused-world-hour timers, a canonical rest-link bridge and separate authenticated DM evidence/approval. The source/ownership/custody and concurrency tests may be reusable, but **do not merge or ship this stack for the simple campaign rest/attunement experience**. It is overengineered for this requirement. Keep it as historical research until explicitly authorized otherwise.
- **Draft #266** (independent, based on main) adjusts inaccurate Short/Long Rest confirmation copy and source-contract tests; it should not add extra attunement prompts or change the rest RPC.
- The **Common Character Effects Engine** remains a separate source-aware mechanic with real gameplay-consumer parity requirements. The optional attunement toggle should be an eligibility switch **only when ON**, not a condition for the engine to calculate normal magic effects when OFF. Future AI can read authorized state and explain it; it must not grant effects or trigger rests independently.

## Safe implementation order (not a request to deploy)

1. Preserve working two-button rest RPC and combat guard; correct misleading confirmation text (#266 is a separate draft).
2. Show an **actual Character Sheet component-based rest-dialog mockup** and get approval on how Rest & Recover, Attune / Change Magic Items and future Crafting are arranged; maintain existing profile/paper styling and printable sheet.
3. Build an admin **Enable Attunement Limit** OFF/ON toggle (OFF initially, ON 3); review cap-on transition for already equipped magic gear. Verify player, NPC and multiple-character inventory associations without touching unrelated equipment-slot constraints.
4. Wire the optional attune/select action into a rest activity, reusing source/ownership and cap safeguards where helpful, **without** a mandatory minute-by-minute focus timer or generic DM approval step. Keep ordinary Short/Long Rest independent of the opt-in feature.
5. Add isolated Postgres, permission, rest, active-encounter, equipment-slot, attunement-OFF parity and attunement-ON cap tests; then user-approved browser smoke and runtime merge/deployment.

**Source of authority:** owner's explicit product clarification on October 25, 2026, verified current CharacterSheetEnhancements, CharacterSheetResourceTracker, canonical rest and encounter guard, plus draft #257/stack. If older technical documentation conflicts, **this page wins on intended product behavior**; live deployed code continues to win on what actually exists.
