/**
 * The spell/source formatter trims each text segment independently. When an
 * inline {@condition ...} / {@action ...} tag separates prose, JSX must insert
 * real whitespace before and after its button. CSS margins alone don't create
 * word boundaries in copied/selected text.
 */
export function referenceTagBoundarySpacing(raw = "", tagStart = 0, tagLength = 0) {
  const text = String(raw ?? "");
  const start = Math.max(0, Number(tagStart) || 0);
  const end = start + Math.max(0, Number(tagLength) || 0);
  const preceding = text.slice(0, start);
  const following = text.slice(end);
  // Restore an explicit source space, or split glued-up prose. Never inject
  // spaces inside parenthesis/bracket/quote boundaries or before punctuation.
  const before = /[\p{L}\p{N}\s]$/u.test(preceding);
  const after = /^[\p{L}\p{N}\s]/u.test(following)
    || /^\{@(?:condition|creature|quickref|action)\s/i.test(following);
  return { before, after };
}
