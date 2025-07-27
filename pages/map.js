// /pages/map.js

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import MapOverlay from "../components/MapOverlay";
import Image from "next/image";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function MapPage() {
  const [merchants, setMerchants] = useState([]);
  const [selectedMerchant, setSelectedMerchant] = useState(null);
  const [overlayOpen, setOverlayOpen] = useState(false);

  useEffect(() => {
    async function fetchMerchants() {
      let { data, error } = await supabase.from("merchants").select("*");
      if (!error && data) {
        // Parse roaming_spot if stored as JSON string
        data = data.map(m =>
          typeof m.roaming_spot === "string"
            ? { ...m, roaming_spot: JSON.parse(m.roaming_spot) }
            : m
        );
        setMerchants(data);
      }
    }
    fetchMerchants();
  }, []);

  function handleMerchantClick(merchant) {
    setSelectedMerchant(merchant);
    setOverlayOpen(true);
  }

  return (
    <div className="relative w-full min-h-screen bg-black flex">
      {/* Map Image */}
      <div className="relative flex-1">
        <Image
          src="/map.png"
          alt="DnD World Map"
          layout="fill"
          objectFit="contain"
          priority
        />
        {/* Merchants */}
        {merchants.map((merchant) =>
          merchant.roaming_spot && merchant.roaming_spot.x !== undefined && merchant.roaming_spot.y !== undefined ? (
            <button
              key={merchant.id}
              className="absolute z-20 group"
              style={{
                left: `${merchant.roaming_spot.x}%`,
                top: `${merchant.roaming_spot.y}%`,
                transform: "translate(-50%, -50%)",
              }}
              onClick={() => handleMerchantClick(merchant)}
              title={merchant.name}
            >
              <span className="flex flex-col items-center">
                <span className="bg-yellow-400 border-2 border-yellow-900 shadow-lg rounded-full p-2 group-hover:scale-110 transition-transform">
                  {merchant.icon ? (
                    <img
                      src={merchant.icon}
                      alt={merchant.name}
                      className="w-7 h-7 rounded-full"
                    />
                  ) : (
                    <span className="text-2xl">🛒</span>
                  )}
                </span>
                <span className="mt-1 text-xs text-yellow-100 drop-shadow font-bold bg-black/70 px-1 rounded">
                  {merchant.name}
                </span>
              </span>
            </button>
          ) : null
        )}
      </div>
      {/* Overlay */}
      <MapOverlay
        open={overlayOpen}
        onClose={() => setOverlayOpen(false)}
        title={selectedMerchant?.name || "Merchant"}
        merchants={selectedMerchant ? [selectedMerchant] : []}
      >
        {selectedMerchant && (
          <div>
            <div className="mb-2 text-sm text-gray-300">
              Location:{" "}
              <span className="font-bold text-yellow-200">
                {selectedMerchant.roaming_spot?.locationName || "Unknown"}
              </span>
            </div>
            <div className="text-xs text-gray-400 font-mono">
              <div className="font-bold text-gray-200 mb-1">Current Wares:</div>
              <ul className="ml-4 list-disc">
                {Array.isArray(selectedMerchant.inventory)
                  ? selectedMerchant.inventory.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))
                  : <li>No items listed.</li>}
              </ul>
            </div>
          </div>
        )}
      </MapOverlay>
    </div>
  );
}
