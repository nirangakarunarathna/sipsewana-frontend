import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./Layout.jsx";
import Dashboard from "../pages/Dashboard.jsx";
import Students from "../pages/Students.jsx";
import StudentNew from "../pages/StudentNew.jsx";
import Courses from "../pages/Courses.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/students" element={<Students />} />
        <Route path="/students/new" element={<StudentNew />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}