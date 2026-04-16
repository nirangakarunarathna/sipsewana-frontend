import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "../utils/apiFetch";
import Card from "../ui/Card.jsx";
import Input from "../ui/Input.jsx";
import Button from "../ui/Button.jsx";

const API_BASE = import.meta.env.VITE_API_URL ;

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

export default function StudentClassAssign() {
  // dropdown data
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState("");

  // load all students once
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // student search + select
  const [studentQuery, setStudentQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null); // {id, fullName, studentMobile}

  // results
  const [classStudents, setClassStudents] = useState([]);
  const [studentClasses, setStudentClasses] = useState([]);

  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingLists, setLoadingLists] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const boxRef = useRef(null);
  const [showDropdown, setShowDropdown] = useState(false);

  // Load all classes
  async function loadClasses() {
    setLoadingClasses(true);
    setErrorMsg("");
    try {
      const data = await apiFetch("/classes", { method: "GET" });
      const list = Array.isArray(data) ? data : data?.data ?? [];
      setClasses(list);
      setClassId((prev) => prev || (list[0]?.id ? String(list[0].id) : ""));
    } catch (e) {
      setErrorMsg(e.message || "Failed to load classes");
    } finally {
      setLoadingClasses(false);
    }
  }

  // Load all students once
  async function loadStudents() {
    setLoadingStudents(true);
    setErrorMsg("");
    try {
      const data = await apiFetch("/students", { method: "GET" });
      const list = Array.isArray(data) ? data : data?.data ?? [];
      setStudents(list);
    } catch (e) {
      setErrorMsg(e.message || "Failed to load students");
    } finally {
      setLoadingStudents(false);
    }
  }

  async function loadClassStudents(cid) {
    if (!cid) return;
    setLoadingLists(true);
    setErrorMsg("");
    try {
      const data = await apiFetch(`/student-classes?classId=${encodeURIComponent(cid)}`, { method: "GET" });
      const list = Array.isArray(data) ? data : data?.data ?? [];
      setClassStudents(list);
    } catch (e) {
      setErrorMsg(e.message || "Failed to load class students");
    } finally {
      setLoadingLists(false);
    }
  }

  async function loadStudentClasses(sid) {
    if (!sid) return;
    setLoadingLists(true);
    setErrorMsg("");
    try {
      const data = await apiFetch(`/student-classes?studentId=${encodeURIComponent(sid)}`, { method: "GET" });
      const list = Array.isArray(data) ? data : data?.data ?? [];
      setStudentClasses(list);
    } catch (e) {
      setErrorMsg(e.message || "Failed to load student classes");
    } finally {
      setLoadingLists(false);
    }
  }

  useEffect(() => {
    loadClasses();
    loadStudents();
  }, []);

  // Auto load class-wise list when class changes
  useEffect(() => {
    if (classId) loadClassStudents(classId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  // Close suggestions on outside click
  useEffect(() => {
    function onDocClick(e) {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target)) setShowDropdown(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // ✅ UI suggestions from already-loaded students (limit 12)
  const studentSuggestions = useMemo(() => {
    const q = studentQuery.toLowerCase().trim();
    if (!q || q.length < 1) return [];

    // if user already selected, don't show list
    if (selectedStudent) return [];

    const matches = students.filter((s) => {
      const name = (s.fullName || s.name || "").toLowerCase();
      const mobile = (s.studentMobile || s.phone || "").toLowerCase();
      const parentMobile = (s.parentMobile || "").toLowerCase();
      return name.includes(q) || mobile.includes(q) || parentMobile.includes(q);
    });

    return matches.slice(0, 12);
  }, [studentQuery, students, selectedStudent]);

  function selectStudent(s) {
    const picked = {
      id: s.id,
      fullName: s.fullName ?? s.name ?? "",
      studentMobile: s.studentMobile ?? s.phone ?? "",
    };
    setSelectedStudent(picked);
    setStudentQuery(`${picked.fullName} (${picked.studentMobile})`);
    setShowDropdown(false);

    // load student-wise classes automatically
    loadStudentClasses(picked.id);
  }

  function clearStudent() {
    setSelectedStudent(null);
    setStudentQuery("");
    setStudentClasses([]);
    setShowDropdown(false);
  }

  const canAssign = useMemo(() => !!classId && !!selectedStudent?.id, [classId, selectedStudent]);

  async function assignStudent() {
    if (!canAssign) return;

    setAssigning(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      await apiFetch("/student-classes", {
        method: "POST",
        body: JSON.stringify({
          studentId: Number(selectedStudent.id),
          classId: Number(classId),
        }),
      });

      setSuccessMsg("Student assigned to class successfully.");
      await loadClassStudents(classId);
      await loadStudentClasses(selectedStudent.id);
    } catch (e) {
      setErrorMsg(e.message || "Failed to assign student");
    } finally {
      setAssigning(false);
    }
  }

  // Helpers: normalize list shapes
  function readStudent(row) {
    const st = row.student ?? row;
    return {
      id: st.id ?? row.studentId,
      name: st.fullName ?? st.name ?? row.studentName ?? "-",
      mobile: st.studentMobile ?? st.phone ?? row.studentMobile ?? "-",
    };
  }

  function readClass(row) {
    const cl = row.class ?? row;
    return {
      id: cl.id ?? row.classId,
      name: cl.name ?? row.className ?? "-",
      fee: cl.fee ?? row.fee ?? "-",
    };
  }

  return (
    <div className="grid gap-4">
      <Card title="Assign Students to Class">
        {errorMsg ? <div className="error">{errorMsg}</div> : null}
        {successMsg ? <div className="success">{successMsg}</div> : null}

        <div className="form">
          <label className="label">Class</label>
          <select
            className="input"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            disabled={loadingClasses}
          >
            {classes.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name} {c.fee != null ? `- Rs.${c.fee}` : ""}
              </option>
            ))}
          </select>

          <label className="label">Student (type name or mobile)</label>

          <div ref={boxRef} style={{ position: "relative" }}>
            <Input
              value={studentQuery}
              onChange={(e) => {
                setStudentQuery(e.target.value);
                setSelectedStudent(null);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder={loadingStudents ? "Loading students..." : "Type student name or mobile..."}
              disabled={loadingStudents}
            />

            {selectedStudent ? (
              <div className="muted" style={{ marginTop: 6, display: "flex", gap: 10, alignItems: "center" }}>
                <span>
                  Selected: <b>{selectedStudent.fullName}</b> ({selectedStudent.studentMobile})
                </span>
                <Button type="button" onClick={clearStudent}>Clear</Button>
              </div>
            ) : null}

            {showDropdown && !loadingStudents && studentSuggestions.length > 0 ? (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: "100%",
                  zIndex: 10,
                  background: "white",
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  marginTop: 6,
                  overflow: "hidden",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
                  maxHeight: 280,
                  overflowY: "auto",
                }}
              >
                {studentSuggestions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => selectStudent(s)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 12px",
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                    }}
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{s.fullName ?? s.name ?? "-"}</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {s.address ?? ""}
                        </div>
                      </div>
                      <div style={{ fontWeight: 600 }}>
                        {s.studentMobile ?? s.phone ?? "-"}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : null}

            {showDropdown && !loadingStudents && studentQuery.trim() && studentSuggestions.length === 0 && !selectedStudent ? (
              <div className="muted" style={{ marginTop: 6 }}>
                No matching students.
              </div>
            ) : null}
          </div>

          <Button type="button" disabled={!canAssign || assigning} onClick={assignStudent}>
            {assigning ? "Assigning..." : "Assign Student to Class"}
          </Button>

          <div className="muted">
            Loaded students: <b>{students.length}</b>. Type and select student from suggestions.
          </div>
        </div>
      </Card>

      <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <Card title="Class-wise Students">
          <div className="muted" style={{ marginBottom: 10 }}>
            Showing students for selected class.
          </div>

          <Button type="button" onClick={() => loadClassStudents(classId)} disabled={loadingLists || !classId}>
            {loadingLists ? "Loading..." : "Refresh"}
          </Button>

          <div className="tableWrap" style={{ marginTop: 10 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Mobile</th>
                </tr>
              </thead>
              <tbody>
                {classStudents.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="muted">
                      {loadingLists ? "Loading..." : "No students for this class."}
                    </td>
                  </tr>
                ) : (
                  classStudents.map((row, idx) => {
                    const s = readStudent(row);
                    return (
                      <tr key={row.id ?? `${s.id}-${idx}`}>
                        <td>{s.name}</td>
                        <td>{s.mobile}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Student-wise Classes">
          <div className="muted" style={{ marginBottom: 10 }}>
            Select a student to view their classes.
          </div>

          <Button
            type="button"
            onClick={() => selectedStudent?.id && loadStudentClasses(selectedStudent.id)}
            disabled={loadingLists || !selectedStudent?.id}
          >
            {loadingLists ? "Loading..." : "Refresh"}
          </Button>

          <div className="tableWrap" style={{ marginTop: 10 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Fee</th>
                </tr>
              </thead>
              <tbody>
                {!selectedStudent?.id ? (
                  <tr>
                    <td colSpan={2} className="muted">Select a student first.</td>
                  </tr>
                ) : studentClasses.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="muted">
                      {loadingLists ? "Loading..." : "No classes for this student."}
                    </td>
                  </tr>
                ) : (
                  studentClasses.map((row, idx) => {
                    const c = readClass(row);
                    return (
                      <tr key={row.id ?? `${c.id}-${idx}`}>
                        <td>{c.name}</td>
                        <td>{c.fee}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}