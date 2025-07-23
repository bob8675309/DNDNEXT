import dynamic from "next/dynamic";
const MerchantPanel = dynamic(() => import("../components/MerchantPanel"), { ssr: false });

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      <MerchantPanel />
    </div>
  );
}