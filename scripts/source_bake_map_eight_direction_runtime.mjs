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
  'import { useInterpolatedPoses } from "../hooks/useInterpolatedPoses";\nimport MapSprite from "./MapSprite";\nimport { spriteDirectionFromVelocity } from "../utils/spriteAnimation";\n'
);

replaceOnce(
  "legacy sprite constants",
  /\/\/ NPC sprite sheet defaults \(map-icons\/npc-icons\)[\s\S]*?function spriteDirFromVelocity\(vx, vy, fallback = "down"\) \{[\s\S]*?\n\}\n\n/,
  `// Sprite rendering is visual-only. Route/pathing/world-time authority remains in the existing movement system.\n// Rich visual_asset_id rows use the production 8-direction contract; unlinked legacy sprite_path rows stay\n// on the old 4-direction contract only until approved replacements are assigned.\nconst LEGACY_MAP_SPRITE_ASSET = Object.freeze({\n  sprite_format: "legacy_4dir_3frame_32",\n  frame_width: 32,\n  frame_height: 32,\n  direction_order: ["down", "left", "right", "up"],\n  idle_frame: 0,\n  walk_frames: [0, 1, 2],\n  fps: 7,\n  overworld_scale: 0.7,\n});\n\nconst RICH_MAP_SPRITE_ASSET = Object.freeze({\n  sprite_format: "eight_direction_idle_walk_v1",\n  frame_width: 64,\n  frame_height: 64,\n  direction_order: ["down", "down-left", "left", "up-left", "up", "up-right", "right", "down-right"],\n  idle_frame: 0,\n  walk_frames: [1, 2, 3],\n  fps: 7,\n  overworld_scale: 0.35,\n});\n\nfunction spriteRuntimeFor(character) {\n  return character?.visual_asset_id ? RICH_MAP_SPRITE_ASSET : LEGACY_MAP_SPRITE_ASSET;\n}\n\nfunction legacySpriteDirFromVelocity(vx, vy, fallback = "down") {\n  const dx = Number(vx || 0);\n  const dy = Number(vy || 0);\n  const dead = 0.00005;\n  if (Math.abs(dx) < dead && Math.abs(dy) < dead) return fallback;\n  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";\n  return dy > 0 ? "down" : "up";\n}\n\nfunction spriteDirForVelocity(character, vx, vy, fallback = "down") {\n  return character?.visual_asset_id\n    ? spriteDirectionFromVelocity(vx, vy, fallback)\n    : legacySpriteDirFromVelocity(vx, vy, fallback);\n}\n\n`
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
  `      const runtime = spriteRuntimeFor(n);\n      const sc = Number.isFinite(Number(n.sprite_scale)) ? Number(n.sprite_scale) : runtime.overworld_scale;\n      const halfW = (runtime.frame_width * sc) / 2;\n      const halfH = (runtime.frame_height * sc) / 2;`
);

replaceOnce(
  "merchant sprite runtime calculation",
  /              const st = String\(m\.state \|\| ""\)\.toLowerCase\(\);\n              const rv = renderPositionsRef\.current\?\.\[`merchant:\$\{m\.id\}`\];\n              const isMoving = !!rv\?\.moving && \(st === "moving" \|\| st === "excursion"\);\n              const fallbackDir = \(rv\?\.dirHint && SPRITE_DIR_ORDER\.includes\(rv\.dirHint\) && rv\.dirHint\) \|\| "down";\n              const dir = isMoving \? spriteDirFromVelocity\(rv\?\.vx \?\? 0, rv\?\.vy \?\? 0, fallbackDir\) : fallbackDir;\n              const row = Math\.max\(0, SPRITE_DIR_ORDER\.indexOf\(dir\)\);\n              const nowMs = typeof performance !== "undefined" \? performance\.now\(\) : Date\.now\(\);\n              const frame = isMoving \? Math\.floor\(nowMs \/ 140\) % SPRITE_FRAMES_PER_DIR : 0;\n              const scale = typeof m\.sprite_scale === "number" \? m\.sprite_scale : 0\.7;/,
  `              const st = String(m.state || "").toLowerCase();\n              const rv = renderPositionsRef.current?.[\`merchant:\${m.id}\`];\n              const isMoving = !!rv?.moving && (st === "moving" || st === "excursion");\n              const runtime = spriteRuntimeFor(m);\n              const fallbackDir = (rv?.dirHint && runtime.direction_order.includes(rv.dirHint) && rv.dirHint) || "down";\n              const dir = isMoving ? spriteDirForVelocity(m, rv?.vx ?? 0, rv?.vy ?? 0, fallbackDir) : fallbackDir;\n              const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();\n              const scale = typeof m.sprite_scale === "number" ? m.sprite_scale : runtime.overworld_scale;`
);

replaceOnce(
  "merchant sprite renderer",
  /                  \{hasSprite \? \(\n                    <span\n                      className="merchant-sprite"[\s\S]*?                      aria-hidden="true"\n                    \/>\n                  \) : \(/,
  `                  {hasSprite ? (\n                    <MapSprite\n                      spriteUrl={spriteUrl}\n                      asset={runtime}\n                      direction={dir}\n                      moving={isMoving}\n                      scale={scale}\n                      className="merchant-sprite"\n                      clockMs={nowMs}\n                    />\n                  ) : (`
);

replaceOnce(
  "npc sprite runtime calculation",
  /              const st = String\(n\.state \|\| ""\)\.toLowerCase\(\);\n              const rv = renderPositionsRef\.current\?\.\[`npc:\$\{n\.id\}`\];\n              const isMoving = !!rv\?\.moving && \(st === "moving" \|\| st === "excursion"\);\n              const fallbackDir = \(n\.sprite_dir && SPRITE_DIR_ORDER\.includes\(n\.sprite_dir\) && n\.sprite_dir\) \|\| "down";\n              const dir = isMoving \? spriteDirFromVelocity\(rv\?\.vx \?\? 0, rv\?\.vy \?\? 0, fallbackDir\) : fallbackDir;\n\n              const row = Math\.max\(0, SPRITE_DIR_ORDER\.indexOf\(dir\)\);\n              const nowMs = typeof performance !== "undefined" \? performance\.now\(\) : Date\.now\(\);\n              const frame = isMoving \? \(Math\.floor\(nowMs \/ 140\) % SPRITE_FRAMES_PER_DIR\) : 0;\n              const scale = typeof n\.sprite_scale === "number" \? n\.sprite_scale : 0\.7;\n              const spriteStyle = hasSprite[\s\S]*?              const spriteScale = typeof n\.sprite_scale === "number" \? n\.sprite_scale : 0\.7;/,
  `              const st = String(n.state || "").toLowerCase();\n              const rv = renderPositionsRef.current?.[\`npc:\${n.id}\`];\n              const isMoving = !!rv?.moving && (st === "moving" || st === "excursion");\n              const runtime = spriteRuntimeFor(n);\n              const fallbackDir = (n.sprite_dir && runtime.direction_order.includes(n.sprite_dir) && n.sprite_dir) || "down";\n              const dir = isMoving ? spriteDirForVelocity(n, rv?.vx ?? 0, rv?.vy ?? 0, fallbackDir) : fallbackDir;\n              const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();\n              const scale = typeof n.sprite_scale === "number" ? n.sprite_scale : runtime.overworld_scale;`
);

replaceOnce(
  "npc sprite renderer",
  /                    \{hasSprite \? \(\n                      <span\n                        className="npc-sprite"[\s\S]*?                      \/>\n                    \) : disp\?\.emoji \? \(/,
  `                    {hasSprite ? (\n                      <MapSprite\n                        spriteUrl={spriteUrl}\n                        asset={runtime}\n                        direction={dir}\n                        moving={isMoving}\n                        scale={scale}\n                        className="npc-sprite"\n                        clockMs={nowMs}\n                      />\n                    ) : disp?.emoji ? (`
);

for (const forbidden of [
  "SPRITE_FRAME_W",
  "SPRITE_FRAME_H",
  "SPRITE_FRAMES_PER_DIR",
  "SPRITE_DIR_ORDER",
  "spriteDirFromVelocity(",
  "const spriteStyle = hasSprite",
  "const spriteScale =",
]) {
  if (source.includes(forbidden)) throw new Error(`legacy inline renderer token survived: ${forbidden}`);
}

for (const required of [
  'import MapSprite from "./MapSprite";',
  'import { spriteDirectionFromVelocity } from "../utils/spriteAnimation";',
  "RICH_MAP_SPRITE_ASSET",
  "LEGACY_MAP_SPRITE_ASSET",
  "visual_asset_id",
  "spriteRuntimeFor(n)",
  "spriteRuntimeFor(m)",
  "<MapSprite",
]) {
  if (!source.includes(required)) throw new Error(`required runtime token missing: ${required}`);
}

fs.writeFileSync(path, source, "utf8");
console.log("Source-baked dual-runtime map sprites: rich 8-direction + temporary legacy 4-direction compatibility");
