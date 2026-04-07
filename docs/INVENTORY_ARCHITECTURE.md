# RentalSuite — Arquitectura Módulo Inventarios
> Actualizado 05/04/2026

## Visión general
Módulo de gestión de stock por propiedad. Incluye maestro de materiales, movimientos de entrada/salida/recuento y valoración al último precio de entrada.

## Modelos de datos

### Material
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
```

### StockMovement
```prisma
model StockMovement {
  id         String   @id @default(uuid())
  propertyId String
  materialId String
  type       String   // entrada|salida|recuento
  quantity   Float    // positivo entrada/recuento ajuste, negativo salida
  unitPrice  Float    // último precio de entrada para salidas, introducido para entradas
  notes      String?
  userId     String
  createdAt  DateTime @default(now())
}
```

## Lógica de negocio

- **Stock actual**: suma de todos los `StockMovement.quantity` por `materialId + propertyId`
- **Valoración**: último precio de entrada (`unitPrice` del último `StockMovement` de tipo `entrada`)
- **Salidas**: `unitPrice` se calcula automáticamente desde el último precio de entrada — no editable por el usuario
- **Stock negativo**: el backend rechaza salidas si `quantity > stockActual` con `BadRequestException`
- **Recuento**: ajuste directo al valor real; `quantity` = diferencia (puede ser negativa)
- **Código de barras**: formato `MAT-00000001`, generado automáticamente, renderizado en Code128. Endpoint público (`@Public()`) para imagen del barcode.
- **Alerta stock mínimo**: se activa solo cuando `minStock > 0 && currentStock <= minStock` (minStock=0 no genera alertas)

## Respuesta de GET /api/stock/:propertyId

```ts
{
  materialId: string,
  currentStock: number,
  lastEntryPrice: number,   // último precio de entrada, fallback a standardPrice
  totalValue: number,        // currentStock * lastEntryPrice
  isAlert: boolean,          // minStock > 0 && currentStock <= minStock
  material: {
    name: string,
    type: string,
    unit: string,
    barcode: string,
    minStock: number,
    standardPrice: number,
    isActive: boolean,
  }
}[]
```

## Respuesta de GET /api/stock/:propertyId/valuation

```ts
{
  byType: [{
    type: string,
    materials: [{ materialId, name, unit, currentStock, totalValue, isAlert }],
    subtotal: number,
  }],
  grandTotal: number,
  alertCount: number,
}
```

## API Endpoints

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/materials` | any | Listar materiales (`?search=&type=&isActive=`) |
| POST | `/materials` | admin, gestor, inventario | Crear material |
| PUT | `/materials/:id` | admin, gestor, inventario | Actualizar material |
| DELETE | `/materials/:id` | admin | Desactivar material (soft delete) |
| GET | `/materials/:id/barcode` | 🔓 | Imagen PNG del código de barras |
| GET | `/stock/:propertyId` | any | Stock actual por propiedad (todos los materiales activos) |
| GET | `/stock/:propertyId/movements` | any | Historial movimientos (`?materialId=&type=&from=&to=`) |
| GET | `/stock/:propertyId/valuation` | any | Valoración económica por tipo |
| POST | `/stock/movement` | any | Registrar movimiento individual |
| POST | `/stock/recount/:propertyId` | any | Recuento masivo — body: `{ items: [{materialId, quantity}] }` |

## Frontend — Página única /inventory

### Tab 1 — Master Data
- Tabla de materiales con filtros (nombre/barcode, tipo, estado)
- Acciones: editar, imprimir barcode (`window.open('/api/materials/:id/barcode', '_blank')`), desactivar
- Modal crear/editar material

### Tab 2 — Stock
- Selector de propiedad en la parte superior
- Subtab **Stock Actual**: tabla + banner alertas colapsable (`minStock > 0`) + botón "Registrar movimiento"
- Subtab **Movimientos**: tabla con filtros (material, tipo, fechas)
- Subtab **Valoración**: cards por tipo + total general
- Modal de movimiento: búsqueda por nombre (≥2 chars) o barcode MAT-+Enter

### Tab 3 — Recuento
- Selector de propiedad en la parte superior
- Tabla materiales activos: stock calculado + cantidad observada editable + diferencia (verde/rojo/gris)
- Envío: `POST /api/stock/recount/:propertyId` con `{ items: [{materialId, quantity}] }` — solo ítems con diferencia ≠ 0

## Rol inventario
El rol `inventario` tiene acceso exclusivo al módulo `/inventory`. No puede acceder al resto de la aplicación. Visible en el menú lateral para `admin | gestor | inventario`.

## Dependencias
- `bwip-js` (backend): generación de PNG Code128
