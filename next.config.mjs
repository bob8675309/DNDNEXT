// C34 T36: RESEARCH-ONLY, strictly localhost-signed /npcs opt-in.
// Default-OFF returns no rewrites and preserves original pages/npcs.js and
// original shared _app, map, town, merchant and Forge behavior byte-for-byte.
// This file NEVER allows a hosted/Vercel production feature activation.
import {reconcileT36Route,T36_REWRITE} from "./scripts/integration/c34/prepare_t36_npcs_route.mjs";
const t36Enabled=reconcileT36Route(process.env);
export default {
  async rewrites(){
    // An array is applied AFTER existing pages in Next 16. The source
    // /npcs file already exists; beforeFiles is required to override it.
    // With the flag OFF, return the original no-rewrite [] contract.
    return t36Enabled
      ? {beforeFiles:[{...T36_REWRITE}],afterFiles:[],fallback:[]}
      : [];
  },
};
