import React from 'react';

export interface Column<T = any> {
  /** Contenido del encabezado (string, nodo o elemento React) */
  header: React.ReactNode;
  /** Contenido de la celda — el <td> lo envuelve DataTable */
  render: (row: T, index: number) => React.ReactNode;
  /** Clases adicionales para el <td> */
  tdClassName?: string;
  /** Clases adicionales para el <th> */
  thClassName?: string;
  /**
   * Clave de ordenación. Si se define junto a onSort, el header se vuelve
   * clicable y muestra el indicador ↑/↓ cuando está activo.
   */
  sortKey?: string;
  /**
   * Si true, los clics en esta celda no propagan el evento al onRowClick.
   * Útil para columnas de checkbox o acciones.
   */
  stopPropagation?: boolean;
}

interface Props<T = any> {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  /** Si se provee, cada fila tiene hover + cursor-pointer */
  onRowClick?: (row: T, index: number) => void;
  /** Renderiza la tarjeta móvil para cada fila (md:hidden) */
  renderCard: (row: T, index: number) => React.ReactNode;
  /** Clave activa de ordenación (controlada por el padre) */
  sortKey?: string;
  /** Dirección de ordenación activa */
  sortDir?: 'asc' | 'desc';
  /** Callback cuando el usuario clica un encabezado sortable */
  onSort?: (key: string) => void;
  /** Mensaje cuando rows está vacío */
  emptyMessage?: string;
}

const TH_BASE = 'text-left px-4 py-3 text-slate-400 font-semibold whitespace-nowrap select-none';
const TH_SORT = 'cursor-pointer hover:text-white transition-colors';

export default function DataTable<T = any>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  renderCard,
  sortKey,
  sortDir,
  onSort,
  emptyMessage = 'Sin datos',
}: Props<T>) {
  if (rows.length === 0) {
    return <div className="text-slate-400 text-center py-20">{emptyMessage}</div>;
  }

  return (
    <>
      {/* ── Desktop ──────────────────────────────────────────────────── */}
      <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              {columns.map((col, i) => {
                const sortable = !!col.sortKey && !!onSort;
                const active = sortable && sortKey === col.sortKey;
                return (
                  <th
                    key={i}
                    onClick={sortable ? () => onSort!(col.sortKey!) : undefined}
                    className={`${TH_BASE} ${col.thClassName ?? ''} ${sortable ? TH_SORT : ''} ${active ? 'text-white' : ''}`}
                  >
                    {col.header}
                    {active && <span className="ml-1 text-emerald-400">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr
                key={getRowKey(row)}
                onClick={onRowClick ? () => onRowClick(row, rowIdx) : undefined}
                className={`border-b border-slate-800 last:border-0 transition-colors ${
                  onRowClick ? 'hover:bg-slate-800/70 cursor-pointer' : ''
                }`}
              >
                {columns.map((col, colIdx) => (
                  <td
                    key={colIdx}
                    onClick={col.stopPropagation ? (e) => e.stopPropagation() : undefined}
                    className={col.tdClassName ?? 'px-4 py-3'}
                  >
                    {col.render(row, rowIdx)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Móvil ────────────────────────────────────────────────────── */}
      <div className="md:hidden space-y-3">
        {rows.map((row, rowIdx) => renderCard(row, rowIdx))}
      </div>
    </>
  );
}
