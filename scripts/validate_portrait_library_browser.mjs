import fs from "node:fs";

const read=(p)=>fs.readFileSync(p,"utf8");
const need=(src,t,label=t)=>{if(!src.includes(t)) throw new Error(`Missing ${label}: ${t}`);};
const forbid=(src,t,label=t)=>{if(src.includes(t)) throw new Error(`Forbidden ${label}: ${t}`);};

const picker=read("components/PortraitPickerModal.js");
const forge=read("components/NpcForgePortraitPickerModal.js");
const panel=read("components/PortraitLibraryFilterPanel.js");
const filters=read("utils/portraitLibraryFilters.js");
const css=read("styles/npc-page-controls.css");
const migration=read("sql/20261016_09_portrait_library_semantic_tags.sql");
const forgeModal=read("components/NewNpcModalV3Refined.js");

for(const token of [
  "PortraitLibraryFilterPanel",
  "Merchant-friendly first",
  "Unassigned first",
  "preferredUseCase",
  "portraitCardTags",
]) need(picker,token,"profile portrait browser");

for(const token of [
  "PortraitLibraryFilterPanel",
  "preferredUseCase",
  "Merchant-friendly first",
  "portraitCardTags",
]) need(forge,token,"Forge portrait browser");

for(const token of [
  "Species",
  "Role / profession",
  "Theme",
  "Assignment",
  "Merchant-friendly",
  "Unassigned",
  "Clear filters",
]) need(panel,token,"portrait filter tree");

for(const token of [
  "isMerchantFriendlyPortrait",
  "portraitFacetOptions",
  "portraitMatchesFilters",
  "sortPortraitRows",
  "merchant-friendly",
]) need(filters,token,"portrait filter model");

for(const token of [
  ".portrait-picker-browser",
  ".portrait-filter-panel",
  ".portrait-filter-options",
  ".portrait-picker-meta",
]) need(css,token,"portrait browser styling");

for(const token of [
  "profession_tags",
  "theme_tags",
  "merchant-friendly",
  "apothecary",
  "jeweler",
  "hospitality",
  "artisan",
  "market",
  "arcane",
]) need(migration,token,"portrait metadata migration");

need(forgeModal,"preferredUseCase={draft.kind}","merchant Forge smart default");

for(const src of [picker,forge,panel,filters,css,migration,forgeModal]){
  for(const token of ["MapPageClient","advance_all_characters_v3","get_weather_for_biome_day_v1"]){
    forbid(src,token,`protected world-map boundary ${token}`);
  }
}

console.log("Shared portrait library merchant filters, sorting, and metadata validated.");
