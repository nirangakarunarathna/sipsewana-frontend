import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "../utils/apiFetch";
import Card from "../ui/Card.jsx";
import Input from "../ui/Input.jsx";
import Button from "../ui/Button.jsx";
import toast from "react-hot-toast";

import instituteLogo from "../assets/logo.jpg";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function ymNow() {
  return new Date().toISOString().slice(0, 7);
}

function formatYearMonthLabel(ym) {
  if (!ym) return "";
  const [year, month] = String(ym).split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);

  return d.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function asNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function money(n) {
  const x = asNum(n);
  return Math.round(x).toLocaleString();
}

function avgInstitutePctFromTotals(totalIncome, instituteIncome) {
  const ti = asNum(totalIncome);
  const ii = asNum(instituteIncome);
  if (!ti) return 0;
  return Math.round((ii / ti) * 100);
}

function netFromAdjustments(list) {
  let add = 0;
  let deduct = 0;
  for (const a of list) {
    const amt = asNum(a.amount);
    if (a.type === "add") add += amt;
    else deduct += amt;
  }
  return { add, deduct, net: add - deduct };
}

function cleanAdjustments(list) {
  return (list || [])
    .map((a) => ({
      type: a?.type === "deduct" ? "deduct" : "add",
      amount: asNum(a?.amount),
      note: String(a?.note || "").trim(),
    }))
    .filter((a) => a.amount !== 0 || a.note);
}

export default function BillGenerate() {
  const [yearMonth, setYearMonth] = useState(ymNow());
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);

  const [teacherId, setTeacherId] = useState("");
  const [subjectId, setSubjectId] = useState("");

  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);

  // Section 1: affects TOTAL income; institute recalculated by %
  const [adjSection1, setAdjSection1] = useState([]);

  // Section 2: affects TEACHER total only
  const [adjSection2, setAdjSection2] = useState([]);

  // PDF preview
  const [pdfUrl, setPdfUrl] = useState("");
  const iframeRef = useRef(null);

  const pdfTitle = "Sipsewana Teacher Payment Statement";
  const monthLabel = useMemo(() => formatYearMonthLabel(yearMonth), [yearMonth]);

  // -----------------------------
  // UI Styles
  // -----------------------------
  const panelStyle = {
    border: "1px solid rgba(0,0,0,0.08)",
    borderRadius: 18,
    padding: 14,
    background: "linear-gradient(180deg, #ffffff, #fafafa)",
    boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
    display: "grid",
    gap: 10,
  };

  const badgeStyle = {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    background: "rgba(0,0,0,0.06)",
  };

  const highlightTotalStyle = {
    padding: "10px 14px",
    borderRadius: 16,
    background:
      "linear-gradient(90deg, rgba(34,197,94,0.12), rgba(34,197,94,0.04))",
    border: "1px solid rgba(34,197,94,0.28)",
    fontWeight: 950,
    fontSize: 24,
  };

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
    setPdfUrl("");
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
  // Section helpers
  // -----------------------------
  function addAdj1(type) {
    setAdjSection1((prev) => [...prev, { type, amount: 0, note: "" }]);
  }

  function addAdj2(type) {
    setAdjSection2((prev) => [...prev, { type, amount: 0, note: "" }]);
  }

  function updateAdj1(i, patch) {
    setAdjSection1((prev) =>
      prev.map((x, idx) => (idx === i ? { ...x, ...patch } : x))
    );
  }

  function updateAdj2(i, patch) {
    setAdjSection2((prev) =>
      prev.map((x, idx) => (idx === i ? { ...x, ...patch } : x))
    );
  }

  function removeAdj1(i) {
    setAdjSection1((prev) => prev.filter((_, idx) => idx !== i));
  }

  function removeAdj2(i) {
    setAdjSection2((prev) => prev.filter((_, idx) => idx !== i));
  }

  // -----------------------------
  // FINAL CALC (UI + PDF)
  // -----------------------------
  const totalsBase = useMemo(() => {
    const totalIncomeBase = asNum(summary?.totals?.totalIncome ?? 0);
    const instituteIncomeBase = asNum(summary?.totals?.instituteIncome ?? 0);
    const institutePct = avgInstitutePctFromTotals(
      totalIncomeBase,
      instituteIncomeBase
    );

    return { totalIncomeBase, instituteIncomeBase, institutePct };
  }, [summary]);

  const sec1 = useMemo(() => netFromAdjustments(adjSection1), [adjSection1]);
  const sec2 = useMemo(() => netFromAdjustments(adjSection2), [adjSection2]);

  const finalCalc = useMemo(() => {
    const totalIncomeAfter1 = totalsBase.totalIncomeBase + sec1.net;

    const instituteIncomeAfter1 = Math.round(
      (totalIncomeAfter1 * totalsBase.institutePct) / 100
    );

    const teacherBaseAfterInstitute = totalIncomeAfter1 - instituteIncomeAfter1;
    const finalTeacherTotal = teacherBaseAfterInstitute + sec2.net;

    return {
      totalIncomeAfter1,
      instituteIncomeAfter1,
      teacherBaseAfterInstitute,
      finalTeacherTotal,
    };
  }, [totalsBase, sec1, sec2]);

  // -----------------------------
  // SAVE BILL
  // -----------------------------
  async function saveBill() {
    if (!teacherId || !yearMonth) {
      toast.error("Select teacher and month.");
      return;
    }
    if (!summary) {
      toast.error("Summary not loaded yet.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        teacherId: String(teacherId),
        yearMonth: String(yearMonth),
        monthLabel,
        subjectId: subjectId ? String(subjectId) : null,

        institutePct: totalsBase.institutePct,

        totalsBase: {
          totalIncomeBase: asNum(totalsBase.totalIncomeBase),
          instituteIncomeBase: asNum(totalsBase.instituteIncomeBase),
        },

        section1: {
          items: cleanAdjustments(adjSection1),
          net: asNum(sec1.net),
        },

        section2: {
          items: cleanAdjustments(adjSection2),
          net: asNum(sec2.net),
        },

        final: {
          totalIncomeAfter1: asNum(finalCalc.totalIncomeAfter1),
          instituteIncomeAfter1: asNum(finalCalc.instituteIncomeAfter1),
          teacherBaseAfterInstitute: asNum(finalCalc.teacherBaseAfterInstitute),
          finalTeacherTotal: asNum(finalCalc.finalTeacherTotal),
        },

        rows: summary?.rows ?? [],
      };

      await apiFetch("/teacher-bills", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      toast.success("Bill saved successfully.");
    } catch (e) {
      toast.error(e?.message || "Save failed. If already saved, try Update.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  // -----------------------------
  // FRONTEND PDF GENERATION
  // -----------------------------
  function generatePdfFrontend() {
    if (!summary) {
      toast.error("Summary not loaded yet.");
      return;
    }

    const teacher =
      teachers.find((t) => String(t.id) === String(teacherId)) || null;
    const subject =
      subjectId
        ? subjects.find((s) => String(s.id) === String(subjectId)) || null
        : null;

    const clean1 = cleanAdjustments(adjSection1);
    const clean2 = cleanAdjustments(adjSection2);

    const doc = new jsPDF("p", "pt", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const sideMargin = 40;
    const contentWidth = pageWidth - sideMargin * 2;
    let y = 32;

    // Logo
    try {
      doc.addImage(instituteLogo, "JPEG", sideMargin, y, 56, 56);
    } catch (err) {
      try {
        doc.addImage(instituteLogo, "PNG", sideMargin, y, 56, 56);
      } catch (err2) {
        console.warn("Logo could not be added to PDF", err2);
      }
    }

    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(pdfTitle, pageWidth / 2, y + 18, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Puttalam Road, Hanhamuna Junction, Maspotha", pageWidth / 2, y + 38, {
      align: "center",
    });
    doc.text("Puttalam Road, Hanhamuna Junction, Maspotha", pageWidth / 2, y + 38, {
      align: "center",
    });

    y += 72;

    // Teacher + month highlighted table
    autoTable(doc, {
      startY: y,
      margin: { left: sideMargin, right: sideMargin },
      tableWidth: contentWidth,
      theme: "grid",
      styles: {
        fontSize: 11,
        cellPadding: 8,
        lineColor: [120, 120, 120],
        lineWidth: 0.6,
        valign: "middle",
      },
      bodyStyles: {
        fontStyle: "bold",
      },
      columnStyles: {
        0: { cellWidth: 120, fontStyle: "bold" },
        1: { cellWidth: contentWidth / 2 - 60, fontSize: 11 },
        2: { cellWidth: 120, fontStyle: "bold" },
        3: { cellWidth: contentWidth / 2 - 60, fontSize: 11 },
      },
      body: [
        [
          "Teacher Name",
          teacher?.fullName ?? teacher?.name ?? `Teacher #${teacherId}`,
          "Month",
          monthLabel,
        ],
    
      ],
    });

    y = doc.lastAutoTable.finalY + 18;

    // Summary
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Summary", sideMargin, y);
    y += 8;

    autoTable(doc, {
      startY: y,
      margin: { left: sideMargin, right: sideMargin },
      tableWidth: contentWidth,
      theme: "grid",
      styles: {
        fontSize: 10,
        cellPadding: 6,
        valign: "middle",
      },
      headStyles: {
        fontStyle: "bold",
      },
      head: [["Item", "Value"]],
      body: [
        ["Total Students", String(summary?.totals?.totalStudents ?? 0)],
        ["Paid", String(summary?.totals?.paidCount ?? 0)],
        ["Free", String(summary?.totals?.freeCount ?? 0)],
        ["Not Paid", String(summary?.totals?.notPaidCount ?? 0)],
        ["Total Income (Base)", money(totalsBase.totalIncomeBase)],
        ["Institute Income (Base)", money(totalsBase.instituteIncomeBase)],
        ["Institute % (from totals)", `${totalsBase.institutePct}%`],
      ],
      columnStyles: {
        0: { cellWidth: contentWidth * 0.62 },
        1: { cellWidth: contentWidth * 0.38, halign: "right" },
      },
    });

    y = doc.lastAutoTable.finalY + 18;

    // Section 1
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Section 1 Adjustments (Affects Total Income)", sideMargin, y);
    y += 8;

    autoTable(doc, {
      startY: y,
      margin: { left: sideMargin, right: sideMargin },
      tableWidth: contentWidth,
      theme: "grid",
      styles: {
        fontSize: 10,
        cellPadding: 6,
        overflow: "linebreak",
        valign: "middle",
      },
      headStyles: {
        fontStyle: "bold",
      },
      head: [["Type", "Amount", "Note"]],
      body: clean1.length
        ? clean1.map((a) => [a.type.toUpperCase(), money(a.amount), a.note || "-"])
        : [["-", "0", "No adjustments"]],
      columnStyles: {
        0: { cellWidth: contentWidth * 0.18, halign: "center" },
        1: { cellWidth: contentWidth * 0.22, halign: "right" },
        2: { cellWidth: contentWidth * 0.6 },
      },
    });

    y = doc.lastAutoTable.finalY + 16;

    // Section 2
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Section 2 Adjustments (Affects Teacher Total)", sideMargin, y);
    y += 8;

    autoTable(doc, {
      startY: y,
      margin: { left: sideMargin, right: sideMargin },
      tableWidth: contentWidth,
      theme: "grid",
      styles: {
        fontSize: 10,
        cellPadding: 6,
        overflow: "linebreak",
        valign: "middle",
      },
      headStyles: {
        fontStyle: "bold",
      },
      head: [["Type", "Amount", "Note"]],
      body: clean2.length
        ? clean2.map((a) => [a.type.toUpperCase(), money(a.amount), a.note || "-"])
        : [["-", "0", "No adjustments"]],
      columnStyles: {
        0: { cellWidth: contentWidth * 0.18, halign: "center" },
        1: { cellWidth: contentWidth * 0.22, halign: "right" },
        2: { cellWidth: contentWidth * 0.6 },
      },
    });

    y = doc.lastAutoTable.finalY + 16;

    // Final Payment Calculation
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Final Payment Calculation", sideMargin, y);
    y += 8;

    autoTable(doc, {
      startY: y,
      margin: { left: sideMargin, right: sideMargin },
      tableWidth: contentWidth,
      theme: "grid",
      styles: {
        fontSize: 10,
        cellPadding: 6,
        valign: "middle",
      },
      headStyles: {
        fontStyle: "bold",
      },
      bodyStyles: {
        fontStyle: "normal",
      },
      head: [["Item", "Value"]],
      body: [
        ["Total Income (Base)", money(totalsBase.totalIncomeBase)],
        ["Section 1 Net", money(sec1.net)],
        ["Total Income (After Section 1)", money(finalCalc.totalIncomeAfter1)],
        [
          `Institute Income (Recalculated ${totalsBase.institutePct}%)`,
          money(finalCalc.instituteIncomeAfter1),
        ],
        [
          "Teacher Base (After Institute)",
          money(finalCalc.teacherBaseAfterInstitute),
        ],
        ["Section 2 Net", money(sec2.net)],
        ["Final Teacher Payment", money(finalCalc.finalTeacherTotal)],
      ],
      columnStyles: {
        0: { cellWidth: contentWidth * 0.62 },
        1: { cellWidth: contentWidth * 0.38, halign: "right" },
      },
      didParseCell(data) {
        if (data.section === "body" && data.row.index === 6) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fontSize = 12;
        }
      },
    });

    y = doc.lastAutoTable.finalY + 18;

    // Class-wise breakdown
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Class-wise Breakdown", sideMargin, y);
    y += 8;

    const rows = (summary?.rows ?? []).map((r) => [
      r.className,
      `${asNum(r.institutePercentage)}%`,
      String(asNum(r.totalStudents)),
      String(asNum(r.paidCount)),
      String(asNum(r.freeCount)),
      String(asNum(r.notPaidCount)),
      money(r.totalIncome),
      money(r.instituteIncome),
      money(r.teacherIncome),
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: sideMargin, right: sideMargin },
      tableWidth: contentWidth,
      theme: "grid",
      styles: {
        fontSize: 8,
        cellPadding: 4,
        overflow: "linebreak",
        valign: "middle",
      },
      headStyles: {
        fontStyle: "bold",
      },
      head: [
        [
          "Class",
          "Inst %",
          "Tot",
          "Paid",
          "Free",
          "Not Paid",
          "Income",
          "Institute",
          "Teacher",
        ],
      ],
      body: rows.length
        ? rows
        : [["-", "-", "-", "-", "-", "-", "-", "-", "-"]],
      columnStyles: {
        0: { cellWidth: contentWidth * 0.26 },
        1: { cellWidth: contentWidth * 0.09, halign: "center" },
        2: { cellWidth: contentWidth * 0.07, halign: "center" },
        3: { cellWidth: contentWidth * 0.07, halign: "center" },
        4: { cellWidth: contentWidth * 0.07, halign: "center" },
        5: { cellWidth: contentWidth * 0.09, halign: "center" },
        6: { cellWidth: contentWidth * 0.12, halign: "right" },
        7: { cellWidth: contentWidth * 0.12, halign: "right" },
        8: { cellWidth: contentWidth * 0.11, halign: "right" },
      },
    });

    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);

    setPdfUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });

    toast.success("PDF generated.");
  }

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
        // ignore
      }
    }, 400);
  }

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
      <Card title="Sipsewana Teacher Payment Statement">
        <div
          className="grid"
          style={{
            gridTemplateColumns: "1fr 1fr auto",
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

          <Button
            type="button"
            onClick={loadSummary}
            disabled={loading || !teacherId}
          >
            {loading ? "Loading..." : "Reload"}
          </Button>
        </div>

        <div className="muted" style={{ marginTop: 10, fontSize: 14 }}>
          Statement Month: <strong>{monthLabel}</strong>
        </div>

        <div className="row" style={{ gap: 10, marginTop: 14 }}>
          <Button
            type="button"
            onClick={saveBill}
            disabled={loading || !summary || !teacherId || !yearMonth}
          >
            {loading ? "Saving..." : "Save Bill"}
          </Button>

          <Button
            type="button"
            onClick={generatePdfFrontend}
            disabled={!summary}
          >
            Generate PDF
          </Button>

          <Button type="button" onClick={printPdf} disabled={!pdfUrl}>
            Print
          </Button>

          {pdfUrl ? (
            <a
              className="linkBtn"
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open PDF
            </a>
          ) : null}
        </div>

        <div
          style={{
            marginTop: 12,
            display: "grid",
            gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
            gap: 12,
          }}
        >
          <Stat
            title="Total Students"
            value={summary?.totals?.totalStudents ?? 0}
          />
          <Stat title="Paid" value={summary?.totals?.paidCount ?? 0} />
          <Stat title="Free" value={summary?.totals?.freeCount ?? 0} />
          <Stat title="Not Paid" value={summary?.totals?.notPaidCount ?? 0} />
          <Stat
            title="Total Income (Base)"
            value={money(totalsBase.totalIncomeBase)}
          />
          <Stat
            title="Institute Income (Base)"
            value={money(totalsBase.instituteIncomeBase)}
          />
        </div>

        {/* SECTION 1 */}
        <div style={{ marginTop: 14 }}>
          <div style={panelStyle}>
            <div
              className="row"
              style={{ justifyContent: "space-between", marginBottom: 4 }}
            >
              <div style={badgeStyle}>SECTION 1</div>
              <div className="muted" style={{ fontSize: 12 }}>
                Affects Total Income • Institute recalculated by %
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr 1fr",
                gap: 12,
                alignItems: "end",
              }}
            >
              <div>
                <div className="muted" style={{ fontSize: 12 }}>
                  Institute % (from totals)
                </div>
                <div style={{ fontSize: 20, fontWeight: 900 }}>
                  {totalsBase.institutePct}%
                </div>
              </div>

              <div>
                <div className="muted" style={{ fontSize: 12 }}>
                  Total Income (After Section 1)
                </div>
                <div style={{ fontSize: 20, fontWeight: 900 }}>
                  {money(finalCalc.totalIncomeAfter1)}
                </div>
              </div>

              <div>
                <div className="muted" style={{ fontSize: 12 }}>
                  Institute Income (After Section 1)
                </div>
                <div style={{ fontSize: 20, fontWeight: 900 }}>
                  {money(finalCalc.instituteIncomeAfter1)}
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div className="muted" style={{ fontSize: 12 }}>
                  Section 1 Net
                </div>
                <div style={{ fontSize: 20, fontWeight: 900 }}>
                  {money(sec1.net)}
                </div>
              </div>
            </div>

            <div className="row" style={{ gap: 8 }}>
              <Button type="button" onClick={() => addAdj1("add")}>
                + Add (Total)
              </Button>
              <Button type="button" onClick={() => addAdj1("deduct")}>
                - Deduct (Total)
              </Button>
            </div>

            {adjSection1.length ? (
              <div className="grid" style={{ gap: 8 }}>
                {adjSection1.map((a, i) => (
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
                      onChange={(e) => updateAdj1(i, { type: e.target.value })}
                    >
                      <option value="add">ADD</option>
                      <option value="deduct">DEDUCT</option>
                    </select>

                    <Input
                      type="number"
                      value={a.amount}
                      onChange={(e) =>
                        updateAdj1(i, { amount: e.target.value })
                      }
                      placeholder="Amount"
                    />

                    <Input
                      value={a.note}
                      onChange={(e) => updateAdj1(i, { note: e.target.value })}
                      placeholder="Note (ex: Travel / Bonus / Penalty...)"
                    />

                    <button
                      type="button"
                      className="linkBtn"
                      onClick={() => removeAdj1(i)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="muted">No section 1 adjustments.</div>
            )}
          </div>
        </div>

        {/* SECTION 2 */}
        <div style={{ marginTop: 14 }}>
          <div style={panelStyle}>
            <div
              className="row"
              style={{ justifyContent: "space-between", marginBottom: 4 }}
            >
              <div style={badgeStyle}>SECTION 2</div>
              <div className="muted" style={{ fontSize: 12 }}>
                Directly affects Teacher Total
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 12,
                alignItems: "end",
              }}
            >
              <div>
                <div className="muted" style={{ fontSize: 12 }}>
                  Teacher Base (After Institute)
                </div>
                <div style={{ fontSize: 20, fontWeight: 900 }}>
                  {money(finalCalc.teacherBaseAfterInstitute)}
                </div>
              </div>

              <div>
                <div className="muted" style={{ fontSize: 12 }}>
                  Section 2 Net
                </div>
                <div style={{ fontSize: 20, fontWeight: 900 }}>
                  {money(sec2.net)}
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div className="muted" style={{ fontSize: 12 }}>
                  Final Teacher Total
                </div>
                <div style={highlightTotalStyle}>
                  {money(finalCalc.finalTeacherTotal)}
                </div>
              </div>
            </div>

            <div className="row" style={{ gap: 8 }}>
              <Button type="button" onClick={() => addAdj2("add")}>
                + Add (Teacher Total)
              </Button>
              <Button type="button" onClick={() => addAdj2("deduct")}>
                - Deduct (Teacher Total)
              </Button>
            </div>

            {adjSection2.length ? (
              <div className="grid" style={{ gap: 8 }}>
                {adjSection2.map((a, i) => (
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
                      onChange={(e) => updateAdj2(i, { type: e.target.value })}
                    >
                      <option value="add">ADD</option>
                      <option value="deduct">DEDUCT</option>
                    </select>

                    <Input
                      type="number"
                      value={a.amount}
                      onChange={(e) =>
                        updateAdj2(i, { amount: e.target.value })
                      }
                      placeholder="Amount"
                    />

                    <Input
                      value={a.note}
                      onChange={(e) => updateAdj2(i, { note: e.target.value })}
                      placeholder="Note (ex: Bonus / Penalty...)"
                    />

                    <button
                      type="button"
                      className="linkBtn"
                      onClick={() => removeAdj2(i)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="muted">No section 2 adjustments.</div>
            )}
          </div>
        </div>
      </Card>

      <Card title="Final Payment Summary">
        <div
          style={{
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: 14,
            padding: 14,
            background: "#fff",
            display: "grid",
            gap: 8,
          }}
        >
          <RowLine
            label="Total Income (Base)"
            value={money(totalsBase.totalIncomeBase)}
          />
          <RowLine label="Section 1 Net" value={money(sec1.net)} />

          <div style={{ height: 10 }} />

          <RowLine
            label="Total Income (After Section 1)"
            value={money(finalCalc.totalIncomeAfter1)}
          />
          <RowLine
            label={`Institute Income (Recalculated ${totalsBase.institutePct}%)`}
            value={money(finalCalc.instituteIncomeAfter1)}
          />
          <RowLine
            label="Teacher Base (After Institute)"
            value={money(finalCalc.teacherBaseAfterInstitute)}
          />
          <RowLine label="Section 2 Net" value={money(sec2.net)} />

          <div style={{ height: 10 }} />

          <div
            className="row"
            style={{ justifyContent: "space-between", gap: 10 }}
          >
            <div style={{ fontWeight: 900 }}>Final Teacher Payment</div>
            <div style={{ minWidth: 240, textAlign: "right" }}>
              <div style={highlightTotalStyle}>
                {money(finalCalc.finalTeacherTotal)}
              </div>
            </div>
          </div>
        </div>
      </Card>

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

      <Card title="A4 Payment Statement Preview & Print">
        {!pdfUrl ? (
          <div className="muted">
            Click “Generate PDF” above to preview the A4 payment statement.
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
              style={{ width: "100%", height: "900px", border: "0" }}
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

function RowLine({ label, value, strong }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
      <div style={{ fontWeight: strong ? 900 : 600 }}>{label}</div>
      <div style={{ fontWeight: strong ? 950 : 700 }}>{value}</div>
    </div>
  );
}