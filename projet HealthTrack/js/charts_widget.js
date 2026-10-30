(function () {
  'use strict';

  function ensureChartJs() {
    if (window.Chart) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/chart.js';
      s.onload = () => resolve();
      s.onerror = (e) => reject(e);
      document.head.appendChild(s);
    });
  }

  function createWidget() {
    if (document.getElementById('globalChartsWidget')) return document.getElementById('globalChartsWidget');
    const el = document.createElement('aside');
    el.id = 'globalChartsWidget';
    el.className = 'global-charts-widget';
    el.innerHTML = `
      <button class="gcw-close" title="Fermer">✕</button>
      <div class="gcw-header">Mes indicateurs</div>
      <div class="gcw-charts">
        <div class="gcw-card"><canvas id="gcwWeight"></canvas></div>
        <div class="gcw-card"><canvas id="gcwSteps"></canvas></div>
        <div class="gcw-card"><canvas id="gcwHeart"></canvas></div>
        <div class="gcw-card"><canvas id="gcwSleep"></canvas></div>
      </div>
    `;
    document.body.appendChild(el);
    el.querySelector('.gcw-close').addEventListener('click', () => el.remove());
    return el;
  }

  function genSample() {
    const now = new Date();
    const labels = [];
    const w = [], s = [], h = [], sl = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      labels.push(d.toLocaleDateString('fr-FR'));
      w.push(+(72 + Math.random() * 6).toFixed(1));
      s.push(Math.floor(3000 + Math.random() * 10000));
      h.push(58 + Math.floor(Math.random() * 30));
      sl.push(5 + Math.round(Math.random() * 40) / 10);
    }
    return { labels, w, s, h, sl };
  }

  function safeGetUserData(userId) {
    try {
      const data = (window.DB_HEALTH && DB_HEALTH.getUserData(userId)) || [];
      if (!data || data.length === 0) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  function renderMiniCharts(userId) {
    const existingData = safeGetUserData(userId);
    const samples = genSample();
    const labels = existingData ? existingData.map(d => d.date) : samples.labels;
    const weightData = existingData ? existingData.map(d => d.weight) : samples.w;
    const stepsData = existingData ? existingData.map(d => d.steps) : samples.s;
    const heartData = existingData ? existingData.map(d => d.heartRate) : samples.h;
    const sleepData = existingData ? existingData.map(d => d.sleepHours) : samples.sl;

    if (!window.gcwCharts) window.gcwCharts = {};
    // destroy old charts
    Object.values(window.gcwCharts).forEach(c => { try { c.destroy(); } catch (e) {} });
    window.gcwCharts = {};

    const opts = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      elements: { line: { tension: 0.35, borderWidth: 2, pointRadius: 2 }, bar: { borderRadius: 6 } },
      plugins: { legend: { display: false }, tooltip: { enabled: true, displayColors: false, backgroundColor: 'rgba(0,0,0,0.75)', titleColor: '#fff', bodyColor: '#fff' } },
      scales: {
        x: { display: false },
        y: { display: false }
      }
    };

    const wctx = document.getElementById('gcwWeight').getContext('2d');
    window.gcwCharts.weight = new Chart(wctx, {
      type: 'line',
      data: { labels, datasets: [{ data: weightData, borderColor: '#2aad85', backgroundColor: 'rgba(42,173,133,0.08)', fill: true, tension: 0.3 }] },
      options: opts
    });

    const sctx = document.getElementById('gcwSteps').getContext('2d');
    window.gcwCharts.steps = new Chart(sctx, {
      type: 'bar',
      data: { labels, datasets: [{ data: stepsData, backgroundColor: '#f0c44f' }] },
      options: opts
    });

    const hctx = document.getElementById('gcwHeart').getContext('2d');
    window.gcwCharts.heart = new Chart(hctx, {
      type: 'line',
      data: { labels, datasets: [{ data: heartData, borderColor: '#3498db', fill: false, tension: 0.3 }] },
      options: opts
    });

    const slctx = document.getElementById('gcwSleep').getContext('2d');
    window.gcwCharts.sleep = new Chart(slctx, {
      type: 'line',
      data: { labels, datasets: [{ data: sleepData, borderColor: '#1abc9c', fill: false, tension: 0.3 }] },
      options: opts
    });
  }

  function waitForDB(timeout = 2000) {
    return new Promise((resolve) => {
      const start = Date.now();
      (function check() {
        if (window.DB && window.DB.getSession) return resolve(true);
        if (Date.now() - start > timeout) return resolve(false);
        setTimeout(check, 50);
      })();
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    // wait for database.js to register DB
    const hasDB = await waitForDB(2000);
    if (!hasDB) return; // no DB available on this page

    const session = DB.getSession();
    if (!session) return; // not logged in -> don't show widget

    try {
      await ensureChartJs();
    } catch (e) {
      console.warn('charts_widget: failed to load Chart.js', e);
      return;
    }

    const widget = createWidget();
    renderMiniCharts(session.id);

    // Re-render on storage change (roughly detect other tabs updates)
    window.addEventListener('storage', (e) => {
      if (e.key === 'ht_health_data') renderMiniCharts(session.id);
    });

    // Also listen for same-tab updates via a custom event
    window.addEventListener('ht_data_updated', (e) => {
      const s = DB.getSession();
      if (s) renderMiniCharts(s.id);
    });
  });
})();
