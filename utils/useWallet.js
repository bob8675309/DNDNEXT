// /utils/useWallet.js
* - For a normal player (no userId passed): uses RPC wallet_get() to read own GP
* - For admin viewing another user: queries public.player_wallets directly
* - Supports \-1 (infinite) semantics
*/
export default function useWallet(targetUserId = null) {
const [gp, setGp] = useState(null);
const [loading, setLoading] = useState(true);
const [me, setMe] = useState(null);
const [isAdmin, setIsAdmin] = useState(false);


useEffect(() => {
let unsub;
(async () => {
const { data: s } = await supabase.auth.getSession();
const uid = s.session?.user?.id || null;
setMe(uid);
// role
const role = await supabase.from("user_profiles").select("role").eq("id", uid).maybeSingle();
setIsAdmin((role.data?.role || "player") !== "player");
await refresh(uid);
//
const ch = supabase
.channel("wallet-rt")
.on("postgres_changes", { event: "*", schema: "public", table: "player_wallets" }, () => refresh(uid))
.subscribe();
unsub = () => supabase.removeChannel(ch);
})();
return () => unsub?.();
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [targetUserId]);


async function refresh(uid) {
setLoading(true);
try {
// Admin viewing another user
if (targetUserId && isAdmin) {
const { data } = await supabase
.from("player_wallets")
.select("gp")
.eq("user_id", targetUserId)
.maybeSingle();
setGp(data?.gp ?? 0);
} else {
// Self via RPC (works with RLS)
const { data, error } = await supabase.rpc("wallet_get");
if (error) throw error;
setGp(data ?? 0);
}
} catch (e) {
console.error(e);
setGp(0);
} finally {
setLoading(false);
}
}


const infinite = useMemo(() => gp === -1, [gp]);
const label = infinite ? "∞ gp" : `${gp ?? 0} gp`;


// admin helpers
async function setAmount(newAmount, userId = targetUserId || me) {
const { error } = await supabase.rpc("wallet_set", { p_user: userId, p_amount: newAmount });
if (error) throw error;
await refresh(me);
}
async function addAmount(delta, userId = targetUserId || me) {
const { error } = await supabase.rpc("wallet_add", { p_user: userId, p_delta: delta });
if (error) throw error;
await refresh(me);
}


return { gp, label, loading, infinite, isAdmin, me, refresh, setAmount, addAmount };
}