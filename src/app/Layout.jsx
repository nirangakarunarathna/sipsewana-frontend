import { Link, NavLink, Outlet, useLocation } from "react-router-dom";

const MAIN = [
  { key: "dash", label: "Dashboard", to: "/" },
  { key: "students", label: "Students", to: "/students/new" },
  { key: "classes", label: "Classes", to: "/classes" },
  { key: "attendance", label: "Attendance", to: "/Attendance" },
  { key: "reports", label: "Reports", to: "/reports" },
];

const SUB = {
  dash: [],
  students: [
    { label: "Register", to: "/students/new" },
    { label: "Classes", to: "/studentClasses" },
    { label: "Payments", to: "/studentPayments" },
  ],
  classes: [
    { label: "Classes", to: "/classes" },
    { label: "Subjects", to: "/subjects" },
    { label: "Grades", to: "/grades" },
    { label: "Teachers", to: "/teachers" },
    { label: "Sessions", to: "/classSessions" },
  ],
  attendance: [{ label: "Mark", to: "/Attendance" }],
  reports: [{ label: "Summary", to: "/reports" }],
};

function mainKeyFromPath(pathname) {
  if (pathname === "/") return "dash";
  if (pathname.startsWith("/students") || pathname.startsWith("/studentClasses") || pathname.startsWith("/studentPayments")) return "students";
  if (pathname.startsWith("/classes") || pathname.startsWith("/subjects") || pathname.startsWith("/grades") || pathname.startsWith("/teachers") || pathname.startsWith("/classSessions")) return "classes";
  if (pathname.toLowerCase().startsWith("/attendance")) return "attendance";
  if (pathname.startsWith("/reports")) return "reports";
  return "dash";
}

export default function Layout() {
  const { pathname } = useLocation();
  const mainKey = mainKeyFromPath(pathname);
  const subTabs = SUB[mainKey] || [];

  return (
    <div className="appShell">
      <header className="appTop">
        <div className="appTopInner">
          <Link to="/" className="brandPremium">
            <span className="brandLogo">IM</span>
            <div className="brandMeta">
              <div className="brandTitle">Sipsewana Institute</div>
              <div className="brandTag">admin • classes • payments • attendance</div>
            </div>
          </Link>

          <div className="navPremium">
            <nav className="tabsMain" aria-label="Main navigation">
              {MAIN.map((t) => (
                <NavLink
                  key={t.key}
                  to={t.to}
                  end={t.to === "/"}
                  className={({ isActive }) =>
                    `tabMain ${isActive || mainKey === t.key ? "tabMainActive" : ""}`
                  }
                >
                  {t.label}
                </NavLink>
              ))}
            </nav>

            {subTabs.length ? (
              <nav className="tabsSub" aria-label="Section navigation">
                {subTabs.map((s) => (
                  <NavLink
                    key={s.to}
                    to={s.to}
                    className={({ isActive }) => `tabSub ${isActive ? "tabSubActive" : ""}`}
                  >
                    {s.label}
                  </NavLink>
                ))}
              </nav>
            ) : null}
          </div>

          <div className="topActions">
            <div className="statusPill">
              <span className="dot" />
              Online
            </div>
          </div>
        </div>
      </header>

      <main className="container">
        <Outlet />
      </main>
    </div>
  );
}