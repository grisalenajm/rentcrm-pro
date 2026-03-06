import { useEffect, useRef, useState } from 'react';
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

// ── Utilidades de fecha ───────────────────────────────────────────────────────
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function startOfDay(d: Date) { const r = new Date(d); r.setHours(0,0,0,0); return r; }
function sameDay(a: Date, b: Date) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}
function bookingCoversDay(b: Booking, day: Date) {
  const ci = startOfDay(new Date(b.checkInDate));
  const co = startOfDay(new Date(b.checkOutDate));
  const d  = startOfDay(day);
  return d >= ci && d < co;
}
function isCheckIn(b: Booking, day: Date) { return sameDay(startOfDay(new Date(b.checkInDate)), startOfDay(day)); }
function isCheckOut(b: Booking, day: Date) {
  const co = startOfDay(new Date(b.checkOutDate));
  const d  = startOfDay(day);
  return sameDay(co, d);
}

// ── Colores por fuente/estado ─────────────────────────────────────────────────
function bookingColor(b: Booking) {
  if (b.source === 'airbnb')   return { pill: '#FF5A5F', light: '#FF5A5F22', label: 'Airbnb' };
  if (b.source === 'booking')  return { pill: '#003580', light: '#00358022', label: 'Booking' };
  if (b.status === 'confirmed') return { pill: '#10b981', light: '#10b98122', label: '' };
  if (b.status === 'cancelled') return { pill: '#ef4444', light: '#ef444422', label: '' };
  return { pill: '#f59e0b', light: '#f59e0b22', label: '' };
}

const DAY_W = 44; // px ancho de cada día

export default function OccupancyCalendar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const today = startOfDay(new Date());

  const [view, setView]               = useState<'multi'|'monthly'>('multi');
  const [properties, setProperties]   = useState<Property[]>([]);
  const [bookings, setBookings]        = useState<Booking[]>([]);
  const [loading, setLoading]          = useState(true);
  const [selProp, setSelProp]          = useState('');
  const [year, setYear]               = useState(today.getFullYear());
  const [month, setMonth]             = useState(today.getMonth());
  const [tooltip, setTooltip]         = useState<{b: Booking; x: number; y: number}|null>(null);

  // Scroll multi-view: días offset desde hoy
  const [offset, setOffset]           = useState(-3); // empieza 3 días antes de hoy
  const scrollRef                     = useRef<HTMLDivElement>(null);
  const isDragging                    = useRef(false);
  const dragStart                     = useRef(0);
  const dragOffset                    = useRef(0);

  const VISIBLE_DAYS = 35;
  const multiDays = Array.from({ length: VISIBLE_DAYS }, (_, i) => addDays(today, offset + i));

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [pR, bR] = await Promise.all([api.get('/properties'), api.get('/bookings?limit=500')]);
        const props = pR.data?.data || pR.data;
        const bkgs  = bR.data?.data || bR.data;
        setProperties(props);
        setBookings(bkgs);
        if (props.length > 0) setSelProp(props[0].id);
      } finally { setLoading(false); }
    })();
  }, []);

  // ── Arrastre scroll ───────────────────────────────────────────────────────
  const onMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragStart.current  = e.clientX;
    dragOffset.current = offset;
    e.preventDefault();
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const delta = Math.round((dragStart.current - e.clientX) / DAY_W);
    setOffset(dragOffset.current + delta);
  };
  const onMouseUp = () => { isDragging.current = false; };

  const shiftDays = (n: number) => setOffset(o => o + n);

  // ── Navegación mensual ────────────────────────────────────────────────────
  const prevMonth = () => { if (month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1); };
  const nextMonth = () => { if (month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1); };
  const goToday   = () => { setOffset(-3); setMonth(today.getMonth()); setYear(today.getFullYear()); };

  const monthLabel = new Date(year, month, 1).toLocaleString('default', { month: 'long', year: 'numeric' });

  // ── Vista MULTI-PROPIEDAD ─────────────────────────────────────────────────
  function MultiView() {
    return (
      <div
        ref={scrollRef}
        className="select-none cursor-grab active:cursor-grabbing overflow-hidden"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <table className="border-collapse" style={{ tableLayout: 'fixed', width: `${180 + VISIBLE_DAYS * DAY_W}px` }}>
          <colgroup>
            <col style={{ width: 180 }} />
            {multiDays.map((_, i) => <col key={i} style={{ width: DAY_W }} />)}
          </colgroup>
          <thead>
            <tr>
              <th className="sticky left-0 z-20 bg-slate-950 border-b border-slate-800 px-4 py-3 text-left">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Propiedad</span>
              </th>
              {multiDays.map((day, i) => {
                const isT    = sameDay(day, today);
                const isWEnd = day.getDay()===0 || day.getDay()===6;
                const isFirst = day.getDate()===1;
                return (
                  <th key={i} className={`border-b border-slate-800 text-center py-2 relative
                    ${isT ? 'bg-emerald-950/60' : isWEnd ? 'bg-slate-900/60' : ''}`}
                    style={{ width: DAY_W }}>
                    {isFirst && (
                      <div className="absolute -top-0 left-0 right-0 text-center">
                        <span className="text-xs text-emerald-500 font-bold uppercase">
                          {day.toLocaleString('default',{month:'short'})}
                        </span>
                      </div>
                    )}
                    <div className={`text-xs ${isT ? 'text-emerald-400 font-bold' : isWEnd ? 'text-slate-500' : 'text-slate-400'}`}>
                      {day.toLocaleString('default',{weekday:'narrow'})}
                    </div>
                    <div className={`text-sm font-bold leading-tight
                      ${isT ? 'text-emerald-300' : isWEnd ? 'text-slate-500' : 'text-slate-300'}`}>
                      {isT ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 bg-emerald-500 text-white rounded-full text-xs">
                          {day.getDate()}
                        </span>
                      ) : day.getDate()}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {properties.map((prop, pi) => {
              const propBkgs = bookings.filter(b => b.property?.id===prop.id && b.status!=='cancelled');
              return (
                <tr key={prop.id} className={pi % 2 === 0 ? '' : 'bg-slate-900/20'}>
                  <td className="sticky left-0 z-10 bg-slate-950 border-b border-slate-800/50 px-4 py-0"
                    style={{ height: 48 }}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500/60 shrink-0" />
                      <span className="text-sm text-slate-300 font-medium truncate">{prop.name}</span>
                    </div>
                  </td>
                  {multiDays.map((day, di) => {
                    const bk    = propBkgs.find(b => bookingCoversDay(b, day));
                    const isCi  = bk && isCheckIn(bk, day);
                    const isCo  = bk && isCheckOut(bk, nextDay(day));
                    const isT   = sameDay(day, today);
                    const isWEnd= day.getDay()===0||day.getDay()===6;
                    const col   = bk ? bookingColor(bk) : null;
                    return (
                      <td key={di}
                        className={`border-b border-slate-800/50 p-0 relative overflow-hidden
                          ${isT ? 'bg-emerald-950/30' : isWEnd ? 'bg-slate-900/30' : ''}
                          ${bk ? 'cursor-pointer' : ''}`}
                        style={{ height: 48 }}
                        onClick={() => bk && navigate(`/bookings/${bk.id}`)}
                        onMouseEnter={e => bk && setTooltip({b:bk, x:e.clientX, y:e.clientY})}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        {isT && <div className="absolute inset-0 border-x-2 border-emerald-500/20 pointer-events-none" />}
                        {bk && (
                          <div className="absolute inset-y-2 left-0 right-0 flex items-center"
                            style={{
                              background: col!.light,
                              borderLeft:  isCi ? `3px solid ${col!.pill}` : 'none',
                              borderRight: isCheckOut(bk, addDays(day,1)) ? `3px solid ${col!.pill}` : 'none',
                              borderRadius: isCi ? '4px 0 0 4px' : isCheckOut(bk,addDays(day,1)) ? '0 4px 4px 0' : '0',
                            }}>
                            {isCi && (
                              <div className="px-2 overflow-hidden whitespace-nowrap">
                                <span className="text-xs font-semibold" style={{color: col!.pill}}>
                                  {bk.client.firstName} {bk.client.lastName[0]}.
                                </span>
                                <span className="text-xs text-slate-400 ml-1">
                                  {Number(bk.totalAmount).toLocaleString()}€
                                </span>
                              </div>
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

  function nextDay(d: Date) { return addDays(d, 1); }

  // ── Vista MENSUAL ─────────────────────────────────────────────────────────
  function MonthlyView() {
    const propBkgs = bookings.filter(b => b.property?.id===selProp && b.status!=='cancelled');
    const firstDow = (new Date(year,month,1).getDay()+6)%7;
    const daysInM  = new Date(year,month+1,0).getDate();
    const totalC   = Math.ceil((firstDow+daysInM)/7)*7;
    const cells    = Array.from({length:totalC},(_,i)=>{
      const d = i - firstDow + 1;
      return (d>=1&&d<=daysInM) ? new Date(year,month,d) : null;
    });
    const WEEK_DAYS = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

    return (
      <div>
        <div className="grid grid-cols-7">
          {WEEK_DAYS.map(d=>(
            <div key={d} className="py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-widest border-b border-slate-800">
              {d}
            </div>
          ))}
          {cells.map((day,i)=>{
            if(!day) return (
              <div key={i} className="min-h-28 border-b border-r border-slate-800/40 bg-slate-950/50" />
            );
            const dayBkgs  = propBkgs.filter(b=>bookingCoversDay(b,day));
            const isT      = sameDay(day,today);
            const isWEnd   = day.getDay()===0||day.getDay()===6;
            const isThisM  = day.getMonth()===month;
            return (
              <div key={i} className={`min-h-28 border-b border-r border-slate-800/40 p-2 flex flex-col gap-1 transition-colors
                ${isT ? 'bg-emerald-950/30' : isWEnd ? 'bg-slate-900/30' : 'bg-slate-950'}
                ${!isThisM ? 'opacity-30' : ''}`}>
                <div className="flex justify-end">
                  {isT ? (
                    <span className="w-7 h-7 flex items-center justify-center bg-emerald-500 text-white text-xs font-bold rounded-full">
                      {day.getDate()}
                    </span>
                  ) : (
                    <span className={`text-xs font-semibold ${isWEnd ? 'text-slate-500' : 'text-slate-400'}`}>
                      {day.getDate()}
                    </span>
                  )}
                </div>
                {dayBkgs.map(bk=>{
                  const col = bookingColor(bk);
                  const ci  = isCheckIn(bk,day);
                  const co  = isCheckOut(bk,addDays(day,1));
                  return (
                    <div key={bk.id}
                      onClick={()=>navigate(`/bookings/${bk.id}`)}
                      onMouseEnter={e=>setTooltip({b:bk,x:e.clientX,y:e.clientY})}
                      onMouseLeave={()=>setTooltip(null)}
                      className="cursor-pointer hover:brightness-110 transition-all text-xs px-2 py-0.5 truncate"
                      style={{
                        background: col.light,
                        borderLeft: `3px solid ${col.pill}`,
                        borderRadius: ci ? '4px' : co ? '0 4px 4px 0' : '0',
                        color: col.pill,
                        fontWeight: ci ? 700 : 400,
                      }}>
                      {ci ? `▶ ${bk.client.firstName} · ${Number(bk.totalAmount).toLocaleString()}€` : bk.client.firstName}
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

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col bg-slate-950">

      {/* ── Barra superior ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">{t('calendar.title')}</h1>
          <p className="text-xs text-slate-500 mt-0.5">{t('calendar.subtitle')}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Hoy */}
          <button onClick={goToday}
            className="px-3 py-1.5 text-xs font-semibold text-emerald-400 border border-emerald-800 hover:bg-emerald-900/30 rounded-lg transition">
            Hoy
          </button>

          {/* Vista mensual: selector propiedad */}
          {view==='monthly' && (
            <select value={selProp} onChange={e=>setSelProp(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-600">
              {properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}

          {/* Navegación período */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg p-1">
            <button onClick={()=>view==='multi'?shiftDays(-7):prevMonth()}
              className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 rounded-md transition text-sm">
              ‹
            </button>
            <span className="px-3 text-xs font-semibold text-slate-300 min-w-36 text-center">
              {view==='multi'
                ? `${multiDays[0].toLocaleDateString('es',{day:'numeric',month:'short'})} — ${multiDays[VISIBLE_DAYS-1].toLocaleDateString('es',{day:'numeric',month:'short',year:'numeric'})}`
                : <span className="capitalize">{monthLabel}</span>
              }
            </span>
            <button onClick={()=>view==='multi'?shiftDays(7):nextMonth()}
              className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 rounded-md transition text-sm">
              ›
            </button>
          </div>

          {/* Toggle vista */}
          <div className="flex bg-slate-900 border border-slate-700 rounded-lg p-1 gap-1">
            <button onClick={()=>setView('multi')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition
                ${view==='multi' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>
              🏠 Multi
            </button>
            <button onClick={()=>setView('monthly')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition
                ${view==='monthly' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>
              📅 Mensual
            </button>
          </div>
        </div>
      </div>

      {/* ── Leyenda ── */}
      <div className="flex items-center gap-4 px-6 py-2 border-b border-slate-800/50">
        {[
          { label: 'Confirmada', color: '#10b981' },
          { label: 'Pendiente',  color: '#f59e0b' },
          { label: 'Airbnb',     color: '#FF5A5F' },
          { label: 'Booking.com',color: '#003580' },
          { label: 'Cancelada',  color: '#ef4444' },
        ].map(l=>(
          <div key={l.label} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{background:l.color}} />
            <span className="text-xs text-slate-500">{l.label}</span>
          </div>
        ))}
        {view==='multi' && (
          <span className="ml-auto text-xs text-slate-600 italic">← arrastra para desplazarte →</span>
        )}
      </div>

      {/* ── Contenido ── */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-slate-500 text-sm">{t('calendar.loading')}</p>
            </div>
          </div>
        ) : view==='multi' ? <MultiView /> : <MonthlyView />}
      </div>

      {/* ── Tooltip ── */}
      {tooltip && (
        <div className="fixed z-50 pointer-events-none"
          style={{left: tooltip.x+14, top: tooltip.y-10}}>
          <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl p-4 min-w-48">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full" style={{background: bookingColor(tooltip.b).pill}} />
              <span className="font-bold text-white text-sm">
                {tooltip.b.client.firstName} {tooltip.b.client.lastName}
              </span>
            </div>
            <div className="text-xs text-slate-400 mb-1">{tooltip.b.property?.name}</div>
            <div className="text-xs text-slate-500">
              {new Date(tooltip.b.checkInDate).toLocaleDateString('es',{day:'numeric',month:'short'})}
              {' → '}
              {new Date(tooltip.b.checkOutDate).toLocaleDateString('es',{day:'numeric',month:'short',year:'numeric'})}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-emerald-400 font-bold text-sm">
                {Number(tooltip.b.totalAmount).toLocaleString()}€
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full capitalize"
                style={{background: bookingColor(tooltip.b).light, color: bookingColor(tooltip.b).pill}}>
                {tooltip.b.source !== 'direct' ? tooltip.b.source : tooltip.b.status}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
