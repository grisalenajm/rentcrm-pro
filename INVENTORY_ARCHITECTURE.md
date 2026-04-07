# Inventario — Arquitectura del Módulo
> Actualizado 07/04/2026 — v1.5.0

## Descripción general

El módulo de inventario gestiona el maestro de materiales y el stock por propiedad. Permite registrar entradas, salidas y recuentos, con valoración al último precio de entrada y alertas de stock mínimo.

---

## Frontend

### Ruta única: `/inventory`

Todo el módulo vive bajo una única ruta `/inventory` con **3 pestañas**:

| Pestaña | Descripción |
|---------|-------------|
| **Master Data** | Lista de materiales activos: nombre, tipo, unidad, precio estándar, stock mínimo, código de barras. Botones Nuevo/Editar (solo admin y gestor). |
| **Stock** | Selector de propiedad → tabla de stock actual por material con valoración al último precio. Botón "Registrar movimiento". |
| **Recuento** | Recuento masivo por propiedad: introduce la cantidad observada para cada material y guarda todos los ajustes de una vez. |

> Las páginas separadas `/materials`, `/stock/:propertyId` y `/stock/:propertyId/recount` **no existen**. Todo está integrado en las pestañas de `/inventory`.

---

## Backend

### Módulos NestJS

| Módulo | Controlador | Descripción |
|--------|-------------|-------------|
| `materials` | `MaterialsController` | CRUD de materiales. Genera barcode `MAT-00000001` automáticamente. |
| `stock` | `StockController` | Movimientos y consulta de stock por propiedad. |

### Endpoints principales

```
# Materiales
GET    /api/materials              — listar materiales activos
POST   /api/materials              — crear material (admin/gestor)
PUT    /api/materials/:id          — editar material (admin/gestor)
DELETE /api/materials/:id          — desactivar material (admin/gestor)

# Stock
GET    /api/stock/:propertyId      — stock actual por propiedad
POST   /api/stock/movement         — registrar movimiento
POST   /api/stock/recount          — recuento masivo (array de ajustes)
```

---

## Modelos de datos

```prisma
model Material {
  id            String   @id @default(uuid())
  name          String
  description   String?
  type          String   // limpieza|baño|regalos|otros
  unit          String   // ud|kg|g|l|ml|m|m2|pack|caja|rollo|paquete|botella|unidad|docena|bolsa|tubo|bote
  barcode       String   @unique // auto-generado MAT-00000001 (Code128)
  standardPrice Float
  minStock      Float    @default(0)
  isActive      Boolean  @default(true)
}

model StockMovement {
  id         String   @id @default(uuid())
  propertyId String
  materialId String
  type       String   // entrada|salida|recuento
  quantity   Float    // positivo entrada/recuento ajuste, negativo salida
  unitPrice  Float    // último precio de entrada para salidas, precio introducido para entradas
  notes      String?
  userId     String
  createdAt  DateTime @default(now())
}
```

### Unidades de medida válidas

`ud` | `kg` | `g` | `l` | `ml` | `m` | `m2` | `pack` | `caja` | `rollo` | `paquete` | `botella` | `unidad` | `docena` | `bolsa` | `tubo` | `bote`

---

## Lógica de negocio

### Cálculo de stock actual

El stock actual de un material en una propiedad se calcula sumando todos sus `StockMovement`:
- `entrada`: `quantity` positivo → suma
- `salida`: `quantity` negativo → resta
- `recuento`: establece el valor absoluto (se calcula la diferencia respecto al stock actual y se guarda como ajuste)

### Valoración al último precio

El valor total del stock de un material se calcula como:

```
stockActual × últimoPrecioEntrada
```

El `unitPrice` de las **salidas** se asigna automáticamente desde el último movimiento de tipo `entrada` para ese material en esa propiedad. No se introduce manualmente.

### Validación de stock negativo

El backend **rechaza** cualquier movimiento de salida donde `quantity > stockActual` con una `BadRequestException`. El stock nunca puede quedar en negativo.

### Generación de código de barras

El barcode se auto-genera en formato `MAT-00000001` (secuencial, zero-padded a 8 dígitos) y es único. El formato es compatible con **Code128** para impresión con lectores estándar.

---

## Roles y permisos

| Rol | Permisos en /inventory |
|-----|------------------------|
| **admin** | Acceso total: crear, editar y desactivar materiales + registrar movimientos + recuentos |
| **gestor** | Igual que admin |
| **owner** | Sin acceso al módulo de inventario |
| **viewer** | Sin acceso al módulo de inventario |
| **inventario** | Ver Master Data, registrar movimientos de stock, hacer recuentos. **NO puede crear ni editar materiales.** Sin acceso al resto de la aplicación. |

El rol `inventario` es exclusivo de este módulo: al iniciar sesión, el usuario es redirigido directamente a `/inventory` y no puede navegar al resto de la app.

---

## Alertas de stock mínimo

Cuando el stock actual de un material en una propiedad cae por debajo de `Material.minStock`, aparece un indicador visual de alerta en la pestaña Stock. La lista de materiales afectados también se muestra en un panel de alertas separado.

---

## Pendiente

- [ ] **Etiquetas de códigos de barras** — página de impresión con grid (imagen barcode + nombre + unidad, CSS print media query)
