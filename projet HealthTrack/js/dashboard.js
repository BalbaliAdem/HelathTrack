let charts = {};
let editingTimestamp = null;

document.addEventListener('DOMContentLoaded', () => {
  const session = DB.getSession(); // Récupère l'utilisateur connecté
  if (!session) { window.location.href = 'login.html'; return; }

  // Boutons utilitaires
  const seedBtn = document.getElementById('seedDataBtn');
  if (seedBtn) seedBtn.addEventListener('click', () => { seedSampleData(session.id); renderCharts(); renderDataList(); });
  const clearBtn = document.getElementById('clearDataBtn');
  if (clearBtn) clearBtn.addEventListener('click', () => { clearUserData(session.id); renderCharts(); renderDataList(); });

  // Soumission du formulaire (ajout ou modification)
  const form = document.getElementById('healthForm');
  const submitBtn = document.getElementById('submitDataBtn');
  const cancelBtn = document.getElementById('cancelEditBtn');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const w = document.getElementById('weight').value;
      const s = document.getElementById('steps').value;
      const sys = document.getElementById('systolic').value;
      const dia = document.getElementById('diastolic').value;
      const hr = document.getElementById('heartRate').value;
      const sl = document.getElementById('sleepHours').value;

      if (editingTimestamp) {
        // Mettre à jour l'entrée existante
        const res = DB_HEALTH.updateEntry(session.id, editingTimestamp, {
          weight: w, steps: s, systolic: sys, diastolic: dia, heartRate: hr, sleepHours: sl
        });
        if (res && res.success) {
          cancelEdit();
          renderCharts();
          renderDataList();
        } else {
          alert('Impossible de mettre à jour l\'entrée.');
        }
      } else {
        // Nouvelle entrée
        DB_HEALTH.saveData(session.id, w, s, sys, dia, hr, sl);
        renderCharts();
        renderDataList();
      }
    });

    if (cancelBtn) cancelBtn.addEventListener('click', () => { cancelEdit(); });
  }

  // Initial render (seed if empty)
  renderCharts();
  renderDataList();
});

// Ecouter les mises à jour cross-tab
window.addEventListener('ht_data_updated', (e) => {
  renderCharts();
  renderDataList();
});

function renderDataList() {
  const session = DB.getSession();
  if (!session) return;
  const list = document.getElementById('dataList');
  if (!list) return;
  const data = DB_HEALTH.getUserData(session.id) || [];
  list.innerHTML = '';
  // afficher les plus récents en premier
  const items = data.slice().reverse();
  items.forEach(entry => {
    const li = document.createElement('li');
    li.className = 'data-item';
    li.dataset.ts = entry.timestamp;
    li.innerHTML = `
      <div class="values">
        <strong>${entry.date}</strong>
        <span>Poids: ${entry.weight} kg</span>
        <span>Pas: ${entry.steps}</span>
        <span>TA: ${entry.systolic}/${entry.diastolic}</span>
        <span>FC: ${entry.heartRate} bpm</span>
        <span>Sommeil: ${entry.sleepHours} h</span>
      </div>
      <div class="actions">
        <button class="btn-primary ghost edit-btn" data-ts="${entry.timestamp}">Modifier</button>
        <button class="btn-primary ghost delete-btn" data-ts="${entry.timestamp}">Supprimer</button>
      </div>
    `;
    list.appendChild(li);
  });

  // handlers
  list.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', (e) => {
    const ts = Number(e.currentTarget.dataset.ts);
    enterEditMode(ts);
  }));
  list.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', (e) => {
    const ts = Number(e.currentTarget.dataset.ts);
    if (!confirm('Supprimer cette entrée ?')) return;
    const session = DB.getSession();
    if (!session) return;
    DB_HEALTH.deleteEntry(session.id, ts);
    renderCharts();
    renderDataList();
  }));
}

function enterEditMode(timestamp) {
  const session = DB.getSession();
  if (!session) return;
  const data = DB_HEALTH.getUserData(session.id) || [];
  const entry = data.find(d => Number(d.timestamp) === Number(timestamp));
  if (!entry) return;
  document.getElementById('weight').value = entry.weight;
  document.getElementById('steps').value = entry.steps;
  document.getElementById('systolic').value = entry.systolic;
  document.getElementById('diastolic').value = entry.diastolic;
  document.getElementById('heartRate').value = entry.heartRate;
  document.getElementById('sleepHours').value = entry.sleepHours;
  const submitBtn = document.getElementById('submitDataBtn');
  if (submitBtn) submitBtn.textContent = 'Sauvegarder la modification';
  const cancelBtn = document.getElementById('cancelEditBtn');
  if (cancelBtn) cancelBtn.style.display = 'block';
  editingTimestamp = Number(timestamp);
  // bring form into view
  document.getElementById('weight').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cancelEdit() {
  editingTimestamp = null;
  const form = document.getElementById('healthForm');
  if (form) form.reset();
  const submitBtn = document.getElementById('submitDataBtn');
  if (submitBtn) submitBtn.textContent = 'Ajouter les données';
  const cancelBtn = document.getElementById('cancelEditBtn');
  if (cancelBtn) cancelBtn.style.display = 'none';
}

function seedSampleData(userId) {
  const existing = DB_HEALTH.getUserData(userId);
  if (existing && existing.length) return; // ne pas dupliquer

  const storage = JSON.parse(localStorage.getItem('ht_health_data')) || [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const timestamp = d.getTime();
    const dateStr = d.toLocaleDateString('fr-FR');
    const weight = +(72 + Math.random() * 6).toFixed(1);
    const steps = Math.floor(3000 + Math.random() * 10000);
    const systolic = 110 + Math.floor(Math.random() * 25);
    const diastolic = 70 + Math.floor(Math.random() * 15);
    const heartRate = 58 + Math.floor(Math.random() * 30);
    const sleepHours = +(5 + Math.random() * 4).toFixed(1);
    storage.push({ userId, date: dateStr, weight, steps, systolic, diastolic, heartRate, sleepHours, timestamp });
  }
  localStorage.setItem('ht_health_data', JSON.stringify(storage));
}

function clearUserData(userId) {
  // Replace user's entries with 7 days of zeros so charts show 0 instead of disappearing
  const data = JSON.parse(localStorage.getItem('ht_health_data')) || [];
  // Keep other users' data
  const others = data.filter(d => d.userId !== userId);

  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const timestamp = d.getTime();
    const dateStr = d.toLocaleDateString('fr-FR');
    others.push({ userId, date: dateStr, weight: 0, steps: 0, systolic: 0, diastolic: 0, heartRate: 0, sleepHours: 0, timestamp });
  }
  localStorage.setItem('ht_health_data', JSON.stringify(others));
  // Notify other UI components in the same tab to refresh (widgets don't receive storage events in same tab)
  try {
    window.dispatchEvent(new CustomEvent('ht_data_updated', { detail: { userId } }));
  } catch (e) { /* ignore */ }
}

function renderCharts() {
  const session = DB.getSession();
  if (!session) return;

  let data = DB_HEALTH.getUserData(session.id);
  if (!data || data.length === 0) {
    seedSampleData(session.id);
    data = DB_HEALTH.getUserData(session.id);
  }

  const labels = data.map(d => d.date);
  const weightData = data.map(d => d.weight);
  const stepsData = data.map(d => d.steps);
  const systolicData = data.map(d => d.systolic);
  const diastolicData = data.map(d => d.diastolic);
  const heartRateData = data.map(d => d.heartRate);
  const sleepData = data.map(d => d.sleepHours);

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    elements: {
      line: { tension: 0.35, borderWidth: 2, pointRadius: 3, pointHoverRadius: 6 },
      bar: { borderRadius: 8 }
    },
    layout: { padding: { top: 8, right: 12, bottom: 18, left: 8 } },
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: 'rgba(255,255,255,0.9)', boxWidth: 14, padding: 8, font: { size: 12 } }
      },
      tooltip: {
        backgroundColor: 'rgba(0,0,0,0.75)',
        titleColor: '#fff',
        bodyColor: '#fff',
        padding: 8,
        displayColors: false
      }
    },
    scales: {
      x: {
        ticks: { color: 'rgba(255,255,255,0.85)', autoSkip: true, maxRotation: 45, minRotation: 30, maxTicksLimit: 6 },
        grid: { color: 'rgba(255,255,255,0.03)' }
      },
      y: {
        ticks: {
          color: 'rgba(255,255,255,0.85)',
          callback: function(value) {
            if (typeof value === 'number' && Math.abs(value) >= 1000) return value.toLocaleString('fr-FR');
            return value;
          }
        },
        grid: { color: 'rgba(255,255,255,0.03)' },
        beginAtZero: false
      }
    }
  };

  // Steps should start at zero for clearer bar charts
  const stepsOptions = Object.assign({}, commonOptions, {
    scales: Object.assign({}, commonOptions.scales, {
      y: Object.assign({}, commonOptions.scales.y, { beginAtZero: true })
    })
  });

  // Détruire les anciens graphiques
  Object.values(charts).forEach(c => { if (c) c.destroy(); });
  charts = {};

  charts.weight = new Chart(document.getElementById('weightChart').getContext('2d'), {
    type: 'line',
    data: { labels, datasets: [{ label: 'Poids (kg)', data: weightData, borderColor: '#2aad85', backgroundColor: 'rgba(42,173,133,0.08)', fill: true, tension: 0.3 }] },
    options: commonOptions
  });

  charts.steps = new Chart(document.getElementById('stepsChart').getContext('2d'), {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Nombre de pas', data: stepsData, backgroundColor: '#f0c44f' }] },
    options: stepsOptions
  });

  charts.systolic = new Chart(document.getElementById('systolicChart').getContext('2d'), {
    type: 'line',
    data: { labels, datasets: [{ label: 'Pression systolique (mmHg)', data: systolicData, borderColor: '#e74c3c', tension: 0.3 }] },
    options: commonOptions
  });

  charts.diastolic = new Chart(document.getElementById('diastolicChart').getContext('2d'), {
    type: 'line',
    data: { labels, datasets: [{ label: 'Pression diastolique (mmHg)', data: diastolicData, borderColor: '#9b59b6', tension: 0.3 }] },
    options: commonOptions
  });

  charts.heart = new Chart(document.getElementById('heartRateChart').getContext('2d'), {
    type: 'line',
    data: { labels, datasets: [{ label: 'Fréquence cardiaque (bpm)', data: heartRateData, borderColor: '#3498db', tension: 0.3 }] },
    options: commonOptions
  });

  charts.sleep = new Chart(document.getElementById('sleepChart').getContext('2d'), {
    type: 'line',
    data: { labels, datasets: [{ label: 'Heures de sommeil', data: sleepData, borderColor: '#1abc9c', tension: 0.3 }] },
    options: commonOptions
  });
}