# Plan: copias de seguridad vía Gmail

Documento vivo del diseño acordado. La persistencia local (IndexedDB / Dexie) **no se reemplaza**.

## Objetivo

Transferir y restaurar el dataset completo entre dispositivos (PC ↔ móvil) usando la cuenta Google del usuario y la Gmail API, sin servidor propio y sin que el usuario manipule JSON/ZIP a mano.

## Estado actual de la app (base)

| Pieza | Ubicación | Notas |
|-------|-----------|--------|
| IndexedDB | `src/db/index.ts` | Dexie, esquema v10 |
| Export/import ZIP | `src/db/backup.ts` | `backup.json` + `files/{id}` |
| Auto-backup local | `src/lib/autoBackup.ts` | Al abrir / visibility |
| Cambios | `src/lib/changeTracker.ts` | `ajustes.lastChangedAt` |
| UI | `src/pages/Ajustes.tsx`, `RestorePanel` | Carpeta / ZIP / JSON |

## Arquitectura objetivo

```
IndexedDB (Dexie)
      ↓
src/db/backup.ts          ← empaquetado local (ZIP)
      ↓
src/backup/*              ← metadatos, checksum, validación, orquestación
      ↓
BackupProvider            ← interfaz abstracta
      ↓
GmailBackupProvider       ← OAuth + Gmail API
```

### Módulos previstos

```
src/backup/
  types.ts
  checksum.ts
  device.ts
  manifest.ts
  validator.ts
  package.ts
  BackupManager.ts        (fases posteriores)
  BackupScheduler.ts      (evoluciona autoBackup)
  BackupRestorer.ts
  provider.ts             (interfaz)

src/google/
  GoogleAuth.ts
  GmailClient.ts
  GmailBackupProvider.ts
```

## Decisiones técnicas

### Formato interno

- Seguir con **ZIP + JSZip** (ya en el proyecto).
- Contenido:
  - `backup.json` — payload de datos (compatible `version: 1`).
  - `files/{adjuntoId}` — blobs.
  - `manifest.json` — metadatos + checksum (desde Fase 1).
- El usuario **nunca** ve ni elige este formato cuando use Gmail.

### Identificación en Gmail

- Asunto: `[MAINTMANAGE_BACKUP] {ISO} {backupId}`
- Búsqueda: `subject:"[MAINTMANAGE_BACKUP]"` (validar en Fase 4).
- API preferida para guardar: `users.messages.insert` (no envía a terceros).

### OAuth (sin servidor)

- **Google Identity Services — Token model** (`initTokenClient`).
- Sin refresh token → hace falta gesto de usuario al renovar (~1 h).
- Authorization code + refresh exige backend → fuera de alcance.

### Límites Gmail (oficiales)

- Mensaje / adjuntos ≈ **25 MB** (antes de encoding).
- Upload API ≈ **35 MiB** MIME raw.
- Scopes Gmail son **sensibles** (verificación Google en producción).
- Si el ZIP supera umbral ~20–22 MB → error claro; plan B futuro: Drive (`BackupProvider`).

### PWA / backup automático

| Estado app | Comportamiento |
|------------|----------------|
| Abierta / visible | Puede ejecutar backup si hay token y hay cambios |
| Segundo plano | No confiar en timers largos |
| Cerrada | Imposible; al reabrir comprobar pendiente |

### Cifrado

- Fase 1–5: **sin cifrado**.
- Fase posterior: AES-GCM + PBKDF2 (Web Crypto), opcional.

### Retención

- Automáticos: conservar últimos N (configurable, p. ej. 10).
- Manuales: no borrar automáticamente.

## Configuración Google (Fase 3+)

1. Crear proyecto en [Google Cloud Console](https://console.cloud.google.com/).
2. Habilitar **Gmail API**.
3. Pantalla de consentimiento OAuth (scopes: `userinfo.email`, `gmail.modify`).
4. Credencial **ID de cliente OAuth** tipo *Aplicación web*.
5. Orígenes JavaScript autorizados: `http://localhost:5173` (dev) y la URL de producción.
6. Copiar `.env.example` → `.env.local` y pegar `VITE_GOOGLE_CLIENT_ID=...`.
7. Reiniciar `npm run dev`.

En desarrollo, añade tu Gmail como usuario de prueba si la app está en modo Testing.

## Fases

### Fase 1 — Modelo de backup ✅

- [x] Tipos `BackupMetadata` / manifest (`src/backup/*`)
- [x] SHA-256 del contenido (`checksum.ts`)
- [x] Validador (`validator.ts`)
- [x] ZIP con `manifest.json` vía `packBackupZip` / `unpackBackupZip`
- [x] Integrado en `exportBackupZip` / import ZIP (`src/db/backup.ts`)
- [x] Pruebas: `npm test` → `src/backup/package.test.ts`
- [x] Sin Gmail (todavía)

### Fase 2 — Empaquetado endurecido ✅

- [x] `packAndVerify` / `verifyRoundTrip` (crear → releer → validar)
- [x] Evaluación de tamaño Gmail (`limits.ts`)
- [x] Snapshot pre-restore en IndexedDB aparte (`snapshot.ts`)
- [x] `replaceWithRollback` integrado en `importBackup` (mode replace)
- [x] Pruebas: `src/backup/phase2.test.ts`
- [x] Sin Gmail (todavía)

### Fase 3 — Google OAuth ✅

- [x] GIS Token model (`src/google/GoogleAuth.ts`) — sin servidor, sin refresh token
- [x] Client ID vía `VITE_GOOGLE_CLIENT_ID` (ver `.env.example`)
- [x] Token solo en memoria; revoke al desconectar
- [x] UI Conectar / Desconectar (`GoogleAccountPanel` en Ajustes → Copia)
- [x] Pruebas: cancelación OAuth, token expirado, disconnect
- [x] Probado en navegador con cuenta de tester

### Fase 4 — Gmail API ✅

- [x] `BackupProvider` + `GmailBackupProvider`
- [x] `messages.insert` (guardar en buzón) / list / attachment get / trash
- [x] Asunto `[MAINTMANAGE_BACKUP] …` + meta en cuerpo
- [x] Rechazo si tamaño > límite Gmail
- [x] UI: Crear copia ahora / Ver copias
- [x] Pruebas unitarias con fetch mock
- [ ] Restaurar desde la lista (Fase 5)

### Fase 5 — Restauración segura ✅

- [x] Lista amigable + «Restaurar esta copia»
- [x] Confirmación explícita antes de sobrescribir
- [x] Descarga → validación (checksum/manifest) → `importBackup` con rollback
- [x] `ensureHorizon` tras restaurar
- [x] Pruebas de flujo `restoreFromGmail`

### Fase 6 — Backup automático

- Scheduler respetando límites PWA
- Skip si mismo checksum

### Fase 7 — UX

- Indicador de estado
- Pantalla de copias
- Errores no técnicos

### Fase 8 (opcional)

- Cifrado
- Drive como fallback de tamaño

## Criterios de aceptación finales

1. PC crea copia → móvil restaura (con imágenes) sin tocar archivos.
2. Móvil → PC igual.
3. Sin explorador de archivos en el flujo Gmail.
4. Offline local intacto si no hay red.

## Riesgos abiertos

1. Backups con muchas fotos > 25 MB.
2. Verificación OAuth de Google para scopes Gmail.
3. Sin refresh token → reautorización periódica.
4. Sin cifrado inicial: el adjunto vive en el buzón del usuario.
