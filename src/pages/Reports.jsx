import { useEffect, useMemo, useState } from "react";
import Card from "../ui/Card.jsx";
import Input from "../ui/Input.jsx";
import Button from "../ui/Button.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
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
function yearNow() {
  return String(new Date().getFullYear());
}
function percentFromBackendValue(v) {
  const n = Number(v);
  return Number.isFinite(n) ? `${Math.round(n)}%` : "0%";
}
function percent(paid, total) {
  if (!total) return "0%";
  return `${Math.round((paid / total) * 100)}%`;
}
function asNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function Reports() {
  const [mode, setMode] = useState("month"); // "month" | "year"
  const [year, setYear] = useState(yearNow());
  const [yearMonth, setYearMonth] = useState(ymNow());

  // backend response:
  // {
  //   scope, period,
  //   rows: [{ subjectId, subjectName, totalStudents, paidCount, freeCount, notPaidCount, paidPct, totalIncome, instituteIncome }],
  //   totals: { totalStudents, paidCount, freeCount, notPaidCount, paidPct, totalIncome, instituteIncome }
  // }
  const [summary, setSummary] = useState({
    scope: "month",
    period: ymNow(),
    rows: [],
    totals: {
      totalStudents: 0,
      paidCount: 0,
      freeCount: 0,
      notPaidCount: 0,
      totalIncome: 0,
      instituteIncome: 0,
      paidPct: 0,
    },
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function loadSummary() {
    setLoading(true);
    setErrorMsg("");

    try {
      const url =
        mode === "year"
          ? `/student-payments/summary?scope=year&year=${encodeURIComponent(year)}`
          : `/student-payments/summary?scope=month&yearMonth=${encodeURIComponent(
              yearMonth
            )}`;

      const res = await apiFetch(url);

      const rows = Array.isArray(res?.rows) ? res.rows : [];
      const totals = res?.totals || {};

      setSummary({
        scope: res?.scope ?? mode,
        period: res?.period ?? (mode === "year" ? year : yearMonth),
        rows: rows.map((r) => ({
          subjectId: r.subjectId,
          subjectName: r.subjectName,
          totalStudents: asNum(r.totalStudents),
          paidCount: asNum(r.paidCount),
          freeCount: asNum(r.freeCount),
          notPaidCount: asNum(r.notPaidCount),
          totalIncome: asNum(r.totalIncome),
          instituteIncome: asNum(r.instituteIncome),
          paidPct: asNum(r.paidPct), // ✅ from backend (already excludes free in denominator)
        })),
        totals: {
          totalStudents: asNum(totals.totalStudents),
          paidCount: asNum(totals.paidCount),
          freeCount: asNum(totals.freeCount),
          notPaidCount: asNum(totals.notPaidCount),
          totalIncome: asNum(totals.totalIncome),
          instituteIncome: asNum(totals.instituteIncome),
          paidPct: asNum(totals.paidPct), // ✅ from backend
        },
      });
    } catch (e) {
      setErrorMsg(e.message || "Failed to load summary");
      setSummary((prev) => ({
        ...prev,
        rows: [],
        totals: {
          totalStudents: 0,
          paidCount: 0,
          freeCount: 0,
          notPaidCount: 0,
          totalIncome: 0,
          instituteIncome: 0,
          paidPct: 0,
        },
      }));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, year, yearMonth]);

  const titleScope = mode === "year" ? year : yearMonth;

  // ✅ Use backend-paidPct directly (already correct)
  const totalsPaidPct = useMemo(() => {
    if (Number.isFinite(summary?.totals?.paidPct)) {
      return percentFromBackendValue(summary.totals.paidPct);
    }
    // fallback (shouldn't be needed)
    return percent(summary.totals.paidCount, summary.totals.totalStudents);
  }, [summary.totals]);

  return (
    <div className="grid gap-4">
      <Card title="Monthly / Yearly Report (Subject-wise)">
        {errorMsg ? <div className="error">{errorMsg}</div> : null}

        <div
          className="grid"
          style={{
            gridTemplateColumns: "auto 1fr 1fr auto",
            gap: 12,
            alignItems: "end",
          }}
        >
          <div>
            <label className="label">Mode</label>
            <select
              className="input"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
            >
              <option value="month">Month</option>
              <option value="year">Year</option>
            </select>
          </div>

          {mode === "year" ? (
            <div>
              <label className="label">Year (YYYY)</label>
              <Input
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="2026"
              />
              <div className="muted">Example: 2026</div>
            </div>
          ) : (
            <div>
              <label className="label">Month (YYYY-MM)</label>
              <Input
                type="month"
                value={yearMonth}
                onChange={(e) => setYearMonth(e.target.value)}
              />
              <div className="muted">Example: 2026-02</div>
            </div>
          )}

          <div />

          <Button type="button" onClick={loadSummary} disabled={loading}>
            {loading ? "Loading..." : "Reload"}
          </Button>
        </div>

        {/* Summary cards */}
        <div
          style={{
            marginTop: 12,
            display: "grid",
            gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
            gap: 12,
          }}
        >
          <div
            style={{
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: 14,
              padding: 12,
              background: "#fff",
            }}
          >
            <div className="muted" style={{ fontSize: 12 }}>
              Total Students
            </div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>
              {summary.totals.totalStudents}
            </div>
          </div>

          <div
            style={{
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: 14,
              padding: 12,
              background: "#fff",
            }}
          >
            <div className="muted" style={{ fontSize: 12 }}>
              Free
            </div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>
              {summary.totals.freeCount}
            </div>
          </div>

          <div
            style={{
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: 14,
              padding: 12,
              background: "#fff",
            }}
          >
            <div className="muted" style={{ fontSize: 12 }}>
              Paid
            </div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>
              {summary.totals.paidCount}
            </div>
          </div>

          <div
            style={{
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: 14,
              padding: 12,
              background: "#fff",
            }}
          >
            <div className="muted" style={{ fontSize: 12 }}>
              Not Paid
            </div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>
              {summary.totals.notPaidCount}
            </div>
          </div>

          <div
            style={{
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: 14,
              padding: 12,
              background: "#fff",
            }}
          >
            <div className="muted" style={{ fontSize: 12 }}>
              Total Income
            </div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>
              {Math.round(summary.totals.totalIncome).toLocaleString()}
            </div>
          </div>

          <div
            style={{
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: 14,
              padding: 12,
              background: "#fff",
            }}
          >
            <div className="muted" style={{ fontSize: 12 }}>
              Institute Income
            </div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>
              {Math.round(summary.totals.instituteIncome).toLocaleString()}
            </div>
          </div>
        </div>
      </Card>

      <Card title={`Report Table (${titleScope})`}>
        <div className="tableWrap" style={{ overflowX: "auto" }}>
          <table className="table" style={{ minWidth: 1050 }}>
            <thead>
              <tr>
                <th>Subject</th>
                <th>Total Students</th>
                <th>Free</th>
                <th>Paid</th>
                <th>Not Paid</th>
                <th>Paid %</th>
                <th>Total Income</th>
                <th>Institute Income</th>
              </tr>
            </thead>

            <tbody>
              {summary.rows.map((r) => (
                <tr key={r.subjectId ?? r.subjectName}>
                  <td>{r.subjectName}</td>
                  <td>{r.totalStudents}</td>
                  <td>{r.freeCount}</td>
                  <td>{r.paidCount}</td>
                  <td>{r.notPaidCount}</td>
                  {/* ✅ use backend paidPct */}
                  <td>{percentFromBackendValue(r.paidPct)}</td>
                  <td>{Math.round(r.totalIncome).toLocaleString()}</td>
                  <td>{Math.round(r.instituteIncome).toLocaleString()}</td>
                </tr>
              ))}

              <tr style={{ fontWeight: 800 }}>
                <td>TOTAL (All Subjects)</td>
                <td>{summary.totals.totalStudents}</td>
                <td>{summary.totals.freeCount}</td>
                <td>{summary.totals.paidCount}</td>
                <td>{summary.totals.notPaidCount}</td>
                <td>{totalsPaidPct}</td>
                <td>{Math.round(summary.totals.totalIncome).toLocaleString()}</td>
                <td>
                  {Math.round(summary.totals.instituteIncome).toLocaleString()}
                </td>
              </tr>

              {!summary.rows.length ? (
                <tr>
                  <td colSpan="8" className="muted">
                    No data found for selected {mode === "year" ? "year" : "month"}.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}