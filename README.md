# MaintManage

PWA de mantenimiento preventivo y reparaciones. Corre **en el navegador, sin servidor y sin internet** después de la primera carga. Los datos se guardan en IndexedDB del dispositivo.

## Probar en local

```bash
npm install
npm run dev
```

Abre la URL que muestre Vite. En el móvil de la misma red puedes usar esa IP si el firewall lo permite; para una prueba real conviene el despliegue en GitHub Pages (HTTPS, cámara e instalación).

## Publicar en GitHub Pages

1. Crea un repositorio y súbelo (`git push`).
2. En el repo: **Settings → Pages → Source: GitHub Actions**.
3. Cada push a `main` construye y publica.
4. URL típica: `https://<usuario>.github.io/maintmanage/`
5. En el móvil: abre el enlace → menú → **Añadir a pantalla de inicio**.

La app se instala y, tras la primera visita, funciona offline.

## Datos entre PC y móvil

GitHub Pages solo sirve el programa, no tus fichas. En **Ajustes** exporta un ZIP e impórtalo en el otro navegador (reemplazar o fusionar).

## Recordatorios

Los avisos saltan **al abrir la app** (si diste permiso), no con la app cerrada: eso exigiría un servidor de push.

## Stack

Vite, React, TypeScript, Dexie (IndexedDB), Workbox PWA, JSZip para copias de seguridad.
