import { useEffect, useMemo, useRef, useState } from "react";

const OPTIONS = [
  { value: "npc", label: "NPC" },
  { value: "merchant", label: "Merchant" },
  // Placeholder for future expansion; disabled until the DB/check constraints support it.
  { value: "other", label: "Other (coming soon)", disabled: true },
];

export default function KindPicker({
  value,
  onChange,
  disabled = false,
  className = "",
  buttonClassName = "",
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const current = useMemo(() => {
    return OPTIONS.find((o) => o.value === value) || OPTIONS[0];
  }, [value]);

  useEffect(() => {
    if (!open) return;

    const onDocMouseDown = (e) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target)) setOpen(false);
    };

    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  const handlePick = (opt) => {
    if (disabled || opt.disabled) return;
    setOpen(false);
    if (typeof onChange === "function") onChange(opt.value);
  };

  return (
    <div ref={rootRef} className={`position-relative ${className}`.trim()}>
      <button
        type="button"
        className={`btn btn-sm btn-outline-secondary d-flex align-items-center gap-2 ${buttonClassName}`.trim()}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        title="Change kind"
      >
        <span className="small">Kind: {current.label}</span>
        <span aria-hidden="true" style={{ opacity: 0.7 }}>
          ▾
        </span>
      </button>

      {open ? (
        <div className="kind-picker__menu" role="menu">
          {OPTIONS.map((opt) => {
            const isActive = opt.value === current.value;
            const isDisabled = disabled || !!opt.disabled;
            return (
              <button
                key={opt.value}
                type="button"
                role="menuitem"
                className={`kind-picker__item ${isActive ? "active" : ""}`.trim()}
                disabled={isDisabled}
                onClick={() => handlePick(opt)}
              >
                <span>{opt.label}</span>
                {isActive ? (
                  <span className="badge bg-success-subtle text-success-emphasis">Current</span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      <style jsx>{`
        .kind-picker__menu {
          position: absolute;
          right: 0;
          top: calc(100% + 6px);
          min-width: 220px;
          background: rgba(10, 10, 14, 0.98);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 10px;
          padding: 6px;
          z-index: 1200;
          box-shadow: 0 18px 45px rgba(0, 0, 0, 0.55);
        }
        .kind-picker__item {
          width: 100%;
          border: 0;
          border-radius: 8px;
          padding: 8px 10px;
          background: transparent;
          color: rgba(255, 255, 255, 0.9);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          text-align: left;
        }
        .kind-picker__item:hover {
          background: rgba(255, 255, 255, 0.08);
        }
        .kind-picker__item.active {
          background: rgba(0, 200, 120, 0.12);
        }
        .kind-picker__item:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
