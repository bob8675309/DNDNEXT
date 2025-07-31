import {
  UserGroupIcon,
  BookOpenIcon,
  SparklesIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  MapPinIcon
} from "@heroicons/react/24/outline";
import Link from "next/link";

export default function LocationSideBar({ open, location, onClose, isAdmin }) {
  if (!open || !location) return null;

  const npcs = location.npcs || [];
  const quests = location.quests || [];

  const npcIconMap = {
    UserGroupIcon: <UserGroupIcon className="w-6 h-6 text-amber-800 mr-2" />,
    SparklesIcon: <SparklesIcon className="w-6 h-6 text-emerald-700 mr-2" />,
    default: <UserGroupIcon className="w-6 h-6 text-gray-700 mr-2" />,
  };

  const questStatus = {
    Active: <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 inline mr-1" />,
    Complete: <CheckCircleIcon className="w-5 h-5 text-green-600 inline mr-1" />,
    Failed: <XCircleIcon className="w-5 h-5 text-red-600 inline mr-1" />,
  };

  return (
    <aside
  className="fixed top-0 right-0 h-full w-[400px] max-w-full bg-amber-100 bg-opacity-95 shadow-2xl z-40 border-l-4 border-yellow-700 flex flex-col p-6 font-serif"
  style={{ transition: "all 0.3s" }}>

      style={{
        transition: "all 0.3s",
      }}
      {/* Close Button */}
      <button
        className="absolute top-3 right-5 text-2xl text-yellow-900 hover:text-red-600 transition-colors"
        onClick={onClose}
        title="Close panel"
      >
        &times;
      </button>

      {/* Location Name */}
      <div className="flex items-center mb-3">
        <h2 className="text-3xl font-extrabold tracking-wide text-yellow-900 drop-shadow-md">
          {location.name}
        </h2>
      </div>

      {/* Lore/Description */}
      <div className="mb-6 px-2">
        <p className="italic text-yellow-900 text-lg drop-shadow-sm">{location.description}</p>
      </div>

      <hr className="border-yellow-700 mb-4" />

      {/* Notable NPCs */}
      <div className="mb-6">
        <div className="flex items-center mb-2">
          <UserGroupIcon className="w-6 h-6 text-yellow-800 mr-2" />
          <span className="font-bold text-xl text-yellow-800">Notable NPCs</span>
        </div>
        <ul className="space-y-2 pl-2">
          {npcs.map((npc) => (
            <li key={npc.id} className="flex items-center">
              {npcIconMap[npc.icon] || npcIconMap.default}
              <Link href={`/npc/${npc.id}`}>
                <a className="text-lg text-amber-900 font-semibold hover:text-emerald-700 underline transition-all flex flex-col">
                  {npc.name}
                  <span className="text-xs text-yellow-900 font-normal">
                    {npc.race} {npc.role && `— ${npc.role}`}
                  </span>
                </a>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <hr className="border-yellow-700 mb-4" />

      {/* Quests */}
      <div>
        <div className="flex items-center mb-2">
          <BookOpenIcon className="w-6 h-6 text-yellow-800 mr-2" />
          <span className="font-bold text-xl text-yellow-800">Quests</span>
        </div>
        <ul className="space-y-2 pl-2">
          {quests.map((quest) => (
            <li key={quest.id} className="flex items-center">
              {questStatus[quest.status] || <ExclamationTriangleIcon className="w-5 h-5 text-gray-500 mr-1" />}
              <span className="text-lg text-amber-900 font-semibold">{quest.name}</span>
              <span
                className={`ml-2 px-2 py-0.5 rounded text-xs font-bold 
                  ${
                    quest.status === "Active"
                      ? "bg-yellow-200 text-yellow-800"
                      : quest.status === "Complete"
                      ? "bg-green-200 text-green-800"
                      : quest.status === "Failed"
                      ? "bg-red-200 text-red-800"
                      : "bg-gray-100 text-gray-700"
                  }
                `}
              >
                {quest.status}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
