// utils/apiFetch.js
import toast from "react-hot-toast";

const API_BASE = import.meta.env.VITE_API_URL ;

function redirectToLogin() {
  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
}

/**
 * options.responseType:
 * - "json" (default)
 * - "text"
 * - "blob"  ✅ for PDFs
 */
export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("token");

  const responseType = options.responseType || "json";
  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  // If body is JSON, ensure Content-Type
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  // ✅ 401 handling
  if (res.status === 401) {
    localStorage.removeItem("token");
    toast.error("Session expired. Please login again.");
    redirectToLogin();
    throw new Error("Unauthorized");
  }

  // ✅ blob handling (PDF)
  if (responseType === "blob") {
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      toast.error(t || "Request failed");
      throw new Error(t || "Request failed");
    }
    return await res.blob();
  }

  // text handling
  if (responseType === "text") {
    const t = await res.text();
    if (!res.ok) {
      toast.error(t || "Request failed");
      throw new Error(t || "Request failed");
    }
    return t;
  }

  // default json
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