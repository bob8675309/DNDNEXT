// Profession source transformer compatibility entry.
const transformers = [
  new URL("patch_professions_canonical_crafting_v2.mjs", import.meta.url),
  new URL("disambiguate_crafting_target_state.mjs", import.meta.url),
  new URL("patch_self_crafting_professions.mjs", import.meta.url),
];
for (const transformer of transformers) {
  await import(transformer.href);
}
