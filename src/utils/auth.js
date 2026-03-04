export function getToken() {
  return localStorage.getItem("token");
}

export function isAuthenticated() {
  const token = localStorage.getItem("token");
  return !!token;
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}