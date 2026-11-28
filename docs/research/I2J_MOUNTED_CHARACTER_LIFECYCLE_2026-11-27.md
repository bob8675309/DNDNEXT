# Mounted Story Forge to signed advancement

## Scope

The isolated branch is based on owner I2J `fb85b7564c0fc0acc510abe930a7ea48aa9a9104`. It reuses the existing I1-H disposable PostgreSQL 17, GoTrue and PostgREST workflow, the previously verified same-character LIFE assertions and the C3F browser harness architecture. The latter's existing files and assertions stay untouched. The mounted variant adds an opt-in hook on the isolated ref. No application runtime or dependency manifests change.

The harness bundles the actual `NewNpcModalV3.js` and `CharacterLevelUpChoices.js` and mounts them in Chromium. A synthetic signed player and one persisted character ID cross all three write boundaries. The harness captures the browser's original HTTP requests and asserts the Story and v5 entry points explicitly. It also checks intermediate canonical PostgreSQL state through the retained LIFE assertions, including direct signed negative responses and atomic rollback. The same browser session signs the assignment-based resource RPC.

The test begins with a hydrated Forge draft. The species, Merchant background, Warlock class, bonuses, class skills and synthetic portrait are prefilled. Live read contracts and actual client serializers still process those values. The browser completes origin languages, Pact of the Blade, starting spells, stock purchase and private Story, then submits through the mounted Forge. The disposable catalog is reduced to source-keyed specimens and synthetic spells, skills and stock. XP and review session identities are prepared by the inherited fixture. The browser calls the pinned original begin and review RPCs to refresh and read each session before mounting the original choice component. Remaining advancement choices are made in the component.

The read module extracts public, blob-pinned functions for equipment, recovery, begin/review, class options and replacement options. It extends only the disposable catalog projections and installs the original assignment visibility policy with read-only column access. Stock reads are limited to visible fixture storefronts. The previous scratch writer-side mirror/provenance and final-state compositions remain visible in LIFE coverage. The fixture still omits a blank Forge draft, mount of a whole Next route, the tactical casting flow and full catalog or restored-schema parity.

## Commands and results

- Node `22.23.5` with `node --check` for the four modified ESM modules. The existing I1D manifest, immutable creation replay and private Profile validators also passed.
- C3F-style esbuild browser bundle preflight with loopback URL and a static placeholder anon key.
- GitHub Actions on the isolated ref uses the existing I1-H workflow commands below. Fixture loading, disposable key discovery and branch-scoped flags are in the workflow.
- `git diff --check` and exact-head patch validation.

```bash
npm ci --ignore-scripts --no-audit --no-fund
npx --yes supabase@2.120.0 start -x realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
node scripts/test_i1g_warlock_original_guards_joint_local_auth.mjs
npx --yes supabase@2.120.0 stop --no-backup
docker ps -a --filter name=i1h-warlock-original-acquisition-local-only --format '{{.Names}}'
```

The browser job uses Playwright Core 1.56.1 and esbuild 0.25.12 in the runner's temporary directory, without application manifest or lockfile edits. The Cloud health-check restriction is unchanged; signed validation uses GitHub Actions.

The first two exact-head runs reached the mounted read setup and failed its no-write privilege assertion. The temporary Supabase database automatically granted broader table privileges on fixture tables. The replacement setup explicitly revokes those default grants from the browser roles before applying the intended catalog and owner-visible assignment reads. Both runs stopped and confirmed container absence. [First job 140871857619](https://github.com/bob8675309/DNDNEXT/actions/runs/46110218265/job/140871857619) · [Second job 140872091377](https://github.com/bob8675309/DNDNEXT/actions/runs/46110295912/job/140872091377)

With closed write privileges, Chromium reached Equipment. The actual merchant API returned `403` because the I1-H column ACL lacked `storefront_title` and `storefront_tagline`. The fixture adds those two public display reads while retaining character RLS and keeping Story access separate. [Job 140872532649](https://github.com/bob8675309/DNDNEXT/actions/runs/46110436837/job/140872532649)

After the merchant read was composed, a real Story POST reached the original guard. It returned `P0001` because the mounted draft had supplied zero Invocation instances. The next driver exercised the original Training picker. The first attempt timed out on a hidden summary because the Training view starts on the Skills tab. The driver now opens Class Choices and uses its Current Selection action. The disposable schema also installs the exact original catalog read policy from `20260808_20_class_feature_option_catalog.sql` (blob `a85095a1ef550c7f1c32aa83424a0d2bba82a468`). The underlying catalog retains read-only grants for the signed browser actor. [Original guard rejection](https://github.com/bob8675309/DNDNEXT/actions/runs/46110709702/job/140873382906) · [Hidden Training summary](https://github.com/bob8675309/DNDNEXT/actions/runs/46111057554/job/140874458091)

The Class Choices tab fix revealed a successful but empty catalog read under the reduced fixture's RLS, confirming the need for the original read policy. [Empty catalog run](https://github.com/bob8675309/DNDNEXT/actions/runs/46111275666/job/140875132797)

With that policy, exact executable `860067ebc2de2e2b50c5cc2523283f58707f1ae0` passed MOUNT-01. The same character got a successful v5 level-two response and matching component callback. The run then failed at the test's exact object comparison because the mounted form serialized inactive Invocation and replacement fields as empty arrays. The comparison now checks every populated field and all source-owned feat choices, including spell and proficiency identities. Successful startup, service stop and independent container absence were confirmed. [Job 140875262416](https://github.com/bob8675309/DNDNEXT/actions/runs/46111317490/job/140875262416)

## Verified executable

Exact executable `fa9f39f1e24ea66609ad4628f5e42fe2dd9dce81` passed the signed job. [Run 46111610570, job 140876174267](https://github.com/bob8675309/DNDNEXT/actions/runs/46111610570/job/140876174267)

| Case | Verified outcome |
| --- | --- |
| MOUNT-01 | Chromium signed into local GoTrue, selected Pact of the Blade from Training and created the Merchant Warlock with Lucky, private Story and a starting stock purchase through the genuine Story RPC. |
| MOUNT-02 | The same character ID received a successful signed v5 response for level two. The incomplete browser form sent no write. The successful captured request contained distinct Lessons slots for Magic Initiate and Skilled and matched the expected spell list, casting ability, spell identities and proficiencies. |
| MOUNT-03 | The same signed browser session consumed the 1/1 Magic Initiate resource by assignment ID. The canonical record and resource receipt showed 0 remaining. |
| MOUNT-04 | The same character ID received a successful signed v5 response for level three. The selected replacement targeted Magic Initiate's original slot and chose Armor of Shadows. Skilled, Lucky, unrelated spells and proficiency ownership survived. |
| MOUNT-05 | The browser sent the four expected writes. Both advancement requests used v5. No uncaught browser errors, failed Supabase requests, transport failures or external requests were recorded. |
| I1H-01–08 and LIFE-01–04 | The signed job ran the original Warlock guards, Story attribution, stock/inventory, original deferred-validator failure and rollback, denied operations, resource and replacement checks, and exact creation replay. |
| Teardown | The workflow's stop and independent project-container verification both succeeded. The annotation reports zero remaining I1-H project containers. |

Recorded PostgreSQL fingerprints were v5 `02d74b973a763c53c595be20e35e512f`, Story `6e39477f971c9d40c6726c9f4dbc456e`, creation feat materializer `c27c4181a51cfd018bbb8244e9931550` and the disposable final-state validator `eb612ad057fb35d55d458377c9b2cd4a`. The retained LIFE-02 probe exercises the original validator failure before the scratch final-state candidate enables the successful level-two write.

The mounted component harness uses a synthetic local account, a hydrated draft, a reduced source-qualified catalog, seeded XP and seeded review-session IDs. It does exercise genuine begin/review RPCs. The replacement picker presents two same-label Lessons rows. The driver uses the original getter's stable slot order and asserts the exact target slot on the wire. Browser error checks cover uncaught page exceptions and Supabase traffic. Full-page visuals and static assets, a blank draft, natural XP progression, tactical casting and restored production-schema parity remain outside the verified scope.

**Next engineering action** — Review and incorporate the mounted regression on the owner I2J branch, with exact-head signed validation on the candidate owner commit.


## 2026-11-27 Central — independent owner incorporation

Codex exact executable `fa9f39f1e24ea66609ad4628f5e42fe2dd9dce81`, [signed job 140876174267](https://github.com/bob8675309/DNDNEXT/actions/runs/46111610570/job/140876174267) independently retrieved: actual I1H-01–08, LIFE-01–04, MOUNT-01–05, successful stop and independent no-container notice. Final Codex `4798b848ba803d46c9856dd0abd932b4a0392ed8` differs only in three documentation paths. All nine new public read dependency pins and five preexisting application/harness/source paths match the owner base exactly. Five executable test module blobs adopted unchanged; I1-H workflow admission/opt-in scoped to owner branch, prior PR/manual admission, loopback guards and teardown retained. The non-mounted path remains available when mounted opt-in is absent; the mounted positive operations replace the corresponding direct positives within this opt-in, not a second separate run. Source/read catalog remains reduced; original timing RED, scratch validator, Option A/provenance, seeded draft/XP/session, stable replacement-slot order and direct resource RPC limitations remain explicit. No runtime, private transfer, hosted SQL, production release, original PR retirement or agent changes. Fresh owner exact-head signed CI is pending. **ONE NEXT:** verify owner mounted signed CI, then prepare a fresh-main source/test-only review extraction preserving original #332–334 and #345 dependencies and current main accepted paths; do not retire PRs or transplant protected runtime changes.
