// QuestEditor.js
import React from "react";

export const QuestEditor = ({ quest, onSave, onCancel }) => {
  const [form, setForm] = React.useState({ ...quest });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleObjectivesChange = (e) => {
    setForm((f) => ({ ...f, objectives: e.target.value.split("\n") }));
  };

  const handleSave = () => {
    onSave(form);
  };

  return (
    <div className="space-y-2">
      <input
        name="title"
        value={form.title}
        onChange={handleChange}
        className="w-full p-2 border rounded"
        placeholder="Quest Title"
      />
      <input
        name="status"
        value={form.status}
        onChange={handleChange}
        className="w-full p-2 border rounded"
        placeholder="Status"
      />
      <textarea
        name="description"
        value={form.description || ""}
        onChange={handleChange}
        className="w-full p-2 border rounded"
        placeholder="Description"
      />
      <textarea
        name="objectives"
        value={(form.objectives || []).join("\n")}
        onChange={handleObjectivesChange}
        className="w-full p-2 border rounded"
        placeholder="Objectives (one per line)"
      />
      <input
        name="rewards"
        value={form.rewards || ""}
        onChange={handleChange}
        className="w-full p-2 border rounded"
        placeholder="Rewards"
      />
      <input
        name="giver"
        value={form.giver || ""}
        onChange={handleChange}
        className="w-full p-2 border rounded"
        placeholder="Quest Giver NPC Name"
      />
      <div className="flex gap-2">
        <button onClick={handleSave} className="bg-blue-600 text-white px-4 py-1 rounded">Save</button>
        <button onClick={onCancel} className="bg-gray-500 text-white px-4 py-1 rounded">Cancel</button>
      </div>
    </div>
  );
};
export default QuestPage