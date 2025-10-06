// /components/TradeRequestsPanel.js
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";


const supabase = createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL,
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);


export default function TradeRequestsPanel() {
const [incoming, setIncoming] = useState([]);
const [outgoing, setOutgoing] = useState([]);
const [itemsById, setItemsById] = useState({});
const [tab, setTab] = useState("incoming");
const [busy, setBusy] = useState(false);
const [err, setErr] = useState("");


useEffect(() => {
let unsub;
(async () => {
const { data } = await supabase.auth.getSession();
const userId = data.session?.user?.id || null;
await load(userId);
const ch = supabase
.channel("trade-rt")
.on("postgres_changes", { event: "*", schema: "public", table: "trade_requests" }, () => load(userId))
.subscribe();
unsub = () => supabase.removeChannel(ch);
})();
return () => unsub?.();
}, []);


async function load(userId) {
if (!userId) return;
setErr("");
const [inc, out] = await Promise.all([
supabase.from("trade_requests").select("*").eq("to_user_id", userId).order("created_at", { ascending: false }),
supabase.from("trade_requests").select("*").eq("from_user_id", userId).order("created_at", { ascending: false }),
]);


if (!inc.error) setIncoming(inc.data || []);
if (!out.error) setOutgoing(out.data || []);


const ids = Array.from(new Set([...(inc.data||[]), ...(out.data||[])].map(r => r.inventory_item_id)));
if (ids.length) {
const { data: items } = await supabase
.from("inventory_items")
.select("id,item_name,item_rarity,item_type,card_payload")
.in("id", ids);
const map = {};
(items||[]).forEach(i => { map[i.id] = i; });
setItemsById(map);
function safeParse(s){ try { return JSON.parse(s); } catch { return null; } }