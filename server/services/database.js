import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';
import { createHttpError } from '../utils/http.js';
import { normalizeText } from '../utils/normalize.js';

export const supabase = config.supabase.url && config.supabase.serviceRole
  ? createClient(config.supabase.url, config.supabase.serviceRole)
  : null;

export function assertSupabase() {
  if (!supabase) {
    throw createHttpError(503, 'Supabase no está configurado. Revisa SUPABASE_URL y SUPABASE_SERVICE_ROLE.');
  }
}

export async function listPilots({ activeOnly = false } = {}) {
  assertSupabase();
  let query = supabase
    .from('pilots')
    .select('id, user_id, name, country, active, created_at, updated_at')
    .order('active', { ascending: false })
    .order('name', { ascending: true });

  if (activeOnly) {
    query = query.eq('active', true);
  }

  const { data, error } = await query;
  if (error) throw createHttpError(500, `Error al leer pilotos: ${error.message}`);
  return data || [];
}

export async function listActivePilots() {
  return listPilots({ activeOnly: true });
}

function generateInternalPilotUserId() {
  return Number(`${Date.now()}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`);
}

export async function findPilotByExactName(name) {
  assertSupabase();
  const normalizedName = normalizeText(name);
  if (!normalizedName) return null;

  const { data, error } = await supabase
    .from('pilots')
    .select('id, user_id, name, country, active, created_at, updated_at')
    .order('created_at', { ascending: true });

  if (error) throw createHttpError(500, `Error al buscar piloto por nombre: ${error.message}`);
  return (data || []).find((pilot) => normalizeText(pilot.name) === normalizedName) || null;
}

export async function registerPendingPilot(payload) {
  assertSupabase();

  const existingPilot = await findPilotByExactName(payload.name);
  if (existingPilot?.active) {
    throw createHttpError(409, 'Ese piloto ya está dado de alta y activo en la liga.');
  }

  if (existingPilot) {
    const { data, error } = await supabase
      .from('pilots')
      .update({
        name: payload.name,
        country: payload.country,
        active: false
      })
      .eq('id', existingPilot.id)
      .select('id, user_id, name, country, active, created_at, updated_at')
      .single();

    if (error) throw createHttpError(500, `Error al actualizar la solicitud del piloto: ${error.message}`);
    return {
      pilot: data,
      created: false,
      updated: true
    };
  }

  const { data, error } = await supabase
    .from('pilots')
    .insert({
      user_id: generateInternalPilotUserId(),
      name: payload.name,
      country: payload.country,
      active: false
    })
    .select('id, user_id, name, country, active, created_at, updated_at')
    .single();

  if (error) throw createHttpError(500, `Error al registrar el piloto: ${error.message}`);
  return {
    pilot: data,
    created: true,
    updated: false
  };
}

export async function updatePilotActiveStatus({ id, active }) {
  assertSupabase();
  const { data, error } = await supabase
    .from('pilots')
    .update({ active })
    .eq('id', id)
    .select('id, user_id, name, country, active, created_at, updated_at')
    .single();

  if (error) throw createHttpError(500, `Error al actualizar el estado del piloto: ${error.message}`);
  return data;
}

export async function listTracks({ activeOnly = false } = {}) {
  assertSupabase();
  let query = supabase
    .from('tracks')
    .select('id, name, scenery_name, is_official, track_id, online_id, laps, active, created_at, updated_at')
    .order('active', { ascending: false })
    .order('laps', { ascending: true })
    .order('name', { ascending: true });

  if (activeOnly) {
    query = query.eq('active', true);
  }

  const { data, error } = await query;
  if (error) throw createHttpError(500, `Error al leer tracks: ${error.message}`);
  return data || [];
}

export async function getFirstActiveTrack({ laps = null } = {}) {
  assertSupabase();
  let query = supabase
    .from('tracks')
    .select('id, name, scenery_name, is_official, track_id, online_id, laps, active, created_at, updated_at')
    .eq('active', true)
    .order('laps', { ascending: true })
    .order('updated_at', { ascending: false })
    .limit(1);

  if (laps) {
    query = query.eq('laps', laps);
  }

  const { data, error } = await query;
  if (error) throw createHttpError(500, `Error al resolver el track activo: ${error.message}`);
  return data?.[0] || null;
}

export async function upsertTrack(payload) {
  assertSupabase();

  const conflictColumns = payload.is_official ? 'track_id,laps' : 'online_id,laps';
  const { data, error } = await supabase
    .from('tracks')
    .upsert(payload, { onConflict: conflictColumns })
    .select('id, name, scenery_name, is_official, track_id, online_id, laps, active, created_at, updated_at');

  if (error) throw createHttpError(500, `Error al guardar track: ${error.message}`);
  return data?.[0] || null;
}

export async function bulkUpsertTracks(entries) {
  const results = [];
  for (const entry of entries) {
    results.push(await upsertTrack(entry));
  }
  return results;
}

export async function replaceWeeklyScores({ seasonYear, weekKey, trackUuids = [], entries = [] }) {
  assertSupabase();

  const uniqueTrackUuids = Array.from(new Set(trackUuids.filter(Boolean)));
  if (uniqueTrackUuids.length) {
    const { error: deleteError } = await supabase
      .from('weekly_points')
      .delete()
      .eq('season_year', seasonYear)
      .eq('week_key', weekKey)
      .in('track_uuid', uniqueTrackUuids);

    if (deleteError) throw createHttpError(500, `Error al limpiar puntuaciones semanales: ${deleteError.message}`);
  }

  if (!entries.length) return [];

  const { data, error } = await supabase
    .from('weekly_points')
    .insert(entries)
    .select('id, season_year, week_key, track_uuid, pilot_name, pilot_key, points, position');

  if (error) throw createHttpError(500, `Error al guardar puntuaciones semanales: ${error.message}`);
  return data || [];
}

export async function listWeeklyScoresBySeason({ seasonYear }) {
  assertSupabase();
  const { data, error } = await supabase
    .from('weekly_points')
    .select('id, season_year, week_key, track_uuid, track_name, track_reference, laps, pilot_uuid, pilot_user_id, pilot_name, pilot_key, position, points, lap_time, lap_time_ms, created_at')
    .eq('season_year', seasonYear)
    .order('week_key', { ascending: true })
    .order('track_name', { ascending: true })
    .order('position', { ascending: true });

  if (error) throw createHttpError(500, `Error al leer puntuaciones anuales: ${error.message}`);
  return data || [];
}

export async function listLeaderboardMonitorState({ trackUuids = [] } = {}) {
  assertSupabase();

  let query = supabase
    .from('leaderboard_monitor_state')
    .select('id, track_uuid, track_name, track_reference, laps, pilot_user_id, pilot_name, pilot_key, best_lap_time, best_lap_time_ms, last_seen_at, created_at, updated_at')
    .order('track_name', { ascending: true })
    .order('pilot_name', { ascending: true });

  const uniqueTrackUuids = Array.from(new Set(trackUuids.filter(Boolean)));
  if (uniqueTrackUuids.length) {
    query = query.in('track_uuid', uniqueTrackUuids);
  }

  const { data, error } = await query;
  if (error) throw createHttpError(500, `Error al leer el estado del monitor de leaderboard: ${error.message}`);
  return data || [];
}

export async function upsertLeaderboardMonitorState(entries = []) {
  assertSupabase();
  if (!entries.length) return [];

  const { data, error } = await supabase
    .from('leaderboard_monitor_state')
    .upsert(entries, { onConflict: 'track_uuid,pilot_key' })
    .select('id, track_uuid, track_name, track_reference, laps, pilot_user_id, pilot_name, pilot_key, best_lap_time, best_lap_time_ms, last_seen_at, created_at, updated_at');

  if (error) throw createHttpError(500, `Error al guardar el estado del monitor de leaderboard: ${error.message}`);
  return data || [];
}
