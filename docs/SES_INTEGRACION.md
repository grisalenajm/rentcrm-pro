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
| Pruebas | `https://hospedajes.pre-ses.mir.es/hospedajes-web/ws/comunicacion` |
| Producción | `https://hospedajes.ses.mir.es/hospedajes-web/ws/comunicacion` |

> **IMPORTANTE:** Las URLs **no** llevan `/v1/` — ese segmento no existe en la API del Ministerio y provoca un HTTP 404.

### Namespace SOAP

El namespace correcto para la operación SOAP es (API v3.1.3):

```
xmlns:com="http://www.soap.servicios.hospedajes.mir.es/comunicacion"
```

> **NUNCA** usar `xmlns:com="http://hospedajes.ses.mir.es/"` — ese namespace incorrecto también provoca HTTP 404.

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

El Ministerio utiliza certificados SSL emitidos por la **FNMT-RCM** (Fábrica Nacional de Moneda y Timbre). Node.js no incluye la CA FNMT en su bundle de confianza por defecto, por lo que es necesario importarla manualmente.

### Obtención de los certificados FNMT

La cadena de confianza completa se compone de dos certificados:

```bash
# 1. Descargar CA subordinada (FNMT Componentes Administración Pública)
curl -o /tmp/ACCOMP.crt http://www.cert.fnmt.es/certs/ACCOMP.crt

# 2. Descargar CA raíz (FNMT-RCM Clase 2 CA)
curl -o /tmp/ACRAIZFNMTRCM.crt http://www.cert.fnmt.es/certs/ACRAIZFNMTRCM.crt

# 3. Convertir de DER a PEM
openssl x509 -inform DER -in /tmp/ACCOMP.crt -out /tmp/ACCOMP.pem
openssl x509 -inform DER -in /tmp/ACRAIZFNMTRCM.crt -out /tmp/ACRAIZFNMTRCM.pem

# 4. Concatenar en la cadena completa que usa RentalSuite
cat /tmp/ACCOMP.pem /tmp/ACRAIZFNMTRCM.pem > certs/mir-ca.pem
```

El fichero resultante `certs/mir-ca.pem` debe estar en la raíz del repositorio.

### Montar el volumen en Docker (producción)

En `docker-compose.prod.yml`, el directorio `certs/` se monta como volumen de solo lectura en el contenedor de la API:

```yaml
# docker-compose.prod.yml — servicio api
volumes:
  - ./certs:/app/certs:ro
```

> **IMPORTANTE:** El fichero `certs/mir-ca.pem` **no debe incluirse en la imagen Docker** (es un secreto de despliegue). Solo se monta en producción. El `.gitignore` de `certs/` debe excluir únicamente los ficheros de clave privada, no los certificados públicos.

### Cómo usa RentalSuite el certificado

Al arrancar, `SesService` intenta cargar `certs/mir-ca.pem`. Si existe, lo usa como CA de confianza para todas las llamadas al Ministerio. Si no existe, usa el store del sistema (que no incluye FNMT → fallará con `UNABLE_TO_VERIFY_LEAF_SIGNATURE`).

> **RentalSuite NUNCA usa `rejectUnauthorized: false`.** La validación SSL es siempre estricta.

### Entorno de pruebas (pre-ses)

El servidor de pruebas usa la misma cadena FNMT. El mismo `certs/mir-ca.pem` es válido para ambos entornos.

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

### Curl de prueba directo al Ministerio

Útil para verificar credenciales y conectividad sin pasar por RentalSuite:

```bash
# Sustituye USUARIO_WS, PASSWORD_WS y CODIGO_ARRENDADOR con tus valores reales
curl -s \
  -u 'USUARIO_WS:PASSWORD_WS' \
  --cacert certs/mir-ca.pem \
  -H 'Content-Type: text/xml; charset=UTF-8' \
  -H 'SOAPAction: comunicacion' \
  -d '<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:com="http://www.soap.servicios.hospedajes.mir.es/comunicacion">
  <soapenv:Header/>
  <soapenv:Body>
    <com:comunicacion>
      <peticion>
        <cabecera>
          <arrendador>CODIGO_ARRENDADOR</arrendador>
          <aplicacion>RentalSuite</aplicacion>
          <tipoOperacion>C</tipoOperacion>
          <tipoComunicacion>PV</tipoComunicacion>
        </cabecera>
        <solicitud></solicitud>
      </peticion>
    </com:comunicacion>
  </soapenv:Body>
</soapenv:Envelope>' \
  https://hospedajes.ses.mir.es/hospedajes-web/ws/comunicacion

# Respuesta esperada: <codigo>0</codigo> = credenciales válidas y conexión OK
# Si recibes HTTP 404: verifica que la URL no lleva /v1/ y que el namespace SOAP es correcto
# Si recibes HTTP 401: verifica usuario y contraseña
```

---

*Documentación generada para RentalSuite · Integración Real Decreto 933/2021*
