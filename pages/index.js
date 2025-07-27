// /pages/index.js

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const router = useRouter();

  useEffect(() => {
    async function getSession() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
      if (!user) router.replace("/login");
    }
    getSession();
  }, [router]);

  if (loading) return <div className="p-8 text-gray-400">Loading...</div>;
  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#191d24] text-gray-100 p-8">
      <h1 className="text-3xl font-bold mb-4">Welcome to the D&D Campaign Site</h1>
      <ul className="space-y-2">
        <li><a href="/bestiary" className="text-blue-400 underline">Kaorti Bestiary</a></li>
        <li><a href="/npcs" className="text-blue-400 underline">NPCs</a></li>
        <li><a href="/items" className="text-blue-400 underline">Items</a></li>
        <li><a href="/map" className="text-blue-400 underline">Map</a></li>
        <li><a href="/alchemy" className="text-blue-400 underline">Alchemy</a></li>
      </ul>
    </div>
  );
}
