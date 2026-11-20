// C34 T46-P3-P4A: UNMOUNTED source-exact composition for signed, disposable CI only.
// Original active app and held PR contributions are NEVER modified by these exports.
export const buildHeldNpcWithIntelAndPrint = function buildHeldNpcWithIntelAndPrint(src){
 const replaceOne=(old,next,what)=>{
  if(src.split(old).length!==2)throw Error("held #345 "+what+" anchor drift");
  src=src.replace(old,next);
 };
 replaceOne('import CreatorBackstoryPanel from "./CreatorBackstoryPanel";',
 'import CreatorBackstoryPanel from "./CreatorBackstoryPanel";\nimport DiscoveredProgressionIntel from "./c34/DiscoveredProgressionIntel";',
 "discovered import");
 replaceOne('                  printProfile={printableProfile}',
 '                  printProfile={printableProfile}\n                  freshPrintAuthorizationCharacterId={npcId}',
 "profile Sheet print capability");
 replaceOne('          <CreatorBackstoryPanel key={npcId} characterId={npcId} />',
 `          <CreatorBackstoryPanel key={npcId} characterId={npcId} />
          <div className="npc-c34-discovered-intel" style={{gridColumn:"1 / -1"}}>
            <DiscoveredProgressionIntel client={supabase} characterId={npcId} />
          </div>`,
 "Profile-only curated published clue and separate class/level/xp");
 if(!src.includes("onBackToProfile"))throw Error("Merchant return Profile must be preserved");
 return src;
};
export const buildGuardedSheetPanel = function buildGuardedSheetPanel(src){
 const replaceOne=(old,next,what)=>{
  if(src.split(old).length!==2)throw Error("source-original Sheet "+what+" anchor drift");
  src=src.replace(old,next);
 };
 replaceOne('  printProfile = null,',
 '  freshPrintAuthorizationCharacterId = null,\n  printProfile = null,',
 "param");
 replaceOne('  async function openOfficialPrintableSheet() {\n',
 `  async function openOfficialPrintableSheet() {
    let printActor = null;
    const recheckServerPrintPermission = async () => {
      const cid = freshPrintAuthorizationCharacterId;
      if (!cid) return;
      if (characterId !== cid) throw new Error("Character Sheet print identity mismatch.");
      const before = await supabase.auth.getUser();
      const uid = before?.data?.user?.id;
      if (before.error || !uid || (printActor && printActor !== uid))
        throw new Error("Character Sheet print authorization expired.");
      printActor = uid;
      const authority = await supabase.rpc("can_manage_character_progression_v1", {p_character_id:cid});
      const after = await supabase.auth.getUser();
      if (authority.error || authority.data !== true || after.error || after?.data?.user?.id !== printActor)
        throw new Error("Character Sheet print authorization expired.");
    };
`, "guard function");
 replaceOne('    try {\n      const model = buildPrintableCharacterSheetModel({',
 '    try {\n      await recheckServerPrintPermission();\n      const model = buildPrintableCharacterSheetModel({',
 "pre-model check");
 replaceOne('      const pdfBytes = await buildOfficialCharacterSheetPdf({ model });\n      const blob = new Blob(',
 '      const pdfBytes = await buildOfficialCharacterSheetPdf({ model });\n      await recheckServerPrintPermission();\n      const blob = new Blob(',
 "pre-exposure check");
 replaceOne('      console.error("Printable official character sheet failed", error);',
 '      if (error?.message !== "Character Sheet print authorization expired.") console.error("Printable official character sheet failed", error);',
 "expected denial logs");
 return src;
};
export const buildManagerWithGuard = function buildManagerWithGuard(src){
 const target="                    <CharacterSheetPanel\n";
 if(src.split(target).length!==2)throw Error("Current manager Sheet source anchor drift");
 src=src.replace(target,target+'                      freshPrintAuthorizationCharacterId={selected?.id || null}\n');
 // A player denied the private Sheet still needs access to a sanitized
 // public Profile. Never weaken RLS to populate the private Sheet instead.
 const denied='                        <button type="button" className="btn btn-sm btn-outline-light" onClick={retrySelectedSheet}>\n                          Retry sheet\n                        </button>';
 if(src.split(denied).length!==2)throw Error("Manager denied Sheet navigation drift");
 src=src.replace(denied,
  '                        <button type="button" className="btn btn-sm btn-outline-light" onClick={() => {setProfilePanelInitialView("profile");setProfilePanelOpen(true);}}>Open public Profile</button>\n'+
  '                        {canEditCharacter ? <button type="button" className="btn btn-sm btn-outline-light ms-2" onClick={retrySelectedSheet}>Retry sheet</button> : null}');
 // No storefront bypasses the NPC Profile. Its original Talk button permits
 // explicit user navigation to Shop and Back to Profile.
 const bypass='setProfilePanelInitialView("shop"); setProfilePanelOpen(true);';
 if(src.split(bypass).length!==2)throw Error("Manager merchant direct Shop navigation drift");
 src=src.replace(bypass,'setProfilePanelInitialView("profile"); setProfilePanelOpen(true);');
 return src;
};

// Original MerchantPanel accepts onBackToProfile but never renders its control.
// Preserve every source-original stock/action and add only the missing explicit
// Profile return when the parent supplies the callback (disposable CI ONLY).
export function buildMerchantReturnToProfile(src) {
 const anchor='      headerActions={<>\n';
 if(src.split(anchor).length!==2)throw Error("Merchant original header action anchor drift");
 src=src.replace(anchor,anchor+
  '        {typeof onBackToProfile === "function" ? <button type="button" className="btn btn-sm btn-outline-light" onClick={onBackToProfile}>Return to Profile</button> : null}\n');
 return src;
}
