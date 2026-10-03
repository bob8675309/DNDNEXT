import { formatPlayerFacingText } from "./playerFacingText";

export function featRuleSectionsFromDescription(description = "") {
  const formatted = formatPlayerFacingText(description || "", "").trim();
  if (!formatted) return [{ title: "Rules", body: "No source description is available for this feat." }];

  const paragraphs = formatted.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const sections = [];

  for (let index = 0; index < paragraphs.length; index += 1) {
    const paragraph = paragraphs[index];
    const standaloneHeading = paragraph.match(/^([^.!?]{2,56})\.$/);
    const plainHeading = !/[.!?:;]$/.test(paragraph)
      && paragraph.length <= 56
      && paragraph.split(/\s+/).length <= 8
      && paragraphs[index + 1];
    if ((standaloneHeading || plainHeading) && paragraphs[index + 1]) {
      sections.push({ title: (standaloneHeading?.[1] || paragraph).trim(), body: paragraphs[index + 1].trim(), intro: false });
      index += 1;
      continue;
    }

    const inlineHeading = paragraph.match(/^([^.!?]{2,56})\.\s+([\s\S]+)$/);
    if (inlineHeading) {
      sections.push({ title: inlineHeading[1].trim(), body: inlineHeading[2].trim(), intro: false });
      continue;
    }

    const intro = sections.length === 0 && /^(you gain|you have|you learn|you receive|the following|when you|while you|your)/i.test(paragraph);
    sections.push({ title: "", body: paragraph, intro });
  }

  return sections;
}
