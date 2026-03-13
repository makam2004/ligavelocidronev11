import { bulkUpsertTracks, clearLeaderboardMonitorState, listTracks, setTracksActiveState } from './database.js';
import { storeCurrentWeekScores } from './rankings.js';
import { validateTrackInput } from './league.js';
import { createHttpError } from '../utils/http.js';
import { sendWeeklyTopAndPodiumsToChats } from './telegram.js';

function sanitizeEntries(entries = []) {
  const normalized = Array.isArray(entries) ? entries.map((entry) => validateTrackInput({ ...entry, active: true })) : [];
  if (normalized.length !== 2) {
    throw createHttpError(400, 'Debes enviar exactamente 2 tracks para el cambio semanal.');
  }

  const lapsSet = new Set(normalized.map((entry) => Number(entry.laps)));
  if (lapsSet.size !== normalized.length) {
    throw createHttpError(400, 'Los 2 tracks semanales deben tener vueltas distintas (por ejemplo 1 y 3).');
  }

  return normalized.sort((left, right) => Number(left.laps) - Number(right.laps));
}

export async function replaceWeeklyTracks({ seasonYear, weekKey, entries = [], commitWeek = true, clearMonitorState = true } = {}) {
  const nextEntries = sanitizeEntries(entries);
  const previousActiveTracks = await listTracks({ activeOnly: true });

  let preCommitTelegram = {
    attempted: false,
    sent: false,
    skipped: false,
    reason: null,
    details: null,
    error: null
  };

  let commit = {
    attempted: false,
    committed: false,
    skipped: false,
    reason: null,
    details: null
  };

  if (commitWeek) {
    commit.attempted = true;
    if (previousActiveTracks.length) {
      preCommitTelegram.attempted = true;
      try {
        preCommitTelegram.details = await sendWeeklyTopAndPodiumsToChats();
        preCommitTelegram.sent = true;
      } catch (error) {
        preCommitTelegram.error = error.message || 'No se pudo enviar el resumen previo por Telegram.';
      }

      commit.details = await storeCurrentWeekScores({ seasonYear, weekKey });
      commit.committed = true;
    } else {
      preCommitTelegram.skipped = true;
      preCommitTelegram.reason = 'No había tracks activos previos para anunciar en Telegram.';
      commit.skipped = true;
      commit.reason = 'No había tracks activos previos para cerrar la semana.';
    }
  }

  await setTracksActiveState(false);
  const savedTracks = await bulkUpsertTracks(nextEntries.map((entry) => ({ ...entry, active: true })));

  let clearedMonitorRows = 0;
  if (clearMonitorState) {
    clearedMonitorRows = await clearLeaderboardMonitorState();
  }

  return {
    ok: true,
    message: 'Semana cerrada y tracks semanales actualizados correctamente.',
    previous_active_tracks: previousActiveTracks,
    pre_commit_telegram: preCommitTelegram,
    commit,
    new_active_tracks: savedTracks,
    monitor_state: {
      cleared: Boolean(clearMonitorState),
      deleted_rows: clearedMonitorRows
    }
  };
}
