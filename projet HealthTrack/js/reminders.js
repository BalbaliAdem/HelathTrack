/* reminders.js — gère les rappels 24h (Notification API + mailto/sms) */
const Reminders = {
  CHECK_INTERVAL_MS: 60 * 1000, // vérifie chaque minute
  user: null,
  timerId: null,

  init() {
    document.addEventListener('DOMContentLoaded', () => {
      const session = DB.getSession();
      if (!session) return;
      this.user = session;
      this.setupUI();
      this.requestPermissionIfNeeded();
      // check now and schedule periodic checks
      this.checkAndTrigger();
      this.timerId = setInterval(() => this.checkAndTrigger(), this.CHECK_INTERVAL_MS);
      window.addEventListener('ht_reminder_updated', () => this.syncUI());
      window.addEventListener('ht_data_updated', () => this.syncUI());
    });
  },

  setupUI() {
    const enableCb = document.getElementById('enableReminders');
    const channels = document.getElementById('reminderChannels');
    const emailCb = document.getElementById('reminderEmail');
    const autoOpenCb = document.getElementById('reminderAutoOpen');
    const testBtn = document.getElementById('testReminder');

    if (!enableCb) return;

    const prefs = DB_HEALTH.getReminderPrefs(this.user.id) || { enabled: false, email: false, autoOpen: false };
    enableCb.checked = !!prefs.enabled;
    emailCb.checked = !!prefs.email;
    autoOpenCb.checked = !!prefs.autoOpen;
    channels.style.display = prefs.enabled ? 'block' : 'none';

    enableCb.addEventListener('change', () => {
      const enabled = enableCb.checked;
      channels.style.display = enabled ? 'block' : 'none';
      DB_HEALTH.saveReminderPrefs(this.user.id, { enabled, email: emailCb.checked, autoOpen: autoOpenCb.checked });
      if (enabled) DB_HEALTH.scheduleReminder(this.user.id, Date.now() + 24 * 60 * 60 * 1000);
      else DB_HEALTH.scheduleReminder(this.user.id, null);
    });

    [emailCb, autoOpenCb].forEach(cb => cb.addEventListener('change', () => {
      DB_HEALTH.saveReminderPrefs(this.user.id, { enabled: enableCb.checked, email: emailCb.checked, autoOpen: autoOpenCb.checked });
    }));

    if (testBtn) testBtn.addEventListener('click', () => this.triggerReminder(this.user.id, true));
  },

  syncUI() {
    const prefs = DB_HEALTH.getReminderPrefs(this.user.id) || { enabled: false };
    const enableCb = document.getElementById('enableReminders');
    const channels = document.getElementById('reminderChannels');
    if (!enableCb) return;
    enableCb.checked = !!prefs.enabled;
    channels.style.display = prefs.enabled ? 'block' : 'none';
  },

  requestPermissionIfNeeded() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      Notification.requestPermission().then(() => {});
    }
  },

  checkAndTrigger() {
    const userId = this.user && this.user.id;
    if (!userId) return;
    const when = DB_HEALTH.getReminder(userId);
    if (!when) return;
    if (Number(when) <= Date.now()) {
      this.triggerReminder(userId, false);
    }
  },

  triggerReminder(userId, isTest = false) {
    const prefs = DB_HEALTH.getReminderPrefs(userId) || { enabled: false, email: false, autoOpen: false };
    if (!isTest && !prefs.enabled) return;
    const session = DB.getUsers().find(u => u.id == userId) || DB.getSession();
    const title = 'Rappel HealthTrack';
    const body = isTest ? 'Test : pensez à saisir vos mesures.' : 'Vous n\'avez pas saisi de mesures depuis 24 heures. Pensez à enregistrer vos mesures maintenant.';

    // Desktop notification
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const n = new Notification(title, { body });
        n.onclick = () => { window.focus(); document.getElementById('weight')?.scrollIntoView({ behavior: 'smooth' }); };
      } catch (e) { /* ignore */ }
    } else {
      // Fallback in-app alert
      try { if (!isTest) alert(body); } catch (e) {}
    }

    // Email — tenter d'appeler le service d'envoi configuré (EMAIL_SERVICE_URL), sinon fallback vers mailto
    if (prefs.email && session && session.email) {
      const subjectRaw = 'Rappel : saisir vos mesures - HealthTrack';
      const bodyRaw = `${body}\n\nBonjour ${session.prenom || ''},\n\nMerci de saisir vos mesures ici : ${location.href}`;
      const payload = { to: session.email, subject: subjectRaw, body: bodyRaw };

      if (typeof EMAIL_SERVICE_URL !== 'undefined' && EMAIL_SERVICE_URL) {
        const headers = { 'Content-Type': 'application/json' };
        if (typeof EMAIL_SERVICE_KEY !== 'undefined' && EMAIL_SERVICE_KEY) headers['Authorization'] = 'Bearer ' + EMAIL_SERVICE_KEY;
        const mailto = `mailto:${session.email}?subject=${encodeURIComponent(subjectRaw)}&body=${encodeURIComponent(bodyRaw)}`;
        fetch(`${EMAIL_SERVICE_URL}/send`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        }).then(async (res) => {
          if (!res.ok) {
            const text = await res.text().catch(() => '<no body>');
            console.warn('Email service responded with', res.status, text);
            // Try EmailJS fallback if configured
            if (window && window.sendViaEmailJS && window.EmailJSConfig && window.EmailJSConfig.serviceId) {
              window.sendViaEmailJS(payload).then(() => {
                if (isTest) alert('Test envoyé via EmailJS.');
              }).catch(e => {
                console.error('EmailJS send error', e);
                alert(`Erreur lors de l'envoi via le service: ${res.status} — ${text}\nTentative EmailJS échouée: ${e && e.message ? e.message : e}\nOuverture du client mail en secours.`);
                if (prefs.autoOpen || isTest) window.open(mailto, '_blank');
              });
            } else {
              alert(`Erreur lors de l'envoi via le service: ${res.status} — ${text}\nOuverture du client mail en secours.`);
              if (prefs.autoOpen || isTest) window.open(mailto, '_blank');
            }
          } else {
            if (isTest) alert('Test envoyé via le service.');
          }
        }).catch(err => {
          console.error('Email service error', err);
          // Try EmailJS fallback if configured
          if (window && window.sendViaEmailJS && window.EmailJSConfig && window.EmailJSConfig.serviceId) {
            window.sendViaEmailJS(payload).then(() => {
              if (isTest) alert('Test envoyé via EmailJS.');
            }).catch(e => {
              console.error('EmailJS send error', e);
              alert('Erreur lors de l\'envoi via le service: ' + (err && err.message ? err.message : err) + '\nTentative EmailJS échouée: ' + (e && e.message ? e.message : e) + '\nOuverture du client mail en secours.');
              if (prefs.autoOpen || isTest) window.open(mailto, '_blank');
            });
          } else {
            alert('Erreur lors de l\'envoi via le service: ' + (err && err.message ? err.message : err) + '\nOuverture du client mail en secours.');
            if (prefs.autoOpen || isTest) window.open(mailto, '_blank');
          }
        });
      } else if (window && window.sendViaEmailJS && window.EmailJSConfig && window.EmailJSConfig.serviceId) {
        // Only EmailJS configured
        window.sendViaEmailJS(payload).then(() => {
          if (isTest) alert('Test envoyé via EmailJS.');
        }).catch(e => {
          console.error('EmailJS send error', e);
          const mailto = `mailto:${session.email}?subject=${encodeURIComponent(subjectRaw)}&body=${encodeURIComponent(bodyRaw)}`;
          alert('Erreur lors de l\'envoi via EmailJS: ' + (e && e.message ? e.message : e) + '\nOuverture du client mail en secours.');
          if (prefs.autoOpen || isTest) window.open(mailto, '_blank');
        });
      } else {
        const mailto = `mailto:${session.email}?subject=${encodeURIComponent(subjectRaw)}&body=${encodeURIComponent(bodyRaw)}`;
        if (prefs.autoOpen || isTest) window.open(mailto, '_blank');
      }
    }

    // Reschedule next reminder 24h later to avoid repeated immediate firing
    DB_HEALTH.scheduleReminder(userId, Date.now() + 24 * 60 * 60 * 1000);
  }
};

Reminders.init();
