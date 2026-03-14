import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../utils/apiFetch";
import Card from "../ui/Card.jsx";
import Input from "../ui/Input.jsx";
import Button from "../ui/Button.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "http://192.168.8.135:3000";

// async function apiFetch(path, options = {}) {
//   const res = await fetch(`${API_BASE}${path}`, {
//     headers: { "Content-Type": "application/json", ...(options.headers || {}) },
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

function ymNow() {
  return new Date().toISOString().slice(0, 7);
}

function asArray(x) {
  return Array.isArray(x) ? x : x?.data ?? [];
}

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function pct(paid, total) {
  if (!total) return 0;
  return Math.round((paid / total) * 100);
}

// simple inline icons (no libraries)
function Icon({ name }) {
  const style = { width: 18, height: 18, display: "inline-block" };
  if (name === "users")
    return (
      <svg style={style} viewBox="0 0 24 24" fill="none">
        <path
          d="M16 11c1.66 0 3-1.57 3-3.5S17.66 4 16 4s-3 1.57-3 3.5S14.34 11 16 11Zm-8 0c1.66 0 3-1.57 3-3.5S9.66 4 8 4 5 5.57 5 7.5 6.34 11 8 11Zm0 2c-2.67 0-8 1.34-8 4v3h16v-3c0-2.66-5.33-4-8-4Zm8 0c-.32 0-.68.02-1.06.05 1.16.84 2.06 1.97 2.06 3.45v3h7v-3c0-2.66-5.33-4-8-4Z"
          fill="currentColor"
        />
      </svg>
    );

  if (name === "teacher")
    return (
      <svg style={style} viewBox="0 0 24 24" fill="none">
        <path
          d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.42 0-8 2-8 4.5V21h16v-2.5C20 16 16.42 14 12 14Z"
          fill="currentColor"
        />
        <path
          d="M21 7h-5V5h5a1 1 0 0 1 1 1v0a1 1 0 0 1-1 1Z"
          fill="currentColor"
          opacity="0.7"
        />
      </svg>
    );

  if (name === "class")
    return (
      <svg style={style} viewBox="0 0 24 24" fill="none">
        <path
          d="M4 4h16v12H4V4Zm0 14h10v2H4v-2Z"
          fill="currentColor"
        />
      </svg>
    );

  if (name === "money")
    return (
      <svg style={style} viewBox="0 0 24 24" fill="none">
        <path
          d="M3 7h18v10H3V7Zm2 2v6h14V9H5Zm7 1a2 2 0 1 1-2 2 2 2 0 0 1 2-2Z"
          fill="currentColor"
        />
      </svg>
    );

  if (name === "percent")
    return (
      <svg style={style} viewBox="0 0 24 24" fill="none">
        <path
          d="M7 17a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm10-10a3 3 0 1 0-3-3 3 3 0 0 0 3 3ZM6 19l12-14"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );

  return null;
}

function StatCard({ title, value, sub, icon, tone = "default" }) {
  const bg =
    tone === "dark"
      ? "#111"
      : tone === "soft"
      ? "rgba(0,0,0,0.03)"
      : "#fff";

  const color = tone === "dark" ? "#fff" : "inherit";

  return (
    <div
      style={{
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: 16,
        padding: 14,
        background: bg,
        color,
        display: "grid",
        gap: 6,
        minHeight: 92,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div className="muted" style={{ fontSize: 12, color: tone === "dark" ? "rgba(255,255,255,0.8)" : "" }}>
          {title}
        </div>
        <div style={{ opacity: tone === "dark" ? 0.9 : 0.55 }}>
          <Icon name={icon} />
        </div>
      </div>

      <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.1 }}>
        {value}
      </div>

      {sub ? (
        <div
          className="muted"
          style={{
            fontSize: 12,
            color: tone === "dark" ? "rgba(255,255,255,0.75)" : "",
          }}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
}

export default function Dashboard() {
  const [yearMonth, setYearMonth] = useState(ymNow());

  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);

  // from /student-payments/summary (your backend returns {rows, totals})
  const [summary, setSummary] = useState({
    scope: "month",
    period: ymNow(),
    rows: [],
    totals: {
      totalStudents: 0,
      paidCount: 0,
      notPaidCount: 0,
      totalIncome: 0,
      instituteIncome: 0,
      paidPct: 0,
    },
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  async function loadAll() {
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const [stuRes, teRes, clRes, sumRes] = await Promise.all([
        apiFetch("/students"),
        apiFetch("/teachers"),
        apiFetch("/classes"),
        apiFetch(
          `/student-payments/summary?scope=month&yearMonth=${encodeURIComponent(
            yearMonth
          )}`
        ),
      ]);

      setStudents(asArray(stuRes));
      setTeachers(asArray(teRes));
      setClasses(asArray(clRes));

      setSummary({
        scope: sumRes?.scope ?? "month",
        period: sumRes?.period ?? yearMonth,
        rows: Array.isArray(sumRes?.rows) ? sumRes.rows : [],
        totals: {
          totalStudents: safeNum(sumRes?.totals?.totalStudents),
          paidCount: safeNum(sumRes?.totals?.paidCount),
          notPaidCount: safeNum(sumRes?.totals?.notPaidCount),
          totalIncome: safeNum(sumRes?.totals?.totalIncome),
          instituteIncome: safeNum(sumRes?.totals?.instituteIncome),
          paidPct: safeNum(sumRes?.totals?.paidPct),
        },
      });

      setSuccessMsg("Dashboard loaded.");
    } catch (e) {
      setErrorMsg(e.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // reload only summary when month changes (fast)
    (async () => {
      try {
        setLoading(true);
        const sumRes = await apiFetch(
          `/student-payments/summary?scope=month&yearMonth=${encodeURIComponent(
            yearMonth
          )}`
        );

        setSummary({
          scope: sumRes?.scope ?? "month",
          period: sumRes?.period ?? yearMonth,
          rows: Array.isArray(sumRes?.rows) ? sumRes.rows : [],
          totals: {
            totalStudents: safeNum(sumRes?.totals?.totalStudents),
            paidCount: safeNum(sumRes?.totals?.paidCount),
            notPaidCount: safeNum(sumRes?.totals?.notPaidCount),
            totalIncome: safeNum(sumRes?.totals?.totalIncome),
            instituteIncome: safeNum(sumRes?.totals?.instituteIncome),
            paidPct: safeNum(sumRes?.totals?.paidPct),
          },
        });
      } catch (e) {
        setErrorMsg(e.message || "Failed to load month summary");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearMonth]);

  const paidPct = useMemo(() => {
    // if backend provides it, trust it; else compute
    const backendPct = safeNum(summary?.totals?.paidPct);
    if (backendPct) return backendPct;
    return pct(summary.totals.paidCount, summary.totals.totalStudents);
  }, [summary]);

  const monthTitle = useMemo(() => {
    // "2026-03" -> "March 2026"
    const [y, m] = String(yearMonth).split("-");
    const dt = new Date(Number(y), Number(m) - 1, 1);
    return dt.toLocaleString(undefined, { month: "long", year: "numeric" });
  }, [yearMonth]);

  return (
    <div className="grid gap-4">
      <Card title="Dashboard">
        {errorMsg ? <div className="error">{errorMsg}</div> : null}
        {successMsg ? <div className="success">{successMsg}</div> : null}

        <div
          className="grid"
          style={{
            gridTemplateColumns: "1fr auto auto",
            gap: 12,
            alignItems: "end",
          }}
        >
          <div>
            <label className="label">Month</label>
            <Input
              type="month"
              value={yearMonth}
              onChange={(e) => setYearMonth(e.target.value)}
            />
            <div className="muted">Showing summary for: {monthTitle}</div>
          </div>

          <Button type="button" onClick={loadAll} disabled={loading}>
            {loading ? "Loading..." : "Reload All"}
          </Button>

          <div />
        </div>

        <div
          style={{
            marginTop: 14,
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 12,
          }}
        >
          <StatCard
            title="Total Students"
            value={students.length}
            sub="All registered students"
            icon="users"
          />
          <StatCard
            title="Total Teachers"
            value={teachers.length}
            sub="All registered teachers"
            icon="teacher"
          />
          <StatCard
            title="Total Classes"
            value={classes.length}
            sub="Active + inactive"
            icon="class"
          />

          <StatCard
            title={`Total Income (${summary.period})`}
            value={Math.round(summary.totals.totalIncome).toLocaleString()}
            sub="Paid amounts only"
            icon="money"
            tone="soft"
          />
          <StatCard
            title={`Institute Income (${summary.period})`}
            value={Math.round(summary.totals.instituteIncome).toLocaleString()}
            sub="Sum of (paid * institute%)"
            icon="money"
            tone="soft"
          />
          <StatCard
            title={`Paid Percentage (${summary.period})`}
            value={`${paidPct}%`}
            sub={`${summary.totals.paidCount} paid / ${summary.totals.totalStudents} students`}
            icon="percent"
            tone="dark"
          />
        </div>
      </Card>
    </div>
  );
}