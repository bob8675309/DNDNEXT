import fs from "node:fs";
import path from "node:path";

const target = path.join(process.cwd(), "components", "MapPageClient.js");
let source = fs.readFileSync(target, "utf8");

function replaceBetween(startMarker, endMarker, replacement, label) {
  if (source.includes(replacement)) return;
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`${label}: start marker not found`);
  const end = source.indexOf(endMarker, start);
  if (end < 0) throw new Error(`${label}: end marker not found`);
  source = source.slice(0, start) + replacement + "\n" + source.slice(end + endMarker.length);
}
function requireToken(token, label) {
  if (!source.includes(token)) throw new Error(`${label}: missing ${token}`);
}

const replacement = `  /* Initial load */
  useEffect(() => {
    let active = true;
    const timers = [];

    const runWithTimeout = async (label, fn, ms = 9000) => {
      let timeoutId = null;
      const timeout = new Promise((resolve) => {
        timeoutId = setTimeout(() => resolve({ ok: false, label, timeout: true }), ms);
      });
      const task = Promise.resolve()
        .then(() => fn())
        .then(
          () => ({ ok: true, label }),
          (error) => ({ ok: false, label, error })
        );
      const result = await Promise.race([task, timeout]);
      if (timeoutId) clearTimeout(timeoutId);
      return result;
    };

    const deferLoad = (label, fn, delayMs = 0, timeoutMs = 9000) => {
      const timerId = setTimeout(() => {
        if (!active) return;
        runWithTimeout(label, fn, timeoutMs).then((result) => {
          if (!active || result?.ok) return;
          console.warn("Map deferred load completed with partial data", label);
        });
      }, delayMs);
      timers.push(timerId);
    };

    (async () => {
      const criticalResults = await Promise.all([
        runWithTimeout("admin", checkAdmin, 5000),
        runWithTimeout("locations", loadLocations, 7000),
      ]);
      if (!active) return;
      const failedCritical = criticalResults.filter((entry) => !entry?.ok);
      if (failedCritical.length) {
        console.warn(
          "Map critical load completed with partial data",
          failedCritical.map((entry) => entry.label)
        );
      }

      deferLoad("location icons", loadLocationIcons, 0, 9000);
      deferLoad("merchants", loadMerchants, 120, 9000);
      deferLoad("npc pins", loadNpcs, 240, 9000);
      deferLoad("routes", loadRoutes, 360, 9000);
      deferLoad("npc drawer", loadAllNpcs, 700, 12000);
    })().catch((error) => {
      if (!active) return;
      console.error("Map initial load failed", error);
      setErr(error?.message || "Map loaded partially. Refresh if data is missing.");
    });

    return () => {
      active = false;
      timers.forEach((timerId) => clearTimeout(timerId));
    };
  }, [checkAdmin, loadLocations, loadLocationIcons, loadMerchants, loadNpcs, loadAllNpcs, loadRoutes]);`;

replaceBetween(
  `  /* Initial load */\n  useEffect(() => {`,
  `  }, [checkAdmin, loadLocations, loadLocationIcons, loadMerchants, loadNpcs, loadAllNpcs, loadRoutes]);`,
  replacement,
  "Map nonblocking boot"
);

fs.writeFileSync(target, source, "utf8");

for (const token of [
  "const timers = [];",
  "const deferLoad = (label, fn, delayMs = 0, timeoutMs = 9000)",
  'runWithTimeout("locations", loadLocations, 7000)',
  'deferLoad("merchants", loadMerchants, 120, 9000)',
  'deferLoad("npc drawer", loadAllNpcs, 700, 12000)',
  "Map critical load completed with partial data",
]) requireToken(token, "Map nonblocking boot patch");

console.log("Patched map boot to defer secondary data loads.");
