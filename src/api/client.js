const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://192.168.8.106:3000";

export async function getStudents() {
  const res = await fetch(`${API_BASE}/students`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to load students");
  }
  return res.json();
}