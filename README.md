# Atlético Deportivo Farallones · App de seguimiento deportivo

App instalable (PWA) para el seguimiento semanal de los jugadores, con tres perfiles y notificaciones al teléfono.
Node.js + Express + PostgreSQL en Render.

## Perfiles
| Perfil | Qué puede hacer |
|---|---|
| **Administración** | Todo: usuarios, categorías, jugadores, vincular acudientes, registrar seguimientos, avisos a toda la escuela. |
| **Profesor** | Ve los jugadores de sus categorías, registra el seguimiento semanal y envía avisos a sus categorías. |
| **Familia** | Ve el seguimiento de sus hijos, su evolución y los avisos. Antes de cada reporte nuevo ve el mensaje informativo. |

## Seguimiento semanal
Asistencia, goles, pases de gol y 12 aspectos en 4 áreas (Técnica, Físico y coordinación, Juego y decisiones, Actitud y valores).
Los niveles se muestran con palabras, no con notas: Iniciando · En proceso · Avanzando · Consolidado · Destacado.
Además: lo mejor de la semana, para seguir trabajando, idea para practicar en casa y comentario del profe.

Cuando el profesor guarda la semana, los acudientes reciben una notificación con el mensaje:
> *Es un reporte informativo para acompañar su proceso, no una calificación.*

## Publicar en Render
1. Sube esta carpeta a un repositorio nuevo de GitHub (por ejemplo `farallones-app`).
2. En Render: **New → Blueprint** y elige el repositorio. Se crean la base de datos `farallones-db` y el servicio `farallones-app`.
3. Render te pedirá estos valores:
   - `ADMIN_EMAIL`: correo del director para ingresar (ej. `director@farallones.co`)
   - `ADMIN_PASSWORD`: contraseña inicial del director (cámbiala luego desde Perfil)
   - `CONTACT_EMAIL`: correo de contacto para las notificaciones push
4. Al arrancar, el servidor crea las tablas, las categorías iniciales, el usuario administrador y las llaves de notificación (se guardan en la base de datos).
5. Copia la URL de la app (ej. `https://farallones-app.onrender.com`) en el `CONFIG.appUrl` de la landing.

> El plan gratuito de Render "duerme" el servicio tras 15 minutos sin uso (el primer ingreso tarda ~1 minuto)
> y la base de datos gratuita vence a los 30 días. Para uso real conviene el plan Starter en ambos.

## Primeros pasos en la app
1. Ingresa como administrador → **Gestión → Usuarios**: crea los profesores y las familias (el botón comparte el acceso por WhatsApp).
2. **Gestión → Categorías**: asigna un profesor a cada categoría.
3. **Jugadores → Agregar jugador**: elige categoría y marca sus acudientes.
4. Cada persona instala la app en su teléfono y toca **Activar notificaciones**.

## Instalar en el teléfono
- **Android (Chrome):** botón *Instalar app* dentro de la app, o menú ⋮ → *Instalar app*.
- **iPhone (Safari, iOS 16.4+):** Compartir → *Agregar a pantalla de inicio*. En iPhone las notificaciones solo funcionan con la app instalada.

## Trabajar en local
```bash
cp .env.example .env    # y completa DATABASE_URL
npm install
npm run dev             # http://localhost:3000
```

## Estructura
```
server.js            API, roles, notificaciones push
db/schema.sql        Tablas (se crean solas al arrancar)
public/              App instalable: index.html, app.js, styles.css, sw.js, manifest, íconos
render.yaml          Blueprint de Render (base de datos + servicio web)
```
