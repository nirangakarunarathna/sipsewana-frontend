import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "../utils/apiFetch";
import Card from "../ui/Card.jsx";
import Input from "../ui/Input.jsx";
import Button from "../ui/Button.jsx";

const API_BASE = import.meta.env.VITE_API_URL ;

function ymNow() {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

function todayISO() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
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
  const v = cls?.fee ?? cls?.class_fee ?? cls?.classFee ?? cls?.monthly_fee ?? 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function AttendanceMarkTable() {
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState("");
  const [yearMonth, setYearMonth] = useState(ymNow());

  const [sessions, setSessions] = useState([]);
  const [students, setStudents] = useState([]);
  const [grid, setGrid] = useState({});

  const [payments, setPayments] = useState({});
  // { [studentId]: { paid: boolean, amount: number, free: boolean, feeRemaining: boolean, paidAt: string } }

  const [loadingRefs, setLoadingRefs] = useState(false);
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [saving, setSaving] = useState(false);

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const amountTouchedRef = useRef({});

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

      const nextPay = {};
      for (const st of stuList) {
        const sid = getStudentId(st);
        nextPay[sid] = {
          paid: false,
          amount: 0,
          free: false,
          feeRemaining: false,
          paidAt: "",
        };
      }

      for (const p of payList) {
        const sid = String(p.student_id ?? p.studentId);

        const isFree = !!(p.isFree ?? p.is_free_student ?? p.freeStudent ?? p.free_student);
        const paid = isFree ? false : !!(p.paid ?? p.isPaid ?? p.is_paid ?? p.status === "PAID");
        const feeRemaining = !!(
          p.feeRemaining ??
          p.fee_remaining ??
          p.hasRemaining ??
          p.has_remaining ??
          false
        );

        const paidAtRaw = p.paidAt ?? p.paid_at ?? "";
        const paidAt = paidAtRaw ? String(paidAtRaw).slice(0, 10) : "";

        nextPay[sid] = {
          ...(nextPay[sid] || {
            paid: false,
            amount: 0,
            free: false,
            feeRemaining: false,
            paidAt: "",
          }),
          free: isFree,
          paid,
          amount: isFree ? 0 : Number(p.amount ?? 0),
          feeRemaining: isFree ? false : feeRemaining,
          paidAt: isFree ? "" : paidAt,
        };
      }

      setPayments(nextPay);
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

  useEffect(() => {
    if (!hasStudents) return;
    if (!Number.isFinite(classFee) || classFee <= 0) return;

    setPayments((prev) => {
      const next = { ...(prev || {}) };
      let changed = false;

      for (const st of students) {
        const sid = getStudentId(st);
        const touched = !!amountTouchedRef.current[sid];

        const cur = next[sid] || {
          paid: false,
          amount: 0,
          free: false,
          feeRemaining: false,
          paidAt: "",
        };
        const curAmount = Number(cur.amount ?? 0);

        if (cur.free) {
          if (
            cur.paid !== false ||
            Number(cur.amount ?? 0) !== 0 ||
            cur.feeRemaining !== false ||
            cur.paidAt !== ""
          ) {
            next[sid] = {
              ...cur,
              paid: false,
              amount: 0,
              feeRemaining: false,
              paidAt: "",
            };
            changed = true;
          } else {
            next[sid] = cur;
          }
          continue;
        }

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

  const summary = useMemo(() => {
    const totalStudents = students.length;

    let paidCount = 0;
    let totalPaidAmount = 0;

    for (const st of students) {
      const sid = getStudentId(st);
      const row = payments?.[sid];
      if (!row) continue;
      if (row.free) continue;

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

  function setFree(studentId, free) {
    const sid = String(studentId);

    setPayments((prev) => {
      const cur = prev?.[sid] || {
        paid: false,
        amount: 0,
        free: false,
        feeRemaining: false,
        paidAt: "",
      };

      if (free) {
        return {
          ...(prev || {}),
          [sid]: {
            ...cur,
            free: true,
            paid: false,
            amount: 0,
            feeRemaining: false,
            paidAt: "",
          },
        };
      }

      return {
        ...(prev || {}),
        [sid]: {
          ...cur,
          free: false,
          paid: false,
          amount: Number(cur.amount ?? 0) > 0 ? Number(cur.amount ?? 0) : classFee || 0,
          feeRemaining: false,
          paidAt: "",
        },
      };
    });
  }

  function setPaid(studentId, paid) {
    const sid = String(studentId);

    setPayments((prev) => {
      const cur = prev?.[sid] || {
        paid: false,
        amount: 0,
        free: false,
        feeRemaining: false,
        paidAt: "",
      };
      if (cur.free) return prev;

      let nextAmount = Number(cur.amount ?? 0);
      if (paid && (!Number.isFinite(nextAmount) || nextAmount <= 0) && classFee > 0) {
        nextAmount = classFee;
      }

      return {
        ...(prev || {}),
        [sid]: {
          ...cur,
          paid: !!paid,
          amount: nextAmount,
          paidAt: paid ? cur.paidAt || todayISO() : "",
        },
      };
    });
  }

  function setFeeRemaining(studentId, feeRemaining) {
    const sid = String(studentId);

    setPayments((prev) => {
      const cur = prev?.[sid] || {
        paid: false,
        amount: 0,
        free: false,
        feeRemaining: false,
        paidAt: "",
      };

      if (cur.free) return prev;

      return {
        ...(prev || {}),
        [sid]: {
          ...cur,
          feeRemaining: !!feeRemaining,
        },
      };
    });
  }

  function setPaidAt(studentId, paidAt) {
    const sid = String(studentId);

    setPayments((prev) => {
      const cur = prev?.[sid] || {
        paid: false,
        amount: 0,
        free: false,
        feeRemaining: false,
        paidAt: "",
      };

      if (cur.free || !cur.paid) return prev;

      return {
        ...(prev || {}),
        [sid]: {
          ...cur,
          paidAt,
        },
      };
    });
  }

  function setAmount(studentId, amount) {
    const sid = String(studentId);

    if (payments?.[sid]?.free) return;

    amountTouchedRef.current[sid] = true;

    setPayments((prev) => ({
      ...(prev || {}),
      [sid]: {
        ...(prev?.[sid] || {
          paid: false,
          free: false,
          feeRemaining: false,
          paidAt: "",
        }),
        amount: Number(amount || 0),
      },
    }));
  }

  function setAllPaid(value) {
    setPayments((prev) => {
      const next = { ...(prev || {}) };

      for (const st of students) {
        const sid = getStudentId(st);
        const cur = next[sid] || {
          paid: false,
          amount: 0,
          free: false,
          feeRemaining: false,
          paidAt: "",
        };

        if (cur.free) {
          next[sid] = {
            ...cur,
            paid: false,
            amount: 0,
            feeRemaining: false,
            paidAt: "",
          };
          continue;
        }

        let nextAmount = Number(cur.amount ?? 0);
        const touched = !!amountTouchedRef.current[sid];

        if (value && !touched && (!Number.isFinite(nextAmount) || nextAmount <= 0) && classFee > 0) {
          nextAmount = classFee;
        }

        next[sid] = {
          ...cur,
          paid: value,
          amount: nextAmount,
          paidAt: value ? cur.paidAt || todayISO() : "",
        };
      }

      return next;
    });
  }

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
        const isFree = !!payments?.[sid]?.free;

        return {
          studentId: Number(sid),
          paid: isFree ? false : !!payments?.[sid]?.paid,
          amount: isFree ? 0 : Number(payments?.[sid]?.amount ?? 0),
          isFree,
          feeRemaining: isFree ? false : !!payments?.[sid]?.feeRemaining,
          paidAt: isFree ? null : payments?.[sid]?.paidAt || null,
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

          <Button
            type="button"
            onClick={() => loadAttendanceGrid(classId, yearMonth)}
            disabled={loadingGrid}
          >
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
            title="Mark all students paid (free students will remain unpaid)"
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
            <table className="table" style={{ minWidth: 1500 }}>
              <thead>
                <tr>
                  <th style={{ ...stickyThTd, minWidth: 260 }}>Student (Name / Mobile)</th>
                  <th style={{ minWidth: 80, textAlign: "center" }}>Free</th>
                  <th style={{ minWidth: 90, textAlign: "center" }}>Paid</th>
                  <th style={{ minWidth: 120, textAlign: "center" }}>Amount</th>
                  <th style={{ minWidth: 130, textAlign: "center" }}>Fee Remaining</th>
                  <th style={{ minWidth: 140, textAlign: "center" }}>Paid At</th>

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

                  const row = payments?.[sid] || {
                    paid: false,
                    amount: 0,
                    free: false,
                    feeRemaining: false,
                    paidAt: "",
                  };

                  const isFree = !!row.free;
                  const paid = !!row.paid;
                  const amount = row.amount ?? 0;
                  const feeRemaining = !!row.feeRemaining;
                  const paidAt = row.paidAt || "";

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
                          checked={isFree}
                          onChange={(e) => setFree(sid, e.target.checked)}
                          style={{ width: 18, height: 18 }}
                          title="Free student (no payment)"
                        />
                      </td>

                      <td style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={paid}
                          onChange={(e) => setPaid(sid, e.target.checked)}
                          disabled={isFree}
                          style={{ width: 18, height: 18, cursor: isFree ? "not-allowed" : "pointer" }}
                          title={isFree ? "Free student cannot be marked as paid" : "Paid"}
                        />
                      </td>

                      <td style={{ textAlign: "center" }}>
                        <input
                          type="number"
                          className="input"
                          style={{
                            width: 95,
                            textAlign: "right",
                            opacity: isFree ? 0.6 : 1,
                            cursor: isFree ? "not-allowed" : "text",
                          }}
                          value={isFree ? 0 : amount}
                          min={0}
                          disabled={isFree}
                          onChange={(e) => setAmount(sid, e.target.value)}
                          placeholder={classFee ? String(classFee) : "0"}
                        />
                      </td>

                      <td style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={feeRemaining}
                          onChange={(e) => setFeeRemaining(sid, e.target.checked)}
                          disabled={isFree}
                          style={{
                            width: 18,
                            height: 18,
                            cursor: isFree ? "not-allowed" : "pointer",
                          }}
                          title={isFree ? "Free student has no remaining fee" : "Fee Remaining"}
                        />
                      </td>

                      <td style={{ textAlign: "center" }}>
                        <input
                          type="date"
                          className="input"
                          style={{
                            width: 140,
                            opacity: !paid || isFree ? 0.6 : 1,
                            cursor: !paid || isFree ? "not-allowed" : "pointer",
                          }}
                          value={paid && !isFree ? paidAt : ""}
                          disabled={!paid || isFree}
                          onChange={(e) => setPaidAt(sid, e.target.value)}
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