import { listTracks, listPilots, replaceWeeklyScores, listWeeklyScoresBySeason } from './database.js';
import { getLeagueLeaderboard } from './league.js';
import { normalizeText, parsePositiveInteger } from '../utils/normalize.js';
import { createHttpError } from '../utils/http.js';
import { getIsoWeekInfo } from '../utils/date.js';

const POINTS_BY_POSITION = [10, 9, 8, 7, 6, 5, 4, 3, 2];

function pointsForPosition(position) {
  return POINTS_BY_POSITION[position - 1] ?? 1;
}

function buildPilotKey(row) {
  if (Number.isFinite(Number(row.user_id)) && Number(row.user_id) > 0) {
    return `user:${Number(row.user_id)}`;
  }
  return `name:${normalizeText(row.playername)}`;
}

function sanitizeWeekKey(input, fallback) {
  const value = String(input || fallback || '').trim().toUpperCase();
  return /^\d{4}-W\d{2}$/.test(value) ? value : fallback;
}

function buildPilotLookup(pilots) {
  const byUserId = new Map();
  const byName = new Map();

  for (const pilot of pilots) {
    const userId = Number(pilot.user_id);
    if (Number.isFinite(userId) && userId > 0) {
      byUserId.set(userId, pilot);
    }

    const nameKey = normalizeText(pilot.name);
    if (nameKey) {
      byName.set(nameKey, pilot);
    }
  }

  return { byUserId, byName };
}

function pickPilotRecord(row, lookup) {
  const userId = Number(row.user_id);
  if (Number.isFinite(userId) && userId > 0 && lookup.byUserId.has(userId)) {
    return lookup.byUserId.get(userId);
  }

  const nameKey = normalizeText(row.playername);
  if (nameKey && lookup.byName.has(nameKey)) {
    return lookup.byName.get(nameKey);
  }

  return null;
}

function buildWeeklySummary(trackBreakdowns) {
  const summary = new Map();

  for (const trackEntry of trackBreakdowns) {
    for (const row of trackEntry.results) {
      const key = row.pilot_key;
      const current = summary.get(key) || {
        pilot_key: key,
        pilot_name: row.playername,
        user_id: Number(row.user_id) || null,
        country: row.country || '',
        total_points: 0,
        scored_tracks: 0,
        breakdown: []
      };

      current.pilot_name = current.pilot_name || row.playername;
      current.country = current.country || row.country || '';
      current.total_points += row.points;
      current.scored_tracks += 1;
      current.breakdown.push({
        track_name: trackEntry.track.name,
        laps: trackEntry.track.laps,
        points: row.points,
        position: row.position,
        lap_time: row.lap_time
      });
      summary.set(key, current);
    }
  }

  return Array.from(summary.values())
    .sort((left, right) => {
      if (right.total_points !== left.total_points) return right.total_points - left.total_points;
      return (left.pilot_name || '').localeCompare(right.pilot_name || '', 'es');
    })
    .map((row, index) => ({
      position: index + 1,
      ...row
    }));
}

export async function getWeeklyRankingPreview() {
  const tracks = await listTracks({ activeOnly: true });
  if (!tracks.length) {
    return {
      season_year: getIsoWeekInfo().seasonYear,
      week_key: getIsoWeekInfo().weekKey,
      tracks: [],
      summary: [],
      meta: {
        active_track_count: 0,
        expected_track_count: 2,
        message: 'No hay tracks activos para calcular el ranking semanal.'
      }
    };
  }

  const trackBreakdowns = [];
  for (const track of tracks) {
    const leaderboard = await getLeagueLeaderboard({
      query: track.is_official
        ? { track_id: track.track_id, laps: track.laps }
        : { online_id: track.online_id, laps: track.laps }
    });

    const results = (leaderboard.results || []).map((row) => ({
      ...row,
      pilot_key: buildPilotKey(row),
      points: pointsForPosition(row.position)
    }));

    trackBreakdowns.push({
      track: {
        ...track,
        name: track.name || leaderboard.track.name
      },
      meta: leaderboard.meta,
      results
    });
  }

  return {
    season_year: getIsoWeekInfo().seasonYear,
    week_key: getIsoWeekInfo().weekKey,
    tracks: trackBreakdowns,
    summary: buildWeeklySummary(trackBreakdowns),
    meta: {
      active_track_count: tracks.length,
      expected_track_count: 2,
      message: tracks.length === 2
        ? 'Ranking semanal calculado con los 2 tracks activos.'
        : `Se han encontrado ${tracks.length} tracks activos. Lo ideal para la semana es tener 2.`
    }
  };
}

export async function storeCurrentWeekScores({ seasonYear, weekKey } = {}) {
  const weekInfo = getIsoWeekInfo();
  const normalizedSeasonYear = parsePositiveInteger(seasonYear) || weekInfo.seasonYear;
  const normalizedWeekKey = sanitizeWeekKey(weekKey, weekInfo.weekKey);
  const preview = await getWeeklyRankingPreview();

  if (!preview.tracks.length) {
    throw createHttpError(400, 'No hay tracks activos para guardar puntuaciones semanales.');
  }

  const pilots = await listPilots({ activeOnly: false });
  const lookup = buildPilotLookup(pilots);
  const entries = [];

  for (const trackEntry of preview.tracks) {
    const sourceTrack = trackEntry.track;
    if (!sourceTrack.id) {
      throw createHttpError(500, 'El track activo no tiene id de base de datos. Guarda los tracks desde el panel admin.');
    }

    for (const row of trackEntry.results) {
      const pilot = pickPilotRecord(row, lookup);
      entries.push({
        season_year: normalizedSeasonYear,
        week_key: normalizedWeekKey,
        track_uuid: sourceTrack.id,
        track_name: sourceTrack.name,
        track_reference: sourceTrack.is_official ? String(sourceTrack.track_id) : String(sourceTrack.online_id),
        laps: Number(sourceTrack.laps),
        pilot_uuid: pilot?.id || null,
        pilot_user_id: Number.isFinite(Number(row.user_id)) ? Number(row.user_id) : null,
        pilot_name: row.playername || pilot?.name || 'Sin nombre',
        pilot_key: buildPilotKey(row),
        position: Number(row.position),
        points: Number(row.points),
        lap_time: row.lap_time || null,
        lap_time_ms: Number.isFinite(Number(row.lap_time_ms)) ? Number(row.lap_time_ms) : null
      });
    }
  }

  await replaceWeeklyScores({
    seasonYear: normalizedSeasonYear,
    weekKey: normalizedWeekKey,
    trackUuids: preview.tracks.map((item) => item.track.id),
    entries
  });

  const annual = await getAnnualRankingFromDatabase({ seasonYear: normalizedSeasonYear });

  return {
    stored_entries: entries.length,
    season_year: normalizedSeasonYear,
    week_key: normalizedWeekKey,
    weekly: preview,
    annual
  };
}

export async function getAnnualRankingFromDatabase({ seasonYear } = {}) {
  const weekInfo = getIsoWeekInfo();
  const normalizedSeasonYear = parsePositiveInteger(seasonYear) || weekInfo.seasonYear;
  const rows = await listWeeklyScoresBySeason({ seasonYear: normalizedSeasonYear });
  const totals = new Map();

  for (const row of rows) {
    const current = totals.get(row.pilot_key) || {
      pilot_key: row.pilot_key,
      pilot_name: row.pilot_name,
      pilot_user_id: row.pilot_user_id || null,
      total_points: 0,
      scored_tracks: 0,
      weeks: new Set()
    };

    current.pilot_name = current.pilot_name || row.pilot_name;
    current.total_points += Number(row.points) || 0;
    current.scored_tracks += 1;
    current.weeks.add(row.week_key);
    totals.set(row.pilot_key, current);
  }

  const results = Array.from(totals.values())
    .sort((left, right) => {
      if (right.total_points !== left.total_points) return right.total_points - left.total_points;
      return (left.pilot_name || '').localeCompare(right.pilot_name || '', 'es');
    })
    .map((row, index) => ({
      position: index + 1,
      pilot_key: row.pilot_key,
      pilot_name: row.pilot_name,
      pilot_user_id: row.pilot_user_id,
      total_points: row.total_points,
      scored_tracks: row.scored_tracks,
      weeks_played: row.weeks.size
    }));

  return {
    season_year: normalizedSeasonYear,
    results,
    meta: {
      stored_rows: rows.length,
      pilots_ranked: results.length
    }
  };
}
