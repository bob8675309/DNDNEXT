# Optional Attunement Admin Setting — staged configuration (2026-10-25)

**Status: draft only, no production SQL deployed.** This is a simpler, main-based replacement direction for the abandoned strict-attunement #257–#265 stack. Independent of the PR #266 rest activity popup and PR #251 common effects math.

## Intent and current implementation

The owner normally plays with **Attunement OFF**. A single card on the Admin Dashboard now exposes **Enable attunement limit**. The new `campaign_item_pool_settings.attunement_enabled` defaults to `false`, and `attunement_max_items` is constrained to **3**. The toggle is stored via `set_campaign_attunement_rule_v1(boolean)`, which requires a **signed-in admin** even from a service-key context, and never exposes table write grants to browser roles. Reading the setting uses the existing authenticated SELECT/RLS policy.

The Admin control loads authoritative values, reports errors rather than pretending the migration is installed, and prevents rapid duplicate submissions. It explicitly states that **configuration is not yet selection/effect enforcement**. No existing magic-item equipment or bonuses are changed when the setting turns ON or OFF. Neither the normal two-button Short/Long Rest nor the world/town map depends on this toggle.

## Exact scope

- **Works in draft:** admin-only ON/OFF configuration, OFF default, limit fixed at three, setting preserved alongside existing future-tech item pool state.
- **Not yet wired:** player item picker during rest; handling characters already wearing 4+ magic items; enforcing magic-item eligibility on the inventory/effect adapter; Artificer/optional house rules; cross-character shared inventory; any item transfer or attunement persistence.
- No claim that turning ON already suppresses a fourth magic item. This must be implemented and parity-tested before shipping an enforceable campaign attunement rule.
- **OFF-mode design:** all legitimate magic effects continue under the existing item/slot/ownership mechanics, with no stored attunement bond required.

## Required next changes before production rollout

1. Build the **rest activity** item selector against canonical character inventory with source-defined magic rarity and explicit player decision. Never use item names alone or count unrelated mundane pieces. Handle stored item selection for players sharing accounts and enforce at most three under concurrency.
2. Design a non-destructive ON transition when already-equipped magic items exceed three: inform admin and request selection, never auto-delete or unequip.
3. Integrate optional ON-only eligibility with numeric, spell, tactical and condition effect consumers as a coherent source-aware patch, while proving OFF parity, mundane armor/shield behavior and existing Resistance → flat DR ordering. Retain current gameplay until safe.
4. Full browser QA of the Admin switch in signed-in player/admin roles, per-character rest popup, network errors and printing. No world map behavior changes.

## Verification

An isolated PostgreSQL16 fixture tests default OFF, max 3 check, admin-only mutation (including service context without auth.uid), denied player and NULL input, idempotent OFF, preserving future_tech_enabled, and no claimed magic enforcement. A Node validator asserts SQL, ACL, admin UI and workflow contracts. No live DB write or production rollout.

## Admin Dashboard readiness refinement — stacked draft (2026-10-25)

A later draft stacked on #271 adds `public.get_campaign_attunement_rule_status_v1()`, a read-only, admin-authorized RPC. It returns the configured ON/OFF value, fixed three-item cap, and separate **selection_ready** and **effects_enforced** server flags. Both flags deliberately remain `false` while the per-character inventory selection and all spell/weapon/AC/tactical consumers are still under review. The dashboard does not infer readiness from source-file presence or a Vercel preview.

The dashboard now reloads this authoritative status instead of silently guessing the migration is installed. A failed or malformed status response disables the switch and shows a retry action. It explains that turning ON the setting **does not yet suppress a fourth magic item's effects**. Attempting to switch ON while effects enforcement is unavailable opens an explicit configuration-only confirmation rather than silently activating unfinished gameplay rules. Switching OFF remains available through the same authenticated admin setter. Any unverified response to a setter fails closed until status is refreshed; no optimistic success assumption.

The isolated Postgres16 fixture now verifies the new read RPC denies anonymous/player accounts, preserves the existing campaign item-pool state, and reports configuration ON/OFF accurately without claiming selection/effect enforcement. It does not apply any SQL to the live project.

**Integration boundaries:** PR #268 introduced a staged selection interface, PR #269 moved presentation into the existing EquipmentDiagram, PR #270 wired verified character inventory selection, and PR #271 staged a shadow effect eligibility filter. These are **draft research/development layers**, not evidence that server-authoritative rest opportunity or real consumer parity is complete. The public user-facing item effect behavior should not be changed until the documented release gates are satisfied. The Admin Dashboard and inventory presentation must not alter world/town maps, equipment custody, equipped slots, or NPC/Forge styling.
