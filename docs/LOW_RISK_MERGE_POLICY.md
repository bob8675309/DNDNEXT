# Standing authorization — low-risk merges

**Owner directive, 2026-11-26 Central:** Relax the previous blanket no-merge rule so minor, non-disruptive changes to non-critical systems may be merged without requesting individual approval each time. The following conservative operating interpretation supersedes older blanket merge restrictions in repository onboarding and write instructions; it does NOT supersede explicit holds on feature PRs, agent-specific permissions, protected systems, or other production restrictions. The owner may revoke or narrow this standing permission at any time.

## Eligible for interactive-assistant merge after all gates pass

- Documentation, navigation, handoff and evidence corrections that preserve history and do not expose private information or change protected authority.
- Comments, narrowly scoped non-executing test/fixture additions and maintenance tooling that cannot affect deployed behavior, CI acceptance requirements, credentials or release/deployment paths.
- Small isolated cosmetic or minor non-critical UI/utility fixes, only where actual source/dependency review and focused tests demonstrate no impact on protected/shared contracts or important workflows. Browser evidence is required for user-facing visual/interaction changes. A small line count is not a measure of risk.

Both main and an authorized research parent may receive eligible bounded changes. The assistant must already have owner-directed authority to work on that branch/subsystem. No unrelated backlog merge, bulk merge, cross-agent branch write, or bypass of a PR-specific hold. A documentation refresh can include a standing policy expressly directed by the owner, not self-granted new powers.

## Mandatory pre-merge gates (all required)

1. Establish owner intent, exact PR, target/base/head, branch ownership and full inherited diff against current main. Review actual changed files and dependencies, preserve all original evidence and feature intent. No hidden inherited changes, unresolved exclusions, mixed-scope or private-source disclosure.
2. Classify by actual effects, not label, filename, number of changed lines or CI badge. Record why the change is low risk; uncertain or unproven scope is HOLD.
3. Inspect exact-head required and relevant checks, job logs and focused regressions; no unresolved failure, pending necessary check, unexplained skip, conflict or unverified mandatory gate. Do not weaken a test or bypass branch protection. Check branch protection/rulesets when accessible; inability to inspect is disclosed, never treated as permission to bypass controls.
4. Ensure straightforward isolated rollback and no data migration, new billing, special deployment step or coordination required. Main merge can automatically trigger ordinary existing Vercel deployment; that incidental deployment is included for eligible low-risk merges only. Manual deployment, promotion or production configuration change still requires specific approval.
5. Re-fetch live main/target/head immediately before merge, use exact expected head and normal PR merge method, no force or override. If base moved or evidence is stale, re-evaluate and revalidate. Verify actual merged state, resulting target SHA and changed-file boundary; check resulting Actions and Vercel source/status if main, report pending verification rather than claiming acceptance prematurely.
6. Record authorization class, rationale, reviewed scope, exact evidence, merge SHA, rollback method, deployment status and one next task in branch-local handoff and report the merge to the owner. Do not close original PRs or delete branches as a side effect beyond normal merge of the exact eligible PR.

## Still requires separate explicit owner approval

Any material gameplay or rules changes; world map (even cosmetic), town/tactical core map or movement; combat, spell execution, character creation/Forge/progression, character sheet authority, inventory/equipment, merchants/economy, rest/resources, NPC privacy, authentication/authorization/RLS/ACL, multiplayer data integrity, database SQL (including hosted SELECT), migration/schema/Storage, production config/secrets, shared API/RPC contracts, dependency/build/runtime infrastructure, CI workflow or required-check changes affecting acceptance/deploy/security/billing, release coordination, destructive operations, original PR retirement, private-source transfer, paid resources/AI, agents and their schedules/ownership. Also any large, risky, unclear, cross-system or explicitly held PR even if tests pass.

Scheduled agents A–D retain their existing exclusive scopes and no-merge restrictions unless the owner separately amends those role-specific live saved instructions. No autonomous merge automation, policy bypass, or expanded agent permissions is created.

**Default:** if all eligibility and evidence gates are satisfied, proceed and report rather than ask for redundant permission. If any gate is uncertain, stop before merging and present the specific risk, missing evidence or required decision. The existing full-PR source preservation protocol remains mandatory.
