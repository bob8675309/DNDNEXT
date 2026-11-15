// Synthetic visual QA for the existing official three-page printable character sheet.
// No production data, credentials, SQL, maps, or source runtime changes are involved.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { PDFDocument } from "pdf-lib";
import { buildPrintableCharacterSheetModel } from "../../utils/printableCharacterSheet.js";
import { buildOfficialCharacterSheetPdf } from "../../utils/officialCharacterSheetPdf.js";

const root = process.cwd();
const output = process.env.DNDNEXT_PDF_VISUAL_OUT
  || path.join(process.env.RUNNER_TEMP || os.tmpdir(), "dndnext-c33-npc-pdf-visual");
fs.mkdirSync(output, { recursive: true });

const template = fs.readFileSync(path.join(root, "public/forms/5E_CharacterSheet_Fillable.pdf"));
const fetchImpl = async (url) => {
  assert.equal(url, "/forms/5E_CharacterSheet_Fillable.pdf", "No external PDF fetch");
  return {
    ok: true,
    status: 200,
    arrayBuffer: async () => template.buffer.slice(template.byteOffset, template.byteOffset + template.byteLength),
  };
};

const commonSheet = {
  className: "Wizard",
  level: 12,
  species: "Half-Elf",
  background: "Sage",
  alignment: "Neutral Good",
  proficiencyBonus: 4,
  abilities: {
    str: { score: 9 }, dex: { score: 16 }, con: { score: 14 },
    int: { score: 20 }, wis: { score: 13 }, cha: { score: 12 },
  },
  proficiencies: {
    saves: { int: { proficient: true }, wis: { proficient: true } },
    skills: { arcana: { proficient: true, expertise: true }, investigation: { proficient: true }, history: { proficient: true } },
  },
  hp: 61, maxHp: 72, tempHp: 7, speed: 30, hitDice: "12d6",
  spellcasting: { ability: "int", spellSaveDc: 17, spellAttackBonus: 9 },
  spellSlots: [4, 3, 3, 3, 2, 1, 0, 0, 0],
  personality: { traits: "Quietly recites a name before every spell.", ideals: "Knowledge serves the community.", bonds: "Keeps letters from her companions.", flaws: "Cannot ignore an unsolved riddle." },
  languages: ["Common", "Elvish", "Draconic", "Dwarvish"],
  tools: ["Calligrapher's Supplies", "Herbalism Kit"],
  age: "136", height: "5 ft 11 in", weight: "142 lb", eyes: "Hazel", skin: "Olive", hair: "Black",
  currency: { gp: 324, sp: 14, cp: 19 },
};
const publicProfile = {
  name: "Synthetic Elara Vale", kind: "npc", role: "Arcane Archivist",
  affiliation: "North Gate Library", description: "An experienced mage serving as a city archivist.",
  backgroundNarrative: "Raised among codices, Elara records the history of the city.",
  motivation: "Preserve the public collection.", quirk: "Counts each bookshelf aloud.",
  mannerism: "Writes notes in the air.", voice: "Soft and deliberate.",
  tags: ["wizard", "archivist"],
};
const makeItems = (count) => Array.from({ length: count }, (_, i) => ({
  id: "fixture-item-" + i, item_name: "Inventory Reference " + String(i + 1).padStart(2, "0") + " - Weathered Traveler's Kit",
  quantity: i % 3 + 1, is_equipped: i < 3,
  equip_slot: i === 0 ? "main_hand" : i === 1 ? "armor" : "accessory",
}));
const makeSpells = (count) => Array.from({ length: count }, (_, i) => ({
  id: "fixture-spell-" + i, prepared: i % 3 === 0, always_available: i % 5 === 0,
  spell: { id: "spell-" + i, name: "Synthetic Spell " + String(i + 1).padStart(2, "0") + " of the Silver Archive",
    level: i < 10 ? 0 : i < 30 ? 1 : i < 49 ? 2 : i < 64 ? 3 : i < 73 ? 4 : 5,
    casting_time: "1 action", range_text: "60 feet", duration_text: "Instantaneous",
    description: "A harmless synthetic label used for printable-page density tests." },
}));
const makeFeatures = (count, words = 26) => Array.from({ length: count }, (_, i) => ({
  id: "fixture-feature-" + i, name: "Synthetic Arcane Feature " + String(i + 1).padStart(2, "0"),
  category: "Class", source: "XPHB", level: (i % 12) + 1,
  description: ("A source-qualified protective ability used to test feature wrapping and page allocation. ").repeat(Math.ceil(words / 14)).trim(),
}));
const makeNotes = (count) => Array.from({ length: count }, (_, i) => ({
  id: "fixture-note-" + i, scope: "private", body: "Authorized synthetic sheet note " + (i + 1) + ": " +
    "Review the daily itinerary and retain only role-appropriate information. ".repeat(3),
}));

const cases = [
  {
    key: "public-standard", profile: { ...publicProfile, secret: "" },
    inventoryItems: makeItems(3), spellActions: makeSpells(10),
    featureRows: makeFeatures(3, 14), notes: makeNotes(1),
  },
  {
    key: "gm-standard", profile: { ...publicProfile, name: "Synthetic GM Examiner", secret: "C33 GM ONLY PRINT MARKER 7426" },
    inventoryItems: makeItems(3), spellActions: makeSpells(10),
    featureRows: makeFeatures(3, 14), notes: makeNotes(1),
  },
  {
    key: "public-dense", profile: {
      ...publicProfile, name: "Synthetic Dense Role-Safe NPC",
      description: "Detailed public-facing visual-density test description. ".repeat(20),
      backgroundNarrative: "Lengthy public background narrative. ".repeat(22),
      motivation: "Safeguard the city's public records. ".repeat(10),
      secret: "",
    },
    inventoryItems: makeItems(36), spellActions: makeSpells(80),
    featureRows: makeFeatures(21, 55), notes: makeNotes(8),
  },
];

for (const sample of cases) {
  const model = buildPrintableCharacterSheetModel({
    sheet: commonSheet, profile: sample.profile,
    inventoryItems: sample.inventoryItems, spellActions: sample.spellActions,
    featureRows: sample.featureRows, notes: sample.notes,
    locationLabel: "North Gate",
  });
  assert.equal(model.profile.secret, sample.profile.secret);
  const bytes = await buildOfficialCharacterSheetPdf({ model, fetchImpl });
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 3, sample.key + " must remain the official three-page sheet");
  const filename = path.join(output, sample.key + ".pdf");
  fs.writeFileSync(filename, bytes);
  let text;
  try {
    text = execFileSync("pdftotext", ["-layout", filename, "-"], { encoding: "utf8" });
  } catch (error) {
    throw new Error("pdftotext is required for real PDF print-content QA: " + error.message);
  }
  assert(text.includes(model.profile.name), sample.key + " missing actual printed NPC identity");
  if (sample.key === "public-dense") {
    assert(/\+\d+ more features - see digital sheet/.test(text), "Dense feature overflow must be disclosed rather than silently dropped");
    assert(/\+\d+ more spells \(digital sheet\)/.test(text), "Dense spell overflow must have a dedicated print row");
  }
  if (sample.key === "gm-standard") {
    assert(text.includes("C33 GM ONLY PRINT MARKER 7426"), "GM's explicitly authorized secret missing from printed page");
  } else {
    assert(!text.includes("C33 GM ONLY PRINT MARKER 7426"), "GM secret leaked into public sheet");
    assert(!text.includes("Secret: "), "Public test unexpectedly printed a GM-only Secret label");
  }
  console.log("C33_PDF_CASE_PASS|" + sample.key + "|pages=3|bytes=" + bytes.length);
}

// Emit real pdftoppm JPEG renderings in chunked CI logs for human visual review.
// Markers contain only synthetic fixture data. The workflow also uploads the PDFs
// and page previews as GitHub Actions artifacts; none enter the product repository.
for (const [key, pages] of [["public-standard", [2]], ["gm-standard", [2]], ["public-dense", [1, 2, 3]]]) {
  for (const page of pages) {
    const prefix = path.join(output, key + "-page-" + page);
    try {
      execFileSync("pdftoppm", [
        "-f", String(page), "-l", String(page), "-singlefile",
        "-scale-to", "1100", "-jpeg", "-jpegopt", "quality=74,optimize=y",
        path.join(output, key + ".pdf"), prefix,
      ], { stdio: ["ignore", "pipe", "pipe"] });
    } catch (error) {
      throw new Error("Actual PDF page rasterization failed for " + key + " page " + page + ": " + error.message);
    }
    const file = prefix + ".jpg";
    const bytes = fs.readFileSync(file);
    assert(bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])), "JPEG preview missing");
    console.log("C33_PDF_IMAGE_BEGIN|" + key + "|" + page + "|bytes=" + bytes.length);
    if (process.env.DNDNEXT_PDF_VISUAL_LOG_IMAGES === "1") {
      const content = bytes.toString("base64");
      for (let i = 0; i < content.length; i += 2048) {
        console.log("C33_PDF_IMAGE_CHUNK|" + key + "|" + page + "|" + content.slice(i, i + 2048));
      }
    }
    console.log("C33_PDF_IMAGE_END|" + key + "|" + page);
  }
}
console.log("C33_PDF_VISUAL_QA_COMPLETE|synthetic-only|three-page-real-template|rendered");
