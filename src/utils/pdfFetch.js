// utils/apiFetch.js
import toast from "react-hot-toast";

const API_BASE = import.meta.env.VITE_API_URL || "http://192.168.8.103:3000";

function redirectToLogin() {
  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
}

function normalizeMsg(data) {
  let msg =
    (data && typeof data === "object" && (data.message || data.error)) ||
    (typeof data === "string" ? data : "Request failed");
  if (Array.isArray(msg)) msg = msg.join(", ");
  return msg || "Request failed";
}

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("token");

  const {
    responseType = "json", // "json" | "text" | "blob"
    toastOnError = true,
    ...fetchOptions
  } = options;

  const res = await fetch(`${API_BASE}${path}`, {
    ...fetchOptions,
    headers: {
      ...(responseType === "blob" ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(fetchOptions.headers || {}),
    },
  });

  // ✅ 401 handling
  if (res.status === 401) {
    localStorage.removeItem("token");
    if (toastOnError) toast.error("Session expired. Please login again.");
    redirectToLogin();
    throw new Error("Unauthorized");
  }

  // ✅ Handle BLOB (PDF)
  if (responseType === "blob") {
    if (!res.ok) {
      // try read text for error message
      let t = "";
      try {
        t = await res.text();
      } catch {}
      const msg = t || `Request failed (${res.status})`;
      if (toastOnError) toast.error(msg);
      throw new Error(msg);
    }
    return await res.blob();
  }

  // ✅ TEXT
  if (responseType === "text") {
    const t = await res.text();
    if (!res.ok) {
      const msg = t || `Request failed (${res.status})`;
      if (toastOnError) toast.error(msg);
      throw new Error(msg);
    }
    return t;
  }

  // ✅ JSON (default)
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
    const msg = normalizeMsg(data);
    if (toastOnError) toast.error(msg);
    throw new Error(msg);
  }

  return data;
}