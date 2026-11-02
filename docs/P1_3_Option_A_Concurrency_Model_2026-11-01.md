# P1.3 — TC1 Option A Two-Session PostgreSQL 16 Model

**Research / isolated test only.** This uses a disposable \`postgres:16\` GitHub service with \`p13_lock_sandbox\` and a scratch \`p13_sandbox\` schema. It does not install or execute real DnDNext encounter RPCs and never connects to DnDWeb. A passing test is **not proof of a safe production transaction order**.

Following the owner-approved [TC1 Option A](TACTICAL_ENCOUNTER_OWNER_DECISIONS.md), the model tests eight cases:

1. Two competing GM encounter activations sharing one character: **exactly one commits** and one rejects with \`TC1_CONFLICT\`.
2. Independent characters: both separate encounters activate.
3. Two competing encounters stage two characters in reversed order: sorted canonical locks prevent an ordering race in this limited model.
4. Existing two-active-encounter overlap: neither historic record changes; third activation fails.
5. Forced exception after UPDATE: whole transaction rolls back; a later retry may succeed.
6. Idempotent repeat: already-active status does not increment revision.
7. Opposed synthetic L→E and E→L SQL sequences: PostgreSQL detects an expected deadlock in synthetic lock tables, demonstrating the class-order hazard, **not an observed DnDNext deadlock**.
8. Uniform E→L SQL sequences: two independent transactions commit without a lost update in synthetic tables.

**Important design limitation:** the model locks **canonical character before encounter**, and its simple rule is NOT a globally selected E/P/L/W/S/C order. It omits actual Supabase Auth, SQL SECURITY DEFINER functions, trigger-induced HP/slot changes, read visibility, dynamic participant additions, historical reconciliation and pause/resume lifecycle. The model checks two sessions/transaction behavior but **cannot complete P1.3 or P1.5**.

**Test status:** This documentation is created before the exact-head GitHub CI run. Run \`bash scripts/fixtures/p1_3_option_a_pg16.sh\` only against local \`p13_lock_sandbox\` after initializing the SQL. CI workflow: \`.github/workflows/validate-p1-3-pg16.yml\`. Record exact run/result in the handoff log when available.

**Next task:** obtain the actual CI evidence and expand the model using real server function/trigger dependencies, then design and validate consistent global transaction order under all legacy and candidate writers. Do not change production SQL or merge draft #317 without a separate approval.
