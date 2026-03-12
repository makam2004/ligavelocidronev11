async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();

  try {
    return {
      ok: response.ok,
      status: response.status,
      data: JSON.parse(text)
    };
  } catch {
    return {
      ok: response.ok,
      status: response.status,
      data: { error: text || 'Respuesta no JSON.' }
    };
  }
}

const state = {
  tracks: [],
  selectedTrack: null
};

const elements = {
  tracks: document.getElementById('tracks'),
  trackTitle: document.getElementById('trackTitle'),
  trackSubtitle: document.getElementById('trackSubtitle'),
  tableBody: document.getElementById('tableBody'),
  status: document.getElementById('status'),
  reloadTracks: document.getElementById('reloadTracks')
};

function trackLabel(track) {
  return track.name || (track.is_official ? `Track oficial ${track.track_id}` : `Track no oficial ${track.online_id}`);
}

function renderTitle(track) {
  elements.trackTitle.textContent = trackLabel(track);
  elements.trackSubtitle.textContent = track.is_official
    ? `Track oficial · track_id ${track.track_id} · ${track.laps} lap${track.laps === 3 ? 's' : ''}`
    : `Track no oficial · online_id ${track.online_id} · ${track.laps} lap${track.laps === 3 ? 's' : ''}`;
}

function renderTrackTabs() {
  if (!state.tracks.length) {
    elements.tracks.innerHTML = '<p class="muted">No hay tracks activos todavía.</p>';
    return;
  }

  elements.tracks.innerHTML = `
    <div class="tabs">
      ${state.tracks.map((track, index) => `
        <button class="btn ${state.selectedTrack?.id === track.id || (!state.selectedTrack && index === 0) ? 'active' : 'btn-secondary'}" type="button" data-track-index="${index}">
          ${trackLabel(track)} · ${track.laps} lap${track.laps === 3 ? 's' : ''}
        </button>
      `).join('')}
    </div>
  `;

  elements.tracks.querySelectorAll('[data-track-index]').forEach((button) => {
    button.addEventListener('click', async () => {
      const track = state.tracks[Number(button.dataset.trackIndex)];
      state.selectedTrack = track;
      renderTrackTabs();
      renderTitle(track);
      await loadLeaderboard(track);
    });
  });
}

function renderLeaderboardRows(results) {
  if (!results.length) {
    elements.tableBody.innerHTML = '<tr><td colspan="5" class="muted">No hay tiempos para los pilotos activos de la liga.</td></tr>';
    return;
  }

  elements.tableBody.innerHTML = results.map((row) => `
    <tr>
      <td data-label="#">${row.position}</td>
      <td data-label="Piloto">${row.playername || '-'}</td>
      <td data-label="País">${row.country || '-'}</td>
      <td data-label="Modelo">${row.model_name || '-'}</td>
      <td data-label="Tiempo">${row.lap_time || '-'}</td>
    </tr>
  `).join('');
}

async function loadLeaderboard(track) {
  elements.status.textContent = 'Cargando leaderboard…';
  elements.tableBody.innerHTML = '';

  const query = new URLSearchParams();
  query.set('laps', String(track.laps));
  if (track.is_official) {
    query.set('track_id', String(track.track_id));
  } else {
    query.set('online_id', String(track.online_id));
  }

  const response = await fetchJson(`/api/leaderboard?${query.toString()}`);
  if (!response.ok) {
    elements.status.innerHTML = `<span class="error">Error: ${response.data.error || 'No se pudo cargar el leaderboard.'}</span>`;
    return;
  }

  elements.status.textContent = `Resultados visibles: ${response.data.meta.returned_count}.`;
  renderLeaderboardRows(response.data.results || []);
}

async function loadTracks() {
  elements.status.textContent = 'Cargando tracks activos…';
  const response = await fetchJson('/api/tracks/active');

  if (!response.ok) {
    elements.tracks.innerHTML = `<p class="error">${response.data.error || 'No se pudieron cargar los tracks.'}</p>`;
    elements.status.textContent = 'No se pudo cargar la información.';
    return;
  }

  state.tracks = response.data.tracks || [];
  state.selectedTrack = state.tracks[0] || null;
  renderTrackTabs();

  if (!state.selectedTrack) {
    elements.trackTitle.textContent = 'No hay track activo';
    elements.trackSubtitle.textContent = 'Activa al menos un track desde /admin.';
    elements.tableBody.innerHTML = '<tr><td colspan="5" class="muted">No hay datos disponibles.</td></tr>';
    elements.status.textContent = 'Sin tracks activos.';
    return;
  }

  renderTitle(state.selectedTrack);
  await loadLeaderboard(state.selectedTrack);
}

elements.reloadTracks.addEventListener('click', loadTracks);
document.addEventListener('DOMContentLoaded', loadTracks);
