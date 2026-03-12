# Liga Velocidrone · Render + Supabase + Telegram

Este proyecto es una versión **limpia, corregida y lista para evolucionar** de tu app original.

## Qué se ha corregido

- **Una sola web real**: ahora solo existe un frontend en `server/public`.
- **Backend modular**: el servidor ya no está todo mezclado en un único archivo gigante.
- **Admin protegido**: las rutas de escritura usan `ADMIN_KEY` obligatoria.
- **Supabase alineado**: `supabase/schema.sql` ya coincide con lo que espera el backend.
- **Tracks oficiales y no oficiales**: se guardan correctamente sin pisarse entre 1 lap y 3 laps.
- **Telegram preparado**: el bot ya tiene webhook y comandos básicos.
- **Render simplificado**: tienes `render.yaml` para desplegar sin complicarte.

---

## Estructura completa

```text
velocidronev10_fixed/
├── .dockerignore
├── .env.example
├── .gitignore
├── Dockerfile
├── README.md
├── package.json
├── render.yaml
├── scripts/
│   └── smoke-test.mjs
├── server/
│   ├── app.js
│   ├── config.js
│   ├── index.js
│   ├── middleware/
│   │   └── adminAuth.js
│   ├── public/
│   │   ├── admin.html
│   │   ├── index.html
│   │   ├── assets/
│   │   │   └── background.png
│   │   ├── css/
│   │   │   ├── style-home.css
│   │   │   └── style-ui.css
│   │   └── js/
│   │       ├── admin.js
│   │       └── app.js
│   ├── services/
│   │   ├── database.js
│   │   ├── league.js
│   │   └── telegram.js
│   └── utils/
│       ├── http.js
│       ├── leaderboard.js
│       └── normalize.js
└── supabase/
    ├── schema.sql
    └── seed.sql
```

---

## Qué hace cada carpeta

### Raíz del proyecto

- **`.env.example`**: plantilla de variables de entorno.
- **`package.json`**: dependencias y comandos.
- **`render.yaml`**: despliegue recomendado en Render.
- **`Dockerfile`**: opción alternativa si alguna vez quieres desplegar con Docker.
- **`README.md`**: guía del proyecto.

### `server/`

Aquí vive todo el backend y la web estática.

- **`index.js`**: arranca el servidor.
- **`app.js`**: define rutas API y la web.
- **`config.js`**: lee todas las variables de entorno.

#### `server/middleware/`

- **`adminAuth.js`**: comprueba la `ADMIN_KEY`.

#### `server/services/`

- **`database.js`**: conexión y consultas a Supabase.
- **`league.js`**: lógica de tracks y leaderboard.
- **`telegram.js`**: webhook, comandos y llamadas a Telegram.

#### `server/utils/`

- **`http.js`**: manejo de errores y funciones async.
- **`leaderboard.js`**: parseo y formateo de tiempos/leaderboards.
- **`normalize.js`**: helpers de validación y normalización.

#### `server/public/`

Tu web real.

- **`index.html`**: página pública.
- **`admin.html`**: panel admin.
- **`js/app.js`**: lógica de la web pública.
- **`js/admin.js`**: lógica del panel admin.
- **`css/*.css`**: estilos.
- **`assets/background.png`**: fondo visual.

### `supabase/`

- **`schema.sql`**: crea las tablas correctas.
- **`seed.sql`**: datos de ejemplo para empezar.

### `scripts/`

- **`smoke-test.mjs`**: prueba automática básica del servidor.

---

## Variables de entorno

Copia `.env.example` a `.env` y rellena lo siguiente:

### Obligatorio para funcionar de verdad

- `ADMIN_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE`
- `VELO_API_TOKEN`

### Obligatorio si quieres Telegram

- `PUBLIC_BASE_URL`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`

### Opcional

- `TELEGRAM_ALLOWED_CHAT_IDS`
- `ALLOWED_ORIGINS`
- `SIM_VERSION`
- `CACHE_TTL_MS`

---

## Cómo arrancarlo en local

1. Copia el archivo de ejemplo:

   ```bash
   cp .env.example .env
   ```

2. Instala dependencias:

   ```bash
   npm install
   ```

3. Arranca el servidor:

   ```bash
   npm start
   ```

4. Abre:

   - Web pública: `http://localhost:10000/`
   - Panel admin: `http://localhost:10000/admin`

---

## Cómo cargar Supabase

1. Entra en Supabase.
2. Abre el editor SQL.
3. Ejecuta primero `supabase/schema.sql`.
4. Si quieres datos de ejemplo, ejecuta después `supabase/seed.sql`.

---

## Endpoints principales

### Lectura

- `GET /api/health`
- `GET /api/pilots/active`
- `GET /api/tracks`
- `GET /api/tracks/active`
- `GET /api/leaderboard`
- `GET /api/telegram/status`

### Admin (requieren `x-admin-key`)

- `POST /api/admin/tracks/upsert`
- `POST /api/admin/tracks/bulk-upsert`
- `POST /api/admin/telegram/register-webhook`

### Telegram webhook

- `POST /api/telegram/webhook/:secret`

---

## Comandos del bot de Telegram

Una vez configurado el webhook:

- `/ping`
- `/tracks`
- `/leaderboard 1`
- `/leaderboard 3`
- `/lb 1`
- `/lb 3`

---

## Cómo desplegar en Render

### Opción recomendada

Usa `render.yaml`.

1. Sube este proyecto a GitHub.
2. Crea un nuevo servicio en Render usando el repositorio.
3. Render leerá `render.yaml`.
4. Añade las variables secretas que faltan.
5. Despliega.

### Después del despliegue

1. Pon `PUBLIC_BASE_URL` con tu URL real de Render.
2. Abre `/admin`.
3. Pega tu `ADMIN_KEY`.
4. Pulsa **Registrar webhook** para Telegram.

---

## Prueba rápida automática

Puedes lanzar:

```bash
npm run smoke-test
```

Esta prueba verifica:

- arranque del servidor
- carga de la web pública
- carga del panel admin
- protección con `ADMIN_KEY`
- estado del webhook de Telegram

---

## Notas importantes

- El servidor usa la **service role** de Supabase: no la pongas nunca en frontend.
- El frontend no escribe directamente en Supabase: todo pasa por el backend.
- Si no configuras Velocidrone, la web cargará pero el leaderboard no podrá resolverse.
- Si no configuras Telegram, la web y el panel seguirán funcionando.
