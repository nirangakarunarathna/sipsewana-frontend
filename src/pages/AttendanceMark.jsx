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

function ymNow() {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

function fmtDateShort(d) {
  // YYYY-MM-DD -> DD/MM
  if (!d) return "";
  const [, m, day] = d.split("-");
  return `${m} - ${day}`;
}

function safeTime(t) {
  // "08:00:00" -> "08:00"
  return t ? String(t).slice(0, 5) : "";
}

export default function AttendanceMarkTable() {
  // selectors
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState("");
  const [yearMonth, setYearMonth] = useState(ymNow());

  // loaded
  const [sessions, setSessions] = useState([]); // {id, session_date, start_time, end_time}
  const [students, setStudents] = useState([]); // from student-classes endpoint
  const [grid, setGrid] = useState({}); // { [studentId]: { [sessionId]: boolean } }

  // states
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
        apiFetch(`/class-sessions?classId=${selectedClassId}&yearMonth=${selectedYearMonth}`),
        apiFetch(`/student-classes?classId=${selectedClassId}`),
        apiFetch(`/student-attendances?classId=${selectedClassId}&yearMonth=${selectedYearMonth}`),
      ]);

      const sessList = Array.isArray(sessRes) ? sessRes : sessRes?.data ?? [];
      const stuList = Array.isArray(stuRes) ? stuRes : stuRes?.data ?? [];
      const attList = Array.isArray(attRes) ? attRes : attRes?.data ?? [];

      // Optional sort: by session_date then start_time
      sessList.sort((a, b) => {
        const ad = String(a.session_date || "").localeCompare(String(b.session_date || ""));
        if (ad !== 0) return ad;
        return String(a.start_time || "").localeCompare(String(b.start_time || ""));
      });

      // Optional sort: by name
      stuList.sort((a, b) => {
        const an = String(
          a.fullName ?? a.name ?? a.studentName ?? a.StudentName ?? ""
        ).toLowerCase();
        const bn = String(
          b.fullName ?? b.name ?? b.studentName ?? b.StudentName ?? ""
        ).toLowerCase();
        return an.localeCompare(bn);
      });

      setSessions(sessList);
      setStudents(stuList);

      // Build grid (default false)
      const next = {};
      for (const st of stuList) {
        const sid = String(st.studentId ?? st.student_id ?? st.id ?? st.StudentID);
        next[sid] = {};
        for (const ses of sessList) {
          next[sid][String(ses.id)] = false;
        }
      }

      // Apply existing attendance
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
      setGrid({});
    } finally {
      setLoadingGrid(false);
    }
  }

  useEffect(() => {
    loadClasses();
  }, []);

  useEffect(() => {
    if (classId && yearMonth) loadAttendanceGrid(classId, yearMonth);
  }, [classId, yearMonth]);

  const hasStudents = students.length > 0;
  const hasSessions = sessions.length > 0;

  // ----------------------------
  // Toggle single cell
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
  // Column actions: mark all present/absent for a session
  // ----------------------------
  function setColumn(sessionId, value) {
    setGrid((prev) => {
      const sesId = String(sessionId);
      const next = { ...prev };
      for (const st of students) {
        const sid = String(st.studentId ?? st.student_id ?? st.id ?? st.StudentID);
        next[sid] = { ...(next[sid] || {}), [sesId]: value };
      }
      return next;
    });
  }

  // ----------------------------
  // Save bulk
  // ----------------------------
  async function saveAll() {
    if (!classId || !yearMonth) return;

    if (!hasStudents || !hasSessions) {
      setErrorMsg("No students or sessions found for selected class/month.");
      return;
    }

    setSaving(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
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
            isNewStudent: false,
            isExtraClass: false,
            extraClassId: null,
            remarks: null,
          });
        }
      }

      await apiFetch("/student-attendances/bulk", {
        method: "POST",
        body: JSON.stringify({
          classId: Number(classId),
          yearMonth,
          records,
        }),
      });

      setSuccessMsg("Attendance saved successfully.");
      await loadAttendanceGrid(classId, yearMonth);
    } catch (e) {
      setErrorMsg(e.message || "Failed to save attendance");
    } finally {
      setSaving(false);
    }
  }

  // Table styles to keep Student column sticky and allow horizontal scroll
  const stickyThTd = {
    position: "sticky",
    left: 0,
    background: "white",
    zIndex: 2,
  };

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
            <Input type="month" value={yearMonth} onChange={(e) => setYearMonth(e.target.value)} />
          </div>

          <Button type="button" onClick={() => loadAttendanceGrid(classId, yearMonth)} disabled={loadingGrid}>
            {loadingGrid ? "Loading..." : "Reload"}
          </Button>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button type="button" onClick={saveAll} disabled={saving || loadingGrid || !hasStudents || !hasSessions}>
            {saving ? "Saving..." : "Save All"}
          </Button>
        </div>

        {!hasStudents ? (
          <div className="muted" style={{ marginTop: 12 }}>
            {loadingGrid ? "Loading..." : "No students found for this class."}
          </div>
        ) : !hasSessions ? (
          <div className="muted" style={{ marginTop: 12 }}>
            {loadingGrid ? "Loading..." : "No sessions found for this month."}
          </div>
        ) : (
          <div className="tableWrap" style={{ marginTop: 12, overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th style={{ ...stickyThTd, minWidth: 260 }}>
                    Student (Name / Mobile)
                  </th>

                  {sessions.map((ses) => (
                    <th key={ses.id} style={{ minWidth: 110, textAlign: "center" }}>
                      <div style={{ display: "grid", gap: 6, justifyItems: "center" }}>
                        <div style={{ fontWeight: 700 }}>
                          {fmtDateShort(ses.session_date)}
                        </div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {safeTime(ses.start_time)} - {safeTime(ses.end_time)}
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            type="button"
                            className="linkBtn"
                            onClick={() => setColumn(ses.id, true)}
                            title="Mark all present"
                          >
                            All P
                          </button>
                          <button
                            type="button"
                            className="linkBtn"
                            onClick={() => setColumn(ses.id, false)}
                            title="Mark all absent"
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
                  const sid = String(st.studentId ?? st.student_id ?? st.id ?? st.StudentID);
                  const name =
                    `${sid} - ${st.student.fullName}`;

                  const mobile =
                    `${st.student.studentMobile} / ${st.student.address}`;

                  return (
                    <tr key={sid}>
                      <td style={{ ...stickyThTd, zIndex: 1 }}>
                        <div style={{ display: "grid" }}>
                          <span style={{ fontWeight: 700 }}>{name}</span>
                          <span className="muted" style={{ fontSize: 12 }}>
                            {mobile ? mobile : `ID: ${sid}`}
                          </span>
                        </div>
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
                              style={{ width: 18, height: 18 }}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="muted" style={{ marginTop: 8 }}>
              Tip: On mobile, scroll horizontally to see all session columns.
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}