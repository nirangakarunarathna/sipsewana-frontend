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

export default function Classes() {
  // dropdown data
  const [grades, setGrades] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);

  // form
  const [gradeId, setGradeId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [name, setName] = useState("");
  const [fee, setFee] = useState("");

  // list
  const [classes, setClasses] = useState([]);
  const [search, setSearch] = useState("");

  const [loadingRefs, setLoadingRefs] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const canSubmit = useMemo(() => {
    return gradeId && subjectId && teacherId && name.trim() && String(fee).trim() !== "";
  }, [gradeId, subjectId, teacherId, name, fee]);

  async function loadRefs() {
    setLoadingRefs(true);
    setErrorMsg("");
    try {
      const [g, s, t] = await Promise.all([
        apiFetch("/grades", { method: "GET" }),
        apiFetch("/subjects", { method: "GET" }),
        apiFetch("/teachers", { method: "GET" }),
      ]);

      const gList = Array.isArray(g) ? g : g?.data ?? [];
      const sList = Array.isArray(s) ? s : s?.data ?? [];
      const tList = Array.isArray(t) ? t : t?.data ?? [];

      setGrades(gList);
      setSubjects(sList);
      setTeachers(tList);

      // set defaults
      setGradeId((prev) => prev || (gList[0]?.id ? String(gList[0].id) : ""));
      setSubjectId((prev) => prev || (sList[0]?.id ? String(sList[0].id) : ""));
      setTeacherId((prev) => prev || (tList[0]?.id ? String(tList[0].id) : ""));
    } catch (e) {
      setErrorMsg(e.message || "Failed to load grades/subjects/teachers");
    } finally {
      setLoadingRefs(false);
    }
  }

  async function loadClasses() {
    setLoadingList(true);
    setErrorMsg("");
    try {
      const data = await apiFetch("/classes", { method: "GET" });
      const list = Array.isArray(data) ? data : data?.data ?? [];
      setClasses(list);
    } catch (e) {
      setErrorMsg(e.message || "Failed to load classes");
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    loadRefs();
    loadClasses();
  }, []);

  const filteredClasses = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return classes;

    return classes.filter((c) => {
      const n = (c.name || "").toLowerCase();
      const g = (c.grade?.name || c.gradeName || "").toLowerCase();
      const s = (c.subject?.name || c.subjectName || "").toLowerCase();
      const t = (c.teacher?.fullName || c.teacherName || "").toLowerCase();
      return n.includes(q) || g.includes(q) || s.includes(q) || t.includes(q);
    });
  }, [classes, search]);

  async function onCreateClass(e) {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const payload = {
        gradeId: Number(gradeId),
        subjectId: Number(subjectId),
        teacherId: Number(teacherId),
        name: name.trim(),
        fee: Number(fee),
      };

      await apiFetch("/classes", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setSuccessMsg("Class registered successfully.");
      setName("");
      setFee("");
      await loadClasses();
    } catch (e) {
      setErrorMsg(e.message || "Failed to register class");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteClass(row) {
    const ok = window.confirm(`Delete class "${row.name}"?`);
    if (!ok) return;

    setErrorMsg("");
    setSuccessMsg("");

    try {
      await apiFetch(`/classes/${row.id}`, { method: "DELETE" });
      setSuccessMsg("Class deleted.");
      await loadClasses();
    } catch (e) {
      setErrorMsg(e.message || "Failed to delete class");
    }
  }

  // OPTIONAL: if you have status endpoint
  async function toggleActive(row) {
    const current = !!(row.isActive ?? row.active ?? true);
    const next = !current;

    setErrorMsg("");
    setSuccessMsg("");

    try {
      await apiFetch(`/classes/${row.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: next }),
      });
      setSuccessMsg(`Class ${next ? "activated" : "deactivated"}.`);
      await loadClasses();
    } catch (e) {
      setErrorMsg(e.message || "Failed to update status");
    }
  }

  return (
    <div className="grid gap-4">
      <Card title="Register Class">
        <form onSubmit={onCreateClass} className="form">
          {errorMsg ? <div className="error">{errorMsg}</div> : null}
          {successMsg ? <div className="success">{successMsg}</div> : null}

          <label className="label">Grade</label>
          <select
            className="input"
            value={gradeId}
            onChange={(e) => setGradeId(e.target.value)}
            disabled={loadingRefs}
          >
            {grades.map((g) => (
              <option key={g.id} value={String(g.id)}>
                {g.name}
              </option>
            ))}
          </select>
          {!grades.length ? <div className="muted">Add grades first.</div> : null}

          <label className="label">Subject</label>
          <select
            className="input"
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            disabled={loadingRefs}
          >
            {subjects.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.name}
              </option>
            ))}
          </select>
          {!subjects.length ? <div className="muted">Add subjects first.</div> : null}

          <label className="label">Teacher</label>
          <select
            className="input"
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            disabled={loadingRefs}
          >
            {teachers.map((t) => (
              <option key={t.id} value={String(t.id)}>
                {t.fullName ?? t.name ?? `Teacher #${t.id}`}
              </option>
            ))}
          </select>
          {!teachers.length ? <div className="muted">Add teachers first.</div> : null}

          <label className="label">Class Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Grade 2 / Dancing" />

          <label className="label">Fee</label>
          <Input
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            placeholder="1200"
            inputMode="numeric"
          />

          <Button type="submit" disabled={!canSubmit || submitting || loadingRefs}>
            {submitting ? "Saving..." : "Register Class"}
          </Button>
        </form>
      </Card>

      <Card title="Classes List">
        <div className="grid gap-3">
          <div className="grid" style={{ gridTemplateColumns: "1fr auto auto", gap: 12 }}>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by class / grade / subject / teacher..."
            />
            <Button type="button" onClick={loadRefs} disabled={loadingRefs}>
              {loadingRefs ? "Loading..." : "Reload Dropdowns"}
            </Button>
            <Button type="button" onClick={loadClasses} disabled={loadingList}>
              {loadingList ? "Loading..." : "Refresh"}
            </Button>
          </div>

          <div className="tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Grade</th>
                  <th>Subject</th>
                  <th>Teacher</th>
                  <th>Fee</th>
                  <th>Status</th>
                  <th style={{ width: 260 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredClasses.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="muted">
                      {loadingList ? "Loading..." : "No classes found."}
                    </td>
                  </tr>
                ) : (
                  filteredClasses.map((c) => {
                    const isActive = !!(c.isActive ?? c.active ?? true);

                    const gradeName = c.grade?.name ?? c.gradeName ?? c.grade?.title ?? "-";
                    const subjectName = c.subject?.name ?? c.subjectName ?? "-";
                    const teacherName = c.teacher?.fullName ?? c.teacherName ?? c.teacher?.name ?? "-";

                    return (
                      <tr key={c.id}>
                        <td>{c.name}</td>
                        <td>{gradeName}</td>
                        <td>{subjectName}</td>
                        <td>{teacherName}</td>
                        <td>{c.fee ?? "-"}</td>
                        <td>
                          <span className={isActive ? "badge badgeOk" : "badge badgeOff"}>
                            {isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {/* If you don't have status endpoint, remove this button */}
                            <Button type="button" onClick={() => toggleActive(c)}>
                              {isActive ? "Deactivate" : "Activate"}
                            </Button>
                            <Button type="button" onClick={() => deleteClass(c)}>
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

          <div className="muted">
            Dropdowns load from Grades / Subjects / Teachers. Register sends IDs (gradeId, subjectId, teacherId) exactly like Postman.
          </div>
        </div>
      </Card>
    </div>
  );
}