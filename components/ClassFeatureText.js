import { useMemo } from "react";
import { formatPlayerFacingText } from "../utils/playerFacingText";

const LEVEL_BOILERPLATE = /^\d+(?:st|nd|rd|th)-level\s+[a-z][a-z\s'-]*\s+feature$/i;
const INTERNAL_ABILITY_CODE = /^(?:str|dex|con|int|wis|cha)$/i;
const COMPACT_VISIBLE_SECTIONS = 3;

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

function keepNestedDisclosureLocal(event) {
  event.stopPropagation();
}

function listedItemClick(event, item, onListItemDetail) {
  event.stopPropagation();
  onListItemDetail?.(item);
}

function renderSection(section, index, onListItemDetail) {
  if (section.type === "heading") return <h5 key={`${section.type}-${index}`}>{section.text}</h5>;
  if (section.type === "list") {
    const list = <ul>{section.items.map((item) => <li key={item}>{onListItemDetail ? <button type="button" className="class-feature-text__listed-option" onClick={(event) => listedItemClick(event, item, onListItemDetail)} onKeyDown={keepNestedDisclosureLocal}>{item}</button> : item}</li>)}</ul>;
    return section.items.length > 12 ? (
      <details key={`${section.type}-${index}`} className="class-feature-text__long-list" onClick={keepNestedDisclosureLocal} onKeyDown={keepNestedDisclosureLocal}>
        <summary>View {section.items.length} listed options</summary>
        {list}
      </details>
    ) : <div key={`${section.type}-${index}`} className="class-feature-text__list">{list}</div>;
  }
  return <p key={`${section.type}-${index}`}>{section.text}</p>;
}

export default function ClassFeatureText({ text = "", fallback = "", compact = false, onListItemDetail = null }) {
  const sections = useMemo(() => classFeatureSections(text, fallback), [fallback, text]);
  const visibleSections = compact ? sections.slice(0, COMPACT_VISIBLE_SECTIONS) : sections;
  const hiddenSections = compact ? sections.slice(COMPACT_VISIBLE_SECTIONS) : [];

  return (
    <div className={`class-feature-text ${compact ? "is-compact" : ""}`}>
      {visibleSections.map((section, index) => renderSection(section, index, onListItemDetail))}
      {hiddenSections.length ? (
        <details className="class-feature-text__compact-more" onClick={keepNestedDisclosureLocal} onKeyDown={keepNestedDisclosureLocal}>
          <summary>Full feature rules</summary>
          <div>{hiddenSections.map((section, index) => renderSection(section, index + COMPACT_VISIBLE_SECTIONS, onListItemDetail))}</div>
        </details>
      ) : null}
      <style jsx global>{`
        .class-feature-text{display:grid;gap:.72rem;min-width:0}.class-feature-text>p{margin:0!important;white-space:normal}.class-feature-text>h5{margin:.2rem 0 -.18rem;color:#f1ddff;font-size:.82rem;font-weight:900;letter-spacing:.025em}.class-feature-text ul{columns:2;column-gap:1.5rem;margin:.2rem 0 0;padding-left:1.2rem}.class-feature-text li{break-inside:avoid;margin:0 0 .34rem;color:rgba(255,255,255,.8);font-size:.79rem;line-height:1.45}.class-feature-text__listed-option{display:inline;padding:0;border:0;color:inherit;background:transparent;font:inherit;line-height:inherit;text-align:left;text-decoration:underline;text-decoration-color:rgba(168,108,255,.35);text-underline-offset:2px;cursor:pointer}.class-feature-text__listed-option:hover,.class-feature-text__listed-option:focus-visible{color:#fff;text-decoration-color:#9cece2;outline:none}.class-feature-text__long-list,.class-feature-text__compact-more{padding:.62rem .75rem;border:1px solid rgba(168,108,255,.25);border-radius:.65rem;background:rgba(126,72,199,.07)}.class-feature-text__long-list summary,.class-feature-text__compact-more summary{cursor:pointer;color:#dfc8ff;font-size:.73rem;font-weight:850}.class-feature-text__long-list[open] summary,.class-feature-text__compact-more[open]>summary{margin-bottom:.65rem}.class-feature-text__compact-more>div{display:grid;gap:.6rem}.class-feature-text.is-compact{gap:.56rem}.class-feature-text.is-compact>h5{font-size:.76rem}.class-feature-text.is-compact li{font-size:.72rem}@media(max-width:760px){.class-feature-text ul{columns:1}}
      `}</style>
    </div>
  );
}
