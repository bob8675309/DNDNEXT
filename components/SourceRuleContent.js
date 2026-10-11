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

function referenceFromTag(tag = "", body = "") {
  const parts = safe(body).split("|").map((part) => part.trim());
  const name = parts[0] || "";
  const source = parts[1] || "";
  const display = tag === "quickref" ? name : parts[2] || name;
  if (!name) return null;
  return { kind: tag === "statblock" ? "creature" : tag, name, source, label: formatPlayerFacingInline(display || name) };
}

function KnownRuleText({ value = "", onReferenceDetail = null }) {
  const text = safe(value);
  if (!text || !onReferenceDetail) return text;
  const matcher = /\b(hindered|difficult terrain)\b/gi;
  const nodes = [];
  let cursor = 0;
  let match = matcher.exec(text);
  while (match) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    const label = match[0];
    nodes.push(<button type="button" key={`known-${match.index}-${label}`} className="source-rule-content__inline-reference" onClick={(event) => {
      event.stopPropagation();
      onReferenceDetail({ kind: "rule", name: label, label });
    }}>{label}</button>);
    cursor = match.index + label.length;
    match = matcher.exec(text);
  }
  if (!nodes.length) return text;
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return <>{nodes}</>;
}

function InlineRuleText({ value, onReferenceDetail = null }) {
  const raw = safe(value);
  if (!raw) return null;
  if (!onReferenceDetail || !raw.includes("{@")) {
    const formatted = formatPlayerFacingText(raw, "");
    return <KnownRuleText value={formatted} onReferenceDetail={onReferenceDetail} />;
  }
  const matcher = /\{@(condition|creature|quickref|action)\s+([^}]+)\}/gi;
  const nodes = [];
  let cursor = 0;
  let match = matcher.exec(raw);
  while (match) {
    if (match.index > cursor) {
      const formatted = formatPlayerFacingText(raw.slice(cursor, match.index), "");
      if (formatted) nodes.push(<KnownRuleText key={`text-${cursor}`} value={formatted} onReferenceDetail={onReferenceDetail} />);
    }
    const reference = referenceFromTag(match[1].toLowerCase(), match[2]);
    if (reference) {
      nodes.push(<button type="button" key={`ref-${match.index}-${reference.name}`} className="source-rule-content__inline-reference" onClick={(event) => {
        event.stopPropagation();
        onReferenceDetail(reference);
      }}>{reference.label}</button>);
    }
    cursor = match.index + match[0].length;
    match = matcher.exec(raw);
  }
  if (cursor < raw.length) {
    const formatted = formatPlayerFacingText(raw.slice(cursor), "");
    if (formatted) nodes.push(<KnownRuleText key={`text-${cursor}`} value={formatted} onReferenceDetail={onReferenceDetail} />);
  }
  return nodes.length ? <>{nodes}</> : <KnownRuleText value={formatPlayerFacingText(raw, "")} onReferenceDetail={onReferenceDetail} />;
}

function Paragraph({ value, onReferenceDetail = null }) {
  const text = safe(value);
  return text ? <p><InlineRuleText value={text} onReferenceDetail={onReferenceDetail} /></p> : null;
}

function disclosureLabel(value = "") {
  const text = formatPlayerFacingInline(value).replace(/[:.]\s*$/, "").trim();
  if (/one of the following/i.test(text)) return "Options";
  if (/following effects/i.test(text)) return "Effects";
  if (/following benefits/i.test(text)) return "Benefits";
  return text || "Details";
}

function SourceTable({ node }) {
  const rows = array(node?.rows);
  if (!rows.length) return null;
  const headers = array(node?.colLabels).map(cellText);
  return <div className="source-rule-content__table-wrap">{node.caption ? <strong className="source-rule-content__caption">{formatPlayerFacingInline(node.caption)}</strong> : null}<table className="source-rule-content__table">{headers.length ? <thead><tr>{headers.map((header, index) => <th key={`${header}-${index}`}>{header || `Column ${index + 1}`}</th>)}</tr></thead> : null}<tbody>{rows.map((row, rowIndex) => <tr key={`row-${rowIndex}`}>{array(row).map((cell, cellIndex) => <td key={`cell-${rowIndex}-${cellIndex}`}>{cellText(cell)}</td>)}</tr>)}</tbody></table>{array(node.footnotes).map((note, index) => <small className="source-rule-content__footnote" key={`footnote-${index}`}>{formatPlayerFacingText(note)}</small>)}</div>;
}

function SourceList({ node, onListItemDetail, onReferenceDetail, digital = false, summaryLabel = "" }) {
  const items = array(node?.items);
  if (!items.length) return null;
  const namedItems = items.filter((item) => typeof item === "object" && safe(item?.name));

  if (digital && namedItems.length) {
    return <div className="source-rule-content__disclosure-list">{items.map((item, index) => {
      const label = typeof item === "object" && item?.name ? formatPlayerFacingInline(item.name) : `Detail ${index + 1}`;
      const body = typeof item === "object" ? array(item.entries || item.entry) : [item];
      return <details className="source-rule-content__disclosure" key={nodeKey(item, index, "list-disclosure")}>
        <summary><span>{label}</span></summary>
        <div className="source-rule-content__disclosure-body">{body.map((entry, bodyIndex) => <SourceNode node={entry} key={nodeKey(entry, bodyIndex, `list-body-${index}`)} onListItemDetail={onListItemDetail} onReferenceDetail={onReferenceDetail} digital={digital} />)}</div>
      </details>;
    })}</div>;
  }

  const list = <div className="source-rule-content__list">{node.name ? <h5>{formatPlayerFacingInline(node.name)}</h5> : null}<ul>{items.map((item, index) => {
    const label = typeof item === "object" && item?.name ? formatPlayerFacingInline(item.name) : "";
    const body = typeof item === "object" ? array(item.entries || item.entry) : [item];
    return <li key={nodeKey(item, index, "list-item")}><div>{label ? <strong>{label}</strong> : null}{label && onListItemDetail ? <button type="button" className="source-rule-content__detail-button" onClick={(event) => { event.stopPropagation(); onListItemDetail(label); }}>Details</button> : null}</div>{body.map((entry, bodyIndex) => <SourceNode node={entry} key={nodeKey(entry, bodyIndex, `list-body-${index}`)} onListItemDetail={onListItemDetail} onReferenceDetail={onReferenceDetail} digital={digital} />)}</li>;
  })}</ul></div>;

  if (!digital) return list;
  return <details className="source-rule-content__disclosure source-rule-content__disclosure--list">
    <summary><span>{summaryLabel || formatPlayerFacingInline(node.name || "Effects")}</span><small>{items.length} items</small></summary>
    <div className="source-rule-content__disclosure-body">{list}</div>
  </details>;
}

function SourceReference({ node, onListItemDetail, onReferenceDetail }) {
  const label = referenceLabel(node);
  if (!label) return null;
  const kind = node.type === "statblock" ? "Source entry" : node.type === "refFeat" ? "Feat" : node.type === "refOptionalfeature" ? "Option" : "Feature";
  const raw = safe(referenceValue(node));
  const source = raw.split("|")[1] || "";
  const click = onReferenceDetail
    ? () => onReferenceDetail({ kind: node.type === "statblock" ? "creature" : "feature", name: raw.split("|")[0] || label, source, label })
    : onListItemDetail ? () => onListItemDetail(label) : null;
  return <div className="source-rule-content__reference"><span>{kind}</span>{click ? <button type="button" onClick={(event) => { event.stopPropagation(); click(); }}>{label}</button> : <strong>{label}</strong>}</div>;
}

function SourceFormula({ node }) {
  const abilities = abilityList(node?.attributes);
  const title = formatPlayerFacingInline(node?.name || (node.type === "abilityDc" ? "Save DC" : "Attack Modifier"));
  const formula = node.type === "abilityDc"
    ? `8 + your Proficiency Bonus + your ${abilities} modifier`
    : `your Proficiency Bonus + your ${abilities} modifier`;
  return <div className="source-rule-content__formula"><span>{title}</span><strong>{formula}</strong></div>;
}

function SourceOptions({ node, onListItemDetail, onReferenceDetail, digital = false }) {
  const children = array(node?.entries ?? node?.items);
  if (!children.length) return null;
  const count = Math.max(1, Number(node?.count || 1));
  return <section className="source-rule-content__options"><div><span>Source choice</span><strong>Choose {count}</strong></div><div>{children.map((child, index) => <SourceNode node={child} key={nodeKey(child, index, "option")} onListItemDetail={onListItemDetail} onReferenceDetail={onReferenceDetail} digital={digital} />)}</div></section>;
}

function SourceQuote({ node, onListItemDetail, onReferenceDetail, digital = false }) {
  const children = array(node?.entries ?? node?.entry);
  if (!children.length) return null;
  return <blockquote className="source-rule-content__quote">{children.map((child, index) => <SourceNode node={child} key={nodeKey(child, index, "quote")} onListItemDetail={onListItemDetail} onReferenceDetail={onReferenceDetail} digital={digital} />)}{node.by ? <footer>— {formatPlayerFacingInline(node.by)}</footer> : null}</blockquote>;
}

function NamedEntries({ node, onListItemDetail, onReferenceDetail, digital = false }) {
  const title = formatPlayerFacingInline(node?.name || "");
  const children = array(node?.entries ?? node?.entry ?? node?.items);
  if (!children.length) return title ? <h5>{title}</h5> : null;
  if (digital && title && node.type !== "inset") {
    return <details className="source-rule-content__disclosure">
      <summary><span>{title}</span></summary>
      <div className="source-rule-content__disclosure-body">{children.map((child, index) => <SourceNode node={child} key={nodeKey(child, index, "nested")} onListItemDetail={onListItemDetail} onReferenceDetail={onReferenceDetail} digital={digital} />)}</div>
    </details>;
  }
  return <section className={`source-rule-content__section ${node.type === "inset" ? "is-inset" : ""}`}>{title ? <h5>{title}</h5> : null}{children.map((child, index) => <SourceNode node={child} key={nodeKey(child, index, "nested")} onListItemDetail={onListItemDetail} onReferenceDetail={onReferenceDetail} digital={digital} />)}</section>;
}

function SourceSequence({ nodes = [], onListItemDetail, onReferenceDetail, digital = false }) {
  const values = array(nodes);
  const plainParagraphs = digital && values.length >= 4 && values.every((entry) => typeof entry === "string" || typeof entry === "number");
  if (plainParagraphs) {
    return <>{values.slice(0, 2).map((entry, index) => <Paragraph value={entry} key={nodeKey(entry, index, "lead")} onReferenceDetail={onReferenceDetail} />)}
      <details className="source-rule-content__disclosure source-rule-content__disclosure--continuation">
        <summary><span>Additional rules</span><small>{values.length - 2} sections</small></summary>
        <div className="source-rule-content__disclosure-body">{values.slice(2).map((entry, index) => <Paragraph value={entry} key={nodeKey(entry, index, "continuation")} onReferenceDetail={onReferenceDetail} />)}</div>
      </details>
    </>;
  }
  const output = [];
  for (let index = 0; index < values.length; index += 1) {
    const entry = values[index];
    const next = values[index + 1];
    if (digital && typeof entry === "string" && next?.type === "list" && Array.isArray(next.items) && /(?:one of the following|following effects|following benefits)\s*:?\s*$/i.test(formatPlayerFacingText(entry, ""))) {
      output.push(<SourceList node={next} key={nodeKey(next, index + 1, "paired-list")} onListItemDetail={onListItemDetail} onReferenceDetail={onReferenceDetail} digital summaryLabel={disclosureLabel(entry)} />);
      index += 1;
      continue;
    }
    output.push(<SourceNode node={entry} key={nodeKey(entry, index, "sequence")} onListItemDetail={onListItemDetail} onReferenceDetail={onReferenceDetail} digital={digital} />);
  }
  return <>{output}</>;
}

function SourceNode({ node, onListItemDetail, onReferenceDetail, digital = false }) {
  if (node == null || node === false) return null;
  if (typeof node === "string" || typeof node === "number") return <Paragraph value={node} onReferenceDetail={onReferenceDetail} />;
  if (Array.isArray(node)) return <SourceSequence nodes={node} onListItemDetail={onListItemDetail} onReferenceDetail={onReferenceDetail} digital={digital} />;
  if (typeof node !== "object") return null;
  if (node.type === "table" || Array.isArray(node.rows)) return <SourceTable node={node} />;
  if (node.type === "list" && Array.isArray(node.items)) return <SourceList node={node} onListItemDetail={onListItemDetail} onReferenceDetail={onReferenceDetail} digital={digital} />;
  if (["refClassFeature", "refSubclassFeature", "refOptionalfeature", "refFeat", "statblock"].includes(node.type)) return <SourceReference node={node} onListItemDetail={onListItemDetail} onReferenceDetail={onReferenceDetail} />;
  if (["abilityDc", "abilityAttackMod"].includes(node.type)) return <SourceFormula node={node} />;
  if (node.type === "options") return <SourceOptions node={node} onListItemDetail={onListItemDetail} onReferenceDetail={onReferenceDetail} digital={digital} />;
  if (node.type === "quote") return <SourceQuote node={node} onListItemDetail={onListItemDetail} onReferenceDetail={onReferenceDetail} digital={digital} />;
  if (["entries", "inset", "section", "item", "itemSpell"].includes(node.type) || node.name || node.entries || node.entry || node.items) return <NamedEntries node={node} onListItemDetail={onListItemDetail} onReferenceDetail={onReferenceDetail} digital={digital} />;
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

export default function SourceRuleContent({ entries = null, text = "", fallback = "", onListItemDetail = null, onReferenceDetail = null, digital = false }) {
  const structured = entries != null && (Array.isArray(entries) ? entries.length > 0 : true);
  return <div className={`source-rule-content ${digital ? "is-digital" : ""}`}>{structured ? <SourceNode node={entries} onListItemDetail={onListItemDetail} onReferenceDetail={onReferenceDetail} digital={digital} /> : <Paragraph value={text || fallback} onReferenceDetail={onReferenceDetail} />}<style jsx global>{`
    .source-rule-content{display:grid;gap:.72rem;min-width:0;color:rgba(255,255,255,.83);font-size:.78rem;line-height:1.62}.source-rule-content p{margin:0;max-width:82ch;white-space:normal}.source-rule-content__section{display:grid;gap:.52rem}.source-rule-content__section>h5,.source-rule-content__list>h5,.source-rule-content__caption{margin:.15rem 0 0;color:#f1ddff;font-size:.78rem;font-weight:900;letter-spacing:.02em}.source-rule-content__section.is-inset{padding:.72rem .82rem;border-left:3px solid rgba(88,214,199,.55);border-radius:.5rem;background:rgba(88,214,199,.055)}.source-rule-content__list ul{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:.55rem;margin:.4rem 0 0;padding:0;list-style:none}.source-rule-content__list li{display:grid;align-content:start;gap:.34rem;padding:.65rem .72rem;border:1px solid rgba(168,108,255,.22);border-radius:.62rem;background:rgba(126,72,199,.055);break-inside:avoid}.source-rule-content__list li>div:first-child{display:flex;align-items:center;justify-content:space-between;gap:.5rem}.source-rule-content__list li strong{color:#fff;font-size:.7rem}.source-rule-content__detail-button{padding:2px 5px;border:1px solid rgba(88,214,199,.32);border-radius:999px;color:#bffaf2;background:rgba(88,214,199,.07);font-size:.52rem}.source-rule-content__table-wrap{display:grid;gap:.4rem;min-width:0;overflow-x:auto}.source-rule-content__table{width:100%;border-collapse:separate;border-spacing:0;min-width:420px;border:1px solid rgba(168,108,255,.2);border-radius:.62rem;overflow:hidden}.source-rule-content__table th,.source-rule-content__table td{padding:.48rem .58rem;border-bottom:1px solid rgba(255,255,255,.075);vertical-align:top;text-align:left}.source-rule-content__table th{color:#eadfff;background:rgba(126,72,199,.15);font-size:.61rem;text-transform:uppercase;letter-spacing:.035em}.source-rule-content__table td{color:rgba(255,255,255,.82);background:rgba(0,0,0,.11);font-size:.7rem}.source-rule-content__table tr:last-child td{border-bottom:0}.source-rule-content__footnote{display:block;color:rgba(255,255,255,.62);font-size:.6rem;line-height:1.45}.source-rule-content__reference,.source-rule-content__formula{display:flex;align-items:center;justify-content:space-between;gap:.6rem;padding:.55rem .65rem;border:1px solid rgba(168,108,255,.2);border-radius:.6rem;background:rgba(126,72,199,.055)}.source-rule-content__reference>span,.source-rule-content__formula>span{color:#9cece2;font-size:.56rem;font-weight:900;letter-spacing:.06em;text-transform:uppercase}.source-rule-content__reference button{padding:0;border:0;color:#f1ddff;background:transparent;font-size:.72rem;font-weight:850;text-align:right;text-decoration:underline;text-decoration-color:rgba(88,214,199,.35);text-underline-offset:2px}.source-rule-content__reference strong,.source-rule-content__formula strong{color:#fff;font-size:.7rem;text-align:right}.source-rule-content__options{display:grid;gap:.5rem;padding:.65rem .7rem;border:1px solid rgba(88,214,199,.24);border-radius:.65rem;background:rgba(88,214,199,.045)}.source-rule-content__options>div:first-child{display:flex;align-items:center;justify-content:space-between;gap:.5rem}.source-rule-content__options>div:first-child span{color:#9cece2;font-size:.56rem;font-weight:900;text-transform:uppercase}.source-rule-content__options>div:first-child strong{color:#fff;font-size:.68rem}.source-rule-content__options>div:last-child{display:grid;gap:.4rem}.source-rule-content__quote{display:grid;gap:.35rem;margin:0;padding:.72rem .82rem;border-left:3px solid rgba(168,108,255,.65);border-radius:.5rem;background:rgba(126,72,199,.06)}.source-rule-content__quote p{font-style:italic}.source-rule-content__quote footer{color:rgba(255,255,255,.6);font-size:.6rem}.source-rule-content__inline-reference{display:inline;padding:0;border:0;border-bottom:1px dotted rgba(111,235,220,.62);color:#bffaf2;background:transparent;font:inherit;font-weight:800;line-height:inherit;cursor:pointer;text-align:left}.source-rule-content__inline-reference:hover,.source-rule-content__inline-reference:focus-visible{color:#fff4bf;border-bottom-color:#ffe09a;outline:none}.source-rule-content__disclosure-list{display:grid;gap:.34rem}.source-rule-content__disclosure{overflow:hidden;border:1px solid rgba(168,108,255,.2);border-radius:.52rem;background:rgba(126,72,199,.035)}.source-rule-content__disclosure>summary{display:flex;align-items:center;gap:.48rem;padding:.45rem .55rem;list-style:none;cursor:pointer;color:#f1ddff;font-size:.72rem;font-weight:900}.source-rule-content__disclosure>summary::-webkit-details-marker{display:none}.source-rule-content__disclosure>summary::before{content:"›";flex:0 0 auto;color:#b98cff;font-size:.95rem;line-height:1;transition:transform .14s ease}.source-rule-content__disclosure[open]>summary::before{transform:rotate(90deg)}.source-rule-content__disclosure>summary>span{margin-right:auto}.source-rule-content__disclosure>summary>small{color:rgba(255,255,255,.45);font-size:.55rem;font-weight:700}.source-rule-content__disclosure-body{display:grid;gap:.5rem;padding:.1rem .58rem .58rem;border-top:1px solid rgba(255,255,255,.06)}.source-rule-content__disclosure-body>.source-rule-content__list ul{margin-top:.45rem}.source-rule-content__disclosure--list .source-rule-content__list li{background:rgba(255,255,255,.018)}@media(max-width:760px){.source-rule-content__list ul{grid-template-columns:1fr}.source-rule-content{font-size:.75rem}.source-rule-content__reference,.source-rule-content__formula{align-items:start;flex-direction:column}.source-rule-content__reference strong,.source-rule-content__formula strong{text-align:left}}@media print{.source-rule-content{color:#111!important;font-size:10pt!important;line-height:1.4!important}.source-rule-content__inline-reference{color:#111!important;border:0!important;font-weight:700!important}.source-rule-content__disclosure{overflow:visible!important;border-color:#bbb!important;background:transparent!important;break-inside:avoid}.source-rule-content__disclosure>summary{color:#111!important;padding:.25rem 0!important}.source-rule-content__disclosure>summary::before{display:none!important}.source-rule-content__disclosure>summary>small{color:#555!important}.source-rule-content__disclosure:not([open])>.source-rule-content__disclosure-body,.source-rule-content__disclosure>.source-rule-content__disclosure-body{display:grid!important;border-top:1px solid #ccc!important}.source-rule-content__list li,.source-rule-content__section.is-inset,.source-rule-content__options,.source-rule-content__quote{color:#111!important;background:transparent!important;border-color:#bbb!important}}
  `}</style></div>;
}
