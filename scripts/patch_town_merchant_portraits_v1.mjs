import fs from "node:fs";
import path from "node:path";

function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source;
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(before, after);
}

const townPath = path.join(process.cwd(), "pages", "town", "[id].js");
let source = fs.readFileSync(townPath, "utf8");

source = replaceOnce(
  source,
  '    storefront_bg_video_url: row.storefront_bg_video_url || null,\n    tags: Array.isArray(row.tags) ? row.tags : [],',
  '    storefront_bg_video_url: row.storefront_bg_video_url || null,\n    portrait_url: row.portrait_url || null,\n    portrait_storage_path: row.portrait_storage_path || null,\n    portrait_thumb_url: row.portrait_thumb_url || null,\n    portrait_shop_url: row.portrait_shop_url || null,\n    image_url: row.image_url || null,\n    tags: Array.isArray(row.tags) ? row.tags : [],',
  "Town merchant portrait normalization"
);

source = replaceOnce(
  source,
  '          "storefront_bg_video_url",\n          "tags",',
  '          "storefront_bg_video_url",\n          "portrait_url",\n          "portrait_storage_path",\n          "portrait_thumb_url",\n          "portrait_shop_url",\n          "image_url",\n          "tags",',
  "Town merchant portrait select"
);

fs.writeFileSync(townPath, source, "utf8");

for (const token of ["portrait_shop_url", "portrait_url", "portrait_storage_path", "image_url"]) {
  if (!source.includes(token)) throw new Error(`Town merchant portrait patch validation failed: ${token}`);
}
console.log("Patched town merchant rows to carry portrait art into storefronts.");
