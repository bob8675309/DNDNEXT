import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import Image from "next/image";
import LocationSidebar from "../components/LocationSidebar";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function MapPage() {
  const [locations, setLocations] = useState([]);
  const [selected, setSelected] = useState(null); // selected location
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Fetch locations from Supabase
  useEffect(() => {
    async function fetchLocations() {
      const { data, error } = await supabase.from("locations").select("*");
      if (!error && data) setLocations(data);
    }
    fetchLocations();
  }, []);

  // Fetch user & check for admin
  useEffect(() => {
    async function getSession() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        const { data, error } = await supabase
          .from("users")
          .select("role")
          .eq("id", user.id)
          .single();
        setIsAdmin(data?.role === "admin");
      }
    }
    getSession();
  }, []);

  // Open sidebar when selecting a marker
  const handleMarkerClick = (loc) => {
    setSelected(loc);
    setSidebarOpen(true);
  };

  // Optional: Close sidebar on map click
  const handleMapClick = (e) => {
    if (e.target.id === "map-background") {
      setSidebarOpen(false);
      setSelected(null);
    }
  };

  return (
    <div className="relative w-full min-h-screen bg-black flex">
      {/* Map Background */}
      <div
        id="map-background"
        className="relative flex-1 bg-[#181c22] overflow-hidden"
        style={{ minHeight: "80vh" }}
        onClick={handleMapClick}
      >
        <Image
          src="/Wmap.jpg" // Change path if needed
          alt="DnD World Map"
          layout="responsive"
          width={1400}
          height={1100}
          className="block w-full h-auto"
          draggable={false}
          priority
        />

        {/* Location markers */}
        {locations.map((loc) =>
          typeof loc.x === "number" && typeof loc.y === "number" ? (
            <button
              key={loc.id}
              className="absolute z-20 group"
              style={{
                left: `${loc.x}%`,
                top: `${loc.y}%`,
                transform: "translate(-50%, -50%)",
                transition: "box-shadow 0.1s",
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
          ) : null
        )}
      </div>
      {/* Sidebar (right) */}
      <LocationSidebar
        open={sidebarOpen}
        location={selected}
        onClose={() => setSidebarOpen(false)}
        isAdmin={isAdmin}
      />
      {/* Optional: dimmed overlay when sidebar is open */}
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
