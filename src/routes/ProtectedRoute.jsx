import { Navigate, Outlet } from "react-router-dom";

function getToken() {
  return localStorage.getItem("token");
}

export default function ProtectedRoute() {
  const token = getToken();
  if (!token) return <Navigate to="/login" replace />;
  return <Outlet />;
}