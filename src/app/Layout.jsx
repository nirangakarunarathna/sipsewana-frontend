import { Link, NavLink, Outlet } from "react-router-dom";

const navItem = ({ isActive }) =>
  `px-3 py-2 rounded ${isActive ? "bg-black text-white" : "hover:bg-gray-100"}`;

export default function Layout() {
  return (
    <div style={{ fontFamily: "system-ui" }}>
      <header className="topbar">
        <Link to="/" className="brand">Institute Manager</Link>
        <nav className="nav">
          <NavLink to="/" className={navItem}>Dashboard</NavLink>
          <NavLink to="/studentPayments" className={navItem}>Students Payments</NavLink>
          <NavLink to="/students/new" className={navItem}>Register Student</NavLink>
          <NavLink to="/classes" className={navItem}>Classes</NavLink>
          <NavLink to="/subjects" className={navItem}>Subjects</NavLink>
          <NavLink to="/grades" className={navItem}>Grades</NavLink>
          <NavLink to="/teachers" className={navItem}>Teachers</NavLink>
          <NavLink to="/reports" className={navItem}>Reports</NavLink>
        </nav>
      </header>

      <main className="container">
        <Outlet />
      </main>
    </div>
  );
}