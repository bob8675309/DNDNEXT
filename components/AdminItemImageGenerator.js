import { useState } from "react";
import { generateItemImage } from "../utils/generateItemImage";

export default function AdminItemImageGenerator({ item, onImage }) {
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState(item.image);
  const [message, setMessage] = useState("");

  const handleGenerate = async () => {
    setLoading(true);
    setMessage("");
    try {
      const { imageUrl: newUrl, cached } = await generateItemImage(item.name, item.description);
      setImageUrl(newUrl);
      setMessage(cached ? "Loaded existing image." : "Generated new image!");
      if (onImage) onImage(newUrl);
    } catch (e) {
      setMessage("Image generation failed.");
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col gap-2 items-start">
      <div className="w-32 h-32 bg-gray-800 border rounded mb-2 flex items-center justify-center overflow-hidden">
        {imageUrl
          ? <img src={imageUrl} alt={item.name} className="object-contain w-full h-full" />
          : <span className="text-gray-400">No Image</span>}
      </div>
      <button
        onClick={handleGenerate}
        className="bg-blue-700 text-white rounded px-4 py-2 hover:bg-blue-800 disabled:opacity-50"
        disabled={loading}
      >
        {loading ? "Generating..." : "Generate Image"}
      </button>
      {message && <div className="text-xs text-green-400">{message}</div>}
    </div>
  );
}
