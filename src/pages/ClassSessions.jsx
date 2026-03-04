import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../utils/apiFetch";
import Card from "../ui/Card.jsx";
import Input from "../ui/Input.jsx";
import Button from "../ui/Button.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

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

export default function ClassSessions() {
  const [classes, setClasses] = useState([]);
  const [sessions, setSessions] = useState([]);

  const [classId, setClassId] = useState("");
  const [yearMonth, setYearMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );

  const [sessionDate, setSessionDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [note, setNote] = useState("");

  const [loadingRefs, setLoadingRefs] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const canSubmit = useMemo(() => {
    return classId && sessionDate && startTime && endTime;
  }, [classId, sessionDate, startTime, endTime]);

  // ----------------------------
  // Load Classes
  // ----------------------------
  async function loadClasses() {
    setLoadingRefs(true);
    setErrorMsg("");

    try {
      const data = await apiFetch("/classes");
      const list = Array.isArray(data) ? data : data?.data ?? [];

      setClasses(list);

      if (list.length && !classId) {
        setClassId(String(list[0].id));
      }
    } catch (e) {
      setErrorMsg(e.message || "Failed to load classes");
    } finally {
      setLoadingRefs(false);
    }
  }

  // ----------------------------
  // Load Sessions by Class + Month
  // ----------------------------
  async function loadSessions(selectedClassId, selectedYearMonth) {
    if (!selectedClassId || !selectedYearMonth) return;

    setLoadingList(true);
    setErrorMsg("");

    try {
      const data = await apiFetch(
        `/class-sessions?classId=${selectedClassId}&yearMonth=${selectedYearMonth}`
      );

      const list = Array.isArray(data) ? data : data?.data ?? [];
      setSessions(list);
    } catch (e) {
      setErrorMsg(e.message || "Failed to load sessions");
    } finally {
      setLoadingList(false);
    }
  }

  // initial load
  useEffect(() => {
    loadClasses();
  }, []);

  // reload when class or month changes
  useEffect(() => {
    if (classId && yearMonth) {
      loadSessions(classId, yearMonth);
    }
  }, [classId, yearMonth]);

  // ----------------------------
  // Create Session
  // ----------------------------
  async function onCreateSession(e) {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      await apiFetch("/class-sessions", {
        method: "POST",
        body: JSON.stringify({
          classId: Number(classId),
          sessionDate,
          startTime,
          endTime,
          note: note.trim() || null,
        }),
      });

      setSuccessMsg("Session created successfully.");

      setSessionDate("");
      setStartTime("");
      setEndTime("");
      setNote("");

      await loadSessions(classId, yearMonth);
    } catch (e) {
      setErrorMsg(e.message || "Failed to create session");
    } finally {
      setSubmitting(false);
    }
  }

  // ----------------------------
  // Delete Session
  // ----------------------------
  async function deleteSession(row) {
    const ok = window.confirm("Delete this session?");
    if (!ok) return;

    setErrorMsg("");
    setSuccessMsg("");

    try {
      await apiFetch(`/class-sessions/${row.id}`, {
        method: "DELETE",
      });

      setSuccessMsg("Session deleted.");
      await loadSessions(classId, yearMonth);
    } catch (e) {
      setErrorMsg(e.message || "Failed to delete session");
    }
  }

  return (
    <div className="grid gap-4">
      {/* ========================= */}
      {/* Add Session */}
      {/* ========================= */}
      <Card title="Add Class Session">
        <form onSubmit={onCreateSession} className="form">
          {errorMsg && <div className="error">{errorMsg}</div>}
          {successMsg && <div className="success">{successMsg}</div>}

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

          <label className="label">Select Month</label>
          <Input
            type="month"
            value={yearMonth}
            onChange={(e) => setYearMonth(e.target.value)}
          />

          <label className="label">Session Date</label>
          <Input
            type="date"
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
          />

          <label className="label">Start Time</label>
          <Input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />

          <label className="label">End Time</label>
          <Input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />

          <label className="label">Note</label>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note"
          />

          <Button type="submit" disabled={!canSubmit || submitting}>
            {submitting ? "Saving..." : "Create Session"}
          </Button>
        </form>
      </Card>

      {/* ========================= */}
      {/* Sessions List */}
      {/* ========================= */}
      <Card title="Sessions List">
        <div className="grid gap-3">
          <div className="tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Note</th>
                  <th style={{ width: 120 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted">
                      {loadingList ? "Loading..." : "No sessions found."}
                    </td>
                  </tr>
                ) : (
                  sessions.map((s) => (
                    <tr key={s.id}>
                      <td>{s.session_date}</td>
                      <td>{s.start_time}</td>
                      <td>{s.end_time}</td>
                      <td>{s.note ?? "-"}</td>
                      <td>
                        <Button onClick={() => deleteSession(s)}>
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
}