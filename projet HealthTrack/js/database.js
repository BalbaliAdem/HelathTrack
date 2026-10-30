// database.js — simulated DB (localStorage)

const DB = {

  /* ------------------------------------------
     INITIALISATION
     Crée la table "users" si elle n'existe pas
  ------------------------------------------ */
  init() {
    if (!localStorage.getItem('ht_users')) {
      // Données de départ (comptes de démonstration)
      const defaultUsers = [
        {
          id: 1,
          role: 'patient',
          nom: 'Ben Ali',
          prenom: 'Ahmed',
          email: 'patient@healthtrack.com',
          password: 'patient123',
          dateNaissance: '1990-05-15',
          telephone: '0612345678',
          createdAt: new Date().toISOString()
        },
        {
          id: 2,
          role: 'medecin',
          nom: 'Trabelsi',
          prenom: 'Dr. Sonia',
          email: 'medecin@healthtrack.com',
          password: 'medecin123',
          specialite: 'Médecine générale',
          telephone: '0698765432',
          createdAt: new Date().toISOString()
        }
      ];
      localStorage.setItem('ht_users', JSON.stringify(defaultUsers));
    }
  },

  /* ------------------------------------------
     LIRE tous les utilisateurs
  ------------------------------------------ */
  getUsers() {
    return JSON.parse(localStorage.getItem('ht_users')) || [];
  },

  /* ------------------------------------------
     CHERCHER un utilisateur par email
  ------------------------------------------ */
  findByEmail(email) {
    return this.getUsers().find(u => u.email === email.toLowerCase()) || null;
  },

  /* ------------------------------------------
     VÉRIFIER LES IDENTIFIANTS (Login)
     Retourne l'utilisateur ou null
  ------------------------------------------ */
  login(email, password) {
    const user = this.findByEmail(email);
    if (user && user.password === password) {
      return user;
    }
    return null;
  },

  /* ------------------------------------------
     CRÉER UN COMPTE (Register)
     Retourne { success, message }
  ------------------------------------------ */
  register(userData) {
    // Vérifier si l'email existe déjà
    if (this.findByEmail(userData.email)) {
      return { success: false, message: 'Cet email est déjà utilisé.' };
    }

    const users = this.getUsers();
    const newUser = {
      id: Date.now(), // ID unique basé sur le timestamp
      ...userData,
      email: userData.email.toLowerCase(),
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    localStorage.setItem('ht_users', JSON.stringify(users));
    return { success: true, message: 'Compte créé avec succès !' };
  },

  /* ------------------------------------------
     RÉINITIALISER LE MOT DE PASSE
     Simule l'envoi d'un email
  ------------------------------------------ */
  resetPassword(email, newPassword) {
    const users = this.getUsers();
    const index = users.findIndex(u => u.email === email.toLowerCase());

    if (index === -1) {
      return { success: false, message: 'Aucun compte trouvé avec cet email.' };
    }

    users[index].password = newPassword;
    localStorage.setItem('ht_users', JSON.stringify(users));
    return { success: true, message: 'Mot de passe mis à jour avec succès !' };
  },

  /* ------------------------------------------
     SAUVEGARDER LA SESSION (utilisateur connecté)
  ------------------------------------------ */
  saveSession(user) {
    // On ne sauvegarde jamais le mot de passe dans la session
    const { password, ...safeUser } = user;
    sessionStorage.setItem('ht_session', JSON.stringify(safeUser));
  },

  /* ------------------------------------------
     LIRE LA SESSION
  ------------------------------------------ */
  getSession() {
    return JSON.parse(sessionStorage.getItem('ht_session')) || null;
  },

  /* ------------------------------------------
     DÉCONNEXION
  ------------------------------------------ */
  logout() {
    sessionStorage.removeItem('ht_session');
    window.location.href = 'login.html';
  }
};

// Initialiser la base au chargement du script
DB.init();



//--------------------
// Extension de database.js pour le Sprint 2
const DB_HEALTH = {
  // Enregistrer une mesure
  saveData(userId, weight, steps, systolic, diastolic, heartRate, sleepHours) {
    const data = JSON.parse(localStorage.getItem('ht_health_data')) || [];
    const entry = {
      userId: userId,
      date: new Date().toLocaleDateString('fr-FR'),
      weight: parseFloat(weight),
      steps: parseInt(steps),
      systolic: parseInt(systolic),
      diastolic: parseInt(diastolic),
      heartRate: parseInt(heartRate),
      sleepHours: parseFloat(sleepHours),
      timestamp: new Date().getTime()
    };
    data.push(entry);
    localStorage.setItem('ht_health_data', JSON.stringify(data));
    // Planifier le rappel 24h après cette saisie (si les rappels sont activés)
    try { if (typeof this.scheduleReminder === 'function') this.scheduleReminder(userId, Date.now() + 24 * 60 * 60 * 1000); } catch (e) {}
    return { success: true };
  },

  // Récupérer les données d'un utilisateur spécifique
  getUserData(userId) {
    const data = JSON.parse(localStorage.getItem('ht_health_data')) || [];
    return data.filter(d => d.userId === userId).sort((a, b) => a.timestamp - b.timestamp);
  }

  ,
  /* ------------------------------------------
     METTRE A JOUR / SUPPRIMER UNE ENTRÉE
     Identifie les entrées par `timestamp` (généré lors de la création)
  ------------------------------------------ */
  updateEntry(userId, timestamp, fields) {
    const data = JSON.parse(localStorage.getItem('ht_health_data')) || [];
    const ts = Number(timestamp);
    const idx = data.findIndex(d => d.userId === userId && Number(d.timestamp) === ts);
    if (idx === -1) return { success: false, message: 'Entrée introuvable.' };
    const entry = data[idx];
    const updated = Object.assign({}, entry, {
      weight: fields.weight !== undefined ? parseFloat(fields.weight) : entry.weight,
      steps: fields.steps !== undefined ? parseInt(fields.steps) : entry.steps,
      systolic: fields.systolic !== undefined ? parseInt(fields.systolic) : entry.systolic,
      diastolic: fields.diastolic !== undefined ? parseInt(fields.diastolic) : entry.diastolic,
      heartRate: fields.heartRate !== undefined ? parseInt(fields.heartRate) : entry.heartRate,
      sleepHours: fields.sleepHours !== undefined ? parseFloat(fields.sleepHours) : entry.sleepHours
    });
    // conserver la date et le timestamp d'origine sauf si une date explicite est fournie
    updated.timestamp = entry.timestamp;
    updated.date = fields.date || entry.date;
    data[idx] = updated;
    localStorage.setItem('ht_health_data', JSON.stringify(data));
    // Considérer la modification comme une nouvelle activité utilisateur => repousser le rappel
    try { if (typeof this.scheduleReminder === 'function') this.scheduleReminder(userId, Date.now() + 24 * 60 * 60 * 1000); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent('ht_data_updated', { detail: { userId } })); } catch(e){}
    return { success: true, entry: updated };
  },

  deleteEntry(userId, timestamp) {
    const data = JSON.parse(localStorage.getItem('ht_health_data')) || [];
    const ts = Number(timestamp);
    const filtered = data.filter(d => !(d.userId === userId && Number(d.timestamp) === ts));
    localStorage.setItem('ht_health_data', JSON.stringify(filtered));
    try { window.dispatchEvent(new CustomEvent('ht_data_updated', { detail: { userId } })); } catch(e){}
    return { success: true };
  }
  ,

  /* ------------------------------------------
     GESTION DES RAPPPELS ET PRÉFÉRENCES
  ------------------------------------------ */
  scheduleReminder(userId, when) {
    const map = JSON.parse(localStorage.getItem('ht_reminders') || '{}');
    if (!when) {
      // supprimer le rappel
      delete map[userId];
    } else {
      map[userId] = Number(when);
    }
    localStorage.setItem('ht_reminders', JSON.stringify(map));
    try { window.dispatchEvent(new CustomEvent('ht_reminder_updated', { detail: { userId } })); } catch (e) {}
    return { success: true };
  },

  getReminder(userId) {
    const map = JSON.parse(localStorage.getItem('ht_reminders') || '{}');
    return map[userId] ? Number(map[userId]) : null;
  },

  saveReminderPrefs(userId, prefs) {
    const map = JSON.parse(localStorage.getItem('ht_reminders_prefs') || '{}');
    map[userId] = prefs;
    localStorage.setItem('ht_reminders_prefs', JSON.stringify(map));
    return { success: true };
  },

  getReminderPrefs(userId) {
    const map = JSON.parse(localStorage.getItem('ht_reminders_prefs') || '{}');
    const p = map[userId];
    if (!p) return { enabled: false, email: false, sms: false, autoOpen: false };
    return p;
  }
};
