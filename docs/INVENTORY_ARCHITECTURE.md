# Módulo Inventarios — Arquitectura
> Añadido: 02/04/2026

## Descripción
Gestión de stock de consumibles por propiedad. Permite controlar entradas, salidas y recuentos de materiales, con valoración económica al último precio de entrada.

## Modelos Prisma

### Material
Maestro global de materiales (no ligado a propiedad).
id String uuid pk, name String, description String opcional, type String (limpieza|baño|regalos|otros), unit String (ud|kg|g|l|ml|m|m2|pack|caja|rollo), barcode String unique (auto-generado Code128 formato MAT-00000001), standardPrice Float, minStock Float default 0, isActive Boolean default true, createdAt DateTime now, updatedAt DateTime updatedAt.

### StockMovement
Movimientos de stock por propiedad.
id String uuid pk, propertyId FK Property, materialId FK Material, type String (entrada|salida|recuento), quantity Float (positivo entrada/recuento, negativo salida), unitPrice Float (precio en el momento), notes String opcional, userId FK User, createdAt DateTime now.

## Lógica de negocio
Stock actual = SUM(quantity) de todos los StockMovements de ese material en esa propiedad.
Recuento: ajuste = cantidadObservada - stockActualCalculado, se inserta StockMovement type=recuento con quantity=ajuste.
Valoración: unitPrice del último StockMovement type=entrada para cada material. valorTotal = SUM(stockActual * ultimoPrecioEntrada).
Barcode: Code128, prefijo MAT- + 8 dígitos secuenciales. Endpoint GET /api/materials/:id/barcode devuelve PNG.

## Rol nuevo: inventario
Solo accede a rutas del módulo stock e inventarios. Sin acceso al resto de la app.
Roles completos: admin | gestor | owner | viewer | inventario

## API Endpoints

### Materials
GET /api/materials todos — listar (?type=&isActive=&search=)
GET /api/materials/:id todos — ver material
POST /api/materials admin gestor — crear
PUT /api/materials/:id admin gestor — actualizar
DELETE /api/materials/:id admin — soft delete isActive=false
GET /api/materials/:id/barcode todos — PNG código de barras

### Stock
GET /api/stock/:propertyId todos — stock actual por propiedad
GET /api/stock/:propertyId/movements todos — histórico (?materialId=&type=&from=&to=)
GET /api/stock/:propertyId/valuation todos — valoración económica total
POST /api/stock/movement todos — registrar movimiento individual
POST /api/stock/recount/:propertyId todos — recuento masivo [{materialId, quantity}]

## Frontend — Páginas
/materials — maestro materiales: tabla con filtros, crear/editar modal, botón imprimir barcode
/stock/:propertyId — 3 tabs: Stock Actual | Movimientos | Valoración
/stock/:propertyId/recount — pantalla recuento masivo: lista materiales con campo cantidad observada editable
Formulario movimiento (modal): búsqueda material por nombre o barcode, tipo, cantidad, precio (solo si entrada)

## Dependencias nuevas
bwip-js (backend, genera PNG código de barras)

## i18n
Namespace nuevo: inventory. Traducciones ES/EN para todos los textos del módulo.
