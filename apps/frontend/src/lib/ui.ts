// ─────────────────────────────────────────────────────────────────────────────
// Tokens UI centralizados — RentalSuite
// Importar desde aquí en lugar de definir constantes locales en cada página.
// ─────────────────────────────────────────────────────────────────────────────

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

// ── Form input classes ────────────────────────────────────────────────────────

export const inputCls =
  'w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500';

export const labelCls =
  'block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1';

export const selCls =
  'px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500';

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
