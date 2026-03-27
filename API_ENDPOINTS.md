# RentCRM Pro — API Endpoints

Base URL: `http://192.168.1.123:3001/api`
Autenticación: JWT Bearer token (excepto rutas marcadas como 🔓 público)
Roles: `admin` > `gestor` > `owner` (viewer = solo lectura)

---

## Auth
| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/auth/login` | 🔓 (rate limit: 5/min) | Login → `{ accessToken, user }` o `{ requiresOtp: true, tempToken }` si 2FA activo |
| POST | `/auth/otp/validate` | 🔓 (rate limit: 10/min) | Validar código OTP → `{ accessToken, user }` · Body: `{ tempToken, otpToken }` |

---

## Users
| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/users` | admin | Listar usuarios de la organización |
| GET | `/users/me` | any | Datos del usuario autenticado |
| GET | `/users/:id` | admin | Ver usuario por ID |
| POST | `/users` | admin | Crear usuario |
| PUT | `/users/:id` | admin | Actualizar usuario |
| DELETE | `/users/:id` | admin | Eliminar usuario |
| PUT | `/users/:id/reset-password` | admin | Resetear contraseña |
| POST | `/users/otp/setup` | any | Genera secreto TOTP + QR base64 → `{ secret, qrCode, otpauthUrl }` · Requiere confirmar con `/otp/verify` |
| POST | `/users/otp/verify` | any | Activa el 2FA con el primer código · Body: `{ token: "123456" }` |
| POST | `/users/otp/disable` | any | Desactiva el 2FA (requiere código válido) · Body: `{ token: "123456" }` |

⚠️ Las rutas `/users/otp/*` van **antes** de `/users/:id` para evitar conflictos de enrutado.

---

## Organization
| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/organization` | any | Datos de la organización (SMTP, SES, logo...) |
| PUT | `/organization` | admin | Actualizar organización |
| POST | `/organization/test-smtp` | admin | Probar configuración SMTP |

---

## Clients
| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/clients` | any | Listar clientes (`?search=`) |
| GET | `/clients/:id` | any | Ver cliente |
| POST | `/clients` | admin, gestor | Crear cliente |
| PUT | `/clients/:id` | admin, gestor | Actualizar cliente |
| DELETE | `/clients/:id` | admin | Eliminar cliente (soft delete) |

**CreateClientDto / UpdateClientDto** (todos opcionales excepto firstName, lastName):
`firstName`, `lastName`, `dniPassport`, `nationality`, `birthDate`, `email`, `phone`, `notes`, `language`,
`street`, `city`, `postalCode`, `province`, `country`

---

## Properties
| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/properties` | any | Listar propiedades |
| GET | `/properties/:id` | any | Ver propiedad |
| POST | `/properties` | admin, gestor | Crear propiedad |
| PUT | `/properties/:id` | admin, gestor | Actualizar propiedad |
| DELETE | `/properties/:id` | admin | Eliminar propiedad |

**CreatePropertyDto** (requeridos: name, address, city, province, rooms):
`name`, `address`, `city`, `province`, `postalCode?`, `country?` (ISO alpha-2), `rooms`, `bathrooms?`, `maxGuests?`,
`pricePerNight?`, `status?` (active|maintenance|inactive), `sesCodigoEstablecimiento?`, `photo?` (base64)

---

## Bookings
| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/bookings` | any | Listar reservas (`?propertyId=&clientId=`) |
| GET | `/bookings/:id` | any | Ver reserva (incluye client, property, guests, guestsSes, policeReports, evaluation) |
| POST | `/bookings` | admin, gestor | Crear reserva |
| PUT | `/bookings/:id` | admin, gestor | Actualizar reserva |
| DELETE | `/bookings/:id` | admin, gestor | Cancelar reserva |
| PATCH | `/bookings/:id` | admin, gestor | Actualización parcial (source, notes, etc.) |
| PATCH | `/bookings/:id/status` | admin, gestor | Cambiar estado (valida transiciones) |
| GET | `/bookings/checkin/:token` | 🔓 | Obtener datos checkin por token (con traducciones) |
| POST | `/bookings/checkin/:token` | 🔓 | Completar checkin online |
| POST | `/bookings/:id/checkin/send` | admin, gestor | Enviar email con link de checkin |
| GET | `/bookings/:id/guests-ses` | any | Listar huéspedes SES de reserva |
| POST | `/bookings/:id/guests-ses` | admin, gestor | Añadir huésped SES manualmente |
| DELETE | `/bookings/:id/guests-ses/:guestId` | admin, gestor | Eliminar huésped SES |
| POST | `/bookings/:id/ses/send` | admin, gestor | Enviar parte SES al Ministerio (rate limit: 3/min) |
| GET | `/bookings/:id/ses/xml` | any | Descargar XML del parte SES |
| GET | `/bookings/:id/ses/pdf` | any | Descargar PDF del parte SES |

**CreateBookingDto** (requeridos: clientId, propertyId, checkInDate, checkOutDate, totalAmount):
`clientId`, `propertyId`, `checkInDate`, `checkOutDate`, `totalAmount`, `status?`, `source?` (direct|airbnb|booking|vrbo|manual_block), `externalId?`, `guests?[]` → `{ clientId, role? }`

**CreateBookingGuestSesDto** (requeridos: docType, docNumber, docCountry, firstName, lastName):
`docType` (dni|passport|nie|other), `docNumber`, `docCountry`, `firstName`, `lastName`, `birthDate?`, `phone?`

⚠️ **IMPORTANTE**: Rutas con path fijo (`checkin/:token`) deben ir ANTES de `/:id` en el controlador.

---

## Booking Payments
| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/bookings/:bookingId/payments` | any | Listar pagos de una reserva |
| POST | `/bookings/:bookingId/payments` | admin, gestor | Registrar pago |
| DELETE | `/bookings/:bookingId/payments/:id` | admin, gestor | Eliminar pago |

**CreateBookingPaymentDto** (requeridos: concept, amount, date):
`concept` (fianza|pago_reserva|pago_final|devolucion_fianza), `amount` (negativo para devoluciones), `date` (ISO), `notes?`

Notas:
- `devolucion_fianza` se auto-rellena con el importe negativo de la fianza existente
- La sección "Pagos" en BookingDetail muestra total pagado vs totalAmount de la reserva

---

## PropertyRules (reglas de la casa)
| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/properties/:id/rules` | any | Obtener reglas de la propiedad |
| PUT | `/properties/:id/rules` | admin, gestor | Crear/actualizar reglas |
| POST | `/properties/:id/rules/translate` | admin, gestor | Traducir reglas a todos los idiomas (respeta `translationsEdited`) |

**UpsertPropertyRulesDto**: `baseContent` (texto original), `baseLanguage?` (default "es"), `translations?` (JSON), `translationsEdited?` (string[])

---

## Recurring Expenses (gastos recurrentes)
| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/recurring-expenses` | any | Listar (`?propertyId=`) |
| POST | `/recurring-expenses` | admin, owner | Crear gasto recurrente |
| PUT | `/recurring-expenses/:id` | admin, owner | Actualizar |
| DELETE | `/recurring-expenses/:id` | admin, owner | Eliminar |

**CreateRecurringExpenseDto** (requeridos: propertyId, type, amount, frequency, dayOfMonth, nextRunDate):
`type` (tasas|agua|luz|internet|limpieza|otros), `amount`, `deductible?`, `frequency` (monthly|quarterly|yearly), `dayOfMonth` (1-28), `notes?`, `nextRunDate`

---

## Property Content (contenido público)
| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/property-content` | any | Obtener contenido (`?propertyId=`) |
| PUT | `/property-content` | admin, gestor | Actualizar contenido (`?propertyId=`) |
| GET | `/property-content/documents` | any | Listar documentos (`?propertyId=`) |
| POST | `/property-content/documents` | admin, gestor | Añadir documento (`?propertyId=`) |
| DELETE | `/property-content/documents/:id` | admin, gestor | Eliminar documento |
| PUT | `/property-content/documents/reorder` | admin, gestor | Reordenar documentos |

---

## Evaluations
| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| POST | `/evaluations` | admin, gestor | Crear evaluación de cliente |
| PUT | `/evaluations/:id` | admin, gestor | Actualizar evaluación |
| GET | `/evaluations/client/:clientId` | any | Evaluaciones de un cliente |
| GET | `/evaluations/booking/:bookingId` | any | Evaluación de una reserva |
| GET | `/evaluations/client/:clientId/summary` | any | Resumen: avgScore, totalBookings, totalSpent, bookings[] |

---

## Financials
| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/financials` | any | Listar (`?propertyId=&type=&from=&to=`) |
| GET | `/financials/summary` | any | Resumen anual (`?from=&to=`) |
| GET | `/financials/categories` | any | Categorías de ingresos/gastos |
| POST | `/financials` | admin, gestor | Crear movimiento financiero |
| PUT | `/financials/:id` | admin, gestor | Actualizar movimiento |
| DELETE | `/financials/:id` | admin | Eliminar movimiento |

---

## Expenses (gastos por propiedad)
| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/expenses` | any | Listar gastos (`?propertyId=&year=`) |
| GET | `/expenses/summary` | any | Resumen por año (`?propertyId=`) |
| POST | `/expenses` | admin, owner | Crear gasto |
| PUT | `/expenses/:id` | admin, owner | Actualizar gasto |
| DELETE | `/expenses/:id` | admin, owner | Eliminar gasto |

Tipos de gasto válidos: `tasas`, `agua`, `luz`, `internet`, `limpieza`, `otros`

Campo `deductible` (boolean, default false): si true, el gasto es deducible fiscalmente — se incluye al 100% en el resumen fiscal anual.

---

## Contracts
| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/contracts/templates` | any | Listar plantillas de contrato |
| POST | `/contracts/templates` | admin | Crear plantilla |
| PUT | `/contracts/templates/:id` | admin | Actualizar plantilla |
| DELETE | `/contracts/templates/:id` | admin | Eliminar plantilla |
| GET | `/contracts/sign/:token` | 🔓 | Ver contrato para firma pública |
| POST | `/contracts/sign/:token` | 🔓 | Firmar contrato digitalmente |
| GET | `/contracts/view/:id` | any | Ver contrato renderizado (HTML) |
| GET | `/contracts` | any | Listar contratos (`?bookingId=`) |
| GET | `/contracts/:id` | any | Ver contrato |
| POST | `/contracts` | admin, gestor | Crear contrato desde plantilla |
| POST | `/contracts/:id/send` | admin, gestor | Enviar contrato por email |
| DELETE | `/contracts/:id` | admin, gestor | Cancelar contrato |

⚠️ Rutas con path fijo (`templates`, `sign/:token`, `view/:id`) van ANTES de `/:id`.

---

## iCal (sincronización Airbnb/Booking)
| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/ical/feeds` | admin, gestor | Listar feeds iCal configurados |
| POST | `/ical/feeds` | admin, gestor | Añadir feed iCal |
| DELETE | `/ical/feeds/:id` | admin, gestor | Eliminar feed |
| POST | `/ical/feeds/:id/sync` | admin, gestor | Sincronizar feed manualmente |
| GET | `/ical/export/:propertyId` | any | Exportar calendario propiedad (.ics) |

---

## Excel
| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/excel/export/clients` | any | Exportar clientes .xlsx |
| GET | `/excel/export/bookings` | any | Exportar reservas .xlsx |
| GET | `/excel/export/expenses` | any | Exportar gastos .xlsx |
| GET | `/excel/export/properties` | any | Exportar propiedades .xlsx |
| GET | `/excel/export/nrua` | any | Exportar CSV N2 por propiedad (`?year=YYYY&propertyId=XXX`) |
| GET | `/excel/template/:type` | any | Descargar plantilla importación (clients\|expenses) |
| POST | `/excel/import/clients` | any | Importar clientes desde .xlsx (multipart/form-data, campo: `file`) |
| POST | `/excel/import/expenses` | any | Importar gastos desde .xlsx (multipart/form-data, campo: `file`) |

---

## Paperless-ngx
| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/paperless/webhook` | 🔓 (valida `X-Paperless-Secret`) | Webhook para crear gastos automáticos desde facturas. Filtra por `document_type_name = "Factura"`, busca propiedad por `correspondent` (id numérico = `Property.paperlessCorrespondentId`), infiere tipo de gasto desde tags (`agua\|luz\|internet\|limpieza\|tasas`→`otros`), crea `Expense` con `paperlessDocumentId` y enlace preview en `notes`. |

**Payload de Paperless-ngx:**
```json
{
  "document_id": 123,
  "document_type_name": "Factura",
  "correspondent": 5,
  "original_file_name": "factura_luz_enero.pdf",
  "tags": ["luz", "2026"]
}
```

**Campos nuevos en BD:**
- `Property.paperlessCorrespondentId` (Int?) — vincula propiedad con correspondent de Paperless
- `Expense.paperlessDocumentId` (Int?) — ID del documento en Paperless
- `Expense.paperlessAmount` (Float?) — importe extraído del documento
- `Organization.paperlessSecret` (String?) — secreto para validar el webhook

---

## Logs del sistema
| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/logs` | any | Listar logs (`?limit=200&level=info|warn|error&context=ical|ses|paperless`) |
| DELETE | `/logs` | admin | Limpiar todos los logs |

Detalles:
- Almacenados en Redis (`app:logs`), máximo 500 entradas (LIFO)
- Contextos registrados: `ical` (sync eventos), `ses` (envíos al Ministerio), `paperless` (webhooks)
- Cada entrada: `{ id, level, context, message, details?, createdAt }`
- Sin rate limiting (`@SkipThrottle`)

---

## Roles y permisos (resumen)
| Rol | Acceso |
|-----|--------|
| `admin` | Todo |
| `gestor` | Crear/editar bookings, clients, properties, contracts, SES, checkin |
| `owner` | Gastos propios |
| viewer (sin rol) | Solo lectura (GET) |
