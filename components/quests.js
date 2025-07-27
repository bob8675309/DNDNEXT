// /components/quests.js

export default function QuestCard({ quest }) {
  if (!quest) return null;
  return (
    <div className="bg-[#1c2228] p-4 rounded-xl shadow border border-gray-700 mb-4">
      <div className="font-bold text-lg text-amber-300">{quest.title}</div>
      {quest.description && <div className="text-sm text-gray-200 mb-2">{quest.description}</div>}
      <div className="text-xs text-gray-400 mt-2">
        Status:{" "}
        <span className={quest.completed ? "text-green-400" : "text-yellow-400"}>
          {quest.completed ? "Completed" : "Active"}
        </span>
      </div>
    </div>
  );
}