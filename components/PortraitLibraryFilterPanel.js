import { useMemo } from "react";
import { portraitFacetOptions, titlePortraitFacet } from "../utils/portraitLibraryFilters";

function optionButtons(options, selected, onSelect) {
  return (
    <div className="portrait-filter-options">
      <button type="button" className={!selected ? "is-active" : ""} onClick={() => onSelect("")}>All</button>
      {options.map((value) => (
        <button
          key={value}
          type="button"
          className={selected === value ? "is-active" : ""}
          onClick={() => onSelect(value)}
        >
          {titlePortraitFacet(value)}
        </button>
      ))}
    </div>
  );
}

export default function PortraitLibraryFilterPanel({
  rows = [],
  filters,
  onChange,
  compact = false,
  showAssignment = true,
}) {
  const facets = useMemo(() => portraitFacetOptions(rows), [rows]);
  const patch = (next) => onChange?.({ ...filters, ...next });
  const hasFilters = Boolean(
    filters?.species
    || filters?.profession
    || filters?.theme
    || filters?.merchantOnly
    || (showAssignment && filters?.assignment && filters.assignment !== "all")
  );

  return (
    <aside className={`portrait-filter-panel ${compact ? "is-compact" : ""}`}>
      <div className="portrait-filter-quick">
        <button
          type="button"
          className={!hasFilters ? "is-active" : ""}
          onClick={() => patch({ species: "", profession: "", theme: "", merchantOnly: false, assignment: "all" })}
        >
          All portraits
        </button>
        <button
          type="button"
          className={filters?.merchantOnly ? "is-active" : ""}
          onClick={() => patch({ merchantOnly: !filters?.merchantOnly })}
        >
          Merchant-friendly
        </button>
        {showAssignment ? (
          <button
            type="button"
            className={filters?.assignment === "unassigned" ? "is-active" : ""}
            onClick={() => patch({ assignment: filters?.assignment === "unassigned" ? "all" : "unassigned" })}
          >
            Unassigned
          </button>
        ) : null}
      </div>

      <details open={!compact || Boolean(filters?.species)}>
        <summary>Species {filters?.species ? <b>{titlePortraitFacet(filters.species)}</b> : null}</summary>
        {optionButtons(facets.species, filters?.species || "", (species) => patch({ species }))}
      </details>

      <details open={!compact || Boolean(filters?.profession)}>
        <summary>Role / profession {filters?.profession ? <b>{titlePortraitFacet(filters.profession)}</b> : null}</summary>
        {optionButtons(facets.professions, filters?.profession || "", (profession) => patch({ profession }))}
      </details>

      <details open={!compact || Boolean(filters?.theme)}>
        <summary>Theme {filters?.theme ? <b>{titlePortraitFacet(filters.theme)}</b> : null}</summary>
        {optionButtons(facets.themes, filters?.theme || "", (theme) => patch({ theme }))}
      </details>

      {showAssignment ? (
        <details open={!compact || filters?.assignment !== "all"}>
          <summary>Assignment {filters?.assignment !== "all" ? <b>{titlePortraitFacet(filters.assignment)}</b> : null}</summary>
          <div className="portrait-filter-options">
            {[
              ["all", "All"],
              ["unassigned", "Unassigned"],
              ["assigned", "Assigned"],
              ["current", "Current"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={filters?.assignment === value ? "is-active" : ""}
                onClick={() => patch({ assignment: value })}
              >
                {label}
              </button>
            ))}
          </div>
        </details>
      ) : null}

      {hasFilters ? (
        <button
          type="button"
          className="portrait-filter-clear"
          onClick={() => patch({ species: "", profession: "", theme: "", merchantOnly: false, assignment: "all" })}
        >
          Clear filters
        </button>
      ) : null}
    </aside>
  );
}
