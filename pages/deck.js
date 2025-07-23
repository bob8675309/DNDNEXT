import dynamic from "next/dynamic";
const ItemDeck = dynamic(() => import("../components/ItemDeck"), { ssr: false });

export default function DeckPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <h1 className="text-3xl font-bold text-center py-8">Random Item Deck</h1>
      <ItemDeck />
    </div>
  );
}