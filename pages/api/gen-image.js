export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  try {
    const { itemName, itemDescription } = req.body;
    if (!itemName || !itemDescription) {
      res.status(400).json({ error: "Missing itemName or itemDescription" });
      return;
    }

    const prompt = `Fantasy D&D item illustration: ${itemName}. Description: ${itemDescription}`;

    // 1. Call HuggingFace Stable Diffusion Space API (public, no API key needed)
    const apiRes = await fetch(
      "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2-1",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: prompt }),
      }
    );

    // The response is a binary image; we'll have to convert it to a base64 string for use
    if (!apiRes.ok) {
      res.status(500).json({ error: "Failed to generate image" });
      return;
    }

    const arrayBuffer = await apiRes.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const imageUrl = `data:image/png;base64,${base64}`;

    // (Optional) Store in Supabase as before (using imageUrl as a base64 data URL)
    // await supabase.from("ai_item_images").insert([
    //   { item_name: itemName, prompt, image_url: imageUrl }
    // ]);

    res.status(200).json({ imageUrl });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
}
