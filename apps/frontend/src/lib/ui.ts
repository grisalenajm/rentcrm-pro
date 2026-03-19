// ─────────────────────────────────────────────────────────────────────────────
// Tokens UI centralizados — RentalSuite
// Importar desde aquí en lugar de definir constantes locales en cada página.
// ─────────────────────────────────────────────────────────────────────────────
import type React from 'react';

// ── Booking status ────────────────────────────────────────────────────────────

export const bookingStatusConfig: Record<string, { label: string; color: string }> = {
  created:    { label: 'Creada',     color: 'bg-amber-500/10 text-amber-400' },
  registered: { label: 'Registrada', color: 'bg-blue-500/10 text-blue-400' },
  processed:  { label: 'Procesada',  color: 'bg-emerald-500/10 text-emerald-400' },
  error:      { label: 'Error',      color: 'bg-red-500/10 text-red-400' },
  cancelled:  { label: 'Cancelada',  color: 'bg-slate-500/10 text-slate-400' },
};

/** Solo los colores de badge para booking status */
export const bookingStatusColor: Record<string, string> = Object.fromEntries(
  Object.entries(bookingStatusConfig).map(([k, v]) => [k, v.color])
);

export const bookingStatusTransitions: Record<string, string[]> = {
  created:    ['registered', 'cancelled'],
  registered: ['processed', 'error', 'cancelled'],
  error:      ['registered', 'processed', 'cancelled'],
  processed:  [],
  cancelled:  [],
};

/** Colores de botón de transición de estado */
export const bookingStatusBtn: Record<string, string> = {
  registered: 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-300',
  processed:  'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300',
  error:      'bg-red-500/10 hover:bg-red-500/20 text-red-300',
  cancelled:  'bg-slate-700 hover:bg-slate-600 text-slate-300',
};

// ── Contract status ───────────────────────────────────────────────────────────

export const contractStatusColor: Record<string, string> = {
  draft:     'bg-slate-500/10 text-slate-400',
  sent:      'bg-amber-500/10 text-amber-400',
  signed:    'bg-emerald-500/10 text-emerald-400',
  cancelled: 'bg-red-500/10 text-red-400',
};

// ── iCal platform badge ───────────────────────────────────────────────────────

const _platformColors: Record<string, string> = {
  airbnb:  'bg-rose-500/10 text-rose-400',
  booking: 'bg-blue-500/10 text-blue-400',
  other:   'bg-slate-700 text-slate-400',
};

export const platformBadgeColor = (platform: string): string =>
  _platformColors[platform] ?? _platformColors.other;

// ── Badge ─────────────────────────────────────────────────────────────────────

/** Clase base para todos los badges de estado/tipo */
export const badgeCls = 'text-xs font-semibold px-2.5 py-1 rounded-full';

// ── Form input classes ────────────────────────────────────────────────────────

export const inputCls =
  'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed';

export const labelCls =
  'block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1';

/** Para selects (mismo estilo que inputCls) */
export const selCls =
  'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed';

// ── Chart colors ──────────────────────────────────────────────────────────────

/** Paleta de 10 colores para Recharts (PieChart cells, Bar fills, Line strokes) */
export const CHART_COLORS = [
  '#10b981', // emerald-500   → ingresos / positivo
  '#ef4444', // red-500       → gastos / negativo
  '#3b82f6', // blue-500
  '#f59e0b', // amber-500
  '#8b5cf6', // violet-500
  '#06b6d4', // cyan-500
  '#f97316', // orange-500
  '#84cc16', // lime-500
  '#a855f7', // purple-500
  '#ec4899', // pink-500
];

/** contentStyle para todos los <Tooltip> de Recharts */
export const TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: '#1e293b',
  border: '1px solid #334155',
  color: '#f1f5f9',
  borderRadius: 8,
};

// ── KPI card ──────────────────────────────────────────────────────────────────

/** Clase base de tarjeta genérica */
export const CARD = 'bg-slate-900 rounded-xl border border-slate-800 p-6';

/** Clase base del contenedor de tarjeta KPI */
export const KPI_CARD = 'bg-slate-900 rounded-xl border border-slate-800 p-5 flex flex-col gap-1';

/** Modal overlay */
export const MODAL_OVERLAY = 'fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-50 p-0 md:p-4';

/** Modal panel */
export const MODAL_PANEL = 'bg-slate-900 border border-slate-800 rounded-t-2xl md:rounded-2xl w-full md:max-w-lg p-6';

/** Título de sección */
export const SECTION_TITLE = 'text-base font-semibold text-white/90 mb-4';

/** Botón primario */
export const BTN_PRIMARY = 'bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

/** Botón secundario */
export const BTN_SECONDARY = 'bg-slate-700 hover:bg-slate-600 text-white font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

/** Botón de peligro */
export const BTN_DANGER = 'bg-red-500/10 hover:bg-red-500/20 text-red-400 font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

// ── Skeleton loader ────────────────────────────────────────────────────────────

/** Clase base para placeholders de skeleton (añadir dimensiones en el sitio de uso) */
export const SKELETON = 'animate-pulse bg-slate-800 rounded-lg';

// ── Languages ─────────────────────────────────────────────────────────────────

export const LANGUAGES = [
  { code: 'es', name: 'Español' },
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'it', name: 'Italiano' },
  { code: 'pt', name: 'Português' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'da', name: 'Dansk' },
  { code: 'nb', name: 'Norsk' },
  { code: 'sv', name: 'Svenska' },
] as const;
