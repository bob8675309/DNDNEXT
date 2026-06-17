// Profession and crafting source-transformer entry point.
const transformers = [
  new URL("patch_professions_canonical_crafting_v2.mjs", import.meta.url),
  new URL("disambiguate_crafting_target_state.mjs", import.meta.url),
  new URL("patch_self_crafting_professions.mjs", import.meta.url),
  new URL("patch_enchanting_workshop.mjs", import.meta.url),
  new URL("patch_enchanting_catalog_consistency.mjs", import.meta.url),
];
for (const transformer of transformers) {
  await import(transformer.href);
}
