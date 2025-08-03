import { useEffect, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { FaMapMarkerAlt, FaUser, FaBookOpen } from "react-icons/fa";

export default function LocationSideBar({ open, onClose, location }) {
  const [npcs, setNpcs] = useState([]);
  const [quests, setQuests] = useState([]);

  useEffect(() => {
    async function fetchNpcs() {
      if (!location?.id) return;
      const { data, error } = await supabase
        .from("npc")
        .select("*")
        .eq("location_id", location.id);
      if (!error) setNpcs(data);
    }

    async function fetchQuests() {
      if (!location?.id) return;
      const { data, error } = await supabase
        .from("quests")
        .select("*")
        .eq("location_id", location.id);
      if (!error) setQuests(data);
    }

    fetchNpcs();
    fetchQuests();
  }, [location?.id]);

  if (!location) return null;

  return (
    <aside
      className={`sidebar fixed top-0 right-0 h-full w-[90vw] sm:w-[400px] max-w-full bg-amber-100 bg-opacity-95 shadow-2xl z-50 border-l-4 border-yellow-700 flex flex-col p-6 font-serif transition-transform`}
      style={{
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.3s ease-in-out",
      }}
    >
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-2 left-2 text-xl font-bold text-gray-800 hover:text-gray-600"
      >
        ×
      </button>

      {/* Location Name */}
      <h2 className="text-3xl font-extrabold text-yellow-800 mb-1">{location.name}</h2>

      {/* Description */}
      <p className="text-sm italic mb-4 text-black">{location.description}</p>

      {/* Travel Notes */}
      {location.travel_notes && (
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-yellow-700">✧ Passage Through</h3>
          <p className="text-black text-sm">{location.travel_notes}</p>
        </div>
      )}

      {/* NPCs */}
      {npcs.length > 0 && (
        <div className="mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2 text-yellow-700">
            <FaUser className="inline-block text-black" /> Notable NPCs
          </h3>
          <ul className="ml-4 list-disc text-black text-sm">
            {npcs.map((npc) => (
              <li key={npc.id}>
                <a href={`/npcs/${npc.id}`} className="underline hover:text-yellow-900">
                  {npc.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Quests */}
      {quests.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2 text-yellow-700">
            <FaBookOpen className="inline-block text-black" /> Quests
          </h3>
          <ul className="ml-4 list-disc text-black text-sm">
            {quests.map((quest) => (
              <li key={quest.id}>
                <a href={`/quest/${quest.id}`} className="underline hover:text-yellow-900">
                  {quest.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
