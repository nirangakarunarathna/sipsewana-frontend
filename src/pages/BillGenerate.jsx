import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "../utils/apiFetch";
import Card from "../ui/Card.jsx";
import Input from "../ui/Input.jsx";
import Button from "../ui/Button.jsx";
import toast from "react-hot-toast";

function ymNow() {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

function asNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function money(n) {
  const x = asNum(n);
  return Math.round(x).toLocaleString();
}

export default function BillGenerate() {
  const [yearMonth, setYearMonth] = useState(ymNow());
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);

  const [teacherId, setTeacherId] = useState("");
  const [subjectId, setSubjectId] = useState(""); // optional

  const [loading, setLoading] = useState(false);

  // summary from backend
  const [summary, setSummary] = useState(null);

  // adjustments
  const [adjustments, setAdjustments] = useState([]);

  // PDF preview
  const [pdfUrl, setPdfUrl] = useState("");
  const iframeRef = useRef(null);

  // -----------------------------
  // Load teachers + subjects
  // -----------------------------
  async function loadRefs() {
    setLoading(true);
    try {
      const [tRes, sRes] = await Promise.all([
        apiFetch("/teachers"),
        apiFetch("/subjects"),
      ]);

      const tList = Array.isArray(tRes) ? tRes : tRes?.data ?? [];
      const sList = Array.isArray(sRes) ? sRes : sRes?.data ?? [];

      setTeachers(tList);
      setSubjects(sList);

      if (!teacherId && tList[0]?.id) setTeacherId(String(tList[0].id));
    } catch (e) {
      // apiFetch already toast error
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRefs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -----------------------------
  // Load summary
  // -----------------------------
  async function loadSummary() {
    if (!teacherId || !yearMonth) {
      toast.error("Select teacher and month.");
      return;
    }

    setLoading(true);
    setPdfUrl(""); // clear preview when reloading summary
    try {
      const qs = new URLSearchParams({
        teacherId: String(teacherId),
        yearMonth: String(yearMonth),
      });
      if (subjectId) qs.set("subjectId", String(subjectId));

      const res = await apiFetch(
        `/student-payments/teacher-bill/summary?${qs.toString()}`
      );
      setSummary(res);
    } catch (e) {
      setSummary(null);
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (teacherId && yearMonth) loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId, yearMonth, subjectId]);

  // -----------------------------
  // Adjustments
  // -----------------------------
  function addAdjustment(type) {
    setAdjustments((prev) => [...prev, { type, amount: 0, note: "" }]);
  }

  function updateAdjustment(i, patch) {
    setAdjustments((prev) =>
      prev.map((x, idx) => (idx === i ? { ...x, ...patch } : x))
    );
  }

  function removeAdjustment(i) {
    setAdjustments((prev) => prev.filter((_, idx) => idx !== i));
  }

  const adjustmentTotals = useMemo(() => {
    let add = 0;
    let deduct = 0;
    for (const a of adjustments) {
      const amt = asNum(a.amount);
      if (a.type === "add") add += amt;
      else deduct += amt;
    }
    return { add, deduct, net: add - deduct };
  }, [adjustments]);

  const finalTeacherTotal = useMemo(() => {
    const base = asNum(summary?.totals?.teacherIncome ?? 0);
    return base + adjustmentTotals.net;
  }, [summary, adjustmentTotals]);

  // -----------------------------
  // Generate PDF (A4) + Preview
  // ✅ Uses apiFetch (adds Authorization header automatically)
  // ✅ Uses blob response
  // -----------------------------
  async function generatePdf() {
  if (!teacherId || !yearMonth) {
    toast.error("Select teacher and month.");
    return;
  }

  setLoading(true);
  try {
    const payload = {
      teacherId: Number(teacherId),
      yearMonth,
      subjectId: subjectId ? Number(subjectId) : null,
      adjustments: adjustments
        .filter((a) => asNum(a.amount) !== 0 || String(a.note || "").trim())
        .map((a) => ({
          type: a.type,
          amount: asNum(a.amount),
          note: String(a.note || "").trim(),
        })),
    };

    const blob = await apiFetch("/student-payments/teacher-bill/pdf", {
      method: "POST",
      headers: { Accept: "application/pdf" },
      body: JSON.stringify(payload),
      responseType: "blob",
    });

    const url = URL.createObjectURL(blob);

    setPdfUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });

    toast.success("PDF generated.");
  } catch (e) {
    console.error(e);
    // apiFetch already toasts
  } finally {
    setLoading(false);
  }
}

  // -----------------------------
  // Print PDF
  // ✅ Most reliable: open in new tab then print
  // -----------------------------
  function printPdf() {
    if (!pdfUrl) return;

    const w = window.open(pdfUrl, "_blank");
    if (!w) {
      toast.error("Popup blocked. Allow popups to print.");
      return;
    }

    const timer = setInterval(() => {
      try {
        if (w.document.readyState === "complete") {
          clearInterval(timer);
          w.focus();
          w.print();
        }
      } catch {
        // ignore (cross-origin / still loading)
      }
    }, 400);
  }

  // cleanup blob url on unmount
  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  // -----------------------------
  // UI
  // -----------------------------
  return (
    <div className="grid gap-4">
      <Card title="Bill Generate (Teacher)">
        <div
          className="grid"
          style={{
            gridTemplateColumns: "1fr 1fr 1fr auto",
            gap: 12,
            alignItems: "end",
          }}
        >
          <div>
            <label className="label">Year - Month</label>
            <Input
              type="month"
              value={yearMonth}
              onChange={(e) => setYearMonth(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Teacher</label>
            <select
              className="input"
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
            >
              <option value="">Select teacher</option>
              {teachers.map((t) => (
                <option key={t.id} value={String(t.id)}>
                  {t.fullName ?? t.name ?? `Teacher #${t.id}`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Subject (Optional)</label>
            <select
              className="input"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
            >
              <option value="">All Subjects</option>
              {subjects.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.name}
                </option>
              ))}
            </select>
            <div className="muted">
              Example: Select Maths → shows Maths classes only.
            </div>
          </div>

          <Button type="button" onClick={loadSummary} disabled={loading || !teacherId}>
            {loading ? "Loading..." : "Reload"}
          </Button>
        </div>

        {/* Totals cards */}
        <div
          style={{
            marginTop: 12,
            display: "grid",
            gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
            gap: 12,
          }}
        >
          <Stat title="Total Students" value={summary?.totals?.totalStudents ?? 0} />
          <Stat title="Paid" value={summary?.totals?.paidCount ?? 0} />
          <Stat title="Free" value={summary?.totals?.freeCount ?? 0} />
          <Stat title="Not Paid" value={summary?.totals?.notPaidCount ?? 0} />
          <Stat title="Total Income" value={money(summary?.totals?.totalIncome ?? 0)} />
          <Stat title="Institute Income" value={money(summary?.totals?.instituteIncome ?? 0)} />
        </div>

        <div style={{ marginTop: 12 }}>
          <div className="muted" style={{ marginBottom: 6 }}>
            Teacher Total (after institute share) + Adjustments
          </div>

          <div
            style={{
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: 14,
              padding: 12,
              background: "#fff",
              display: "grid",
              gap: 10,
            }}
          >
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <div className="muted" style={{ fontSize: 12 }}>
                  Teacher Amount (Base)
                </div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>
                  {money(summary?.totals?.teacherIncome ?? 0)}
                </div>
              </div>

              <div>
                <div className="muted" style={{ fontSize: 12 }}>
                  Adjustments (Net)
                </div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>
                  {money(adjustmentTotals.net)}
                </div>
              </div>

              <div>
                <div className="muted" style={{ fontSize: 12 }}>
                  Final Teacher Total
                </div>
                <div style={{ fontSize: 22, fontWeight: 900 }}>
                  {money(finalTeacherTotal)}
                </div>
              </div>
            </div>

            <div className="row" style={{ gap: 8 }}>
              <Button type="button" onClick={() => addAdjustment("add")}>
                + Add Price
              </Button>
              <Button type="button" onClick={() => addAdjustment("deduct")}>
                - Deduct Price
              </Button>
            </div>

            {adjustments.length ? (
              <div className="grid" style={{ gap: 8 }}>
                {adjustments.map((a, i) => (
                  <div
                    key={i}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "120px 140px 1fr auto",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <select
                      className="input"
                      value={a.type}
                      onChange={(e) => updateAdjustment(i, { type: e.target.value })}
                    >
                      <option value="add">ADD</option>
                      <option value="deduct">DEDUCT</option>
                    </select>

                    <Input
                      type="number"
                      value={a.amount}
                      onChange={(e) => updateAdjustment(i, { amount: e.target.value })}
                      placeholder="Amount"
                    />

                    <Input
                      value={a.note}
                      onChange={(e) => updateAdjustment(i, { note: e.target.value })}
                      placeholder="Note (ex: Travel / Bonus / Penalty...)"
                    />

                    <button
                      type="button"
                      className="linkBtn"
                      onClick={() => removeAdjustment(i)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="muted">No adjustments added.</div>
            )}
          </div>
        </div>
      </Card>

      {/* Class-wise table */}
      <Card title="Class-wise Breakdown">
        <div className="tableWrap" style={{ overflowX: "auto" }}>
          <table className="table" style={{ minWidth: 1100 }}>
            <thead>
              <tr>
                <th>Class</th>
                <th>Institute %</th>
                <th>Total Students</th>
                <th>Paid</th>
                <th>Free</th>
                <th>Not Paid</th>
                <th>Total Income</th>
                <th>Institute Amount</th>
                <th>Teacher Amount</th>
              </tr>
            </thead>
            <tbody>
              {(summary?.rows ?? []).map((r) => (
                <tr key={r.classId}>
                  <td>{r.className}</td>
                  <td>{asNum(r.institutePercentage)}%</td>
                  <td>{asNum(r.totalStudents)}</td>
                  <td>{asNum(r.paidCount)}</td>
                  <td>{asNum(r.freeCount)}</td>
                  <td>{asNum(r.notPaidCount)}</td>
                  <td>{money(r.totalIncome)}</td>
                  <td>{money(r.instituteIncome)}</td>
                  <td>{money(r.teacherIncome)}</td>
                </tr>
              ))}

              {!summary?.rows?.length ? (
                <tr>
                  <td colSpan={9} className="muted">
                    No data for selected month/teacher/subject.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      {/* PDF Preview */}
      <Card title="A4 PDF Preview & Print">
        <div className="row" style={{ gap: 10 }}>
          <Button type="button" onClick={generatePdf} disabled={loading || !teacherId}>
            {loading ? "Generating..." : "Generate PDF"}
          </Button>

          <Button type="button" onClick={printPdf} disabled={!pdfUrl}>
            Print
          </Button>

          {pdfUrl ? (
            <a className="linkBtn" href={pdfUrl} target="_blank" rel="noreferrer">
              Open in new tab
            </a>
          ) : null}
        </div>

        {!pdfUrl ? (
          <div className="muted" style={{ marginTop: 10 }}>
            Click “Generate PDF” to preview A4 bill.
          </div>
        ) : (
          <div
            style={{
              marginTop: 12,
              border: "1px solid rgba(0,0,0,0.10)",
              borderRadius: 12,
              overflow: "hidden",
              background: "#fff",
            }}
          >
            <iframe
              ref={iframeRef}
              title="Bill PDF Preview"
              src={pdfUrl}
              style={{
                width: "100%",
                height: "900px",
                border: "0",
              }}
            />
          </div>
        )}
      </Card>
    </div>
  );
}

function Stat({ title, value }) {
  return (
    <div
      style={{
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: 14,
        padding: 12,
        background: "#fff",
      }}
    >
      <div className="muted" style={{ fontSize: 12 }}>
        {title}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800 }}>{value}</div>
    </div>
  );
}