// scripts/retrofill-flavor.mjs
// One-time utility to add flavor blurbs (and entries when missing)
// to public/items/all-items.json, and to append mastery into propertiesText
// if present. Makes a .bak copy first.

import fs from "node:fs/promises";
import path from "node:path";

// ---------- helpers ----------
const ROOT = path.join(process.cwd(), "public", "items");
const FILE = path.join(ROOT, "all-items.json");

const strip = (s) => String(s || "").split("|")[0];
const titleCase = (s="") => String(s).toLowerCase().replace(/\b([a-z])/g, (_,c)=>c.toUpperCase());

// minimal bucket logic just for flavor tone
function classifyForFlavor(it={}) {
  const raw = strip(it.type || it.item_type || "");
  const name = String(it.name || it.item_name || "");
  if (raw === "M") return "Melee Weapon";
  if (raw === "R") return "Ranged Weapon";
  if (raw === "S") return "Shield";
  if (raw === "A") return "Ammunition";
  if (raw === "LA" || raw === "MA" || raw === "HA") return "Armor";
  if (raw === "INS") return "Instrument";
  if (raw === "RD" || raw === "WD" || raw === "ST") return "Rods & Wands";
  if (raw === "T" || raw === "GS" || raw === "AT") return "Tools";
  if (raw === "G") return "Adventuring Gear";
  if (raw === "TG" || raw === "TB" || raw.startsWith("$")) return "Trade Goods";
  if (raw === "VEH" || raw === "SHP" || raw === "SPC" || raw === "AIR") return "Vehicles & Structures";
  if (raw === "EXP") return "Explosives";
  if (raw === "P" || raw === "IDG" || /\bpoison\b/i.test(name)) return "Potions & Poisons";
  if (raw === "SC" || raw.startsWith("SC") || raw === "SCF" || /\bscroll\b/i.test(name)) return "Scroll & Focus";
  // Wondrous umbrella (explicit + common worn names + "Other")
  if (raw === "W" || raw === "RG" || raw === "Oth" || raw === "OTH" || raw === "Other") return "Wondrous Item";
  if (/\b(boots?|gloves?|gauntlets?|bracers?|belt|cloak|cape|mantle|amulet|pendant|talisman|periapt|necklace|helm|helmet|hat|circlet|diadem|crown|mask|goggles|lenses|ioun)\b/i.test(name)) {
    return "Wondrous Item";
  }
  return "Other";
}

function synthFlavor(it, uiType) {
  const name = it.name || it.item_name || "This item";
  const rare = String(it.rarity || it.item_rarity || "common").toLowerCase();
  switch (uiType) {
    case "Melee Weapon":
    case "Ranged Weapon":
      return `${name} is a ${rare} ${uiType.toLowerCase()} with a practical, battle-worn design—balanced in the hand, marked by faint nicks and a sheen of oil.`;
    case "Armor":
      return `${name} is a suit of protective gear with scuffs and careful stitching, the metal glinting where it’s polished and dark where use has dulled it.`;
    case "Shield":
      return `${name} bears the wear of many blocks—grain and guard paint worn smooth by years of bracing impacts.`;
    case "Ammunition":
      return `${name} is bundled neatly, fletching aligned and points honed for steady flight.`;
    case "Wondrous Item":
      return `${name} carries a subtle strangeness—cool to the touch, faintly humming or scented of old magic when brought close.`;
    case "Potions & Poisons":
      return `${name} swirls in its container with telltale color and scent—care to sip, or beware the bite.`;
    case "Scroll & Focus":
      return `${name} bears intricate sigils and faint residues of spellcraft; the parchment crackles or the focus hums when handled.`;
    case "Tools":
      return `${name} is a well-made set for careful hands—worn edges, steady heft, and the smell of wood, leather, or oil.`;
    case "Instrument":
      return `${name} is tuned and responsive—polished surfaces and the faint scent of varnish or old wood.`;
    case "Adventuring Gear":
      return `${name} is rugged kit for the road—practical, sturdy, and ready for hard travel.`;
    case "Trade Goods":
      return `${name} is a merchant’s staple—packed, weighed, and valued for barter or sale.`;
    case "Vehicles & Structures":
      return `${name} shows signs of service—ropes taut, wood tarred, metal fittings sound and purposeful.`;
    case "Explosives":
      return `${name} is carefully packed and volatile; faint chemical scents hint at contained violence.`;
    default:
      return `${name} looks and feels authentic, ready for use.`;
  }
}

function propsTextFrom(it) {
  const stripTag = (s) => String(s || "").split("|")[0];
  const PROP = { L:"Light", F:"Finesse", H:"Heavy", R:"Reach", T:"Thrown", V:"Versatile", "2H":"Two-Handed", A:"Ammunition", LD:"Loading", S:"Special", RLD:"Reload" };
  const props = (it.property || it.properties || []).map(stripTag);
  const human = props.map(p => PROP[p] || p).join(", ");
  const mastery = Array.isArray(it.mastery) ? it.mastery.map(stripTag) : [];
  return human + (mastery.length ? (human ? "; " : "") + `Mastery: ${mastery.join(", ")}` : "");
}

// ---------- main ----------
(async () => {
  const raw = await fs.readFile(FILE, "utf8");
  const items = JSON.parse(raw);

  const backupName = `all-items.${new Date().toISOString().replace(/[:.]/g,"-")}.bak.json`;
  await fs.writeFile(path.join(ROOT, backupName), raw, "utf8");

  let madeFlavor = 0;
  let madeEntries = 0;
  let appendedProps = 0;

  for (const it of items) {
    const uiType = classifyForFlavor(it);

    // flavor
    if (!it.flavor || !String(it.flavor).trim()) {
      it.flavor = synthFlavor(it, uiType);
      madeFlavor++;
    }

    // entries (only create if completely missing)
    if (it.entries == null) {
      it.entries = [it.flavor];
      madeEntries++;
    }

    // propertiesText + mastery
    const current = String(it.propertiesText || "").trim();
    const want = propsTextFrom(it);
    if (want && current !== want) {
      it.propertiesText = want;
      appendedProps++;
    }
  }

  await fs.writeFile(FILE, JSON.stringify(items), "utf8");
  console.log("[retrofill-flavor] Done.");
  console.log(`  items: ${items.length}`);
  console.log(`  added flavor:  ${madeFlavor}`);
  console.log(`  created entries: ${madeEntries}`);
  console.log(`  updated propertiesText (incl. mastery): ${appendedProps}`);
  console.log(`  backup: ${backupName}`);
})();
