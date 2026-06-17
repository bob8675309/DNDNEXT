import fs from "node:fs";
import path from "node:path";

function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source;
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label} expected one match, found ${count}`);
  return source.replace(before, after);
}

const characterPath = path.join(process.cwd(), "utils", "characterCreation.js");
let characterSource = fs.readFileSync(characterPath, "utf8");

characterSource = replaceOnce(
  characterSource,
  `export const ABILITY_LABELS = Object.freeze({\n  str: "Strength",\n  dex: "Dexterity",\n  con: "Constitution",\n  int: "Intelligence",\n  wis: "Wisdom",\n  cha: "Charisma",\n});\n`,
  `export const ABILITY_LABELS = Object.freeze({\n  str: "Strength",\n  dex: "Dexterity",\n  con: "Constitution",\n  int: "Intelligence",\n  wis: "Wisdom",\n  cha: "Charisma",\n});\n\nexport const ALIGNMENT_OPTIONS = Object.freeze([\n  Object.freeze({ key: "LG", label: "Lawful Good" }),\n  Object.freeze({ key: "NG", label: "Neutral Good" }),\n  Object.freeze({ key: "CG", label: "Chaotic Good" }),\n  Object.freeze({ key: "LN", label: "Lawful Neutral" }),\n  Object.freeze({ key: "N", label: "Neutral" }),\n  Object.freeze({ key: "CN", label: "Chaotic Neutral" }),\n  Object.freeze({ key: "LE", label: "Lawful Evil" }),\n  Object.freeze({ key: "NE", label: "Neutral Evil" }),\n  Object.freeze({ key: "CE", label: "Chaotic Evil" }),\n  Object.freeze({ key: "U", label: "Unaligned" }),\n]);\n\nexport const SIZE_OPTIONS = Object.freeze([\n  Object.freeze({ key: "Small", label: "Small" }),\n  Object.freeze({ key: "Medium", label: "Medium" }),\n  Object.freeze({ key: "Large", label: "Large" }),\n]);\n`,
  "character creation constants"
);

characterSource = replaceOnce(
  characterSource,
  `function speciesLabel(speciesKey, customSpecies) {\n  if (speciesKey === "custom") return cleanText(customSpecies) || "Custom Species";\n  return SPECIES_DEFINITIONS[speciesKey]?.label || "Unknown Species";\n}\n`,
  `function speciesLabel(speciesKey, customSpecies) {\n  if (speciesKey === "custom") return cleanText(customSpecies) || "Custom Species";\n  return SPECIES_DEFINITIONS[speciesKey]?.label || "Unknown Species";\n}\n\nfunction normalizeAlignment(value) {\n  const candidate = cleanText(value).toUpperCase();\n  return ALIGNMENT_OPTIONS.some((option) => option.key === candidate) ? candidate : "N";\n}\n\nfunction normalizeCharacterSize(value, speciesKey = "custom") {\n  const candidate = cleanText(value);\n  if (SIZE_OPTIONS.some((option) => option.key === candidate)) return candidate;\n  if (["halfling", "gnome"].includes(speciesKey)) return "Small";\n  return "Medium";\n}\n\nfunction normalizeLanguages(value) {\n  const raw = Array.isArray(value) ? value : String(value || "").split(",");\n  const cleaned = cleanTextArray(raw);\n  return cleaned.length ? cleaned : ["Common"];\n}\n`,
  "character creation normalization helpers"
);

characterSource = replaceOnce(
  characterSource,
  `  const lineage = cleanText(draft.lineage);\n  const hitPoints = maximumHitPoints({ classKey, level, constitutionScore: finalScores.con });\n`,
  `  const lineage = cleanText(draft.lineage);\n  const alignment = normalizeAlignment(draft.alignment);\n  const size = normalizeCharacterSize(draft.size, speciesKey);\n  const languages = normalizeLanguages(draft.languagesText ?? draft.languages);\n  const hitPoints = maximumHitPoints({ classKey, level, constitutionScore: finalScores.con });\n`,
  "character sheet resolved detail variables"
);

characterSource = replaceOnce(
  characterSource,
  `      lineage: lineage || null,\n      backgroundKey,\n`,
  `      lineage: lineage || null,\n      size,\n      alignment,\n      languages,\n      backgroundKey,\n`,
  "character sheet meta details"
);

characterSource = replaceOnce(
  characterSource,
  `    lineage: lineage || null,\n    background: resolvedBackground,\n    proficiencyBonus,\n`,
  `    lineage: lineage || null,\n    size,\n    alignment,\n    languages,\n    appearance: cleanText(draft.appearance),\n    background: resolvedBackground,\n    proficiencyBonus,\n`,
  "character sheet top-level details"
);

characterSource = replaceOnce(
  characterSource,
  `    attacks: cleanText(draft.attacks),\n    equipment: "",\n    spellcasting,\n`,
  `    attacks: cleanText(draft.attacks),\n    equipment: cleanText(draft.equipment),\n    treasure: cleanText(draft.treasure),\n    spellcasting,\n`,
  "character sheet equipment details"
);

characterSource = replaceOnce(
  characterSource,
  `  if (!CLASS_DEFINITIONS[draft.classKey]) errors.push("Choose a class or No Adventuring Class.");\n`,
  `  if (!CLASS_DEFINITIONS[draft.classKey]) errors.push("Choose a class or No Adventuring Class.");\n  if (draft.alignment && !ALIGNMENT_OPTIONS.some((option) => option.key === String(draft.alignment).toUpperCase())) {\n    errors.push("Choose a valid alignment.");\n  }\n  const languageCount = normalizeLanguages(draft.languagesText ?? draft.languages).length;\n  if (languageCount < 1) errors.push("Add at least one language.");\n`,
  "character validation details"
);

fs.writeFileSync(characterPath, characterSource, "utf8");

const modalPath = path.join(process.cwd(), "components", "NewNpcModal.js");
let modalSource = fs.readFileSync(modalPath, "utf8");

modalSource = replaceOnce(
  modalSource,
  `  ABILITY_KEYS,\n  ABILITY_LABELS,\n  BACKGROUND_DEFINITIONS,\n`,
  `  ABILITY_KEYS,\n  ABILITY_LABELS,\n  ALIGNMENT_OPTIONS,\n  SIZE_OPTIONS,\n  BACKGROUND_DEFINITIONS,\n`,
  "NPC Forge imports"
);

modalSource = replaceOnce(
  modalSource,
  `    lineage: "",\n    backgroundKey: "",\n`,
  `    lineage: "",\n    size: "",\n    alignment: "N",\n    languagesText: "Common",\n    appearance: "",\n    backgroundKey: "",\n`,
  "NPC Forge initial origin details"
);

modalSource = replaceOnce(
  modalSource,
  `    attacks: "",\n    description: "",\n`,
  `    attacks: "",\n    equipment: "",\n    treasure: "",\n    description: "",\n`,
  "NPC Forge initial equipment details"
);

modalSource = replaceOnce(
  modalSource,
  `                 {speciesDefinition?.lineages?.length ? (\n                   <label className="npc-forge-inline-field mt-3"><span>Lineage / ancestry</span><select value={draft.lineage} onChange={(event) => patch({ lineage: event.target.value })}><option value="">Choose lineage</option>{speciesDefinition.lineages.map((lineage) => <option key={lineage} value={lineage}>{lineage}</option>)}</select></label>\n                 ) : null}\n\n                 <div className="npc-forge-subheading mt-4">Background</div>\n`,
  `                 {speciesDefinition?.lineages?.length ? (\n                   <label className="npc-forge-inline-field mt-3"><span>Lineage / ancestry</span><select value={draft.lineage} onChange={(event) => patch({ lineage: event.target.value })}><option value="">Choose lineage</option>{speciesDefinition.lineages.map((lineage) => <option key={lineage} value={lineage}>{lineage}</option>)}</select></label>\n                 ) : null}\n                 <div className="npc-forge-form-grid mt-3">\n                   <label><span>Size</span><select value={draft.size} onChange={(event) => patch({ size: event.target.value })}><option value="">Species default</option>{SIZE_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>\n                   <label><span>Alignment</span><select value={draft.alignment} onChange={(event) => patch({ alignment: event.target.value })}>{ALIGNMENT_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>\n                   <label className="wide"><span>Languages</span><input value={draft.languagesText} onChange={(event) => patch({ languagesText: event.target.value })} placeholder="Common, Elvish, Dwarvish" /></label>\n                 </div>\n\n                 <div className="npc-forge-subheading mt-4">Background</div>\n`,
  "NPC Forge origin fields"
);

modalSource = replaceOnce(
  modalSource,
  `                  <label className="wide"><span>Description</span><textarea rows={2} value={draft.description} onChange={(event) => patch({ description: event.target.value })} /></label>\n                  <label className="wide"><span>Background narrative</span><textarea rows={2} value={draft.backgroundNarrative} onChange={(event) => patch({ backgroundNarrative: event.target.value })} /></label>\n`,
  `                  <label className="wide"><span>Description</span><textarea rows={2} value={draft.description} onChange={(event) => patch({ description: event.target.value })} /></label>\n                  <label className="wide"><span>Appearance</span><textarea rows={2} value={draft.appearance} onChange={(event) => patch({ appearance: event.target.value })} placeholder="Visible age, clothing, posture, notable marks, aura, or monster traits." /></label>\n                  <label className="wide"><span>Background narrative</span><textarea rows={2} value={draft.backgroundNarrative} onChange={(event) => patch({ backgroundNarrative: event.target.value })} /></label>\n`,
  "NPC Forge appearance field"
);

modalSource = replaceOnce(
  modalSource,
  `                  <label className="wide"><span>Attacks & actions</span><textarea rows={3} value={draft.attacks} onChange={(event) => patch({ attacks: event.target.value })} placeholder="Add concise attacks, actions, reactions, or combat notes." /></label>\n                  {classDefinition.spellcastingAbility ? <label className="wide"><span>Prepared spells (manual placeholder)</span><textarea rows={3} value={draft.preparedSpellsText} onChange={(event) => patch({ preparedSpellsText: event.target.value })} placeholder="Spell catalog import will replace this free-text bridge." /></label> : null}\n`,
  `                  <label className="wide"><span>Attacks & actions</span><textarea rows={3} value={draft.attacks} onChange={(event) => patch({ attacks: event.target.value })} placeholder="Add concise attacks, actions, reactions, or combat notes." /></label>\n                  <label className="wide"><span>Equipment</span><textarea rows={2} value={draft.equipment} onChange={(event) => patch({ equipment: event.target.value })} placeholder="Armor, weapons, tools, trinkets, travel gear, or shop gear." /></label>\n                  <label><span>Treasure / coin</span><input value={draft.treasure} onChange={(event) => patch({ treasure: event.target.value })} placeholder="50 GP, signet ring, ledger..." /></label>\n                  {classDefinition.spellcastingAbility ? <label className="wide"><span>Prepared spells (manual placeholder)</span><textarea rows={3} value={draft.preparedSpellsText} onChange={(event) => patch({ preparedSpellsText: event.target.value })} placeholder="Spell catalog import will replace this free-text bridge." /></label> : null}\n`,
  "NPC Forge equipment fields"
);

modalSource = replaceOnce(
  modalSource,
  `                  <article><span>Origin</span><strong>{sheetPreview.background}</strong><p>{sheetPreview.lineage ? `${sheetPreview.species} (${sheetPreview.lineage})` : sheetPreview.species} • {originFeat}</p></article>\n`,
  `                  <article><span>Origin</span><strong>{sheetPreview.background}</strong><p>{sheetPreview.lineage ? `${sheetPreview.species} (${sheetPreview.lineage})` : sheetPreview.species} • {sheetPreview.size} • {sheetPreview.alignment} • {originFeat}</p></article>\n`,
  "NPC Forge review origin summary"
);

modalSource = replaceOnce(
  modalSource,
  `            <p>{createPayload.race || "Species"} • {draft.role || "Role"}</p>\n`,
  `            <p>{createPayload.race || "Species"} • {sheetPreview.size || "Medium"} • {sheetPreview.alignment || "N"} • {draft.role || "Role"}</p>\n`,
  "NPC Forge preview origin summary"
);

modalSource = replaceOnce(
  modalSource,
  `            <div className="npc-forge-preview-block"><span>Background</span><strong>{sheetPreview.background}</strong><small>{originFeat}</small></div>\n`,
  `            <div className="npc-forge-preview-block"><span>Background</span><strong>{sheetPreview.background}</strong><small>{originFeat}</small><small>{(sheetPreview.languages || []).join(", ")}</small></div>\n`,
  "NPC Forge preview languages"
);

fs.writeFileSync(modalPath, modalSource, "utf8");

console.log("NPC Forge creation details patch applied.");
