// dashboard_medecin.js
let chart1, chart2, chart3, chart4, chart5, chart6;
let selectedPatientId = null;

// Options partagées pour des graphiques plus lisibles
const commonOptionsMed = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    elements: { line: { tension: 0.35, borderWidth: 2, pointRadius: 3, pointHoverRadius: 6 }, bar: { borderRadius: 8 } },
    plugins: {
        legend: { position: 'bottom', labels: { color: 'rgba(255,255,255,0.9)', boxWidth: 14, padding: 8 } },
        tooltip: { backgroundColor: 'rgba(0,0,0,0.75)', titleColor: '#fff', bodyColor: '#fff', padding: 8, displayColors: false }
    },
    scales: {
        x: { ticks: { color: 'rgba(255,255,255,0.85)', autoSkip: true, maxRotation: 45 }, grid: { color: 'rgba(255,255,255,0.03)' } },
        y: { ticks: { color: 'rgba(255,255,255,0.85)', callback: function(v){ return (typeof v === 'number' && Math.abs(v) >= 1000) ? v.toLocaleString('fr-FR') : v; } }, grid: { color: 'rgba(255,255,255,0.03)' }, beginAtZero: false }
    }
};

const stepsOptionsMed = Object.assign({}, commonOptionsMed, { scales: Object.assign({}, commonOptionsMed.scales, { y: Object.assign({}, commonOptionsMed.scales.y, { beginAtZero: true }) }) });

function getUserById(id) {
    const users = DB.getUsers();
    return users.find(u => u.id == id) || null;
}

function chargerListePatients(filter = '') {
    const container = document.getElementById('patientList');
    if (!container) return;
    container.innerHTML = '';
    const users = DB.getUsers() || [];
    const patients = users.filter(u => u.role === 'patient' && (filter === '' || (u.prenom + ' ' + u.nom + ' ' + u.email).toLowerCase().includes(filter.toLowerCase())));

    patients.forEach(p => {
        const item = document.createElement('div');
        item.className = 'patient-item';
        item.dataset.id = p.id;
        item.innerHTML = `
            <div class="patient-info">
                <strong>${p.prenom} ${p.nom}</strong>
                <small>${p.email}</small>
            </div>`;
        item.onclick = () => selectPatient(p.id);
        container.appendChild(item);
    });
}

function selectPatient(id) {
    selectedPatientId = id;
    document.querySelectorAll('#patientList .patient-item').forEach(el => el.classList.toggle('active', el.dataset.id == id));
    const patient = getUserById(id);
    if (!patient) return;
    document.getElementById('detailActions').style.display = 'flex';
    document.getElementById('statsSummary').style.display = 'block';
    document.getElementById('statsContainer').style.display = 'block';
    afficherDetails(patient);
    const recPanel = document.getElementById('recommendationPanel');
    if (recPanel) recPanel.style.display = 'block';
}

function computeStats(data) {
    if (!data || data.length === 0) return null;
    const len = data.length;
    const sum = (arr) => arr.reduce((a,b) => a + (Number(b)||0), 0);
    const weights = data.map(d => Number(d.weight) || 0);
    const steps = data.map(d => Number(d.steps) || 0);
    const heart = data.map(d => Number(d.heartRate) || 0);
    const sleep = data.map(d => Number(d.sleepHours) || 0);
    return {
        weightAvg: (sum(weights)/len).toFixed(1),
        stepsAvg: Math.round(sum(steps)/len),
        heartAvg: Math.round(sum(heart)/len),
        sleepAvg: +(sum(sleep)/len).toFixed(1)
    };
}

function updateStatUI(stats) {
    if (!stats) {
        document.getElementById('statWeight').textContent = '—';
        document.getElementById('statSteps').textContent = '—';
        document.getElementById('statHeart').textContent = '—';
        document.getElementById('statSleep').textContent = '—';
        return;
    }
    document.getElementById('statWeight').textContent = stats.weightAvg;
    document.getElementById('statSteps').textContent = stats.stepsAvg.toLocaleString('fr-FR');
    document.getElementById('statHeart').textContent = stats.heartAvg;
    document.getElementById('statSleep').textContent = stats.sleepAvg;
}


function clearPatientData(userId) {
    // Replace patient entries with zeros for the last 7 days
    const all = JSON.parse(localStorage.getItem('ht_health_data')) || [];
    const others = all.filter(d => d.userId != userId);
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const timestamp = d.getTime();
        const dateStr = d.toLocaleDateString('fr-FR');
        others.push({ userId, date: dateStr, weight: 0, steps: 0, systolic: 0, diastolic: 0, heartRate: 0, sleepHours: 0, timestamp });
    }
    localStorage.setItem('ht_health_data', JSON.stringify(others));
    try { window.dispatchEvent(new CustomEvent('ht_data_updated', { detail: { userId } })); } catch(e){}
}

document.addEventListener('DOMContentLoaded', () => {
    const session = DB.getSession();
    if (!session || session.role !== 'medecin') { window.location.href = 'login.html'; return; }

    chargerListePatients();

    const search = document.getElementById('patientSearch');
    if (search) search.addEventListener('input', (e) => chargerListePatients(e.target.value.trim()));

    const seedBtn = document.getElementById('seedPatientBtn');
    const clearBtn = document.getElementById('clearPatientBtn');
    if (seedBtn) seedBtn.addEventListener('click', () => {
        if (!selectedPatientId) return alert('Sélectionnez un patient.');
        seedPatientData(selectedPatientId);
        const patient = getUserById(selectedPatientId);
        if (patient) afficherDetails(patient);
    });
    if (clearBtn) clearBtn.addEventListener('click', () => {
        if (!selectedPatientId) return alert('Sélectionnez un patient.');
        if (!confirm('Effacer les données du patient (remplacera par des zéros) ?')) return;
        clearPatientData(selectedPatientId);
        const patient = getUserById(selectedPatientId);
        if (patient) afficherDetails(patient);
    });
});

/** Récupère et affiche les données de santé du patient sélectionné */
function afficherDetails(patient) {
    document.getElementById('statsContainer').style.display = 'block';
    document.getElementById('patientName').textContent = `Suivi de ${patient.prenom} ${patient.nom}`;

    const allData = JSON.parse(localStorage.getItem('ht_health_data')) || [];
    const patientData = allData.filter(d => d.userId == patient.id).sort((a,b) => a.timestamp - b.timestamp);

    const dates = patientData.map(d => d.date);
    const weights = patientData.map(d => d.weight);
    const steps = patientData.map(d => d.steps);
    const systolics = patientData.map(d => d.systolic);
    const diastolics = patientData.map(d => d.diastolic);
    const heartRates = patientData.map(d => d.heartRate);
    const sleepHours = patientData.map(d => d.sleepHours);

    // Update stats
    const stats = computeStats(patientData);
    updateStatUI(stats);

    // Détruire les anciens graphiques avant d'en créer de nouveaux
    [chart1, chart2, chart3, chart4, chart5, chart6].forEach(c => { try { if (c) c.destroy(); } catch (e) {} });

    chart1 = new Chart(document.getElementById('weightChart').getContext('2d'), {
        type: 'line',
        data: { labels: dates, datasets: [{ label: 'Poids (kg)', data: weights, borderColor: '#f0c44f', backgroundColor: 'rgba(240,196,79,0.06)', fill: true }] },
        options: commonOptionsMed
    });

    chart2 = new Chart(document.getElementById('stepsChart').getContext('2d'), {
        type: 'bar',
        data: { labels: dates, datasets: [{ label: 'Pas par jour', data: steps, backgroundColor: '#2aad85' }] },
        options: stepsOptionsMed
    });

    chart3 = new Chart(document.getElementById('systolicChart').getContext('2d'), {
        type: 'line',
        data: { labels: dates, datasets: [{ label: 'Pression systolique (mmHg)', data: systolics, borderColor: '#e74c3c' }] },
        options: commonOptionsMed
    });

    chart4 = new Chart(document.getElementById('diastolicChart').getContext('2d'), {
        type: 'line',
        data: { labels: dates, datasets: [{ label: 'Pression diastolique (mmHg)', data: diastolics, borderColor: '#9b59b6' }] },
        options: commonOptionsMed
    });

    chart5 = new Chart(document.getElementById('heartRateChart').getContext('2d'), {
        type: 'line',
        data: { labels: dates, datasets: [{ label: 'Fréquence cardiaque (bpm)', data: heartRates, borderColor: '#3498db' }] },
        options: commonOptionsMed
    });

    chart6 = new Chart(document.getElementById('sleepChart').getContext('2d'), {
        type: 'line',
        data: { labels: dates, datasets: [{ label: 'Heures de sommeil', data: sleepHours, borderColor: '#1abc9c' }] },
        options: commonOptionsMed
    });
}

// Setup recommendation send handlers and helper
document.addEventListener('DOMContentLoaded', () => {
    const sendBtn = document.getElementById('sendRecBtn');
    const templateBtn = document.getElementById('templateRecBtn');
    if (sendBtn) sendBtn.addEventListener('click', () => sendRecommendation());
    if (templateBtn) templateBtn.addEventListener('click', () => {
        const area = document.getElementById('recMessage');
        if (area) area.value = 'Bonjour,\n\nVoici quelques recommandations pour améliorer votre suivi :\n- Mesurez votre poids chaque matin à jeun.\n- Marchez au moins 30 minutes par jour.\n- Surveillez votre tension et notez les valeurs.\n\nCordialement,\nVotre médecin';
    });
});

function sendRecommendation() {
    if (!selectedPatientId) return alert('Sélectionnez un patient d\'abord.');
    const patient = getUserById(selectedPatientId);
    if (!patient) return alert('Patient introuvable.');

    const subject = (document.getElementById('recSubject') || {}).value || '';
    const message = (document.getElementById('recMessage') || {}).value || '';
    const useEmail = !!(document.getElementById('recEmail') || {}).checked;

    if (!useEmail) return alert('Sélectionnez le canal Email.');

    const doctor = DB.getSession();
    const fromName = (doctor && (doctor.prenom || doctor.nom)) ? (doctor.prenom || doctor.nom) : '';
    const fullMessage = message + '\n\n' + (fromName ? `Cordialement,\n${fromName}` : '');

    if (useEmail) {
        if (!patient.email) return alert('Le patient n\'a pas d\'adresse email enregistrée.');
        const payload = {
            to: patient.email,
            subject: subject || 'Recommandation de votre médecin',
            body: fullMessage,
            from: (doctor && doctor.email) ? doctor.email : undefined
        };

        if (typeof EMAIL_SERVICE_URL !== 'undefined' && EMAIL_SERVICE_URL) {
            const headers = { 'Content-Type': 'application/json' };
            if (typeof EMAIL_SERVICE_KEY !== 'undefined' && EMAIL_SERVICE_KEY) headers['Authorization'] = 'Bearer ' + EMAIL_SERVICE_KEY;
            const mailto = `mailto:${patient.email}?subject=${encodeURIComponent(payload.subject)}&body=${encodeURIComponent(payload.body)}`;
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
                            alert('Email envoyé via EmailJS.');
                        }).catch(e => {
                            console.error('EmailJS send error', e);
                            alert(`Erreur lors de l'envoi via le service: ${res.status} — ${text}\nTentative EmailJS échouée: ${e && e.message ? e.message : e}\nOuverture du client mail en secours.`);
                            window.open(mailto, '_blank');
                        });
                    } else {
                        alert(`Erreur lors de l'envoi via le service: ${res.status} — ${text}\nOuverture du client mail en secours.`);
                        window.open(mailto, '_blank');
                    }
                } else {
                    alert('Email envoyé via le service.');
                }
            }).catch(err => {
                console.error('Email service error', err);
                // Try EmailJS fallback if configured
                if (window && window.sendViaEmailJS && window.EmailJSConfig && window.EmailJSConfig.serviceId) {
                    window.sendViaEmailJS(payload).then(() => {
                        alert('Email envoyé via EmailJS.');
                    }).catch(e => {
                        console.error('EmailJS send error', e);
                        alert('Erreur lors de l\'envoi via le service: ' + (err && err.message ? err.message : err) + '\nTentative EmailJS échouée: ' + (e && e.message ? e.message : e) + '\nOuverture du client mail en secours.');
                        window.open(mailto, '_blank');
                    });
                } else {
                    alert('Erreur lors de l\'envoi via le service: ' + (err && err.message ? err.message : err) + '\nOuverture du client mail en secours.');
                    window.open(mailto, '_blank');
                }
            });
        } else if (window && window.sendViaEmailJS && window.EmailJSConfig && window.EmailJSConfig.serviceId) {
            // Only EmailJS configured
            window.sendViaEmailJS(payload).then(() => {
                alert('Email envoyé via EmailJS.');
            }).catch(e => {
                console.error('EmailJS send error', e);
                const mailto = `mailto:${patient.email}?subject=${encodeURIComponent(payload.subject)}&body=${encodeURIComponent(payload.body)}`;
                alert('Erreur lors de l\'envoi via EmailJS: ' + (e && e.message ? e.message : e) + '\nOuverture du client mail en secours.');
                window.open(mailto, '_blank');
            });
        } else {
            const mailto = `mailto:${patient.email}?subject=${encodeURIComponent(payload.subject)}&body=${encodeURIComponent(payload.body)}`;
            window.open(mailto, '_blank');
        }
    }
}