// C34 T46-P3-P3B UNMOUNTED source-exact transformation for disposable CI ONLY.
// Never apply to production: full original consumer parity remains open.
export const buildSecureManagerCandidate = function buildSecureManagerCandidate(original){
 let source=original;
 const one=(needle,replacement,label)=>{
  const n=source.split(needle).length-1;
  if(n!==1)throw Error(`${label||needle.slice(0,40)} anchor count ${n}`);
  source=source.replace(needle,replacement);
 };
 const between=(start,end,replacement,label)=>{
  const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
  if(a<0||b<=a||source.indexOf(start,a+1)!==-1)throw Error(`${label}: original source anchors drift`);
  source=source.slice(0,a)+replacement+source.slice(b);
 };
 const auth=String.raw`  const loadAuth = useCallback(async () => {
    const before = await supabase.auth.getUser();
    const nextUserId = before?.data?.user?.id || null;
    if (before.error || !nextUserId) {
      setUserId(null);setIsAdmin(false);return;
    }
    const access = await supabase.rpc("c34_t46_get_npc_manager_identity_v1");
    const after = await supabase.auth.getUser();
    if (access.error || after.error || after?.data?.user?.id !== nextUserId) {
      setUserId(null);setIsAdmin(false);return;
    }
    setUserId(nextUserId);
    setIsAdmin(access.data === true);
  }, []);`;
 between('  const loadAuth = useCallback(async () => {',
  '  /* ------------------- load basics ------------------- */',auth+"\n\n","signed GM identity");
 const loaders=String.raw`  // T46-P3-P3B temporary research: only a server-authorized role-scoped
  // roster projection. No raw characters/secret, no canonical bulk Sheet.
  const rosterRequestRef = useRef(0);
  const loadNpcs = useCallback(async () => {
    const generation = ++rosterRequestRef.current;
    const before = await supabase.auth.getUser();
    const actorId = before?.data?.user?.id || null;
    if (!actorId) {
      if (generation === rosterRequestRef.current) {
        setNpcs([]);setMerchants([]);setMerchantProfiles(new Map());
      }
      return;
    }
    const result = await supabase.rpc("c34_t46_get_npc_manager_roster_v1");
    const after = await supabase.auth.getUser();
    if (generation !== rosterRequestRef.current || after?.data?.user?.id !== actorId) return;
    if (result.error || !Array.isArray(result.data)) {
      setErr(result.error?.message || "NPC roster authorization failed.");
      setNpcs([]);setMerchants([]);setMerchantProfiles(new Map());
      return;
    }
    setErr("");
    const safeRows = result.data;
    setNpcs(safeRows.filter(row => row?.kind === "npc"));
    setMerchants(safeRows.filter(row => row?.kind === "merchant"));
    setMerchantProfiles(new Map(safeRows.filter(row => row?.kind === "merchant")
      .map(row => [String(row.id),row])));
  }, []);
  // The single roster request populates both NPC and merchant sources.
  const loadMerchants = useCallback(async () => {},[]);
  const loadMerchantProfiles = useCallback(async () => {},[]);
`;
 between('  const loadNpcs = useCallback(async () => {',
 '  /* ------------------- roster merge ------------------- */',loaders+"\n","raw NPC/merchant roster readers");
 const bulk=String.raw`  // Private canonical Sheets are never loaded before selecting a character.
  useEffect(() => { setSheetCacheReady(true); }, []);

`;
 between('  useEffect(() => {\n    let cancelled = false;\n    (async () => {\n      const { data, error } = await supabase\n        .from("character_sheets")\n        .select("character_id,sheet");',
 '  // Keep the editable draft in sync',bulk,"bulk all-Sheet preload");
 one('const hasCachedSheet = Boolean(selectedId) && sheetCacheRef.current.has(String(selectedId));',
  'const hasCachedSheet = false;', "selection private cache");
 one('sheetCacheRef.current.set(String(activeId), deepClone(sheet));',
  '// No private canonical Sheet memoization across requests.',"private sheet cache write");
 const sheet=String.raw`  const loadSelectedSheet = useCallback(async (key, { force = false } = {}) => {
    const requestedKey = normalizeNpcSelectionKey(key);
    const requestId = ++sheetRequestRef.current;
    const current = () => isCurrentNpcSelectionRequest({
      activeKey: selectedKeyRef.current, requestedKey,
      activeRequestId: sheetRequestRef.current, requestId
    });
    const characterId = parseKey(requestedKey)?.id || null;
    if (!characterId) {
      if (current()) {setSheet(null);setSheetDraft({});setSheetLoading(false);}
      return null;
    }
    if (current()) {
      setSheetLoading(true);setSheet(null);setSheetDraft({});
      setSheetLoadError("");
    }
    try {
      const before = await supabase.auth.getUser();
      const actor = before?.data?.user?.id || null;
      if (!actor || before.error) throw new Error("Signed-in Sheet editor required.");
      const first = await supabase.rpc("c34_t46_get_npc_manager_authority_v1",
        {p_character_id:characterId});
      if (first.error || first.data?.can_edit !== true)
        throw new Error("Private character Sheet access is not currently granted.");
      const result = await supabase.from("character_sheets").select("sheet")
        .eq("character_id",characterId).maybeSingle();
      if (result.error || !result.data?.sheet)
        throw new Error("No authorized character Sheet is available.");
      // A previously authorized in-flight read must not become a stale
      // post-revocation render after actor or grant changes.
      const [last,after] = await Promise.all([
        supabase.rpc("c34_t46_get_npc_manager_authority_v1",
          {p_character_id:characterId}),
        supabase.auth.getUser()
      ]);
      if (!current()) return null;
      if (after.error || after?.data?.user?.id !== actor ||
          last.error || last.data?.can_edit !== true)
        throw new Error("Private character Sheet authorization expired.");
      setCharPerm(last.data);
      setSheet(deepClone(result.data.sheet));
      setSheetDraft(deepClone(result.data.sheet));
      setSheetEditMode(false);
      setSheetLoadError("");
      return result.data.sheet;
    } catch (error) {
      if (current()) {
        setSheet(null);setSheetDraft({});setSheetEditMode(false);
        setSheetLoadError(error?.message || "Private Sheet unavailable.");
      }
      return null;
    } finally {
      if (current()) setSheetLoading(false);
    }
  }, []);

  const clearPrivateManagerState = useCallback(() => {
    ++sheetRequestRef.current;
    ++rosterRequestRef.current;
    ++equipmentRequestRef.current;
    ++notesRequestRef.current;
    sheetCacheRef.current.clear();
    selectedKeyRef.current = "";
    setSelectedKey(null);
    setNpcs([]);setMerchants([]);setMerchantProfiles(new Map());
    setCharPerm(null);setSheet(null);setSheetDraft({});
    setSheetEditMode(false);setSheetLoadError("");
    setNotes([]);setEquippedRows([]);setLastRoll(null);
    setDetailsBase(null);setDetailsDraft(null);setProfilePanelOpen(false);
  }, []);

  useEffect(() => {
    let disposed = false;
    const revalidate = async () => {
      const before = await supabase.auth.getUser();
      const actor = before?.data?.user?.id || null;
      if (disposed) return;
      if (before.error || !actor || actor !== userId) {
        clearPrivateManagerState();
        setIsAdmin(false);
        setUserId(actor);
        if (actor) queueMicrotask(() => {void loadAuth();void loadNpcs();});
        return;
      }
      const key = selectedKeyRef.current;
      const characterId = parseKey(key)?.id || null;
      const [gm,caps] = await Promise.all([
        supabase.rpc("c34_t46_get_npc_manager_identity_v1"),
        characterId
          ? supabase.rpc("c34_t46_get_npc_manager_authority_v1",
              {p_character_id:characterId})
          : Promise.resolve({data:null,error:null})
      ]);
      const after = await supabase.auth.getUser();
      if (disposed || after?.data?.user?.id !== actor ||
          selectedKeyRef.current !== key) return;
      const currentGm = !gm.error && gm.data === true;
      const currentCanEdit = !!caps.data?.can_edit;
      const oldCanEdit = !!isAdmin || !!charPerm?.can_edit;
      if (gm.error || (characterId && caps.error) ||
          currentGm !== isAdmin || (characterId && currentCanEdit !== oldCanEdit)) {
        clearPrivateManagerState();
        setIsAdmin(currentGm);
        setUserId(actor);
        void loadNpcs();
      } else if (characterId && caps.data) {
        setCharPerm(caps.data);
      }
    };
    const onFocus = () => {void revalidate();};
    window.addEventListener("focus",onFocus);
    const interval = window.setInterval(onFocus,12000);
    const {data:listener} = supabase.auth.onAuthStateChange((_event,session) => {
      const actor = session?.user?.id || null;
      if (disposed || actor === userId) return;
      clearPrivateManagerState();
      setUserId(actor);
      setIsAdmin(false);
      if (actor) queueMicrotask(() => {void loadAuth();void loadNpcs();});
    });
    return () => {
      disposed = true;
      window.removeEventListener("focus",onFocus);
      window.clearInterval(interval);
      listener?.subscription?.unsubscribe();
    };
  }, [userId,isAdmin,charPerm?.can_edit,loadNpcs,loadAuth,
      clearPrivateManagerState]);

`;
 between('  const loadSelectedSheet = useCallback(async (key, { force = false } = {}) => {',
 '  // Load equipped items for NPC/merchant when selection changes.',sheet,"selected private Sheet loader");
 one('enabled: !!selected?.id && (!!isAdmin || !!charPerm?.can_inventory || !!charPerm?.can_edit),',
 'enabled: !!selected?.id && (!!isAdmin || !!charPerm?.can_edit),',"inventory-only progression hook");
 one('isAdmin={isAdmin || canEditCharacter}',"isAdmin={isAdmin}","editor must not become GM");
 if(source.includes('.select("character_id,sheet")'))throw Error("bulk Sheet query still present");
 if(source.includes('loadCharacterSecrets(supabase'))throw Error("old direct GM secrets loader retained");
 if(source.includes('sheetCacheRef.current.set('))throw Error("raw Sheet memoization retained");
 return source;
};
