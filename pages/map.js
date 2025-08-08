import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import Image from "next/image";
import LocationSideBar from "../components/LocationSideBar";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const FLAG_COLORS = [
  "bg-danger", "bg-primary", "bg-success", "bg-warning",
  "bg-info", "bg-pink", "bg-orange"
];

export default function MapPage() {
  const [locations, setLocations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState("player");
  const [flags, setFlags] = useState([]);
  const [npcs, setNpcs] = useState([]);
  const [quests, setQuests] = useState([]);
  const [merchants, setMerchants] = useState([]);
  const mapContainer = useRef(null);

  useEffect(() => {
    async function fetchAll() {
      try {
        const [locRes, npcRes, questRes, merchRes] = await Promise.all([
          supabase.from("locations").select("*"),
          supabase.from("npcs").select("*"),
          supabase.from("quests").select("*"),
          supabase.from("merchants").select("*"),
        ]);

        const npcsData = npcRes.data || [];
        const questsData = questRes.data || [];

        const enrichedLocations = (locRes.data || []).map(loc => ({
          ...loc,
          npcs: Array.isArray(loc.npcs)
            ? loc.npcs.map(id => npcsData.find(npc => npc.id === id)).filter(Boolean)
            : [],
          quests: Array.isArray(loc.quests)
            ? loc.quests.map(id => questsData.find(q => q.id === id)).filter(Boolean)
            : [],
        }));

        setLocations(enrichedLocations);
        setNpcs(npcsData);
        setQuests(questsData);
        setMerchants(merchRes.data || []);
      } catch (error) {
        console.error("Failed to fetch data:", error);
      }
    }

    fetchAll();
  }, []);

  useEffect(() => {
    async function fetchFlags() {
      const { data } = await supabase.from("map_flags").select("*");
      setFlags(data || []);
    }
    fetchFlags();
  }, []);

  useEffect(() => {
    async function getSession() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        const { data } = await supabase
          .from("user_profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        setUserRole(data?.role || "player");
      }
    }
    getSession();
  }, []);

  const getLocationWithDetails = (loc) => {
    if (!loc) return null;
    let fullNpcs = [];
    let fullQuests = [];
    if (loc.npcs?.length) {
      fullNpcs = typeof loc.npcs[0] === "object" ? loc.npcs : npcs.filter(n => loc.npcs.includes(n.id));
    }
    if (loc.quests?.length) {
      fullQuests = typeof loc.quests[0] === "object" ? loc.quests : quests.filter(q => loc.quests.includes(q.id));
    }
    return { ...loc, npcs: fullNpcs, quests: fullQuests };
  };

  const handleMarkerClick = (loc) => {
    setSelected(getLocationWithDetails(loc));
    setSidebarOpen(true);
  };

  const getMapCoords = (e) => {
    const rect = mapContainer.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    return { x: x.toFixed(2), y: y.toFixed(2) };
  };

  const handleMapClick = async (e) => {
    if (e.target.id !== "map-inner") return;
    const { x, y } = getMapCoords(e);

    if (userRole === "admin") {
      const name = prompt("Enter location name:");
      if (!name) return;
      const description = prompt("Enter location description:") || "";
      await supabase.from("locations").insert([{ name, x: String(x), y: String(y), description }]);
    } else if (user) {
      const colorIdx = Math.abs((user.id || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % FLAG_COLORS.length;
      const color = FLAG_COLORS[colorIdx];
      await supabase.from("map_flags").upsert([{ user_id: user.id, x: String(x), y: String(y), color }]);
      const { data } = await supabase.from("map_flags").select("*");
      setFlags(data || []);
    }
  };

  return (
    <div className="d-flex flex-column align-items-center w-100 vh-100 overflow-auto">
      <div id="map-wrapper" className="w-100 px-3 py-3">
        <div id="map-inner" onClick={handleMapClick} ref={mapContainer}>
          <img
            src="/Wmap.jpg"
            alt="DnD World Map"
            className="w-100 h-100 position-absolute"
            style={{ objectFit: "contain" }}
            draggable={false}
          />

          {locations.map((loc) => {
            const x = parseFloat(loc.x);
            const y = parseFloat(loc.y);
            if (isNaN(x) || isNaN(y)) return null;
            return (
              <button
                key={loc.id}
                className="btn btn-warning btn-sm position-absolute border border-dark shadow"
                style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%, -50%)" }}
                title={loc.name}
                onClick={(e) => {
                  e.stopPropagation();
                  handleMarkerClick(loc);
                }}
              >
                {loc.icon || "⬤"}
              </button>
            );
          })}

          {flags.map((flag) => {
            const x = parseFloat(flag.x);
            const y = parseFloat(flag.y);
            if (isNaN(x) || isNaN(y)) return null;
            return (
              <div
                key={flag.user_id}
                className={`position-absolute rounded-circle border border-white shadow ${flag.color || "bg-primary"}`}
                style={{ left: `${x}%`, top: `${y}%`, width: "1.5rem", height: "1.5rem", transform: "translate(-50%, -70%)" }}
              >
                <span className="d-block text-center">🚩</span>
              </div>
            );
          })}
        </div>
      </div>

      <LocationSideBar
        open={sidebarOpen}
        location={selected}
        onClose={() => setSidebarOpen(false)}
        isAdmin={userRole === "admin"}
        merchants={merchants}
      />

      {sidebarOpen && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-50"
          onClick={() => {
            setSidebarOpen(false);
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}
