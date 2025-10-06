// pages\inventory.js
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";
import ItemCard from "@/components/ItemCard";
import OfferTradeButton from "@/components/OfferTradeButton";
import TradeRequestsPanel from "@/components/TradeRequestsPanel";


const supabase = createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL,
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);


function safeParse(jsonish) {
try { return JSON.parse(jsonish); } catch { return null; }
}


export default function InventoryPage() {
const router = useRouter();
const [session, setSession] = useState(null);
const [rows, setRows] = useState([]);
const [loading, setLoading] = useState(true);
const [meta, setMeta] = useState({ character_name: "", character_image_url: "" });
const [saving, setSaving] = useState(false);
const [err, setErr] = useState("");
const [busyId, setBusyId] = useState(null); // per-card spinner
const [isAdmin, setIsAdmin] = useState(false);
const [viewAll, setViewAll] = useState(false); // admin toggle


useEffect(() => {
let unsub;
(async () => {
const { data } = await supabase.auth.getSession();
const sess = data.session;
if (!sess) { router.replace("/login"); return; }
setSession(sess);


// load role
const roleRes = await supabase.from("user_profiles").select("role").eq("id", sess.user.id).single();
const role = (roleRes.data?.role || "player").toLowerCase();
const admin = role === "admin" || role === "gm" || role === "game_master";
setIsAdmin(admin);


setMeta({
character_name: sess.user.user_metadata?.character_name || "",
character_image_url: sess.user.user_metadata?.character_image_url || "",
});
await load(admin && viewAll ? null : sess.user.id);


// live updates (when admin viewing all, listen to everything; else self)
const ch = supabase
.channel("inv-live")
.on(
"postgres_changes",
{ event: "*", schema: "public", table: "inventory_items", ...(admin && viewAll ? {} : { filter: `user_id=eq.${sess.user.id}` }) },
() => load(admin && viewAll ? null : sess.user.id)
)
.subscribe();
unsub = () => supabase.removeChannel(ch);
})();
return () => unsub?.();
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [viewAll]);


async function load(userId /* if null and admin, load all */) {
setLoading(true);
let q = supabase.from("inventory_items").select("*").order("created_at", { ascending: false });
if (userId) q = q.eq("user_id", userId);
const { data, error } = await q;
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
}