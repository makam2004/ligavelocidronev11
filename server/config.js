import 'dotenv/config';

function asList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function asNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: asNumber(process.env.PORT, 10000),
  adminKey: process.env.ADMIN_KEY || '',
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, ''),
  allowedOrigins: asList(process.env.ALLOWED_ORIGINS),
  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceRole: process.env.SUPABASE_SERVICE_ROLE || ''
  },
  velocidrone: {
    apiUrl: process.env.VELO_API_URL || 'https://velocidrone.co.uk/api/leaderboard',
    apiToken: process.env.VELO_API_TOKEN || '',
    simVersion: process.env.SIM_VERSION || '1.16',
    cacheTtlMs: asNumber(process.env.CACHE_TTL_MS, 10 * 60 * 1000)
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || '',
    allowedChatIds: asList(process.env.TELEGRAM_ALLOWED_CHAT_IDS)
  }
};

export function getConfigSummary() {
  return {
    nodeEnv: config.nodeEnv,
    port: config.port,
    configured: {
      adminKey: Boolean(config.adminKey),
      publicBaseUrl: Boolean(config.publicBaseUrl),
      supabaseUrl: Boolean(config.supabase.url),
      supabaseServiceRole: Boolean(config.supabase.serviceRole),
      veloApiToken: Boolean(config.velocidrone.apiToken),
      telegramBotToken: Boolean(config.telegram.botToken),
      telegramWebhookSecret: Boolean(config.telegram.webhookSecret),
      allowedOrigins: config.allowedOrigins.length,
      telegramAllowedChatIds: config.telegram.allowedChatIds.length
    }
  };
}
