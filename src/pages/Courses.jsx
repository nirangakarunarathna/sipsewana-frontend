import { useMemo, useState } from "react";
import Card from "../ui/Card.jsx";
import Input from "../ui/Input.jsx";
import Button from "../ui/Button.jsx";
import { loadDB, saveDB, uid } from "../data/storage";

export default function Courses() {
  const [db, setDB] = useState(loadDB());
  const [name, setName] = useState("");
  const [fee, setFee] = useState("");

  const courses = useMemo(() => db.courses, [db]);

  function addCourse(e) {
    e.preventDefault();
    if (!name.trim()) return;
    const f = Number(fee);
    const next = structuredClone(db);
    next.courses.push({ id: uid("course"), name: name.trim(), fee: Number.isFinite(f) ? f : 0 });
    saveDB(next);
    setDB(next);
    setName("");
    setFee("");
  }

  return (
    <div className="grid">
      <Card title="Register Course">
        <form onSubmit={addCourse} className="form">
          <label className="label">Course name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Maths" />
          <label className="label">Monthly fee</label>
          <Input value={fee} onChange={(e) => setFee(e.target.value)} placeholder="2500" />
          <Button type="submit">Add Course</Button>
        </form>
      </Card>

      <Card title="Courses">
        <table className="table">
          <thead>
            <tr><th>Name</th><th>Fee</th></tr>
          </thead>
          <tbody>
            {courses.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.fee}</td>
              </tr>
            ))}
            {!courses.length ? (
              <tr><td colSpan="2" className="muted">No courses yet</td></tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}