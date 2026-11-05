# P1.3 — TC1 Option A Two-Session PostgreSQL 16 Model

**Research / isolated test only; tested PASS in GitHub [run 41385726293](https://github.com/bob8675309/DNDNEXT/actions/runs/41385726293) at commit `cd2c070ac6e64fdf28e7755d264d60ea6f8d3df8`.** The job logs explicitly show all eight scenarios and an intentional PostgreSQL-reported deadlock only in synthetic L/E tables. This uses a disposable `postgres:16` GitHub service with `p13_lock_sandbox` and a scratch `p13_sandbox` schema. It does not install or execute real DnDNext encounter RPCs and never connects to DnDWeb. A passing test is **not proof of a safe production transaction order**.

Following the owner-approved [TC1 Option A](TACTICAL_ENCOUNTER_OWNER_DECISIONS.md), the model tests eight cases:

1. Two competing GM encounter activations sharing one character: **exactly one commits** and one rejects with `TC1_CONFLICT`.
2. Independent characters: both separate encounters activate.
3. Two competing encounters stage two characters in reversed order: sorted canonical locks prevent an ordering race in this limited model.
4. Existing two-active-encounter overlap: neither historic record changes; third activation fails.
5. Forced exception after UPDATE: whole transaction rolls back; a later retry may succeed.
6. Idempotent repeat: already-active status does not increment revision.
7. Opposed synthetic L→E and E→L SQL sequences: PostgreSQL detects an expected deadlock in synthetic lock tables, demonstrating the class-order hazard, **not an observed DnDNext deadlock**.
8. Uniform E→L SQL sequences: two independent transactions commit without a lost update in synthetic tables.

**Important design limitation:** the model locks **canonical character before encounter**, and its simple rule is NOT a globally selected E/P/L/W/S/C order. It omits actual Supabase Auth, SQL SECURITY DEFINER functions, trigger-induced HP/slot changes, read visibility, dynamic participant additions, historical reconciliation and pause/resume lifecycle. The model checks two sessions/transaction behavior but **cannot complete P1.3 or P1.5**.

**Actual test result:** GitHub [job 125086003890](https://github.com/bob8675309/DNDNEXT/actions/runs/41385726293/job/125086003890) was SUCCESS on `cd2c070`. Logs show case headings 1–8, both competing-activation conflict cases, rollback exception, `deadlock detected` (synthetic negative control), and terminal PASS. Other existing CI also passed at that head. The disposable model's character-first lock order is **not** approved for deployment. Local reproduction requires Postgres 16 and `p13_lock_sandbox`; initialize the SQL then run `bash scripts/fixtures/p1_3_option_a_pg16.sh`.

**Next task:** obtain the actual CI evidence and expand the model using real server function/trigger dependencies, then design and validate consistent global transaction order under all legacy and candidate writers. Do not change production SQL or merge draft #317 without a separate approval.
