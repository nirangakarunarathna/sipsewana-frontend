import { useEffect, useMemo, useRef, useState } from "react";
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
  if (!d) return "";
  const [, m, day] = String(d).split("-");
  return `${m} - ${day}`;
}

function safeTime(t) {
  return t ? String(t).slice(0, 5) : "";
}

function getStudentId(st) {
  return String(st?.studentId ?? st?.student_id ?? st?.id ?? st?.StudentID ?? "");
}

function getStudentName(st, sid) {
  const fullName =
    st?.student?.fullName ??
    st?.student?.name ??
    st?.fullName ??
    st?.name ??
    st?.studentName ??
    st?.StudentName ??
    "";
  return `${sid} - ${fullName || "Unknown"}`;
}

function getStudentMobileLine(st, sid) {
  const mobile =
    st?.student?.studentMobile ??
    st?.student?.mobile ??
    st?.mobile ??
    st?.studentMobile ??
    "";
  const address = st?.student?.address ?? st?.address ?? "";
  const line = [mobile, address].filter(Boolean).join(" / ");
  return line || `ID: ${sid}`;
}

function getClassInstitutePercentage(cls) {
  const v =
    cls?.institutePercentage ??
    cls?.institute_percentage ??
    cls?.institute_percent ??
    cls?.institute_share ??
    0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function getClassFee(cls) {
  // supports many naming variants + string decimals like "1000" / "1000.00"
  const v = cls?.fee ?? cls?.class_fee ?? cls?.classFee ?? cls?.monthly_fee ?? 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function AttendanceMarkTable() {
  // selectors
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState("");
  const [yearMonth, setYearMonth] = useState(ymNow());

  // loaded
  const [sessions, setSessions] = useState([]);
  const [students, setStudents] = useState([]);
  const [grid, setGrid] = useState({}); // { [studentId]: { [sessionId]: boolean } }

  // payment
  const [payments, setPayments] = useState({}); // { [studentId]: { paid: boolean, amount: number } }

  // states
  const [loadingRefs, setLoadingRefs] = useState(false);
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [saving, setSaving] = useState(false);

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // track if user manually edited amount per student (so we don't override)
  const amountTouchedRef = useRef({}); // { [studentId]: true }

  // ----------------------------
  // Selected class
  // ----------------------------
  const selectedClass = useMemo(() => {
    const idNum = Number(classId);
    return classes.find((c) => Number(c.id) === idNum) || null;
  }, [classes, classId]);

  const institutePercentage = useMemo(() => {
    return getClassInstitutePercentage(selectedClass);
  }, [selectedClass]);

  const classFee = useMemo(() => {
    return getClassFee(selectedClass);
  }, [selectedClass]);

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
  // Load sessions + students + attendance + payments
  // ----------------------------
  async function loadAttendanceGrid(selectedClassId, selectedYearMonth) {
    if (!selectedClassId || !selectedYearMonth) return;

    setLoadingGrid(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const [sessRes, stuRes, attRes, payRes] = await Promise.all([
        apiFetch(`/class-sessions?classId=${selectedClassId}&yearMonth=${selectedYearMonth}`),
        apiFetch(`/student-classes?classId=${selectedClassId}`),
        apiFetch(`/student-attendances?classId=${selectedClassId}&yearMonth=${selectedYearMonth}`),
        apiFetch(`/student-payments?classId=${selectedClassId}&yearMonth=${selectedYearMonth}`),
      ]);

      const sessList = Array.isArray(sessRes) ? sessRes : sessRes?.data ?? [];
      const stuList = Array.isArray(stuRes) ? stuRes : stuRes?.data ?? [];
      const attList = Array.isArray(attRes) ? attRes : attRes?.data ?? [];
      const payList = Array.isArray(payRes) ? payRes : payRes?.data ?? [];

      sessList.sort((a, b) => {
        const ad = String(a.session_date || "").localeCompare(String(b.session_date || ""));
        if (ad !== 0) return ad;
        return String(a.start_time || "").localeCompare(String(b.start_time || ""));
      });

      stuList.sort((a, b) => {
        const an = String(
          a?.student?.fullName ?? a.fullName ?? a.name ?? a.studentName ?? a.StudentName ?? ""
        ).toLowerCase();
        const bn = String(
          b?.student?.fullName ?? b.fullName ?? b.name ?? b.studentName ?? b.StudentName ?? ""
        ).toLowerCase();
        return an.localeCompare(bn);
      });

      setSessions(sessList);
      setStudents(stuList);

      // Build attendance grid
      const nextGrid = {};
      for (const st of stuList) {
        const sid = getStudentId(st);
        nextGrid[sid] = {};
        for (const ses of sessList) nextGrid[sid][String(ses.id)] = false;
      }

      for (const a of attList) {
        const sid = String(a.student_id ?? a.studentId);
        const sesId = String(a.session_id ?? a.sessionId);
        if (nextGrid[sid] && Object.prototype.hasOwnProperty.call(nextGrid[sid], sesId)) {
          nextGrid[sid][sesId] = (a.status ?? "A") === "P";
        }
      }
      setGrid(nextGrid);

      // Payments map (initial)
      const nextPay = {};
      for (const st of stuList) {
        const sid = getStudentId(st);
        nextPay[sid] = { paid: false, amount: 0 };
      }
      for (const p of payList) {
        const sid = String(p.student_id ?? p.studentId);
        nextPay[sid] = {
          paid: !!(p.paid ?? p.isPaid ?? p.is_paid ?? p.status === "PAID"),
          amount: Number(p.amount ?? 0),
        };
      }
      setPayments(nextPay);

      // reset "touched" when reloading grid (new month/class)
      amountTouchedRef.current = {};
    } catch (e) {
      setErrorMsg(e.message || "Failed to load attendance/payments");
      setSessions([]);
      setStudents([]);
      setGrid({});
      setPayments({});
      amountTouchedRef.current = {};
    } finally {
      setLoadingGrid(false);
    }
  }

  useEffect(() => {
    loadClasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (classId && yearMonth) loadAttendanceGrid(classId, yearMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, yearMonth]);

  const hasStudents = students.length > 0;
  const hasSessions = sessions.length > 0;

  // ----------------------------
  // AUTO-BIND CLASS FEE INTO AMOUNT INPUTS
  //
  // Rules:
  // - When class changes OR fee changes OR students list changes:
  //   set amount = classFee for students who:
  //     - don't have an amount yet (0/null/undefined)
  //     - AND user hasn't manually edited it (touched=false)
  // - Also, when user ticks Paid=true and amount is empty, auto-fill classFee.
  // ----------------------------
  useEffect(() => {
    if (!hasStudents) return;
    if (!Number.isFinite(classFee) || classFee <= 0) return;

    setPayments((prev) => {
      const next = { ...(prev || {}) };
      let changed = false;

      for (const st of students) {
        const sid = getStudentId(st);
        const touched = !!amountTouchedRef.current[sid];

        const cur = next[sid] || { paid: false, amount: 0 };
        const curAmount = Number(cur.amount ?? 0);

        // only fill if not touched and amount is empty/0
        if (!touched && (!Number.isFinite(curAmount) || curAmount <= 0)) {
          next[sid] = { ...cur, amount: classFee };
          changed = true;
        } else {
          next[sid] = cur;
        }
      }

      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classFee, students]);

  // ----------------------------
  // Summary
  // ----------------------------
  const summary = useMemo(() => {
    const totalStudents = students.length;

    let paidCount = 0;
    let totalPaidAmount = 0;

    for (const st of students) {
      const sid = getStudentId(st);
      const row = payments?.[sid];
      if (!row) continue;

      if (row.paid) {
        paidCount += 1;
        totalPaidAmount += Number(row.amount ?? 0);
      }
    }

    const paidPercent = totalStudents > 0 ? Math.round((paidCount / totalStudents) * 100) : 0;

    const instituteIncome = (Number(totalPaidAmount) * Number(institutePercentage || 0)) / 100;

    return {
      totalStudents,
      paidCount,
      paidPercent,
      totalPaidAmount,
      institutePercentage: Number(institutePercentage || 0),
      instituteIncome,
      classFee,
    };
  }, [students, payments, institutePercentage, classFee]);

  // ----------------------------
  // Toggle attendance cell
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

  function setColumn(sessionId, value) {
    setGrid((prev) => {
      const sesId = String(sessionId);
      const next = { ...prev };
      for (const st of students) {
        const sid = getStudentId(st);
        next[sid] = { ...(next[sid] || {}), [sesId]: value };
      }
      return next;
    });
  }

  // Payment helpers
  function setPaid(studentId, paid) {
    const sid = String(studentId);

    setPayments((prev) => {
      const cur = prev?.[sid] || { paid: false, amount: 0 };
      let nextAmount = Number(cur.amount ?? 0);

      // if turning PAID on and amount is empty and fee exists => autofill fee
      if (paid && (!Number.isFinite(nextAmount) || nextAmount <= 0) && classFee > 0) {
        // don't mark as touched; it's an auto-fill
        nextAmount = classFee;
      }

      return {
        ...(prev || {}),
        [sid]: { ...cur, paid: !!paid, amount: nextAmount },
      };
    });
  }

  function setAmount(studentId, amount) {
    const sid = String(studentId);
    amountTouchedRef.current[sid] = true; // user manually edited

    setPayments((prev) => ({
      ...(prev || {}),
      [sid]: { ...(prev?.[sid] || { paid: false }), amount: Number(amount || 0) },
    }));
  }

  function setAllPaid(value) {
    setPayments((prev) => {
      const next = { ...(prev || {}) };
      for (const st of students) {
        const sid = getStudentId(st);
        const cur = next[sid] || { paid: false, amount: 0 };

        // if marking paid=true and amount empty => autofill fee (unless touched)
        let nextAmount = Number(cur.amount ?? 0);
        const touched = !!amountTouchedRef.current[sid];

        if (value && !touched && (!Number.isFinite(nextAmount) || nextAmount <= 0) && classFee > 0) {
          nextAmount = classFee;
        }

        next[sid] = { ...cur, paid: value, amount: nextAmount };
      }
      return next;
    });
  }

  // ----------------------------
  // Save bulk: attendance + payments
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
      const attendanceRecords = [];
      for (const st of students) {
        const sid = getStudentId(st);
        for (const ses of sessions) {
          const sesId = String(ses.id);
          const present = !!grid?.[sid]?.[sesId];

          attendanceRecords.push({
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

      const paymentRecords = students.map((st) => {
        const sid = getStudentId(st);
        return {
          studentId: Number(sid),
          paid: !!payments?.[sid]?.paid,
          amount: Number(payments?.[sid]?.amount ?? 0),
        };
      });

      await Promise.all([
        apiFetch("/student-attendances/bulk", {
          method: "POST",
          body: JSON.stringify({
            classId: Number(classId),
            yearMonth,
            records: attendanceRecords,
          }),
        }),
        apiFetch("/student-payments/bulk", {
          method: "POST",
          body: JSON.stringify({
            classId: Number(classId),
            yearMonth,
            payments: paymentRecords,
          }),
        }),
      ]);

      setSuccessMsg("Attendance + payments saved successfully.");
      await loadAttendanceGrid(classId, yearMonth);
    } catch (e) {
      setErrorMsg(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

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

            <div className="muted" style={{ marginTop: 6 }}>
              Fee: <b>{summary.classFee ? summary.classFee.toLocaleString() : "—"}</b>
            </div>
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
          <Button
            type="button"
            onClick={saveAll}
            disabled={saving || loadingGrid || !hasStudents || !hasSessions}
          >
            {saving ? "Saving..." : "Save All"}
          </Button>

          <button
            type="button"
            className="linkBtn"
            onClick={() => setAllPaid(true)}
            disabled={saving || loadingGrid || !hasStudents}
            title="Mark all students paid"
          >
            All Paid
          </button>
          <button
            type="button"
            className="linkBtn"
            onClick={() => setAllPaid(false)}
            disabled={saving || loadingGrid || !hasStudents}
            title="Mark all students unpaid"
          >
            All Unpaid
          </button>
        </div>

        {/* Summary */}
        <div
          style={{
            marginTop: 12,
            display: "grid",
            gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
            gap: 12,
          }}
        >
          <div style={{ border: "1px solid rgba(0,0,0,0.08)", borderRadius: 14, padding: 12, background: "#fff" }}>
            <div className="muted" style={{ fontSize: 12 }}>Total Students</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{summary.totalStudents}</div>
          </div>

          <div style={{ border: "1px solid rgba(0,0,0,0.08)", borderRadius: 14, padding: 12, background: "#fff" }}>
            <div className="muted" style={{ fontSize: 12 }}>Paid Students</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{summary.paidCount}</div>
          </div>

          <div style={{ border: "1px solid rgba(0,0,0,0.08)", borderRadius: 14, padding: 12, background: "#fff" }}>
            <div className="muted" style={{ fontSize: 12 }}>Paid Percentage</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{summary.paidPercent}%</div>
          </div>

          <div style={{ border: "1px solid rgba(0,0,0,0.08)", borderRadius: 14, padding: 12, background: "#fff" }}>
            <div className="muted" style={{ fontSize: 12 }}>Total Paid Amount</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>
              {summary.totalPaidAmount.toLocaleString()}
            </div>
          </div>

          <div style={{ border: "1px solid rgba(0,0,0,0.08)", borderRadius: 14, padding: 12, background: "#fff" }}>
            <div className="muted" style={{ fontSize: 12 }}>Institute %</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>
              {summary.institutePercentage}%
            </div>
          </div>

          <div style={{ border: "1px solid rgba(0,0,0,0.08)", borderRadius: 14, padding: 12, background: "#fff" }}>
            <div className="muted" style={{ fontSize: 12 }}>Institute Income</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>
              {summary.instituteIncome.toLocaleString()}
            </div>
          </div>
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
            <table className="table" style={{ minWidth: 1100 }}>
              <thead>
                <tr>
                  <th style={{ ...stickyThTd, minWidth: 260 }}>Student (Name / Mobile)</th>
                  <th style={{ minWidth: 90, textAlign: "center" }}>Paid</th>
                  <th style={{ minWidth: 120, textAlign: "center" }}>Amount</th>

                  {sessions.map((ses) => (
                    <th key={ses.id} style={{ minWidth: 110, textAlign: "center" }}>
                      <div style={{ display: "grid", gap: 6, justifyItems: "center" }}>
                        <div style={{ fontWeight: 700 }}>{fmtDateShort(ses.session_date)}</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {safeTime(ses.start_time)} - {safeTime(ses.end_time)}
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button type="button" className="linkBtn" onClick={() => setColumn(ses.id, true)}>
                            All P
                          </button>
                          <button type="button" className="linkBtn" onClick={() => setColumn(ses.id, false)}>
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
                  const sid = getStudentId(st);
                  const name = getStudentName(st, sid);
                  const mobileLine = getStudentMobileLine(st, sid);

                  const paid = !!payments?.[sid]?.paid;
                  const amount = payments?.[sid]?.amount ?? 0;

                  return (
                    <tr key={sid}>
                      <td style={{ ...stickyThTd, zIndex: 1 }}>
                        <div style={{ display: "grid" }}>
                          <span style={{ fontWeight: 700 }}>{name}</span>
                          <span className="muted" style={{ fontSize: 12 }}>{mobileLine}</span>
                        </div>
                      </td>

                      <td style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={paid}
                          onChange={(e) => setPaid(sid, e.target.checked)}
                          style={{ width: 18, height: 18 }}
                        />
                      </td>

                      <td style={{ textAlign: "center" }}>
                        <input
                          type="number"
                          className="input"
                          style={{ width: 95, textAlign: "right" }}
                          value={amount}
                          min={0}
                          onChange={(e) => setAmount(sid, e.target.value)}
                          placeholder={classFee ? String(classFee) : "0"}
                        />
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