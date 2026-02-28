import { loadDB, saveDB, uid, monthKey } from "./storage";

export function seedIfEmpty() {
  const db = loadDB();
  if (db.students.length || db.courses.length) return;

  const c1 = { id: uid("course"), name: "Maths", fee: 2500 };
  const c2 = { id: uid("course"), name: "Science", fee: 3000 };
  const c3 = { id: uid("course"), name: "English", fee: 2000 };

  const s1 = { id: uid("stu"), name: "Kavindu Perera", phone: "0771234567", courseId: c1.id };
  const s2 = { id: uid("stu"), name: "Nethmi Silva", phone: "0712223344", courseId: c2.id };
  const s3 = { id: uid("stu"), name: "Sahan Fernando", phone: "0759998877", courseId: c1.id };

  const mk = monthKey(new Date());
  db.courses.push(c1, c2, c3);
  db.students.push(s1, s2, s3);
  db.payments.push(
    { id: uid("pay"), studentId: s1.id, month: mk, paid: true, paidAt: new Date().toISOString() },
    { id: uid("pay"), studentId: s2.id, month: mk, paid: false, paidAt: null },
    { id: uid("pay"), studentId: s3.id, month: mk, paid: false, paidAt: null },
  );

  saveDB(db);
}