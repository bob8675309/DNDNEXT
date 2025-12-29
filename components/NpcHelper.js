// /components/NpcHelper.js
"use client";

import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { Badge, Button, Form, InputGroup, Modal } from "react-bootstrap";

export default function NPCsPage() {
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === "admin";

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState("all"); // all | npc | merchant
  const [selected, setSelected] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [dbSupportsHidden, setDbSupportsHidden] = useState(true);

  async function loadDirectory() {
    setLoading(true);

    const [npcsRes, merchantsRes] = await Promise.all([
      supabase.from("npcs").select("*"),
      supabase.from("merchants").select("*"),
    ]);

    if (npcsRes.error) console.error("NPC load error:", npcsRes.error);
    if (merchantsRes.error) console.error("Merchant load error:", merchantsRes.error);

    const npcs = (npcsRes.data || []).map((n) => ({
      kind: "npc",
      id: n.id,
      name: n.name,
      race: n.race || null,
      role: n.role || null,
      raw: n,
    }));

    const merchantsData = merchantsRes.data || [];
    const supportsHidden = merchantsData.length === 0 ? true : Object.prototype.hasOwnProperty.call(merchantsData[0], "is_hidden");
    setDbSupportsHidden(supportsHidden);

    const merchants = merchantsData.map((m) => ({
      kind: "merchant",
      id: m.id,
      name: m.name,
      race: "—",
      role: "Merchant",
      icon: m.icon || null,
      state: m.state || null,
      location_id: m.location_id ?? null,
      last_known_location_id: m.last_known_location_id ?? null,
      is_hidden: supportsHidden ? !!m.is_hidden : false,
      raw: m,
    }));

    const combined = [...npcs, ...merchants].sort((a, b) =>
      (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" })
    );

    setRows(combined);
    setLoading(false);
  }

  useEffect(() => {
    loadDirectory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (kindFilter !== "all" && r.kind !== kindFilter) return false;
      if (!q) return true;
      return (
        (r.name || "").toLowerCase().includes(q) ||
        (r.role || "").toLowerCase().includes(q) ||
        (r.race || "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, kindFilter]);

  async function toggleMerchantHidden(merchantRow) {
    if (!dbSupportsHidden) {
      alert("DB column merchants.is_hidden is missing. Run the migration first.");
      return;
    }
    if (!isAdmin) return;

    const next = !merchantRow.is_hidden;

    const { error } = await supabase
      .from("merchants")
      .update({ is_hidden: next })
      .eq("id", merchantRow.id);

    if (error) {
      console.error("Failed to toggle is_hidden:", error);
      alert("Failed to update merchant visibility. Check console.");
      return;
    }

    setRows((prev) =>
      prev.map((r) =>
        r.kind === "merchant" && r.id === merchantRow.id
          ? { ...r, is_hidden: next, raw: { ...r.raw, is_hidden: next } }
          : r
      )
    );

    setSelected((prev) => (prev?.id === merchantRow.id ? { ...prev, is_hidden: next } : prev));
  }

  return (
    <Layout>
      <div className="container py-4">
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
          <h1 className="h3 mb-0">NPC Directory</h1>
          <div className="d-flex gap-2">
            <Form.Select
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value)}
              style={{ width: 200 }}
            >
              <option value="all">All</option>
              <option value="npc">NPCs</option>
              <option value="merchant">Merchants</option>
            </Form.Select>
          </div>
        </div>

        <InputGroup className="mb-3">
          <Form.Control
            placeholder="Search by name, role, race..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button variant="outline-secondary" onClick={() => setSearch("")}>
            Clear
          </Button>
        </InputGroup>

        <div className="card">
          <div className="card-header d-flex align-items-center justify-content-between">
            <div className="fw-semibold">Results</div>
            <div className="text-muted" style={{ fontSize: 13 }}>
              {loading ? "Loading..." : `${filtered.length} shown`}
            </div>
          </div>

          <div className="list-group list-group-flush">
            {loading && (
              <div className="p-3 text-muted">Loading directory...</div>
            )}

            {!loading && filtered.length === 0 && (
              <div className="p-3 text-muted">No matches.</div>
            )}

            {!loading &&
              filtered.map((r) => (
                <button
                  key={`${r.kind}:${r.id}`}
                  type="button"
                  className="list-group-item list-group-item-action d-flex align-items-center justify-content-between"
                  onClick={() => {
                    setSelected(r);
                    setShowModal(true);
                  }}
                >
                  <div className="d-flex align-items-center gap-2">
                    <Badge bg={r.kind === "merchant" ? "warning" : "secondary"} text="dark">
                      {r.kind === "merchant" ? "Merchant" : "NPC"}
                    </Badge>

                    <div className="fw-semibold">{r.name}</div>

                    {r.kind === "merchant" && (
                      <>
                        {r.icon && (
                          <Badge bg="dark" style={{ fontWeight: 600 }}>
                            {r.icon}
                          </Badge>
                        )}
                        {r.is_hidden && (
                          <Badge bg="danger">Hidden</Badge>
                        )}
                      </>
                    )}
                  </div>

                  <div className="text-muted" style={{ fontSize: 13 }}>
                    {r.role || ""}
                  </div>
                </button>
              ))}
          </div>
        </div>

        <Modal
          show={showModal}
          onHide={() => setShowModal(false)}
          centered
        >
          <Modal.Header closeButton>
            <Modal.Title>
              {selected?.name || "Details"}{" "}
              {selected?.kind === "merchant" ? (
                <Badge bg="warning" text="dark" className="ms-2">
                  Merchant
                </Badge>
              ) : (
                <Badge bg="secondary" className="ms-2">
                  NPC
                </Badge>
              )}
            </Modal.Title>
          </Modal.Header>

          <Modal.Body>
            {selected && (
              <>
                <div className="mb-2">
                  <div className="text-muted" style={{ fontSize: 13 }}>
                    Race
                  </div>
                  <div>{selected.race || "—"}</div>
                </div>

                <div className="mb-3">
                  <div className="text-muted" style={{ fontSize: 13 }}>
                    Role
                  </div>
                  <div>{selected.role || "—"}</div>
                </div>

                {selected.kind === "merchant" && (
                  <div className="mb-3">
                    <div className="text-muted" style={{ fontSize: 13 }}>
                      Status
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <Badge bg="info" text="dark">
                        {selected.state || "unknown"}
                      </Badge>
                      {selected.location_id != null && (
                        <Badge bg="success">In town</Badge>
                      )}
                    </div>

                    <div className="text-muted mt-2" style={{ fontSize: 12 }}>
                      location_id: {String(selected.location_id)}
                      <br />
                      last_known_location_id: {String(selected.last_known_location_id)}
                    </div>

                    {isAdmin && (
                      <div className="mt-3">
                        <Form.Check
                          type="switch"
                          id="merchant-hidden-switch"
                          label="Hide merchant from players (map + public lists)"
                          checked={!!selected.is_hidden}
                          disabled={!dbSupportsHidden}
                          onChange={() => toggleMerchantHidden(selected)}
                        />
                        {!dbSupportsHidden && (
                          <div className="text-danger mt-1" style={{ fontSize: 12 }}>
                            merchants.is_hidden missing in DB (run migration).
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-3">
                  <div className="text-muted" style={{ fontSize: 13 }}>
                    Bio
                  </div>
                  <div className="text-muted">
                    (Placeholder) Next step: add a bio/description field (or a separate npc_profiles table)
                    and render it here.
                  </div>
                </div>
              </>
            )}
          </Modal.Body>

          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Close
            </Button>
          </Modal.Footer>
        </Modal>
      </div>
    </Layout>
  );
}
