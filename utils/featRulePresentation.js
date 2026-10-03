import { formatPlayerFacingText } from "./playerFacingText";

function headingWords(value = "") {
  return String(value || "").trim().replace(/[.:]$/, "").split(/\s+/).filter(Boolean);
}

function looksLikeRuleHeading(value = "") {
  const trimmed = String(value || "").trim().replace(/[.:]$/, "");
  const words = headingWords(trimmed);
  if (!trimmed || words.length > 8 || trimmed.length > 56) return false;
  if (/[,;!?]/.test(trimmed)) return false;
  if (/^(you|your|when|while|if|once|after|before|whenever|the creature|a creature|this|these|that|as you|until)\b/i.test(trimmed)) return false;

  const significant = words.filter((word) => /[A-Za-z]/.test(word));
  if (!significant.length) return false;
  const titleLike = significant.filter((word) => /^[A-Z0-9][A-Za-z0-9'’/-]*$/.test(word) || /^(of|the|and|or|to|a|an|in|on|for|with)$/i.test(word));
  return titleLike.length / significant.length >= 0.8;
}

export function featRuleSectionsFromDescription(description = "") {
  const formatted = formatPlayerFacingText(description || "", "").trim();
  if (!formatted) return [{ title: "Rules", body: "No source description is available for this feat." }];

  const paragraphs = formatted.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const sections = [];
  const prose = [];

  function flushProse() {
    if (!prose.length) return;
    sections.push({ title: "", body: prose.join("\n\n"), intro: sections.length === 0 });
    prose.length = 0;
  }

  for (let index = 0; index < paragraphs.length; index += 1) {
    const paragraph = paragraphs[index];

    const standalone = paragraph.match(/^(.{2,56}?)[.:]$/);
    if (standalone && looksLikeRuleHeading(standalone[1]) && paragraphs[index + 1]) {
      flushProse();
      sections.push({ title: standalone[1].trim(), body: paragraphs[index + 1].trim(), intro: false });
      index += 1;
      continue;
    }

    if (!/[.!?:;]$/.test(paragraph) && looksLikeRuleHeading(paragraph) && paragraphs[index + 1]) {
      flushProse();
      sections.push({ title: paragraph, body: paragraphs[index + 1].trim(), intro: false });
      index += 1;
      continue;
    }

    const inline = paragraph.match(/^([^.!?]{2,56})\.\s+([\s\S]+)$/);
    if (inline && looksLikeRuleHeading(inline[1])) {
      flushProse();
      sections.push({ title: inline[1].trim(), body: inline[2].trim(), intro: false });
      continue;
    }

    prose.push(paragraph);
  }

  flushProse();
  return sections.length ? sections : [{ title: "", body: formatted, intro: true }];
}
