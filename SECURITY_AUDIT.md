# RentalSuite — Auditoría de Seguridad
> Fecha: 29/03/2026 | Auditor: Claude Code (security-expert skill)
> Repo: grisalenajm/rentcrm-pro | Rama auditada: develop (58632fc)

---

## Resumen ejecutivo

| Severidad | Total |
|-----------|-------|
| 🔴 CRÍTICA | 1 |
| 🟠 ALTA    | 5 |
| 🟡 MEDIA   | 5 |
| 🔵 BAJA    | 5 |
| **Total**  | **16** |

**Las 3 acciones más urgentes:**
1. **Hacer obligatoria la validación del secret en el webhook de Paperless** — actualmente es opcional si no está configurado, cualquiera puede crear gastos arbitrarios.
2. **Reemplazar `Math.random()` por `crypto.randomBytes()` en `resetPassword`** — generación de contraseñas temporales con PRNG no criptográfico.
3. **Sanitizar HTML en `dangerouslySetInnerHTML`** en ContentEditor — XSS almacenado si el contenido de la BD es manipulado.

---

## FASE 1 — Datos Sensibles en el Repositorio

### ✅ .env files — NO en git (CORRECTO)

Los ficheros `apps/api/.env` y `apps/frontend/.env` **existen en disco pero no están tracked en git**. Se verificó con `git ls-files` y búsqueda en el historial completo (292 commits). El `.gitignore` de la raíz cubre `.env` y `.env.*` correctamente.

### ✅ .gitignore raíz — CORRECTO

Cubre: `.env`, `.env.*` (excluyendo `.env.example`), `node_modules/`, `dist/`, `build/`, `*.db`, `*.log`. Sin hallazgos críticos.

### ⚠️ apps/frontend — .gitignore parcial

El `.gitignore` de `apps/frontend/` solo cubre `node_modules`, `dist`, `dist-ssr` y `*.local`. No cubre explícitamente `.env`. Está protegido por el `.gitignore` raíz, pero si alguien trabaja desde el subdirectorio sin el root `.gitignore` activo, podría committear `apps/frontend/.env`.

**Solución:** Añadir `.env` y `.env.*` en `apps/frontend/.gitignore`.

### ⚠️ apps/api/.env — Prisma Accelerate URL con API key en disco

El fichero `apps/api/.env` (no en git) contiene:
```
DATABASE_URL="prisma+postgres://localhost:51213/?api_key=eyJkYXRhYmFzZVVybCI6..."
```
La API key está base64-encoded e incluye credenciales de la BD de desarrollo. Aunque está ignorada por git, si se hiciera un accidental commit futuro, expondría acceso directo a la BD.

**Severidad:** Informativo (no en git actualmente). Rotar la API key si alguna vez se publicó.

### ✅ Historial git — Sin credenciales commiteadas

Revisión completa del historial con `git log -S 'password'`, `git log -S 'secret'` y búsqueda de `.env` files. No se encontraron credenciales reales en ningún commit.

### ✅ .env.example files — Sin valores reales

Todos los `.env.example` usan `CHANGE_ME` como placeholder. Correcto.

---

## FASE 2 — Vulnerabilidades en el Código

---

### [CRÍTICA] Handlebars con múltiples CVEs críticos (dependencia transitoria)

- **Archivo**: `node_modules/handlebars` (dependencia de `@nestjs/cli` / herramientas dev)
- **Problema**: `handlebars 4.0.0-4.7.8` tiene 3 CVEs críticos: JavaScript Injection via CLI precompiler (GHSA-xjpj-3mr7-gcpf), JavaScript Injection via AST Type Confusion (GHSA-xhpv-hc6g-r9c6), DoS via malformed decorator syntax (GHSA-9cx6-37pm-9jff).
- **Impacto**: Explotable en contexto de compilación/desarrollo. Handlebars **no se usa en el código de aplicación** (confirmado: no hay imports en `apps/api/src/`), solo en tooling de NestJS CLI. El riesgo en runtime de producción es bajo.
- **Solución**: `npm audit fix` para las vulnerabilidades con fix disponible. Para las que requieren `--force` (breaking change en `@nestjs/schematics`), evaluar actualización controlada. En producción Docker, `devDependencies` no se instalan con `npm ci --omit=dev`, mitigando el riesgo.
- **Referencia**: GHSA-xjpj-3mr7-gcpf | CWE-94

---

### ✅ [ALTA] Webhook Paperless sin validación de secret obligatoria — RESUELTO 30/03/2026

- **Archivo**: `apps/api/src/paperless/paperless.controller.ts:35`
- **Problema**: La validación del header `X-Paperless-Secret` era condicional: si `paperlessSecret` era `null`, el webhook aceptaba cualquier petición. Además, la comparación era vulnerable a timing attacks.
- **Impacto**: Cualquiera que conozca la URL del webhook puede enviar peticiones POST falsas que creen o actualicen gastos (`Expense`) en la BD, incluyendo asociación a propiedades reales con importes arbitrarios.
- **Solución**: Hacer obligatorio el secret:
  ```typescript
  if (!org.paperlessSecret) {
    this.logger.warn('Paperless webhook: paperlessSecret no configurado, rechazando');
    return { ok: false, error: 'Webhook secret not configured' };
  }
  if (secret !== org.paperlessSecret) {
    return { ok: false, error: 'Unauthorized' };
  }
  ```
- **Referencia**: CWE-306 | OWASP: A07:2021 – Identification and Authentication Failures

---

### ✅ [ALTA] `Math.random()` en generación de contraseñas temporales — RESUELTO 30/03/2026

- **Archivo**: `apps/api/src/users/users.service.ts:88`
- **Problema**: La función `resetPassword` usa `Math.random()` para generar contraseñas temporales. `Math.random()` es un PRNG no criptográfico; su salida puede ser predecible con suficiente contexto.
- **Impacto**: Un atacante con acceso al timing o seed del proceso Node.js podría predecir contraseñas temporales recién generadas y tomar control de cuentas.
- **Solución**: Reemplazar con `crypto.randomBytes()`:
  ```typescript
  import { randomBytes } from 'crypto';
  const tempPassword = randomBytes(9).toString('base64url').slice(0, 12);
  // O mantener el charset pero con bytes aleatorios:
  const buf = randomBytes(12);
  const tempPassword = Array.from(buf).map(b => chars[b % chars.length]).join('');
  ```
- **Referencia**: CWE-338 | OWASP: A02:2021 – Cryptographic Failures

---

### ✅ [ALTA] XSS almacenado via `dangerouslySetInnerHTML` — RESUELTO 30/03/2026

- **Archivo**: `apps/frontend/src/components/ContentEditor.tsx:129`
- **Problema**: El contenido `globalContent.template` se renderiza directamente como HTML sin sanitización:
  ```tsx
  dangerouslySetInnerHTML={{ __html: globalContent.template }}
  ```
  El contenido proviene de la BD (campo de plantilla de contenido de propiedad), editable por usuarios con roles `admin` o `gestor`.
- **Impacto**: Un usuario con rol `gestor` malintencionado puede inyectar JavaScript en la plantilla que se ejecutará en el navegador de cualquier usuario que vea la misma vista, comprometiendo sesiones, robando tokens o realizando acciones en nombre de la víctima.
- **Solución**: Sanitizar el HTML antes de renderizar usando DOMPurify:
  ```bash
  npm install dompurify @types/dompurify --workspace=apps/frontend
  ```
  ```tsx
  import DOMPurify from 'dompurify';
  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(globalContent.template) }}
  ```
- **Referencia**: CWE-79 | OWASP: A03:2021 – Injection

---

### [ALTA] SSL deshabilitado en llamadas al SES del Ministerio

- **Archivo**: `apps/api/src/bookings/ses.service.ts:250, 306`
- **Problema**: `httpsAgent: new https.Agent({ rejectUnauthorized: false })` deshabilita la verificación del certificado TLS en todas las llamadas al Ministerio.
- **Impacto**: Vulnerable a ataques MITM en la red entre el servidor y el Ministerio. Un atacante en la misma red podría interceptar o modificar los partes SES (datos personales de huéspedes: DNI, fecha nacimiento, dirección).
- **Nota**: Esto está documentado como necesario por el certificado del Ministerio. Aun así, la solución correcta es importar el certificado del Ministerio como CA de confianza, no deshabilitar la verificación.
- **Solución**:
  ```typescript
  import * as fs from 'fs';
  const minCert = fs.readFileSync('/path/to/ministerio-ca.pem');
  httpsAgent: new https.Agent({ ca: minCert })
  ```
  Si el certificado es autofirmado sin CA pública, como mínimo restringir solo a ese host y documentarlo.
- **Referencia**: CWE-295 | OWASP: A02:2021 – Cryptographic Failures

---

### [ALTA] path-to-regexp vulnerable a ReDoS en @nestjs/core

- **Paquete**: `path-to-regexp 8.0.0-8.3.0` (GHSA-j3q9-mxjg-w52f, GHSA-27v5-c462-wpq7)
- **Problema**: Rutas con grupos opcionales secuenciales o múltiples wildcards causan backtracking exponencial en el regex engine, bloqueando el event loop de Node.js.
- **Impacto**: Un atacante puede enviar peticiones HTTP con rutas especialmente crafteadas para causar DoS del servidor API. Exploitable sin autenticación en rutas públicas.
- **Solución**: `npm audit fix --force` para actualizar `@nestjs/core`. Verificar compatibilidad con la versión actual de NestJS antes de aplicar. Alternativamente, actualizar NestJS a la versión que incluye la corrección.
- **Referencia**: GHSA-j3q9-mxjg-w52f | CWE-1333

---

### [MEDIA] Rol `owner` referenciado pero nunca asignable — bypass efectivo de permisos

- **Archivo**: `apps/api/src/expenses/expenses.controller.ts:49,57,66` y `apps/api/src/recurring-expenses/recurring-expenses.controller.ts:51,58,65`
- **Problema**: Los endpoints de creación/edición/borrado de gastos usan `@Roles('admin', 'owner')`, pero el rol `owner` no existe en el sistema (CreateUserDto solo permite `admin|gestor|viewer`). El resultado es que `gestor` no puede gestionar gastos propios de la propiedad, solo `admin`.
- **Impacto**: Lógica de control de acceso inconsistente. Los `gestores` están más restringidos de lo esperado (no pueden crear gastos). Si en el futuro se añade el rol `owner` a la BD directamente, tendría permisos no documentados.
- **Solución**: Decidir la política correcta y hacerla consistente:
  - Si `gestor` debe poder crear gastos: cambiar a `@Roles('admin', 'gestor')`
  - Si el rol `owner` es intencional para el futuro: añadirlo a `CreateUserDto` y documentarlo
- **Referencia**: CWE-284 | OWASP: A01:2021 – Broken Access Control

---

### ✅ [MEDIA] `BookingDetail.tsx` lee token desde `localStorage` (siempre null) — RESUELTO 30/03/2026

- **Archivo**: `apps/frontend/src/pages/BookingDetail.tsx:289-290`
- **Problema**:
  ```typescript
  const token = localStorage.getItem('token'); // SIEMPRE null
  const res = await fetch(`http://${window.location.hostname}:3001/api/contracts/view/${contractId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  ```
  El JWT se gestiona en memoria (`api.ts`), no en localStorage. `token` siempre será `null`, causando petición sin autenticación. Además, la URL hardcodea el puerto `3001` y usa `http://` en lugar de la URL de la API configurada.
- **Impacto**: La vista de contratos falla silenciosamente (la petición se hace sin auth pero la ruta `view/:token` es pública, por lo que puede funcionar). La URL hardcodeada rompe en producción detrás de Nginx.
- **Solución**:
  ```typescript
  const viewContract = async (contractId: string) => {
    const res = await api.get(`/contracts/${contractId}`); // Usa api.ts con auth
    // O abrir directamente la URL pública del contrato si el token existe
    window.open(`${import.meta.env.VITE_API_URL}/api/contracts/view/${contractId}`, '_blank');
  };
  ```
- **Referencia**: CWE-522 | OWASP: A02:2021 – Cryptographic Failures

---

### ✅ [MEDIA] Validación de webhook Paperless: comparación de secret vulnerable a timing attack — RESUELTO 30/03/2026 (incluido en SEC-01)

- **Archivo**: `apps/api/src/paperless/paperless.controller.ts:35`
- **Problema**: `secret !== org.paperlessSecret` usa comparación de strings estándar, que termina en el primer carácter diferente (timing leak).
- **Impacto**: Con suficientes mediciones de tiempo de respuesta, un atacante puede inferir el valor del secret carácter a carácter.
- **Solución**:
  ```typescript
  import { timingSafeEqual } from 'crypto';
  const secretValid = timingSafeEqual(
    Buffer.from(secret || ''),
    Buffer.from(org.paperlessSecret)
  );
  if (!secretValid) return { ok: false, error: 'Unauthorized' };
  ```
- **Referencia**: CWE-208 | OWASP: A02:2021 – Cryptographic Failures

---

### [MEDIA] `signatureImage` sin validación de tamaño ni formato en firma de contratos

- **Archivo**: `apps/api/src/contracts/dto/sign-contract.dto.ts:5`
- **Problema**: `signatureImage` solo tiene `@IsString()`, sin `@MaxLength()` ni validación del prefijo `data:image/`. Aunque el body está limitado a 2MB (main.ts), no hay validación de que sea una imagen base64 válida.
- **Impacto**: Un cliente podría enviar contenido arbitrario que se almacena en la BD y luego se procesa por PDFKit, potencialmente causando errores inesperados o consumo excesivo de memoria.
- **Solución**:
  ```typescript
  @IsString()
  @MaxLength(500000) // ~375KB imagen PNG
  @Matches(/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/]+=*$/)
  signatureImage: string;

  @IsString()
  @MaxLength(200)
  signerName: string;
  ```
- **Referencia**: CWE-20 | OWASP: A03:2021 – Injection

---

### [MEDIA] Sin refresh token implementado — JWT con expiración corta sin renovación

- **Archivo**: `apps/frontend/src/lib/api.ts`, `apps/api/src/auth/auth.module.ts`
- **Problema**: El `.env.example` documenta `JWT_REFRESH_SECRET` y `JWT_REFRESH_EXPIRES_IN=7d`, pero no existe ningún endpoint `POST /auth/refresh` ni lógica de refresh token en el código. El access token de 15 minutos expira y el usuario es expulsado.
- **Impacto**: No hay riesgo de seguridad directo (es más conservador), pero la ausencia de refresh token significa que tokens revocados (por cambio de contraseña) no pueden ser renovados, y el usuario tiene UX degradada. Las variables documentadas en `.env.example` dan expectativa de una feature no implementada.
- **Solución**: O implementar el endpoint `/auth/refresh` con JWT_REFRESH_SECRET, o eliminar `JWT_REFRESH_SECRET`/`JWT_REFRESH_EXPIRES_IN` del `.env.example` para no generar confusión.
- **Referencia**: CWE-613 | OWASP: A07:2021 – Identification and Authentication Failures

---

### [BAJA] `GET /api/` expone endpoint raíz público con información del servidor

- **Archivo**: `apps/api/src/app.controller.ts`
- **Problema**: El endpoint raíz `GET /api/` es `@Public()` y devuelve `"Hello World!"`.
- **Impacto**: Confirma a atacantes que el servidor está activo y es una aplicación NestJS estándar. Exposición mínima de información.
- **Solución**: Eliminar el endpoint o devolver HTTP 404.

---

### [BAJA] Helmet sin Content-Security-Policy personalizada

- **Archivo**: `apps/api/src/main.ts:10`
- **Problema**: `app.use(helmet())` usa la CSP por defecto de Helmet. Para una API REST que sirve PDFs y proxies de documentos Paperless, la CSP por defecto puede ser más permisiva de lo necesario.
- **Impacto**: Menor riesgo, pero sin CSP explícita es difícil auditar qué orígenes están permitidos.
- **Solución**: Configurar Helmet con CSP explícita:
  ```typescript
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
  }));
  ```

---

### [BAJA] `i18next` con `escapeValue: false` en el frontend

- **Archivo**: `apps/frontend/src/i18n/index.ts:334`
- **Problema**: `interpolation: { escapeValue: false }` deshabilita el escape automático de HTML en las variables de i18n. Si alguna variable interpolada proviniera de input del usuario, podría ejecutarse como HTML.
- **Impacto**: Actualmente las variables de traducción son strings estáticos del código, por lo que el riesgo es bajo.
- **Solución**: Dejar `escapeValue: false` solo si es necesario para React (React ya hace escaping), pero documentar que nunca deben interpolarse strings del usuario en claves de traducción.

---

### [BAJA] Body del webhook Paperless logueado en Redis cuando no hay correspondent

- **Archivo**: `apps/api/src/paperless/paperless.controller.ts:50`
- **Problema**:
  ```typescript
  await this.logsService.add('warn', 'Paperless', 'Webhook recibido sin correspondent_name', { body });
  ```
  El body completo del webhook se almacena en Redis. Si Paperless envía datos sensibles en el body, quedan almacenados en los logs.
- **Impacto**: Datos del webhook (nombres de archivos, tipos de documentos, URLs) accesibles a cualquier usuario autenticado via `GET /api/logs`.
- **Solución**: Loguear solo los campos necesarios:
  ```typescript
  await this.logsService.add('warn', 'Paperless', 'Webhook recibido sin correspondent_name', {
    document_type_name: body.document_type_name,
    doc_url: body.doc_url,
  });
  ```

---

### ✅ [BAJA] nodemailer < 8.0.4 vulnerable (npm audit) — RESUELTO 30/03/2026

- **Paquete**: `nodemailer` (fix disponible via `npm audit fix`)
- **Solución**: `npm audit fix` aplicado en la raíz del monorepo el 30/03/2026.

---

## Dependencias con vulnerabilidades (npm audit)

**Total: 28 vulnerabilidades (1 crítica, 12 altas, 14 moderadas, 1 baja)**

| Paquete | Severidad | CVE/Advisory | Notas |
|---------|-----------|--------------|-------|
| handlebars 4.x | CRÍTICA | GHSA-xjpj, GHSA-xhpv, GHSA-9cx6 | Solo en devDeps/tooling |
| path-to-regexp 8.x | ALTA | GHSA-j3q9, GHSA-27v5 | En @nestjs/core runtime |
| hono ≤4.12.6 | ALTA | — | En @prisma/dev |
| flatted ≤3.4.1 | ALTA | GHSA-25h7 | ReDoS en parse() |
| effect <3.20.0 | ALTA | — | En @prisma/config |
| picomatch múltiples | ALTA | GHSA-3v7f, GHSA-c2c7 | Dev tools |
| nodemailer <8.0.4 | Moderada | — | En runtime, fix disponible |
| ajv 7-8.17.1 | Moderada | GHSA-2g4f | En devDeps NestJS CLI |
| lodash 4.x | Moderada | — | Dev tools Prisma |
| file-type 13-21.x | Moderada | GHSA-5v7r, GHSA-j47w | En @nestjs/common |

**Acción recomendada:** `npm audit fix` para las vulnerabilidades con fix disponible (la mayoría). Revisar las que requieren `--force` (breaking change).

---

## Resumen FASE 1 (Datos Sensibles)

| Hallazgo | Estado |
|----------|--------|
| .env files en git | ✅ No detectados |
| Credenciales hardcodeadas en código | ✅ No detectadas |
| .gitignore raíz | ✅ Correcto |
| .gitignore apps/frontend | ⚠️ Parcial (no cubre .env explícitamente) |
| .env.example con valores reales | ✅ Solo CHANGE_ME |
| API key en apps/api/.env (local, no en git) | ℹ️ Informativo |

---

*Generado por auditoría automática — RentalSuite v1.x — 29/03/2026*
