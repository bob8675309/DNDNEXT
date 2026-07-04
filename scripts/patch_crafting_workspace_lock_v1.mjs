import fs from "node:fs";
import path from "node:path";

function countOf(source, token) {
  return source.split(token).length - 1;
}

function replaceOnce(source, before, after, label, { required = true } = {}) {
  if (source.includes(after)) return source;
  const count = countOf(source, before);
  if (count !== 1) {
    const message = `${label}: expected one match, found ${count}`;
    if (required) throw new Error(message);
    console.warn(message + "; leaving source unchanged.");
    return source;
  }
  return source.replace(before, after);
}

function insertAfterOnce(source, anchor, addition, label, { required = true } = {}) {
  if (source.includes(addition.trim())) return source;
  const count = countOf(source, anchor);
  if (count !== 1) {
    const message = `${label}: expected one match, found ${count}`;
    if (required) throw new Error(message);
    console.warn(message + "; leaving source unchanged.");
    return source;
  }
  return source.replace(anchor, anchor + addition);
}

function ensureWorkspaceProps(source) {
  if (source.includes("disciplineLock = null") && source.includes("showDisciplineSwitcher = true")) return source;

  if (source.includes('export default function CraftingWorkspace({ mode = "page", disciplineLock = null, crafterId = null, crafter = null, startView = "recipes", showDisciplineSwitcher = true } = {}) {')) {
    return source;
  }

  if (source.includes("export default function CraftingWorkspace() {")) {
    return replaceOnce(
      source,
      "export default function CraftingWorkspace() {",
      'export default function CraftingWorkspace({ mode = "page", disciplineLock = null, crafterId = null, crafter = null, startView = "recipes", showDisciplineSwitcher = true } = {}) {',
      "CraftingWorkspace props"
    );
  }

  if (source.includes("export default function CraftingPage() {")) {
    return replaceOnce(
      source,
      "export default function CraftingPage() {",
      'export default function CraftingPage({ mode = "page", disciplineLock = null, crafterId = null, crafter = null, startView = "recipes", showDisciplineSwitcher = true } = {}) {',
      "CraftingPage props"
    );
  }

  // Function already has destructured props but may be missing newer defaults.
  source = source.replace(
    /export default function CraftingWorkspace\(\{([^}]*)\}\s*=\s*\{\}\)\s*\{/,
    (match, inner) => {
      let props = inner;
      const requiredProps = [
        'mode = "page"',
        "disciplineLock = null",
        "crafterId = null",
        "crafter = null",
        'startView = "recipes"',
        "showDisciplineSwitcher = true",
      ];
      for (const prop of requiredProps) {
        const key = prop.split("=")[0].trim();
        if (!new RegExp(`(^|,)\\s*${key}\\b`).test(props)) props += `, ${prop}`;
      }
      return `export default function CraftingWorkspace({${props}} = {}) {`;
    }
  );
  return source;
}

const componentPath = path.join(process.cwd(), "components", "CraftingWorkspace.js");
const pagePath = path.join(process.cwd(), "pages", "items.js");
const componentSource = fs.existsSync(componentPath) ? fs.readFileSync(componentPath, "utf8") : "";
const componentIsFullWorkflow = componentSource.includes("const router = useRouter();") && componentSource.includes("RecipePreview");
const target = componentIsFullWorkflow ? componentPath : pagePath;
let source = fs.readFileSync(target, "utf8");

const helper = `function normalizeCraftingDisciplineLock(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return null;
  if (/alch|herb|potion|poison|elixir|oil/.test(raw)) return "Alchemy";
  if (/smith|forge|blacksmith|weapon|armor|armour|shield|temper/.test(raw)) return "Smithing";
  if (/enchant|imbue|arcane|rune/.test(raw)) return "Enchanting";
  if (/scribe|scroll|spell/.test(raw)) return "Scribe";
  return null;
}

`;

if (!source.includes("function normalizeCraftingDisciplineLock")) {
  if (source.includes('export default function CraftingWorkspace({ mode = "page", disciplineLock = null, crafterId = null, crafter = null, startView = "recipes", showDisciplineSwitcher = true } = {}) {')) {
    source = replaceOnce(
      source,
      'export default function CraftingWorkspace({ mode = "page", disciplineLock = null, crafterId = null, crafter = null, startView = "recipes", showDisciplineSwitcher = true } = {}) {',
      `${helper}export default function CraftingWorkspace({ mode = "page", disciplineLock = null, crafterId = null, crafter = null, startView = "recipes", showDisciplineSwitcher = true } = {}) {`,
      "CraftingWorkspace lock helper"
    );
  } else if (source.includes("export default function CraftingWorkspace() {")) {
    source = replaceOnce(
      source,
      "export default function CraftingWorkspace() {",
      `${helper}export default function CraftingWorkspace({ mode = "page", disciplineLock = null, crafterId = null, crafter = null, startView = "recipes", showDisciplineSwitcher = true } = {}) {`,
      "CraftingWorkspace props and lock helper"
    );
  } else if (source.includes("export default function CraftingPage() {")) {
    source = replaceOnce(
      source,
      "export default function CraftingPage() {",
      `${helper}export default function CraftingPage({ mode = "page", disciplineLock = null, crafterId = null, crafter = null, startView = "recipes", showDisciplineSwitcher = true } = {}) {`,
      "CraftingPage props and lock helper"
    );
  } else {
    source = ensureWorkspaceProps(source);
    const exportIndex = source.indexOf("export default function CraftingWorkspace");
    if (exportIndex >= 0) {
      source = source.slice(0, exportIndex) + helper + source.slice(exportIndex);
    } else {
      throw new Error("Crafting workspace helper insertion: could not find CraftingWorkspace/CraftingPage export.");
    }
  }
} else {
  source = ensureWorkspaceProps(source);
}

if (!source.includes("const lockedDiscipline = normalizeCraftingDisciplineLock(disciplineLock);")) {
  if (source.includes('  const router = useRouter();\n  const workshopQueryApplied = useRef("");')) {
    source = replaceOnce(
      source,
      '  const router = useRouter();\n  const workshopQueryApplied = useRef("");',
      '  const router = useRouter();\n  const lockedDiscipline = normalizeCraftingDisciplineLock(disciplineLock);\n  const isPanelMode = mode !== "page";\n  const workshopQueryApplied = useRef("");',
      "Crafting workspace lock constants"
    );
  } else {
    source = insertAfterOnce(
      source,
      "  const router = useRouter();\n",
      '  const lockedDiscipline = normalizeCraftingDisciplineLock(disciplineLock);\n  const isPanelMode = mode !== "page";\n',
      "Crafting workspace lock constants after router"
    );
  }
}

source = replaceOnce(
  source,
  '  const [discipline, setDiscipline] = useState("All");',
  '  const [discipline, setDiscipline] = useState(() => lockedDiscipline || "All");',
  "Crafting workspace locked initial discipline",
  { required: !source.includes('const [discipline, setDiscipline] = useState(() => lockedDiscipline || "All");') }
);

source = replaceOnce(
  source,
  '  useEffect(() => {\n    if (typeof window === "undefined") return;\n    const params = new URLSearchParams(window.location.search || "");\n    const forced = params.get("craftAdmin") === "1" || window.localStorage?.getItem("dndnextCraftAdmin") === "1";\n    setAdminResourceOverride(Boolean(forced));\n  }, []);',
  '  useEffect(() => {\n    if (typeof window === "undefined") return;\n    const params = new URLSearchParams(window.location.search || "");\n    const forced = params.get("craftAdmin") === "1" || window.localStorage?.getItem("dndnextCraftAdmin") === "1";\n    setAdminResourceOverride(Boolean(forced));\n  }, []);\n\n  useEffect(() => {\n    if (!lockedDiscipline) return;\n    setActiveTab(startView === "craft" ? "recipes" : "recipes");\n    setDiscipline(lockedDiscipline);\n    setKnowledge("All");\n    setRarityFilter("All");\n    setAlchemySection("All");\n    setAlchemyGroup("All");\n    setEnchantingSection("All");\n    setSmithingSection("All");\n    setCraftingRecipeId(null);\n  }, [lockedDiscipline, startView]);',
  "Crafting workspace locked discipline effect",
  { required: false }
);

source = replaceOnce(
  source,
  '    const requestedDiscipline = ["Smithing", "Enchanting", "Alchemy"].find((value) => value.toLowerCase() === requested.toLowerCase()) || "";',
  '    const requestedDiscipline = lockedDiscipline || ["Smithing", "Enchanting", "Alchemy"].find((value) => value.toLowerCase() === requested.toLowerCase()) || "";',
  "Crafting workspace locked query discipline",
  { required: false }
);

source = replaceOnce(
  source,
  '  }, [router.isReady, router.query.discipline, router.query.craft, router.query.crafter, recipes]);',
  '  }, [router.isReady, router.query.discipline, router.query.craft, router.query.crafter, recipes, lockedDiscipline]);',
  "Crafting workspace locked query dependencies",
  { required: false }
);

source = replaceOnce(
  source,
  '  const clear = () => { setQuery(""); setDiscipline("All"); setKnowledge("All"); setRarityFilter("All"); setAlchemySection("All"); setAlchemyGroup("All"); setEnchantingSection("All"); setSmithingSection("All"); };',
  '  const clear = () => { setQuery(""); setDiscipline(lockedDiscipline || "All"); setKnowledge("All"); setRarityFilter("All"); setAlchemySection("All"); setAlchemyGroup("All"); setEnchantingSection("All"); setSmithingSection("All"); };',
  "Crafting workspace locked clear",
  { required: false }
);

source = replaceOnce(
  source,
  '    if (p === "All") {\n      setDiscipline("All"); setKnowledge("All"); setRarityFilter("All"); setAlchemySection("All"); setAlchemyGroup("All"); setEnchantingSection("All"); setSmithingSection("All");\n    } else if (p === "Known") {',
  '    if (p === "All") {\n      setDiscipline(lockedDiscipline || "All"); setKnowledge("All"); setRarityFilter("All"); setAlchemySection("All"); setAlchemyGroup("All"); setEnchantingSection("All"); setSmithingSection("All");\n    } else if (p === "Known") {',
  "Crafting workspace locked quick all",
  { required: false }
);

source = replaceOnce(
  source,
  '    } else {\n      setDiscipline(p); setKnowledge("All"); setAlchemySection("All"); setAlchemyGroup("All"); setEnchantingSection("All"); setSmithingSection("All");\n    }',
  '    } else {\n      if (lockedDiscipline && p !== lockedDiscipline) return;\n      setDiscipline(p); setKnowledge("All"); setAlchemySection("All"); setAlchemyGroup("All"); setEnchantingSection("All"); setSmithingSection("All");\n    }',
  "Crafting workspace locked quick discipline",
  { required: false }
);

source = replaceOnce(
  source,
  '  function chooseSmithingSection(section) {\n    setDiscipline("Smithing");',
  '  function chooseSmithingSection(section) {\n    if (lockedDiscipline && lockedDiscipline !== "Smithing") return;\n    setDiscipline("Smithing");',
  "Crafting workspace locked smithing section",
  { required: false }
);

source = replaceOnce(
  source,
  '  function chooseEnchantingSection(section) {\n    setDiscipline("Enchanting");',
  '  function chooseEnchantingSection(section) {\n    if (lockedDiscipline && lockedDiscipline !== "Enchanting") return;\n    setDiscipline("Enchanting");',
  "Crafting workspace locked enchanting section",
  { required: false }
);

source = replaceOnce(
  source,
  '  function chooseAlchemySection(section) {\n    setDiscipline("Alchemy");',
  '  function chooseAlchemySection(section) {\n    if (lockedDiscipline && lockedDiscipline !== "Alchemy") return;\n    setDiscipline("Alchemy");',
  "Crafting workspace locked alchemy section",
  { required: false }
);

source = replaceOnce(
  source,
  '<select className="form-select craft-input" value={discipline} onChange={(e) => { const next = e.target.value; setDiscipline(next);',
  '<select className="form-select craft-input" disabled={!!lockedDiscipline || showDisciplineSwitcher === false} value={discipline} onChange={(e) => { if (lockedDiscipline) return; const next = e.target.value; setDiscipline(next);',
  "Crafting workspace locked discipline select",
  { required: false }
);

source = replaceOnce(
  source,
  '>{disciplineOptions.map((v) => <option key={v} value={v}>{v}</option>)}</select>',
  '>{(lockedDiscipline ? [lockedDiscipline] : disciplineOptions).map((v) => <option key={v} value={v}>{v}</option>)}</select>',
  "Crafting workspace locked discipline options",
  { required: false }
);

source = replaceOnce(
  source,
  '<div className="craft-pills">{["All", "Smithing", "Enchanting", "Alchemy", "Known"].map((p) => <button key={p} type="button" className={cls("craft-pill", ((p === "All" && discipline === "All" && knowledge === "All") || discipline === p || knowledge === p) && "craft-pill-active")} onClick={() => quick(p)}>{p}</button>)}</div>',
  '<div className="craft-pills">{(lockedDiscipline ? [lockedDiscipline, "Known"] : ["All", "Smithing", "Enchanting", "Alchemy", "Known"]).map((p) => <button key={p} type="button" className={cls("craft-pill", ((p === "All" && discipline === "All" && knowledge === "All") || discipline === p || knowledge === p) && "craft-pill-active")} onClick={() => quick(p)}>{p}</button>)}</div>',
  "Crafting workspace locked discipline pills",
  { required: false }
);

fs.writeFileSync(target, source, "utf8");

for (const token of [
  "function normalizeCraftingDisciplineLock",
  "disciplineLock = null",
  "showDisciplineSwitcher = true",
  "const lockedDiscipline = normalizeCraftingDisciplineLock(disciplineLock);",
]) {
  if (!source.includes(token)) throw new Error(`Crafting workspace lock patch validation failed: ${token}`);
}

console.log(`Patched crafting workspace discipline lock support in ${path.relative(process.cwd(), target)}.`);
