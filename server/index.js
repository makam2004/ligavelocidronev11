import { createApp } from './app.js';
import { config } from './config.js';
import { startTelegramTopAutopostMonitor } from './services/telegram.js';

const app = createApp();

app.listen(config.port, () => {
  console.log(`✅ Servidor escuchando en http://localhost:${config.port}`);
  const monitor = startTelegramTopAutopostMonitor();
  console.log('🤖 Estado monitor Telegram /top:', monitor);
});
