import React from "react";
import { supabase } from "./supabaseClient";
import { motion, AnimatePresence } from "framer-motion";
import { locationData as defaultLocationData } from "./MapNpcsQuests";


const syncInitialData = async () => {
  const { data: existing, error } = await supabase.from("locations").select("name, x, y");

  if (error) {
    console.error("Error checking existing locations:", error);
    return;
  }

  const existingNames = existing.map((loc) => loc.name);

  for (const loc of defaultLocationData) {
    const existingLoc = existing.find((e) => e.name === loc.name);

    const payload = {
      name: loc.name,
      description: loc.description,
      quests: JSON.stringify(loc.quests),
      npcs: JSON.stringify(loc.npcs),
      x: existingLoc?.x || loc.x || "50%",
      y: existingLoc?.y || loc.y || "50%",
    };

    if (!existingNames.includes(loc.name)) {
      const { error: insertError } = await supabase.from("locations").insert([payload]);
      if (insertError) {
        console.error(`Error inserting ${loc.name}:`, insertError);
      } else {
        console.log(`Inserted: ${loc.name}`);
      }
    } else {
      const { error: updateError } = await supabase.from("locations").update(payload).eq("name", loc.name);
      if (updateError) {
        console.error(`Error updating ${loc.name}:`, updateError);
      } else {
        console.log(`Updated: ${loc.name}`);
      }
    }
  }
};

  const Map = () => {
  const [locations, setLocations] = React.useState([]);
  const [selected, setSelected] = React.useState(null);
  const mapRef = React.useRef(null);

  React.useEffect(() => {
    const safeParse = (str) => {
      try {
        return JSON.parse(str);
      } catch {
        return [];
      }
    };

    const fetchLocations = async () => {
      const { data, error } = await supabase.from("locations").select();
      if (!error && data) {
        setLocations(
          data.map((loc) => ({
            ...loc,
            quests: safeParse(loc.quests),
            npcs: safeParse(loc.npcs),
          }))
        );
      }
    };

    syncInitialData().then(fetchLocations);
  }, []);

  const handleMapClick = async (e) => {
    if (!mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    const x = `${((e.clientX - rect.left) / rect.width) * 100}%`;
    const y = `${((e.clientY - rect.top) / rect.height) * 100}%`;

    const name = prompt("Enter location name:");
    if (!name) return;
    const description = prompt("Enter location description:", "") || "";

    const { data, error } = await supabase.from("locations").insert([
      {
        name,
        description,
        x,
        y,
        quests: JSON.stringify([]),
        npcs: JSON.stringify([]),
      },
    ]);

    if (!error && data) {
      setLocations((prev) => [...prev, { ...data[0], quests: [], npcs: [] }]);
    }
  };

  const updateLocation = async (updated) => {
    const { error } = await supabase
      .from("locations")
      .update({
        name: updated.name,
        description: updated.description,
        quests: JSON.stringify(updated.quests),
        npcs: JSON.stringify(updated.npcs),
      })
      .eq("id", updated.id);

    if (!error) {
      setSelected(updated);
      setLocations((prev) => prev.map((loc) => (loc.id === updated.id ? updated : loc)));
    }
  };

  const handleDelete = async () => {
    if (!selected) return;

    const { error } = await supabase.from("locations").delete().eq("id", selected.id);
    if (!error) {
      setLocations((prev) => prev.filter((loc) => loc.id !== selected.id));
      setSelected(null);
    }
  };

  const handleAddQuest = async () => {
    const title = prompt("Quest title:");
    if (!title) return;
    const status = prompt("Quest status:", "Active") || "Active";
    const description = prompt("Quest description:", "") || "";

    await updateLocation({
      ...selected,
      quests: [...selected.quests, { title, status, description }],
    });
  };

  const handleEditQuest = async (i) => {
    const title = prompt("New quest title:", selected.quests[i].title);
    if (!title) return;
    const status = prompt("New status:", selected.quests[i].status);
    const description = prompt("New description:", selected.quests[i].description);

    const updatedQuests = [...selected.quests];
    updatedQuests[i] = { title, status, description };

    await updateLocation({ ...selected, quests: updatedQuests });
  };

  const handleDeleteQuest = async (i) => {
    const updatedQuests = [...selected.quests];
    updatedQuests.splice(i, 1);
    await updateLocation({ ...selected, quests: updatedQuests });
  };

  const handleAddNPC = async () => {
    const name = prompt("NPC name:");
    if (!name) return;
    const backstory = prompt("NPC backstory:", "") || "";

    await updateLocation({
      ...selected,
      npcs: [...selected.npcs, { name, backstory }],
    });
  };

  const handleEditNPC = async (i) => {
    const name = prompt("New NPC name:", selected.npcs[i].name);
    if (!name) return;
    const backstory = prompt("New NPC backstory:", selected.npcs[i].backstory);

    const updatedNPCs = [...selected.npcs];
    updatedNPCs[i] = { name, backstory };

    await updateLocation({ ...selected, npcs: updatedNPCs });
  };

  const handleDeleteNPC = async (i) => {
    const updatedNPCs = [...selected.npcs];
    updatedNPCs.splice(i, 1);
    await updateLocation({ ...selected, npcs: updatedNPCs });
  };

  const handleEditLocationDetails = async () => {
    const name = prompt("New location name:", selected.name);
    if (!name) return;
    const description = prompt("New description:", selected.description);

    await updateLocation({ ...selected, name, description });
  };

  return (
    <div className="p-10 relative overflow-hidden">
      <h2 className="text-2xl font-semibold mb-4">Interactive Map</h2>

      <div
        ref={mapRef}
        onClick={handleMapClick}
        className="relative w-full max-w-4xl mx-auto border rounded-xl shadow-lg overflow-hidden cursor-crosshair"
      >
        <img src="/Wmap.jpg" alt="Campaign Map" className="w-full" />

        {locations.map((loc) => (
          <button
  key={loc.id}
  onClick={(e) => {
    e.stopPropagation(); // ← Prevents triggering the map click
    setSelected(loc);
  }}
  className="absolute bg-Interactive rounded-md w-5 h-5 hover:scale-110 transition"
  style={{ top: loc.y, left: loc.x, transform: "translate(-50%, -50%)" }}
  title={loc.name}
/>

        ))}
      </div>

      <AnimatePresence>
        {selected && (
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 h-full w-80 bg-white shadow-2xl p-6 z-50 overflow-y-auto"
          >
            <h3 className="text-xl font-bold mb-2">{selected.name}</h3>
            <p className="text-sm text-gray-700 mb-4">{selected.description}</p>
            <button
              onClick={handleEditLocationDetails}
              className="mb-4 text-sm px-2 py-1 rounded bg-gray-500 text-white hover:bg-gray-600"
            >
              Edit Location Details
            </button>

            <h4 className="text-md font-semibold">Quests</h4>
            <ul className="mb-2 list-disc list-inside text-sm">
              {selected.quests?.length > 0 ? (
                selected.quests.map((q, i) => (
                  <li key={i}>
                    <strong>{q.title}</strong> <span className="text-xs text-gray-500">({q.status})</span>
                    <p className="text-xs italic">{q.description}</p>
                    <div className="text-xs mt-1 flex gap-1">
                      <button onClick={() => handleEditQuest(i)} className="text-blue-600">Edit</button>
                      <button onClick={() => handleDeleteQuest(i)} className="text-red-600">Delete</button>
                    </div>
                  </li>
                ))
              ) : (
                <li className="text-gray-400">No quests</li>
              )}
            </ul>
            <button
              onClick={handleAddQuest}
              className="mb-4 text-sm px-2 py-1 rounded bg-blue-500 text-white hover:bg-blue-600"
            >
              + Add Quest
            </button>

            <h4 className="text-md font-semibold">NPCs</h4>
            <ul className="mb-2 list-disc list-inside text-sm">
              {selected.npcs?.length > 0 ? (
                selected.npcs.map((n, i) => (
                  <li key={i}>
                    <strong>{n.name}</strong>
                    <p className="text-xs italic">{n.backstory}</p>
                    <div className="text-xs mt-1 flex gap-1">
                      <button onClick={() => handleEditNPC(i)} className="text-blue-600">Edit</button>
                      <button onClick={() => handleDeleteNPC(i)} className="text-red-600">Delete</button>
                    </div>
                  </li>
                ))
              ) : (
                <li className="text-gray-400">No known NPCs</li>
              )}
            </ul>
            <button
              onClick={handleAddNPC}
              className="mb-4 text-sm px-2 py-1 rounded bg-purple-500 text-white hover:bg-purple-600"
            >
              + Add NPC
            </button>

            <div className="mt-6 flex gap-2">
              <button
                onClick={() => setSelected(null)}
                className="px-3 py-1 text-sm bg-teal-500 text-white rounded hover:bg-teal-600"
              >
                Close
              </button>
              <button
                onClick={handleDelete}
                className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
              >
                Delete Marker
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );


};
  export default Map;


