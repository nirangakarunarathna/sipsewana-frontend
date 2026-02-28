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

// helpers
function ymNow() {
  return new Date().toISOString().slice(0, 7);
}

function fmtDate(d) {
  // expects YYYY-MM-DD
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}`; // 01/03 style
}

export default function AttendanceMark() {
  // selectors
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState("");
  const [yearMonth, setYearMonth] = useState(ymNow());

  // loaded data
  const [sessions, setSessions] = useState([]); // {id, session_date, start_time, end_time}
  const [students, setStudents] = useState([]); // {id/studentId, fullName/name,...}
  const [existingAttendance, setExistingAttendance] = useState([]); // from API

  // grid state: { [studentId]: { [sessionId]: true/false } }
  const [grid, setGrid] = useState({});

  // loading + messages
  const [loadingRefs, setLoadingRefs] = useState(false);
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [saving, setSaving] = useState(false);

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // ----------------------------
  // Load classes
  // ----------------------------
  async function loadClasses() {
    setLoadingRefs(true);
    setErrorMsg("");
    try {
      const data = await apiFetch("/classes");
      const list = Array.isArray(data) ? data : data?.data ?? [];
      setClasses(list);
      if (!classId && list[0]?.id) setClassId(String(list[0].id));
    } catch (e) {
      setErrorMsg(e.message || "Failed to load classes");
    } finally {
      setLoadingRefs(false);
    }
  }

  // ----------------------------
  // Load sessions + students + attendance for selected class & month
  // ----------------------------
  async function loadAttendanceGrid(selectedClassId, selectedYearMonth) {
    if (!selectedClassId || !selectedYearMonth) return;

    setLoadingGrid(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const [sessRes, stuRes, attRes] = await Promise.all([
        apiFetch(
          `/class-sessions?classId=${selectedClassId}&yearMonth=${selectedYearMonth}`
        ),
        apiFetch(`/student-classes?classId=${selectedClassId}`),
        apiFetch(
          `/attendance?classId=${selectedClassId}&yearMonth=${selectedYearMonth}`
        ),
      ]);

      const sessList = Array.isArray(sessRes) ? sessRes : sessRes?.data ?? [];
      const stuList = Array.isArray(stuRes) ? stuRes : stuRes?.data ?? [];
      const attList = Array.isArray(attRes) ? attRes : attRes?.data ?? [];

      setSessions(sessList);
      setStudents(stuList);
      setExistingAttendance(attList);

      // Build initial grid:
      // default false (absent) for all student-session,
      // then apply existing attendance (status P -> true)
      const next = {};

      // initialize all to false
      for (const st of stuList) {
        const sid = String(st.studentId ?? st.student_id ?? st.id ?? st.StudentID);
        next[sid] = {};
        for (const ses of sessList) {
          next[sid][String(ses.id)] = false;
        }
      }

      // apply existing
      // expected attendance item shape:
      // { session_id, student_id, status } OR {sessionId, studentId, status}
      for (const a of attList) {
        const sid = String(a.student_id ?? a.studentId);
        const sesId = String(a.session_id ?? a.sessionId);
        if (next[sid] && Object.prototype.hasOwnProperty.call(next[sid], sesId)) {
          next[sid][sesId] = (a.status ?? "A") === "P";
        }
      }

      setGrid(next);
    } catch (e) {
      setErrorMsg(e.message || "Failed to load attendance");
      setSessions([]);
      setStudents([]);
      setExistingAttendance([]);
      setGrid({});
    } finally {
      setLoadingGrid(false);
    }
  }

  useEffect(() => {
    loadClasses();
  }, []);

  useEffect(() => {
    if (classId && yearMonth) {
      loadAttendanceGrid(classId, yearMonth);
    }
  }, [classId, yearMonth]);

  // ----------------------------
  // Toggle checkbox
  // ----------------------------
  function toggleCell(studentId, sessionId) {
    setGrid((prev) => {
      const sid = String(studentId);
      const sesId = String(sessionId);
      const cur = !!prev?.[sid]?.[sesId];

      return {
        ...prev,
        [sid]: {
          ...(prev[sid] || {}),
          [sesId]: !cur,
        },
      };
    });
  }

  // ----------------------------
  // Header actions: mark all present/absent for a session (column)
  // ----------------------------
  function setColumn(sessionId, value) {
    setGrid((prev) => {
      const sesId = String(sessionId);
      const next = { ...prev };
      for (const st of students) {
        const sid = String(st.studentId ?? st.student_id ?? st.id ?? st.StudentID);
        if (!next[sid]) next[sid] = {};
        next[sid] = { ...next[sid], [sesId]: value };
      }
      return next;
    });
  }

  // ----------------------------
  // Save all (requires backend bulk endpoint)
  // ----------------------------
  async function saveAll() {
    if (!classId || !yearMonth) return;
    if (!sessions.length || !students.length) {
      setErrorMsg("No sessions or students found for selected month/class.");
      return;
    }

    setSaving(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      // Build bulk payload: one record per student per session
      const records = [];
      for (const st of students) {
        const sid = String(st.studentId ?? st.student_id ?? st.id ?? st.StudentID);
        for (const ses of sessions) {
          const sesId = String(ses.id);
          const present = !!grid?.[sid]?.[sesId];

          records.push({
            sessionId: Number(sesId),
            studentId: Number(sid),
            status: present ? "P" : "A",
            // optional flags (you can add UI later)
            isNewStudent: false,
            isExtraClass: false,
            extraClassId: null,
            remarks: null,
          });
        }
      }

      // You will create this endpoint in backend:
      // POST /attendance/bulk
      await apiFetch("/attendance/bulk", {
        method: "POST",
        body: JSON.stringify({
          classId: Number(classId),
          yearMonth,
          records,
        }),
      });

      setSuccessMsg("Attendance saved successfully.");
      // reload to ensure DB sync
      await loadAttendanceGrid(classId, yearMonth);
    } catch (e) {
      setErrorMsg(e.message || "Failed to save attendance");
    } finally {
      setSaving(false);
    }
  }

  // ----------------------------
  // Derived
  // ----------------------------
  const hasData = students.length > 0 && sessions.length > 0;

  return (
    <div className="grid gap-4">
      <Card title="Mark Attendance">
        {errorMsg ? <div className="error">{errorMsg}</div> : null}
        {successMsg ? <div className="success">{successMsg}</div> : null}

        <div
          className="grid"
          style={{
            gridTemplateColumns: "1fr 1fr auto",
            gap: 12,
            alignItems: "end",
          }}
        >
          <div>
            <label className="label">Class</label>
            <select
              className="input"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              disabled={loadingRefs}
            >
              {classes.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Year - Month</label>
            <Input
              type="month"
              value={yearMonth}
              onChange={(e) => setYearMonth(e.target.value)}
            />
          </div>

          <Button
            type="button"
            onClick={() => loadAttendanceGrid(classId, yearMonth)}
            disabled={loadingGrid}
          >
            {loadingGrid ? "Loading..." : "Reload"}
          </Button>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button type="button" onClick={saveAll} disabled={saving || loadingGrid || !hasData}>
            {saving ? "Saving..." : "Save All"}
          </Button>
        </div>

        {!hasData ? (
          <div className="muted" style={{ marginTop: 12 }}>
            {loadingGrid
              ? "Loading sessions and students..."
              : "Select class and month to load sessions and enrolled students."}
          </div>
        ) : (
          <div className="tableWrap" style={{ marginTop: 12 }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ position: "sticky", left: 0, background: "white", zIndex: 2 }}>
                    Student
                  </th>

                  {sessions.map((ses) => (
                    <th key={ses.id} style={{ textAlign: "center", minWidth: 90 }}>
                      <div style={{ display: "grid", gap: 6, justifyItems: "center" }}>
                        <div style={{ fontWeight: 600 }}>
                          {fmtDate(ses.session_date)}
                        </div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {ses.start_time?.slice(0, 5)} - {ses.end_time?.slice(0, 5)}
                        </div>

                        {/* column helpers */}
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            type="button"
                            className="linkBtn"
                            onClick={() => setColumn(ses.id, true)}
                            title="Mark all present for this day"
                          >
                            All P
                          </button>
                          <button
                            type="button"
                            className="linkBtn"
                            onClick={() => setColumn(ses.id, false)}
                            title="Mark all absent for this day"
                          >
                            All A
                          </button>
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {students.map((st) => {
                  const sid = String(
                    st.studentId ?? st.student_id ?? st.id ?? st.StudentID
                  );
                  const name =
                    st.fullName ??
                    st.name ??
                    st.studentName ??
                    st.StudentName ??
                    `Student #${sid}`;

                  return (
                    <tr key={sid}>
                      <td
                        style={{
                          position: "sticky",
                          left: 0,
                          background: "white",
                          zIndex: 1,
                          minWidth: 220,
                        }}
                      >
                        {name}
                      </td>

                      {sessions.map((ses) => {
                        const sesId = String(ses.id);
                        const checked = !!grid?.[sid]?.[sesId];

                        return (
                          <td key={sesId} style={{ textAlign: "center" }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleCell(sid, sesId)}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}