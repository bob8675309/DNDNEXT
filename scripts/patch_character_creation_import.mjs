import fs from "node:fs";
import path from "node:path";

const target = path.join(process.cwd(), "utils", "characterCreation.js");
let source = fs.readFileSync(target, "utf8");
const before = 'from "./craftingProfessions";';
const after = 'from "./craftingProfessions.js";';

if (source.includes(before)) {
  source = source.replace(before, after);
  fs.writeFileSync(target, source, "utf8");
  console.log("Normalized the character creation model import for direct Node execution.");
} else if (source.includes(after)) {
  console.log("Character creation model import is already normalized.");
} else {
  throw new Error("Character creation model profession import was not found.");
}
