import fs from "node:fs";
import path from "node:path";

function read(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

function write(rel, source) {
  fs.writeFileSync(path.join(process.cwd(), rel), source, "utf8");
}

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(before, after);
}

function requireToken(source, token, label) {
  if (!source.includes(token)) throw new Error(`${label}: missing ${token}`);
}

function requireAbsent(source, token, label) {
  if (source.includes(token)) throw new Error(`${label}: forbidden ${token}`);
}

let changedAny = false;

// -----------------------------------------------------------------------------
// Town route: use the same shared CharacterInteractionPanel wrapper as the NPC
// page. This keeps Craft rendering in CharacterInteractionPanel and avoids putting
// CharacterInteractionPanel or CraftingWorkspace imports inside TownSheet.
// -----------------------------------------------------------------------------
{
  const rel = "pages/town/[id].js";
  let source = read(rel);
  const before = source;

  source = replaceRequired(
    source,
    'const NpcPanel = dynamic(() => import("../../components/NpcPanel"), { ssr: false });',
    'const CharacterInteractionPanel = dynamic(() => import("../../components/character/CharacterInteractionPanel"), { ssr: false });',
    "Town route shared CharacterInteractionPanel import"
  );

  source = replaceRequired(
    source,
    `function handleOpenTownProfile(character, initialView = "profile") {
  if (!character?.id) return;
  setActiveTownProfileCharacter(character);
  setActiveTownProfileView(initialView || "profile");
}`,
    `function townCrafterDisciplineFor(character) {
  const types = Array.isArray(character?.crafterTypes) ? character.crafterTypes.map((type) => String(type || "").toLowerCase()) : [];
  if (types.includes("blacksmith")) return "Smithing";
  if (types.includes("alchemist")) return "Alchemy";
  if (types.includes("enchanter")) return "Enchanting";
  if (types.includes("scribe")) return "Scribe";
  return "";
}

function handleOpenTownProfile(character, initialView = "profile") {
  if (!character?.id) return;
  const craftProfession = townCrafterDisciplineFor(character);
  const panelCharacter = craftProfession
    ? {
        ...character,
        craft_profession: craftProfession,
        profession: character?.profession || craftProfession,
        role: character?.role || craftProfession || "Crafter",
      }
    : character;
  setActiveTownProfileCharacter(panelCharacter);
  setActiveTownProfileView(initialView || "profile");
}`,
    "Town route crafter profession normalization"
  );

  source = replaceRequired(
    source,
    `<NpcPanel
                  key={activeTownProfileCharacter?.id || "town-profile"}
                  npc={activeTownProfileCharacter}
                  isAdmin={isAdmin}
                  locations={location ? [location] : []}
                  initialView={activeTownProfileView}
                  onClose={() => setActiveTownProfileCharacter(null)}
                />`,
    `<CharacterInteractionPanel
                  key={activeTownProfileCharacter?.id || "town-profile"}
                  character={activeTownProfileCharacter}
                  isAdmin={isAdmin}
                  locations={location ? [location] : []}
                  initialView={activeTownProfileView}
                  onClose={() => setActiveTownProfileCharacter(null)}
                />`,
    "Town route side panel renders shared interaction wrapper"
  );

  if (source !== before) {
    write(rel, source);
    changedAny = true;
    console.log("Patched town route to use shared CharacterInteractionPanel.");
  }
}

// -----------------------------------------------------------------------------
// TownSheet: Open Workshop now dispatches to the parent-owned profile panel on the
// Craft tab. The town route always supplies that callback, so the legacy modal is
// no longer used as an active runtime path.
// -----------------------------------------------------------------------------
{
  const rel = "components/TownSheet.js";
  let source = read(rel);
  const before = source;

  source = replaceRequired(
    source,
    '<section className={styles.topPaneRow}><SharedDrawer panel={activePanel} openPanel={openPanel} setOpenPanel={setOpenPanel} adminToolsVisible={adminToolsVisible} adminDrawerProps={adminDrawerProps} marketData={marketData} townName={location?.name} crafterData={crafterData} playerInventory={playerInventory} onOpenWorkshop={setActiveWorkshopCrafter} onBrowseWares={setActiveMerchant} onOpenCharacterProfile={onOpenCharacterProfile} /><TownMapPanel',
    '<section className={styles.topPaneRow}><SharedDrawer panel={activePanel} openPanel={openPanel} setOpenPanel={setOpenPanel} adminToolsVisible={adminToolsVisible} adminDrawerProps={adminDrawerProps} marketData={marketData} townName={location?.name} crafterData={crafterData} playerInventory={playerInventory} onOpenWorkshop={(crafter) => onOpenCharacterProfile?.(crafter, "craft")} onBrowseWares={setActiveMerchant} onOpenCharacterProfile={onOpenCharacterProfile} /><TownMapPanel',
    "TownSheet Open Workshop dispatches to shared Craft tab"
  );

  source = replaceRequired(
    source,
    '<section className={styles.topPaneRow}><SharedDrawer panel={activePanel} openPanel={openPanel} setOpenPanel={setOpenPanel} adminToolsVisible={adminToolsVisible} adminDrawerProps={adminDrawerProps} marketData={marketData} townName={location?.name} crafterData={crafterData} playerInventory={playerInventory} onOpenWorkshop={(crafter) => typeof onOpenCharacterProfile === "function" ? onOpenCharacterProfile(crafter, "craft") : setActiveWorkshopCrafter(crafter)} onBrowseWares={setActiveMerchant} onOpenCharacterProfile={onOpenCharacterProfile} /><TownMapPanel',
    '<section className={styles.topPaneRow}><SharedDrawer panel={activePanel} openPanel={openPanel} setOpenPanel={setOpenPanel} adminToolsVisible={adminToolsVisible} adminDrawerProps={adminDrawerProps} marketData={marketData} townName={location?.name} crafterData={crafterData} playerInventory={playerInventory} onOpenWorkshop={(crafter) => onOpenCharacterProfile?.(crafter, "craft")} onBrowseWares={setActiveMerchant} onOpenCharacterProfile={onOpenCharacterProfile} /><TownMapPanel',
    "TownSheet Open Workshop removes legacy modal fallback"
  );

  source = replaceRequired(
    source,
    '{activeWorkshopCrafter ? <CrafterWorkshopModal crafter={activeWorkshopCrafter} inventoryItems={playerInventory} playerPlants={playerPlants} onClose={() => setActiveWorkshopCrafter(null)} onCraftWorkshop={onCraftWorkshop} /> : null}',
    '{null /* Legacy CrafterWorkshopModal retired: town Open Workshop now uses the shared profile Craft tab. */}',
    "TownSheet legacy crafter modal render retired"
  );

  if (source !== before) {
    write(rel, source);
    changedAny = true;
    console.log("Patched TownSheet Open Workshop to dispatch to shared Craft tab without legacy modal fallback.");
  }
}

// Self-review.
{
  const townPage = read("pages/town/[id].js");
  const townSheet = read("components/TownSheet.js");

  for (const token of [
    'const CharacterInteractionPanel = dynamic(() => import("../../components/character/CharacterInteractionPanel"), { ssr: false });',
    'function townCrafterDisciplineFor(character) {',
    'types.includes("blacksmith")',
    'types.includes("alchemist")',
    'types.includes("enchanter")',
    'craft_profession: craftProfession',
    '<CharacterInteractionPanel',
    'character={activeTownProfileCharacter}',
    'initialView={activeTownProfileView}',
  ]) requireToken(townPage, token, "Town route shared crafter craft panel");

  for (const token of [
    'const NpcPanel = dynamic(() => import("../../components/NpcPanel"), { ssr: false });',
    '<NpcPanel',
    '<iframe',
  ]) requireAbsent(townPage, token, "Town route shared crafter craft panel");

  requireToken(
    townSheet,
    'onOpenWorkshop={(crafter) => onOpenCharacterProfile?.(crafter, "craft")}',
    "TownSheet shared crafter craft dispatch"
  );

  for (const token of [
    'activeWorkshopCrafter ? <CrafterWorkshopModal',
    'typeof onOpenCharacterProfile === "function" ? onOpenCharacterProfile(crafter, "craft") : setActiveWorkshopCrafter(crafter)',
    'import CharacterInteractionPanel',
    'import CraftingWorkspace',
    '<iframe',
  ]) requireAbsent(townSheet, token, "TownSheet retired legacy crafter modal path");

  console.log("Town crafter shared Craft panel patch validated.");
}

if (changedAny) console.log("Applied town crafter shared Craft panel patch.");
else console.log("Town crafter shared Craft panel patch already current.");
