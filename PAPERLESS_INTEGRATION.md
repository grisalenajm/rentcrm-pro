# Integración Paperless-ngx ↔ RentalSuite

## Descripción

La integración permite que cualquier factura subida a Paperless-ngx con el
correspondent correcto genere automáticamente un **Expense** en RentalSuite,
sin intervención manual.

**Flujo resumido:** factura en Paperless → workflow dispara webhook →
RentalSuite identifica la propiedad por el nombre del correspondent →
crea el Expense con tipo, importe y fecha extraídos del documento.

---

## Requisitos previos

- **Paperless-ngx 5.x** (compatible con versiones anteriores que soporten webhooks)
- Variable de entorno en el `docker-compose.yml` de Paperless:
  ```
  PAPERLESS_WEBHOOKS_ALLOW_INTERNAL_REQUESTS=true
  ```
  Sin esta variable, Paperless bloqueará las llamadas a IPs privadas (192.168.x.x, 10.x.x.x, etc.)
- RentalSuite accesible desde el contenedor de Paperless (misma red Docker o IP alcanzable)

---

## Configuración en RentalSuite

### Dónde encontrar la sección

**Ajustes → pestaña 📦 Paperless**

### Campos

| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| **URL de Paperless** | URL base de tu instancia | `http://192.168.1.154:8004` |
| **API Token** | Token de autenticación (ver más abajo) | `abc123...` |
| **ID Tipo de documento** | ID numérico del Document Type "Factura"/"Invoice" en Paperless | `3` |
| **Secret del webhook** | Cadena aleatoria para validar que el webhook viene de Paperless | `mi_clave_secreta` |
| **URL del webhook** | Generada automáticamente — cópiala en Paperless | `https://tu-rentalsuite/api/paperless/webhook` |

### Cómo obtener el API Token de Paperless

1. Entra en Paperless-ngx como administrador
2. Ve a **Admin → Auth Token** (o `http://tu-paperless/admin/authtoken/token/`)
3. Crea o copia el token del usuario que usará la integración

### Botón "Probar conexión"

Tras guardar URL y Token, usa el botón **🔌 Probar conexión** para verificar
que RentalSuite puede comunicarse con Paperless-ngx.

---

## Configuración de propiedades

Cada propiedad en RentalSuite debe tener un **correspondent** en Paperless
con el **mismo nombre** (los `_` se tratan como espacios, sin distinción de
mayúsculas/minúsculas).

| Nombre de propiedad en RentalSuite | Correspondent válido en Paperless |
|-------------------------------------|-----------------------------------|
| `Alfonso XII` | `Alfonso XII` |
| `Alfonso XII` | `Alfonso_XII` |
| `casa rural pedrera` | `Casa_Rural_Pedrera` |

> **Regla:** `correspondent_name.replace(/_/g, ' ').trim().toLowerCase()`
> debe ser igual a `property.name.replace(/_/g, ' ').trim().toLowerCase()`

---

## Configuración en Paperless-ngx

### Paso 1 — Crear tipo de documento "Invoice" / "Factura"

1. Ve a **Ajustes → Tipos de documento → Añadir**
2. Nombre: `Factura` (o `Invoice` en inglés — ambos son aceptados por RentalSuite)
3. Guarda y anota el **ID numérico** (aparece en la URL: `.../document_types/3/`)
4. Introduce ese ID en el campo **ID Tipo de documento** de RentalSuite

### Paso 2 — Crear correspondents (uno por propiedad)

1. Ve a **Ajustes → Correspondents → Añadir**
2. Crea un correspondent por cada propiedad que quieras sincronizar
3. El nombre debe coincidir con la propiedad en RentalSuite (ver tabla anterior)

### Paso 3 — Crear el Workflow

1. Ve a **Ajustes → Workflows → Añadir**
2. Configura el trigger y las condiciones:

**Trigger:**
- Evento: `Document updated` *(Document added* también funciona)

**Condiciones:**
- Document type **=** `Invoice` / `Factura`
- Tag **does NOT include** `to-be-reviewed`
  *(evita enviar documentos aún pendientes de revisión)*

**Acción — Webhook:**

| Campo | Valor |
|-------|-------|
| URL | `{URL de RentalSuite}/api/paperless/webhook` |
| Method | `POST` |
| Header name | `X-Paperless-Secret` |
| Header value | El mismo secret configurado en RentalSuite |
| Send as JSON | ✅ Activado |

**Parámetros del cuerpo (Body parameters):**

| Clave (Key) | Valor (Value) |
|-------------|---------------|
| `document_type_name` | `{{ document_type }}` |
| `correspondent_name` | `{{ correspondent }}` |
| `original_file_name` | `{{ original_filename }}` |
| `doc_url` | `{{ doc_url }}` |
| `created` | `{{ created }}` |

> ⚠️ Usa siempre la sintaxis `{{ variable }}` (dobles llaves).
> La sintaxis `{{ document.correspondent }}` **no funciona** en este contexto —
> usa `{{ correspondent }}` directamente.

---

## Campo importe

RentalSuite extrae el importe del gasto desde un **Custom Field** de Paperless.

### Crear el Custom Field

1. Ve a **Ajustes → Custom Fields → Añadir**
2. Nombre: `importe` (en minúsculas; RentalSuite busca cualquier campo cuyo
   nombre contenga "importe", sin distinción de mayúsculas)
3. Tipo: `Monetary` o `Float`

### Asociarlo al tipo de documento

En el Document Type "Factura", añade el custom field `importe` para que
aparezca automáticamente en cada documento de ese tipo.

### Rellenar el campo al subir facturas

Al subir o editar una factura, introduce el importe en el campo `importe`.
Si el campo está vacío o el documento no tiene custom fields, el Expense se
creará con `amount = 0` (editable después desde RentalSuite).

---

## Evitar duplicados

RentalSuite almacena el `paperlessDocumentId` en cada Expense creado por
webhook. Si el mismo documento vuelve a disparar el webhook (por ejemplo,
al editarlo en Paperless), **no se creará un Expense duplicado** porque el
ID ya existe en la base de datos.

Para mayor visibilidad, puedes añadir un tag `synced-to-rentalsuite` al
documento en Paperless mediante una acción adicional en el mismo Workflow
(acción "Assign tag" tras la acción Webhook).

---

## Flujo completo

```
1. Usuario sube una factura a Paperless-ngx
         ↓
2. Paperless procesa el documento y detecta:
   - Document type = "Factura" / "Invoice"
   - Tag "to-be-reviewed" ausente
         ↓
3. Workflow dispara el webhook →
   POST {rentalsuite}/api/paperless/webhook
   Headers: X-Paperless-Secret: {secret}
   Body: { document_type_name, correspondent_name, doc_url, created, ... }
         ↓
4. RentalSuite valida el secret
         ↓
5. Comprueba que document_type_name ∈ ["factura", "invoice"]
         ↓
6. Extrae correspondent_name, normaliza (minúsculas, _ → espacio)
   y busca la Property con nombre coincidente
         ↓
7. Extrae document_id de doc_url
   Llama a GET {paperless}/api/documents/{id}/ para obtener metadatos
         ↓
8. Determina el tipo de gasto a partir de los tags del documento:
   agua | luz | internet | limpieza | tasas → "otros" si no hay coincidencia
         ↓
9. Lee el custom field "importe" → amount
         ↓
10. Crea Expense en RentalSuite:
    - propertyId = ID de la propiedad encontrada
    - date = body.created (o doc.created como fallback)
    - type = inferido de tags
    - amount = custom field "importe"
    - notes = "{nombre_archivo} — {url_preview}"
    - paperlessDocumentId = document_id (previene duplicados)
         ↓
11. El Expense aparece en RentalSuite → Gastos de la propiedad
```

---

## Troubleshooting

| Síntoma | Causa probable | Solución |
|---------|---------------|---------|
| Body vacío `{}` en los logs | Parámetros del webhook no configurados | Añadir los parámetros en la acción Webhook con sintaxis `{{ variable }}` |
| `Webhook not sent — blocked` en Paperless | IP privada bloqueada | Añadir `PAPERLESS_WEBHOOKS_ALLOW_INTERNAL_REQUESTS=true` al docker-compose de Paperless |
| `no property found for correspondent_name` | Nombre del correspondent no coincide con la propiedad | Verificar que los nombres coincidan (ignorando `_` y mayúsculas) |
| `document is undefined` o campo vacío | Sintaxis incorrecta en el parámetro | Usar `{{ correspondent }}` en lugar de `{{ document.correspondent }}` |
| `getDocument error 404` | `doc_url` no tiene el formato esperado o document_id no se extrae | Verificar que `doc_url` contenga `/documents/{id}/` en la ruta |
| Expense creado con `amount = 0` | Custom field `importe` vacío o no configurado | Revisar que el campo exista, sea de tipo correcto y esté relleno |
| El webhook llega pero no crea Expense | `document_type_name` no es "Factura" ni "Invoice" | Comprobar el nombre exacto del Document Type en Paperless |
| Se crean Expenses duplicados | *(no debería ocurrir)* | Verificar que `paperlessDocumentId` está guardado correctamente |
| Webhook no llega (sin logs en API) | Paperless no alcanza la IP/puerto de RentalSuite | Verificar red Docker y que `PAPERLESS_WEBHOOKS_ALLOW_INTERNAL_REQUESTS=true` esté activo |

---

---

## English Version

---

# Paperless-ngx ↔ RentalSuite Integration

## Description

This integration allows any invoice uploaded to Paperless-ngx with the correct
correspondent to automatically generate an **Expense** in RentalSuite, without
any manual intervention.

**Summary flow:** invoice in Paperless → workflow fires webhook →
RentalSuite identifies the property by the correspondent name →
creates the Expense with type, amount and date extracted from the document.

---

## Prerequisites

- **Paperless-ngx 5.x** (compatible with earlier versions that support webhooks)
- Environment variable in the Paperless `docker-compose.yml`:
  ```
  PAPERLESS_WEBHOOKS_ALLOW_INTERNAL_REQUESTS=true
  ```
  Without this variable, Paperless will block calls to private IPs (192.168.x.x, 10.x.x.x, etc.)
- RentalSuite reachable from the Paperless container (same Docker network or reachable IP)

---

## RentalSuite Configuration

### Where to find the section

**Settings → 📦 Paperless tab**

### Fields

| Field | Description | Example |
|-------|-------------|---------|
| **Paperless URL** | Base URL of your Paperless instance | `http://192.168.1.154:8004` |
| **API Token** | Authentication token (see below) | `abc123...` |
| **Document Type ID** | Numeric ID of the "Invoice"/"Factura" Document Type in Paperless | `3` |
| **Webhook Secret** | Random string to validate that the webhook comes from Paperless | `my_secret_key` |
| **Webhook URL** | Auto-generated — copy it into Paperless | `https://your-rentalsuite/api/paperless/webhook` |

### How to get the Paperless API Token

1. Log in to Paperless-ngx as an administrator
2. Go to **Admin → Auth Token** (or `http://your-paperless/admin/authtoken/token/`)
3. Create or copy the token for the user that will be used for the integration

### "Test connection" button

After saving the URL and Token, use the **🔌 Test connection** button to verify
that RentalSuite can communicate with Paperless-ngx.

---

## Property Configuration

Each property in RentalSuite must have a **correspondent** in Paperless with
the **same name** (underscores `_` are treated as spaces, case-insensitive).

| Property name in RentalSuite | Valid correspondent in Paperless |
|------------------------------|----------------------------------|
| `Alfonso XII` | `Alfonso XII` |
| `Alfonso XII` | `Alfonso_XII` |
| `casa rural pedrera` | `Casa_Rural_Pedrera` |

> **Rule:** `correspondent_name.replace(/_/g, ' ').trim().toLowerCase()`
> must equal `property.name.replace(/_/g, ' ').trim().toLowerCase()`

---

## Paperless-ngx Configuration

### Step 1 — Create document type "Invoice" / "Factura"

1. Go to **Settings → Document Types → Add**
2. Name: `Invoice` (or `Factura` in Spanish — both are accepted by RentalSuite)
3. Save and note the **numeric ID** (visible in the URL: `.../document_types/3/`)
4. Enter that ID in the **Document Type ID** field in RentalSuite

### Step 2 — Create correspondents (one per property)

1. Go to **Settings → Correspondents → Add**
2. Create one correspondent for each property you want to sync
3. The name must match the property in RentalSuite (see table above)

### Step 3 — Create the Workflow

1. Go to **Settings → Workflows → Add**
2. Configure the trigger and conditions:

**Trigger:**
- Event: `Document updated` *(Document added* also works)

**Conditions:**
- Document type **=** `Invoice` / `Factura`
- Tag **does NOT include** `to-be-reviewed`
  *(prevents sending documents still pending review)*

**Action — Webhook:**

| Field | Value |
|-------|-------|
| URL | `{RentalSuite URL}/api/paperless/webhook` |
| Method | `POST` |
| Header name | `X-Paperless-Secret` |
| Header value | The same secret configured in RentalSuite |
| Send as JSON | ✅ Enabled |

**Body parameters:**

| Key | Value |
|-----|-------|
| `document_type_name` | `{{ document_type }}` |
| `correspondent_name` | `{{ correspondent }}` |
| `original_file_name` | `{{ original_filename }}` |
| `doc_url` | `{{ doc_url }}` |
| `created` | `{{ created }}` |

> ⚠️ Always use the `{{ variable }}` syntax (double curly braces).
> The syntax `{{ document.correspondent }}` **does not work** in this context —
> use `{{ correspondent }}` directly.

---

## Amount Field

RentalSuite extracts the expense amount from a Paperless **Custom Field**.

### Creating the Custom Field

1. Go to **Settings → Custom Fields → Add**
2. Name: `importe` (lowercase; RentalSuite looks for any field whose name
   contains "importe", case-insensitive)
3. Type: `Monetary` or `Float`

### Associating it with the document type

In the "Invoice" Document Type, add the `importe` custom field so that it
appears automatically on each document of that type.

### Filling in the field when uploading invoices

When uploading or editing an invoice, fill in the amount in the `importe`
field. If the field is empty or the document has no custom fields, the Expense
will be created with `amount = 0` (editable afterwards in RentalSuite).

---

## Preventing Duplicates

RentalSuite stores the `paperlessDocumentId` in each Expense created by
webhook. If the same document fires the webhook again (e.g. when editing it
in Paperless), **no duplicate Expense will be created** because the ID
already exists in the database.

For greater visibility, you can add a `synced-to-rentalsuite` tag to the
document in Paperless via an additional action in the same Workflow
(an "Assign tag" action after the Webhook action).

---

## Complete Flow

```
1. User uploads an invoice to Paperless-ngx
         ↓
2. Paperless processes the document and detects:
   - Document type = "Invoice" / "Factura"
   - Tag "to-be-reviewed" absent
         ↓
3. Workflow fires the webhook →
   POST {rentalsuite}/api/paperless/webhook
   Headers: X-Paperless-Secret: {secret}
   Body: { document_type_name, correspondent_name, doc_url, created, ... }
         ↓
4. RentalSuite validates the secret
         ↓
5. Checks that document_type_name ∈ ["factura", "invoice"]
         ↓
6. Extracts correspondent_name, normalizes (lowercase, _ → space)
   and finds the Property with a matching name
         ↓
7. Extracts document_id from doc_url
   Calls GET {paperless}/api/documents/{id}/ to fetch full metadata
         ↓
8. Determines expense type from document tags:
   agua | luz | internet | limpieza | tasas → "otros" if no match
         ↓
9. Reads the "importe" custom field → amount
         ↓
10. Creates Expense in RentalSuite:
    - propertyId = ID of the matched property
    - date = body.created (or doc.created as fallback)
    - type = inferred from tags
    - amount = "importe" custom field
    - notes = "{filename} — {preview_url}"
    - paperlessDocumentId = document_id (prevents duplicates)
         ↓
11. The Expense appears in RentalSuite → Property Expenses
```

---

## Troubleshooting

| Symptom | Likely cause | Solution |
|---------|-------------|---------|
| Empty body `{}` in logs | Webhook parameters not configured | Add parameters in the Webhook action using `{{ variable }}` syntax |
| `Webhook not sent — blocked` in Paperless | Private IP blocked | Add `PAPERLESS_WEBHOOKS_ALLOW_INTERNAL_REQUESTS=true` to Paperless docker-compose |
| `no property found for correspondent_name` | Correspondent name doesn't match property | Verify names match (ignoring `_` and case) |
| `document is undefined` or empty field | Incorrect parameter syntax | Use `{{ correspondent }}` instead of `{{ document.correspondent }}` |
| `getDocument error 404` | `doc_url` format unexpected or document_id not extracted | Verify `doc_url` contains `/documents/{id}/` in the path |
| Expense created with `amount = 0` | `importe` custom field is empty or not configured | Check the field exists, has the correct type and is filled in |
| Webhook arrives but no Expense created | `document_type_name` is not "Factura" or "Invoice" | Check the exact Document Type name in Paperless |
| Duplicate Expenses being created | *(should not happen)* | Verify `paperlessDocumentId` is being saved correctly |
| Webhook never arrives (no API logs) | Paperless can't reach RentalSuite's IP/port | Check Docker network and that `PAPERLESS_WEBHOOKS_ALLOW_INTERNAL_REQUESTS=true` is active |
