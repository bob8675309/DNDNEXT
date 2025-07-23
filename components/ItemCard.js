export default function ItemCard({ item }) {
  return (
    <div className="text-white border p-4 rounded bg-zinc-800 shadow">
      <h2 className="text-xl font-bold">{item?.name || "Unknown Item"}</h2>
      <p>{item?.description || "No description"}</p>
    </div>
  );
}
