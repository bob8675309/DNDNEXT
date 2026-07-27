import fs from "node:fs";

const path = process.env.SPRITE_BAKE_TARGET || "components/MapPageClient.js";
let source = fs.readFileSync(path, "utf8");

function countString(needle) {
  return source.split(needle).length - 1;
}

function replaceOnce(label, search, replacement) {
  const count = typeof search === "string"
    ? countString(search)
    : [...source.matchAll(new RegExp(search.source, search.flags.includes("g") ? search.flags : `${search.flags}g`))].length;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}`);
  source = source.replace(search, replacement);
}

function replaceAllChecked(label, search, replacement, minimum) {
  const regex = new RegExp(search.source, search.flags.includes("g") ? search.flags : `${search.flags}g`);
  const count = [...source.matchAll(regex)].length;
  if (count < minimum) throw new Error(`${label}: expected at least ${minimum} matches, found ${count}`);
  source = source.replace(regex, replacement);
}

replaceOnce(
  "sprite runtime imports",
  'import { useInterpolatedPoses } from "../hooks/useInterpolatedPoses";\n',
  'import { useInterpolatedPoses } from "../hooks/useInterpolatedPoses";\nimport MapSprite from "./MapSprite";\nimport { EIGHT_DIRECTION_ORDER, spriteDirectionFromVelocity } from "../utils/spriteAnimation";\n'
);

replaceOnce(
  "legacy sprite constants",
  /\/\/ NPC sprite sheet defaults \(map-icons\/npc-icons\)[\s\S]*?function spriteDirFromVelocity\(vx, vy, fallback = "down"\) \{[\s\S]*?\n\}\n\n/,
  `// Sprite rendering is visual-only. Route/pathing/world-time authority remains in the existing movement system.\n// DNDNext uses one production sprite contract: 64x64 frames, eight direction rows, one idle + three walk frames.\nconst MAP_SPRITE_ASSET = Object.freeze({\n  sprite_format: "eight_direction_idle_walk_v1",\n  frame_width: 64,\n  frame_height: 64,\n  direction_order: EIGHT_DIRECTION_ORDER,\n  idle_frame: 0,\n  walk_frames: [1, 2, 3],\n  fps: 7,\n  overworld_scale: 0.35,\n});\n\nfunction mapSpriteDirFromVelocity(vx, vy, fallback = "down") {\n  return spriteDirectionFromVelocity(vx, vy, EIGHT_DIRECTION_ORDER.includes(fallback) ? fallback : "down");\n}\n\n`
);

replaceOnce(
  "merchant projection visual asset id",
  '    sprite_scale: (typeof row.sprite_scale === "number" ? row.sprite_scale : null),\n',
  '    sprite_scale: (typeof row.sprite_scale === "number" ? row.sprite_scale : null),\n    visual_asset_id: row.visual_asset_id || null,\n'
);

replaceAllChecked(
  "double quoted character sprite selects",
  /      "sprite_scale",\n/g,
  '      "sprite_scale",\n      "visual_asset_id",\n',
  2
);

replaceAllChecked(
  "single quoted character sprite selects",
  /      'sprite_scale',\n/g,
  "      'sprite_scale',\n      'visual_asset_id',\n",
  4
);

replaceOnce(
  "sprite hit testing",
  `    const base = 32; // frame size\n\n    // Iterate top-to-bottom: last drawn is visually on top. mapNpcs is rendered in order.\n`,
  `    // Iterate top-to-bottom: last drawn is visually on top. mapNpcs is rendered in order.\n`
);

replaceOnce(
  "sprite hitbox dimensions",
  `      const sc = Number.isFinite(Number(n.sprite_scale)) ? Number(n.sprite_scale) : 0.7;\n      const halfW = (base * sc) / 2;\n      const halfH = (base * sc) / 2;`,
  `      const sc = Number.isFinite(Number(n.sprite_scale)) ? Number(n.sprite_scale) : MAP_SPRITE_ASSET.overworld_scale;\n      const halfW = (MAP_SPRITE_ASSET.frame_width * sc) / 2;\n      const halfH = (MAP_SPRITE_ASSET.frame_height * sc) / 2;`
);

replaceOnce(
  "merchant sprite presence",
  "              const hasSprite = !!m.sprite_path;",
  "              const hasSprite = !!m.visual_asset_id && !!m.sprite_path;"
);

replaceOnce(
  "merchant sprite runtime calculation",
  /              const st = String\(m\.state \|\| ""\)\.toLowerCase\(\);\n              const rv = renderPositionsRef\.current\?\.\[`merchant:\$\{m\.id\}`\];\n              const isMoving = !!rv\?\.moving && \(st === "moving" \|\| st === "excursion"\);\n              const fallbackDir = \(rv\?\.dirHint && SPRITE_DIR_ORDER\.includes\(rv\.dirHint\) && rv\.dirHint\) \|\| "down";\n              const dir = isMoving \? spriteDirFromVelocity\(rv\?\.vx \?\? 0, rv\?\.vy \?\? 0, fallbackDir\) : fallbackDir;\n              const row = Math\.max\(0, SPRITE_DIR_ORDER\.indexOf\(dir\)\);\n              const nowMs = typeof performance !== "undefined" \? performance\.now\(\) : Date\.now\(\);\n              const frame = isMoving \? Math\.floor\(nowMs \/ 140\) % SPRITE_FRAMES_PER_DIR : 0;\n              const scale = typeof m\.sprite_scale === "number" \? m\.sprite_scale : 0\.7;/,
  `              const st = String(m.state || "").toLowerCase();\n              const rv = renderPositionsRef.current?.[\`merchant:\${m.id}\`];\n              const isMoving = !!rv?.moving && (st === "moving" || st === "excursion");\n              const fallbackDir = (rv?.dirHint && EIGHT_DIRECTION_ORDER.includes(rv.dirHint) && rv.dirHint) || "down";\n              const dir = isMoving ? mapSpriteDirFromVelocity(rv?.vx ?? 0, rv?.vy ?? 0, fallbackDir) : fallbackDir;\n              const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();\n              const scale = typeof m.sprite_scale === "number" ? m.sprite_scale : MAP_SPRITE_ASSET.overworld_scale;`
);

replaceOnce(
  "merchant sprite renderer",
  /                  \{hasSprite \? \(\n                    <span\n                      className="merchant-sprite"[\s\S]*?                      aria-hidden="true"\n                    \/>\n                  \) : \(/,
  `                  {hasSprite ? (\n                    <MapSprite\n                      spriteUrl={spriteUrl}\n                      asset={MAP_SPRITE_ASSET}\n                      direction={dir}\n                      moving={isMoving}\n                      scale={scale}\n                      className="merchant-sprite"\n                      clockMs={nowMs}\n                    />\n                  ) : (`
);

replaceOnce(
  "npc sprite presence",
  "              const hasSprite = !!n.sprite_path;",
  "              const hasSprite = !!n.visual_asset_id && !!n.sprite_path;"
);

replaceOnce(
  "npc sprite runtime calculation",
  /              const st = String\(n\.state \|\| ""\)\.toLowerCase\(\);\n              const rv = renderPositionsRef\.current\?\.\[`npc:\$\{n\.id\}`\];\n              const isMoving = !!rv\?\.moving && \(st === "moving" \|\| st === "excursion"\);\n              const fallbackDir = \(n\.sprite_dir && SPRITE_DIR_ORDER\.includes\(n\.sprite_dir\) && n\.sprite_dir\) \|\| "down";\n              const dir = isMoving \? spriteDirFromVelocity\(rv\?\.vx \?\? 0, rv\?\.vy \?\? 0, fallbackDir\) : fallbackDir;\n\n              const row = Math\.max\(0, SPRITE_DIR_ORDER\.indexOf\(dir\)\);\n              const nowMs = typeof performance !== "undefined" \? performance\.now\(\) : Date\.now\(\);\n              const frame = isMoving \? \(Math\.floor\(nowMs \/ 140\) % SPRITE_FRAMES_PER_DIR\) : 0;\n              const scale = typeof n\.sprite_scale === "number" \? n\.sprite_scale : 0\.7;\n              const spriteStyle = hasSprite[\s\S]*?              const spriteScale = typeof n\.sprite_scale === "number" \? n\.sprite_scale : 0\.7;/,
  `              const st = String(n.state || "").toLowerCase();\n              const rv = renderPositionsRef.current?.[\`npc:\${n.id}\`];\n              const isMoving = !!rv?.moving && (st === "moving" || st === "excursion");\n              const fallbackDir = (n.sprite_dir && EIGHT_DIRECTION_ORDER.includes(n.sprite_dir) && n.sprite_dir) || "down";\n              const dir = isMoving ? mapSpriteDirFromVelocity(rv?.vx ?? 0, rv?.vy ?? 0, fallbackDir) : fallbackDir;\n              const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();\n              const scale = typeof n.sprite_scale === "number" ? n.sprite_scale : MAP_SPRITE_ASSET.overworld_scale;`
);

replaceOnce(
  "npc sprite renderer",
  /                    \{hasSprite \? \(\n                      <span\n                        className="npc-sprite"[\s\S]*?                      \/>\n                    \) : disp\?\.emoji \? \(/,
  `                    {hasSprite ? (\n                      <MapSprite\n                        spriteUrl={spriteUrl}\n                        asset={MAP_SPRITE_ASSET}\n                        direction={dir}\n                        moving={isMoving}\n                        scale={scale}\n                        className="npc-sprite"\n                        clockMs={nowMs}\n                      />\n                    ) : disp?.emoji ? (`
);

for (const forbidden of [
  "SPRITE_FRAME_W",
  "SPRITE_FRAME_H",
  "SPRITE_FRAMES_PER_DIR",
  "SPRITE_DIR_ORDER",
  "spriteDirFromVelocity(",
  "legacy_4dir",
  "LEGACY_MAP_SPRITE_ASSET",
  "const spriteStyle = hasSprite",
  "const spriteScale =",
]) {
  if (source.includes(forbidden)) throw new Error(`legacy inline renderer token survived: ${forbidden}`);
}

for (const required of [
  'import MapSprite from "./MapSprite";',
  'EIGHT_DIRECTION_ORDER, spriteDirectionFromVelocity',
  "MAP_SPRITE_ASSET",
  'sprite_format: "eight_direction_idle_walk_v1"',
  "!!n.visual_asset_id && !!n.sprite_path",
  "!!m.visual_asset_id && !!m.sprite_path",
  "<MapSprite",
]) {
  if (!source.includes(required)) throw new Error(`required 8-direction runtime token missing: ${required}`);
}

fs.writeFileSync(path, source, "utf8");
console.log("Source-baked unified 8-direction world sprite renderer into MapPageClient.js");
