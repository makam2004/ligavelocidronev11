# Liga Velocidrone · versión con ranking semanal y anual

Esta versión deja la app preparada para tres vistas en la web:

1. **Leaderboard por track**
2. **Ranking semanal** calculado con los tracks activos
3. **Ranking anual** leído desde Supabase

## Estructura principal

```text
server/
  app.js                      # rutas Express
  config.js                   # variables de entorno
  index.js                    # arranque del servidor
  middleware/
    adminAuth.js              # protección por ADMIN_KEY
  services/
    database.js               # Supabase: pilotos, tracks y weekly_points
    league.js                 # lectura de tiempos Velocidrone
    rankings.js               # puntos semanales y ranking anual
    telegram.js               # webhook de Telegram
  utils/
    date.js                   # cálculo de semana ISO
    http.js                   # errores HTTP
    leaderboard.js            # parser y normalización Velocidrone
    normalize.js             # utilidades de limpieza
  public/
    index.html                # web pública con pestañas
    admin.html                # panel admin
    css/
      style-ui.css
      style-home.css
    js/
      app.js
      admin.js
supabase/
  schema.sql                  # tablas y policies
  seed.sql                    # datos de ejemplo
scripts/
  smoke-test.mjs              # prueba básica local
render.yaml                   # despliegue en Render
Dockerfile                    # despliegue por Docker si lo prefieres
```

## Tablas de Supabase

### `pilots`
Pilotos de tu liga.

### `tracks`
Tracks configurados. Lo normal para una semana es tener **2 tracks activos**.

### `weekly_points`
Guarda los puntos de cada semana para construir el ranking anual.

Cada vez que pulses **Guardar semana** en `/admin`, la app:
- lee los tracks activos,
- calcula los puntos por posición,
- guarda el resultado en `weekly_points`,
- y el ranking anual se recalcula leyendo esa tabla.

## Reparto de puntos

- 1º → 10
- 2º → 9
- 3º → 8
- 4º → 7
- 5º → 6
- 6º → 5
- 7º → 4
- 8º → 3
- 9º → 2
- resto → 1

## Variables de entorno

### Necesarias
- `ADMIN_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE`
- `VELO_API_TOKEN`

### Telegram
- `PUBLIC_BASE_URL`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`

### Opcionales
- `TELEGRAM_ALLOWED_CHAT_IDS`
- `ALLOWED_ORIGINS`
- `SIM_VERSION`
- `CACHE_TTL_MS`
- `PORT`

## Cómo actualizar Supabase

Como ya tienes variables en Render, aquí lo importante es la base de datos:

1. Abre Supabase SQL Editor.
2. Ejecuta `supabase/schema.sql`.
3. Después ejecuta `supabase/seed.sql` solo si quieres datos de ejemplo.

## Cómo guardar una semana

1. Entra en `/admin`
2. Pega tu `ADMIN_KEY`
3. Asegúrate de que tienes los **2 tracks de la semana** marcados como activos
4. Pulsa **Guardar semana**
5. Eso insertará o reemplazará la puntuación de esa semana en `weekly_points`

## Endpoints nuevos

- `GET /api/rankings/weekly`
- `GET /api/rankings/annual?season_year=2026`
- `POST /api/admin/rankings/award-weekly`

## Nota importante

El ranking anual **no se inventa en memoria**: sale de Supabase. Si cambias los tiempos de una semana y vuelves a pulsar **Guardar semana** con la misma `week_key`, esa semana se recalcula y se reemplaza.
