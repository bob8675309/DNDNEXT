# C34 B14-P20C-P0 — original Town versus canonical v6 crafting authority

Date: November 22, 2026. Research on draft PR #379 only. NOT a deployed implementation or a signed P20C database test.

## Source-locked findings

| Original checked-in source | Git blob SHA | Evidence |
| --- | --- | --- |
| pages/town/[id].js | c66508b798645e189bb900e63bc17b85b8662e10 | Browser Town handleCraftWorkshop deletes inventory ingredients, inserts a client-crafted result and attempts separate compensating rollback INSERT |
| components/TownSheet.js | 5399097e48f548956807cd93476fefe03e4dee28 | UI builds six services and a client alchemy formula library; canAttempt and recipe tag matching are previews |
| components/CraftingWorkspace.js | e584b7eb1a39e9f6525cbeb3e8e1a477f34ba | Existing canonical /items plan, attempt, approval and completion; dynamic smithing forgeRecipe, selected materials, result item snapshot |
| sql/20260612_90_patch0_crafting_authorization_hardening.sql | d60b0ded3f94cd9f7db9aa687e72ee0fc589c416 | Existing protected craft-plan and attempt wrappers, original Admin-only completion and private function ownership |
| sql/20260613_99_crafting_workflow_v6.sql | 570b2733d3aad5ed02bbe12d288ea52a7e6e352e | Original private completion amendment to deliver items to player records |
| P20B scratch inscribe SQL | 300db43749faa6910aa058c9f32daf42d825abf8 | Accepted local genuine signed narrow atomic Inscribe source, not a general crafting engine |

### Source-original RED: bypass and incomplete materials

The Town route accepts plantMaterialInputs from the client and constructs a local map of player_plants for UI ingredient selection. Its handler does not otherwise process that argument or update/decrement player_plants. Actual inventory consumption occurs via inventory_items DELETE, and the crafted item is client-derived. The following INSERT and attempted rollback INSERT are separate PostgREST requests; there is no server transaction. The forge_mundane service can use a catalog pattern even with no inventory item to consume. Current Town code has no authoritative wallet cost/debit.

TownSheet source recipe requiredTags, secondaryTags, local inferred herb tags, and canAttempt are client-only recommendation/preview signals. They are not authority to mint the potion. The original Town recipe previews permit substitutions with adjusted DC. Neither source proves that the server validates recipe ownership, physical ingredient quantities, price, or player currency.

### Preserve the existing canonical crafting system

The separate CraftingWorkspace uses craftPlanInsertPayload and craftPlanRpcPayload and RPCs submit_craft_plan, submit_crafting_attempt_report and complete_craft_plan_v1. Its direct craft_plans INSERT is tried before the RPC. The checked-in 2026-06-12 wrappers clamp caller identity/status and restrict completion to original Admin or service_role. They delegate detailed work to private implementation functions, which MUST be inspected in their source-original definitions before claiming that material quantity, recipe discovery or currency are enforced. The existence of the wrapper is not proof of complete economic authorization. Existing dynamic Smithing patterns explicitly say material cost determined by the DM; do not invent a GP amount or infer that missing cost means free.

The earlier 2026-08-01 source pipeline documentation records historical physical Smithing plan, attempt, completion, equipment and tactical smoke evidence. Preserve that rather than create a competing generic craft flow.

## P20C-P0 research-only transport prototype

Research-only scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p20c_town_craft_intent_research.mjs checks a deliberately limited untrusted input shape: nonce, town, crafter, recipe key, original service identifier, existing owned primary item identifier where relevant, and separate inventory_items or player_plants row identifiers, ingredient lanes and requested integer quantities. It rejects client-supplied item names, outputs, card payloads, price, user/recipient, skill roll, role, GM override and duplicate ingredients. It is deliberately not imported into gameplay and is NOT crafting authorization.

Positive P20C-P0 source tests pin actual original Git blob SHAs. Negative tests preserve original Town browser resource/rollback RED, P20A/P20B integration boundaries, invalid quantity, spoofing, missing recipe family, forged catalog and unsupported free forge shape. P20C-P0 tests are static/pure only. signed PG17 NOT RUN for P20C. The prior P20A/P20B signed local PASS applies ONLY to their separately pinned older executable heads.

## Owner-approved required server contract for P20C-P1 and later

- Actor and current Admin/GM/DM role verified server-side, with separate creator/edit/inventory/convert/control rights, true recipient ownership and physical present crafter. Do not trust user_metadata or a client admin flag.
- Server-owned canonical recipe, allowed known recipe/discovery/profession, selected inventory_items and player_plants source row identity, quantities, actual owned balances, material cost and numeric wallet/GP price. Missing price/recipe authority must fail closed, not become a zero-cost exception.
- Source-qualified attempt/DC/success and source-computed item output. One transaction and deterministic locks for source consumption, partial plant-stack decrement, wallet debit, output and durable receipt; failure and concurrent retry leave source/currency unchanged.
- Separately authorized, audited GM/DM/Admin override with a required reason, actor, recipient, allowed source item, exact bypassed validation and transaction/nonce. No player-provided override flag, ad hoc browser role or direct arbitrary item insert. Preserve legitimate approved non-catalogue GM grants via an explicit reviewed manager action.
- Source-original June v6 private completion body, current alchemy recipes, player_plants schema, wallet price authority, merchant purchase/stock/trade/consent, October Forge v3, held #345 Stage4 all four RLS and owner CHECK, 22 untested legacy account sheet writers and independent encrypted PG17 + 340 Storage objects are separate release gates.

## Status and next task

P20C-P0 source/pure tests and handoff pending CI until an actual green Actions receipt is reviewed. No new SQL candidate, no live SQL, no gameplay runtime change, no main merge, no world-map touch, no production migration, no agent activation. The 38 previously open drafts and closed unmerged #320–323 remain preserved.

ONE NEXT P20C-P1: inspect source-original private.complete_craft_plan_v1_impl, public.player_plants stock/owner schema and wallet cost data; prepare the smallest genuine signed PG17 fail-closed existing-plan transaction; prove real recipe and stock/currency rollback and a separate reason-audited GM override before proposing any runtime cutover.

NO hosted SQL, including SELECT. No world-map change, game deployment, main merge, or branch deletion.
