# I1-A — Forge original 31-trigger acceptance ledger (source only)

**Original #324/#335 source-blobs preserved exactly; no production SQL or app runtime.** This research draft copies the free Node-only fixture coverage/receipt workflow and its three supporting scripts, receipt JSON and historic source census from held Forge research. The current main already contains the majority of Forge original source fixtures and signed tests. Do not replace the newer main project-health tooling or #345 private Story/Forge source assertions with older branch code.

Original source blobs:

| File | Git blob SHA |
| --- | --- |
| .github/workflows/forge-trigger-acceptance-audit.yml | e752a5cc2626346726db3a86c56ffda0c9ae8ddd |
| scripts/agents/forge_automation_selftest.mjs | 6d4dc315449958a3862130de739ed691773b00cf |
| scripts/agents/forge_trigger_acceptance_ledger.mjs | 3a12039f69d25eb968b37eda39c09839a13cb8ae |
| scripts/agents/forge_trigger_acceptance_receipts.json | ddcd17bc15aaf4f75e8c0aa07c7faed69f86fe5e |
| scripts/agents/forge_trigger_audit.mjs | d5fbf344c5e92f8dc3e620806baded0fbb31f7ae |
| docs/Forge_Original_Creation_Trigger_Coverage_2026-11-05.md | 5d3a32c5b6661e47b36794bfe7723296c4b0631b |

Run node scripts/agents/forge_automation_selftest.mjs and node scripts/agents/forge_trigger_acceptance_ledger.mjs . research-agent-artifact. The GitHub workflow runs these at free CI tier and uploads a short, ephemeral report. No network/SQL/auth call is performed. The original census lists 31 creation-adjacent triggers: 19 progression, four sheets, six characters and two inventory items. A textual fixture declaration is NOT execution proof. The original receipts JSON records only three specific JWT test receipts for tags/portrait/subclass handlers and is not a full acceptance inventory.

Evidence boundaries: The later #335 research branch described 17 of 31 original trigger DDL staged in its disposable test schema. #345 separately tested two other original paths; 19 of 31 across different fixtures is NOT an integrated fixture or live release guarantee. Retain all original positive, negative, failure and true-JWT/Chromium evidence from #328–#335. The docs-only full SHA/path reconciliation and I0–I6 owner plan are in [draft #348](https://github.com/bob8675309/DNDNEXT/pull/348).

Next joint test after exact-head free CI: #324 creation nonce hashes the v3 payload plus spell and magic arrays; #345's creator-private Story parameter is outside that digest and the Story insert uses conflict-DO-NOTHING to avoid stale overwrites. Test same-nonce/different-only-Story behavior in isolated original-source PG17 with genuine GoTrue before composing migration semantics. Preserve current creator/GM/coeditor/inventory/outsider ACL boundaries and duplicate-free equipment, spell, stock and currency effects.

Do not run source candidate SQL on DnDWeb, merge main, deploy, alter world-map presentation or activate #325 paid agent merely because the scanner passes.
