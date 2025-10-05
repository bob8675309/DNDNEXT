// /pages/inventory.js (updated)
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";
import ItemCard from "@/components/ItemCard";
import OfferTradeButton from "@/components/OfferTradeButton";
import TradeRequestsPanel from "@/components/TradeRequestsPanel";
import { classifyUi } from "@/utils/itemsIndex";


const supabase = createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL,
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);


export default function InventoryPage() {
const router = useRouter();
const [session, setSession] = useState(null);
const [rows, setRows] = useState([]);
const [loading, setLoading] = useState(true);
const [meta, setMeta] = useState({ character_name: "", character_image_url: "" });
const [saving, setSaving] = useState(false);
const [err, setErr] = useState("");
const [busyId, setBusyId] = useState(null); // for per-card delete spinner


useEffect(() => {
let unsub;
(async () => {
const { data } = await supabase.auth.getSession();
const sess = data.session;
if (!sess) { router.replace("/login"); return; }
setSession(sess);
setMeta({
character_name: sess.user.user_metadata?.character_name || "",
character_image_url: sess.user.user_metadata?.character_image_url || "",
});
await load(sess.user.id);


const ch = supabase
.channel("inv-self")
.on("postgres_changes", { event: "*", schema: "public", table: "inventory_items", filter: `user_id=eq.${sess.user.id}` }, () => load(sess.user.id))
.subscribe();
unsub = () => supabase.removeChannel(ch);
})();
return () => unsub?.();
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);


async function load(userId) {
setLoading(true);
const { data, error } = await supabase
.from("inventory_items")
.select("*")
.eq("user_id", userId)
.order("created_at", { ascending: false });
if (!error) setRows(data || []);
setLoading(false);
}


async function saveMeta(e) {
e?.preventDefault();
setSaving(true); setErr("");
try {
const { error } = await supabase.auth.updateUser({
data: {
character_name: meta.character_name || "",
character_image_url: meta.character_image_url || "",
},
});
if (error) throw error;
} catch (e2) {
setErr(e2.message || "Failed to save.");
} finally {
setSaving(false);
}
}


// Hydrate DB rows into ItemCard-friendly items
const items = useMemo(() => {
return (rows || []).map((row) => {
// payload may be JSON (object) or JSON string; or absent
const payloadRaw = row.card_payload || row.item_payload || null;
const payload = typeof payloadRaw === "string" ? (safeParse(payloadRaw) || {}) : (payloadRaw || {});


const base = {
id: row.id,
name: row.item_name || payload.name,
item_name: row.item_name || payload.name,
rarity: row.item_rarity || payload.rarity,
item_rarity: row.item_rarity || payload.rarity,
description: row.item_description || payload.description,
item_description: row.item_description || payload.description,
image_url: row.image_url || payload.image_url || "/placeholder.png",