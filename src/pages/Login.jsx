import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

export default function Login() {
  const nav = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const canSubmit = useMemo(() => {
    return username.trim().length > 0 && password.length > 0 && !loading;
  }, [username, password, loading]);

  async function handleLogin(e) {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.message || "Login failed");
      }

      const token = data?.token || data?.accessToken || "";
      if (!token) throw new Error("Token not received from server.");

      localStorage.setItem("token", token);

      // ✅ your protected route uses "/"
      nav("/", { replace: true });
    } catch (err) {
      setErrorMsg(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.bgBlur1} />
      <div style={styles.bgBlur2} />

      <div style={styles.shell}>
        {/* Left brand panel */}
        <div style={styles.brand}>
          <div style={styles.logo}>IM</div>
          <div>
            <div style={styles.brandTitle}>Sipsewana Institute</div>
            <div style={styles.brandSub}>
              Sign in to manage students, classes, attendance & reports.
            </div>
          </div>

          <div style={styles.brandFooter}>
            <div style={styles.pill}>Secure</div>
            <div style={styles.pill}>Fast</div>
            <div style={styles.pill}>Simple</div>
          </div>
        </div>

        {/* Right login card */}
        <div style={styles.card}>
          <div style={{ marginBottom: 14 }}>
            <div style={styles.cardTitle}>Welcome back</div>
            <div style={styles.cardSub}>Enter your credentials to continue</div>
          </div>

          {errorMsg ? (
            <div style={styles.errorBox}>
              <div style={{ fontWeight: 800 }}>Login failed</div>
              <div style={{ opacity: 0.9 }}>{errorMsg}</div>
            </div>
          ) : null}

          <form onSubmit={handleLogin} style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <label style={styles.label}>Username</label>
              <div style={styles.inputWrap}>
                <span style={styles.icon}>👤</span>
                <input
                  style={styles.input}
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                />
              </div>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <label style={styles.label}>Password</label>
              <div style={styles.inputWrap}>
                <span style={styles.icon}>🔒</span>
                <input
                  style={styles.input}
                  type={showPass ? "text" : "password"}
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  style={styles.showBtn}
                  aria-label={showPass ? "Hide password" : "Show password"}
                  title={showPass ? "Hide password" : "Show password"}
                >
                  {showPass ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              style={{
                ...styles.primaryBtn,
                opacity: canSubmit ? 1 : 0.6,
                cursor: canSubmit ? "pointer" : "not-allowed",
              }}
            >
              {loading ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                  <span style={styles.spinner} />
                  Logging in...
                </span>
              ) : (
                "Login"
              )}
            </button>

            <div style={styles.smallNote}>
              Tip: If you face issues, check username/password or contact admin.
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

/** Inline styles so you don’t need extra CSS files */
const styles = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 16,
    position: "relative",
    overflow: "hidden",
    background:
      "radial-gradient(1200px 600px at 10% 10%, rgba(0,0,0,0.06), transparent 60%), radial-gradient(1000px 500px at 90% 20%, rgba(0,0,0,0.05), transparent 55%), rgba(0,0,0,0.02)",
  },
  bgBlur1: {
    position: "absolute",
    width: 520,
    height: 520,
    borderRadius: 999,
    left: -160,
    top: -180,
    filter: "blur(30px)",
    background: "rgba(0,0,0,0.06)",
  },
  bgBlur2: {
    position: "absolute",
    width: 560,
    height: 560,
    borderRadius: 999,
    right: -220,
    bottom: -220,
    filter: "blur(35px)",
    background: "rgba(0,0,0,0.05)",
  },
  shell: {
    width: "100%",
    maxWidth: 980,
    display: "grid",
    gridTemplateColumns: "1.1fr 0.9fr",
    gap: 14,
    alignItems: "stretch",
  },
  brand: {
    borderRadius: 22,
    padding: 22,
    background: "rgba(255,255,255,0.7)",
    border: "1px solid rgba(0,0,0,0.08)",
    boxShadow: "0 12px 30px rgba(0,0,0,0.06)",
    backdropFilter: "blur(10px)",
    display: "grid",
    gridTemplateRows: "auto auto 1fr auto",
    gap: 14,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 16,
    display: "grid",
    placeItems: "center",
    fontWeight: 900,
    background: "rgba(0,0,0,0.9)",
    color: "white",
    letterSpacing: 1,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: 900,
    lineHeight: 1.15,
  },
  brandSub: {
    marginTop: 6,
    opacity: 0.75,
    maxWidth: 420,
  },
  brandFooter: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },
  pill: {
    fontSize: 12,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "rgba(255,255,255,0.6)",
  },
  card: {
    borderRadius: 22,
    padding: 22,
    background: "white",
    border: "1px solid rgba(0,0,0,0.08)",
    boxShadow: "0 16px 40px rgba(0,0,0,0.08)",
    display: "grid",
    alignContent: "start",
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: 900,
  },
  cardSub: {
    marginTop: 6,
    opacity: 0.7,
    fontSize: 13,
  },
  errorBox: {
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    border: "1px solid rgba(255,0,0,0.18)",
    background: "rgba(255,0,0,0.06)",
    color: "rgba(0,0,0,0.85)",
    display: "grid",
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: 800,
    opacity: 0.75,
  },
  inputWrap: {
    display: "grid",
    gridTemplateColumns: "34px 1fr auto",
    alignItems: "center",
    gap: 8,
    padding: "10px 10px",
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "rgba(0,0,0,0.02)",
  },
  icon: { opacity: 0.8, textAlign: "center" },
  input: {
    border: "none",
    outline: "none",
    background: "transparent",
    fontSize: 14,
    padding: "2px 0",
  },
  showBtn: {
    border: "1px solid rgba(0,0,0,0.12)",
    background: "white",
    borderRadius: 12,
    padding: "8px 10px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  primaryBtn: {
    marginTop: 6,
    border: "none",
    borderRadius: 14,
    padding: "12px 14px",
    fontSize: 14,
    fontWeight: 900,
    background: "rgba(0,0,0,0.92)",
    color: "white",
    boxShadow: "0 10px 20px rgba(0,0,0,0.12)",
  },
  smallNote: {
    marginTop: 8,
    textAlign: "center",
    fontSize: 12,
    opacity: 0.65,
  },
  spinner: {
    width: 14,
    height: 14,
    borderRadius: 999,
    border: "2px solid rgba(255,255,255,0.35)",
    borderTopColor: "white",
    display: "inline-block",
    animation: "spin 0.9s linear infinite",
  },
};

/**
 * Add this CSS once in your global CSS (e.g., index.css) for the spinner animation:
 *
 * @keyframes spin { to { transform: rotate(360deg); } }
 *
 * If you don’t want to touch CSS, tell me and I’ll replace spinner with simple text.
 */