// C34 T36: RESEARCH-ONLY, strictly localhost-signed /npcs opt-in.
// Default-OFF returns no rewrites and preserves original pages/npcs.js and
// original shared _app, map, town, merchant and Forge behavior byte-for-byte.
// This file NEVER allows a hosted/Vercel production feature activation.
import {reconcileT36Route,T36_REWRITE} from "./scripts/integration/c34/prepare_t36_npcs_route.mjs";
const t36Enabled=reconcileT36Route(process.env);
export default {
  async rewrites(){
    return t36Enabled ? [T36_REWRITE] : [];
  },
};
