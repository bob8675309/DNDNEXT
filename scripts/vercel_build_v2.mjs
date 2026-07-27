import { spawnSync } from "node:child_process";

process.env.NEXT_PUBLIC_APP_VERSION = String(process.env.NEXT_PUBLIC_APP_VERSION || process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || "local").slice(0, 12);
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "validation-placeholder";

// TEMPORARY PHASE 0 PREVIEW HARNESS.
// The normal production validator chain is intentionally bypassed only on this
// feature branch so we can inspect the isolated large-file source bake result.
// Restore the canonical runner before merge.
const steps = [
  ["node", ["scripts/phase0_preview_eight_direction_runtime.mjs"]],
  ["npx", ["next", "build"]],
];

for (const [command, args] of steps) {
  console.log(`\n> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) process.exit(result.status || 1);
}
