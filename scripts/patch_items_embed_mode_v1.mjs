import fs from "node:fs";
import path from "node:path";

function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source;
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(before, after);
}

const itemsPath = path.join(process.cwd(), "pages", "items.js");
let items = fs.readFileSync(itemsPath, "utf8");

items = replaceOnce(
  items,
  '  const router = useRouter();\n  const workshopQueryApplied = useRef("");',
  '  const router = useRouter();\n  const isTownWorkshopEmbed = String(router.query.embed || "") === "1" || String(router.query.townWorkshop || "") === "1";\n  const workshopQueryApplied = useRef("");',
  "Items embed query flag"
);

items = replaceOnce(
  items,
  '  useEffect(() => {\n    if (typeof window === "undefined") return;\n    const params = new URLSearchParams(window.location.search || "");\n    const forced = params.get("craftAdmin") === "1" || window.localStorage?.getItem("dndnextCraftAdmin") === "1";\n    setAdminResourceOverride(Boolean(forced));\n  }, []);',
  '  useEffect(() => {\n    if (typeof window === "undefined") return;\n    const params = new URLSearchParams(window.location.search || "");\n    const forced = params.get("craftAdmin") === "1" || window.localStorage?.getItem("dndnextCraftAdmin") === "1";\n    setAdminResourceOverride(Boolean(forced));\n  }, []);\n\n  useEffect(() => {\n    if (typeof document === "undefined" || !router.isReady) return undefined;\n    if (!isTownWorkshopEmbed) return undefined;\n    document.body.classList.add("craft-town-embed-mode");\n    return () => document.body.classList.remove("craft-town-embed-mode");\n  }, [router.isReady, isTownWorkshopEmbed]);',
  "Items embed body class"
);

items = replaceOnce(
  items,
  '      if (firstRecipe) {\n        setSelected(firstRecipe);\n        setCraftingRecipeId(shouldCraft ? firstRecipe.id : null);\n      }',
  '      if (firstRecipe) {\n        setSelected(firstRecipe);\n        setCraftingRecipeId(shouldCraft && !isTownWorkshopEmbed ? firstRecipe.id : null);\n      }',
  "Items town embed starts at recipe list"
);

items = replaceOnce(
  items,
  '  }, [router.isReady, router.query.discipline, router.query.craft, router.query.crafter, recipes]);',
  '  }, [router.isReady, router.query.discipline, router.query.craft, router.query.crafter, router.query.embed, router.query.townWorkshop, recipes, isTownWorkshopEmbed]);',
  "Items embed query dependency"
);

fs.writeFileSync(itemsPath, items, "utf8");

const cssPath = path.join(process.cwd(), "styles", "globals.scss");
let css = fs.readFileSync(cssPath, "utf8");
const marker = "/* ===== Craft town embed mode v1 ===== */";
if (!css.includes(marker)) {
  css += `\n\n${marker}\nbody.craft-town-embed-mode {\n  background: #120a1f !important;\n  overflow: hidden;\n}\nbody.craft-town-embed-mode nav.navbar,\nbody.craft-town-embed-mode .navbar,\nbody.craft-town-embed-mode .admin-build-badge {\n  display: none !important;\n}\nbody.craft-town-embed-mode .craft-page {\n  min-height: 100vh;\n  padding: 0 !important;\n  background: transparent !important;\n}\nbody.craft-town-embed-mode .craft-page > .container,\nbody.craft-town-embed-mode .craft-page > .container-fluid {\n  width: 100% !important;\n  max-width: none !important;\n  margin: 0 !important;\n  padding: 1rem 1.1rem 1.25rem !important;\n}\nbody.craft-town-embed-mode .craft-hero {\n  margin-top: 0 !important;\n}\nbody.craft-town-embed-mode .craft-tabbar {\n  position: sticky;\n  top: 0;\n  z-index: 5;\n  backdrop-filter: blur(10px);\n}\nbody.craft-town-embed-mode .craft-page h1 {\n  font-size: 1.55rem;\n}\n`;
  fs.writeFileSync(cssPath, css, "utf8");
}

for (const token of ["isTownWorkshopEmbed", "craft-town-embed-mode", "!isTownWorkshopEmbed"]) {
  if (!items.includes(token)) throw new Error(`Items embed patch validation failed: ${token}`);
}
console.log("Patched /items embed mode for town crafter workshops.");
