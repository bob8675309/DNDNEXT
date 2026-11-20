/** T46-P3-P4B-B research ONLY: original source exact, never auto-mounted. */
export const buildTownPresenceOverlay=function buildTownPresenceOverlay(original){
 let source=original;
 const once=(needle,replacement,label)=>{
  if(source.split(needle).length!==2)throw Error(label+" source anchor drift");
  source=source.replace(needle,replacement);
 };
 const flags='const T28_P2_TOWN_SHOP_ENABLED = process.env.NEXT_PUBLIC_C34_T28_P2_TOWN_SHOP === "1";';
 once(flags,flags+'\n// P4B research-only opt-in; absent by default, exact original town behavior remains.\nconst T46_P4B_TOWN_PRESENCE_ENABLED = process.env.NEXT_PUBLIC_C34_T46_P4B_TOWN_PRESENCE === "1";',"flag");
 const role='        } else if (user?.id) {\n          const { data: isAdminRpc } = await supabase.rpc("is_admin", { uid: user.id });';
 once(role,`        } else if (T46_P4B_TOWN_PRESENCE_ENABLED && user?.id) {
          const {data: signedGm,error: roleErr}=await supabase.rpc("c34_t46_get_npc_manager_identity_v1");
          admin=!roleErr && signedGm===true;
        } else if (user?.id) {
          const { data: isAdminRpc } = await supabase.rpc("is_admin", { uid: user.id });`,"signed GM role path");
 const begin='        const { data: rosterData } = await supabase\n          .from("characters")';
 const end='        if (user?.id) {\n          const { data: inventoryRows, error: inventoryErr }';
 const a=source.indexOf(begin),b=source.indexOf(end,a+begin.length);
 if(a<0||b<a||source.indexOf(begin,a+1)!==-1)throw Error("Town original two roster + market SELECT block drift");
 const legacy=source.slice(a,b);
 const guarded=`        if (T46_P4B_TOWN_PRESENCE_ENABLED) {
          // Authoritative server projection; never open Stage2 column grants.
          const before=await supabase.auth.getUser();
          const actor=before?.data?.user?.id||null;
          if (!actor || before.error) {
            if(isCurrentActor()){setRosterChars([]);setMarketData({presentMerchants:[],residentMerchants:[]});}
            return;
          }
          const {data:townPresence,error:townErr}=await supabase.rpc(
            "c34_t46_get_town_presence_v1",{p_location_id:Number(id)});
          const after=await supabase.auth.getUser();
          if (!isCurrentActor() || after.error || after?.data?.user?.id!==actor) return;
          if (townErr || !townPresence || !Array.isArray(townPresence.roster)
              || !Array.isArray(townPresence.presentMerchants)
              || !Array.isArray(townPresence.residentMerchants)) {
            setRosterChars([]);setMarketData({presentMerchants:[],residentMerchants:[]});
            throw new Error("Town presence authorization failed.");
          }
          setRosterChars(townPresence.roster);
          setMarketData({
            presentMerchants:dedupeMerchants(townPresence.presentMerchants),
            residentMerchants:dedupeMerchants(townPresence.residentMerchants)
          });
        } else {
${legacy}        }
\n`;
 source=source.slice(0,a)+guarded+source.slice(b);
 const hook='  const mapImageUrl = useMemo(() => {';
 const recheck=`  // Opt-in role/visibility refresh; strictly on signed actor, server current
  // role and town projection. No implicit world-map behavior.
  useEffect(() => {
    if (!T46_P4B_TOWN_PRESENCE_ENABLED || !router.isReady || !id) return;
    let disposed=false,busy=false;
    const revalidate=async()=>{
      if(disposed||busy)return;
      busy=true;
      try{
        const first=await supabase.auth.getUser(),actor=first?.data?.user?.id;
        if(first.error||!actor||actor!==playerUserId)return;
        const [role,presence]=await Promise.all([
          supabase.rpc("c34_t46_get_npc_manager_identity_v1"),
          supabase.rpc("c34_t46_get_town_presence_v1",{p_location_id:Number(id)})
        ]);
        const last=await supabase.auth.getUser();
        if(disposed||last.error||last?.data?.user?.id!==actor)return;
        if(role.error||presence.error||!presence.data?.roster){
          setActiveTownProfileCharacter(null);
          setRosterChars([]);setMarketData({presentMerchants:[],residentMerchants:[]});
          setIsAdmin(false);return;
        }
        const nowGm=role.data===true;
        const data=presence.data;
        const visible=new Set([
          ...data.roster,...data.presentMerchants,...data.residentMerchants
        ].map(row=>String(row.id)));
        if(nowGm!==isAdmin || (activeTownProfileCharacter?.id && !visible.has(String(activeTownProfileCharacter.id))))
          setActiveTownProfileCharacter(null);
        setIsAdmin(nowGm);
        setRosterChars(data.roster);
        setMarketData({
          presentMerchants:dedupeMerchants(data.presentMerchants),
          residentMerchants:dedupeMerchants(data.residentMerchants)
        });
      }finally{busy=false;}
    };
    window.addEventListener("focus",revalidate);
    const pulse=window.setInterval(revalidate,12000);
    return()=>{
      disposed=true;window.removeEventListener("focus",revalidate);
      window.clearInterval(pulse);
    };
  },[router.isReady,id,playerUserId,isAdmin,activeTownProfileCharacter?.id]);

`;
 once(hook,recheck+hook,"focus/role revalidation");
 // The default OFF route still contains the source-original queries.
 if(!source.includes('const merchantSelect = [')||!source.includes('T28_P2_TOWN_SHOP_ENABLED && requestedView === "shop"'))throw Error("Original Bazaar content lost");
 return source;
};
