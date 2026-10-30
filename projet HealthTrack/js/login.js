// login.js — logique de connexion (HealthTrack)

/* --- Variables globales --- */
let currentRole = 'patient';

/* =============================================
   INITIALISATION au chargement de la page
============================================= */
document.addEventListener('DOMContentLoaded', function () {

  // Si déjà connecté → rediriger
  const session = DB.getSession();
  if (session) {
    redirectByRole(session.role);
    return;
  }

  initRoleSelector();
  initRipple();
  initForm();
});

/* =============================================
   SÉLECTEUR DE RÔLE
============================================= */
function initRoleSelector() {
  document.getElementById('btnPatient').addEventListener('click', () => {
    currentRole = 'patient';
    document.getElementById('btnPatient').classList.add('active');
    document.getElementById('btnMedecin').classList.remove('active');
  });

  document.getElementById('btnMedecin').addEventListener('click', () => {
    currentRole = 'medecin';
    document.getElementById('btnMedecin').classList.add('active');
    document.getElementById('btnPatient').classList.remove('active');
  });
}

/* =============================================
   VALIDATION DU FORMULAIRE
============================================= */
function initForm() {
  document.getElementById('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();

    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const alertBox = document.getElementById('alertMsg');
    const btn      = document.getElementById('loginBtn');

    // Cacher alerte précédente
    alertBox.style.display = 'none';

    // ---- Validation côté client ----
    let isValid = true;

    // Vérifier email
    if (!email || !isValidEmail(email)) {
      showFieldError('f-email', 'email');
      isValid = false;
    } else {
      clearFieldError('f-email', 'email');
    }

    // Vérifier mot de passe
    if (!password) {
      showFieldError('f-password', 'password');
      isValid = false;
    } else {
      clearFieldError('f-password', 'password');
    }

    if (!isValid) return;

    // ---- Simulation du délai réseau ----
    btn.disabled    = true;
    btn.textContent = 'Vérification…';

    setTimeout(() => {

      // ---- Vérification dans la base de données ----
      const user = DB.login(email, password);

      if (!user) {
        // Identifiants incorrects
        showAlert(alertBox, '⚠️ Email ou mot de passe incorrect. Vérifiez vos informations.', 'error');
        btn.disabled    = false;
        btn.textContent = 'Se connecter →';
        return;
      }

      // Vérifier que le rôle correspond au bouton sélectionné
      if (user.role !== currentRole) {
        showAlert(alertBox,
          `⚠️ Ce compte est un compte "${user.role}". Veuillez sélectionner le bon rôle.`,
          'error'
        );
        btn.disabled    = false;
        btn.textContent = 'Se connecter →';
        return;
      }

      // ✅ Connexion réussie
      DB.saveSession(user);
      btn.textContent = '✓ Connecté ! Redirection…';

      setTimeout(() => {
        redirectByRole(user.role);
      }, 800);

    }, 900); // délai simulé
  });
}

/* =============================================
   REDIRECTION SELON LE RÔLE
============================================= */
function redirectByRole(role) {
  if (role === 'patient') {
    window.location.href = 'dashboard_patient.html';
  } else {
    window.location.href = 'dashboard_medecin.html';
  }
}

/* =============================================
   FONCTIONS UTILITAIRES
============================================= */

/** Vérifie le format d'un email */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Affiche l'erreur sur un champ */
function showFieldError(fieldId, inputId) {
  document.getElementById(fieldId).classList.add('has-error');
  document.getElementById(inputId).classList.add('invalid');
}

/** Efface l'erreur d'un champ */
function clearFieldError(fieldId, inputId) {
  document.getElementById(fieldId).classList.remove('has-error');
  document.getElementById(inputId).classList.remove('invalid');
}

/** Affiche une alerte globale */
function showAlert(el, message, type) {
  el.className     = 'alert ' + type;
  el.textContent   = message;
  el.style.display = 'block';
}

/* =============================================
   EFFET RIPPLE sur le bouton
============================================= */
function initRipple() {
  const btn = document.getElementById('loginBtn');
  btn.addEventListener('click', function (e) {
    const ripple = document.createElement('span');
    ripple.classList.add('ripple');
    const rect = this.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    ripple.style.width  = size + 'px';
    ripple.style.height = size + 'px';
    ripple.style.left   = (e.clientX - rect.left - size / 2) + 'px';
    ripple.style.top    = (e.clientY - rect.top  - size / 2) + 'px';
    this.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  });
}
