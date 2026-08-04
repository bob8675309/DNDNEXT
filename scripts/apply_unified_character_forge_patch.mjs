import fs from "node:fs";

const target = "components/NewNpcModalV3Refined.js";
let source = fs.readFileSync(target, "utf8");

function replaceOnce(from, to, label) {
  const first = source.indexOf(from);
  if (first < 0) throw new Error(`Unified forge patch missing ${label}`);
  if (source.indexOf(from, first + from.length) >= 0) throw new Error(`Unified forge patch found duplicate ${label}`);
  source = source.slice(0, first) + to + source.slice(first + from.length);
}

if (source.includes("unified-character-forge-player-mode")) {
  console.log("Unified character forge patch already applied.");
  process.exit(0);
}

replaceOnce(
  "function initialDraft() {",
  "function initialDraft({ mode = \"npc\", defaultName = \"\" } = {}) {\n  const playerMode = mode === \"player\";",
  "initialDraft signature",
);
replaceOnce(
  "    name: \"\", gender: \"neutral\", kind: \"npc\", role: \"\", affiliation: \"\",",
  "    name: safeText(defaultName), gender: \"neutral\", kind: \"npc\", role: \"\", affiliation: \"\",",
  "default character name",
);
replaceOnce(
  "    tags: [], locationId: \"\", storefrontEnabled: true, storefrontTitle: \"\", storefrontTagline: \"\",",
  "    tags: playerMode ? [\"player-character\"] : [], locationId: \"\", storefrontEnabled: !playerMode, storefrontTitle: \"\", storefrontTagline: \"\",",
  "mode defaults",
);
replaceOnce(
  "export default function NewNpcModalV3Refined({ show, onClose, onCreated, locations = [] }) {",
  "// unified-character-forge-player-mode\nexport default function NewNpcModalV3Refined({\n  show,\n  onClose,\n  onCreated,\n  locations = [],\n  mode = \"npc\",\n  defaultName = \"\",\n  embedded = false,\n}) {\n  const playerMode = mode === \"player\";",
  "component signature",
);
replaceOnce(
  "  const [draft, setDraft] = useState(() => initialDraft());",
  "  const [draft, setDraft] = useState(() => initialDraft({ mode, defaultName }));",
  "draft initialization",
);
replaceOnce(
  "    setStep(0); setDraft(initialDraft()); setCreating(false); setLoadingCatalogs(false); setCatalogError(\"\"); setError(\"\");",
  "    setStep(0); setDraft(initialDraft({ mode, defaultName })); setCreating(false); setLoadingCatalogs(false); setCatalogError(\"\"); setError(\"\");",
  "draft reset",
);
replaceOnce(
  "gender: draft.gender, level: Number(draft.level || 1), creator: \"npc_forge_v3\", creationRequestId: draft.creationRequestId",
  "gender: draft.gender, level: Number(draft.level || 1), creator: playerMode ? \"player_character_forge_v2\" : \"npc_forge_v3\", creationRequestId: draft.creationRequestId, startingSpellSelectionPending: playerMode && Boolean(castingAbility)",
  "creator metadata",
);
replaceOnce(
  "      affiliation: safeText(draft.affiliation) || null,\n      creation_request_id: draft.creationRequestId,",
  "      affiliation: safeText(draft.affiliation) || null,\n      tags: playerMode ? uniqueText([...(base.tags || []), \"player-character\"]) : base.tags,\n      kind: playerMode ? \"npc\" : base.kind,\n      storefront_enabled: playerMode ? false : base.storefront_enabled,\n      location_id: playerMode ? null : base.location_id,\n      home_location_id: playerMode ? null : base.home_location_id,\n      is_hidden: playerMode ? true : base.is_hidden,\n      state: playerMode ? \"resting\" : base.state,\n      creation_request_id: draft.creationRequestId,",
  "player payload overrides",
);
replaceOnce(
  "selectedSkillKeys, selectedSpecies]);",
  "selectedSkillKeys, selectedSpecies, playerMode]);",
  "payload dependencies",
);
replaceOnce(
  "    if (index === 2) { if (!selectedClass) errors.push(\"Choose a class or No Adventuring Class.\"); if (Number(draft.level || 0) < 1 || Number(draft.level || 0) > 20) errors.push(\"Level must be between 1 and 20.\"); }",
  "    if (index === 2) { if (!selectedClass) errors.push(playerMode ? \"Choose an adventuring class.\" : \"Choose a class or No Adventuring Class.\"); if (playerMode && selectedClass?.class_key === \"civilian\") errors.push(\"Player characters require an adventuring class.\"); if (Number(draft.level || 0) < 1 || Number(draft.level || 0) > 20) errors.push(\"Level must be between 1 and 20.\"); }",
  "class validation",
);
replaceOnce(
  "      PROFESSION_KEYS.forEach((key) => { const profession = draft.professions?.[key] || {}; if (profession.offersService && Number(profession.rank || 0) === 0) errors.push(`${PROFESSION_DEFINITIONS[key].label} must be trained before this NPC can offer it as a service.`); });",
  "      if (!playerMode) PROFESSION_KEYS.forEach((key) => { const profession = draft.professions?.[key] || {}; if (profession.offersService && Number(profession.rank || 0) === 0) errors.push(`${PROFESSION_DEFINITIONS[key].label} must be trained before this NPC can offer it as a service.`); });",
  "profession validation",
);
replaceOnce(
  "    if (index === 5) { if (!safeText(draft.name)) errors.push(\"Enter or generate a name.\"); if (!safeText(draft.role)) errors.push(\"Enter a role or title so the roster remains useful.\"); if (!draft.portraitLibraryId) errors.push(\"Choose a portrait for this character.\"); }",
  "    if (index === 5) { if (!safeText(draft.name)) errors.push(\"Enter or generate a name.\"); if (!playerMode && !safeText(draft.role)) errors.push(\"Enter a role or title so the roster remains useful.\"); if (!draft.portraitLibraryId) errors.push(\"Choose a portrait for this character.\"); }",
  "identity validation",
);
replaceOnce(
  "      const rpcPromise = supabase.rpc(\"create_character_v1\", { p_payload: createPayload });",
  "      const rpcPromise = playerMode\n        ? supabase.rpc(\"create_player_character_v2\", { p_payload: createPayload, p_spell_choices: [] })\n        : supabase.rpc(\"create_character_v1\", { p_payload: createPayload });",
  "creation RPC",
);
replaceOnce(
  "  return <div className=\"npc-forge-backdrop\" role=\"presentation\"><div className=\"npc-forge-modal npc-forge-modal-v2\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"npc-forge-title\">",
  "  const forge = <div className={`npc-forge-modal npc-forge-modal-v2 ${playerMode ? \"is-player-character-forge\" : \"\"}`} role=\"dialog\" aria-modal=\"true\" aria-labelledby={playerMode ? \"player-forge-title\" : \"npc-forge-title\"}>",
  "forge root",
);
replaceOnce(
  "    <header className=\"npc-forge-header\"><div><div className=\"npc-forge-kicker\">Canonical character system</div><h2 id=\"npc-forge-title\">NPC Forge</h2><p>Build the rules first, then finish identity and placement. Story generation uses the identity you establish before it.</p></div><button type=\"button\" className=\"btn btn-sm btn-outline-light\" onClick={handleClose} disabled={creating}>Close</button></header>",
  "    <header className=\"npc-forge-header\"><div><div className=\"npc-forge-kicker\">Canonical character system</div><h2 id={playerMode ? \"player-forge-title\" : \"npc-forge-title\"}>{playerMode ? \"Player Character Forge\" : \"NPC Forge\"}</h2><p>{playerMode ? \"Use the shared Forge to build a player-owned character at the campaign-approved starting level.\" : \"Build the rules first, then finish identity and placement. Story generation uses the identity you establish before it.\"}</p></div><button type=\"button\" className=\"btn btn-sm btn-outline-light\" onClick={handleClose} disabled={creating}>Close</button></header>",
  "forge header",
);
replaceOnce(
  "    <nav className=\"npc-forge-steps\" aria-label=\"NPC creation steps\">",
  "    <nav className=\"npc-forge-steps\" aria-label={playerMode ? \"Player character creation steps\" : \"NPC creation steps\"}>",
  "forge navigation",
);
source = source.replaceAll(
  "{draft.kind === \"merchant\" ? \"Merchant\" : \"NPC\"}",
  "{playerMode ? \"Player Character\" : draft.kind === \"merchant\" ? \"Merchant\" : \"NPC\"}",
);
replaceOnce(
  "<span>Role / title *</span>",
  "<span>Role / title {playerMode ? \"(optional)\" : \"*\"}</span>",
  "role label",
);
replaceOnce(
  "{creating ? \"Forging Character...\" : `Create ${draft.kind === \"merchant\" ? \"Merchant\" : \"NPC\"}`}",
  "{creating ? \"Forging Character...\" : `Create ${playerMode ? \"Player Character\" : draft.kind === \"merchant\" ? \"Merchant\" : \"NPC\"}`}",
  "create button label",
);
replaceOnce(
  "  </div></div>;\n}",
  "  </div>;\n\n  return embedded ? forge : <div className=\"npc-forge-backdrop\" role=\"presentation\">{forge}</div>;\n}",
  "forge return",
);

fs.writeFileSync(target, source);
console.log("Applied shared NPC/player character Forge mode.");
