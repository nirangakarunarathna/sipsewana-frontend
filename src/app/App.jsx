import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./Layout.jsx";
import Dashboard from "../pages/Dashboard.jsx";
import StudentPayments from "../pages/StudentPayments.jsx";
import StudentNew from "../pages/StudentNew.jsx";
import Classes from "../pages/Classes.jsx";
import Reports from "../pages/Reports.jsx";
import Subjects from "../pages/Subjects.jsx";
import Grades from "../pages/Grades.jsx";
import Teachers from "../pages/Teachers.jsx";
import StudentClasses from "../pages/StudentClasses.jsx";
import ClassSessions from "../pages/ClassSessions.jsx";
import AttendanceMark from "../pages/AttendanceMark.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/studentPayments" element={<StudentPayments />} />
        <Route path="/studentClasses" element={<StudentClasses />} />
        <Route path="/students/new" element={<StudentNew />} />
        <Route path="/classes" element={<Classes />} />
        <Route path="/subjects" element={<Subjects />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/grades" element={<Grades />} />
        <Route path="/teachers" element={<Teachers />} />
        <Route path="/ClassSessions" element={<ClassSessions />} />
        <Route path="/Attendance" element={<AttendanceMark />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
