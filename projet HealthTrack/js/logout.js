/* logout.js — gestion de la déconnexion */
document.addEventListener('DOMContentLoaded', function () {
  const btn = document.getElementById('logoutBtn');
  if (!btn) return;

  btn.addEventListener('click', function () {
    if (typeof DB !== 'undefined' && DB && typeof DB.logout === 'function') {
      DB.logout();
      return;
    }
    // Fallback if DB.logout is not available
    sessionStorage.removeItem('ht_session');
    window.location.href = 'login.html';
  });
});
