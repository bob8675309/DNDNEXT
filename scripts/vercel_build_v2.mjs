import { spawnSync } from "node:child_process";

process.env.NEXT_PUBLIC_APP_VERSION = String(process.env.NEXT_PUBLIC_APP_VERSION || process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || "local").slice(0, 12);
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "validation-placeholder";

// TEMPORARY Phase 0 diagnostic: run source/readiness validators without the runner-shape validator.
const steps = [
  ["node", ["scripts/validate_source_patch_pipeline_cleanup.mjs"]],
  ["node", ["scripts/validate_large_file_source_bake_readiness.mjs"]],
];

for (const [command, args] of steps) {
  console.log(`\n> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) process.exit(result.status || 1);
}
