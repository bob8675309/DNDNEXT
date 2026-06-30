import fs from "node:fs";
import path from "node:path";

const rel = path.join("pages", "town", "[id].js");
const target = path.join(process.cwd(), rel);
let source = fs.readFileSync(target, "utf8");

function replaceRequired(before, after, label) {
  if (source.includes(after)) return;
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  source = source.replace(before, after);
}

function requireToken(token, label) {
  if (!source.includes(token)) throw new Error(`${label}: missing ${token}`);
}

function requireAbsent(token, label) {
  if (source.includes(token)) throw new Error(`${label}: forbidden ${token}`);
}

// Keep the town route from blocking on secondary/ancillary data. The location row is
// the only critical data needed to render the TownSheet shell; roster, merchants,
// player inventory/plants, quests, and labels can hydrate immediately afterward.
replaceRequired(
  `      if (!id) return;
      setLoading(true);`,
  `      if (!router.isReady) return;
      if (!id) {
        setLocation(null);
        setLoading(false);
        return;
      }
      setLoading(true);`,
  "Town route waits for router readiness and clears impossible loading state"
);

replaceRequired(
  `        setLocation(loc);

        const { data: rosterData } = await supabase`,
  `        setLocation(loc);
        setLoading(false);

        const { data: rosterData } = await supabase`,
  "Town route renders TownSheet immediately after critical town row loads"
);

replaceRequired(
  `          const plantRows = await loadPlayerPlantsForUser(user.id);`,
  `          const plantRows = await Promise.race([
            loadPlayerPlantsForUser(user.id),
            new Promise((resolve) => setTimeout(() => {
              console.warn("player plants load timed out; rendering town sheet without plant cache");
              resolve([]);
            }, 9000)),
          ]);`,
  "Town route player plants cache timeout"
);

replaceRequired(
  `  }, [id]);`,
  `  }, [router.isReady, id]);`,
  "Town route load effect depends on router readiness"
);

fs.writeFileSync(target, source, "utf8");

for (const token of [
  "if (!router.isReady) return;",
  "setLocation(loc);\n        setLoading(false);",
  "player plants load timed out; rendering town sheet without plant cache",
  "}, [router.isReady, id]);",
]) {
  requireToken(token, "Town route minimal loading guard");
}

for (const token of [
  "if (!id) return;\n      setLoading(true);",
  "setLocation(loc);\n\n        const { data: rosterData }",
  "const plantRows = await loadPlayerPlantsForUser(user.id);",
  "}, [id]);",
]) {
  requireAbsent(token, "Town route minimal loading guard");
}

console.log("Patched town route minimal loading guard.");
