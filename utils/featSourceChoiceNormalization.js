const text = (value) => String(value ?? "").trim();
const norm = (value) => text(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const array = (value) => Array.isArray(value) ? value : [];

export function normalizeFeatSourceChoiceGroups(groups = []) {
  return array(groups).map((group) => {
    if (group?.ownerType !== "feat") return group;
    const featName = norm(group?.metadata?.featName || group?.label);
    const fields = array(group?.fields);
    if (featName !== "skilled" || !fields.some((field) => field?.id === "skills-or-tools")) return group;
    return {
      ...group,
      fields: fields.filter((field) => !(String(field?.id || "").startsWith("skill-") && field?.kind === "skill")),
      metadata: {
        ...(group.metadata || {}),
        normalizedChoiceShape: "skilled-mixed-three",
      },
    };
  });
}
