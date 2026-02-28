import { useEffect, useMemo, useState } from "react";
import Card from "../ui/Card.jsx";
import Input from "../ui/Input.jsx";
import Button from "../ui/Button.jsx";
import { api } from "../api/axios";
import { monthKey } from "../data/storage";

export default function Students() {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [payments, setPayments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [q, setQ] = useState("");
  const [month, setMonth] = useState(monthKey(new Date()));
  const [onlyNotPaid, setOnlyNotPaid] = useState(false);
  const [classId, setClassId] = useState("ALL");

  // Load students + classes
  useEffect(() => {
    async function loadInitial() {
      try {
        setLoading(true);
        setError("");

        const [stuRes, classRes] = await Promise.all([
          api.get("/students"),
          api.get("/classes"), // change if different route
        ]);

        setStudents(stuRes.data || []);
        setClasses(classRes.data || []);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    }

    loadInitial();
  }, []);

  // Load payments when month changes
  useEffect(() => {
    if (loading) return;

    async function loadPayments() {
      try {
        const res = await api.get(`/payments?month=${month}`);
        setPayments(res.data || []);
      } catch (err) {
        setPayments([]);
      }
    }

    loadPayments();
  }, [month, loading]);

  // Maps
  const classMap = useMemo(() => {
    const m = new Map();
    for (const c of classes) m.set(String(c.id), c);
    return m;
  }, [classes]);

  const payMap = useMemo(() => {
    const m = new Map();
    for (const p of payments) m.set(String(p.studentId), p);
    return m;
  }, [payments]);

  // Filtered rows
  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();

    return students
      .filter((s) => {
        const cid = String(s.courseId ?? s.classId ?? "");

        if (classId !== "ALL" && cid !== classId) return false;

        if (!query) return true;

        return (
          (s.name ?? "").toLowerCase().includes(query) ||
          (s.phone ?? "").toLowerCase().includes(query)
        );
      })
      .map((s) => {
        const cid = String(s.courseId ?? s.classId ?? "");
        const cls = classMap.get(cid);

        const p = payMap.get(String(s.id));
        const paid = p ? !!p.paid : false;

        return { student: s, cls, paid };
      })
      .filter((r) => (onlyNotPaid ? !r.paid : true));
  }, [students, q, classId, classMap, payMap, onlyNotPaid]);

  // Summary
  const summary = useMemo(() => {
    const total = rows.length;
    const paid = rows.filter((r) => r.paid).length;
    const notPaid = total - paid;
    const paidPct = total ? `${Math.round((paid / total) * 100)}%` : "0%";
    return { total, paid, notPaid, paidPct };
  }, [rows]);

  // Mark paid/unpaid
  async function markPaid(studentId, paid) {
    try {
      setSaving(true);

      await api.post("/payments", {
        studentId,
        month,
        paid,
      });

      // reload payments
      const res = await api.get(`/payments?month=${month}`);
      setPayments(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update payment");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid">
      <Card title="Search / Filters">
        <div className="row">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or phone..."
          />

          <Input
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            placeholder="YYYY-MM"
          />

          <select
            className="input"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
          >
            <option value="ALL">All Classes</option>
            {classes.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </select>

          <label className="check">
            <input
              type="checkbox"
              checked={onlyNotPaid}
              onChange={(e) => setOnlyNotPaid(e.target.checked)}
            />
            Only NOT PAID
          </label>
        </div>

        {loading && <div className="muted">Loading...</div>}
        {error && <div style={{ color: "crimson" }}>{error}</div>}
      </Card>

      <Card title={`Summary (${month})`}>
        <div className="statGrid">
          <div className="stat">
            <div className="statNum">{summary.total}</div>
            <div>Total Students</div>
          </div>
          <div className="stat">
            <div className="statNum">{summary.paid}</div>
            <div>Paid</div>
          </div>
          <div className="stat">
            <div className="statNum">{summary.notPaid}</div>
            <div>Not Paid</div>
          </div>
          <div className="stat">
            <div className="statNum">{summary.paidPct}</div>
            <div>Paid %</div>
          </div>
        </div>
      </Card>

      <Card title={`Students (${rows.length})`}>
        <table className="table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Phone</th>
              <th>Class</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {rows.map(({ student, cls, paid }) => (
              <tr key={student.id}>
                <td>{student.fullName}</td>
                <td>{student.studentMobile || "-"}</td>
                <td>{cls?.name || "-"}</td>
                <td>
                  <span className={paid ? "pill pillPaid" : "pill pillDue"}>
                    {paid ? "PAID" : "NOT PAID"}
                  </span>
                </td>
                <td className="actions">
                  <Button
                    onClick={() => markPaid(student.id, true)}
                    disabled={saving}
                  >
                    Mark Paid
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => markPaid(student.id, false)}
                    disabled={saving}
                  >
                    Mark Not Paid
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}