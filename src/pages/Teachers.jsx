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

export default function Teachers() {
  // form fields (match your API)
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [address, setAddress] = useState("");

  // list + UI search
  const [teachers, setTeachers] = useState([]);
  const [search, setSearch] = useState("");

  const [loadingList, setLoadingList] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const canSubmit = useMemo(() => {
    return fullName.trim() && mobile.trim();
  }, [fullName, mobile]);

  async function loadTeachers() {
    setLoadingList(true);
    setErrorMsg("");
    try {
      const data = await apiFetch("/teachers", { method: "GET" });
      const list = Array.isArray(data) ? data : data?.data ?? [];
      setTeachers(list);
    } catch (e) {
      setErrorMsg(e.message || "Failed to load teachers");
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    loadTeachers();
  }, []);

  // ✅ UI filter by name OR number
  const filteredTeachers = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return teachers;

    return teachers.filter((t) => {
      const name = (t.fullName || t.name || "").toLowerCase();
      const mob = (t.mobile || t.phone || "").toLowerCase();
      return name.includes(q) || mob.includes(q);
    });
  }, [teachers, search]);

  async function onCreateTeacher(e) {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const payload = {
        fullName: fullName.trim(),
        mobile: mobile.trim(),
        address: address.trim() || null,
      };

      await apiFetch("/teachers", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setSuccessMsg("Teacher registered successfully.");
      setFullName("");
      setMobile("");
      setAddress("");

      await loadTeachers();
    } catch (e) {
      setErrorMsg(e.message || "Failed to register teacher");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(teacher) {
    const current = !!(teacher.isActive ?? teacher.active ?? true);
    const next = !current;

    setErrorMsg("");
    setSuccessMsg("");

    try {
      await apiFetch(`/teachers/${teacher.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: next }),
      });
      setSuccessMsg(`Teacher ${next ? "activated" : "deactivated"}.`);
      await loadTeachers();
    } catch (e) {
      setErrorMsg(e.message || "Failed to update status");
    }
  }

  async function deleteTeacher(teacher) {
    const ok = window.confirm(`Delete teacher "${teacher.fullName || teacher.name}"?`);
    if (!ok) return;

    setErrorMsg("");
    setSuccessMsg("");

    try {
      await apiFetch(`/teachers/${teacher.id}`, { method: "DELETE" });
      setSuccessMsg("Teacher deleted.");
      await loadTeachers();
    } catch (e) {
      setErrorMsg(e.message || "Failed to delete teacher");
    }
  }

  return (
    <div className="grid gap-4">
      <Card title="Register Teacher">
        <form onSubmit={onCreateTeacher} className="form">
          {errorMsg ? <div className="error">{errorMsg}</div> : null}
          {successMsg ? <div className="success">{successMsg}</div> : null}

          <label className="label">Full Name</label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="" />

          <label className="label">Mobile</label>
          <Input value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="" />

          <label className="label">Address</label>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="" />

          <Button type="submit" disabled={!canSubmit || submitting}>
            {submitting ? "Saving..." : "Register Teacher"}
          </Button>
        </form>
      </Card>

      <Card title="Teachers List">
        <div className="grid gap-3">
          <div className="grid" style={{ gridTemplateColumns: "1fr auto", gap: 12 }}>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or mobile..."
            />
            <Button type="button" onClick={loadTeachers} disabled={loadingList}>
              {loadingList ? "Loading..." : "Refresh"}
            </Button>
          </div>

          <div className="tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Full Name</th>
                  <th>Mobile</th>
                  <th>Address</th>
                  <th>Status</th>
                  <th style={{ width: 220 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeachers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted">
                      {loadingList ? "Loading..." : "No teachers found."}
                    </td>
                  </tr>
                ) : (
                  filteredTeachers.map((t) => {
                    const name = t.fullName ?? t.name ?? "-";
                    const mob = t.mobile ?? t.phone ?? "-";
                    const addr = t.address ?? "-";
                    const isActive = !!(t.isActive ?? t.active ?? true);

                    return (
                      <tr key={t.id}>
                        <td>{name}</td>
                        <td>{mob}</td>
                        <td>{addr}</td>
                        <td>
                          <span className={isActive ? "badge badgeOk" : "badge badgeOff"}>
                            {isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <Button type="button" onClick={() => toggleActive(t)}>
                              {isActive ? "Deactivate" : "Activate"}
                            </Button>
                            <Button type="button" onClick={() => deleteTeacher(t)}>
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