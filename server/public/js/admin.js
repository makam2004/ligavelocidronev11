async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  try {
    return { ok: response.ok, status: response.status, data: JSON.parse(text) };
  } catch {
    return { ok: response.ok, status: response.status, data: { raw: text } };
  }
}

const els = {
  adminKey: document.getElementById('adminKey'),
  trackName: document.getElementById('trackName'),
  laps: document.getElementById('laps'),
  isOfficial: document.getElementById('isOfficial'),
  trackId: document.getElementById('trackId'),
  onlineId: document.getElementById('onlineId'),
  trackActive: document.getElementById('trackActive'),
  officialFields: document.getElementById('officialFields'),
  unofficialFields: document.getElementById('unofficialFields'),
  saveTrack: document.getElementById('saveTrack'),
  saveResult: document.getElementById('saveResult'),
  registerWebhook: document.getElementById('registerWebhook'),
  telegramResult: document.getElementById('telegramResult'),
  reloadStatus: document.getElementById('reloadStatus'),
  healthBox: document.getElementById('healthBox'),
  reloadTracksList: document.getElementById('reloadTracksList'),
  tracksListBody: document.getElementById('tracksListBody')
};

function adminHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-admin-key': els.adminKey.value.trim()
  };
}

function toggleTrackFields() {
  const official = els.isOfficial.checked;
  els.officialFields.classList.toggle('hidden', !official);
  els.unofficialFields.classList.toggle('hidden', official);
}

function setResultBox(element, payload) {
  element.textContent = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
}

async function loadHealth() {
  const [health, telegram] = await Promise.all([
    fetchJson('/api/health'),
    fetchJson('/api/telegram/status')
  ]);

  setResultBox(els.healthBox, {
    health: health.data,
    telegram: telegram.data
  });
}

async function loadTracks() {
  const response = await fetchJson('/api/tracks');
  if (!response.ok) {
    els.tracksListBody.innerHTML = `<tr><td colspan="5" class="error">${response.data.error || 'No se pudieron cargar los tracks.'}</td></tr>`;
    return;
  }

  const tracks = response.data.tracks || [];
  if (!tracks.length) {
    els.tracksListBody.innerHTML = '<tr><td colspan="5" class="muted">No hay tracks guardados todavía.</td></tr>';
    return;
  }

  els.tracksListBody.innerHTML = tracks.map((track) => `
    <tr>
      <td data-label="Nombre">${track.name}</td>
      <td data-label="Tipo">${track.is_official ? 'Oficial' : 'No oficial'}</td>
      <td data-label="Referencia">${track.is_official ? track.track_id : track.online_id}</td>
      <td data-label="Vueltas">${track.laps}</td>
      <td data-label="Activo">${track.active ? 'Sí' : 'No'}</td>
    </tr>
  `).join('');
}

async function saveTrack() {
  const payload = {
    name: els.trackName.value.trim(),
    laps: Number(els.laps.value),
    is_official: els.isOfficial.checked,
    active: els.trackActive.checked,
    track_id: els.isOfficial.checked ? Number(els.trackId.value) : null,
    online_id: els.isOfficial.checked ? null : els.onlineId.value.trim()
  };

  const response = await fetchJson('/api/admin/tracks/upsert', {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify(payload)
  });

  setResultBox(els.saveResult, response.data);
  if (response.ok) {
    await loadTracks();
  }
}

async function registerWebhook() {
  const response = await fetchJson('/api/admin/telegram/register-webhook', {
    method: 'POST',
    headers: adminHeaders()
  });
  setResultBox(els.telegramResult, response.data);
}

els.isOfficial.addEventListener('change', toggleTrackFields);
els.saveTrack.addEventListener('click', saveTrack);
els.registerWebhook.addEventListener('click', registerWebhook);
els.reloadStatus.addEventListener('click', loadHealth);
els.reloadTracksList.addEventListener('click', loadTracks);

document.addEventListener('DOMContentLoaded', async () => {
  toggleTrackFields();
  await loadHealth();
  await loadTracks();
});
