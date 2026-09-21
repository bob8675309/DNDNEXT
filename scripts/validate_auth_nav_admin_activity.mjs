import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const navbar = read("components/AppNavbar.js");
const account = read("components/PlayerAccountPanel.js");
const tracker = read("components/SiteVisitTracker.js");
const activity = read("pages/admin/activity.js");
const app = read("pages/_app.js");
const migration = read("sql/20260921_01_admin_site_activity_v1.sql");

for (const token of [
  'const [authReady, setAuthReady] = useState(false)',
  'user ? (',
  '<NavAnchor className="navbar-brand fw-semibold" href="/">DnDNext</NavAnchor>',
  '<span className="navbar-brand fw-semibold" aria-disabled="true">DnDNext</span>',
  '{user ? <>',
  '<NavAnchor className="nav-link" href="/map">Map</NavAnchor>',
  '<NavAnchor className="nav-link" href="/npcs">NPCs</NavAnchor>',
  '<NavAnchor className="nav-link" href="/items">Crafting</NavAnchor>',
  '<NavAnchor className="nav-link" href="/inventory">Inventory</NavAnchor>',
  ') : authReady ? (',
]) assert(navbar.includes(token), `Authenticated navbar contract missing ${token}`);

assert(navbar.indexOf('{user ? <>') < navbar.indexOf('href="/map"'), "Campaign navigation must sit inside the authenticated user branch.");
assert(navbar.indexOf('{user ? <>') < navbar.indexOf('href="/npcs"'), "NPC navigation must sit inside the authenticated user branch.");

for (const token of [
  'role === "admin"',
  'href="/admin/activity"',
  'View recent site activity',
]) assert(account.includes(token), `Admin Account activity entry missing ${token}`);

for (const token of [
  'dndnext:site-visitor-key',
  'crypto.randomUUID',
  'record_site_visit_v1',
  'p_visitor_key: key',
  'p_path: cleanPath(pathValue)',
  'routeChangeComplete',
  'event === "SIGNED_IN"',
  'let deferredTimer = null',
  'window.setTimeout(() => {',
]) assert(tracker.includes(token), `Site visit tracker contract missing ${token}`);

for (const forbidden of ["ip_address", "userAgent", "navigator.userAgent", "geolocation"]) {
  assert(!tracker.includes(forbidden), `Privacy-minimized tracker must not collect ${forbidden}`);
}

for (const token of [
  'supabase.rpc("is_admin")',
  'supabase.rpc("get_recent_site_activity_v1")',
  'Admin access is required',
  'Anonymous visitor tracking starts with this deployment',
  'does not store IP addresses',
]) assert(activity.includes(token), `Admin activity page contract missing ${token}`);

assert(app.includes('import SiteVisitTracker from "../components/SiteVisitTracker";'), "Global app shell must import SiteVisitTracker.");
assert(app.includes("<SiteVisitTracker />"), "Global app shell must mount SiteVisitTracker.");

for (const token of [
  "create table if not exists public.site_visit_activity",
  "alter table public.site_visit_activity enable row level security",
  "revoke all on table public.site_visit_activity from anon, authenticated",
  "create or replace function public.record_site_visit_v1",
  "grant execute on function public.record_site_visit_v1(uuid, text) to anon, authenticated",
  "create or replace function public.get_recent_site_activity_v1",
  "if not private.current_user_is_admin()",
  "revoke execute on function public.get_recent_site_activity_v1() from anon",
  "grant execute on function public.get_recent_site_activity_v1() to authenticated",
  "now() - interval '30 days'",
  "last_seen < now() - interval '31 days'",
]) assert(migration.includes(token), `Site activity migration contract missing ${token}`);

for (const forbidden of ["user_agent text", "ip_address inet", "precise_location", "fingerprint text"]) {
  assert(!migration.toLowerCase().includes(forbidden), `Site activity ledger must not define a sensitive ${forbidden} field`);
}

console.log("Auth-gated navbar and privacy-minimized admin site activity validation passed.");
