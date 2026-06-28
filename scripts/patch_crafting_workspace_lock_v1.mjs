import fs from "node:fs";
import path from "node:path";

function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source;
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(before, after);
}

const target = path.join(process.cwd(), "pages", "items.js");
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
  source = replaceOnce(
    source,
    "export default function CraftingPage() {",
    `${helper}export default function CraftingPage({ mode = "page", disciplineLock = null, crafterId = null, crafter = null, startView = "recipes", showDisciplineSwitcher = true } = {}) {`,
    "CraftingPage props and lock helper"
  );
} else {
  source = replaceOnce(
    source,
    "export default function CraftingPage() {",
    'export default function CraftingPage({ mode = "page", disciplineLock = null, crafterId = null, crafter = null, startView = "recipes", showDisciplineSwitcher = true } = {}) {',
    "CraftingPage props"
  );
}

source = replaceOnce(
  source,
  '  const router = useRouter();\n  const workshopQueryApplied = useRef("");',
  '  const router = useRouter();\n  const lockedDiscipline = normalizeCraftingDisciplineLock(disciplineLock);\n  const isPanelMode = mode !== "page";\n  const workshopQueryApplied = useRef("");',
  "CraftingPage lock constants"
);

source = replaceOnce(
  source,
  '  const [discipline, setDiscipline] = useState("All");',
  '  const [discipline, setDiscipline] = useState(() => lockedDiscipline || "All");',
  "CraftingPage locked initial discipline"
);

source = replaceOnce(
  source,
  '  useEffect(() => {\n    if (typeof window === "undefined") return;\n    const params = new URLSearchParams(window.location.search || "");\n    const forced = params.get("craftAdmin") === "1" || window.localStorage?.getItem("dndnextCraftAdmin") === "1";\n    setAdminResourceOverride(Boolean(forced));\n  }, []);',
  '  useEffect(() => {\n    if (typeof window === "undefined") return;\n    const params = new URLSearchParams(window.location.search || "");\n    const forced = params.get("craftAdmin") === "1" || window.localStorage?.getItem("dndnextCraftAdmin") === "1";\n    setAdminResourceOverride(Boolean(forced));\n  }, []);\n\n  useEffect(() => {\n    if (!lockedDiscipline) return;\n    setActiveTab(startView === "craft" ? "recipes" : "recipes");\n    setDiscipline(lockedDiscipline);\n    setKnowledge("All");\n    setRarityFilter("All");\n    setAlchemySection("All");\n    setAlchemyGroup("All");\n    setEnchantingSection("All");\n    setSmithingSection("All");\n    setCraftingRecipeId(null);\n  }, [lockedDiscipline, startView]);',
  "CraftingPage locked discipline effect"
);

source = replaceOnce(
  source,
  '    const requestedDiscipline = ["Smithing", "Enchanting", "Alchemy"].find((value) => value.toLowerCase() === requested.toLowerCase()) || "";',
  '    const requestedDiscipline = lockedDiscipline || ["Smithing", "Enchanting", "Alchemy"].find((value) => value.toLowerCase() === requested.toLowerCase()) || "";',
  "CraftingPage locked query discipline"
);

source = replaceOnce(
  source,
  '  }, [router.isReady, router.query.discipline, router.query.craft, router.query.crafter, recipes]);',
  '  }, [router.isReady, router.query.discipline, router.query.craft, router.query.crafter, recipes, lockedDiscipline]);',
  "CraftingPage locked query dependencies"
);

source = replaceOnce(
  source,
  '  const clear = () => { setQuery(""); setDiscipline("All"); setKnowledge("All"); setRarityFilter("All"); setAlchemySection("All"); setAlchemyGroup("All"); setEnchantingSection("All"); setSmithingSection("All"); };',
  '  const clear = () => { setQuery(""); setDiscipline(lockedDiscipline || "All"); setKnowledge("All"); setRarityFilter("All"); setAlchemySection("All"); setAlchemyGroup("All"); setEnchantingSection("All"); setSmithingSection("All"); };',
  "CraftingPage locked clear"
);

source = replaceOnce(
  source,
  '    if (p === "All") {\n      setDiscipline("All"); setKnowledge("All"); setRarityFilter("All"); setAlchemySection("All"); setAlchemyGroup("All"); setEnchantingSection("All"); setSmithingSection("All");\n    } else if (p === "Known") {',
  '    if (p === "All") {\n      setDiscipline(lockedDiscipline || "All"); setKnowledge("All"); setRarityFilter("All"); setAlchemySection("All"); setAlchemyGroup("All"); setEnchantingSection("All"); setSmithingSection("All");\n    } else if (p === "Known") {',
  "CraftingPage locked quick all"
);

source = replaceOnce(
  source,
  '    } else {\n      setDiscipline(p); setKnowledge("All"); setAlchemySection("All"); setAlchemyGroup("All"); setEnchantingSection("All"); setSmithingSection("All");\n    }',
  '    } else {\n      if (lockedDiscipline && p !== lockedDiscipline) return;\n      setDiscipline(p); setKnowledge("All"); setAlchemySection("All"); setAlchemyGroup("All"); setEnchantingSection("All"); setSmithingSection("All");\n    }',
  "CraftingPage locked quick discipline"
);

source = replaceOnce(
  source,
  '  function chooseSmithingSection(section) {\n    setDiscipline("Smithing");',
  '  function chooseSmithingSection(section) {\n    if (lockedDiscipline && lockedDiscipline !== "Smithing") return;\n    setDiscipline("Smithing");',
  "CraftingPage locked smithing section"
);

source = replaceOnce(
  source,
  '  function chooseEnchantingSection(section) {\n    setDiscipline("Enchanting");',
  '  function chooseEnchantingSection(section) {\n    if (lockedDiscipline && lockedDiscipline !== "Enchanting") return;\n    setDiscipline("Enchanting");',
  "CraftingPage locked enchanting section"
);

source = replaceOnce(
  source,
  '  function chooseAlchemySection(section) {\n    setDiscipline("Alchemy");',
  '  function chooseAlchemySection(section) {\n    if (lockedDiscipline && lockedDiscipline !== "Alchemy") return;\n    setDiscipline("Alchemy");',
  "CraftingPage locked alchemy section"
);

source = replaceOnce(
  source,
  '<select className="form-select craft-input" value={discipline} onChange={(e) => { const next = e.target.value; setDiscipline(next);',
  '<select className="form-select craft-input" disabled={!!lockedDiscipline || showDisciplineSwitcher === false} value={discipline} onChange={(e) => { if (lockedDiscipline) return; const next = e.target.value; setDiscipline(next);',
  "CraftingPage locked discipline select"
);

source = replaceOnce(
  source,
  '>{disciplineOptions.map((v) => <option key={v} value={v}>{v}</option>)}</select>',
  '>{(lockedDiscipline ? [lockedDiscipline] : disciplineOptions).map((v) => <option key={v} value={v}>{v}</option>)}</select>',
  "CraftingPage locked discipline options"
);

source = replaceOnce(
  source,
  '<div className="craft-pills">{["All", "Smithing", "Enchanting", "Alchemy", "Known"].map((p) => <button key={p} type="button" className={cls("craft-pill", ((p === "All" && discipline === "All" && knowledge === "All") || discipline === p || knowledge === p) && "craft-pill-active")} onClick={() => quick(p)}>{p}</button>)}</div>',
  '<div className="craft-pills">{(lockedDiscipline ? [lockedDiscipline, "Known"] : ["All", "Smithing", "Enchanting", "Alchemy", "Known"]).map((p) => <button key={p} type="button" className={cls("craft-pill", ((p === "All" && discipline === "All" && knowledge === "All") || discipline === p || knowledge === p) && "craft-pill-active")} onClick={() => quick(p)}>{p}</button>)}</div>',
  "CraftingPage locked discipline pills"
);

fs.writeFileSync(target, source, "utf8");

const required = [
  "function normalizeCraftingDisciplineLock",
  "disciplineLock = null",
  "lockedDiscipline || \"All\"",
  "disabled={!!lockedDiscipline",
  "lockedDiscipline ? [lockedDiscipline] : disciplineOptions",
  "lockedDiscipline ? [lockedDiscipline, \"Known\"]",
];
for (const token of required) {
  if (!source.includes(token)) throw new Error(`Crafting workspace lock patch validation failed: ${token}`);
}
console.log("Patched crafting workspace discipline lock support.");
