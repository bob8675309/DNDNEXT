import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.join(process.cwd(), "pages", "town", "[id].js"), "utf8");

function requireToken(token) {
  if (!source.includes(token)) throw new Error(`Town merchant portrait fields: missing ${token}`);
}

for (const token of [
  'portrait_url: row.portrait_url || null,',
  'portrait_storage_path: row.portrait_storage_path || null,',
  'portrait_thumb_url: row.portrait_thumb_url || null,',
  'portrait_shop_url: row.portrait_shop_url || null,',
  'image_url: row.image_url || null,',
  '"portrait_url",',
  '"portrait_storage_path",',
  '"portrait_thumb_url",',
  '"portrait_shop_url",',
  '"image_url",',
]) requireToken(token);

console.log("Town merchant portrait field flow validated.");
