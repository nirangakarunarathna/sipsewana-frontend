import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./Layout.jsx";
import Dashboard from "../pages/Dashboard.jsx";
import Students from "../pages/Students.jsx";
import StudentNew from "../pages/StudentNew.jsx";
import Courses from "../pages/Courses.jsx";
import Reports from "../pages/Reports.jsx";
import Subjects from "../pages/Subjects.jsx";
import Grades from "../pages/Grades.jsx";
import Teachers from "../pages/Teachers.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/students" element={<Students />} />
        <Route path="/students/new" element={<StudentNew />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/subjects" element={<Subjects />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/grades" element={<Grades />} />
        <Route path="/teachers" element={<Teachers />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
