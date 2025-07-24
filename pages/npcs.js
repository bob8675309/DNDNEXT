import dynamic from "next/dynamic";
const NpcEditor = dynamic(() => import("../components/npcs"), { ssr: false });

export default function NPCPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <h1 className="text-3xl font-bold text-center mb-6">NPC Editor</h1>
      <NpcEditor />
    </div>
  );
}