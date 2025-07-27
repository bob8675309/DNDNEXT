// /pages/admin.js

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);
  const [user, setUser] = useState(null);
  const router = useRouter();

  // Scaffolded state for admin data
  const [players, setPlayers] = useState([]);
  const [items, setItems] = useState([]);
  const [merchants, setMerchants] = useState([]);

  // Load auth and admin status
  useEffect(() => {
    async function checkAdmin() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (!user) {
        setLoading(false);
        router.replace("/login");
        return;
      }
      const { data, error } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();
      if (!error && data) setRole(data.role);
      setLoading(false);
    }
    checkAdmin();
  }, [router]);

  // Load admin data (players, items, merchants)
  useEffect(() => {
    if (role === "admin") {
      supabase.from("players").select("*").then(({ data }) => setPlayers(data || []));
      supabase.from("items").select("*").then(({ data }) => setItems(data || []));
      supabase.from("merchants").select("*").then(({ data }) => setMerchants(data || []));
    }
  }, [role]);

  if (loading) return <div className="p-8 text-gray-400">Loading...</div>;
  if (role !== "admin")
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-red-400 bg-[#191d24]">
        <div className="text-xl font-bold">Access Denied</div>
        <div className="mt-2 text-gray-400">Admins only.</div>
      </div>
    );

  return (
    <div className="min-h-screen bg-[#191d24] text-gray-100 p-8">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

      {/* --- Player Management --- */}
      <section className="mb-10 p-6 bg-[#23272f] rounded-xl shadow border border-gray-800">
        <h2 className="text-2xl font-semibold mb-4 text-cyan-400">Players</h2>
        <div className="mb-4">
          {/* List all players */}
          <ul>
            {players.map(player => (
              <li key={player.id} className="mb-2">
                <span className="font-bold">{player.name}</span> 
                <span className="ml-2 text-xs text-gray-400">{player.id}</span>
                {/* TODO: Add Edit/Delete/Assign Item buttons */}
              </li>
            ))}
          </ul>
        </div>
        {/* TODO: Add Create/Edit/Delete Player logic */}
      </section>

      {/* --- Item Management --- */}
      <section className="mb-10 p-6 bg-[#23272f] rounded-xl shadow border border-gray-800">
        <h2 className="text-2xl font-semibold mb-4 text-indigo-400">Items</h2>
        <div className="mb-4">
          {/* List all items */}
          <ul>
            {items.map(item => (
              <li key={item.id} className="mb-2">
                <span className="font-bold">{item.name}</span> 
                <span className="ml-2 text-xs text-gray-400">{item.rarity}</span>
                {// ...inside your items.map loop in /pages/admin.js:
<li key={item.id} className="mb-2 flex flex-col gap-1 border-b border-gray-700 pb-2">
  <span className="font-bold">{item.name}</span>
  <span className="ml-2 text-xs text-gray-400">{item.rarity}</span>
  <AdminItemImageGenerator
    item={item}
    onImage={async (url) => {
      // Optional: auto-update the item's image in Supabase when generated
      await supabase
        .from("items")
        .update({ image: url })
        .eq("id", item.id);
      // Optionally trigger a re-fetch of items
    }}
  />
</li>
}
              </li>
            ))}
          </ul>
        </div>
        {/* TODO: Add Create/Edit/Delete/Assign logic */}
      </section>

      {/* --- Merchant Management --- */}
      <section className="mb-10 p-6 bg-[#23272f] rounded-xl shadow border border-gray-800">
        <h2 className="text-2xl font-semibold mb-4 text-yellow-400">Merchants</h2>
        <div className="mb-4">
          {/* List all merchants */}
          <ul>
            {merchants.map(merchant => (
              <li key={merchant.id} className="mb-2">
                <span className="font-bold">{merchant.name}</span>
                <span className="ml-2 text-xs text-gray-400">{merchant.roaming_spot?.locationName}</span>
                {/* TODO: Add Edit/Delete/Change Inventory/Move Location buttons */}
              </li>
            ))}
          </ul>
        </div>
        {/* TODO: Add Create/Edit/Delete/Move logic */}
      </section>

      {/* --- Activity/Logs (optional) --- */}
      <section className="p-6 bg-[#23272f] rounded-xl shadow border border-gray-800">
        <h2 className="text-2xl font-semibold mb-4 text-rose-400">Activity Logs</h2>
        <div>
          {/* TODO: Add log/activity tracking if needed */}
          <div className="text-gray-500 italic">No logs implemented yet.</div>
        </div>
      </section>
    </div>
  );
}
