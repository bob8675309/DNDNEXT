import fs from "node:fs";
import path from "node:path";

function read(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

function write(rel, source) {
  fs.writeFileSync(path.join(process.cwd(), rel), source, "utf8");
}

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(before, after);
}

function requireToken(source, token, label) {
  if (!source.includes(token)) throw new Error(`${label}: missing ${token}`);
}

function requireAbsent(source, token, label) {
  if (source.includes(token)) throw new Error(`${label}: forbidden ${token}`);
}

let changedAny = false;

// -----------------------------------------------------------------------------
// NPC page: never hold the whole page on "Loading NPCs..." because one ancillary
// request is slow or hangs. Load data in parallel with route-level timeouts and
// allow late results to hydrate the already-visible UI.
// -----------------------------------------------------------------------------
{
  const rel = "pages/npcs.js";
  let source = read(rel);
  const before = source;

  source = replaceRequired(
    source,
    `  /* ------------------- initial load ------------------- */\n  useEffect(() => {\n    (async () => {\n      setLoading(true);\n      setErr("");\n      await loadAuth();\n      await Promise.all([loadPlayers(), loadLocations(), loadMapIcons(), loadNpcs(), loadMerchants(), loadMerchantProfiles()]);\n      setLoading(false);\n    })();\n  }, [loadAuth, loadPlayers, loadLocations, loadNpcs, loadMerchants, loadMerchantProfiles]);`,
    `  /* ------------------- initial load ------------------- */\n  useEffect(() => {\n    let active = true;\n\n    const runWithTimeout = async (label, fn, ms = 9000) => {\n      let timeoutId = null;\n      const timeout = new Promise((resolve) => {\n        timeoutId = setTimeout(() => resolve({ ok: false, label, timeout: true }), ms);\n      });\n      const task = Promise.resolve()\n        .then(() => fn())\n        .then(\n          () => ({ ok: true, label }),\n          (error) => ({ ok: false, label, error })\n        );\n      const result = await Promise.race([task, timeout]);\n      if (timeoutId) clearTimeout(timeoutId);\n      return result;\n    };\n\n    (async () => {\n      setLoading(true);\n      setErr("");\n      const results = await Promise.all([\n        runWithTimeout("auth", loadAuth, 6000),\n        runWithTimeout("players", loadPlayers),\n        runWithTimeout("locations", loadLocations),\n        runWithTimeout("map icons", loadMapIcons),\n        runWithTimeout("npcs", loadNpcs),\n        runWithTimeout("merchants", loadMerchants),\n        runWithTimeout("merchant profiles", loadMerchantProfiles),\n      ]);\n      if (!active) return;\n      const failed = results.filter((entry) => !entry?.ok);\n      if (failed.length) {\n        console.warn(\n          "NPC page initial load completed with partial data",\n          failed.map((entry) => entry.label)\n        );\n      }\n      setLoading(false);\n    })().catch((error) => {\n      if (!active) return;\n      console.error("NPC page initial load failed", error);\n      setErr(error?.message || "NPC page loaded partially. Refresh if data is missing.");\n      setLoading(false);\n    });\n\n    return () => {\n      active = false;\n    };\n  }, [loadAuth, loadPlayers, loadLocations, loadMapIcons, loadNpcs, loadMerchants, loadMerchantProfiles]);`,
    "NPC page initial load timeout guard"
  );

  if (source !== before) {
    write(rel, source);
    changedAny = true;
    console.log("Patched NPC page initial loading guard.");
  }
}

// -----------------------------------------------------------------------------
// NpcPanel: if the full row fetch is slow, continue using the supplied row data
// instead of leaving the About card stuck on Loading.
// -----------------------------------------------------------------------------
{
  const rel = "components/NpcPanel.js";
  let source = read(rel);
  const before = source;

  source = replaceRequired(
    source,
    `  useEffect(() => {\n    let cancelled = false;\n    const run = async () => {\n      if (!npcId) return;\n      setLoading(true);\n      setErr("");\n\n      const { data, error } = await supabase\n        .from("characters")\n        .select(\n          [\n            "id",\n            "name",\n            "kind",\n            "race",\n            "role",\n            "description",\n            "affiliation",\n            "status",\n            "background",\n            "motivation",\n            "quirk",\n            "mannerism",\n            "voice",\n            "secret",\n            "tags",\n            "x",\n            "y",\n            "location_id",\n            "last_known_location_id",\n            "projected_destination_id",\n            "is_hidden",\n            "map_icon_id",\n            "portrait_url",\n            "portrait_storage_path",\n            "portrait_thumb_url",\n            "portrait_shop_url",\n            "portrait_source",\n            "image_url",\n          ].join(",")\n        )\n        .eq("id", npcId)\n        .single();\n\n      if (cancelled) return;\n      if (error) {\n        setErr(error.message || "Failed to load NPC");\n        setFullNpc(null);\n      } else {\n        setFullNpc(data || null);\n      }\n      setLoading(false);\n    };\n    run();\n    return () => {\n      cancelled = true;\n    };\n  }, [npcId]);`,
    `  useEffect(() => {\n    let cancelled = false;\n    let finished = false;\n    let timeoutId = null;\n\n    const run = async () => {\n      if (!npcId) {\n        setLoading(false);\n        setErr("");\n        setFullNpc(null);\n        return;\n      }\n\n      setLoading(true);\n      setErr("");\n      timeoutId = setTimeout(() => {\n        if (cancelled || finished) return;\n        console.warn("NPC profile detail load timed out; using supplied panel row fallback", npcId);\n        setLoading(false);\n      }, 7000);\n\n      try {\n        const { data, error } = await supabase\n          .from("characters")\n          .select(\n            [\n              "id",\n              "name",\n              "kind",\n              "race",\n              "role",\n              "description",\n              "affiliation",\n              "status",\n              "background",\n              "motivation",\n              "quirk",\n              "mannerism",\n              "voice",\n              "secret",\n              "tags",\n              "x",\n              "y",\n              "location_id",\n              "last_known_location_id",\n              "projected_destination_id",\n              "is_hidden",\n              "map_icon_id",\n              "portrait_url",\n              "portrait_storage_path",\n              "portrait_thumb_url",\n              "portrait_shop_url",\n              "portrait_source",\n              "image_url",\n            ].join(",")\n          )\n          .eq("id", npcId)\n          .single();\n\n        if (cancelled) return;\n        if (error) {\n          setErr(error.message || "Failed to load NPC");\n          setFullNpc(null);\n        } else {\n          setFullNpc(data || null);\n        }\n      } catch (error) {\n        if (!cancelled) {\n          console.error("NPC profile detail load failed", error);\n          setErr(error?.message || "Failed to load NPC");\n          setFullNpc(null);\n        }\n      } finally {\n        finished = true;\n        if (timeoutId) clearTimeout(timeoutId);\n        if (!cancelled) setLoading(false);\n      }\n    };\n\n    run();\n    return () => {\n      cancelled = true;\n      if (timeoutId) clearTimeout(timeoutId);\n    };\n  }, [npcId]);`,
    "NpcPanel full row loading timeout guard"
  );

  source = replaceRequired(
    source,
    `{loading ? <div className="text-muted">Loading…</div> : err ? <div className="text-danger">{err}</div> : blurb ? <div className="npc-text">{blurb}</div> : <div className="text-muted">No description yet.</div>}`,
    `{loading && !blurb ? <div className="text-muted">Loading…</div> : err && !blurb ? <div className="text-danger">{err}</div> : blurb ? <div className="npc-text">{blurb}</div> : <div className="text-muted">No description yet.</div>}`,
    "NpcPanel About card fallback while loading"
  );

  if (source !== before) {
    write(rel, source);
    changedAny = true;
    console.log("Patched NpcPanel loading fallback.");
  }
}

// -----------------------------------------------------------------------------
// Map page client: prevent a single initial data request from causing a silent
// dead-start. This does not change movement/pathing rules; it only makes the
// boot sequence tolerant of partial/late data.
// -----------------------------------------------------------------------------
{
  const rel = "components/MapPageClient.js";
  let source = read(rel);
  const before = source;

  source = replaceRequired(
    source,
    `  /* Initial load */\n  useEffect(() => {\n    (async () => {\n      await checkAdmin();\n      await Promise.all([loadLocations(), loadLocationIcons(), loadMerchants(), loadNpcs(), loadAllNpcs(), loadRoutes()]);\n    })();\n  }, [checkAdmin, loadLocations, loadLocationIcons, loadMerchants, loadNpcs, loadAllNpcs, loadRoutes]);`,
    `  /* Initial load */\n  useEffect(() => {\n    let active = true;\n\n    const runWithTimeout = async (label, fn, ms = 9000) => {\n      let timeoutId = null;\n      const timeout = new Promise((resolve) => {\n        timeoutId = setTimeout(() => resolve({ ok: false, label, timeout: true }), ms);\n      });\n      const task = Promise.resolve()\n        .then(() => fn())\n        .then(\n          () => ({ ok: true, label }),\n          (error) => ({ ok: false, label, error })\n        );\n      const result = await Promise.race([task, timeout]);\n      if (timeoutId) clearTimeout(timeoutId);\n      return result;\n    };\n\n    (async () => {\n      const results = await Promise.all([\n        runWithTimeout("admin", checkAdmin, 6000),\n        runWithTimeout("locations", loadLocations),\n        runWithTimeout("location icons", loadLocationIcons),\n        runWithTimeout("merchants", loadMerchants),\n        runWithTimeout("npc pins", loadNpcs),\n        runWithTimeout("npc drawer", loadAllNpcs),\n        runWithTimeout("routes", loadRoutes),\n      ]);\n      if (!active) return;\n      const failed = results.filter((entry) => !entry?.ok);\n      if (failed.length) {\n        console.warn(\n          "Map initial load completed with partial data",\n          failed.map((entry) => entry.label)\n        );\n      }\n    })().catch((error) => {\n      if (!active) return;\n      console.error("Map initial load failed", error);\n      setErr(error?.message || "Map loaded partially. Refresh if data is missing.");\n    });\n\n    return () => {\n      active = false;\n    };\n  }, [checkAdmin, loadLocations, loadLocationIcons, loadMerchants, loadNpcs, loadAllNpcs, loadRoutes]);`,
    "MapPageClient partial initial load guard"
  );

  if (source !== before) {
    write(rel, source);
    changedAny = true;
    console.log("Patched MapPageClient initial loading guard.");
  }
}

// Self-review after patching.
{
  const npcsPage = read("pages/npcs.js");
  const npcPanel = read("components/NpcPanel.js");
  const mapPageClient = read("components/MapPageClient.js");

  for (const token of [
    'runWithTimeout("auth", loadAuth, 6000)',
    'runWithTimeout("map icons", loadMapIcons)',
    'NPC page initial load completed with partial data',
    'setLoading(false);',
  ]) requireToken(npcsPage, token, "NPC page loading guard");

  for (const token of [
    'NPC profile detail load timed out; using supplied panel row fallback',
    'loading && !blurb',
    'err && !blurb',
    'if (!npcId) {',
  ]) requireToken(npcPanel, token, "NpcPanel loading guard");

  for (const token of [
    'runWithTimeout("admin", checkAdmin, 6000)',
    'Map initial load completed with partial data',
    'Map loaded partially. Refresh if data is missing.',
  ]) requireToken(mapPageClient, token, "Map loading guard");

  for (const token of [
    'route_segment_progress =',
    'advance_all_characters',
    'world_state',
  ]) requireAbsent(mapPageClient, token, "Map loading guard should not touch movement logic");

  console.log("Route loading guards validated.");
}

if (changedAny) console.log("Applied route loading guards.");
else console.log("Route loading guards already current.");
