// /client/js/authMiddleware.js
window.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("userAuthId");
  const path = window.location.pathname;
  if (token && path === "/") {
    window.location.href = `/api/dashboard`;
  }
  if (!token && path == "/") {
    window.location.href = "/api/auth/login";
  }
});
