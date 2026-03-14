import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../utils/apiFetch";
import Card from "../ui/Card.jsx";
import Input from "../ui/Input.jsx";
import Button from "../ui/Button.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "http://192.168.8.135:3000";

export default function StudentNew() {
  const [fullName, setFullName] = useState("");
  const [studentMobile, setStudentMobile] = useState("");
  const [studentWhatsApp, setStudentWhatsApp] = useState("");
  const [parentMobile, setParentMobile] = useState("");
  const [parentName, setParentName] = useState("");
  const [address, setAddress] = useState("");

  const [search, setSearch] = useState("");
  const [students, setStudents] = useState([]);

  const [loadingList, setLoadingList] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const canSubmit = useMemo(() => {
    return fullName.trim() && studentMobile.trim();
  }, [fullName, studentMobile]);

  async function loadStudents() {
    setLoadingList(true);
    setErrorMsg("");
    try {
      const data = await apiFetch(`/students`, { method: "GET" });
      const list = Array.isArray(data) ? data : data?.data ?? [];
      setStudents(list);
    } catch (e) {
      setErrorMsg(e.message || "Failed to load students");
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    loadStudents();
  }, []);

  const filteredStudents = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return students;

    return students.filter((s) => {
      const name = (s.fullName || s.name || "").toLowerCase();
      const mobile = (s.studentMobile || s.phone || "").toLowerCase();
      const whatsapp = (s.studentWhatsApp || "").toLowerCase();

      return (
        name.includes(q) ||
        mobile.includes(q) ||
        whatsapp.includes(q)
      );
    });
  }, [students, search]);

  async function onCreateStudent(e) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const payload = {
        fullName: fullName.trim(),
        studentMobile: studentMobile.trim(),
        studentWhatsApp: studentWhatsApp.trim() || null,
        parentMobile: parentMobile.trim() || null,
        parentName: parentName.trim() || null,
        address: address.trim() || null,
      };

      await apiFetch("/students", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setSuccessMsg("Student registered successfully.");
      setFullName("");
      setStudentMobile("");
      setStudentWhatsApp("");
      setParentMobile("");
      setParentName("");
      setAddress("");

      await loadStudents();
    } catch (e) {
      setErrorMsg(e.message || "Failed to register student");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(student) {
    const current = !!(student.isActive ?? student.active ?? true);
    const next = !current;

    setErrorMsg("");
    setSuccessMsg("");

    try {
      await apiFetch(`/students/${student.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: next }),
      });
      setSuccessMsg(`Student ${next ? "activated" : "deactivated"}.`);
      await loadStudents();
    } catch (e) {
      setErrorMsg(e.message || "Failed to update status");
    }
  }

  async function deleteStudent(student) {
    const ok = window.confirm(`Delete student "${student.fullName || student.name}"?`);
    if (!ok) return;

    setErrorMsg("");
    setSuccessMsg("");

    try {
      await apiFetch(`/students/${student.id}`, { method: "DELETE" });
      setSuccessMsg("Student deleted.");
      await loadStudents();
    } catch (e) {
      setErrorMsg(e.message || "Failed to delete student");
    }
  }

  return (
    <div className="grid gap-4">
      <Card title="Register Student">
        <form onSubmit={onCreateStudent} className="form">
          {errorMsg ? <div className="error">{errorMsg}</div> : null}
          {successMsg ? <div className="success">{successMsg}</div> : null}

          <label className="label">Full Name</label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="" />

          <label className="label">Student Mobile</label>
          <Input value={studentMobile} onChange={(e) => setStudentMobile(e.target.value)} placeholder="07xxxxxxxx" />

          <label className="label">Student WhatsApp</label>
          <Input value={studentWhatsApp} onChange={(e) => setStudentWhatsApp(e.target.value)} placeholder="07xxxxxxxx" />

          <label className="label">Parent Name</label>
          <Input value={parentName} onChange={(e) => setParentName(e.target.value)} placeholder="" />

          <label className="label">Parent Mobile</label>
          <Input value={parentMobile} onChange={(e) => setParentMobile(e.target.value)} placeholder="07xxxxxxxx" />

          <label className="label">Address</label>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="" />

          <Button type="submit" disabled={!canSubmit || submitting}>
            {submitting ? "Saving..." : "Register Student"}
          </Button>
        </form>
      </Card>

      <Card title="Students List">
        <div className="grid gap-3">
          <div className="grid" style={{ gridTemplateColumns: "1fr auto", gap: 12 }}>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name / mobile / WhatsApp"
            />
            <Button type="button" onClick={loadStudents} disabled={loadingList}>
              {loadingList ? "Loading..." : "Refresh"}
            </Button>
          </div>

          <div className="tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Full Name</th>
                  <th>Student Mobile</th>
                  <th>Student WhatsApp</th>
                  <th>Parent</th>
                  <th>Address</th>
                  <th>Status</th>
                  <th style={{ width: 220 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="muted">
                      {loadingList ? "Loading..." : "No students found."}
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((s) => {
                    const name = s.fullName ?? s.name ?? "-";
                    const stuMob = s.studentMobile ?? s.phone ?? "-";
                    const stuWhatsApp = s.studentWhatsApp ?? "-";
                    const pName = s.parentName ?? "-";
                    const pMob = s.parentMobile ?? "-";
                    const addr = s.address ?? "-";
                    const isActive = !!(s.isActive ?? s.active ?? true);

                    return (
                      <tr key={s.id}>
                        <td>{name}</td>
                        <td>{stuMob}</td>
                        <td>{stuWhatsApp}</td>
                        <td>
                          <div style={{ display: "grid" }}>
                            <span>{pName}</span>
                            <span className="muted">{pMob}</span>
                          </div>
                        </td>
                        <td>{addr}</td>
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
                            <Button type="button" onClick={() => deleteStudent(s)}>
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