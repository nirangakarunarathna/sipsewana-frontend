// utils/apiFetch.js
import toast from "react-hot-toast";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

function redirectToLogin() {
  // prevent infinite redirect loop
  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
}

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("token"); // change if you use different key

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  // ✅ 401 handling
  if (res.status === 401) {
    localStorage.removeItem("token");
    toast.error("Session expired. Please login again.");
    redirectToLogin();
    throw new Error("Unauthorized");
  }

  const text = await res.text();
  const data = text
    ? (() => {
        try {
          return JSON.parse(text);
        } catch {
          return text;
        }
      })()
    : null;

  if (!res.ok) {
    let msg =
      (data && typeof data === "object" && (data.message || data.error)) ||
      (typeof data === "string" ? data : "Request failed");
    if (Array.isArray(msg)) msg = msg.join(", ");

    toast.error(msg);
    throw new Error(msg);
  }

  return data;
}