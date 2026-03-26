import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../utils/apiFetch";
import Card from "../ui/Card.jsx";
import Input from "../ui/Input.jsx";
import Button from "../ui/Button.jsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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

  function formatDate(value) {
    if (!value) return "-";
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return String(value);
    return dt.toLocaleDateString();
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
    const monthLabel = "_ _ _ _ _ _ _ _ _ _ _ _";

    const sideMargin = 12;
    const firstPageTop = 34;
    const pageBottomMargin = 8;

    const firstWriteRow = [
      "", "", "", "", "", "", "", "", "", "", "", "", "", "", "",
    ];

    const studentRows = list.length
      ? list.map((item, index) => [
          index + 1,
          item.student?.id ?? "-",
          item.student?.fullName ?? "-",
          item.student?.studentMobile ??
            item.student?.mobile ??
            item.student?.studentWhatsApp ??
            item.student?.parentMobile ??
            "-",
          "", "", "", "", "", "", "",
          "", "", "", "",
        ])
      : [[
          "", "", "No students found", "", "", "", "", "", "", "", "", "", "", "", "",
        ]];

    function buildDoc(bodyRows) {
      const doc = new jsPDF("l", "pt", "a4");
      const pageWidth = doc.internal.pageSize.getWidth();

      let y = firstPageTop;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.text(`${row.name ?? "-"}`, pageWidth / 2, y + 18, {
        align: "center",
      });

      y += 44;

      const boxX = sideMargin;
      const boxY = y - 18;
      const boxW = pageWidth - sideMargin * 2;
      const boxH = 34;

      doc.setDrawColor(130, 130, 130);
      doc.setLineWidth(0.8);
      doc.roundedRect(boxX, boxY, boxW, boxH, 6, 6);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);

      const textY = boxY + 22;
      const c1 = boxX + 10;
      const c2 = boxX + boxW * 0.18;
      const c3 = boxX + boxW * 0.34;
      const c4 = boxX + boxW * 0.66;
      const c5 = boxX + boxW * 0.80;

      doc.text(`Grade: ${gradeName}`, c1, textY);
      doc.text(`Subject: ${subjectName}`, c2, textY);
      doc.text(`Teacher: ${teacherName}`, c3, textY);
      doc.text(`Fee: ${classFee}`, c4, textY);
      doc.text(`Month: ${monthLabel}`, c5, textY);

      const startY = boxY + boxH + 12;

      autoTable(doc, {
        startY,
        margin: {
          left: sideMargin,
          right: sideMargin,
          bottom: 0,
        },
        theme: "grid",
        pageBreak: "auto",
        rowPageBreak: "avoid",
        styles: {
          fontSize: 8.5,
          cellPadding: 4,
          valign: "middle",
          halign: "center",
          lineColor: [120, 120, 120],
          lineWidth: 0.6,
          fontStyle: "bold",
          textColor: [0, 0, 0],
        },
        headStyles: {
          fillColor: [230, 230, 230],
          textColor: [0, 0, 0],
          fontStyle: "bold",
          fontSize: 9,
          minCellHeight: 40,
          lineColor: [100, 100, 100],
          lineWidth: 0.7,
        },
        bodyStyles: {
          minCellHeight: 26,
          fontStyle: "bold",
          textColor: [0, 0, 0],
        },
        head: [[
          "No",
          "Student ID",
          "Student Name",
          "Mobile",
          "1\nDate / Time",
          "2\nDate / Time",
          "3\nDate / Time",
          "4\nDate / Time",
          "5\nDate / Time",
          "6\nDate / Time",
          "7\nDate / Time",
          "Paid\nAmount",
          "Paid\nDate",
          "Prev.\nMonth",
          "Clear\nDate",
        ]],
        body: bodyRows,
        columnStyles: {
          0: { cellWidth: 20 },
          1: { cellWidth: 42 },
          2: { cellWidth: 132, halign: "left" },
          3: { cellWidth: 60 },
          4: { cellWidth: 52 },
          5: { cellWidth: 52 },
          6: { cellWidth: 52 },
          7: { cellWidth: 52 },
          8: { cellWidth: 52 },
          9: { cellWidth: 52 },
          10: { cellWidth: 52 },
          11: { cellWidth: 44 },
          12: { cellWidth: 44 },
          13: { cellWidth: 40 },
          14: { cellWidth: 46 },
        },
        didParseCell(data) {
          if (data.section === "body" && data.row.index === 0) {
            data.cell.styles.minCellHeight = 38;
          }

          if (data.section === "body" && data.column.index === 2) {
            data.cell.styles.fontSize = 9;
            data.cell.styles.halign = "left";
          }

          if (data.section === "body" && data.column.index !== 2) {
            data.cell.styles.fontSize = 8.5;
          }
        },
      });

      return doc;
    }

    const baseBody = [firstWriteRow, ...studentRows];

    // Pass 1: render without padding
    const tempDoc = buildDoc(baseBody);
    const pageHeight = tempDoc.internal.pageSize.getHeight();
    const finalY = tempDoc.lastAutoTable?.finalY ?? 0;

    // How many normal blank rows fit on the actual last page
    const normalRowHeight = 26;
    const remainingSpace = Math.max(0, pageHeight - finalY - pageBottomMargin);
    const blankRowsNeeded = Math.floor(remainingSpace / normalRowHeight);

    const blankRow = ["", "", "", "", "", "", "", "", "", "", "", "", "", "", ""];
    const finalBody = [
      ...baseBody,
      ...Array.from({ length: blankRowsNeeded }, () => [...blankRow]),
    ];

    // Pass 2: final render
    const finalDoc = buildDoc(finalBody);

    const blob = finalDoc.output("blob");
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");

    setSuccessMsg(`Student sheet generated.`);
  } catch (e) {
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
