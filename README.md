# Liga Velocidrone · versión con ranking semanal y anual

Esta versión deja la app preparada para tres vistas en la web y añade el alta pública de pilotos:

1. **Leaderboard por track**
2. **Ranking semanal** calculado con los tracks activos
3. **Ranking anual** leído desde Supabase
4. **Alta de nuevos pilotos** desde la web pública

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
    admin.html                # panel admin, solo accesible por /admin
    pilot-signup.html         # alta pública de pilotos
    css/
      style-ui.css
      style-home.css
    js/
      app.js
      admin.js
      pilot-signup.js
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

## Alta de nuevos pilotos

En la web pública aparece un botón **Alta de nuevo piloto**.

Flujo:
1. El piloto rellena su `user_id`, nombre y país.
2. La solicitud se guarda en `pilots` con `active = false`.
3. En `/admin` puedes revisar la lista y pulsar **Activar** o **Desactivar**.

Esto evita que un piloto pase a competir directamente sin revisión previa.

## Admin oculto en la web pública

El panel ya no aparece enlazado en la página principal.

- **No hay botón visible de admin en la home**
- El panel sigue existiendo en **`/admin`**
- La protección real la sigue haciendo `ADMIN_KEY` en las rutas admin

## Endpoints añadidos para pilotos

- `POST /api/pilots/register`
- `GET /api/admin/pilots`
- `PATCH /api/admin/pilots/:id/status`

## ¿Hay que cambiar Supabase?

No. Para esta mejora **no necesitas cambiar el esquema**: se reutiliza la tabla `pilots` que ya tenías.


## Cambio reciente: alta pública de pilotos

- El formulario público de alta ya no pide ID manual ni país.
- El sistema genera automáticamente un ID interno al enviar la solicitud.
- La solicitud muestra al usuario el mensaje: `Pendiente de aprobación por el administrador.`
- El país no se pide en el alta porque con la integración actual no hay una lectura fiable del país de un piloto concreto desde Velocidrone en ese momento.
- Para que los tiempos se relacionen bien con la liga, el piloto debe escribir exactamente el mismo nombre que usa en Velocidrone.
