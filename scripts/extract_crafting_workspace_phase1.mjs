import fs from "node:fs";
import path from "node:path";

const pagePath = path.join("pages", "items.js");
const componentPath = path.join("components", "CraftingWorkspace.js");
const patchPath = path.join("scripts", "patch_enchanting_bounds_v1.mjs");

const wrapper = `// pages/items.js
import CraftingWorkspace from "../components/CraftingWorkspace";

export default function CraftingPage() {
  return <CraftingWorkspace mode="page" />;
}
`;

let page = fs.readFileSync(pagePath, "utf8");

if (!fs.existsSync(componentPath)) {
  if (!page.includes("export default function CraftingPage()")) {
    throw new Error("Expected full pages/items.js before extraction.");
  }
  const component = page
    .replace("// pages/items.js", "// components/CraftingWorkspace.js")
    .replace("export default function CraftingPage() {", "export default function CraftingWorkspace({ mode = \"page\" } = {}) {");

  if (!component.includes("export default function CraftingWorkspace")) throw new Error("Component export rewrite failed.");
  if (!component.includes("const router = useRouter();")) throw new Error("Router hook missing after extraction.");
  fs.writeFileSync(componentPath, component, "utf8");
}

fs.writeFileSync(pagePath, wrapper, "utf8");

let patch = fs.readFileSync(patchPath, "utf8");
const oldTarget = 'const target = path.join(process.cwd(), "pages", "items.js");';
const newTarget = 'const target = fs.existsSync(path.join(process.cwd(), "components", "CraftingWorkspace.js"))\n  ? path.join(process.cwd(), "components", "CraftingWorkspace.js")\n  : path.join(process.cwd(), "pages", "items.js");';
if (patch.includes(oldTarget)) {
  patch = patch.replace(oldTarget, newTarget);
  fs.writeFileSync(patchPath, patch, "utf8");
} else if (!patch.includes('components", "CraftingWorkspace.js')) {
  throw new Error("Could not update enchanting bounds target safely.");
}

console.log("Extracted CraftingWorkspace phase 1.");
