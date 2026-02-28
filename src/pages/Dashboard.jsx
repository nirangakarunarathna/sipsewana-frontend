import { useEffect, useMemo, useState } from "react";
import Card from "../ui/Card.jsx";
import Input from "../ui/Input.jsx";
import Button from "../ui/Button.jsx";
import { loadDB, saveDB, monthKey, uid } from "../data/storage";
import { seedIfEmpty } from "../data/seed";

export default function Dashboard() {
  const [db, setDB] = useState(loadDB());
  const [month, setMonth] = useState(monthKey(new Date())); // "YYYY-MM"

  useEffect(() => {
    seedIfEmpty();
    setDB(loadDB());
  }, []);

  const stats = useMemo(() => {
    const students = db.students.length;
    const courses = db.courses.length;

    const paymentsThisMonth = db.payments.filter((p) => p.month === month);
    const paidCount = paymentsThisMonth.filter((p) => p.paid).length;
    const notPaidCount = paymentsThisMonth.filter((p) => !p.paid).length;

    return { students, courses, paidCount, notPaidCount };
  }, [db, month]);

  function ensureMonthPayments() {
    // create missing payment rows for the selected month (for all students)
    const next = structuredClone(db);
    for (const s of next.students) {
      const existing = next.payments.find((p) => p.studentId === s.id && p.month === month);
      if (!existing) {
        next.payments.push({ id: uid("pay"), studentId: s.id, month, paid: false, paidAt: null });
      }
    }
    saveDB(next);
    setDB(next);
  }

  return (
    <div className="grid">
      <Card title="Quick Stats">
        <div className="statGrid">
          <div className="stat"><div className="statNum">{stats.students}</div><div>Students</div></div>
          <div className="stat"><div className="statNum">{stats.courses}</div><div>Courses</div></div>
          <div className="stat"><div className="statNum">{stats.paidCount}</div><div>Paid ({month})</div></div>
          <div className="stat"><div className="statNum">{stats.notPaidCount}</div><div>Not Paid ({month})</div></div>
        </div>
      </Card>

      <Card title="Monthly Controls">
        <div className="row">
          <label className="label">Month (YYYY-MM)</label>
          <Input value={month} onChange={(e) => setMonth(e.target.value)} placeholder="2026-02" />
          <Button onClick={ensureMonthPayments}>Generate Month Payments</Button>
        </div>
        <p className="muted">
          If you change month, click “Generate Month Payments” to create missing payment rows for that month.
        </p>
      </Card>
    </div>
  );
}