# I2J nested Origin feat disposable schema contract — 2026-11-25 CST

Previous exact HEAD `43cfd8b20c9c6ccbad058adba26e4bd36c61f008`: source custody workflow [45753963070](https://github.com/bob8675309/DNDNEXT/actions/runs/45753963070/job/139688086623), actual node test step 18/18 passed, zero failures/skips. Tactical 45753962964 and docs 45753962943 also passed. Existing source body dispositions remain six exact, four mismatched, one unlocated; source-only, not signed.

This additive checkpoint generates a standalone schema-only scratch fixture from four immutable Git blobs and runs seven SQL constraint assertions on disposable PG17 in its own branch-scoped workflow. No private recovered bodies, live SQL, secrets, Auth service, app data, or original runner modifications. PG17 image tag pins major only; server version printed. Local environment lacks psql/Docker, so actual test execution requires exact-head CI. Pending at authoring.

## Provenance

- `sql/20260711_01_canonical_spell_class_and_character_option_catalogs.sql` blob `43e6261e4dd906d713e4a53150b37e0a5d1e6abc`
- `sql/20260706_01_spell_catalog_foundation.sql` blob `7efab442b46b0b055dfde6d197254c68c286d7b1`
- `sql/20260808_01_character_option_grant_instances.sql` blob `e6482a248ff16ffff91dda1fc772c42c2d63fd77`
- `sql/20260808_08_character_spell_source_identity.sql` blob `3f9192c21fc709332a3ee62bc01383099f1219ad`

The generator extracts five existing table DDL statements, historical spell-label unique index, and entire pinned source-identity migration (on empty scratch table), adds only synthetic auth.users and characters primary-key prerequisites and RLS flags for grants. No materializer, trigger graph, preferred views or effective role policy claimed. The fixture is separate from existing P1.3 signed Auth runner, not a replacement for it.

## Cases

1. Legacy presence grant uniqueness per character and option.
2. Repeatable feat instance identity, independent character.
3. Duplicate instance, JSON choice shape and acquisition-level constraints.
4. Independent class and feat spell grant identity and limited-use fields.
5. Both existing spell source-key and source-label unique indexes, including overlap for same-label distinct feat instances; preservation, not design acceptance.
6. Foreign-key restriction/rollback and RLS flags, not actual policy equivalence.
7. Synthetic rows rolled back.

Original spell-label unique index may constrain distinct repeatable Magic Initiate instances granting the same spell under the same label, despite different source keys. Do not remove either index or claim an application bug based on a schema-only characterization; actual restored source and full transaction must be reviewed first. Alert first, Magic Initiate separate.

**ONE NEXT:** verify exact-head CI execution and any errors; integrate the reviewed schema prerequisites into a separate signed nested acquisition fixture after exact validator custody is resolved. Existing Git bodies usable only within proven bounds; differing restored validator bodies remain private pending explicit source transfer review. No signed result, no legacy writer count upgrade, no release/retirement approval. Preserve original PRs and final independent audit gate.
