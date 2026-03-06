import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

interface Property { id: string; name: string; }
interface Booking {
  id: string;
  checkInDate: string;
  checkOutDate: string;
  totalAmount: number;
  status: string;
  source: string;
  client: { firstName: string; lastName: string; };
  property: { id: string; name: string; };
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  confirmed: { bg: 'bg-emerald-500', text: 'text-white', border: 'border-emerald-600' },
  pending:   { bg: 'bg-amber-400',   text: 'text-white', border: 'border-amber-500' },
  cancelled: { bg: 'bg-red-400',     text: 'text-white', border: 'border-red-500' },
  airbnb:    { bg: 'bg-rose-500',    text: 'text-white', border: 'border-rose-600' },
  booking:   { bg: 'bg-blue-500',    text: 'text-white', border: 'border-blue-600' },
};

function getColor(booking: Booking) {
  if (booking.source === 'airbnb') return STATUS_COLORS.airbnb;
  if (booking.source === 'booking') return STATUS_COLORS.booking;
  return STATUS_COLORS[booking.status] || STATUS_COLORS.pending;
}

function datesInRange(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  const cur = new Date(start);
  while (cur < end) { dates.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
  return dates;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function bookingOnDay(booking: Booking, day: Date): boolean {
  const ci = new Date(booking.checkInDate);
  const co = new Date(booking.checkOutDate);
  ci.setHours(0,0,0,0); co.setHours(0,0,0,0); day.setHours(0,0,0,0);
  return day >= ci && day < co;
}

function isCheckIn(booking: Booking, day: Date): boolean {
  const ci = new Date(booking.checkInDate); ci.setHours(0,0,0,0);
  const d = new Date(day); d.setHours(0,0,0,0);
  return sameDay(ci, d);
}

export default function OccupancyCalendar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const today = new Date();

  const [view, setView] = useState<'multi' | 'monthly'>('multi');
  const [properties, setProperties] = useState<Property[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedProperty, setSelectedProperty] = useState<string>('');
  const [tooltip, setTooltip] = useState<{ booking: Booking; x: number; y: number } | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [pRes, bRes] = await Promise.all([
          api.get('/properties'),
          api.get('/bookings?limit=500'),
        ]);
        const props = pRes.data?.data || pRes.data;
        const bkgs = bRes.data?.data || bRes.data;
        setProperties(props);
        setBookings(bkgs);
        if (props.length > 0) setSelectedProperty(props[0].id);
      } finally { setLoading(false); }
    };
    load();
  }, []);

  // ── Helpers de fecha ──────────────────────────────────────────────────────
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthDays = Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1));

  // Vista multi: 30 días desde hoy
  const multiDays = Array.from({ length: 35 }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() + i - 2); return d;
  });

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const monthName = new Date(year, month, 1).toLocaleString('default', { month: 'long', year: 'numeric' });

  // ── Vista Multi-propiedad ─────────────────────────────────────────────────
  function MultiView() {
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-slate-900 border border-slate-700 px-3 py-2 text-left text-slate-300 min-w-32">
                {t('calendar.property')}
              </th>
              {multiDays.map((day, i) => {
                const isToday = sameDay(day, today);
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                return (
                  <th key={i} className={`border border-slate-700 px-1 py-1 text-center min-w-10 ${isToday ? 'bg-emerald-900/40 text-emerald-400' : isWeekend ? 'bg-slate-800/60 text-slate-400' : 'bg-slate-900 text-slate-400'}`}>
                    <div className="font-normal">{day.toLocaleString('default', { weekday: 'narrow' })}</div>
                    <div className={`font-bold ${isToday ? 'text-emerald-400' : ''}`}>{day.getDate()}</div>
                    {day.getDate() === 1 && <div className="text-slate-500">{day.toLocaleString('default', { month: 'short' })}</div>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {properties.map(prop => {
              const propBookings = bookings.filter(b => b.property?.id === prop.id && b.status !== 'cancelled');
              return (
                <tr key={prop.id} className="hover:bg-slate-800/30">
                  <td className="sticky left-0 z-10 bg-slate-900 border border-slate-700 px-3 py-1 text-slate-300 font-medium truncate max-w-32">
                    {prop.name}
                  </td>
                  {multiDays.map((day, di) => {
                    const booking = propBookings.find(b => bookingOnDay(b, new Date(day)));
                    const isCI = booking && isCheckIn(booking, day);
                    const isToday = sameDay(day, today);
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    const color = booking ? getColor(booking) : null;
                    return (
                      <td
                        key={di}
                        className={`border border-slate-700 h-9 p-0 relative cursor-pointer transition-opacity
                          ${isToday ? 'bg-emerald-900/20' : isWeekend ? 'bg-slate-800/30' : ''}
                          ${booking ? 'hover:opacity-80' : 'hover:bg-slate-700/30'}`}
                        onClick={() => booking && navigate(`/bookings/${booking.id}`)}
                        onMouseEnter={(e) => booking && setTooltip({ booking, x: e.clientX, y: e.clientY })}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        {booking && (
                          <div className={`absolute inset-0 ${color!.bg} ${isCI ? 'rounded-l-sm ml-1' : ''} flex items-center overflow-hidden`}>
                            {isCI && (
                              <span className="text-white text-xs font-medium px-1 truncate">
                                {booking.client.firstName} · {Number(booking.totalAmount).toLocaleString()}€
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // ── Vista Mensual ─────────────────────────────────────────────────────────
  function MonthlyView() {
    const propBookings = bookings.filter(b =>
      b.property?.id === selectedProperty && b.status !== 'cancelled'
    );
    const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7; // lunes=0
    const totalCells = Math.ceil((firstDayOfWeek + daysInMonth) / 7) * 7;
    const cells = Array.from({ length: totalCells }, (_, i) => {
      const dayNum = i - firstDayOfWeek + 1;
      return dayNum >= 1 && dayNum <= daysInMonth ? new Date(year, month, dayNum) : null;
    });

    return (
      <div>
        <div className="grid grid-cols-7 gap-0 border-l border-t border-slate-700">
          {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d => (
            <div key={d} className="border-r border-b border-slate-700 px-2 py-1 text-center text-xs font-medium text-slate-400 bg-slate-800/50">
              {d}
            </div>
          ))}
          {cells.map((day, i) => {
            if (!day) return (
              <div key={i} className="border-r border-b border-slate-700 h-24 bg-slate-900/50" />
            );
            const dayBookings = propBookings.filter(b => bookingOnDay(b, new Date(day)));
            const isToday = sameDay(day, today);
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
            return (
              <div key={i} className={`border-r border-b border-slate-700 h-24 p-1 flex flex-col gap-0.5 overflow-hidden
                ${isToday ? 'bg-emerald-900/20' : isWeekend ? 'bg-slate-800/20' : 'bg-slate-900'}`}>
                <span className={`text-xs font-bold ${isToday ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {day.getDate()}
                </span>
                {dayBookings.map(booking => {
                  const color = getColor(booking);
                  const ci = isCheckIn(booking, day);
                  return (
                    <div
                      key={booking.id}
                      onClick={() => navigate(`/bookings/${booking.id}`)}
                      onMouseEnter={(e) => setTooltip({ booking, x: e.clientX, y: e.clientY })}
                      onMouseLeave={() => setTooltip(null)}
                      className={`${color.bg} ${color.text} text-xs px-1 rounded cursor-pointer hover:opacity-80 truncate`}
                    >
                      {ci ? `▶ ${booking.client.firstName} ${Number(booking.totalAmount).toLocaleString()}€` : `  ${booking.client.firstName}`}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('calendar.title')}</h1>
          <p className="text-sm text-slate-400 mt-1">{t('calendar.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Toggle vista */}
          <div className="flex bg-slate-800 rounded-lg p-1 gap-1">
            <button onClick={() => setView('multi')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${view === 'multi' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              🏠 {t('calendar.viewMulti')}
            </button>
            <button onClick={() => setView('monthly')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${view === 'monthly' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              📅 {t('calendar.viewMonthly')}
            </button>
          </div>

          {/* Selector propiedad (solo vista mensual) */}
          {view === 'monthly' && (
            <select value={selectedProperty} onChange={e => setSelectedProperty(e.target.value)}
              className="bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2">
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}

          {/* Navegación mes (solo vista mensual) */}
          {view === 'monthly' && (
            <div className="flex items-center gap-2">
              <button onClick={prevMonth} className="bg-slate-800 hover:bg-slate-700 text-white px-2 py-1.5 rounded-lg text-sm transition">◀</button>
              <span className="text-white text-sm font-medium min-w-36 text-center capitalize">{monthName}</span>
              <button onClick={nextMonth} className="bg-slate-800 hover:bg-slate-700 text-white px-2 py-1.5 rounded-lg text-sm transition">▶</button>
            </div>
          )}
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-3 mb-4">
        {[
          { label: t('calendar.confirmed'), color: 'bg-emerald-500' },
          { label: t('calendar.pending'),   color: 'bg-amber-400' },
          { label: 'Airbnb',                color: 'bg-rose-500' },
          { label: 'Booking.com',           color: 'bg-blue-500' },
          { label: t('calendar.cancelled'), color: 'bg-red-400' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-sm ${l.color}`} />
            <span className="text-xs text-slate-400">{l.label}</span>
          </div>
        ))}
      </div>

      {/* Calendario */}
      <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
        {loading ? (
          <div className="text-center py-20 text-slate-400">{t('calendar.loading')}</div>
        ) : view === 'multi' ? <MultiView /> : <MonthlyView />}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-slate-800 border border-slate-600 rounded-xl shadow-xl p-3 text-sm pointer-events-none"
          style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
        >
          <div className="font-bold text-white mb-1">
            {tooltip.booking.client.firstName} {tooltip.booking.client.lastName}
          </div>
          <div className="text-slate-300">{tooltip.booking.property?.name}</div>
          <div className="text-slate-400 text-xs mt-1">
            {new Date(tooltip.booking.checkInDate).toLocaleDateString()} → {new Date(tooltip.booking.checkOutDate).toLocaleDateString()}
          </div>
          <div className="text-emerald-400 font-semibold mt-1">
            {Number(tooltip.booking.totalAmount).toLocaleString()}€
          </div>
          <div className={`text-xs mt-1 capitalize ${
            tooltip.booking.status === 'confirmed' ? 'text-emerald-400' :
            tooltip.booking.status === 'cancelled' ? 'text-red-400' : 'text-amber-400'
          }`}>
            {tooltip.booking.status} · {tooltip.booking.source}
          </div>
        </div>
      )}
    </div>
  );
}
