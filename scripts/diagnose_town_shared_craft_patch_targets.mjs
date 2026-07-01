import fs from "node:fs";
import path from "node:path";

function read(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

function countOf(source, token) {
  if (!token) return 0;
  return source.split(token).length - 1;
}

function check({ file, label, before, after, required = false, sourceOwned = false }) {
  const source = read(file);
  const afterCount = countOf(source, after);
  const beforeCount = countOf(source, before);
  let state = "missing";
  if (sourceOwned && afterCount > 0) state = "source_owned";
  else if (afterCount > 0) state = "already_applied";
  else if (beforeCount === 1) state = "ready_to_apply";
  else if (beforeCount > 1) state = "ambiguous_anchor";

  return {
    file,
    label,
    required,
    sourceOwned,
    state,
    beforeCount,
    afterCount,
  };
}

const targets = [
  {
    file: "pages/town/[id].js",
    label: "Town route shared CharacterInteractionPanel import",
    required: true,
    before: 'const NpcPanel = dynamic(() => import("../../components/NpcPanel"), { ssr: false });',
    after: 'const CharacterInteractionPanel = dynamic(() => import("../../components/character/CharacterInteractionPanel"), { ssr: false });',
  },
  {
    file: "pages/town/[id].js",
    label: "Town route crafter profession normalization",
    required: true,
    before: `function handleOpenTownProfile(character, initialView = "profile") {\n  if (!character?.id) return;\n  setActiveTownProfileCharacter(character);\n  setActiveTownProfileView(initialView || "profile");\n}`,
    after: 'function townCrafterDisciplineFor(character) {',
  },
  {
    file: "pages/town/[id].js",
    label: "Town route side panel renders shared interaction wrapper",
    required: true,
    before: `<NpcPanel\n                  key={activeTownProfileCharacter?.id || "town-profile"}\n                  npc={activeTownProfileCharacter}\n                  isAdmin={isAdmin}\n                  locations={location ? [location] : []}\n                  initialView={activeTownProfileView}\n                  onClose={() => setActiveTownProfileCharacter(null)}\n                />`,
    after: '<CharacterInteractionPanel',
  },
  {
    file: "components/TownSheet.js",
    label: "TownSheet Open Workshop dispatches to shared Craft tab",
    required: true,
    before: '<section className={styles.topPaneRow}><SharedDrawer panel={activePanel} openPanel={openPanel} setOpenPanel={setOpenPanel} adminToolsVisible={adminToolsVisible} adminDrawerProps={adminDrawerProps} marketData={marketData} townName={location?.name} crafterData={crafterData} playerInventory={playerInventory} onOpenWorkshop={setActiveWorkshopCrafter} onBrowseWares={setActiveMerchant} onOpenCharacterProfile={onOpenCharacterProfile} /><TownMapPanel',
    after: 'onOpenWorkshop={(crafter) => onOpenCharacterProfile?.(crafter, "craft")}',
  },
  {
    file: "components/TownSheet.js",
    label: "TownSheet Open Workshop removes legacy modal fallback",
    before: '<section className={styles.topPaneRow}><SharedDrawer panel={activePanel} openPanel={openPanel} setOpenPanel={setOpenPanel} adminToolsVisible={adminToolsVisible} adminDrawerProps={adminDrawerProps} marketData={marketData} townName={location?.name} crafterData={crafterData} playerInventory={playerInventory} onOpenWorkshop={(crafter) => typeof onOpenCharacterProfile === "function" ? onOpenCharacterProfile(crafter, "craft") : setActiveWorkshopCrafter(crafter)} onBrowseWares={setActiveMerchant} onOpenCharacterProfile={onOpenCharacterProfile} /><TownMapPanel',
    after: 'onOpenWorkshop={(crafter) => onOpenCharacterProfile?.(crafter, "craft")}',
  },
  {
    file: "components/TownSheet.js",
    label: "TownSheet legacy crafter modal render retired",
    required: true,
    before: '{activeWorkshopCrafter ? <CrafterWorkshopModal crafter={activeWorkshopCrafter} inventoryItems={playerInventory} playerPlants={playerPlants} onClose={() => setActiveWorkshopCrafter(null)} onCraftWorkshop={onCraftWorkshop} /> : null}',
    after: '{null /* Legacy CrafterWorkshopModal retired: town Open Workshop now uses the shared profile Craft tab. */}',
  },
];

const results = targets.map(check);
const grouped = results.reduce((acc, result) => {
  acc[result.state] = (acc[result.state] || 0) + 1;
  return acc;
}, {});

console.log("Town shared Craft patch target diagnostic");
console.log(JSON.stringify(grouped, null, 2));
for (const result of results) {
  const required = result.required ? "required" : result.sourceOwned ? "owned" : "optional";
  console.log(`${result.state.padEnd(16)} ${required.padEnd(8)} ${result.file} :: ${result.label} (before=${result.beforeCount}, after=${result.afterCount})`);
}

const ambiguous = results.filter((result) => result.state === "ambiguous_anchor");
if (ambiguous.length) {
  console.error("Ambiguous shared Craft anchors found. Do not source-bake until these are resolved:");
  for (const result of ambiguous) console.error(`- ${result.file}: ${result.label}`);
  process.exit(1);
}

const missingSourceOwned = results.filter((result) => result.sourceOwned && result.state !== "source_owned");
if (missingSourceOwned.length) {
  console.error("Source-owned shared Craft targets are missing. Restore these before continuing the town handoff bake:");
  for (const result of missingSourceOwned) console.error(`- ${result.file}: ${result.label}`);
  process.exit(1);
}

const missingRequired = results.filter((result) => result.required && result.state === "missing");
if (missingRequired.length) {
  console.error("Required shared Craft anchors missing from current source. This can happen before the first town profile patch has produced its intermediate output, but source-baking must resolve these before removing the mutator:");
  for (const result of missingRequired) console.error(`- ${result.file}: ${result.label}`);
}
