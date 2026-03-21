import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../utils/apiFetch";
import Card from "../ui/Card.jsx";
import Input from "../ui/Input.jsx";
import Button from "../ui/Button.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "http://10.201.39.38:3000";

// async function apiFetch(path, options = {}) {
//   const res = await fetch(`${API_BASE}${path}`, {
//     headers: {
//       "Content-Type": "application/json",
//       ...(options.headers || {}),
//     },
//     ...options,
//   });

//   const text = await res.text();
//   const data = text
//     ? (() => {
//         try {
//           return JSON.parse(text);
//         } catch {
//           return text;
//         }
//       })()
//     : null;

//   if (!res.ok) {
//     const msg =
//       (data && typeof data === "object" && (data.message || data.error)) ||
//       (typeof data === "string" ? data : "Request failed");
//     throw new Error(msg);
//   }
//   return data;
// }

export default function SubjectsPage() {
  const [name, setName] = useState("");

  const [subjects, setSubjects] = useState([]);
  const [search, setSearch] = useState("");

  const [loadingList, setLoadingList] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const canSubmit = useMemo(() => name.trim().length > 0, [name]);

  async function loadSubjects() {
    setLoadingList(true);
    setErrorMsg("");
    try {
      const data = await apiFetch("/subjects", { method: "GET" });
      const list = Array.isArray(data) ? data : data?.data ?? [];
      setSubjects(list);
    } catch (e) {
      setErrorMsg(e.message || "Failed to load subjects");
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    loadSubjects();
  }, []);

  // UI filter by name
  const filteredSubjects = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return subjects;
    return subjects.filter((s) => (s.name || "").toLowerCase().includes(q));
  }, [subjects, search]);

  async function onCreateSubject(e) {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      await apiFetch("/subjects", {
        method: "POST",
        body: JSON.stringify({ name: name.trim() }),
      });

      setSuccessMsg("Subject registered successfully.");
      setName("");
      await loadSubjects();
    } catch (e) {
      setErrorMsg(e.message || "Failed to register subject");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(subject) {
    const current = !!(subject.isActive ?? subject.active ?? true);
    const next = !current;

    setErrorMsg("");
    setSuccessMsg("");

    try {
      await apiFetch(`/subjects/${subject.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: next }),
      });
      setSuccessMsg(`Subject ${next ? "activated" : "deactivated"}.`);
      await loadSubjects();
    } catch (e) {
      setErrorMsg(e.message || "Failed to update status");
    }
  }

  async function deleteSubject(subject) {
    const ok = window.confirm(`Delete subject "${subject.name}"?`);
    if (!ok) return;

    setErrorMsg("");
    setSuccessMsg("");

    try {
      await apiFetch(`/subjects/${subject.id}`, { method: "DELETE" });
      setSuccessMsg("Subject deleted.");
      await loadSubjects();
    } catch (e) {
      setErrorMsg(e.message || "Failed to delete subject");
    }
  }

  return (
    <div className="grid gap-4">
      <Card title="Register Subject">
        <form onSubmit={onCreateSubject} className="form">
          {errorMsg ? <div className="error">{errorMsg}</div> : null}
          {successMsg ? <div className="success">{successMsg}</div> : null}

          <label className="label">Subject Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Maths" />

          <Button type="submit" disabled={!canSubmit || submitting}>
            {submitting ? "Saving..." : "Add Subject"}
          </Button>
        </form>
      </Card>

      <Card title="Subjects List">
        <div className="grid gap-3">
          <div className="grid" style={{ gridTemplateColumns: "1fr auto", gap: 12 }}>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search subject by name..."
            />
            <Button type="button" onClick={loadSubjects} disabled={loadingList}>
              {loadingList ? "Loading..." : "Refresh"}
            </Button>
          </div>

          <div className="tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Status</th>
                  <th style={{ width: 220 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubjects.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="muted">
                      {loadingList ? "Loading..." : "No subjects found."}
                    </td>
                  </tr>
                ) : (
                  filteredSubjects.map((s) => {
                    const isActive = !!(s.isActive ?? s.active ?? true);

                    return (
                      <tr key={s.id}>
                        <td>{s.name}</td>
                        <td>
                          <span className={isActive ? "badge badgeOk" : "badge badgeOff"}>
                            {isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <Button type="button" onClick={() => toggleActive(s)}>
                              {isActive ? "Deactivate" : "Activate"}
                            </Button>
                            <Button type="button" onClick={() => deleteSubject(s)}>
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