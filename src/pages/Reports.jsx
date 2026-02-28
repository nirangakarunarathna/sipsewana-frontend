import { useMemo, useState } from "react";
import Card from "../ui/Card.jsx";
import Input from "../ui/Input.jsx";
import { loadDB, monthKey } from "../data/storage";

function percent(paid, total) {
  if (!total) return "0%";
  return `${Math.round((paid / total) * 100)}%`;
}

export default function Reports() {
  const [db] = useState(loadDB());
  const [month, setMonth] = useState(monthKey(new Date())); // can type past months

  const table = useMemo(() => {
    const classes = db.courses; // courses = classes
    const students = db.students;

    // payment map for this month: studentId -> paid boolean
    const payMap = new Map();
    for (const p of db.payments) {
      if (p.month === month) payMap.set(p.studentId, !!p.paid);
    }

    // build class rows (ALL classes even if 0 students)
    const rows = classes.map((cls) => {
      const clsStudents = students.filter((s) => s.courseId === cls.id);

      let paid = 0;
      let notPaid = 0;

      for (const s of clsStudents) {
        const isPaid = payMap.get(s.id) ?? false; // missing record = NOT PAID
        if (isPaid) paid++;
        else notPaid++;
      }

      return {
        classId: cls.id,
        className: cls.name,
        total: clsStudents.length,
        paid,
        notPaid,
        paidPct: percent(paid, clsStudents.length),
      };
    });

    // totals
    const totals = rows.reduce(
      (acc, r) => {
        acc.total += r.total;
        acc.paid += r.paid;
        acc.notPaid += r.notPaid;
        return acc;
      },
      { total: 0, paid: 0, notPaid: 0 }
    );

    return {
      rows: rows.sort((a, b) => b.total - a.total),
      totals: {
        ...totals,
        paidPct: percent(totals.paid, totals.total),
      },
    };
  }, [db, month]);

  return (
    <div className="grid">
      <Card title="Monthly Report (Class-wise)">
        <div className="row">
          <label className="label">Month (YYYY-MM)</label>
          <Input
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            placeholder="2026-02"
          />
          <div className="muted">Type past months too (ex: 2025-12).</div>
        </div>
      </Card>

      <Card title={`Report Table (${month})`}>
        <table className="table">
          <thead>
            <tr>
              <th>Class</th>
              <th>Total Students</th>
              <th>Paid</th>
              <th>Not Paid</th>
              <th>Paid %</th>
            </tr>
          </thead>

          <tbody>
            {table.rows.map((r) => (
              <tr key={r.classId}>
                <td>{r.className}</td>
                <td>{r.total}</td>
                <td>{r.paid}</td>
                <td>{r.notPaid}</td>
                <td>{r.paidPct}</td>
              </tr>
            ))}

            {/* Bottom totals row */}
            <tr style={{ fontWeight: 800 }}>
              <td>TOTAL (All Classes)</td>
              <td>{table.totals.total}</td>
              <td>{table.totals.paid}</td>
              <td>{table.totals.notPaid}</td>
              <td>{table.totals.paidPct}</td>
            </tr>

            {!table.rows.length ? (
              <tr>
                <td colSpan="5" className="muted">
                  No classes found. Add classes first.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}