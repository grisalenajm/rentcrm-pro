# Integración SES Hospedajes — RentalSuite

> Real Decreto 933/2021 — Registro de viajeros en establecimientos de hospedaje

## Índice

1. [¿Qué es SES Hospedajes?](#qué-es-ses-hospedajes)
2. [Registro en el Ministerio](#registro-en-el-ministerio)
3. [Obtención de credenciales](#obtención-de-credenciales)
4. [Importar el certificado CA del Ministerio](#importar-el-certificado-ca-del-ministerio)
5. [Configurar la integración en RentalSuite](#configurar-la-integración-en-rentalsuite)
6. [Flujo de envío automático](#flujo-de-envío-automático)
7. [Solución de problemas](#solución-de-problemas)

---

## ¿Qué es SES Hospedajes?

El **Sistema de Hospedajes del Ministerio del Interior** es la plataforma del Gobierno de España que obliga a todos los establecimientos de hospedaje (apartamentos turísticos, hoteles, viviendas de uso turístico, etc.) a comunicar electrónicamente los datos de los viajeros antes de 24 horas desde su llegada.

Base legal: **Real Decreto 933/2021**, de 26 de octubre.

El sistema acepta comunicaciones mediante un **Webservice SOAP/XML** sobre HTTPS con autenticación HTTP Basic. El payload XML se comprime con DEFLATE y se codifica en Base64 antes de enviarse.

### Endpoints

| Entorno | URL |
|---------|-----|
| Pruebas | `https://hospedajes.pre-ses.mir.es/hospedajes-web/ws/v1/comunicacion` |
| Producción | `https://hospedajes.ses.mir.es/hospedajes-web/ws/v1/comunicacion` |

---

## Registro en el Ministerio

1. Accede a [hospedajes.ses.mir.es](https://hospedajes.ses.mir.es) con tu certificado digital o Cl@ve.
2. Registra tu establecimiento como **arrendador** (propietario/gestor).
3. Solicita el **alta como usuario del Webservice**.
4. El Ministerio te asignará:
   - **Usuario WS**: tu NIF/CIF seguido de `WS` (ej.: `12345678AWS`)
   - **Contraseña WS**: generada por el Ministerio
   - **Código de arrendador**: identificador numérico de 10 dígitos
5. Registra cada alojamiento y obtén el **código de establecimiento** para cada uno.

> **Nota:** El entorno de pruebas (`pre-ses`) permite validar la integración sin afectar al sistema real. Úsalo hasta que el Ministerio confirme el alta definitiva.

---

## Obtención de credenciales

Tras el registro recibirás (normalmente por correo o mediante el portal):

| Campo | Descripción | Dónde se usa en RentalSuite |
|-------|-------------|----------------------------|
| Usuario WS | NIF+`WS` | Ajustes → SES Hospedajes → Usuario WS |
| Contraseña WS | Clave del Ministerio | Ajustes → SES Hospedajes → Contraseña WS |
| Código arrendador | ID numérico del gestor | Ajustes → SES Hospedajes → Código Arrendador |
| Código establecimiento | ID de cada alojamiento | Propiedades → Editar → Código SES |

---

## Importar el certificado CA del Ministerio

El Ministerio utiliza certificados SSL emitidos por la **FNMT-RCM** (Fábrica Nacional de Moneda y Timbre). Los navegadores y la mayoría de sistemas operativos modernos confían en esta CA por defecto.

### Entorno de producción

El certificado de `hospedajes.ses.mir.es` está firmado por FNMT-RCM, que Node.js ya incluye en su store de confianza. **No se requiere ninguna configuración adicional.**

### Entorno de pruebas (pre-ses)

El servidor de pruebas puede usar un certificado de CA diferente (interna del Ministerio). Si obtienes un error SSL (`UNABLE_TO_VERIFY_LEAF_SIGNATURE` o similar):

1. Descarga el certificado CA del entorno de pruebas desde el portal SES.
2. Guárdalo como `apps/api/certs/mir-ca.pem` en el repositorio.
3. RentalSuite detecta automáticamente este fichero al arrancar y lo usa para validar la conexión.

```bash
# Ejemplo: exportar el cert desde el navegador (Firefox/Chrome → Ver certificado → Exportar)
# o con openssl:
openssl s_client -connect hospedajes.pre-ses.mir.es:443 -showcerts </dev/null 2>/dev/null \
  | openssl x509 -outform PEM > apps/api/certs/mir-ca.pem
```

> **IMPORTANTE:** RentalSuite **nunca** usa `rejectUnauthorized: false`. La validación SSL es siempre estricta. Si el cert no está en el store del sistema y no se proporciona `mir-ca.pem`, la conexión fallará con un error descriptivo.

---

## Configurar la integración en RentalSuite

### 1. Credenciales de organización

Ve a **Ajustes → SES Hospedajes** y rellena:

- **Usuario WS**: tu NIF seguido de `WS`
- **Contraseña WS**: la clave asignada por el Ministerio
- **Código Arrendador**: los 10 dígitos asignados
- **Entorno**: selecciona «Pruebas» durante las pruebas, luego «Producción»

Pulsa **Probar conexión SES** para verificar que las credenciales son válidas.

### 2. Código de establecimiento por propiedad

En **Propiedades → Editar** de cada alojamiento, rellena el campo **Código SES** con el código de establecimiento que te asignó el Ministerio para ese alojamiento concreto.

### 3. Envío automático al completar el checkin

Cuando un huésped completa el formulario de checkin online, RentalSuite envía automáticamente el parte de viajeros al Ministerio si las credenciales están configuradas. El resultado (lote asignado o error) queda visible en el detalle de la reserva.

### 4. Envío manual

Desde el detalle de cualquier reserva, sección **SES Hospedajes**, puedes:

- Ver el estado del último envío (enviado / error / pendiente)
- Descargar el XML o PDF del parte
- **Reenviar** manualmente si el envío anterior falló
- **Consultar el estado del lote** directamente al Ministerio

---

## Flujo de envío automático

```
Huésped completa checkin online
        ↓
completeCheckin() en BookingsService
        ↓
¿Org tiene sesCodigoArrendador + sesUsuarioWs?
        ↓ sí
SesService.sendToSes() [async, fire-and-forget]
        ↓
Construye XML parte viajeros (buildPartViajeros)
    → Rellena contrato, personas, pago
        ↓
Comprime XML con DEFLATE + codifica Base64
        ↓
POST SOAP al endpoint del Ministerio
        ↓
Guarda en Booking: sesLote, sesStatus, sesError, sesSentAt
        ↓
Si éxito → status booking pasa a 'processed'
Si error → status booking pasa a 'error' + sesError con detalle
```

### Campos del modelo Booking relacionados con SES

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `sesStatus` | String | `enviado` / `error` / `pendiente` |
| `sesLote` | String | Número de lote asignado por el Ministerio |
| `sesError` | String | Mensaje de error si el envío falló |
| `sesSentAt` | DateTime | Timestamp del último intento de envío |

---

## Solución de problemas

| Error | Causa probable | Solución |
|-------|----------------|----------|
| `Credenciales SES incompletas` | Faltan campos en Ajustes | Rellena usuario, contraseña y código arrendador |
| `La propiedad no tiene código SES` | Falta código en la propiedad | Edita la propiedad y añade el Código SES |
| `HTTP 401 / 403` | Credenciales incorrectas | Verifica usuario y contraseña en el portal SES |
| `HTTP 404` | Endpoint incorrecto | Verifica que el entorno seleccionado es correcto |
| `UNABLE_TO_VERIFY_LEAF_SIGNATURE` | CA del Ministerio no reconocida | Descarga el cert CA y guárdalo en `apps/api/certs/mir-ca.pem` |
| `Timeout / ECONNABORTED` | El servidor no responde | Verifica conectividad de red desde el servidor |
| Código de respuesta ≠ 0 | El Ministerio rechaza el parte | Revisa el XML generado; puede faltar un campo obligatorio |

### Verificar la integración paso a paso

```bash
# 1. Comprobar que el certificado CA se cargó
docker logs rentcrm-api | grep "MIR CA"

# 2. Forzar un envío manual desde la API
curl -X POST http://localhost:3001/api/ses/test \
  -H "Authorization: Bearer <token>"

# 3. Ver logs del sistema
curl http://localhost:3001/api/logs?context=ses \
  -H "Authorization: Bearer <token>"
```

---

*Documentación generada para RentalSuite · Integración Real Decreto 933/2021*
