// 2026-10-31 read-only DnDWeb pg_proc snapshot. NOT live CI evidence.
// Recheck directly against Supabase before any production implementation.
// kind: wrapper (delegates only), processor (command ledger + transaction).
export const P2_CAST_RPC_SNAPSHOT = Object.freeze([
  ["encounter_cast_allocated_spell_v1","processor",true,"467fa475b7f61f97e358013884eb2475","allocations"],
  ["encounter_cast_area_spell_v1","processor",true,"63bce618022dc44d357f0a8a3059e7a6","selected-targets"],
  ["encounter_cast_directional_area_spell_v1","processor",true,"68a16c10eb831fefc4e4a5cc0821da31","direction"],
  ["encounter_cast_directional_area_spell_v2","processor",true,"30b3b80bbb48b1a39be3c2ae0d39be94","direction"],
  ["encounter_cast_point_area_spell_v1","processor",true,"ef6f58e829361fe89114d397a1949848","point"],
  ["encounter_cast_spell_v1","wrapper",true,"d5f2506a5f6570c2fa77182f8a4c3842","target"],
  ["encounter_cast_spell_v10","processor",true,"00d51eafc5eac574f979b88b277c6bb6","target"],
  ["encounter_cast_spell_v11","wrapper",true,"73b12d083ef540d308932f2b89a11d88","target"],
  ["encounter_cast_spell_v11_pre_1v","processor",false,"c810a3015c7e17dc594a39d8aa7306f3","target"],
  ["encounter_cast_spell_v12","processor",true,"2e8bef22f86dca97100e7299d746cef7","target"],
  ["encounter_cast_spell_v13","processor",true,"03ea7bd00bcd9734ef70ebc035c54a8d","target"],
  ["encounter_cast_spell_v1_pre_1v","processor",false,"6fa1a11fda0aea7aa80c80f7ffa545b7","target"],
  ["encounter_cast_spell_v2","processor",true,"f3679795837745bf0ce525baaa3d2b24","target"],
  ["encounter_cast_spell_v3","processor",true,"6a328f19558ba4bbc70e2070bbb28a6b","target"],
  ["encounter_cast_spell_v4","wrapper",true,"13b089859367f1dc68d795cfda7478d9","target"],
  ["encounter_cast_spell_v5","wrapper",true,"bc277eeef2e915d93cd85b5fce89c39a","target"],
  ["encounter_cast_spell_v5_pre_1v","processor",false,"a1a904c5cae1fcdf03116887a320b32f","target"],
  ["encounter_cast_spell_v6","wrapper",true,"01b7cf95dce7e846d18ed727ff24c513","target"],
  ["encounter_cast_spell_v6_pre_1v","processor",false,"4081f4b8a10b999d95199cbfe8f75ecf","target"],
  ["encounter_cast_spell_v7","wrapper",true,"c0493fa09d3b2484973b30dae9227d6b","target"],
  ["encounter_cast_spell_v8","wrapper",true,"02d205bd666d56c89f67040859917615","target"],
  ["encounter_cast_spell_v9","wrapper",true,"82f14736b1761ff3a2f9316157d84a4a","target"]
].map(([name,kind,authenticatedExecute,liveBodyMd5,intent])=>
  Object.freeze({name,kind,authenticatedExecute,liveBodyMd5,intent,
    historicalProcessingOrder:kind==="processor"?"ledger-before-caster-lock":"delegate"})));
