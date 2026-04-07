import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useUserPreferences } from '../context/UserPreferencesContext';

interface Property { id: string; name: string; }
interface Booking {
  id: string;
  checkIn: string;
  checkOut: string;
  checkInDate?: string;
  checkOutDate?: string;
  totalAmount: number;
  status: string;
  source: string;
  client: { firstName: string; lastName: string; };
  property: { id: string; name: string; };
}

function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function startOfDay(d: Date) { const r = new Date(d); r.setHours(0,0,0,0); return r; }
function sameDay(a: Date, b: Date) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}
function getCheckIn(b: Booking)  { return startOfDay(new Date(b.checkIn  || b.checkInDate  || '')); }
function getCheckOut(b: Booking) { return startOfDay(new Date(b.checkOut || b.checkOutDate || '')); }

function bookingCoversDay(b: Booking, day: Date) {
  const ci = getCheckIn(b);
  const co = getCheckOut(b);
  const d  = startOfDay(new Date(day));
  return d >= ci && d < co;
}

function bookingColor(b: Booking, dark: boolean) {
  if (b.source === 'manual_block') return { solid: '#64748b', bg: dark ? '#33415580' : '#94a3b866', text: dark ? '#cbd5e1' : '#475569' };
  if (b.source === 'airbnb')    return { solid: '#e8414a', bg: dark ? '#e8414aee' : '#e8414acc', text: dark ? '#ffb3b6' : '#9b1c23' };
  if (b.source === 'booking')   return { solid: '#1a6fc4', bg: dark ? '#1a6fc4ee' : '#1a6fc4cc', text: dark ? '#93c5fd' : '#0e4d8f' };
  if (b.status === 'confirmed') return { solid: '#059669', bg: dark ? '#059669ee' : '#059669cc', text: dark ? '#6ee7b7' : '#047857' };
  if (b.status === 'cancelled') return { solid: '#dc2626', bg: dark ? '#dc2626ee' : '#dc2626cc', text: dark ? '#fca5a5' : '#991b1b' };
  return                               { solid: '#d97706', bg: dark ? '#d97706ee' : '#d97706cc', text: dark ? '#fcd34d' : '#92400e' };
}

const DAY_W  = 46;
const ROW_H  = 52;
const PROP_W = 176;

export default function OccupancyCalendar() {
  const { t }     = useTranslation();
  const navigate  = useNavigate();
  const { theme } = useUserPreferences();
  const dark      = theme === 'dark';
  const today     = startOfDay(new Date());

  const pal = dark ? {
    pageBg:'#0d1117', headerBg:'#0a0e17', borderCol:'#1e293b',
    headerText:'#475569', cellBg:'#0d1117', cellBgAlt:'#0a0e17',
    cellWEnd:'#0c1220', cellToday:'#052e16', todayBorder:'#10b981',
    todayCircle:'#10b981', numColor:'#94a3b8', numWEnd:'#475569',
    propText:'#cbd5e1', spanText:'#94a3b8', btnText:'#64748b',
    tooltipBg:'#0f172a', legendText:'#475569', emptyBg:'#080c12',
    titleColor:'#f1f5f9',
  } : {
    pageBg:'#f8fafc', headerBg:'#ffffff', borderCol:'#e2e8f0',
    headerText:'#94a3b8', cellBg:'#ffffff', cellBgAlt:'#f8fafc',
    cellWEnd:'#f1f5f9', cellToday:'#ecfdf5', todayBorder:'#059669',
    todayCircle:'#059669', numColor:'#64748b', numWEnd:'#94a3b8',
    propText:'#1e293b', spanText:'#475569', btnText:'#94a3b8',
    tooltipBg:'#1e293b', legendText:'#94a3b8', emptyBg:'#f1f5f9',
    titleColor:'#0f172a',
  };

  const [view, setView]             = useState<'multi'|'monthly'>('multi');
  const [properties, setProperties] = useState<Property[]>([]);
  const [bookings,   setBookings]   = useState<Booking[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [selProp,    setSelProp]    = useState('');
  const [year,       setYear]       = useState(today.getFullYear());
  const [month,      setMonth]      = useState(today.getMonth());
  const [offset,     setOffset]     = useState(-2);
  const [tooltip,    setTooltip]    = useState<{b:Booking;x:number;y:number}|null>(null);

  const isDragging      = useRef(false);
  const dragStartX      = useRef(0);
  const dragOffsetStart = useRef(0);

  const VISIBLE   = 35;
  const multiDays = Array.from({length: VISIBLE}, (_, i) => addDays(today, offset + i));

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [pR, bR, bBlocks] = await Promise.all([
          api.get('/properties'),
          api.get('/bookings?limit=500'),
          api.get('/bookings?includeBlocks=true&limit=500'),
        ]);
        const props  = pR.data?.data || pR.data;
        const bkgs   = bR.data?.data || bR.data;
        const allBkgs = bBlocks.data?.data || bBlocks.data;
        const blocks = Array.isArray(allBkgs) ? allBkgs.filter((b: Booking) => b.source === 'manual_block') : [];
        const existingIds = new Set(Array.isArray(bkgs) ? bkgs.map((b: Booking) => b.id) : []);
        const merged = [
          ...(Array.isArray(bkgs) ? bkgs : []),
          ...blocks.filter((b: Booking) => !existingIds.has(b.id)),
        ];
        setProperties(Array.isArray(props) ? props : []);
        setBookings(merged.filter((b: Booking) => b.source !== 'manual_block'));
        if (Array.isArray(props) && props.length > 0) setSelProp(props[0].id);
      } finally { setLoading(false); }
    })();
  }, []);

  const onMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true; dragStartX.current = e.clientX;
    dragOffsetStart.current = offset; e.preventDefault();
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    setOffset(dragOffsetStart.current + Math.round((dragStartX.current - e.clientX) / DAY_W));
  };
  const onMouseUp  = () => { isDragging.current = false; };
  const shiftDays  = (n: number) => setOffset(o => o + n);
  const prevMonth  = () => { if (month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1); };
  const nextMonth  = () => { if (month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1); };
  const goToday    = () => { setOffset(-2); setMonth(today.getMonth()); setYear(today.getFullYear()); };
  const monthLabel = new Date(year,month,1).toLocaleString('default',{month:'long',year:'numeric'});

  function MultiView() {
    return (
      <div
        className="select-none cursor-grab active:cursor-grabbing"
        onMouseDown={onMouseDown} onMouseMove={onMouseMove}
        onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
      >
        <table className="border-collapse" style={{tableLayout:'fixed', width: PROP_W + VISIBLE*DAY_W}}>
          <colgroup>
            <col style={{width: PROP_W}} />
            {multiDays.map((_,i) => <col key={i} style={{width: DAY_W}} />)}
          </colgroup>
          <thead>
            <tr style={{background: pal.headerBg}}>
              <th style={{
                position:'sticky', left:0, zIndex:20,
                background:pal.headerBg,
                borderBottom:`1px solid ${pal.borderCol}`,
                borderRight:`2px solid ${pal.borderCol}`,
                padding:'10px 16px', textAlign:'left',
              }}>
                <span style={{fontSize:10,fontWeight:700,color:pal.headerText,letterSpacing:'0.1em',textTransform:'uppercase'}}>
                  Propiedad
                </span>
              </th>
              {multiDays.map((day, i) => {
                const isT    = sameDay(day, today);
                const isWEnd = day.getDay()===0||day.getDay()===6;
                const isFirst= day.getDate()===1;
                return (
                  <th key={i} style={{
                    background: isT ? pal.cellToday : isWEnd ? pal.cellWEnd : pal.headerBg,
                    borderBottom:`1px solid ${pal.borderCol}`,
                    borderRight:`1px solid ${pal.borderCol}`,
                    padding:'6px 2px', textAlign:'center', verticalAlign:'bottom', position:'relative',
                    zIndex: 1,
                  }}>
                    {isFirst && (
                      <div style={{position:'absolute',top:2,left:0,right:0,textAlign:'center',
                        fontSize:9,fontWeight:800,color:pal.todayBorder,textTransform:'uppercase',letterSpacing:'0.08em'}}>
                        {day.toLocaleString('default',{month:'short'})}
                      </div>
                    )}
                    <div style={{fontSize:10,color:isT?pal.todayBorder:isWEnd?pal.numWEnd:pal.headerText,marginTop:isFirst?10:0}}>
                      {day.toLocaleString('default',{weekday:'narrow'})}
                    </div>
                    <div style={{fontSize:12,fontWeight:700,color:isT?'#fff':isWEnd?pal.numWEnd:pal.numColor,lineHeight:'20px'}}>
                      {isT
                        ? <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',
                            width:22,height:22,background:pal.todayCircle,borderRadius:'50%',
                            fontSize:11,color:'#fff',fontWeight:800}}>
                            {day.getDate()}
                          </span>
                        : day.getDate()
                      }
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {properties.map((prop, pi) => {
              const propBkgs = bookings.filter(b => b.property?.id===prop.id && b.status!=='cancelled');
              const bars: {bk: Booking; startIdx: number; endIdx: number}[] = [];
              for (const bk of propBkgs) {
                const firstVisible = multiDays.findIndex(d => bookingCoversDay(bk, d));
                if (firstVisible < 0) continue;
                const ciDay    = getCheckIn(bk);
                const startIdx = multiDays.findIndex(d => sameDay(d, ciDay));
                const lastVisible = [...multiDays].reverse().findIndex(d => bookingCoversDay(bk, d));
                const endIdx = lastVisible >= 0 ? VISIBLE - lastVisible : -1;
                bars.push({ bk, startIdx, endIdx });
              }
              return (
                <tr key={prop.id} style={{position:'relative'}}>
                  <td style={{
                    position:'sticky', left:0, zIndex:10,
                    background: pi%2===0 ? pal.cellBg : pal.cellBgAlt,
                    borderBottom:`1px solid ${pal.borderCol}`,
                    borderRight:`2px solid ${pal.borderCol}`,
                    padding:'0 16px', height: ROW_H,
                  }}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <div style={{width:6,height:6,borderRadius:'50%',background:'#10b981',flexShrink:0}} />
                      <span style={{fontSize:13,color:pal.propText,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                        {prop.name}
                      </span>
                    </div>
                  </td>
                  {multiDays.map((day, di) => {
                    const isT    = sameDay(day, today);
                    const isWEnd = day.getDay()===0||day.getDay()===6;
                    const bg     = isT ? pal.cellToday : isWEnd ? pal.cellWEnd : pi%2===0 ? pal.cellBg : pal.cellBgAlt;
                    return (
                      <td key={di} style={{
                        background: bg,
                        borderBottom:`1px solid ${pal.borderCol}`,
                        borderRight:`1px solid ${pal.borderCol}`,
                        padding:0, height: ROW_H, position:'relative',
                      }}>
                        {isT && (
                          <div style={{
                            position:'absolute', inset:0,
                            borderLeft:`1px solid ${pal.todayBorder}40`,
                            borderRight:`1px solid ${pal.todayBorder}40`,
                            pointerEvents:'none',
                          }} />
                        )}
                      </td>
                    );
                  })}
                  {/* td overlay para las barras — válido como hijo de tr */}
                  <td style={{
                    position:'absolute', top:0, left:0,
                    width: PROP_W + VISIBLE * DAY_W,
                    height: ROW_H,
                    padding:0, border:'none',
                    pointerEvents:'none', zIndex:15,
                  }}>
                    {bars.map(({bk, startIdx, endIdx}) => {
                      const col        = bookingColor(bk, dark);
                      const ciDay      = getCheckIn(bk);
                      const startsHere = multiDays.some(d => sameDay(d, ciDay));
                      const endsHere   = endIdx < VISIBLE;
                      const leftPx     = PROP_W + Math.max(0, startIdx) * DAY_W + (startsHere ? 3 : 0);
                      const rightPx    = startsHere && startIdx < 0
                        ? PROP_W
                        : (VISIBLE - endIdx) * DAY_W + (endsHere ? 3 : 0);
                      return (
                        <div
                          key={bk.id}
                          onClick={() => { if (bk.source !== 'manual_block') navigate(`/bookings/${bk.id}`); }}
                          onMouseEnter={e => setTooltip({b:bk, x:e.clientX, y:e.clientY})}
                          onMouseLeave={() => setTooltip(null)}
                          style={{
                            position:'absolute',
                            top:8, bottom:8,
                            left:leftPx, right:rightPx,
                            background: col.bg,
                            borderLeft:   startsHere ? `3px solid ${col.solid}` : 'none',
                            borderRight:  endsHere   ? `3px solid ${col.solid}` : 'none',
                            borderTop:    `1px solid ${col.solid}80`,
                            borderBottom: `1px solid ${col.solid}80`,
                            borderRadius: startsHere&&endsHere ? 5 : startsHere ? '5px 0 0 5px' : endsHere ? '0 5px 5px 0' : 0,
                            display:'flex', alignItems:'center', overflow:'hidden',
                            cursor: bk.source === 'manual_block' ? 'default' : 'pointer',
                            zIndex:20, pointerEvents:'all',
                          }}>
                          {startsHere && startIdx >= 0 && (
                            <div style={{padding:'0 10px',overflow:'hidden',whiteSpace:'nowrap'}}>
                              {bk.source === 'manual_block'
                                ? <span style={{fontSize:11,fontWeight:600,color:'#94a3b8',fontStyle:'italic'}}>Bloqueado</span>
                                : <>
                                    <span style={{fontSize:11,fontWeight:700,color:'#ffffff'}}>
                                      {bk.client?.firstName} {bk.client?.lastName?.[0]}.
                                    </span>
                                    <span style={{fontSize:10,color:'#000000',marginLeft:12}}>
                                      {Number(bk.totalAmount).toLocaleString()}€
                                    </span>
                                  </>
                              }
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  function MonthlyView() {
    const propBkgs = bookings.filter(b => b.property?.id===selProp && b.status!=='cancelled');
    const firstDow = (new Date(year,month,1).getDay()+6)%7;
    const daysInM  = new Date(year,month+1,0).getDate();
    const totalC   = Math.ceil((firstDow+daysInM)/7)*7;
    const weeks    = totalC/7;
    const WD       = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

    function getBarsForWeek(weekIdx: number) {
      const weekStart = addDays(new Date(year,month,1), weekIdx*7 - firstDow);
      const weekEnd   = addDays(weekStart, 7);
      const bars: {booking:Booking; startCol:number; endCol:number}[] = [];
      for (const bk of propBkgs) {
        const ci = getCheckIn(bk);
        const co = getCheckOut(bk);
        if (co <= weekStart || ci >= weekEnd) continue;
        const startCol = Math.max(0, Math.round((ci.getTime() - weekStart.getTime()) / 86400000));
        const endCol   = Math.min(7, Math.round((co.getTime()  - weekStart.getTime()) / 86400000));
        bars.push({booking: bk, startCol, endCol});
      }
      return bars;
    }

    const CELL_H  = 90;
    const BAR_H   = 22;
    const BAR_TOP = 28;

    return (
      <div style={{padding:'0 24px 24px'}}>
        <style>{`
          .cal-month-cell { transition: background 0.15s; }
          .cal-month-cell:hover { filter: brightness(1.06); }
          @media (max-width: 640px) {
            .cal-month-cell { min-height: 60px !important; }
          }
        `}</style>
        {/* Cabecera días semana */}
        <div style={{
          display:'grid', gridTemplateColumns:'repeat(7,1fr)',
          background: dark ? '#111827' : '#f1f5f9',
          borderRadius:'16px 16px 0 0',
          border:`1px solid ${pal.borderCol}`,
          borderBottom:'none',
          marginBottom:0,
        }}>
          {WD.map((d,i) => (
            <div key={d} style={{
              padding:'11px 0', textAlign:'center',
              fontSize:10, fontWeight:700,
              color: dark ? '#4b5563' : '#94a3b8',
              textTransform:'uppercase', letterSpacing:'0.12em',
              borderRight: i<6 ? `1px solid ${pal.borderCol}` : 'none',
            }}>{d}</div>
          ))}
        </div>
        <div style={{
          border:`1px solid ${pal.borderCol}`,
          borderRadius:'0 0 16px 16px',
          overflow:'hidden',
          boxShadow: dark
            ? '0 8px 32px #00000050, 0 2px 8px #00000030'
            : '0 4px 24px #0000000f, 0 1px 4px #00000008',
        }}>
          {Array.from({length:weeks},(_,wi) => {
            const bars = getBarsForWeek(wi);
            const weekCells = Array.from({length:7},(_,di) => {
              const dayNum = wi*7 + di - firstDow + 1;
              return (dayNum>=1&&dayNum<=daysInM) ? new Date(year,month,dayNum) : null;
            });
            return (
              <div key={wi} style={{position:'relative', display:'grid', gridTemplateColumns:'repeat(7,1fr)'}}>
                {weekCells.map((day,di) => {
                  const isT    = day && sameDay(day,today);
                  const isWEnd = di>=5;
                  return (
                    <div key={di} className="cal-month-cell" style={{
                      height: CELL_H,
                      background: isT
                        ? (dark ? '#052e16' : '#f0fdf4')
                        : isWEnd
                          ? (dark ? '#0b0f1a' : '#f8fafc')
                          : (dark ? '#0d1117' : '#ffffff'),
                      borderRight: di<6 ? `1px solid ${pal.borderCol}` : 'none',
                      borderBottom: wi<weeks-1 ? `1px solid ${pal.borderCol}` : 'none',
                      borderTop: isT ? `2px solid ${pal.todayBorder}` : '2px solid transparent',
                      padding:'7px 9px', boxSizing:'border-box',
                    }}>
                      {day && (
                        isT
                          ? <span style={{
                              width:26, height:26, display:'inline-flex',
                              alignItems:'center', justifyContent:'center',
                              background: pal.todayCircle,
                              borderRadius:'50%', fontSize:12, fontWeight:800,
                              color:'#fff', float:'right',
                              boxShadow:`0 0 0 4px ${pal.todayCircle}25`,
                            }}>
                              {day.getDate()}
                            </span>
                          : <span style={{
                              fontSize:11, fontWeight:600,
                              color: !day
                                ? 'transparent'
                                : isWEnd ? pal.numWEnd : pal.numColor,
                              float:'right',
                            }}>
                              {day.getDate()}
                            </span>
                      )}
                    </div>
                  );
                })}
                {bars.map(({booking:bk, startCol, endCol}, bi) => {
                  const col          = bookingColor(bk, dark);
                  const ci           = getCheckIn(bk);
                  const weekSt       = addDays(new Date(year,month,1), wi*7 - firstDow);
                  const startsThisWeek = sameDay(ci, addDays(weekSt, startCol));
                  const endsThisWeek   = endCol < 7;
                  const pct   = 100/7;
                  const left  = `calc(${startCol*pct}% + ${startsThisWeek ? 6 : 0}px)`;
                  const right = `calc(${(7-endCol)*pct}% + ${endsThisWeek ? 6 : 0}px)`;
                  const radius = startsThisWeek && endsThisWeek ? 20
                    : startsThisWeek ? '20px 0 0 20px'
                    : endsThisWeek   ? '0 20px 20px 0' : 0;
                  return (
                    <div
                      key={bk.id+wi}
                      onClick={() => { if (bk.source !== 'manual_block') navigate(`/bookings/${bk.id}`); }}
                      onMouseEnter={e => setTooltip({b:bk,x:e.clientX,y:e.clientY})}
                      onMouseLeave={() => setTooltip(null)}
                      style={{
                        position:'absolute', top: BAR_TOP + bi*26,
                        left, right, height: BAR_H,
                        background: col.bg,
                        borderLeft:   startsThisWeek ? `3px solid ${col.solid}` : 'none',
                        borderRight:  endsThisWeek   ? `3px solid ${col.solid}` : 'none',
                        borderTop:    `1px solid ${col.solid}50`,
                        borderBottom: `1px solid ${col.solid}50`,
                        borderRadius: radius,
                        display:'flex', alignItems:'center',
                        overflow:'hidden',
                        cursor: bk.source === 'manual_block' ? 'default' : 'pointer',
                        zIndex:10,
                        boxShadow: `0 2px 6px ${col.solid}35`,
                      }}>
                      {startsThisWeek && (
                        <div style={{padding:'0 10px',overflow:'hidden',whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:5}}>
                          {bk.source === 'manual_block'
                            ? <span style={{fontSize:11,fontWeight:600,color:'#94a3b8',fontStyle:'italic'}}>Bloqueado</span>
                            : <span style={{
                                fontSize:11, fontWeight:700, color:'#ffffff',
                                textOverflow:'ellipsis', overflow:'hidden',
                                display:'inline-block', maxWidth:120,
                              }}>
                                {bk.client?.firstName} {bk.client?.lastName?.[0]}.
                              </span>
                          }
                        </div>
                      )}
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

  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',background:pal.pageBg}}>
      <div style={{
        display:'flex',flexWrap:'wrap',alignItems:'center',
        justifyContent:'space-between',gap:12,
        padding:'16px 24px',
        borderBottom:`1px solid ${pal.borderCol}`,
        background:pal.headerBg,
      }}>
        <div>
          <h1 style={{fontSize:18,fontWeight:700,color:pal.titleColor,margin:0,letterSpacing:'-0.02em'}}>
            {t('calendar.title')}
          </h1>
          <p style={{fontSize:11,color:pal.headerText,margin:'2px 0 0'}}>{t('calendar.subtitle')}</p>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          <button onClick={goToday} style={{
            padding:'5px 12px',fontSize:11,fontWeight:600,
            color: dark?'#10b981':'#059669',
            border:`1px solid ${dark?'#064e3b':'#a7f3d0'}`,
            background:'transparent',borderRadius:6,cursor:'pointer',
          }}>Hoy</button>
          {view==='monthly' && (
            <select value={selProp} onChange={e=>setSelProp(e.target.value)} style={{
              background:pal.cellBg,border:`1px solid ${pal.borderCol}`,
              color:dark?'#cbd5e1':'#1e293b',fontSize:11,borderRadius:6,
              padding:'5px 10px',outline:'none',
            }}>
              {properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <div style={{display:'flex',alignItems:'center',gap:2,
            background:pal.cellBg,border:`1px solid ${pal.borderCol}`,borderRadius:6,padding:2}}>
            <button onClick={()=>view==='multi'?shiftDays(-7):prevMonth()} style={{
              width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',
              background:'transparent',border:'none',color:pal.btnText,cursor:'pointer',borderRadius:4,fontSize:16,
            }}>‹</button>
            <span style={{
              padding:'0 12px',fontSize:11,fontWeight:600,color:pal.spanText,
              minWidth:160,textAlign:'center',textTransform:'capitalize',
            }}>
              {view==='multi'
                ? `${multiDays[0].toLocaleDateString('es',{day:'numeric',month:'short'})} — ${multiDays[VISIBLE-1].toLocaleDateString('es',{day:'numeric',month:'short',year:'numeric'})}`
                : monthLabel
              }
            </span>
            <button onClick={()=>view==='multi'?shiftDays(7):nextMonth()} style={{
              width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',
              background:'transparent',border:'none',color:pal.btnText,cursor:'pointer',borderRadius:4,fontSize:16,
            }}>›</button>
          </div>
          <div style={{display:'flex',background:pal.cellBg,border:`1px solid ${pal.borderCol}`,borderRadius:6,padding:2,gap:2}}>
            {(['multi','monthly'] as const).map(v=>(
              <button key={v} onClick={()=>setView(v)} style={{
                padding:'4px 12px',fontSize:11,fontWeight:600,
                background: view===v ? (dark?'#10b981':'#059669') : 'transparent',
                color: view===v ? '#fff' : pal.btnText,
                border:'none',borderRadius:5,cursor:'pointer',transition:'all 0.15s',
              }}>
                {v==='multi' ? '⊞ Multi' : '▦ Mensual'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{
        display:'flex',alignItems:'center',gap:16,
        padding:'8px 24px',borderBottom:`1px solid ${pal.borderCol}`,background:pal.headerBg,
      }}>
        {[
          {label:'Confirmada',color:'#059669'},
          {label:'Pendiente', color:'#d97706'},
          {label:'Airbnb',    color:'#e8414a'},
          {label:'Booking.com',color:'#1a6fc4'},
          {label:'Cancelada', color:'#dc2626'},
          {label:'Bloqueado', color:'#64748b'},
        ].map(l=>(
          <div key={l.label} style={{display:'flex',alignItems:'center',gap:5}}>
            <div style={{width:8,height:8,borderRadius:2,background:l.color}} />
            <span style={{fontSize:10,color:pal.legendText}}>{l.label}</span>
          </div>
        ))}
        {view==='multi' && (
          <span style={{marginLeft:'auto',fontSize:10,color:dark?'#1e293b':'#e2e8f0',fontStyle:'italic'}}>
            ← arrastra para desplazarte →
          </span>
        )}
      </div>

      <div style={{flex:1,overflow:'auto'}}>
        {loading ? (
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:240}}>
            <div style={{textAlign:'center'}}>
              <div style={{
                width:28,height:28,border:`2px solid ${dark?'#10b981':'#059669'}`,
                borderTopColor:'transparent',borderRadius:'50%',
                animation:'spin 0.8s linear infinite',margin:'0 auto 12px',
              }}/>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              <p style={{color:pal.headerText,fontSize:12}}>{t('calendar.loading')}</p>
            </div>
          </div>
        ) : view==='multi' ? <MultiView /> : <MonthlyView />}
      </div>

      {tooltip && (
        <div style={{position:'fixed',zIndex:50,pointerEvents:'none',left:tooltip.x+14,top:tooltip.y-10}}>
          <div style={{
            background:pal.tooltipBg,border:`1px solid ${pal.borderCol}`,
            borderRadius:10,boxShadow:'0 20px 40px #00000050',
            padding:'12px 14px',minWidth:190,
          }}>
            {tooltip.b.source === 'manual_block' ? (
              <>
                <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
                  <div style={{width:7,height:7,borderRadius:'50%',background:'#64748b'}}/>
                  <span style={{fontWeight:700,color:'#94a3b8',fontSize:13}}>Período bloqueado</span>
                </div>
                <div style={{fontSize:11,color:'#94a3b8',marginBottom:3}}>{tooltip.b.property?.name}</div>
                <div style={{fontSize:11,color:'#64748b'}}>
                  {getCheckIn(tooltip.b).toLocaleDateString('es',{day:'numeric',month:'short'})}
                  {' → '}
                  {getCheckOut(tooltip.b).toLocaleDateString('es',{day:'numeric',month:'short',year:'numeric'})}
                </div>
              </>
            ) : (
              <>
                <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
                  <div style={{width:7,height:7,borderRadius:'50%',background:bookingColor(tooltip.b,dark).solid}}/>
                  <span style={{fontWeight:700,color:'#f1f5f9',fontSize:13}}>
                    {tooltip.b.client?.firstName} {tooltip.b.client?.lastName}
                  </span>
                </div>
                <div style={{fontSize:11,color:'#94a3b8',marginBottom:3}}>{tooltip.b.property?.name}</div>
                <div style={{fontSize:11,color:'#64748b'}}>
                  {getCheckIn(tooltip.b).toLocaleDateString('es',{day:'numeric',month:'short'})}
                  {' → '}
                  {getCheckOut(tooltip.b).toLocaleDateString('es',{day:'numeric',month:'short',year:'numeric'})}
                </div>
                <div style={{marginTop:8,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <span style={{fontWeight:700,fontSize:14,color:dark?'#34d399':'#059669'}}>
                    {Number(tooltip.b.totalAmount).toLocaleString()}€
                  </span>
                  <span style={{
                    fontSize:10,padding:'2px 7px',borderRadius:20,
                    background:bookingColor(tooltip.b,dark).bg,
                    color:bookingColor(tooltip.b,dark).text,
                    fontWeight:600,textTransform:'capitalize',
                  }}>
                    {tooltip.b.source!=='direct'?tooltip.b.source:tooltip.b.status}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
