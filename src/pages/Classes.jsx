import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../utils/apiFetch";
import Card from "../ui/Card.jsx";
import Input from "../ui/Input.jsx";
import Button from "../ui/Button.jsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "./../assets/fonts/NotoSansSinhala-Bold-bold.js";
import html2canvas from "html2canvas";

export default function Classes() {
  const [grades, setGrades] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);

  const [gradeId, setGradeId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [name, setName] = useState("");
  const [fee, setFee] = useState("");
  const [institutePercentage, setInstitutePercentage] = useState("25");

  const [classes, setClasses] = useState([]);
  const [search, setSearch] = useState("");

  const [loadingRefs, setLoadingRefs] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [printingId, setPrintingId] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const canSubmit = useMemo(() => {
    return (
      gradeId &&
      subjectId &&
      teacherId &&
      name.trim() &&
      String(fee).trim() !== "" &&
      String(institutePercentage).trim() !== ""
    );
  }, [gradeId, subjectId, teacherId, name, fee, institutePercentage]);

  async function loadRefs() {
    setLoadingRefs(true);
    setErrorMsg("");
    try {
      const [g, s, t] = await Promise.all([
        apiFetch("/grades", { method: "GET" }),
        apiFetch("/subjects", { method: "GET" }),
        apiFetch("/teachers", { method: "GET" }),
      ]);

      const gList = Array.isArray(g) ? g : (g?.data ?? []);
      const sList = Array.isArray(s) ? s : (s?.data ?? []);
      const tList = Array.isArray(t) ? t : (t?.data ?? []);

      setGrades(gList);
      setSubjects(sList);
      setTeachers(tList);

      setGradeId((prev) => prev || (gList[0]?.id ? String(gList[0].id) : ""));
      setSubjectId((prev) => prev || (sList[0]?.id ? String(sList[0].id) : ""));
      setTeacherId((prev) => prev || (tList[0]?.id ? String(tList[0].id) : ""));
    } catch (e) {
      setErrorMsg(e.message || "Failed to load grades/subjects/teachers");
    } finally {
      setLoadingRefs(false);
    }
  }

  async function loadClasses() {
    setLoadingList(true);
    setErrorMsg("");
    try {
      const data = await apiFetch("/classes", { method: "GET" });
      const list = Array.isArray(data) ? data : (data?.data ?? []);
      setClasses(list);
    } catch (e) {
      setErrorMsg(e.message || "Failed to load classes");
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    loadRefs();
    loadClasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredClasses = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return classes;

    return classes.filter((c) => {
      const n = (c.name || "").toLowerCase();
      const g = (c.grade?.name || c.gradeName || "").toLowerCase();
      const s = (c.subject?.name || c.subjectName || "").toLowerCase();
      const t = (c.teacher?.fullName || c.teacherName || "").toLowerCase();
      const p = String(
        c.institutePercentage ??
          c.institute_percentage ??
          c.institute_percent ??
          "",
      ).toLowerCase();

      return (
        n.includes(q) ||
        g.includes(q) ||
        s.includes(q) ||
        t.includes(q) ||
        p.includes(q)
      );
    });
  }, [classes, search]);

  async function onCreateClass(e) {
    e.preventDefault();
    if (!canSubmit) return;

    const perc = Number(institutePercentage);
    if (Number.isNaN(perc) || perc < 0 || perc > 100) {
      setErrorMsg("Institute Percentage must be between 0 and 100.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const payload = {
        gradeId: Number(gradeId),
        subjectId: Number(subjectId),
        teacherId: Number(teacherId),
        name: name.trim(),
        fee: Number(fee),
        institutePercentage: perc,
      };

      await apiFetch("/classes", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setSuccessMsg("Class registered successfully.");
      setName("");
      setFee("");
      setInstitutePercentage("25");
      await loadClasses();
    } catch (e) {
      setErrorMsg(e.message || "Failed to register class");
    } finally {
      setSubmitting(false);
    }
  }

  async function loadSinhalaFont(doc) {
    try {
      // Method 1: If you have the font file in public folder
      // doc.addFont('/fonts/NotoSansSinhala-Bold.ttf', 'NotoSansSinhala-Bold', 'bold');
      // doc.setFont('NotoSansSinhala-Bold');

      // Method 2: Using addFileToVFS (works better)
      // doc.addFileToVFS('NotoSansSinhala-Bold.ttf', notoSansSinhalaBase64);
      // doc.addFont('NotoSansSinhala-Bold.ttf', 'NotoSansSinhala-Bold', 'bold');
      // doc.setFont('NotoSansSinhala-Bold');

      // Method 3: Simple fallback - use built-in font but with better rendering
      doc.setFont("helvetica");

      return true;
    } catch (error) {
      console.error("Font loading error:", error);
      doc.setFont("helvetica");
      return false;
    }
  }

  async function deleteClass(row) {
    const ok = window.confirm(`Delete class "${row.name}"?`);
    if (!ok) return;

    setErrorMsg("");
    setSuccessMsg("");

    try {
      await apiFetch(`/classes/${row.id}`, { method: "DELETE" });
      setSuccessMsg("Class deleted.");
      await loadClasses();
    } catch (e) {
      setErrorMsg(e.message || "Failed to delete class");
    }
  }

  async function toggleActive(row) {
    const current = !!(row.isActive ?? row.active ?? true);
    const next = !current;

    setErrorMsg("");
    setSuccessMsg("");

    try {
      await apiFetch(`/classes/${row.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: next }),
      });
      setSuccessMsg(`Class ${next ? "activated" : "deactivated"}.`);
      await loadClasses();
    } catch (e) {
      setErrorMsg(e.message || "Failed to update status");
    }
  }

async function printStudents(row) {
  setPrintingId(row.id);
  setErrorMsg("");
  setSuccessMsg("");

  try {
    const res = await apiFetch(
      `/student-classes?classId=${encodeURIComponent(row.id)}`,
      { method: "GET" }
    );

    const list = Array.isArray(res) ? res : res?.data ?? [];

    const gradeName = row.grade?.name ?? row.gradeName ?? "-";
    const subjectName = row.subject?.name ?? row.subjectName ?? "-";
    const teacherName =
      row.teacher?.fullName ?? row.teacherName ?? row.teacher?.name ?? "-";
    const classFee = row.fee ? Number(row.fee).toLocaleString() : "-";

    const pdf = new jsPDF("l", "pt", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const marginLeft = 14;
    const marginRight = 14;
    const marginTop = 55;
    const marginBottom = 20;

    const usableWidth = pageWidth - marginLeft - marginRight;
    const usableHeight = pageHeight - marginTop - marginBottom;

    const printWidth = 1750;
    const maxDomPageHeight = Math.floor(
      (usableHeight * printWidth) / usableWidth
    );

    const headerCellStyle = `
      border:1px solid #222;
      padding:12px 8px;
      font-size:20px;
      font-weight:700;
      text-align:center;
      vertical-align:middle;
      line-height:1.35;
      white-space:normal;
      word-break:break-word;
    `;

    const bodyCellStyle = `
      border:1px solid #222;
      padding:10px 8px;
      font-size:18px;
      vertical-align:middle;
      line-height:1.5;
      height:48px;
      box-sizing:border-box;
    `;

    const centeredBodyCellStyle = `
      border:1px solid #222;
      padding:10px 8px;
      font-size:16px;
      text-align:center;
      vertical-align:middle;
      line-height:1.4;
      height:42px;
      box-sizing:border-box;
    `;

    const tailCells = Array.from(
      { length: 14 },
      () => `<td style="${bodyCellStyle}"></td>`
    ).join("");

    const buildTopHeader = () => `
      <div style="padding:24px 20px 18px 20px; color:#000;">
        <div style="
          text-align:center;
          font-size:30px;
          font-weight:700;
          margin-bottom:16px;
          line-height:1.2;
        ">
          ${row.name || "-"}
        </div>

        <div style="
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:20px;
          border:1px solid #999;
          border-radius:6px;
          padding:12px 16px;
          margin-bottom:18px;
          font-size:17px;
          font-weight:600;
        ">
          <div><span style="font-weight:700;">Grade:</span> ${gradeName}</div>
          <div><span style="font-weight:700;">Subject:</span> ${subjectName}</div>
          <div><span style="font-weight:700;">Teacher's Name:</span> ${teacherName}</div>
          <div><span style="font-weight:700;">Fee:</span> ${classFee}</div>
          <div><span style="font-weight:700;">Month:</span> _ _ _ _ _ _ _ _ _ _</div>
        </div>
      </div>
    `;

    const buildTableOpen = () => `
      <table style="
        width:100%;
        border-collapse:collapse;
        table-layout:fixed;
        border:1px solid #222;
      ">
        <colgroup>
          <col style="width:2.2%">
          <col style="width:3.5%">
          <col style="width:17%">
          <col style="width:7.2%">
          <col style="width:5.2%">
          <col style="width:5.2%">
          <col style="width:5.2%">
          <col style="width:5.2%">
          <col style="width:5.2%">
          <col style="width:5.2%">
          <col style="width:5.2%">
          <col style="width:5.2%">
          <col style="width:5.3%">
          <col style="width:4.8%">
          <col style="width:5.5%">
          <col style="width:5.3%">
          <col style="width:5.5%">
          <col style="width:5.5%">
        </colgroup>

        <thead>
          <tr style="background:#f1f1f1;">
            <th style="${headerCellStyle}">No</th>
            <th style="${headerCellStyle}">සිසු අංකය</th>
            <th style="${headerCellStyle}">සිසුවාගේ නම</th>
            <th style="${headerCellStyle}">දුරකථන අංකය</th>
            <th style="${headerCellStyle}">1 වන දිනය</th>
            <th style="${headerCellStyle}">2 වන දිනය</th>
            <th style="${headerCellStyle}">3 වන දිනය</th>
            <th style="${headerCellStyle}">4 වන දිනය</th>
            <th style="${headerCellStyle}">5 වන දිනය</th>
            <th style="${headerCellStyle}">6 වන දිනය</th>
            <th style="${headerCellStyle}">7 වන දිනය</th>
            <th style="${headerCellStyle}">8 වන දිනය</th>
            <th style="${headerCellStyle}">මේ මස ගෙවූ මුදල</th>
            <th style="${headerCellStyle}">මේ මස ගෙවූ දිනය</th>
            <th style="${headerCellStyle}">ගිය මස ගෙවීමට<br/>තිබේද?</th>
            <th style="${headerCellStyle}">ගිය මස<br/>ගෙවූ මුදල</th>
            <th style="${headerCellStyle}">ගිය මස මුදල්<br/>ගෙවූ දිනය</th>
            <th style="${headerCellStyle}">ගුරුවරයාට<br/>ගෙවූ දිනය</th>
          </tr>
        </thead>
        <tbody>
    `;

    const buildTableClose = () => `
        </tbody>
      </table>
    `;

    const buildSpecialRows = () => `
      <tr>
        <td style="${bodyCellStyle}"></td>
        <td style="${bodyCellStyle}"></td>
        <td style="${bodyCellStyle}; font-weight:600;">පංතිය පැවැත් වූ දිනය (මාසය / දිනය)</td>
        <td style="${bodyCellStyle}"></td>
        <td style="${bodyCellStyle}; text-align:center;"></td>
        ${tailCells}
      </tr>

      <tr>
        <td style="${bodyCellStyle}"></td>
        <td style="${bodyCellStyle}"></td>
        <td style="${bodyCellStyle}; font-weight:600;">පංතිය පටන් ගත් වේලාව</td>
        <td style="${bodyCellStyle}"></td>
        <td style="${bodyCellStyle}; text-align:center;"></td>
        ${tailCells}
      </tr>

      <tr>
        <td style="${bodyCellStyle}"></td>
        <td style="${bodyCellStyle}"></td>
        <td style="${bodyCellStyle}; font-weight:600;">පංතිය අවසන් කරන වේලාව</td>
        <td style="${bodyCellStyle}"></td>
        <td style="${bodyCellStyle}; text-align:center;"></td>
        ${tailCells}
      </tr>

      <tr>
        <td style="${bodyCellStyle}"></td>
        <td style="${bodyCellStyle}"></td>
        <td style="${bodyCellStyle}; font-weight:600;">
          ගුරුවරයා විසින් ගණන් කරන ලද අද පැමිණි ලමුන් ගණන
        </td>
        <td style="${bodyCellStyle}"></td>
        <td style="${bodyCellStyle}; text-align:center;"></td>
        ${tailCells}
      </tr>

      <tr>
        <td style="${bodyCellStyle}"></td>
        <td style="${bodyCellStyle}"></td>
        <td style="${bodyCellStyle}; font-weight:600;">ගුරුවරයාගේ අත්සන</td>
        <td style="${bodyCellStyle}"></td>
        <td style="${bodyCellStyle}; text-align:center;"></td>
        ${tailCells}
      </tr>
    `;

    const buildStudentRow = (item, indexNumber) => `
      <tr>
        <td style="${centeredBodyCellStyle}">${indexNumber}</td>
        <td style="${centeredBodyCellStyle}">${item.student?.id ?? "-"}</td>
        <td style="${bodyCellStyle}; font-weight:600;">
          ${item.student?.fullName ?? "-"}
        </td>
        <td style="${bodyCellStyle}; font-weight:600;">
          ${item.student?.studentMobile ?? item.student?.mobile ?? "-"}
        </td>
        ${tailCells}
      </tr>
    `;

    const buildEmptyRows = (count) => {
      let rows = "";
      for (let i = 0; i < count; i++) {
        rows += `
          <tr>
            <td style="${centeredBodyCellStyle}"></td>
            <td style="${centeredBodyCellStyle}"></td>
            <td style="${bodyCellStyle}"></td>
            <td style="${bodyCellStyle}"></td>
            ${tailCells}
          </tr>
        `;
      }
      return rows;
    };

    const buildPageHtml = ({
      studentRowsHtml,
      includeSpecialRows,
      fillEmptyRows = 0,
    }) => `
      <div style="
        width:${printWidth}px;
        background:#fff;
        font-family:'Noto Sans Sinhala', Arial, sans-serif;
      ">
        ${buildTopHeader()}
        <div style="padding:0 20px 28px 20px;">
          ${buildTableOpen()}
          ${includeSpecialRows ? buildSpecialRows() : ""}
          ${studentRowsHtml}
          ${fillEmptyRows > 0 ? buildEmptyRows(fillEmptyRows) : ""}
          ${buildTableClose()}
        </div>
      </div>
    `;

    const measureWrapperHeight = (html) => {
      const measureDiv = document.createElement("div");
      measureDiv.style.position = "absolute";
      measureDiv.style.left = "-99999px";
      measureDiv.style.top = "0";
      measureDiv.style.width = `${printWidth}px`;
      measureDiv.style.background = "#fff";
      measureDiv.innerHTML = html;
      document.body.appendChild(measureDiv);
      const height = measureDiv.offsetHeight;
      document.body.removeChild(measureDiv);
      return height;
    };

    const pages = [];
    let currentIndex = 0;
    let isFirstPage = true;

    while (currentIndex < list.length || (list.length === 0 && isFirstPage)) {
      let pageStudentRowsHtml = "";
      let lastGoodRowsHtml = "";
      let lastGoodCount = 0;
      let addedCount = 0;

      while (currentIndex + addedCount < list.length) {
        const nextRowHtml = buildStudentRow(
          list[currentIndex + addedCount],
          currentIndex + addedCount + 1
        );
        const candidateRowsHtml = pageStudentRowsHtml + nextRowHtml;

        const candidatePageHtml = buildPageHtml({
          studentRowsHtml: candidateRowsHtml,
          includeSpecialRows: isFirstPage,
          fillEmptyRows: 0,
        });

        const candidateHeight = measureWrapperHeight(candidatePageHtml);

        if (candidateHeight <= maxDomPageHeight) {
          pageStudentRowsHtml = candidateRowsHtml;
          lastGoodRowsHtml = candidateRowsHtml;
          lastGoodCount = addedCount + 1;
          addedCount += 1;
        } else {
          break;
        }
      }

      if (lastGoodCount === 0 && currentIndex < list.length) {
        lastGoodRowsHtml = buildStudentRow(list[currentIndex], currentIndex + 1);
        lastGoodCount = 1;
      }

      // Fill bottom of page with blank rows as much as possible
      let fillEmptyRows = 0;
      while (true) {
        const candidatePageHtml = buildPageHtml({
          studentRowsHtml: lastGoodRowsHtml,
          includeSpecialRows: isFirstPage,
          fillEmptyRows: fillEmptyRows + 1,
        });

        const candidateHeight = measureWrapperHeight(candidatePageHtml);
        if (candidateHeight <= maxDomPageHeight) {
          fillEmptyRows += 1;
        } else {
          break;
        }
      }

      // if list empty, still build one page with blanks
      if (list.length === 0 && isFirstPage) {
        let emptyOnlyRows = 0;
        while (true) {
          const candidatePageHtml = buildPageHtml({
            studentRowsHtml: "",
            includeSpecialRows: true,
            fillEmptyRows: emptyOnlyRows + 1,
          });

          const candidateHeight = measureWrapperHeight(candidatePageHtml);
          if (candidateHeight <= maxDomPageHeight) {
            emptyOnlyRows += 1;
          } else {
            break;
          }
        }

        pages.push({
          html: buildPageHtml({
            studentRowsHtml: "",
            includeSpecialRows: true,
            fillEmptyRows: emptyOnlyRows,
          }),
        });
        break;
      }

      pages.push({
        html: buildPageHtml({
          studentRowsHtml: lastGoodRowsHtml,
          includeSpecialRows: isFirstPage,
          fillEmptyRows,
        }),
      });

      currentIndex += lastGoodCount;
      isFirstPage = false;
    }

    for (let i = 0; i < pages.length; i++) {
      const pageWrapper = document.createElement("div");
      pageWrapper.style.position = "absolute";
      pageWrapper.style.left = "-99999px";
      pageWrapper.style.top = "0";
      pageWrapper.style.background = "#fff";
      pageWrapper.innerHTML = pages[i].html;
      document.body.appendChild(pageWrapper);

      const canvas = await html2canvas(pageWrapper, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      const renderHeight = (canvas.height * usableWidth) / canvas.width;

      if (i > 0) {
        pdf.addPage();
      }

      pdf.addImage(
        imgData,
        "PNG",
        marginLeft,
        marginTop,
        usableWidth,
        renderHeight
      );

      document.body.removeChild(pageWrapper);
    }

    const blob = pdf.output("blob");
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");

    setSuccessMsg("Student sheet generated successfully.");
  } catch (e) {
    console.error("PDF Error:", e);
    setErrorMsg(e.message || "Failed to generate PDF");
  } finally {
    setPrintingId(null);
  }
}

  return (
    <div className="grid gap-4">
      <Card title="Register Class">
        <form onSubmit={onCreateClass} className="form">
          {errorMsg ? <div className="error">{errorMsg}</div> : null}
          {successMsg ? <div className="success">{successMsg}</div> : null}

          <label className="label">Grade</label>
          <select
            className="input"
            value={gradeId}
            onChange={(e) => setGradeId(e.target.value)}
            disabled={loadingRefs}
          >
            {grades.map((g) => (
              <option key={g.id} value={String(g.id)}>
                {g.name}
              </option>
            ))}
          </select>
          {!grades.length ? (
            <div className="muted">Add grades first.</div>
          ) : null}

          <label className="label">Subject</label>
          <select
            className="input"
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            disabled={loadingRefs}
          >
            {subjects.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.name}
              </option>
            ))}
          </select>
          {!subjects.length ? (
            <div className="muted">Add subjects first.</div>
          ) : null}

          <label className="label">Teacher</label>
          <select
            className="input"
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            disabled={loadingRefs}
          >
            {teachers.map((t) => (
              <option key={t.id} value={String(t.id)}>
                {t.fullName ?? t.name ?? `Teacher #${t.id}`}
              </option>
            ))}
          </select>
          {!teachers.length ? (
            <div className="muted">Add teachers first.</div>
          ) : null}

          <label className="label">Class Name</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Grade 2 / English"
          />

          <label className="label">Fee</label>
          <Input
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            placeholder="1200"
            inputMode="numeric"
          />

          <label className="label">Institute Percentage (%)</label>
          <Input
            value={institutePercentage}
            onChange={(e) => setInstitutePercentage(e.target.value)}
            placeholder="25"
            inputMode="numeric"
          />
          <div className="muted">0 to 100 (Example: 25 means 25%)</div>

          <Button
            type="submit"
            disabled={!canSubmit || submitting || loadingRefs}
          >
            {submitting ? "Saving..." : "Register Class"}
          </Button>
        </form>
      </Card>

      <Card title="Classes List">
        <div className="grid gap-3">
          <div
            className="grid"
            style={{ gridTemplateColumns: "1fr auto auto", gap: 12 }}
          >
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by class / grade / subject / teacher..."
            />
            <Button type="button" onClick={loadRefs} disabled={loadingRefs}>
              {loadingRefs ? "Loading..." : "Reload Dropdowns"}
            </Button>
            <Button type="button" onClick={loadClasses} disabled={loadingList}>
              {loadingList ? "Loading..." : "Refresh"}
            </Button>
          </div>

          <div className="tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Grade</th>
                  <th>Subject</th>
                  <th>Teacher</th>
                  <th>Fee</th>
                  <th>Institute %</th>
                  <th>Status</th>
                  <th style={{ width: 360 }}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredClasses.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="muted">
                      {loadingList ? "Loading..." : "No classes found."}
                    </td>
                  </tr>
                ) : (
                  filteredClasses.map((c) => {
                    const isActive = !!(c.isActive ?? c.active ?? true);

                    const gradeName =
                      c.grade?.name ?? c.gradeName ?? c.grade?.title ?? "-";
                    const subjectName = c.subject?.name ?? c.subjectName ?? "-";
                    const teacherName =
                      c.teacher?.fullName ??
                      c.teacherName ??
                      c.teacher?.name ??
                      "-";

                    const instPerc =
                      c.institutePercentage ??
                      c.institute_percentage ??
                      c.institute_percent ??
                      25;

                    return (
                      <tr key={c.id}>
                        <td>{c.name}</td>
                        <td>{gradeName}</td>
                        <td>{subjectName}</td>
                        <td>{teacherName}</td>
                        <td>{c.fee ?? "-"}</td>
                        <td>{Number(instPerc)}%</td>
                        <td>
                          <span
                            className={
                              isActive ? "badge badgeOk" : "badge badgeOff"
                            }
                          >
                            {isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td>
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              flexWrap: "wrap",
                            }}
                          >
                            <Button
                              type="button"
                              onClick={() => printStudents(c)}
                            >
                              {printingId === c.id
                                ? "Generating..."
                                : "Print Students"}
                            </Button>
                            <Button
                              type="button"
                              onClick={() => toggleActive(c)}
                            >
                              {isActive ? "Deactivate" : "Activate"}
                            </Button>
                            <Button
                              type="button"
                              onClick={() => deleteClass(c)}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="muted">
            Print Students loads students from{" "}
            <code>/student-classes?classId=CLASS_ID</code>
            and generates a PDF with Student ID, Name, Mobile, and 4 attendance
            columns.
          </div>
        </div>
      </Card>
    </div>
  );
}
