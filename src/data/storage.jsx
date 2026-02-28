const KEY = "institute_db_v1";

export function loadDB() {
  const raw = localStorage.getItem(KEY);
  if (!raw) return { students: [], courses: [], payments: [] };
  return JSON.parse(raw);
}

export function saveDB(db) {
  localStorage.setItem(KEY, JSON.stringify(db));
}

export function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

export function monthKey(date = new Date()) {
  // "2026-02"
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}