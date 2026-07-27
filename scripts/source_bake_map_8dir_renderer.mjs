import fs from "node:fs";

// One-time, branch-only source bake. This script must be removed after MapPageClient is committed.
const path = "components/MapPageClient.js";
let source = fs.readFileSync(path, "utf8");

function replaceOnce(label, pattern, replacement) {
  const matches = typeof pattern === "string"
    ? source.split(pattern).length - 1
    : [...source.matchAll(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`))].length;
  if (matches !== 1) throw new Error(`${label}: expected exactly one match, found ${matches}`);
  source = source.replace(pattern, replacement);
}

function replaceAllChecked(label, pattern, replacement, minimum = 1) {
  const matches = [...source.matchAll(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`))].length;
  if (matches < minimum) throw new Error(`${label}: expected at least ${minimum} matches, found ${matches}`);
  source = source.replace(pattern, replacement);
}

replaceOnce(
  "sprite imports",
  'import { useInterpolatedPoses } from "../hooks/useInterpolatedPoses";\n',
  'import { useInterpolatedPoses } from "../hooks/useInterpolatedPoses";\nimport MapSprite from "./MapSprite";\nimport { EIGHT_DIRECTION_ORDER, spriteDirectionFromVelocity } from "../utils/spriteAnimation";\n'
);

replaceOnce(
  "legacy sprite constants",
  /\/\/ NPC sprite sheet defaults[\s\S]*?function spriteDirFromVelocity\(vx, vy, fallback = "down"\) \{[\s\S]*?\n\}\n\n/,
  `// Visual-only sprite defaults. Movement authority remains in useInterpolatedPoses.\nconst LEGACY_SPRITE_ASSET = Object.freeze({\n  sprite_format: "legacy_4dir_3frame_32",\n  frame_width: 32,\n  frame_height: 32,\n  direction_order: ["down", "left", "right", "up"],\n  idle_frame: 0,\n  walk_frames: [0, 1, 2],\n  fps: 7,\n  overworld_scale: 0.7,\n});\n\nfunction spriteAssetFor(character) {\n  const asset = character?.visual_asset || character?.npc_visual_assets || null;\n  if (!asset || asset.is_active === false) return null;\n  return asset;\n}\n\nfunction spriteUrlFor(character, asset) {\n  const direct = String(asset?.public_url || "").trim();\n  if (direct) return direct;\n  const spritePath = String(asset?.sprite_path || character?.sprite_path || "").trim();\n  if (!spritePath) return null;\n  const bucket = asset?.sprite_bucket || MAP_ICONS_BUCKET;\n  try {\n    return supabase.storage.from(bucket).getPublicUrl(spritePath).data?.publicUrl || null;\n  } catch {\n    return null;\n  }\n}\n\nfunction directionAllowed(asset, direction) {\n  const order = Array.isArray(asset?.direction_order) && asset.direction_order.length\n    ? asset.direction_order\n    : EIGHT_DIRECTION_ORDER;\n  return order.includes(direction);\n}\n\n`
);

replaceOnce(
  "merchant projection visual asset",
  '    sprite_scale: (typeof row.sprite_scale === "number" ? row.sprite_scale : null),\n',
  '    sprite_scale: (typeof row.sprite_scale === "number" ? row.sprite_scale : null),\n    visual_asset_id: row.visual_asset_id || null,\n    visual_asset: row.visual_asset || null,\n'
);

const richAssetSelectDouble = '      "visual_asset_id",\n      "visual_asset:npc_visual_assets!characters_visual_asset_id_fkey(id,name,sprite_bucket,sprite_path,sprite_format,frame_width,frame_height,direction_order,idle_frame,walk_frames,fps,default_scale,overworld_scale,tactical_scale,is_active)",\n';
replaceAllChecked(
  "double-quoted sprite selects",
  /      "sprite_scale",\n/g,
  (match) => `${match}${richAssetSelectDouble}`,
  2
);

const richAssetSelectSingle = "      'visual_asset_id',\n      'visual_asset:npc_visual_assets!characters_visual_asset_id_fkey(id,name,sprite_bucket,sprite_path,sprite_format,frame_width,frame_height,direction_order,idle_frame,walk_frames,fps,default_scale,overworld_scale,tactical_scale,is_active)',\n";
replaceAllChecked(
  "single-quoted sprite selects",
  /      'sprite_scale',\n/g,
  (match) => `${match}${richAssetSelectSingle}`,
  4
);

replaceOnce(
  "hit testing metadata",
  /      const sc = Number\.isFinite\(Number\(n\.sprite_scale\)\) \? Number\(n\.sprite_scale\) : 0\.7;\n      const halfW = \(base \* sc\) \/ 2;\n      const halfH = \(base \* sc\) \/ 2;/,
  `      const asset = spriteAssetFor(n);\n      const frameW = Number(asset?.frame_width || base);\n      const frameH = Number(asset?.frame_height || base);\n      const sc = Number.isFinite(Number(asset?.overworld_scale ?? n.sprite_scale))\n        ? Number(asset?.overworld_scale ?? n.sprite_scale)\n        : 0.7;\n      const halfW = (frameW * sc) / 2;\n      const halfH = (frameH * sc) / 2;`
);

replaceOnce(
  "merchant sprite calculation",
  /              const hasSprite = !!m\.sprite_path;[\s\S]*?              const scale = typeof m\.sprite_scale === "number" \? m\.sprite_scale : 0\.7;/,
  `              const asset = spriteAssetFor(m);\n              const hasSprite = !!(asset?.sprite_path || m.sprite_path);\n              if (!hasSprite) return null;\n              const spriteUrl = spriteUrlFor(m, asset);\n\n              const st = String(m.state || "").toLowerCase();\n              const rv = renderPositionsRef.current?.[\`merchant:\${m.id}\`];\n              const isMoving = !!rv?.moving && (st === "moving" || st === "excursion");\n              const fallbackDir = directionAllowed(asset, rv?.dirHint) ? rv.dirHint : "down";\n              const dir = isMoving\n                ? spriteDirectionFromVelocity(rv?.vx ?? 0, rv?.vy ?? 0, fallbackDir)\n                : fallbackDir;\n              const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();\n              const scale = Number(asset?.overworld_scale ?? m.sprite_scale ?? LEGACY_SPRITE_ASSET.overworld_scale);`
);

replaceOnce(
  "merchant sprite jsx",
  /                  \{hasSprite \? \(\n                    <span\n                      className="merchant-sprite"[\s\S]*?                    \/>\n                  \) : \(/,
  `                  {hasSprite ? (\n                    <MapSprite\n                      spriteUrl={spriteUrl}\n                      asset={asset || LEGACY_SPRITE_ASSET}\n                      direction={dir}\n                      moving={isMoving}\n                      scale={scale}\n                      className="merchant-sprite"\n                      clockMs={nowMs}\n                    />\n                  ) : (`
);

replaceOnce(
  "npc sprite calculation",
  /              const hasSprite = !!n\.sprite_path;[\s\S]*?              const spriteScale = typeof n\.sprite_scale === "number" \? n\.sprite_scale : 0\.7;/,
  `              const asset = spriteAssetFor(n);\n              const hasSprite = !!(asset?.sprite_path || n.sprite_path);\n              const spriteUrl = spriteUrlFor(n, asset);\n\n              const st = String(n.state || "").toLowerCase();\n              const rv = renderPositionsRef.current?.[\`npc:\${n.id}\`];\n              const isMoving = !!rv?.moving && (st === "moving" || st === "excursion");\n              const savedDirection = directionAllowed(asset, n.sprite_dir) ? n.sprite_dir : "down";\n              const dir = isMoving\n                ? spriteDirectionFromVelocity(rv?.vx ?? 0, rv?.vy ?? 0, savedDirection)\n                : savedDirection;\n              const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();\n              const scale = Number(asset?.overworld_scale ?? n.sprite_scale ?? LEGACY_SPRITE_ASSET.overworld_scale);`
);

replaceOnce(
  "npc sprite jsx",
  /                    \{hasSprite \? \(\n                      <span\n                        className="npc-sprite"[\s\S]*?                      \/>\n                    \) : disp\?\.emoji \? \(/,
  `                    {hasSprite ? (\n                      <MapSprite\n                        spriteUrl={spriteUrl}\n                        asset={asset || LEGACY_SPRITE_ASSET}\n                        direction={dir}\n                        moving={isMoving}\n                        scale={scale}\n                        className="npc-sprite"\n                        clockMs={nowMs}\n                      />\n                    ) : disp?.emoji ? (`
);

for (const forbidden of [
  "SPRITE_FRAME_W",
  "SPRITE_FRAME_H",
  "SPRITE_FRAMES_PER_DIR",
  "SPRITE_DIR_ORDER",
  "spriteDirFromVelocity(",
]) {
  if (source.includes(forbidden)) throw new Error(`legacy renderer token survived: ${forbidden}`);
}

for (const required of [
  'import MapSprite from "./MapSprite";',
  "spriteDirectionFromVelocity",
  "visual_asset:npc_visual_assets!characters_visual_asset_id_fkey",
  "asset={asset || LEGACY_SPRITE_ASSET}",
]) {
  if (!source.includes(required)) throw new Error(`required 8-direction renderer token missing: ${required}`);
}

fs.writeFileSync(path, source, "utf8");
console.log("Source-baked metadata-driven 8-direction world sprite rendering into MapPageClient.js");
