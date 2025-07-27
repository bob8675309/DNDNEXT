export async function generateItemImage(itemName, itemDescription) {
  const response = await fetch("/api/gen-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itemName, itemDescription }),
  });
  if (!response.ok) throw new Error("Image generation failed");
  return await response.json(); // { imageUrl, cached }
}