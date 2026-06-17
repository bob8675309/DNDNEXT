import fs from "node:fs";
import path from "node:path";

const target = path.join(process.cwd(), "pages", "items.js");
let source = fs.readFileSync(target, "utf8");
const marker = 'const [crafterCharacterId, setCrafterCharacterId] = useState("");';
const declaration = '  const [targetCharacterId, setTargetCharacterId] = useState("");';

if (!source.includes(marker)) {
  const benchStart = source.indexOf("function CraftBenchTab(");
  if (benchStart < 0) throw new Error("CraftBenchTab was not found while disambiguating crafting target state.");
  const beforeBench = source.slice(0, benchStart);
  const benchSource = source.slice(benchStart);
  const canonicalCount = beforeBench.split(declaration).length - 1;
  const benchCount = benchSource.split(declaration).length - 1;
  if (canonicalCount !== 1 || benchCount !== 1) {
    throw new Error(`Expected one canonical and one legacy target state declaration; found ${canonicalCount} and ${benchCount}.`);
  }
  source = beforeBench + benchSource.replace(declaration, '  const [targetCharacterId, setTargetCharacterId] = useState("" /* legacy craft bench */);');
  fs.writeFileSync(target, source, "utf8");
  console.log("Disambiguated the legacy Craft Bench target state.");
} else {
  console.log("Canonical self-crafter state already present; target-state disambiguation skipped.");
}
