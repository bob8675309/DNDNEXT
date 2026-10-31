// Legacy deployed encounter profiles omit character_spells.known.
// Reject explicit false while retaining legacy spell display. The server
// independently authorizes the spell assignment before casting.
export function tacticalKnownSpellAssignments(profile) {
  return Array.isArray(profile?.knownSpells)
    ? profile.knownSpells.filter(row => row && typeof row === "object" && row.known !== false)
    : [];
}
export function hasVerifiedKnownSpellAssignment(row) {
  return row != null && row.known === true;
}
