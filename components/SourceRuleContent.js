import { formatPlayerFacingInline, formatPlayerFacingText } from "../utils/playerFacingText";

const array = (value) => Array.isArray(value) ? value : value == null ? [] : [value];
const safe = (value) => String(value ?? "").trim();
const ABILITY_LABELS = Object.freeze({ str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma" });

function cellText(value) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return formatPlayerFacingInline(value);
  if (Array.isArray(value)) return value.map(cellText).filter(Boolean).join(" • ");
  if (typeof value === "object") {
    if (value.entry != null) return cellText(value.entry);
    if (value.entries != null) return array(value.entries).map(cellText).filter(Boolean).join(" ");
    if (value.name) return formatPlayerFacingInline(value.name);
  }
  return "";
}

function nodeKey(node, index, prefix = "source") {
  if (node && typeof node === "object" && !Array.isArray(node)) return `${prefix}-${safe(node.name || node.caption || node.type || "node")}-${index}`;
  return `${prefix}-${index}`;
}

function referenceValue(node = {}) {
  if (!node || typeof node !== "object") return "";
  if (node.type === "refOptionalfeature") return node.optionalfeature || node.name || "";
  if (node.type === "refClassFeature") return node.classFeature || node.name || "";
  if (node.type === "refSubclassFeature") return node.subclassFeature || node.name || "";
  if (node.type === "refFeat") return node.feat || node.name || "";
  if (node.type === "statblock") return node.name || node.tag || "";
  return "";
}

function referenceLabel(node = {}) {
  const raw = safe(referenceValue(node));
  if (!raw) return "";
  return formatPlayerFacingInline(raw.split("|")[0]);
}

function abilityList(values = []) {
  const labels = array(values).map((value) => ABILITY_LABELS[String(value || "").toLowerCase()] || formatPlayerFacingInline(value)).filter(Boolean);
  if (labels.length < 2) return labels[0] || "ability";
  if (labels.length === 2) return `${labels[0]} or ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, or ${labels.at(-1)}`;
}

function Paragraph({ value }) {
  const text = formatPlayerFacingText(value, "");
  return text ? <p>{text}</p> : null;
}

function SourceTable({ node }) {
  const rows = array(node?.rows);
  if (!rows.length) return null;
  const headers = array(node?.colLabels).map(cellText);
  return <div className="source-rule-content__table-wrap">{node.caption ? <strong className="source-rule-content__caption">{formatPlayerFacingInline(node.caption)}</strong> : null}<table className="source-rule-content__table">{headers.length ? <thead><tr>{headers.map((header, index) => <th key={`${header}-${index}`}>{header || `Column ${index + 1}`}</th>)}</tr></thead> : null}<tbody>{rows.map((row, rowIndex) => <tr key={`row-${rowIndex}`}>{array(row).map((cell, cellIndex) => <td key={`cell-${rowIndex}-${cellIndex}`}>{cellText(cell)}</td>)}</tr>)}</tbody></table>{array(node.footnotes).map((note, index) => <small className="source-rule-content__footnote" key={`footnote-${index}`}>{formatPlayerFacingText(note)}</small>)}</div>;
}

function SourceList({ node, onListItemDetail }) {
  const items = array(node?.items);
  if (!items.length) return null;
  return <div className="source-rule-content__list">{node.name ? <h5>{formatPlayerFacingInline(node.name)}</h5> : null}<ul>{items.map((item, index) => {
    const label = typeof item === "object" && item?.name ? formatPlayerFacingInline(item.name) : "";
    const body = typeof item === "object" ? array(item.entries || item.entry) : [item];
    return <li key={nodeKey(item, index, "list-item")}><div>{label ? <strong>{label}</strong> : null}{label && onListItemDetail ? <button type="button" className="source-rule-content__detail-button" onClick={(event) => { event.stopPropagation(); onListItemDetail(label); }}>Details</button> : null}</div>{body.map((entry, bodyIndex) => <SourceNode node={entry} key={nodeKey(entry, bodyIndex, `list-body-${index}`)} onListItemDetail={onListItemDetail} />)}</li>;
  })}</ul></div>;
}

function SourceReference({ node, onListItemDetail }) {
  const label = referenceLabel(node);
  if (!label) return null;
  const kind = node.type === "statblock" ? "Source entry" : node.type === "refFeat" ? "Feat" : node.type === "refOptionalfeature" ? "Option" : "Feature";
  return <div className="source-rule-content__reference"><span>{kind}</span>{onListItemDetail ? <button type="button" onClick={(event) => { event.stopPropagation(); onListItemDetail(label); }}>{label}</button> : <strong>{label}</strong>}</div>;
}

function SourceFormula({ node }) {
  const abilities = abilityList(node?.attributes);
  const title = formatPlayerFacingInline(node?.name || (node.type === "abilityDc" ? "Save DC" : "Attack Modifier"));
  const formula = node.type === "abilityDc"
    ? `8 + your Proficiency Bonus + your ${abilities} modifier`
    : `your Proficiency Bonus + your ${abilities} modifier`;
  return <div className="source-rule-content__formula"><span>{title}</span><strong>{formula}</strong></div>;
}

function SourceOptions({ node, onListItemDetail }) {
  const children = array(node?.entries ?? node?.items);
  if (!children.length) return null;
  const count = Math.max(1, Number(node?.count || 1));
  return <section className="source-rule-content__options"><div><span>Source choice</span><strong>Choose {count}</strong></div><div>{children.map((child, index) => <SourceNode node={child} key={nodeKey(child, index, "option")} onListItemDetail={onListItemDetail} />)}</div></section>;
}

function SourceQuote({ node, onListItemDetail }) {
  const children = array(node?.entries ?? node?.entry);
  if (!children.length) return null;
  return <blockquote className="source-rule-content__quote">{children.map((child, index) => <SourceNode node={child} key={nodeKey(child, index, "quote")} onListItemDetail={onListItemDetail} />)}{node.by ? <footer>— {formatPlayerFacingInline(node.by)}</footer> : null}</blockquote>;
}

function NamedEntries({ node, onListItemDetail }) {
  const title = formatPlayerFacingInline(node?.name || "");
  const children = array(node?.entries ?? node?.entry ?? node?.items);
  if (!children.length) return title ? <h5>{title}</h5> : null;
  return <section className={`source-rule-content__section ${node.type === "inset" ? "is-inset" : ""}`}>{title ? <h5>{title}</h5> : null}{children.map((child, index) => <SourceNode node={child} key={nodeKey(child, index, "nested")} onListItemDetail={onListItemDetail} />)}</section>;
}

function SourceNode({ node, onListItemDetail }) {
  if (node == null || node === false) return null;
  if (typeof node === "string" || typeof node === "number") return <Paragraph value={node} />;
  if (Array.isArray(node)) return <>{node.map((entry, index) => <SourceNode node={entry} key={nodeKey(entry, index, "array")} onListItemDetail={onListItemDetail} />)}</>;
  if (typeof node !== "object") return null;
  if (node.type === "table" || Array.isArray(node.rows)) return <SourceTable node={node} />;
  if (node.type === "list" && Array.isArray(node.items)) return <SourceList node={node} onListItemDetail={onListItemDetail} />;
  if (["refClassFeature", "refSubclassFeature", "refOptionalfeature", "refFeat", "statblock"].includes(node.type)) return <SourceReference node={node} onListItemDetail={onListItemDetail} />;
  if (["abilityDc", "abilityAttackMod"].includes(node.type)) return <SourceFormula node={node} />;
  if (node.type === "options") return <SourceOptions node={node} onListItemDetail={onListItemDetail} />;
  if (node.type === "quote") return <SourceQuote node={node} onListItemDetail={onListItemDetail} />;
  if (["entries", "inset", "section", "item", "itemSpell"].includes(node.type) || node.name || node.entries || node.entry || node.items) return <NamedEntries node={node} onListItemDetail={onListItemDetail} />;
  return null;
}

export function sourceRuleStructureSummary(entries = []) {
  const summary = { tables: 0, lists: 0, namedSections: 0, paragraphs: 0, references: 0, options: 0, formulas: 0, quotes: 0 };
  function walk(node) {
    if (node == null) return;
    if (typeof node === "string" || typeof node === "number") { summary.paragraphs += 1; return; }
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (typeof node !== "object") return;
    if (node.type === "table" || Array.isArray(node.rows)) summary.tables += 1;
    else if (node.type === "list" && Array.isArray(node.items)) summary.lists += 1;
    else if (["refClassFeature", "refSubclassFeature", "refOptionalfeature", "refFeat", "statblock"].includes(node.type)) summary.references += 1;
    else if (node.type === "options") summary.options += 1;
    else if (["abilityDc", "abilityAttackMod"].includes(node.type)) summary.formulas += 1;
    else if (node.type === "quote") summary.quotes += 1;
    else if (node.name || ["entries", "inset", "section", "item", "itemSpell"].includes(node.type)) summary.namedSections += 1;
    if (node.entries) walk(node.entries);
    if (node.entry) walk(node.entry);
    if (node.items) walk(node.items);
  }
  walk(entries);
  return summary;
}

export default function SourceRuleContent({ entries = null, text = "", fallback = "", onListItemDetail = null }) {
  const structured = entries != null && (Array.isArray(entries) ? entries.length > 0 : true);
  return <div className="source-rule-content">{structured ? <SourceNode node={entries} onListItemDetail={onListItemDetail} /> : <Paragraph value={text || fallback} />}<style jsx global>{`
    .source-rule-content{display:grid;gap:.72rem;min-width:0;color:rgba(255,255,255,.83);font-size:.78rem;line-height:1.62}.source-rule-content p{margin:0;max-width:82ch;white-space:normal}.source-rule-content__section{display:grid;gap:.52rem}.source-rule-content__section>h5,.source-rule-content__list>h5,.source-rule-content__caption{margin:.15rem 0 0;color:#f1ddff;font-size:.78rem;font-weight:900;letter-spacing:.02em}.source-rule-content__section.is-inset{padding:.72rem .82rem;border-left:3px solid rgba(88,214,199,.55);border-radius:.5rem;background:rgba(88,214,199,.055)}.source-rule-content__list ul{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:.55rem;margin:.4rem 0 0;padding:0;list-style:none}.source-rule-content__list li{display:grid;align-content:start;gap:.34rem;padding:.65rem .72rem;border:1px solid rgba(168,108,255,.22);border-radius:.62rem;background:rgba(126,72,199,.055);break-inside:avoid}.source-rule-content__list li>div:first-child{display:flex;align-items:center;justify-content:space-between;gap:.5rem}.source-rule-content__list li strong{color:#fff;font-size:.7rem}.source-rule-content__detail-button{padding:2px 5px;border:1px solid rgba(88,214,199,.32);border-radius:999px;color:#bffaf2;background:rgba(88,214,199,.07);font-size:.52rem}.source-rule-content__table-wrap{display:grid;gap:.4rem;min-width:0;overflow-x:auto}.source-rule-content__table{width:100%;border-collapse:separate;border-spacing:0;min-width:420px;border:1px solid rgba(168,108,255,.2);border-radius:.62rem;overflow:hidden}.source-rule-content__table th,.source-rule-content__table td{padding:.48rem .58rem;border-bottom:1px solid rgba(255,255,255,.075);vertical-align:top;text-align:left}.source-rule-content__table th{color:#eadfff;background:rgba(126,72,199,.15);font-size:.61rem;text-transform:uppercase;letter-spacing:.035em}.source-rule-content__table td{color:rgba(255,255,255,.82);background:rgba(0,0,0,.11);font-size:.7rem}.source-rule-content__table tr:last-child td{border-bottom:0}.source-rule-content__footnote{display:block;color:rgba(255,255,255,.62);font-size:.6rem;line-height:1.45}.source-rule-content__reference,.source-rule-content__formula{display:flex;align-items:center;justify-content:space-between;gap:.6rem;padding:.55rem .65rem;border:1px solid rgba(168,108,255,.2);border-radius:.6rem;background:rgba(126,72,199,.055)}.source-rule-content__reference>span,.source-rule-content__formula>span{color:#9cece2;font-size:.56rem;font-weight:900;letter-spacing:.06em;text-transform:uppercase}.source-rule-content__reference button{padding:0;border:0;color:#f1ddff;background:transparent;font-size:.72rem;font-weight:850;text-align:right;text-decoration:underline;text-decoration-color:rgba(88,214,199,.35);text-underline-offset:2px}.source-rule-content__reference strong,.source-rule-content__formula strong{color:#fff;font-size:.7rem;text-align:right}.source-rule-content__options{display:grid;gap:.5rem;padding:.65rem .7rem;border:1px solid rgba(88,214,199,.24);border-radius:.65rem;background:rgba(88,214,199,.045)}.source-rule-content__options>div:first-child{display:flex;align-items:center;justify-content:space-between;gap:.5rem}.source-rule-content__options>div:first-child span{color:#9cece2;font-size:.56rem;font-weight:900;text-transform:uppercase}.source-rule-content__options>div:first-child strong{color:#fff;font-size:.68rem}.source-rule-content__options>div:last-child{display:grid;gap:.4rem}.source-rule-content__quote{display:grid;gap:.35rem;margin:0;padding:.72rem .82rem;border-left:3px solid rgba(168,108,255,.65);border-radius:.5rem;background:rgba(126,72,199,.06)}.source-rule-content__quote p{font-style:italic}.source-rule-content__quote footer{color:rgba(255,255,255,.6);font-size:.6rem}@media(max-width:760px){.source-rule-content__list ul{grid-template-columns:1fr}.source-rule-content{font-size:.75rem}.source-rule-content__reference,.source-rule-content__formula{align-items:start;flex-direction:column}.source-rule-content__reference strong,.source-rule-content__formula strong{text-align:left}}
  `}</style></div>;
}
