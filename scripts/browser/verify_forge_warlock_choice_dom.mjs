#!/usr/bin/env node
// J169: real Chromium + React user clicks on the original SourceChoiceFields,
// compared byte-for-byte (structured JSON) with accepted J168 wire output.
// No real Forge form, no JWT, no Supabase, no production network, no screenshots.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { loadWarlockChildPlans } from "../validate_forge_seeded_warlock_child_completion.mjs";
import { compileWarlockClientWire } from "../agents/forge_warlock_client_wire.mjs";

assert.equal(process.env.DNDNEXT_FORGE_BROWSER_FIXTURE_ONLY, "1",
  "J169 requires explicit disposable browser-only fixture guard.");
const toolsRoot = process.env.FORGE_BROWSER_TOOL_ROOT;
const chromeBinary = process.env.FORGE_BROWSER_CHROME;
assert.ok(toolsRoot && path.isAbsolute(toolsRoot), "Pinned temporary browser tools directory required.");
assert.ok(chromeBinary && path.isAbsolute(chromeBinary), "Explicit local Chromium binary required.");
const requirePinned = createRequire(path.join(toolsRoot, "j169-tool-anchor.js"));
const { chromium } = requirePinned("playwright-core");

const expected = await compileWarlockClientWire(loadWarlockChildPlans().source);
const ephemeral = mkdtempSync(path.join(tmpdir(), "dndnext-forge-j169-"));
const bundle = path.join(ephemeral, "browser.js");
const entry = path.resolve("scripts/browser/forge_warlock_choice_dom.jsx");
const bundler = path.join(toolsRoot, "node_modules", ".bin", "esbuild");
let server = null;
let browser = null;
try {
  execFileSync(bundler, [
    entry, "--bundle", "--platform=browser", "--format=iife", "--jsx=automatic",
    "--loader:.js=jsx", "--target=chrome120", "--log-level=error", "--outfile=" + bundle,
  ], { stdio: "pipe", timeout: 90000 });
  const js = readFileSync(bundle);
  server = createServer((request, response) => {
    if (request.url === "/") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      response.end('<!doctype html><html lang="en"><meta charset="utf-8"><title>Isolated Forge J169</title><body><div id="j169-app"></div><script src="/browser.js"></script></body></html>');
    } else if (request.url === "/browser.js") {
      response.writeHead(200, { "Content-Type": "application/javascript", "Cache-Control": "no-store" });
      response.end(js);
    } else {
      response.writeHead(404, { "Content-Type": "text/plain" });
      response.end("Not found");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + server.address().port;
  browser = await chromium.launch({
    executablePath: chromeBinary, headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const pageErrors = [];
  const externalRequests = [];
  page.on("pageerror", (error) => pageErrors.push(String(error.message || error)));
  await page.route("**/*", async (route) => {
    const address = new URL(route.request().url());
    if (address.origin !== base) {
      externalRequests.push(address.origin);
      await route.abort();
    } else {
      await route.continue();
    }
  });
  await page.goto(base, { waitUntil: "load" });
  await page.waitForFunction(() => window.__DNDNEXT_J169_CHOICE_WIRE__?.ready === true);
  const groups = page.locator(".npc-forge-source-choice-group");
  assert.equal(await groups.count(), 3, "Expected exactly three actual React Invocation groups.");
  let status = await page.evaluate(() => window.__DNDNEXT_J169_CHOICE_WIRE__);
  assert.equal(status.complete, false, "Forge UI cannot begin with all required fields complete.");
  const chooseInvocation = async (slotIndex, name) => {
    const group = groups.nth(slotIndex);
    await group.locator(".npc-forge-rich-choice__list button").filter({ hasText: name }).click();
    const detail = group.locator(".npc-forge-rich-choice__detail button").first();
    await detail.click();
    await page.waitForFunction(({ slot, wanted }) => {
      const wire = window.__DNDNEXT_J169_CHOICE_WIRE__;
      return wire?.sourceChoices?.["warlock-invocation-slot-" + slot]
        ?.fields?.invocation?.selections?.[0]?.label === wanted;
    }, { slot: slotIndex + 1, wanted: name });
  };

  await chooseInvocation(0, "Armor of Shadows");
  await chooseInvocation(1, "Agonizing Blast");
  const child = groups.nth(1).locator(".npc-forge-source-spell-picker");
  await child.waitFor({ state: "visible" });
  status = await page.evaluate(() => window.__DNDNEXT_J169_CHOICE_WIRE__);
  assert.equal(status.complete, false, "Agonizing Blast must remain incomplete without a dependent cantrip.");
  assert.equal(status.sourceChoices["warlock-invocation-slot-2"].fields["child-agonizing-blast"].selections.length, 0,
    "Dependent cantrip must not be auto-selected.");
  const blast = child.locator(".npc-forge-source-spell-picker__row")
    .filter({ hasText: "Eldritch Blast" }).first();
  await blast.locator("button.npc-forge-source-spell-picker__status").click();
  await page.waitForFunction(() => {
    const selections = window.__DNDNEXT_J169_CHOICE_WIRE__
      ?.sourceChoices?.["warlock-invocation-slot-2"]?.fields?.["child-agonizing-blast"]?.selections;
    return Array.isArray(selections) && selections.length === 1;
  });
  await chooseInvocation(2, "Eldritch Mind");
  await page.waitForFunction(() => window.__DNDNEXT_J169_CHOICE_WIRE__?.complete === true);
  const actual = await page.evaluate(() => ({
    sourceChoices: window.__DNDNEXT_J169_CHOICE_WIRE__.sourceChoices,
    sourceChoiceSummary: window.__DNDNEXT_J169_CHOICE_WIRE__.sourceChoiceSummary,
  }));
  assert.deepEqual(actual, expected,
    "Actual React clicks must serialize the exact J168 signed-RPC source-choice wire structure.");
  assert.equal(actual.sourceChoiceSummary.length, 4);

  // Regression: deselecting the invocation removes the dependent source
  // choice from completed wire authority. No stale hidden child may persist.
  const slot2 = groups.nth(1);
  await slot2.locator(".npc-forge-rich-choice__detail button").first().click();
  await page.waitForFunction(() => {
    const status = window.__DNDNEXT_J169_CHOICE_WIRE__;
    const slot = status?.sourceChoices?.["warlock-invocation-slot-2"];
    return status?.complete === false && slot?.fields?.invocation?.selections?.length === 0;
  });
  const afterRemoval = await page.evaluate(() =>
    window.__DNDNEXT_J169_CHOICE_WIRE__.sourceChoices["warlock-invocation-slot-2"]);
  assert.ok(!afterRemoval.fields["child-agonizing-blast"] ||
    afterRemoval.fields["child-agonizing-blast"].selections.length === 0,
    "Inactive Agonizing Blast child must not remain in serialized grants.");
  assert.equal(await slot2.locator(".npc-forge-source-spell-picker").count(), 0);
  await chooseInvocation(1, "Agonizing Blast");
  const restoredChild = slot2.locator(".npc-forge-source-spell-picker");
  await restoredChild.waitFor({ state: "visible" });
  const afterRestore = await page.evaluate(() =>
    window.__DNDNEXT_J169_CHOICE_WIRE__.sourceChoices["warlock-invocation-slot-2"]);
  assert.equal(afterRestore.fields["child-agonizing-blast"].selections.length, 0,
    "Re-adding Agonizing Blast cannot silently restore a stale hidden spell.");
  await restoredChild.locator(".npc-forge-source-spell-picker__row")
    .filter({ hasText: "Eldritch Blast" }).first()
    .locator("button.npc-forge-source-spell-picker__status").click();
  await page.waitForFunction(() => window.__DNDNEXT_J169_CHOICE_WIRE__?.complete === true);
  const replayed = await page.evaluate(() => ({
    sourceChoices: window.__DNDNEXT_J169_CHOICE_WIRE__.sourceChoices,
    sourceChoiceSummary: window.__DNDNEXT_J169_CHOICE_WIRE__.sourceChoiceSummary,
  }));
  assert.deepEqual(replayed, expected, "React source-choice reselect must return to J168 wire output.");
  assert.deepEqual(externalRequests, [], "Fixture attempted forbidden non-loopback HTTP access.");
  assert.deepEqual(pageErrors, [], "Browser emitted an uncaught JavaScript exception.");
  console.log("PASS J169 rendered Chromium React SourceChoiceFields: three XPHB Warlock2 Invocations, conditional Agonizing/Eldritch Blast, exact J168 sourceChoices and summary, incomplete-state gating, stale-child rejection and reselect parity.");
  console.log("BOUNDARY J169: isolated React choice surface only; no NewNpcModalV3 full-step form, actual browser create RPC, live Auth/RLS, complete catalogue or production.");
  await context.close();
} finally {
  if (browser) await browser.close();
  if (server) await new Promise((resolve) => server.close(resolve));
  rmSync(ephemeral, { recursive: true, force: true });
}
