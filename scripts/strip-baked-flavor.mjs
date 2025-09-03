// scripts/strip-baked-flavor.mjs
import fs from "node:fs/promises";

const SRC = "public/items/all-items.json";
const OUT = "public/items/all-items.no-baked-flavor.json";

const raw = await fs.readFile(SRC, "utf8");
const arr = JSON.parse(raw);

for (const it of arr) {
  delete it.flavor;
  delete it._flavor;
}

await fs.writeFile(OUT, JSON.stringify(arr, null, 2), "utf8");
console.log(`[strip-baked-flavor] Wrote ${OUT} (${arr.length} items)`);

// When you’re ready, you can replace all-items.json with the new file.
