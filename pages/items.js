import dynamic from "next/dynamic";

const ItemList = dynamic(() => import("../components/ItemList"), { ssr: false });

export default function ItemsPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <h1 className="text-3xl font-bold text-center py-8">All Items</h1>
      <ItemList />
    </div>
  );
}

