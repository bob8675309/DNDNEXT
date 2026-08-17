import { formatPlayerFacingInline, formatPlayerFacingText } from "./playerFacingText.js";

const text = (value) => String(value ?? "").trim();
const array = (value) => Array.isArray(value) ? value : [];
const norm = (value) => text(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();

function cleanInline(value = "") {
  return formatPlayerFacingInline(value).replace(/[.:]+$/g, "").trim();
}

function cleanParagraph(value = "") {
  return formatPlayerFacingText(value, "").trim();
}

function tablePresentation(node = {}) {
  const headers = array(node.colLabels).map(cleanInline).filter(Boolean);
  const rows = array(node.rows).map((row) => array(row).map((cell) => formatPlayerFacingInline(cell)).filter(Boolean)).filter((row) => row.length);
  if (!rows.length) return null;
  return {
    title: cleanInline(node.caption || (headers[0] === "Rune" && headers[1] === "Spell" ? "Rune Spells" : "Options")),
    headers,
    rows,
  };
}

function collectBody(node, target) {
  if (node == null) return;
  if (typeof node === "string") {
    const paragraph = cleanParagraph(node);
    if (paragraph) target.paragraphs.push(paragraph);
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((entry) => collectBody(entry, target));
    return;
  }
  if (typeof node !== "object") return;
  if (node.type === "table" || Array.isArray(node.rows)) {
    const table = tablePresentation(node);
    if (table) target.tables.push(table);
    return;
  }
  if (node.type === "list" && Array.isArray(node.items)) {
    node.items.forEach((item) => {
      if (typeof item === "string") {
        collectBody(item, target);
        return;
      }
      if (!item || typeof item !== "object") return;
      const nested = { title: cleanInline(item.name || "Detail"), paragraphs: [], tables: [] };
      collectBody(item.entries || item.entry || [], nested);
      if (nested.paragraphs.length || nested.tables.length) target.sections.push(nested);
    });
    return;
  }
  if (node.entry) collectBody(node.entry, target);
  if (node.entries) collectBody(node.entries, target);
  if (node.items) collectBody(node.items, target);
}

function splitStrikeGeneralRules(presentation) {
  if (norm(presentation.name) !== "strike of the giants") return presentation;
  const storm = presentation.sections.find((section) => norm(section.title) === "storm strike");
  if (!storm?.paragraphs?.length) return presentation;
  const source = storm.paragraphs.join(" ");
  const generalIndex = source.search(/The saving throw DC for these effects/i);
  if (generalIndex < 0) return presentation;
  const strikeText = source.slice(0, generalIndex).trim();
  const generalText = source.slice(generalIndex).trim();
  storm.paragraphs = strikeText ? [strikeText] : [];
  if (generalText) presentation.sections.push({ title: "Using the feat", paragraphs: [generalText], tables: [], generalRule: true });
  return presentation;
}

export function backgroundFeatPresentation(feat = {}) {
  const raw = feat.raw_payload || feat.rawPayload || {};
  const entries = array(raw.entries);
  const presentation = {
    name: text(feat.name || raw.name || "Feat"),
    source: text(feat.source || raw.source || ""),
    intro: [],
    sections: [],
    tables: [],
  };

  for (const entry of entries) {
    if (typeof entry === "string") {
      const paragraph = cleanParagraph(entry);
      if (paragraph) presentation.intro.push(paragraph);
      continue;
    }
    if (!entry || typeof entry !== "object") continue;
    if (entry.type === "table" || Array.isArray(entry.rows)) {
      const table = tablePresentation(entry);
      if (table) presentation.tables.push(table);
      continue;
    }
    if (entry.type === "list" && Array.isArray(entry.items)) {
      const body = { paragraphs: [], tables: [], sections: [] };
      collectBody(entry, body);
      presentation.intro.push(...body.paragraphs);
      presentation.tables.push(...body.tables);
      presentation.sections.push(...body.sections);
      continue;
    }
    if (entry.type === "entries") {
      const section = { title: cleanInline(entry.name || "Details"), paragraphs: [], tables: [], sections: [] };
      collectBody(entry.entries || entry.entry || [], section);
      presentation.sections.push(section);
      continue;
    }
    const body = { paragraphs: [], tables: [], sections: [] };
    collectBody(entry, body);
    presentation.intro.push(...body.paragraphs);
    presentation.tables.push(...body.tables);
    presentation.sections.push(...body.sections);
  }

  if (!presentation.intro.length && !presentation.sections.length && !presentation.tables.length) {
    const fallback = cleanParagraph(feat.description || "");
    if (fallback) presentation.intro.push(fallback);
  }

  return splitStrikeGeneralRules(presentation);
}

export function backgroundFeatRouteNote(feat = {}) {
  const name = norm(feat.name);
  if (name === "skilled") return "Choose the three skill or tool proficiencies granted by Skilled later in Training → Skills & Proficiencies. They do not use the class skill-choice allowance.";
  if (name === "crafter") return "Choose Crafter's three Artisan's Tool proficiencies later in Training → Skills & Proficiencies.";
  if (name === "musician") return "Choose Musician's three Musical Instrument proficiencies later in Training → Skills & Proficiencies.";
  if (name === "magic initiate") return "Choose the spells granted by Magic Initiate on the Spells step.";
  if (name === "initiate of high sorcery") return "Choose your moon, Wizard cantrip, and two moon spells on the Spells step.";
  if (name === "strixhaven initiate") return "Choose the spells granted by Strixhaven Initiate on the Spells step.";
  return "";
}

export function featSectionsAreChoiceOptions(featName = "") {
  const name = norm(featName);
  return name === "strike of the giants" || name === "scion of the outer planes";
}
