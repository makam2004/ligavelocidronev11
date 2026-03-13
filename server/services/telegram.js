import { config } from '../config.js';
import { listTracks } from './database.js';
import { getLeagueLeaderboard } from './league.js';
import { buildLeaderboardMessage } from '../utils/leaderboard.js';
import { createHttpError } from '../utils/http.js';
import { parseLapCount } from '../utils/normalize.js';

let topAutopostTimer = null;
let topAutopostState = {
  enabled: false,
  intervalMs: 0,
  running: false,
  targetChats: [],
  lastRunAt: null,
  lastRunOk: null,
  lastError: null,
  startedAt: null
};

function telegramApiUrl(method) {
  return `https://api.telegram.org/bot${config.telegram.botToken}/${method}`;
}

function isTelegramConfigured() {
  return Boolean(config.telegram.botToken && config.telegram.webhookSecret);
}

function getBroadcastChatIds() {
  return config.telegram.allowedChatIds.map(String).filter(Boolean);
}

function isAllowedChat(chatId) {
  const allowed = getBroadcastChatIds();
  if (!allowed.length) return true;
  return allowed.includes(String(chatId));
}

function cleanCommand(text) {
  const [command = '', ...args] = String(text || '').trim().split(/\s+/);
  return {
    command: command.replace(/@[^\s]+$/, '').toLowerCase(),
    args
  };
}

function rankEmoji(position) {
  if (position === 1) return '🥇';
  if (position === 2) return '🥈';
  if (position === 3) return '🥉';
  return '🪻';
}

function stripProtocol(url) {
  return String(url || '').replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

function buildTrackSection(track, results) {
  const lines = [`📍 ${track.name}`, ''];

  if (!results.length) {
    lines.push('Sin tiempos registrados todavía.');
    return lines.join('\n');
  }

  const topRows = results.slice(0, 10).map((row) => `${rankEmoji(row.position)} ${row.playername || 'Sin nombre'} — ${row.lap_time || 'sin tiempo'}`);
  return lines.concat(topRows).join('\n');
}

export async function buildTelegramTopMessage() {
  const tracks = await listTracks({ activeOnly: true });
  if (!tracks.length) {
    return 'No hay tracks activos en este momento.';
  }

  const sections = [];
  for (const track of tracks) {
    const leaderboard = await getLeagueLeaderboard({
      query: track.is_official
        ? { track_id: track.track_id, laps: track.laps }
        : { online_id: track.online_id, laps: track.laps }
    });

    sections.push(buildTrackSection(track, leaderboard.results || []));
  }

  const footer = config.publicBaseUrl
    ? `\n\n📊 Consulta los rankings completos en:\n➡️ ${stripProtocol(config.publicBaseUrl)}`
    : '';

  return sections.join('\n\n') + footer;
}

export function getTelegramStatus() {
  return {
    configured: isTelegramConfigured(),
    hasBotToken: Boolean(config.telegram.botToken),
    hasWebhookSecret: Boolean(config.telegram.webhookSecret),
    allowedChats: getBroadcastChatIds(),
    topAutopost: { ...topAutopostState }
  };
}

export async function callTelegram(method, payload) {
  if (!config.telegram.botToken) {
    throw createHttpError(503, 'TELEGRAM_BOT_TOKEN no está configurado.');
  }

  const response = await fetch(telegramApiUrl(method), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw createHttpError(502, 'Telegram API devolvió un error.', data);
  }

  return data;
}

export async function sendTelegramMessage(chatId, text) {
  return callTelegram('sendMessage', {
    chat_id: chatId,
    text,
    disable_web_page_preview: true
  });
}

export async function registerTelegramWebhook() {
  if (!isTelegramConfigured()) {
    throw createHttpError(503, 'Telegram no está totalmente configurado. Faltan TELEGRAM_BOT_TOKEN o TELEGRAM_WEBHOOK_SECRET.');
  }

  if (!config.publicBaseUrl) {
    throw createHttpError(503, 'PUBLIC_BASE_URL es obligatoria para registrar el webhook de Telegram.');
  }

  const webhookUrl = `${config.publicBaseUrl}/api/telegram/webhook/${config.telegram.webhookSecret}`;
  const result = await callTelegram('setWebhook', { url: webhookUrl });
  return {
    webhookUrl,
    telegram: result
  };
}

function buildTracksMessage(tracks) {
  if (!tracks.length) {
    return 'No hay tracks activos en este momento.';
  }

  return [
    '🎯 Tracks activos',
    '',
    ...tracks.map((track) => {
      const ref = track.is_official ? `track_id ${track.track_id}` : `online_id ${track.online_id}`;
      return `• ${track.name} — ${track.laps} lap${track.laps === 3 ? 's' : ''} — ${ref}`;
    })
  ].join('\n');
}

export async function sendTopMessageToChats(chatIds = getBroadcastChatIds()) {
  const targets = Array.from(new Set((chatIds || []).map(String).filter(Boolean)));
  if (!targets.length) {
    throw createHttpError(400, 'No hay chats configurados para enviar /top. Revisa TELEGRAM_ALLOWED_CHAT_IDS.');
  }

  const text = await buildTelegramTopMessage();
  const deliveries = [];

  for (const chatId of targets) {
    await sendTelegramMessage(chatId, text);
    deliveries.push({ chatId, ok: true });
  }

  return {
    chatCount: deliveries.length,
    deliveries,
    text
  };
}

async function runTopAutopostCycle() {
  if (topAutopostState.running) return;
  topAutopostState.running = true;
  topAutopostState.lastRunAt = new Date().toISOString();

  try {
    const result = await sendTopMessageToChats();
    topAutopostState.lastRunOk = true;
    topAutopostState.lastError = null;
    return result;
  } catch (error) {
    topAutopostState.lastRunOk = false;
    topAutopostState.lastError = error.message || 'Error desconocido enviando /top automático.';
    console.error('❌ Error en el monitor automático de Telegram /top:', error);
    return null;
  } finally {
    topAutopostState.running = false;
  }
}

export function startTelegramTopAutopostMonitor() {
  if (topAutopostTimer) {
    return { ...topAutopostState, alreadyStarted: true };
  }

  const targetChats = getBroadcastChatIds();
  const intervalMinutes = Math.max(1, Number(config.telegram.topAutopostIntervalMinutes) || 360);
  const intervalMs = intervalMinutes * 60 * 1000;
  const enabled = Boolean(config.telegram.topAutopostEnabled && config.telegram.botToken && targetChats.length);

  topAutopostState = {
    enabled,
    intervalMs,
    running: false,
    targetChats,
    lastRunAt: null,
    lastRunOk: null,
    lastError: enabled ? null : 'Monitor desactivado o sin chats configurados.',
    startedAt: new Date().toISOString()
  };

  if (!enabled) {
    return { ...topAutopostState };
  }

  topAutopostTimer = setInterval(() => {
    runTopAutopostCycle().catch((error) => {
      console.error('❌ Error inesperado en setInterval del monitor /top:', error);
    });
  }, intervalMs);

  if (typeof topAutopostTimer.unref === 'function') {
    topAutopostTimer.unref();
  }

  if (config.telegram.topAutopostOnBoot) {
    runTopAutopostCycle().catch((error) => {
      console.error('❌ Error en el primer envío automático /top:', error);
    });
  }

  return { ...topAutopostState };
}

export async function handleTelegramUpdate(update) {
  const message = update?.message || update?.edited_message;
  if (!message?.text || !message.chat?.id) {
    return { handled: false, reason: 'No hay mensaje de texto procesable.' };
  }

  if (!isAllowedChat(message.chat.id)) {
    return { handled: false, reason: 'Chat no autorizado.' };
  }

  const { command, args } = cleanCommand(message.text);
  if (!command.startsWith('/')) {
    return { handled: false, reason: 'No es un comando.' };
  }

  if (command === '/ping') {
    await sendTelegramMessage(message.chat.id, '✅ Bot activo y escuchando.');
    return { handled: true, command };
  }

  if (command === '/tracks') {
    const tracks = await listTracks({ activeOnly: true });
    await sendTelegramMessage(message.chat.id, buildTracksMessage(tracks));
    return { handled: true, command, tracks: tracks.length };
  }

  if (command === '/top') {
    const text = await buildTelegramTopMessage();
    await sendTelegramMessage(message.chat.id, text);
    return { handled: true, command };
  }

  if (command === '/leaderboard' || command === '/lb') {
    const requestedLaps = parseLapCount(args[0]) || null;
    const leaderboard = await getLeagueLeaderboard({
      query: requestedLaps ? { laps: requestedLaps } : {}
    });
    await sendTelegramMessage(message.chat.id, buildLeaderboardMessage(leaderboard.track, leaderboard.results));
    return { handled: true, command, laps: requestedLaps || leaderboard.track.laps };
  }

  await sendTelegramMessage(
    message.chat.id,
    'Comandos disponibles:\n/ping\n/tracks\n/top\n/leaderboard 1\n/leaderboard 3\n/lb 1\n/lb 3'
  );
  return { handled: true, command: '/help' };
}
