// register.js — logique d'inscription (HealthTrack)

let currentRole = 'patient';

/* =============================================
   INITIALISATION
============================================= */
document.addEventListener('DOMContentLoaded', function () {
  initRoleSelector();
  initPasswordStrength();
  initRipple();
  initForm();
});

/* =============================================
   SÉLECTEUR DE RÔLE
   Affiche/cache les champs selon le rôle
============================================= */
function initRoleSelector() {
  document.getElementById('btnPatient').addEventListener('click', () => switchRole('patient'));
  document.getElementById('btnMedecin').addEventListener('click', () => switchRole('medecin'));
}

function switchRole(role) {
  currentRole = role;

  // Mise à jour visuelle des boutons
  document.getElementById('btnPatient').classList.toggle('active', role === 'patient');
  document.getElementById('btnMedecin').classList.toggle('active', role === 'medecin');

  // Afficher/cacher les champs spécifiques
  const patientFields = document.querySelectorAll('.patient-only');
  const medecinFields = document.querySelectorAll('.medecin-only');

  patientFields.forEach(el => el.style.display = role === 'patient' ? 'block' : 'none');
  medecinFields.forEach(el => el.style.display = role === 'medecin' ? 'block' : 'none');
}

/* =============================================
   BARRE DE FORCE DU MOT DE PASSE
   Calcule et affiche la force en temps réel
============================================= */
function initPasswordStrength() {
  document.getElementById('password').addEventListener('input', function () {
    const pwd   = this.value;
    const score = getPasswordScore(pwd);
    updateStrengthBar(score);
  });
}

/** Calcule un score de 0 à 4 */
function getPasswordScore(pwd) {
  let score = 0;
  if (pwd.length >= 6)              score++;   // longueur minimale
  if (pwd.length >= 10)             score++;   // bonne longueur
  if (/[A-Z]/.test(pwd))           score++;   // majuscule
  if (/[0-9]/.test(pwd))           score++;   // chiffre
  return score;
}

/** Met à jour visuellement la barre */
function updateStrengthBar(score) {
  const colors = ['', '#e74c3c', '#e67e22', '#f0c44f', '#2aad85'];
  const labels = ['', 'Faible', 'Moyen', 'Bon', 'Fort 💪'];

  for (let i = 1; i <= 4; i++) {
    const bar = document.getElementById('s' + i);
    bar.style.background = i <= score ? colors[score] : 'rgba(255,255,255,0.15)';
  }

  document.getElementById('strengthLabel').textContent =
    score > 0 ? labels[score] : 'Force du mot de passe';
}

/* =============================================
   VALIDATION DU FORMULAIRE
============================================= */
function initForm() {
  document.getElementById('registerForm').addEventListener('submit', function (e) {
    e.preventDefault();

    // Récupérer les valeurs
    const prenom    = document.getElementById('prenom').value.trim();
    const nom       = document.getElementById('nom').value.trim();
    const email     = document.getElementById('email').value.trim();
    const telephone = document.getElementById('telephone').value.trim();
    const password  = document.getElementById('password').value;
    const confirm   = document.getElementById('confirmPassword').value;
    const cgu       = document.getElementById('cgu').checked;

    // Champs spécifiques
    const dateNaissance = currentRole === 'patient'
      ? document.getElementById('dateNaissance').value
      : null;
    const specialite = currentRole === 'medecin'
      ? document.getElementById('specialite').value
      : null;

    const alertError   = document.getElementById('alertError');
    const alertSuccess = document.getElementById('alertSuccess');
    const btn          = document.getElementById('registerBtn');

    // Cacher les alertes
    alertError.style.display   = 'none';
    alertSuccess.style.display = 'none';

    // ---- VALIDATION DE CHAQUE CHAMP ----
    let isValid = true;

    isValid = validate('f-prenom',  'prenom',  !!prenom)          && isValid;
    isValid = validate('f-nom',     'nom',     !!nom)             && isValid;
    isValid = validate('f-email',   'email',   isValidEmail(email)) && isValid;

    isValid = validate('f-password', 'password', password.length >= 6) && isValid;
    isValid = validate('f-confirmPassword', 'confirmPassword', password === confirm) && isValid;

    if (currentRole === 'patient') {
      isValid = validate('f-dateNaissance', 'dateNaissance', !!dateNaissance) && isValid;
    }
    if (currentRole === 'medecin') {
      isValid = validate('f-specialite', 'specialite', !!specialite) && isValid;
    }

    // CGU
    const cguHint = document.getElementById('cgu-hint');
    if (!cgu) {
      cguHint.style.display = 'block';
      isValid = false;
    } else {
      cguHint.style.display = 'none';
    }

    if (!isValid) {
      showAlert(alertError, '⚠️ Veuillez corriger les champs en rouge avant de continuer.', 'error');
      return;
    }

    // ---- SIMULATION DU DÉLAI RÉSEAU ----
    btn.disabled    = true;
    btn.textContent = 'Création du compte…';

    setTimeout(() => {

      // Construction de l'objet utilisateur
      const userData = { role: currentRole, prenom, nom, email, telephone, password };
      if (currentRole === 'patient') userData.dateNaissance = dateNaissance;
      if (currentRole === 'medecin') userData.specialite = specialite;

      // ---- ENREGISTREMENT EN BASE ----
      const result = DB.register(userData);

      if (!result.success) {
        // Email déjà utilisé
        showAlert(alertError, '⚠️ ' + result.message, 'error');
        btn.disabled    = false;
        btn.textContent = 'Créer mon compte →';
        return;
      }

      // ✅ Compte créé avec succès
      showAlert(alertSuccess, '✅ Compte créé avec succès ! Redirection vers la connexion…', 'success');
      btn.textContent = '✓ Compte créé !';

      setTimeout(() => {
        window.location.href = 'login.html';
      }, 1800);

    }, 900);
  });
}

/* =============================================
   FONCTIONS UTILITAIRES
============================================= */

/** Valide un champ et retourne true/false */
function validate(fieldId, inputId, condition) {
  if (!condition) {
    document.getElementById(fieldId).classList.add('has-error');
    document.getElementById(inputId).classList.add('invalid');
    return false;
  }
  document.getElementById(fieldId).classList.remove('has-error');
  document.getElementById(inputId).classList.remove('invalid');
  return true;
}

/** Vérifie le format email */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Affiche une alerte */
function showAlert(el, message, type) {
  el.className     = 'alert ' + type;
  el.textContent   = message;
  el.style.display = 'block';
}

/* =============================================
   EFFET RIPPLE
============================================= */
function initRipple() {
  const btn = document.getElementById('registerBtn');
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
