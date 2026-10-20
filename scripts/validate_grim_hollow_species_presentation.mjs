import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const {
  grimHollowLorePresentation,
  heritageChoiceGroupForSpecies,
  isGrimHollowHeritageSpecies,
  traditionalHeritageLabels,
} = await import(pathToFileURL(path.join(root,"utils/grimHollowSpeciesPresentation.js")).href);
const { buildSpeciesSourceChoiceGroups } = await import(pathToFileURL(path.join(root,"utils/playerForgeSpeciesChoices.js")).href);
const { speciesFeaturePresentation } = await import(pathToFileURL(path.join(root,"utils/speciesForgePresentation.js")).href);
const { applySourceChoiceDefaults, setSourceChoiceSelection, sourceChoiceGroupComplete } = await import(pathToFileURL(path.join(root,"utils/playerForgeSourceChoices.js")).href);

const make = (name, traditional = true) => {
  const names = Array.from({ length: 8 }, (_, i) => `Heritage ${i + 1}`);
  const catalog = [...names, "Alternative Trait"].map((n) => ({
    key: n.toLowerCase().replace(/ /g,"-") + "|GRIMHOLLOWPG24",
    name: n,
    category: "C",
    repeatLimit: 1,
    description: `Benefit of ${n}.`,
  }));
  return {
    id: `species:${name.toLowerCase()}`,
    name,
    source: "GrimHollowPG24",
    traitDetails: [{ name:"Heritage Trait",description:"Old gigantic paragraph of traditional choices." },{ name:"Creature Type",description:"Humanoid" }],
    traits:["Heritage Trait","Creature Type"],
    metadata:{
      heritageOnly:true, heritagePickCount:8, heritageTraitCatalog:catalog,
      traditionalHeritageSelections:traditional ? catalog.slice(0,8).map(({key,name,category})=>({key,name,category})) : [],
    },
  };
};
const arisen=make("Arisen");
assert(isGrimHollowHeritageSpecies(arisen));
assert(!isGrimHollowHeritageSpecies({ ...arisen, source:"TCE" }));
const groups=buildSpeciesSourceChoiceGroups({species:arisen});
const heritage=heritageChoiceGroupForSpecies(arisen,[],buildSpeciesSourceChoiceGroups);
assert(heritage?.metadata?.heritageTraitGroup,"Grim Hollow panel must recover a live Heritage group even before registration");
assert.equal(heritage.fields.length,8);
assert.deepEqual(traditionalHeritageLabels(arisen),arisen.metadata.traditionalHeritageSelections.map(x=>x.name));
assert.equal(heritageChoiceGroupForSpecies(arisen,groups,buildSpeciesSourceChoiceGroups)?.id,heritage.id,"Registered choice groups must remain authoritative");
const wrongSpecies=make("Wechselkind");
const wrongGroup=buildSpeciesSourceChoiceGroups({species:wrongSpecies}).find(group=>group.metadata?.heritageTraitGroup);
assert.equal(
  heritageChoiceGroupForSpecies(arisen,[wrongGroup],buildSpeciesSourceChoiceGroups)?.id,
  heritage.id,
  "Shared Grim Hollow source/label must never reuse another Species' traditional Heritage group"
);

const seeded=applySourceChoiceDefaults([heritage],{});
assert(sourceChoiceGroupComplete(heritage,seeded),"Default package must count as eight selected choices");
assert.equal(seeded[heritage.id]["heritage-1"][0],arisen.metadata.traditionalHeritageSelections[0].key);
const replaced=setSourceChoiceSelection([heritage],seeded,heritage.id,"heritage-1",[arisen.metadata.heritageTraitCatalog[8].key]);
assert.equal(replaced[heritage.id]["heritage-1"][0],arisen.metadata.heritageTraitCatalog[8].key,"Traditional choices must remain replaceable");
assert(sourceChoiceGroupComplete(heritage,replaced));
const accursed=make("Accursed",false);
assert.equal(traditionalHeritageLabels(accursed).length,0);
assert(heritageChoiceGroupForSpecies(accursed,[],buildSpeciesSourceChoiceGroups)?.fields?.length===8);

const featurePresentation=speciesFeaturePresentation(arisen);
assert(!featurePresentation.details.some(x=>/^heritage traits?$/i.test(x.name)),"The imported Heritage wall must not replace the active selection UI");
assert(!featurePresentation.traits.some(x=>/^heritage traits?$/i.test(x)),"Heritage labels must not be duplicated in read-only cards");
const nonGrim=speciesFeaturePresentation({ ...arisen, source:"CAMPAIGN" });
assert(nonGrim.details.some(x=>x.name==="Heritage Trait"),"Non-Grim Species must retain their original feature presentation");

const longLore = "A legend surrounds these people. Their journeys continue beyond the first encounter. "
  + "Many generations of history and intricacies follow. ".repeat(45);
const lore=grimHollowLorePresentation(longLore);
const rejectedAnecdote = ["A mother hears a sound in the night. Nothing appears amiss.", "A wechselkind is a construct crafted of wood, clay, and ceramic in the form of a small child. Once the glamour fades, they are cast out.", "Whether nurtured or shunned, the wanderer seeks a home."].join(String.fromCharCode(10, 10));
const wechselLore = grimHollowLorePresentation(rejectedAnecdote, make("Wechselkind"));
assert(wechselLore.preview.startsWith("A wechselkind is a construct crafted of wood, clay, and ceramic"), "Wechselkind intro must start at the highlighted source description");
assert(!wechselLore.full.includes("A mother hears"), "Rejected Wechselkind source opening must not leak into the expanded lore");
assert(lore.preview.length <= 441,"Lore preview must not stretch the portrait panel");
assert(lore.hasMore && lore.full.length > lore.preview.length,"Full imported lore must remain accessible");
assert(!grimHollowLorePresentation("A short description.").hasMore);

const { expandSpeciesCatalogFamilies } = await import(pathToFileURL(path.join(root, "utils/speciesCatalogExpansion.js")).href);
const { speciesPortraitArtworkFor } = await import(pathToFileURL(path.join(root, "utils/speciesArtwork.js")).href);
const variantNames=["Dwarf","Gnome","Elf","Human","Dragonborn","Dhampir","Halfling"];
for(const family of variantNames){
  const parent={id:family+"-base",name:family,source:family==="Dhampir"?"VRGR":"XPHB",metadata:{traits:[]},traitDetails:[]};
  const child={id:family+"-grim",name:family+" (Grim Hollow)",source:"GrimHollowPG24",metadata:{heritageOnly:true,traits:[]},traitDetails:[]};
  const expanded=expandSpeciesCatalogFamilies([parent,child]);
  const first=expanded.find(x=>x.id===parent.id);
  const second=expanded.find(x=>x.id===child.id);
  assert(first?.catalogSourceVariants?.some(x=>x.id===child.id), family+" Grim Hollow setting must appear under the existing parent");
  assert(second?.catalogHidden, family+" duplicate top-level entry must be hidden while remaining selectable as a real species row");
  assert.equal(speciesPortraitArtworkFor(child.name),"/media/species/cinematic-"+family.toLowerCase()+"-grim-hollow.webp", family+" requires its own dark fantasy portrait");
}
const panel=read("components/NpcForgeContextPanelRefined.js");
const css=read("styles/character-forge-cinematic-final-corrections.css");
const featureSource=read("utils/speciesForgePresentation.js");
const embedded=read("components/NpcForgeEmbeddedSourceChoices.js");
const picker=read("components/NpcForgeHeritageTraitPicker.js");
assert(embedded.includes("focusRequest={focusRequest}"), "The shared Heritage picker must receive the focus request");
for(const token of ["focusedDetailRef", "scrollIntoView", "setCategory(categoryFor(selected))", "setFocusedKey(targetKey)", "tabIndex={-1}"]){
  assert(picker.includes(token), "Heritage default navigation missing picker focus behavior: "+token);
}
for(const token of [
 "heritageChoiceGroupForSpecies",
 "buildSpeciesSourceChoiceGroups",
 "is-grim-hollow",
 "Traditional Heritage",
 "traditionalTraits.map",
 "NpcForgeEmbeddedSourceChoices groups={[heritageGroup]}",
 "setSourceChoice(heritageGroup, fieldId, keys)",
 "grimHollowLorePresentation",
 "Read full species lore",
 "setHeritageFocusRequest",
 "focusRequest={heritageFocusRequest}",
 "sourceGroups.filter((group) => !grimHeritage || !group?.metadata?.heritageTraitGroup)",
]) assert(panel.includes(token),`Species panel missing explicit Heritage/lore contract: ${token}`);
for(const token of [
 "npc-forge-grim-heritage-surface__defaults",
 "npc-forge-grim-lore",
 "object-fit: contain !important",
 "is-grim-hollow",
 "npc-forge-species-artwork",
]) assert(css.includes(token),`Grim Hollow layout missing portrait/selection styles: ${token}`);
assert(featureSource.includes('option?.metadata?.heritageOnly'),"Grim Hollow imported Heritage wall filtering must be source-scoped");
const protectedText=[panel,css,featureSource].join("\n").toLowerCase();
for(const forbidden of ["advance_all_characters","map_routes","route_segment_progress","world_state"]) assert(!protectedText.includes(forbidden),`Species UI crossed protected map/travel boundary: ${forbidden}`);

console.log("Grim Hollow Species presentation validated: authentic 8-trait defaults, direct Heritage panel fallback and replacement, no imported text wall, full lore behind compact preview, portrait composition, unaffected non-Grim Species, and protected boundaries.");
