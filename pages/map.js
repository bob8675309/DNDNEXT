import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import Image from "next/image";
import LocationSideBar from "../components/LocationSideBar";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const FLAG_COLORS = [
  "bg-red-500", "bg-blue-500", "bg-green-500", "bg-yellow-400", "bg-purple-500", "bg-pink-500", "bg-orange-400"
];

export default function MapPage() {
  const [locations, setLocations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState("player");
  const [flags, setFlags] = useState([]);
  const mapContainer = useRef(null);

  // Fetch locations from Supabase
  useEffect(() => {
    async function fetchLocations() {
      const { data } = await supabase.from("locations").select("*");
      setLocations(data || []);
    }
    fetchLocations();
  }, []);

  // Fetch flags from Supabase
  useEffect(() => {
    async function fetchFlags() {
      const { data } = await supabase.from("map_flags").select("*");
      setFlags(data || []);
    }
    fetchFlags();
  }, []);

  // Fetch user and role
  useEffect(() => {
    async function getSession() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        // Check user role from user_profiles table
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

  // Sidebar open
  const handleMarkerClick = (loc) => {
    setSelected(loc);
    setSidebarOpen(true);
  };

  // Get map % coords from click
  const getMapCoords = (e) => {
    const rect = mapContainer.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    return { x: x.toFixed(2), y: y.toFixed(2) };
  };

  // Handle map click (not marker)
  const handleMapClick = async (e) => {
    // Don't add if clicking sidebar/overlay
    if (e.target.id !== "map-background") return;
    // Get percent coords
    const { x, y } = getMapCoords(e);

    if (userRole === "admin") {
      // Prompt for new location
      const name = prompt("Enter location name:");
      if (!name) return;
      const description = prompt("Enter location description:") || "";
      await supabase.from("locations").insert([
        { name, x, y, description }
      ]);
      window.location.reload();
    } else if (user) {
      // For players: set their flag
      const colorIdx = Math.abs((user.id || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % FLAG_COLORS.length;
      const color = FLAG_COLORS[colorIdx];
      await supabase.from("map_flags").upsert([
        { user_id: user.id, x, y, color }
      ]);
      // Refresh flags
      const { data } = await supabase.from("map_flags").select("*");
      setFlags(data || []);
    }
  };

  return (
    <div className="relative w-full min-h-screen bg-black flex">
      {/* Map Background */}
      <div
        id="map-background"
        className="relative flex-1 bg-[#181c22] overflow-hidden"
        style={{ minHeight: "80vh" }}
        ref={mapContainer}
        onClick={handleMapClick}
      >
        <Image
          src="/Wmap.jpg"
          alt="DnD World Map"
          layout="responsive"
          width={1400}
          height={1100}
          className="block w-full h-auto"
          draggable={false}
          priority
        />

        {/* Location markers */}
        {locations.map((loc) => {
          const x = parseFloat(loc.x);
          const y = parseFloat(loc.y);
          if (isNaN(x) || isNaN(y)) return null;
          return (
            <button
              key={loc.id}
              className="absolute z-20 group"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                transform: "translate(-50%, -50%)",
              }}
              title={loc.name}
              onClick={(e) => {
                e.stopPropagation();
                handleMarkerClick(loc);
              }}
              tabIndex={0}
            >
              <span className={`
                w-7 h-7 rounded-full border-2 shadow-xl 
                flex items-center justify-center
                bg-yellow-300/90 border-yellow-900
                group-hover:bg-yellow-400
                group-hover:shadow-2xl
                group-active:ring-2 ring-yellow-300
                transition
                cursor-pointer
              `}>
                <span className="text-sm font-bold text-black">{loc.icon ? loc.icon : "⬤"}</span>
              </span>
            </button>
          );
        })}

        {/* Player map flags */}
        {flags.map((flag) => {
          const x = parseFloat(flag.x);
          const y = parseFloat(flag.y);
          if (isNaN(x) || isNaN(y)) return null;
          return (
            <div
              key={flag.user_id}
              className={`absolute z-10 w-6 h-6 rounded-full flex items-center justify-center border-2 ${flag.color || "bg-blue-600"} border-white shadow-lg`}
              style={{
                left: `${x}%`,
                top: `${y}%`,
                transform: "translate(-50%, -70%)",
                pointerEvents: "none",
              }}
              title={`Player Flag`}
            >
              <span className="text-2xl">🚩</span>
            </div>
          );
        })}
      </div>
      {/* Sidebar (right) */}
      <LocationSideBar
        open={sidebarOpen}
        location={selected}
        onClose={() => setSidebarOpen(false)}
        isAdmin={userRole === "admin"}
      />
      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition"
          onClick={() => {
            setSidebarOpen(false);
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}
