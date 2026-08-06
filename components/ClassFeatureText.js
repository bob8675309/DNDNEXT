import { useMemo } from "react";
import { formatPlayerFacingText } from "../utils/playerFacingText";

const LEVEL_BOILERPLATE = /^\d+(?:st|nd|rd|th)-level\s+[a-z][a-z\s'-]*\s+feature$/i;
const INTERNAL_ABILITY_CODE = /^(?:str|dex|con|int|wis|cha)$/i;

export function normalizeClassFeatureText(value, fallback = "") {
  return formatPlayerFacingText(value, fallback)
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function classFeatureInline(value, fallback = "") {
  return normalizeClassFeatureText(value, fallback)
    .replace(/\s*\n+\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function compactLine(value) {
  const text = String(value || "").trim();
  return text.length > 0 && text.length <= 96 && !/[.!?;:]$/.test(text);
}

function headingLine(value, nextValue) {
  const text = String(value || "").trim();
  const next = String(nextValue || "").trim();
  return compactLine(text)
    && text.length <= 72
    && text.split(/\s+/).length <= 10
    && next.length > 0
    && (!compactLine(next) || /[.!?]$/.test(next));
}

export function classFeatureSections(value, fallback = "") {
  const rawBlocks = normalizeClassFeatureText(value, fallback)
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .filter((block) => !LEVEL_BOILERPLATE.test(block) && !INTERNAL_ABILITY_CODE.test(block));

  const blocks = rawBlocks.filter((block, index) => index === 0 || block !== rawBlocks[index - 1]);
  const sections = [];

  for (let index = 0; index < blocks.length;) {
    let listEnd = index;
    while (listEnd < blocks.length && compactLine(blocks[listEnd])) listEnd += 1;
    const listItems = blocks.slice(index, listEnd);

    if (listItems.length >= 4) {
      sections.push({ type: "list", items: listItems });
      index = listEnd;
      continue;
    }

    if (headingLine(blocks[index], blocks[index + 1])) {
      sections.push({ type: "heading", text: blocks[index] });
      index += 1;
      continue;
    }

    sections.push({ type: "paragraph", text: blocks[index] });
    index += 1;
  }

  return sections;
}

export default function ClassFeatureText({ text = "", fallback = "", compact = false }) {
  const sections = useMemo(() => classFeatureSections(text, fallback), [fallback, text]);

  return (
    <div className={`class-feature-text ${compact ? "is-compact" : ""}`}>
      {sections.map((section, index) => {
        if (section.type === "heading") return <h5 key={`${section.type}-${index}`}>{section.text}</h5>;
        if (section.type === "list") {
          const list = <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul>;
          return section.items.length > 12 ? (
            <details key={`${section.type}-${index}`} className="class-feature-text__long-list">
              <summary>View {section.items.length} listed options</summary>
              {list}
            </details>
          ) : <div key={`${section.type}-${index}`} className="class-feature-text__list">{list}</div>;
        }
        return <p key={`${section.type}-${index}`}>{section.text}</p>;
      })}
      <style jsx global>{`
        .class-feature-text{display:grid;gap:.72rem;min-width:0}.class-feature-text>p{margin:0!important;white-space:normal}.class-feature-text>h5{margin:.2rem 0 -.18rem;color:#f1ddff;font-size:.82rem;font-weight:900;letter-spacing:.025em}.class-feature-text ul{columns:2;column-gap:1.5rem;margin:.2rem 0 0;padding-left:1.2rem}.class-feature-text li{break-inside:avoid;margin:0 0 .34rem;color:rgba(255,255,255,.8);font-size:.79rem;line-height:1.45}.class-feature-text__long-list{padding:.62rem .75rem;border:1px solid rgba(168,108,255,.25);border-radius:.65rem;background:rgba(126,72,199,.07)}.class-feature-text__long-list summary{cursor:pointer;color:#dfc8ff;font-size:.73rem;font-weight:850}.class-feature-text__long-list[open] summary{margin-bottom:.65rem}.class-feature-text.is-compact{gap:.56rem}.class-feature-text.is-compact>h5{font-size:.76rem}.class-feature-text.is-compact li{font-size:.72rem}@media(max-width:760px){.class-feature-text ul{columns:1}}
      `}</style>
    </div>
  );
}
