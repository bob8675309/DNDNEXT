// components/LocationSideBar.js
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../utils/supabaseClient";

function pickId(v) {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object") return v.id || v.name || v.title || null;
  return null;
}

function PanelSection({ title, right, children }) {
  return (
    <div
      className="mb-3"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 14,
        padding: 12,
      }}
    >
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div className="fw-semibold text-light">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

export default function LocationSideBar({
  location,
  isAdmin = false,
  merchants = [],
  onOpenMerchant,
  onClose,
  onReload,
}) {
  const [npcRows, setNpcRows] = useState([]);
  const [questRows, setQuestRows] = useState([]);
  const [busy, setBusy] = useState(false);

  const x = Number(location?.x);
  const y = Number(location?.y);

  // If locations.npcs is present, we’ll use it. Otherwise, we fallback to npcs.location_id.
  const npcIds = useMemo(() => {
    const raw = Array.isArray(location?.npcs) ? location.npcs : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const questIds = useMemo(() => {
    const raw = Array.isArray(location?.quests) ? location.quests : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const merchantsHere = useMemo(() => {
    const lid = String(location?.id ?? "");
    return (merchants || []).filter((m) => {
      const a = m.location_id != null ? String(m.location_id) : "";
      const b = m.last_known_location_id != null ? String(m.last_known_location_id) : "";
      return a === lid || b === lid;
    });
  }, [merchants, location]);

  useEffect(() => {
    let cancelled = false;

    async function loadDetails() {
      try {
        // --- NPCs ---
        if (npcIds.length) {
          nts/LocationSideBar.js
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../utils/supabaseClient";

function pickId(v) {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object") return v.id || v.name || v.title || null;
  return null;
}

function PanelSection({ title, right, children }) {
  return (
    <div
      className="mb-3"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 14,
        padding: 12,
      }}
    >
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div className="fw-semibold text-light">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

export default function LocationSideBar({
  location,
  isAdmin = false,
  merchants = [],
  onOpenMerchant,
  onClose,
  onReload,
}) {
  const [npcRows, setNpcRows] = useState([]);
  const [questRows, setQuestRows] = useState([]);
  const [busy, setBusy] = useState(false);

  const x = Number(location?.x);
  const y = Number(location?.y);

  // If locations.npcs is present, we’ll use it. Otherwise, we fallback to npcs.location_id.
  const npcIds = useMemo(() => {
    const raw = Array.isArray(location?.npcs) ? location.npcs : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const questIds = useMemo(() => {
    const raw = Array.isArray(location?.quests) ? location.quests : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const merchantsHere = useMemo(() => {
    const lid = String(location?.id ?? "");
    return (merchants || []).filter((m) => {
      const a = m.location_id != null ? String(m.location_id) : "";
      const b = m.last_known_location_id != null ? String(m.last_known_location_id) : "";
      return a === lid || b === lid;
    });
  }, [merchants, location]);

  useEffect(() => {
    let cancelled = false;

    async function loadDetails() {
      try {
        // --- NPCs ---
        if (npcIds.length) {
          const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
nts/LocationSideBar.js
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../utils/supabaseClient";

function pickId(v) {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object") return v.id || v.name || v.title || null;
  return null;
}

function PanelSection({ title, right, children }) {
  return (
    <div
      className="mb-3"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 14,
        padding: 12,
      }}
    >
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div className="fw-semibold text-light">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

export default function LocationSideBar({
  location,
  isAdmin = false,
  merchants = [],
  onOpenMerchant,
  onClose,
  onReload,
}) {
  const [npcRows, setNpcRows] = useState([]);
  const [questRows, setQuestRows] = useState([]);
  const [busy, setBusy] = useState(false);

  const x = Number(location?.x);
  const y = Number(location?.y);

  // If locations.npcs is present, we’ll use it. Otherwise, we fallback to npcs.location_id.
  const npcIds = useMemo(() => {
    const raw = Array.isArray(location?.npcs) ? location.npcs : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const questIds = useMemo(() => {
    const raw = Array.isArray(location?.quests) ? location.quests : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const merchantsHere = useMemo(() => {
    const lid = String(location?.id ?? "");
    return (merchants || []).filter((m) => {
      const a = m.location_id != null ? String(m.location_id) : "";
      const b = m.last_known_location_id != null ? String(m.last_known_location_id) : "";
      return a === lid || b === lid;
    });
  }, [merchants, location]);

  useEffect(() => {
    let cancelled = false;

    async function loadDetails() {
      try {
        // --- NPCs ---
        if (npcIds.length) {
                    const characterIds = npcIds.map(String).filter((id) => uuidRe.test(id));

nts/LocationSideBar.js
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../utils/supabaseClient";

function pickId(v) {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object") return v.id || v.name || v.title || null;
  return null;
}

function PanelSection({ title, right, children }) {
  return (
    <div
      className="mb-3"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 14,
        padding: 12,
      }}
    >
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div className="fw-semibold text-light">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

export default function LocationSideBar({
  location,
  isAdmin = false,
  merchants = [],
  onOpenMerchant,
  onClose,
  onReload,
}) {
  const [npcRows, setNpcRows] = useState([]);
  const [questRows, setQuestRows] = useState([]);
  const [busy, setBusy] = useState(false);

  const x = Number(location?.x);
  const y = Number(location?.y);

  // If locations.npcs is present, we’ll use it. Otherwise, we fallback to npcs.location_id.
  const npcIds = useMemo(() => {
    const raw = Array.isArray(location?.npcs) ? location.npcs : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const questIds = useMemo(() => {
    const raw = Array.isArray(location?.quests) ? location.quests : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const merchantsHere = useMemo(() => {
    const lid = String(location?.id ?? "");
    return (merchants || []).filter((m) => {
      const a = m.location_id != null ? String(m.location_id) : "";
      const b = m.last_known_location_id != null ? String(m.last_known_location_id) : "";
      return a === lid || b === lid;
    });
  }, [merchants, location]);

  useEffect(() => {
    let cancelled = false;

    async function loadDetails() {
      try {
        // --- NPCs ---
        if (npcIds.length) {
                    // Legacy mapping removed: location.npcs should contain characters.id values going forward.
nts/LocationSideBar.js
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../utils/supabaseClient";

function pickId(v) {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object") return v.id || v.name || v.title || null;
  return null;
}

function PanelSection({ title, right, children }) {
  return (
    <div
      className="mb-3"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 14,
        padding: 12,
      }}
    >
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div className="fw-semibold text-light">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

export default function LocationSideBar({
  location,
  isAdmin = false,
  merchants = [],
  onOpenMerchant,
  onClose,
  onReload,
}) {
  const [npcRows, setNpcRows] = useState([]);
  const [questRows, setQuestRows] = useState([]);
  const [busy, setBusy] = useState(false);

  const x = Number(location?.x);
  const y = Number(location?.y);

  // If locations.npcs is present, we’ll use it. Otherwise, we fallback to npcs.location_id.
  const npcIds = useMemo(() => {
    const raw = Array.isArray(location?.npcs) ? location.npcs : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const questIds = useMemo(() => {
    const raw = Array.isArray(location?.quests) ? location.quests : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const merchantsHere = useMemo(() => {
    const lid = String(location?.id ?? "");
    return (merchants || []).filter((m) => {
      const a = m.location_id != null ? String(m.location_id) : "";
      const b = m.last_known_location_id != null ? String(m.last_known_location_id) : "";
      return a === lid || b === lid;
    });
  }, [merchants, location]);

  useEffect(() => {
    let cancelled = false;

    async function loadDetails() {
      try {
        // --- NPCs ---
        if (npcIds.length) {
                    // If the list contains only legacy IDs, fall back to characters.location_id lookup.
nts/LocationSideBar.js
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../utils/supabaseClient";

function pickId(v) {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object") return v.id || v.name || v.title || null;
  return null;
}

function PanelSection({ title, right, children }) {
  return (
    <div
      className="mb-3"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 14,
        padding: 12,
      }}
    >
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div className="fw-semibold text-light">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

export default function LocationSideBar({
  location,
  isAdmin = false,
  merchants = [],
  onOpenMerchant,
  onClose,
  onReload,
}) {
  const [npcRows, setNpcRows] = useState([]);
  const [questRows, setQuestRows] = useState([]);
  const [busy, setBusy] = useState(false);

  const x = Number(location?.x);
  const y = Number(location?.y);

  // If locations.npcs is present, we’ll use it. Otherwise, we fallback to npcs.location_id.
  const npcIds = useMemo(() => {
    const raw = Array.isArray(location?.npcs) ? location.npcs : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const questIds = useMemo(() => {
    const raw = Array.isArray(location?.quests) ? location.quests : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const merchantsHere = useMemo(() => {
    const lid = String(location?.id ?? "");
    return (merchants || []).filter((m) => {
      const a = m.location_id != null ? String(m.location_id) : "";
      const b = m.last_known_location_id != null ? String(m.last_known_location_id) : "";
      return a === lid || b === lid;
    });
  }, [merchants, location]);

  useEffect(() => {
    let cancelled = false;

    async function loadDetails() {
      try {
        // --- NPCs ---
        if (npcIds.length) {
                    if (characterIds.length) {
nts/LocationSideBar.js
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../utils/supabaseClient";

function pickId(v) {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object") return v.id || v.name || v.title || null;
  return null;
}

function PanelSection({ title, right, children }) {
  return (
    <div
      className="mb-3"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 14,
        padding: 12,
      }}
    >
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div className="fw-semibold text-light">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

export default function LocationSideBar({
  location,
  isAdmin = false,
  merchants = [],
  onOpenMerchant,
  onClose,
  onReload,
}) {
  const [npcRows, setNpcRows] = useState([]);
  const [questRows, setQuestRows] = useState([]);
  const [busy, setBusy] = useState(false);

  const x = Number(location?.x);
  const y = Number(location?.y);

  // If locations.npcs is present, we’ll use it. Otherwise, we fallback to npcs.location_id.
  const npcIds = useMemo(() => {
    const raw = Array.isArray(location?.npcs) ? location.npcs : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const questIds = useMemo(() => {
    const raw = Array.isArray(location?.quests) ? location.quests : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const merchantsHere = useMemo(() => {
    const lid = String(location?.id ?? "");
    return (merchants || []).filter((m) => {
      const a = m.location_id != null ? String(m.location_id) : "";
      const b = m.last_known_location_id != null ? String(m.last_known_location_id) : "";
      return a === lid || b === lid;
    });
  }, [merchants, location]);

  useEffect(() => {
    let cancelled = false;

    async function loadDetails() {
      try {
        // --- NPCs ---
        if (npcIds.length) {
                      const { data, error } = await supabase
nts/LocationSideBar.js
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../utils/supabaseClient";

function pickId(v) {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object") return v.id || v.name || v.title || null;
  return null;
}

function PanelSection({ title, right, children }) {
  return (
    <div
      className="mb-3"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 14,
        padding: 12,
      }}
    >
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div className="fw-semibold text-light">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

export default function LocationSideBar({
  location,
  isAdmin = false,
  merchants = [],
  onOpenMerchant,
  onClose,
  onReload,
}) {
  const [npcRows, setNpcRows] = useState([]);
  const [questRows, setQuestRows] = useState([]);
  const [busy, setBusy] = useState(false);

  const x = Number(location?.x);
  const y = Number(location?.y);

  // If locations.npcs is present, we’ll use it. Otherwise, we fallback to npcs.location_id.
  const npcIds = useMemo(() => {
    const raw = Array.isArray(location?.npcs) ? location.npcs : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const questIds = useMemo(() => {
    const raw = Array.isArray(location?.quests) ? location.quests : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const merchantsHere = useMemo(() => {
    const lid = String(location?.id ?? "");
    return (merchants || []).filter((m) => {
      const a = m.location_id != null ? String(m.location_id) : "";
      const b = m.last_known_location_id != null ? String(m.last_known_location_id) : "";
      return a === lid || b === lid;
    });
  }, [merchants, location]);

  useEffect(() => {
    let cancelled = false;

    async function loadDetails() {
      try {
        // --- NPCs ---
        if (npcIds.length) {
                        .from("characters")
nts/LocationSideBar.js
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../utils/supabaseClient";

function pickId(v) {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object") return v.id || v.name || v.title || null;
  return null;
}

function PanelSection({ title, right, children }) {
  return (
    <div
      className="mb-3"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 14,
        padding: 12,
      }}
    >
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div className="fw-semibold text-light">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

export default function LocationSideBar({
  location,
  isAdmin = false,
  merchants = [],
  onOpenMerchant,
  onClose,
  onReload,
}) {
  const [npcRows, setNpcRows] = useState([]);
  const [questRows, setQuestRows] = useState([]);
  const [busy, setBusy] = useState(false);

  const x = Number(location?.x);
  const y = Number(location?.y);

  // If locations.npcs is present, we’ll use it. Otherwise, we fallback to npcs.location_id.
  const npcIds = useMemo(() => {
    const raw = Array.isArray(location?.npcs) ? location.npcs : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const questIds = useMemo(() => {
    const raw = Array.isArray(location?.quests) ? location.quests : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const merchantsHere = useMemo(() => {
    const lid = String(location?.id ?? "");
    return (merchants || []).filter((m) => {
      const a = m.location_id != null ? String(m.location_id) : "";
      const b = m.last_known_location_id != null ? String(m.last_known_location_id) : "";
      return a === lid || b === lid;
    });
  }, [merchants, location]);

  useEffect(() => {
    let cancelled = false;

    async function loadDetails() {
      try {
        // --- NPCs ---
        if (npcIds.length) {
                        .select("id,name,race,role,status,affiliation,location_id")
nts/LocationSideBar.js
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../utils/supabaseClient";

function pickId(v) {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object") return v.id || v.name || v.title || null;
  return null;
}

function PanelSection({ title, right, children }) {
  return (
    <div
      className="mb-3"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 14,
        padding: 12,
      }}
    >
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div className="fw-semibold text-light">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

export default function LocationSideBar({
  location,
  isAdmin = false,
  merchants = [],
  onOpenMerchant,
  onClose,
  onReload,
}) {
  const [npcRows, setNpcRows] = useState([]);
  const [questRows, setQuestRows] = useState([]);
  const [busy, setBusy] = useState(false);

  const x = Number(location?.x);
  const y = Number(location?.y);

  // If locations.npcs is present, we’ll use it. Otherwise, we fallback to npcs.location_id.
  const npcIds = useMemo(() => {
    const raw = Array.isArray(location?.npcs) ? location.npcs : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const questIds = useMemo(() => {
    const raw = Array.isArray(location?.quests) ? location.quests : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const merchantsHere = useMemo(() => {
    const lid = String(location?.id ?? "");
    return (merchants || []).filter((m) => {
      const a = m.location_id != null ? String(m.location_id) : "";
      const b = m.last_known_location_id != null ? String(m.last_known_location_id) : "";
      return a === lid || b === lid;
    });
  }, [merchants, location]);

  useEffect(() => {
    let cancelled = false;

    async function loadDetails() {
      try {
        // --- NPCs ---
        if (npcIds.length) {
                        .eq("kind", "npc")
nts/LocationSideBar.js
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../utils/supabaseClient";

function pickId(v) {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object") return v.id || v.name || v.title || null;
  return null;
}

function PanelSection({ title, right, children }) {
  return (
    <div
      className="mb-3"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 14,
        padding: 12,
      }}
    >
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div className="fw-semibold text-light">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

export default function LocationSideBar({
  location,
  isAdmin = false,
  merchants = [],
  onOpenMerchant,
  onClose,
  onReload,
}) {
  const [npcRows, setNpcRows] = useState([]);
  const [questRows, setQuestRows] = useState([]);
  const [busy, setBusy] = useState(false);

  const x = Number(location?.x);
  const y = Number(location?.y);

  // If locations.npcs is present, we’ll use it. Otherwise, we fallback to npcs.location_id.
  const npcIds = useMemo(() => {
    const raw = Array.isArray(location?.npcs) ? location.npcs : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const questIds = useMemo(() => {
    const raw = Array.isArray(location?.quests) ? location.quests : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const merchantsHere = useMemo(() => {
    const lid = String(location?.id ?? "");
    return (merchants || []).filter((m) => {
      const a = m.location_id != null ? String(m.location_id) : "";
      const b = m.last_known_location_id != null ? String(m.last_known_location_id) : "";
      return a === lid || b === lid;
    });
  }, [merchants, location]);

  useEffect(() => {
    let cancelled = false;

    async function loadDetails() {
      try {
        // --- NPCs ---
        if (npcIds.length) {
                        .in("id", characterIds);

nts/LocationSideBar.js
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../utils/supabaseClient";

function pickId(v) {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object") return v.id || v.name || v.title || null;
  return null;
}

function PanelSection({ title, right, children }) {
  return (
    <div
      className="mb-3"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 14,
        padding: 12,
      }}
    >
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div className="fw-semibold text-light">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

export default function LocationSideBar({
  location,
  isAdmin = false,
  merchants = [],
  onOpenMerchant,
  onClose,
  onReload,
}) {
  const [npcRows, setNpcRows] = useState([]);
  const [questRows, setQuestRows] = useState([]);
  const [busy, setBusy] = useState(false);

  const x = Number(location?.x);
  const y = Number(location?.y);

  // If locations.npcs is present, we’ll use it. Otherwise, we fallback to npcs.location_id.
  const npcIds = useMemo(() => {
    const raw = Array.isArray(location?.npcs) ? location.npcs : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const questIds = useMemo(() => {
    const raw = Array.isArray(location?.quests) ? location.quests : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const merchantsHere = useMemo(() => {
    const lid = String(location?.id ?? "");
    return (merchants || []).filter((m) => {
      const a = m.location_id != null ? String(m.location_id) : "";
      const b = m.last_known_location_id != null ? String(m.last_known_location_id) : "";
      return a === lid || b === lid;
    });
  }, [merchants, location]);

  useEffect(() => {
    let cancelled = false;

    async function loadDetails() {
      try {
        // --- NPCs ---
        if (npcIds.length) {
                      if (!cancelled) {
nts/LocationSideBar.js
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../utils/supabaseClient";

function pickId(v) {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object") return v.id || v.name || v.title || null;
  return null;
}

function PanelSection({ title, right, children }) {
  return (
    <div
      className="mb-3"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 14,
        padding: 12,
      }}
    >
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div className="fw-semibold text-light">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

export default function LocationSideBar({
  location,
  isAdmin = false,
  merchants = [],
  onOpenMerchant,
  onClose,
  onReload,
}) {
  const [npcRows, setNpcRows] = useState([]);
  const [questRows, setQuestRows] = useState([]);
  const [busy, setBusy] = useState(false);

  const x = Number(location?.x);
  const y = Number(location?.y);

  // If locations.npcs is present, we’ll use it. Otherwise, we fallback to npcs.location_id.
  const npcIds = useMemo(() => {
    const raw = Array.isArray(location?.npcs) ? location.npcs : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const questIds = useMemo(() => {
    const raw = Array.isArray(location?.quests) ? location.quests : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const merchantsHere = useMemo(() => {
    const lid = String(location?.id ?? "");
    return (merchants || []).filter((m) => {
      const a = m.location_id != null ? String(m.location_id) : "";
      const b = m.last_known_location_id != null ? String(m.last_known_location_id) : "";
      return a === lid || b === lid;
    });
  }, [merchants, location]);

  useEffect(() => {
    let cancelled = false;

    async function loadDetails() {
      try {
        // --- NPCs ---
        if (npcIds.length) {
                        if (error) console.error(error);
nts/LocationSideBar.js
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../utils/supabaseClient";

function pickId(v) {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object") return v.id || v.name || v.title || null;
  return null;
}

function PanelSection({ title, right, children }) {
  return (
    <div
      className="mb-3"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 14,
        padding: 12,
      }}
    >
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div className="fw-semibold text-light">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

export default function LocationSideBar({
  location,
  isAdmin = false,
  merchants = [],
  onOpenMerchant,
  onClose,
  onReload,
}) {
  const [npcRows, setNpcRows] = useState([]);
  const [questRows, setQuestRows] = useState([]);
  const [busy, setBusy] = useState(false);

  const x = Number(location?.x);
  const y = Number(location?.y);

  // If locations.npcs is present, we’ll use it. Otherwise, we fallback to npcs.location_id.
  const npcIds = useMemo(() => {
    const raw = Array.isArray(location?.npcs) ? location.npcs : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const questIds = useMemo(() => {
    const raw = Array.isArray(location?.quests) ? location.quests : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const merchantsHere = useMemo(() => {
    const lid = String(location?.id ?? "");
    return (merchants || []).filter((m) => {
      const a = m.location_id != null ? String(m.location_id) : "";
      const b = m.last_known_location_id != null ? String(m.last_known_location_id) : "";
      return a === lid || b === lid;
    });
  }, [merchants, location]);

  useEffect(() => {
    let cancelled = false;

    async function loadDetails() {
      try {
        // --- NPCs ---
        if (npcIds.length) {
                        setNpcRows(data || []);
nts/LocationSideBar.js
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../utils/supabaseClient";

function pickId(v) {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object") return v.id || v.name || v.title || null;
  return null;
}

function PanelSection({ title, right, children }) {
  return (
    <div
      className="mb-3"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 14,
        padding: 12,
      }}
    >
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div className="fw-semibold text-light">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

export default function LocationSideBar({
  location,
  isAdmin = false,
  merchants = [],
  onOpenMerchant,
  onClose,
  onReload,
}) {
  const [npcRows, setNpcRows] = useState([]);
  const [questRows, setQuestRows] = useState([]);
  const [busy, setBusy] = useState(false);

  const x = Number(location?.x);
  const y = Number(location?.y);

  // If locations.npcs is present, we’ll use it. Otherwise, we fallback to npcs.location_id.
  const npcIds = useMemo(() => {
    const raw = Array.isArray(location?.npcs) ? location.npcs : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const questIds = useMemo(() => {
    const raw = Array.isArray(location?.quests) ? location.quests : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const merchantsHere = useMemo(() => {
    const lid = String(location?.id ?? "");
    return (merchants || []).filter((m) => {
      const a = m.location_id != null ? String(m.location_id) : "";
      const b = m.last_known_location_id != null ? String(m.last_known_location_id) : "";
      return a === lid || b === lid;
    });
  }, [merchants, location]);

  useEffect(() => {
    let cancelled = false;

    async function loadDetails() {
      try {
        // --- NPCs ---
        if (npcIds.length) {
                      }
nts/LocationSideBar.js
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../utils/supabaseClient";

function pickId(v) {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object") return v.id || v.name || v.title || null;
  return null;
}

function PanelSection({ title, right, children }) {
  return (
    <div
      className="mb-3"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 14,
        padding: 12,
      }}
    >
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div className="fw-semibold text-light">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

export default function LocationSideBar({
  location,
  isAdmin = false,
  merchants = [],
  onOpenMerchant,
  onClose,
  onReload,
}) {
  const [npcRows, setNpcRows] = useState([]);
  const [questRows, setQuestRows] = useState([]);
  const [busy, setBusy] = useState(false);

  const x = Number(location?.x);
  const y = Number(location?.y);

  // If locations.npcs is present, we’ll use it. Otherwise, we fallback to npcs.location_id.
  const npcIds = useMemo(() => {
    const raw = Array.isArray(location?.npcs) ? location.npcs : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const questIds = useMemo(() => {
    const raw = Array.isArray(location?.quests) ? location.quests : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const merchantsHere = useMemo(() => {
    const lid = String(location?.id ?? "");
    return (merchants || []).filter((m) => {
      const a = m.location_id != null ? String(m.location_id) : "";
      const b = m.last_known_location_id != null ? String(m.last_known_location_id) : "";
      return a === lid || b === lid;
    });
  }, [merchants, location]);

  useEffect(() => {
    let cancelled = false;

    async function loadDetails() {
      try {
        // --- NPCs ---
        if (npcIds.length) {
                    } else if (location?.id != null) {
nts/LocationSideBar.js
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../utils/supabaseClient";

function pickId(v) {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object") return v.id || v.name || v.title || null;
  return null;
}

function PanelSection({ title, right, children }) {
  return (
    <div
      className="mb-3"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 14,
        padding: 12,
      }}
    >
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div className="fw-semibold text-light">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

export default function LocationSideBar({
  location,
  isAdmin = false,
  merchants = [],
  onOpenMerchant,
  onClose,
  onReload,
}) {
  const [npcRows, setNpcRows] = useState([]);
  const [questRows, setQuestRows] = useState([]);
  const [busy, setBusy] = useState(false);

  const x = Number(location?.x);
  const y = Number(location?.y);

  // If locations.npcs is present, we’ll use it. Otherwise, we fallback to npcs.location_id.
  const npcIds = useMemo(() => {
    const raw = Array.isArray(location?.npcs) ? location.npcs : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const questIds = useMemo(() => {
    const raw = Array.isArray(location?.quests) ? location.quests : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const merchantsHere = useMemo(() => {
    const lid = String(location?.id ?? "");
    return (merchants || []).filter((m) => {
      const a = m.location_id != null ? String(m.location_id) : "";
      const b = m.last_known_location_id != null ? String(m.last_known_location_id) : "";
      return a === lid || b === lid;
    });
  }, [merchants, location]);

  useEffect(() => {
    let cancelled = false;

    async function loadDetails() {
      try {
        // --- NPCs ---
        if (npcIds.length) {
                      const { data, error } = await supabase
nts/LocationSideBar.js
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../utils/supabaseClient";

function pickId(v) {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object") return v.id || v.name || v.title || null;
  return null;
}

function PanelSection({ title, right, children }) {
  return (
    <div
      className="mb-3"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 14,
        padding: 12,
      }}
    >
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div className="fw-semibold text-light">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

export default function LocationSideBar({
  location,
  isAdmin = false,
  merchants = [],
  onOpenMerchant,
  onClose,
  onReload,
}) {
  const [npcRows, setNpcRows] = useState([]);
  const [questRows, setQuestRows] = useState([]);
  const [busy, setBusy] = useState(false);

  const x = Number(location?.x);
  const y = Number(location?.y);

  // If locations.npcs is present, we’ll use it. Otherwise, we fallback to npcs.location_id.
  const npcIds = useMemo(() => {
    const raw = Array.isArray(location?.npcs) ? location.npcs : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const questIds = useMemo(() => {
    const raw = Array.isArray(location?.quests) ? location.quests : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const merchantsHere = useMemo(() => {
    const lid = String(location?.id ?? "");
    return (merchants || []).filter((m) => {
      const a = m.location_id != null ? String(m.location_id) : "";
      const b = m.last_known_location_id != null ? String(m.last_known_location_id) : "";
      return a === lid || b === lid;
    });
  }, [merchants, location]);

  useEffect(() => {
    let cancelled = false;

    async function loadDetails() {
      try {
        // --- NPCs ---
        if (npcIds.length) {
                        .from("characters")
nts/LocationSideBar.js
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../utils/supabaseClient";

function pickId(v) {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object") return v.id || v.name || v.title || null;
  return null;
}

function PanelSection({ title, right, children }) {
  return (
    <div
      className="mb-3"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 14,
        padding: 12,
      }}
    >
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div className="fw-semibold text-light">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

export default function LocationSideBar({
  location,
  isAdmin = false,
  merchants = [],
  onOpenMerchant,
  onClose,
  onReload,
}) {
  const [npcRows, setNpcRows] = useState([]);
  const [questRows, setQuestRows] = useState([]);
  const [busy, setBusy] = useState(false);

  const x = Number(location?.x);
  const y = Number(location?.y);

  // If locations.npcs is present, we’ll use it. Otherwise, we fallback to npcs.location_id.
  const npcIds = useMemo(() => {
    const raw = Array.isArray(location?.npcs) ? location.npcs : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const questIds = useMemo(() => {
    const raw = Array.isArray(location?.quests) ? location.quests : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const merchantsHere = useMemo(() => {
    const lid = String(location?.id ?? "");
    return (merchants || []).filter((m) => {
      const a = m.location_id != null ? String(m.location_id) : "";
      const b = m.last_known_location_id != null ? String(m.last_known_location_id) : "";
      return a === lid || b === lid;
    });
  }, [merchants, location]);

  useEffect(() => {
    let cancelled = false;

    async function loadDetails() {
      try {
        // --- NPCs ---
        if (npcIds.length) {
                        .select("id,name,race,role,status,affiliation,location_id")
nts/LocationSideBar.js
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../utils/supabaseClient";

function pickId(v) {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object") return v.id || v.name || v.title || null;
  return null;
}

function PanelSection({ title, right, children }) {
  return (
    <div
      className="mb-3"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 14,
        padding: 12,
      }}
    >
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div className="fw-semibold text-light">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

export default function LocationSideBar({
  location,
  isAdmin = false,
  merchants = [],
  onOpenMerchant,
  onClose,
  onReload,
}) {
  const [npcRows, setNpcRows] = useState([]);
  const [questRows, setQuestRows] = useState([]);
  const [busy, setBusy] = useState(false);

  const x = Number(location?.x);
  const y = Number(location?.y);

  // If locations.npcs is present, we’ll use it. Otherwise, we fallback to npcs.location_id.
  const npcIds = useMemo(() => {
    const raw = Array.isArray(location?.npcs) ? location.npcs : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const questIds = useMemo(() => {
    const raw = Array.isArray(location?.quests) ? location.quests : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const merchantsHere = useMemo(() => {
    const lid = String(location?.id ?? "");
    return (merchants || []).filter((m) => {
      const a = m.location_id != null ? String(m.location_id) : "";
      const b = m.last_known_location_id != null ? String(m.last_known_location_id) : "";
      return a === lid || b === lid;
    });
  }, [merchants, location]);

  useEffect(() => {
    let cancelled = false;

    async function loadDetails() {
      try {
        // --- NPCs ---
        if (npcIds.length) {
                        .eq("kind", "npc")
nts/LocationSideBar.js
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../utils/supabaseClient";

function pickId(v) {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object") return v.id || v.name || v.title || null;
  return null;
}

function PanelSection({ title, right, children }) {
  return (
    <div
      className="mb-3"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 14,
        padding: 12,
      }}
    >
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div className="fw-semibold text-light">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

export default function LocationSideBar({
  location,
  isAdmin = false,
  merchants = [],
  onOpenMerchant,
  onClose,
  onReload,
}) {
  const [npcRows, setNpcRows] = useState([]);
  const [questRows, setQuestRows] = useState([]);
  const [busy, setBusy] = useState(false);

  const x = Number(location?.x);
  const y = Number(location?.y);

  // If locations.npcs is present, we’ll use it. Otherwise, we fallback to npcs.location_id.
  const npcIds = useMemo(() => {
    const raw = Array.isArray(location?.npcs) ? location.npcs : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const questIds = useMemo(() => {
    const raw = Array.isArray(location?.quests) ? location.quests : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const merchantsHere = useMemo(() => {
    const lid = String(location?.id ?? "");
    return (merchants || []).filter((m) => {
      const a = m.location_id != null ? String(m.location_id) : "";
      const b = m.last_known_location_id != null ? String(m.last_known_location_id) : "";
      return a === lid || b === lid;
    });
  }, [merchants, location]);

  useEffect(() => {
    let cancelled = false;

    async function loadDetails() {
      try {
        // --- NPCs ---
        if (npcIds.length) {
                        .eq("location_id", location.id);

nts/LocationSideBar.js
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../utils/supabaseClient";

function pickId(v) {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object") return v.id || v.name || v.title || null;
  return null;
}

function PanelSection({ title, right, children }) {
  return (
    <div
      className="mb-3"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 14,
        padding: 12,
      }}
    >
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div className="fw-semibold text-light">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

export default function LocationSideBar({
  location,
  isAdmin = false,
  merchants = [],
  onOpenMerchant,
  onClose,
  onReload,
}) {
  const [npcRows, setNpcRows] = useState([]);
  const [questRows, setQuestRows] = useState([]);
  const [busy, setBusy] = useState(false);

  const x = Number(location?.x);
  const y = Number(location?.y);

  // If locations.npcs is present, we’ll use it. Otherwise, we fallback to npcs.location_id.
  const npcIds = useMemo(() => {
    const raw = Array.isArray(location?.npcs) ? location.npcs : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const questIds = useMemo(() => {
    const raw = Array.isArray(location?.quests) ? location.quests : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const merchantsHere = useMemo(() => {
    const lid = String(location?.id ?? "");
    return (merchants || []).filter((m) => {
      const a = m.location_id != null ? String(m.location_id) : "";
      const b = m.last_known_location_id != null ? String(m.last_known_location_id) : "";
      return a === lid || b === lid;
    });
  }, [merchants, location]);

  useEffect(() => {
    let cancelled = false;

    async function loadDetails() {
      try {
        // --- NPCs ---
        if (npcIds.length) {
                      if (!cancelled) {
nts/LocationSideBar.js
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../utils/supabaseClient";

function pickId(v) {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object") return v.id || v.name || v.title || null;
  return null;
}

function PanelSection({ title, right, children }) {
  return (
    <div
      className="mb-3"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 14,
        padding: 12,
      }}
    >
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div className="fw-semibold text-light">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

export default function LocationSideBar({
  location,
  isAdmin = false,
  merchants = [],
  onOpenMerchant,
  onClose,
  onReload,
}) {
  const [npcRows, setNpcRows] = useState([]);
  const [questRows, setQuestRows] = useState([]);
  const [busy, setBusy] = useState(false);

  const x = Number(location?.x);
  const y = Number(location?.y);

  // If locations.npcs is present, we’ll use it. Otherwise, we fallback to npcs.location_id.
  const npcIds = useMemo(() => {
    const raw = Array.isArray(location?.npcs) ? location.npcs : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const questIds = useMemo(() => {
    const raw = Array.isArray(location?.quests) ? location.quests : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const merchantsHere = useMemo(() => {
    const lid = String(location?.id ?? "");
    return (merchants || []).filter((m) => {
      const a = m.location_id != null ? String(m.location_id) : "";
      const b = m.last_known_location_id != null ? String(m.last_known_location_id) : "";
      return a === lid || b === lid;
    });
  }, [merchants, location]);

  useEffect(() => {
    let cancelled = false;

    async function loadDetails() {
      try {
        // --- NPCs ---
        if (npcIds.length) {
                        if (error) console.error(error);
nts/LocationSideBar.js
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../utils/supabaseClient";

function pickId(v) {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object") return v.id || v.name || v.title || null;
  return null;
}

function PanelSection({ title, right, children }) {
  return (
    <div
      className="mb-3"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 14,
        padding: 12,
      }}
    >
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div className="fw-semibold text-light">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

export default function LocationSideBar({
  location,
  isAdmin = false,
  merchants = [],
  onOpenMerchant,
  onClose,
  onReload,
}) {
  const [npcRows, setNpcRows] = useState([]);
  const [questRows, setQuestRows] = useState([]);
  const [busy, setBusy] = useState(false);

  const x = Number(location?.x);
  const y = Number(location?.y);

  // If locations.npcs is present, we’ll use it. Otherwise, we fallback to npcs.location_id.
  const npcIds = useMemo(() => {
    const raw = Array.isArray(location?.npcs) ? location.npcs : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const questIds = useMemo(() => {
    const raw = Array.isArray(location?.quests) ? location.quests : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const merchantsHere = useMemo(() => {
    const lid = String(location?.id ?? "");
    return (merchants || []).filter((m) => {
      const a = m.location_id != null ? String(m.location_id) : "";
      const b = m.last_known_location_id != null ? String(m.last_known_location_id) : "";
      return a === lid || b === lid;
    });
  }, [merchants, location]);

  useEffect(() => {
    let cancelled = false;

    async function loadDetails() {
      try {
        // --- NPCs ---
        if (npcIds.length) {
                        setNpcRows(data || []);
nts/LocationSideBar.js
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../utils/supabaseClient";

function pickId(v) {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object") return v.id || v.name || v.title || null;
  return null;
}

function PanelSection({ title, right, children }) {
  return (
    <div
      className="mb-3"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 14,
        padding: 12,
      }}
    >
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div className="fw-semibold text-light">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

export default function LocationSideBar({
  location,
  isAdmin = false,
  merchants = [],
  onOpenMerchant,
  onClose,
  onReload,
}) {
  const [npcRows, setNpcRows] = useState([]);
  const [questRows, setQuestRows] = useState([]);
  const [busy, setBusy] = useState(false);

  const x = Number(location?.x);
  const y = Number(location?.y);

  // If locations.npcs is present, we’ll use it. Otherwise, we fallback to npcs.location_id.
  const npcIds = useMemo(() => {
    const raw = Array.isArray(location?.npcs) ? location.npcs : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const questIds = useMemo(() => {
    const raw = Array.isArray(location?.quests) ? location.quests : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const merchantsHere = useMemo(() => {
    const lid = String(location?.id ?? "");
    return (merchants || []).filter((m) => {
      const a = m.location_id != null ? String(m.location_id) : "";
      const b = m.last_known_location_id != null ? String(m.last_known_location_id) : "";
      return a === lid || b === lid;
    });
  }, [merchants, location]);

  useEffect(() => {
    let cancelled = false;

    async function loadDetails() {
      try {
        // --- NPCs ---
        if (npcIds.length) {
                      }
nts/LocationSideBar.js
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../utils/supabaseClient";

function pickId(v) {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object") return v.id || v.name || v.title || null;
  return null;
}

function PanelSection({ title, right, children }) {
  return (
    <div
      className="mb-3"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 14,
        padding: 12,
      }}
    >
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div className="fw-semibold text-light">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

export default function LocationSideBar({
  location,
  isAdmin = false,
  merchants = [],
  onOpenMerchant,
  onClose,
  onReload,
}) {
  const [npcRows, setNpcRows] = useState([]);
  const [questRows, setQuestRows] = useState([]);
  const [busy, setBusy] = useState(false);

  const x = Number(location?.x);
  const y = Number(location?.y);

  // If locations.npcs is present, we’ll use it. Otherwise, we fallback to npcs.location_id.
  const npcIds = useMemo(() => {
    const raw = Array.isArray(location?.npcs) ? location.npcs : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const questIds = useMemo(() => {
    const raw = Array.isArray(location?.quests) ? location.quests : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const merchantsHere = useMemo(() => {
    const lid = String(location?.id ?? "");
    return (merchants || []).filter((m) => {
      const a = m.location_id != null ? String(m.location_id) : "";
      const b = m.last_known_location_id != null ? String(m.last_known_location_id) : "";
      return a === lid || b === lid;
    });
  }, [merchants, location]);

  useEffect(() => {
    let cancelled = false;

    async function loadDetails() {
      try {
        // --- NPCs ---
        if (npcIds.length) {
                    } else if (!cancelled) {
nts/LocationSideBar.js
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../utils/supabaseClient";

function pickId(v) {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object") return v.id || v.name || v.title || null;
  return null;
}

function PanelSection({ title, right, children }) {
  return (
    <div
      className="mb-3"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 14,
        padding: 12,
      }}
    >
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div className="fw-semibold text-light">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

export default function LocationSideBar({
  location,
  isAdmin = false,
  merchants = [],
  onOpenMerchant,
  onClose,
  onReload,
}) {
  const [npcRows, setNpcRows] = useState([]);
  const [questRows, setQuestRows] = useState([]);
  const [busy, setBusy] = useState(false);

  const x = Number(location?.x);
  const y = Number(location?.y);

  // If locations.npcs is present, we’ll use it. Otherwise, we fallback to npcs.location_id.
  const npcIds = useMemo(() => {
    const raw = Array.isArray(location?.npcs) ? location.npcs : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const questIds = useMemo(() => {
    const raw = Array.isArray(location?.quests) ? location.quests : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const merchantsHere = useMemo(() => {
    const lid = String(location?.id ?? "");
    return (merchants || []).filter((m) => {
      const a = m.location_id != null ? String(m.location_id) : "";
      const b = m.last_known_location_id != null ? String(m.last_known_location_id) : "";
      return a === lid || b === lid;
    });
  }, [merchants, location]);

  useEffect(() => {
    let cancelled = false;

    async function loadDetails() {
      try {
        // --- NPCs ---
        if (npcIds.length) {
                      setNpcRows([]);
nts/LocationSideBar.js
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../utils/supabaseClient";

function pickId(v) {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object") return v.id || v.name || v.title || null;
  return null;
}

function PanelSection({ title, right, children }) {
  return (
    <div
      className="mb-3"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 14,
        padding: 12,
      }}
    >
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div className="fw-semibold text-light">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

export default function LocationSideBar({
  location,
  isAdmin = false,
  merchants = [],
  onOpenMerchant,
  onClose,
  onReload,
}) {
  const [npcRows, setNpcRows] = useState([]);
  const [questRows, setQuestRows] = useState([]);
  const [busy, setBusy] = useState(false);

  const x = Number(location?.x);
  const y = Number(location?.y);

  // If locations.npcs is present, we’ll use it. Otherwise, we fallback to npcs.location_id.
  const npcIds = useMemo(() => {
    const raw = Array.isArray(location?.npcs) ? location.npcs : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const questIds = useMemo(() => {
    const raw = Array.isArray(location?.quests) ? location.quests : [];
    return raw.map(pickId).filter(Boolean);
  }, [location]);

  const merchantsHere = useMemo(() => {
    const lid = String(location?.id ?? "");
    return (merchants || []).filter((m) => {
      const a = m.location_id != null ? String(m.location_id) : "";
      const b = m.last_known_location_id != null ? String(m.last_known_location_id) : "";
      return a === lid || b === lid;
    });
  }, [merchants, location]);

  useEffect(() => {
    let cancelled = false;

    async function loadDetails() {
      try {
        // --- NPCs ---
        if (npcIds.length) {
                    }
        } else if (location?.id != null) {
          // Fallback: show NPCs that are assigned to this location via characters.location_id
          const { data, error } = await supabase
            .from("characters")
            .select("id,name,race,role,status,affiliation,location_id")
            .eq("kind", "npc")
            .eq("location_id", location.id)
            .order("name", { ascending: true });

          if (!cancelled) {
            if (error) console.error(error);
            setNpcRows(data || []);
          }
        } else {
          setNpcRows([]);
        }

        // --- Quests (still driven by location.quests list for now) ---
        if (questIds.length) {
          const { data, error } = await supabase
            .from("quests")
            .select("id,name,status,description")
            .in("id", questIds);

          if (!cancelled) {
            if (error) console.error(error);
            setQuestRows(data || []);
          }
        } else {
          setQuestRows([]);
        }
      } catch (e) {
        console.error(e);
      }
    }

    loadDetails();
    return () => {
      cancelled = true;
    };
  }, [npcIds, questIds, location?.id]);

  async function copyCoords() {
    const txt =
      Number.isFinite(x) && Number.isFinite(y)
        ? `${x.toFixed(3)}, ${y.toFixed(3)}`
        : "No coordinates";
    try {
      await navigator.clipboard.writeText(txt);
    } catch {
      alert(txt);
    }
  }

  async function deleteLocation() {
    if (!isAdmin || !location?.id) return;
    const ok = confirm(`Delete location "${location.name}"? This cannot be undone.`);
    if (!ok) return;

    setBusy(true);
    const { error } = await supabase.from("locations").delete().eq("id", location.id);
    setBusy(false);

    if (error) return alert(error.message);
    await onReload?.();
    onClose?.();

    const el = document.getElementById("locPanel");
    if (el && window.bootstrap) window.bootstrap.Offcanvas.getInstance(el)?.hide();
  }

  const npcById = useMemo(() => {
    const m = new Map();
    for (const r of npcRows) m.set(String(r.id), r);
    return m;
  }, [npcRows]);

  const questById = useMemo(() => {
    const m = new Map();
    for (const r of questRows) m.set(String(r.id), r);
    return m;
  }, [questRows]);

  // If location.npcs exists, use its ordering; otherwise just use npcRows.
  const npcDisplay = useMemo(() => {
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const ordered = (npcIds || []).map(String).filter((id) => uuidRe.test(id));
    if (ordered.length) {
      return ordered.map((id) => npcById.get(id) || { id, name: id });
    }
    return npcRows || [];
  }, [npcIds, npcById, npcRows]);

  const questDisplay = questIds.map((id) => questById.get(String(id)) || { id, name: String(id) });

  if (!location) return null;

  return (
    <>
      {/* Header (Name | Coords | Remove | Close) */}
      <div className="offcanvas-header">
        <div style={{ minWidth: 0 }}>
          <h5 className="offcanvas-title mb-0 text-light text-truncate">{location.name}</h5>
          <div className="small" style={{ color: "rgba(255,255,255,0.65)" }}>
            {Number.isFinite(x) && Number.isFinite(y) ? (
              <>
                X {x.toFixed(2)} · Y {y.toFixed(2)}
              </>
            ) : (
              "No coordinates set"
            )}
          </div>
        </div>

        <div className="d-flex align-items-center gap-2">
          <button className="btn btn-sm btn-outline-light" type="button" onClick={copyCoords} title="Copy coords">
            Copy
          </button>

          {isAdmin && (
            <button
              className="btn btn-sm btn-outline-danger"
              type="button"
              onClick={deleteLocation}
              disabled={busy}
              title="Delete location"
            >
              Remove
            </button>
          )}

          <button
            className="btn-close btn-close-white"
            data-bs-dismiss="offcanvas"
            aria-label="Close"
            onClick={onClose}
          />
        </div>
      </div>

      <div className="offcanvas-body">
        {/* Description */}
        <PanelSection
          title="Description"
          right={<span className="badge text-bg-dark" title="Location">📍</span>}
        >
          {location.description ? (
            <div className="text-light" style={{ whiteSpace: "pre-wrap" }}>
              {location.description}
            </div>
          ) : (
            <div className="small" style={{ color: "rgba(255,255,255,0.65)" }}>
              No description yet.
            </div>
          )}
        </PanelSection>

        {/* NPCs */}
        <PanelSection
          title="NPCs"
          right={<span className="badge text-bg-dark">{npcDisplay.length}</span>}
        >
          {npcDisplay.length ? (
            <div className="list-group">
              {npcDisplay.map((n) => (
                <Link
                  key={String(n.id)}
                  href={`/npcs?focus=${encodeURIComponent(String(n.id))}`}
                  className="list-group-item list-group-item-action"
                  style={{
                    background: "rgba(0,0,0,0.18)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    color: "rgba(255,255,255,0.92)",
                    marginBottom: 8,
                    borderRadius: 12,
                  }}
                >
                  <div className="d-flex justify-content-between align-items-center">
                    <div className="fw-semibold">{n.name || n.id}</div>
                    <span className="badge text-bg-dark">↗</span>
                  </div>
                  <div className="small" style={{ color: "rgba(255,255,255,0.70)" }}>
                    {(n.race || "Unknown") + " · " + (n.role || "Unknown role")}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="small" style={{ color: "rgba(255,255,255,0.65)" }}>
              No NPCs listed for this location yet.
            </div>
          )}
        </PanelSection>

        {/* Merchants */}
        <PanelSection
          title="Merchants"
          right={<span className="badge text-bg-dark">{merchantsHere.length}</span>}
        >
          {merchantsHere.length ? (
            <div className="d-flex flex-column gap-2">
              {merchantsHere.map((m) => (
                <button
                  key={m.id}
                  className="btn btn-sm btn-outline-info text-start"
                  type="button"
                  onClick={() => onOpenMerchant?.(m)}
                  title="Open store"
                  style={{
                    background: "rgba(0,0,0,0.18)",
                    borderColor: "rgba(0,255,255,0.35)",
                    color: "rgba(255,255,255,0.92)",
                    borderRadius: 12,
                    padding: "10px 12px",
                  }}
                >
                  <div className="d-flex justify-content-between align-items-center">
                    <div className="fw-semibold">{m.name}</div>
                    <span className="badge text-bg-dark">Store</span>
                  </div>
                  <div className="small" style={{ color: "rgba(255,255,255,0.70)" }}>
                    Click to open merchant panel
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="small" style={{ color: "rgba(255,255,255,0.65)" }}>
              No merchants currently tied to this location.
            </div>
          )}
        </PanelSection>

        {/* Quests */}
        <PanelSection
          title="Quests / Rumors"
          right={<span className="badge text-bg-dark">{questDisplay.length}</span>}
        >
          {questDisplay.length ? (
            <div className="d-flex flex-column gap-2">
              {questDisplay.map((q) => (
                <div
                  key={String(q.id)}
                  style={{
                    background: "rgba(0,0,0,0.18)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    borderRadius: 12,
                    padding: 12,
                    color: "rgba(255,255,255,0.92)",
                  }}
                >
                  <div className="d-flex justify-content-between align-items-center">
                    <div className="fw-semibold">{q.name || q.id}</div>
                    {q.status ? <span className="badge text-bg-dark">{q.status}</span> : null}
                  </div>
                  {q.description ? (
                    <div className="small mt-1" style={{ color: "rgba(255,255,255,0.70)", whiteSpace: "pre-wrap" }}>
                      {String(q.description).slice(0, 160)}
                      {String(q.description).length > 160 ? "…" : ""}
                    </div>
                  ) : (
                    <div className="small mt-1" style={{ color: "rgba(255,255,255,0.70)" }}>
                      No details yet.
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="small" style={{ color: "rgba(255,255,255,0.65)" }}>
              No quests/rumors listed for this location yet.
            </div>
          )}
        </PanelSection>

        <div className="small" style={{ color: "rgba(255,255,255,0.55)" }}>
          Tip: Quests are usually tied to NPCs — we can add a simple “quest giver / report to” field later and display it
          inline here.
        </div>
      </div>
    </>
  );
}
