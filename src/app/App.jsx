import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import Layout from "./Layout.jsx";

import Dashboard from "../pages/Dashboard.jsx";
import StudentNew from "../pages/StudentNew.jsx";
import Classes from "../pages/Classes.jsx";
import Reports from "../pages/Reports.jsx";
import Subjects from "../pages/Subjects.jsx";
import Grades from "../pages/Grades.jsx";
import Teachers from "../pages/Teachers.jsx";
import StudentClasses from "../pages/StudentClasses.jsx";
import ClassSessions from "../pages/ClassSessions.jsx";
import AttendanceMark from "../pages/AttendanceMark.jsx";
import Login from "../pages/Login.jsx";

import ProtectedRoute from "../routes/ProtectedRoute.jsx";
import BillGenerate from "../pages/BillGenerate.jsx";

export default function App() {
  const token = localStorage.getItem("token");

  return (
    <>
      {/* ✅ Global toaster */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            borderRadius: "8px",
            fontSize: "20px",
            color: "#fff",
          },

          success: {
            style: {
              background: "#2cac5b", // green
            },
          },

          error: {
            style: {
              background: "#e89090", // red
            },
          },
        }}
      />

      <Routes>
        {/* Public route */}
        <Route path="/login" element={<Login />} />

        {/* Protected routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/studentClasses" element={<StudentClasses />} />
            <Route path="/students/new" element={<StudentNew />} />
            <Route path="/classes" element={<Classes />} />
            <Route path="/subjects" element={<Subjects />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/grades" element={<Grades />} />
            <Route path="/teachers" element={<Teachers />} />
            <Route path="/classSessions" element={<ClassSessions />} />
            <Route path="/attendance" element={<AttendanceMark />} />
            <Route path="/bill" element={<BillGenerate />} />
          </Route>
        </Route>

        {/* fallback */}
        <Route
          path="*"
          element={
            token ? (
              <Navigate to="/" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </>
  );
}
