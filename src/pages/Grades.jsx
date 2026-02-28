import { useEffect, useMemo, useState } from "react";
import Card from "../ui/Card.jsx";
import Input from "../ui/Input.jsx";
import Button from "../ui/Button.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const text = await res.text();
  const data = text
    ? (() => {
        try {
          return JSON.parse(text);
        } catch {
          return text;
        }
      })()
    : null;

  if (!res.ok) {
    const msg =
      (data && typeof data === "object" && (data.message || data.error)) ||
      (typeof data === "string" ? data : "Request failed");
    throw new Error(msg);
  }
  return data;
}

export default function Grades() {
  const [name, setName] = useState("");

  const [grades, setGrades] = useState([]);
  const [search, setSearch] = useState("");

  const [loadingList, setLoadingList] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const canSubmit = useMemo(() => name.trim().length > 0, [name]);

  async function loadGrades() {
    setLoadingList(true);
    setErrorMsg("");
    try {
      const data = await apiFetch("/grades", { method: "GET" });
      const list = Array.isArray(data) ? data : data?.data ?? [];
      setGrades(list);
    } catch (e) {
      setErrorMsg(e.message || "Failed to load grades");
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    loadGrades();
  }, []);

  // UI filter by name (grade name)
  const filteredGrades = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return grades;
    return grades.filter((g) => (g.name || "").toLowerCase().includes(q));
  }, [grades, search]);

  async function onCreateGrade(e) {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      // matches your API body: { "name": "11" }
      await apiFetch("/grades", {
        method: "POST",
        body: JSON.stringify({ name: name.trim() }),
      });

      setSuccessMsg("Grade registered successfully.");
      setName("");
      await loadGrades();
    } catch (e) {
      setErrorMsg(e.message || "Failed to register grade");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(grade) {
    const current = !!(grade.isActive ?? grade.active ?? true);
    const next = !current;

    setErrorMsg("");
    setSuccessMsg("");

    try {
      await apiFetch(`/grades/${grade.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: next }),
      });
      setSuccessMsg(`Grade ${next ? "activated" : "deactivated"}.`);
      await loadGrades();
    } catch (e) {
      setErrorMsg(e.message || "Failed to update status");
    }
  }

  async function deleteGrade(grade) {
    const ok = window.confirm(`Delete grade "${grade.name}"?`);
    if (!ok) return;

    setErrorMsg("");
    setSuccessMsg("");

    try {
      await apiFetch(`/grades/${grade.id}`, { method: "DELETE" });
      setSuccessMsg("Grade deleted.");
      await loadGrades();
    } catch (e) {
      setErrorMsg(e.message || "Failed to delete grade");
    }
  }

  return (
    <div className="grid gap-4">
      <Card title="Register Grade">
        <form onSubmit={onCreateGrade} className="form">
          {errorMsg ? <div className="error">{errorMsg}</div> : null}
          {successMsg ? <div className="success">{successMsg}</div> : null}

          <label className="label">Grade Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="11" />

          <Button type="submit" disabled={!canSubmit || submitting}>
            {submitting ? "Saving..." : "Add Grade"}
          </Button>
        </form>
      </Card>

      <Card title="Grades List">
        <div className="grid gap-3">
          <div className="grid" style={{ gridTemplateColumns: "1fr auto", gap: 12 }}>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search grade..."
            />
            <Button type="button" onClick={loadGrades} disabled={loadingList}>
              {loadingList ? "Loading..." : "Refresh"}
            </Button>
          </div>

          <div className="tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Grade</th>
                  <th>Status</th>
                  <th style={{ width: 220 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredGrades.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="muted">
                      {loadingList ? "Loading..." : "No grades found."}
                    </td>
                  </tr>
                ) : (
                  filteredGrades.map((g) => {
                    const isActive = !!(g.isActive ?? g.active ?? true);
                    return (
                      <tr key={g.id}>
                        <td>{g.name}</td>
                        <td>
                          <span className={isActive ? "badge badgeOk" : "badge badgeOff"}>
                            {isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <Button type="button" onClick={() => toggleActive(g)}>
                              {isActive ? "Deactivate" : "Activate"}
                            </Button>
                            <Button type="button" onClick={() => deleteGrade(g)}>
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
}