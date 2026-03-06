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

function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function startOfDay(d: Date) { const r = new Date(d); r.setHours(0,0,0,0); return r; }
function sameDay(a: Date, b: Date) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}
function bookingCoversDay(b: Booking, day: Date) {
  const ci = startOfDay(new Date(b.checkInDate));
  const co = startOfDay(new Date(b.checkOutDate));
  const d  = startOfDay(new Date(day));
  return d >= ci && d < co;
}
function isCheckIn(b: Booking, day: Date)  { return sameDay(startOfDay(new Date(b.checkInDate)), startOfDay(new Date(day))); }
function isCheckOut(b: Booking, day: Date) { return sameDay(startOfDay(new Date(b.checkOutDate)), startOfDay(new Date(day))); }

function bookingColor(b: Booking) {
  if (b.source === 'airbnb')    return { solid: '#e8414a', bg: '#e8414a18', text: '#ff8a8e' };
  if (b.source === 'booking')   return { solid: '#1a6fc4', bg: '#1a6fc418', text: '#6ab0f5' };
  if (b.status === 'confirmed') return { solid: '#059669', bg: '#05966918', text: '#34d399' };
  if (b.status === 'cancelled') return { solid: '#dc2626', bg: '#dc262618', text: '#f87171' };
  return                               { solid: '#d97706', bg: '#d9770618', text: '#fbbf24' };
}

const DAY_W   = 46;
const ROW_H   = 52;
const PROP_W  = 176;

export default function OccupancyCalendar() {
  const { t }    = useTranslation();
  const navigate = useNavigate();
  const today    = startOfDay(new Date());

  const [view, setView]             = useState<'multi'|'monthly'>('multi');
  const [properties, setProperties] = useState<Property[]>([]);
  const [bookings,   setBookings]   = useState<Booking[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [selProp,    setSelProp]    = useState('');
  const [year,       setYear]       = useState(today.getFullYear());
  const [month,      setMonth]      = useState(today.getMonth());
  const [offset,     setOffset]     = useState(-2);
  const [tooltip,    setTooltip]    = useState<{b:Booking;x:number;y:number}|null>(null);

  const isDragging  = useRef(false);
  const dragStartX  = useRef(0);
  const dragOffsetStart = useRef(0);

  const VISIBLE = 35;
  const multiDays = Array.from({length: VISIBLE}, (_, i) => addDays(today, offset + i));

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

  const onMouseDown = (e: React.MouseEvent) => {
    isDragging.current    = true;
    dragStartX.current    = e.clientX;
    dragOffsetStart.current = offset;
    e.preventDefault();
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const delta = Math.round((dragStartX.current - e.clientX) / DAY_W);
    setOffset(dragOffsetStart.current + delta);
  };
  const onMouseUp = () => { isDragging.current = false; };

  const shiftDays  = (n: number) => setOffset(o => o + n);
  const prevMonth  = () => { if (month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1); };
  const nextMonth  = () => { if (month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1); };
  const goToday    = () => { setOffset(-2); setMonth(today.getMonth()); setYear(today.getFullYear()); };
  const monthLabel = new Date(year,month,1).toLocaleString('default',{month:'long',year:'numeric'});

  // ── MULTI-PROPIEDAD ───────────────────────────────────────────────────────
  function MultiView() {
    return (
      <div
        className="select-none cursor-grab active:cursor-grabbing"
        onMouseDown={onMouseDown} onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}     onMouseLeave={onMouseUp}
      >
        <table className="border-collapse" style={{tableLayout:'fixed', width: PROP_W + VISIBLE*DAY_W}}>
          <colgroup>
            <col style={{width: PROP_W}} />
            {multiDays.map((_,i) => <col key={i} style={{width: DAY_W}} />)}
          </colgroup>
          <thead>
            <tr style={{background:'#0d1117'}}>
              {/* cabecera propiedad */}
              <th style={{
                position:'sticky', left:0, zIndex:20,
                background:'#0d1117',
                borderBottom:'1px solid #1e293b',
                borderRight:'1px solid #1e293b',
                padding:'10px 16px', textAlign:'left',
              }}>
                <span style={{fontSize:10, fontWeight:700, color:'#475569', letterSpacing:'0.1em', textTransform:'uppercase'}}>
                  Propiedad
                </span>
              </th>
              {/* cabeceras días */}
              {multiDays.map((day, i) => {
                const isT    = sameDay(day, today);
                const isWEnd = day.getDay()===0 || day.getDay()===6;
                const isFirst= day.getDate()===1;
                return (
                  <th key={i} style={{
                    background: isT ? '#052e16' : isWEnd ? '#0f172a' : '#0d1117',
                    borderBottom: isT ? '2px solid #10b981' : '1px solid #1e293b',
                    borderRight: '1px solid #1e293b',
                    padding:'6px 2px',
                    textAlign:'center',
                    verticalAlign:'bottom',
                    position:'relative',
                  }}>
                    {isFirst && (
                      <div style={{
                        position:'absolute', top:2, left:0, right:0,
                        fontSize:9, fontWeight:800, color:'#10b981',
                        textTransform:'uppercase', letterSpacing:'0.08em',
                      }}>
                        {day.toLocaleString('default',{month:'short'})}
                      </div>
                    )}
                    <div style={{fontSize:10, color: isT?'#10b981': isWEnd?'#475569':'#64748b', marginTop:isFirst?10:0}}>
                      {day.toLocaleString('default',{weekday:'narrow'})}
                    </div>
                    <div style={{
                      fontSize:12, fontWeight:700,
                      color: isT?'#ffffff': isWEnd?'#475569':'#94a3b8',
                      lineHeight:'20px',
                    }}>
                      {isT
                        ? <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',
                            width:22,height:22,background:'#10b981',borderRadius:'50%',
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
              return (
                <tr key={prop.id}>
                  <td style={{
                    position:'sticky', left:0, zIndex:10,
                    background: pi%2===0 ? '#0d1117' : '#0a0e17',
                    borderBottom:'1px solid #1e293b',
                    borderRight:'2px solid #1e293b',
                    padding:'0 16px',
                    height: ROW_H,
                  }}>
                    <div style={{display:'flex', alignItems:'center', gap:8}}>
                      <div style={{width:6,height:6,borderRadius:'50%',background:'#10b981',opacity:0.7,flexShrink:0}} />
                      <span style={{fontSize:13,color:'#cbd5e1',fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                        {prop.name}
                      </span>
                    </div>
                  </td>
                  {multiDays.map((day, di) => {
                    const bk   = propBkgs.find(b => bookingCoversDay(b, day));
                    const isCi = bk && isCheckIn(bk, day);
                    const isCo = bk && isCheckOut(bk, addDays(day,1));
                    const isT  = sameDay(day, today);
                    const isWEnd = day.getDay()===0||day.getDay()===6;
                    const col  = bk ? bookingColor(bk) : null;
                    const bg   = isT ? '#052e16' : isWEnd ? '#0c1220' : pi%2===0 ? '#0d1117' : '#0a0e17';
                    return (
                      <td key={di}
                        onClick={() => bk && navigate(`/bookings/${bk.id}`)}
                        onMouseEnter={e => bk && setTooltip({b:bk, x:e.clientX, y:e.clientY})}
                        onMouseLeave={() => setTooltip(null)}
                        style={{
                          background: bg,
                          borderBottom:'1px solid #1e293b',
                          borderRight:'1px solid #1e293b',
                          padding:0,
                          height: ROW_H,
                          position:'relative',
                          cursor: bk ? 'pointer' : 'default',
                        }}>
                        {isT && (
                          <div style={{
                            position:'absolute',inset:0,
                            borderLeft:'1px solid #10b98130',
                            borderRight:'1px solid #10b98130',
                            pointerEvents:'none',
                          }} />
                        )}
                        {bk && (
                          <div style={{
                            position:'absolute',
                            top:8, bottom:8,
                            left: isCi ? 4 : 0,
                            right: isCo ? 4 : 0,
                            background: col!.bg,
                            borderLeft:   isCi ? `3px solid ${col!.solid}` : `1px solid ${col!.solid}30`,
                            borderRight:  isCo ? `3px solid ${col!.solid}` : `1px solid ${col!.solid}30`,
                            borderTop:    `1px solid ${col!.solid}40`,
                            borderBottom: `1px solid ${col!.solid}40`,
                            borderRadius: isCi&&isCo ? 5 : isCi ? '5px 0 0 5px' : isCo ? '0 5px 5px 0' : 0,
                            display:'flex', alignItems:'center',
                            overflow:'hidden',
                          }}>
                            {isCi && (
                              <div style={{padding:'0 6px',overflow:'hidden',whiteSpace:'nowrap'}}>
                                <span style={{fontSize:11,fontWeight:700,color:col!.text}}>
                                  {bk.client.firstName} {bk.client.lastName[0]}.
                                </span>
                                <span style={{fontSize:10,color:'#64748b',marginLeft:4}}>
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

  // ── MENSUAL ───────────────────────────────────────────────────────────────
  function MonthlyView() {
    const propBkgs  = bookings.filter(b => b.property?.id===selProp && b.status!=='cancelled');
    const firstDow  = (new Date(year,month,1).getDay()+6)%7;
    const daysInM   = new Date(year,month+1,0).getDate();
    const totalC    = Math.ceil((firstDow+daysInM)/7)*7;
    const cells     = Array.from({length:totalC},(_,i) => {
      const d = i - firstDow + 1;
      return (d>=1&&d<=daysInM) ? new Date(year,month,d) : null;
    });
    const WD = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

    return (
      <div style={{padding:'0 24px 24px'}}>
        {/* cabeceras días semana */}
        <div style={{display:'grid', gridTemplateColumns:'repeat(7,1fr)', marginBottom:2}}>
          {WD.map((d,i) => (
            <div key={d} style={{
              padding:'8px 0',
              textAlign:'center',
              fontSize:10,
              fontWeight:700,
              color: i>=5 ? '#334155' : '#475569',
              textTransform:'uppercase',
              letterSpacing:'0.08em',
            }}>
              {d}
            </div>
          ))}
        </div>
        {/* grid días */}
        <div style={{
          display:'grid',
          gridTemplateColumns:'repeat(7,1fr)',
          border:'1px solid #1e293b',
          borderRadius:8,
          overflow:'hidden',
        }}>
          {cells.map((day,i) => {
            if (!day) return (
              <div key={i} style={{
                minHeight:88,
                background:'#080c12',
                borderRight:'1px solid #1e293b',
                borderBottom:'1px solid #1e293b',
              }} />
            );
            const dayBkgs = propBkgs.filter(b => bookingCoversDay(b,day));
            const isT     = sameDay(day, today);
            const isWEnd  = day.getDay()===0||day.getDay()===6;
            return (
              <div key={i} style={{
                minHeight:88,
                background: isT ? '#052e16' : isWEnd ? '#0c1220' : '#0d1117',
                borderRight:'1px solid #1e293b',
                borderBottom:'1px solid #1e293b',
                borderTop: isT ? '2px solid #10b981' : '2px solid transparent',
                padding:'6px 6px 4px',
                display:'flex',
                flexDirection:'column',
                gap:2,
              }}>
                {/* número día */}
                <div style={{display:'flex',justifyContent:'flex-end',marginBottom:2}}>
                  {isT
                    ? <span style={{width:22,height:22,display:'inline-flex',alignItems:'center',
                        justifyContent:'center',background:'#10b981',borderRadius:'50%',
                        fontSize:11,fontWeight:800,color:'#fff'}}>
                        {day.getDate()}
                      </span>
                    : <span style={{fontSize:11,fontWeight:600,color:isWEnd?'#334155':'#475569'}}>
                        {day.getDate()}
                      </span>
                  }
                </div>
                {/* reservas */}
                {dayBkgs.map(bk => {
                  const col = bookingColor(bk);
                  const ci  = isCheckIn(bk, day);
                  return (
                    <div key={bk.id}
                      onClick={() => navigate(`/bookings/${bk.id}`)}
                      onMouseEnter={e => setTooltip({b:bk, x:e.clientX, y:e.clientY})}
                      onMouseLeave={() => setTooltip(null)}
                      style={{
                        background: col.bg,
                        borderLeft:`2px solid ${col.solid}`,
                        borderRadius:3,
                        padding:'2px 6px',
                        fontSize:10,
                        fontWeight: ci ? 700 : 400,
                        color: col.text,
                        cursor:'pointer',
                        overflow:'hidden',
                        textOverflow:'ellipsis',
                        whiteSpace:'nowrap',
                      }}>
                      {ci
                        ? `▶ ${bk.client.firstName} · ${Number(bk.totalAmount).toLocaleString()}€`
                        : `  ${bk.client.firstName}`
                      }
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
    <div style={{height:'100%', display:'flex', flexDirection:'column', background:'#0d1117'}}>

      {/* Barra superior */}
      <div style={{
        display:'flex', flexWrap:'wrap', alignItems:'center',
        justifyContent:'space-between', gap:12,
        padding:'16px 24px',
        borderBottom:'1px solid #1e293b',
        background:'#0a0e17',
      }}>
        <div>
          <h1 style={{fontSize:18,fontWeight:700,color:'#f1f5f9',margin:0,letterSpacing:'-0.02em'}}>
            {t('calendar.title')}
          </h1>
          <p style={{fontSize:11,color:'#475569',margin:'2px 0 0'}}>{t('calendar.subtitle')}</p>
        </div>

        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          {/* Hoy */}
          <button onClick={goToday} style={{
            padding:'5px 12px', fontSize:11, fontWeight:600,
            color:'#10b981', border:'1px solid #064e3b',
            background:'transparent', borderRadius:6, cursor:'pointer',
          }}>
            Hoy
          </button>

          {/* Selector propiedad mensual */}
          {view==='monthly' && (
            <select value={selProp} onChange={e=>setSelProp(e.target.value)} style={{
              background:'#0d1117', border:'1px solid #1e293b',
              color:'#cbd5e1', fontSize:11, borderRadius:6,
              padding:'5px 10px', outline:'none',
            }}>
              {properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}

          {/* Navegación período */}
          <div style={{
            display:'flex', alignItems:'center', gap:2,
            background:'#0d1117', border:'1px solid #1e293b',
            borderRadius:6, padding:2,
          }}>
            <button onClick={()=>view==='multi'?shiftDays(-7):prevMonth()} style={{
              width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',
              background:'transparent',border:'none',color:'#64748b',
              cursor:'pointer',borderRadius:4,fontSize:16,fontWeight:300,
            }}>‹</button>
            <span style={{
              padding:'0 12px', fontSize:11, fontWeight:600,
              color:'#94a3b8', minWidth:160, textAlign:'center',
              textTransform:'capitalize',
            }}>
              {view==='multi'
                ? `${multiDays[0].toLocaleDateString('es',{day:'numeric',month:'short'})} — ${multiDays[VISIBLE-1].toLocaleDateString('es',{day:'numeric',month:'short',year:'numeric'})}`
                : monthLabel
              }
            </span>
            <button onClick={()=>view==='multi'?shiftDays(7):nextMonth()} style={{
              width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',
              background:'transparent',border:'none',color:'#64748b',
              cursor:'pointer',borderRadius:4,fontSize:16,fontWeight:300,
            }}>›</button>
          </div>

          {/* Toggle vista */}
          <div style={{display:'flex',background:'#0d1117',border:'1px solid #1e293b',borderRadius:6,padding:2,gap:2}}>
            {(['multi','monthly'] as const).map(v => (
              <button key={v} onClick={()=>setView(v)} style={{
                padding:'4px 12px', fontSize:11, fontWeight:600,
                background: view===v ? '#10b981' : 'transparent',
                color: view===v ? '#fff' : '#64748b',
                border:'none', borderRadius:5, cursor:'pointer',
                transition:'all 0.15s',
              }}>
                {v==='multi' ? '⊞ Multi' : '▦ Mensual'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Leyenda */}
      <div style={{
        display:'flex', alignItems:'center', gap:16,
        padding:'8px 24px',
        borderBottom:'1px solid #1e293b',
        background:'#0a0e17',
      }}>
        {[
          {label:'Confirmada', color:'#059669'},
          {label:'Pendiente',  color:'#d97706'},
          {label:'Airbnb',     color:'#e8414a'},
          {label:'Booking.com',color:'#1a6fc4'},
          {label:'Cancelada',  color:'#dc2626'},
        ].map(l=>(
          <div key={l.label} style={{display:'flex',alignItems:'center',gap:5}}>
            <div style={{width:8,height:8,borderRadius:2,background:l.color}} />
            <span style={{fontSize:10,color:'#475569'}}>{l.label}</span>
          </div>
        ))}
        {view==='multi' && (
          <span style={{marginLeft:'auto',fontSize:10,color:'#1e293b',fontStyle:'italic'}}>
            ← arrastra para desplazarte →
          </span>
        )}
      </div>

      {/* Contenido */}
      <div style={{flex:1, overflow:'auto'}}>
        {loading ? (
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:240}}>
            <div style={{textAlign:'center'}}>
              <div style={{
                width:28,height:28,border:'2px solid #10b981',
                borderTopColor:'transparent',borderRadius:'50%',
                animation:'spin 0.8s linear infinite',margin:'0 auto 12px',
              }} />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              <p style={{color:'#475569',fontSize:12}}>{t('calendar.loading')}</p>
            </div>
          </div>
        ) : view==='multi' ? <MultiView /> : <MonthlyView />}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position:'fixed', zIndex:50, pointerEvents:'none',
          left: tooltip.x+14, top: tooltip.y-10,
        }}>
          <div style={{
            background:'#0f172a', border:'1px solid #1e293b',
            borderRadius:10, boxShadow:'0 20px 40px #00000080',
            padding:'12px 14px', minWidth:190,
          }}>
            <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
              <div style={{width:7,height:7,borderRadius:'50%',background:bookingColor(tooltip.b).solid}} />
              <span style={{fontWeight:700,color:'#f1f5f9',fontSize:13}}>
                {tooltip.b.client.firstName} {tooltip.b.client.lastName}
              </span>
            </div>
            <div style={{fontSize:11,color:'#475569',marginBottom:3}}>{tooltip.b.property?.name}</div>
            <div style={{fontSize:11,color:'#334155'}}>
              {new Date(tooltip.b.checkInDate).toLocaleDateString('es',{day:'numeric',month:'short'})}
              {' → '}
              {new Date(tooltip.b.checkOutDate).toLocaleDateString('es',{day:'numeric',month:'short',year:'numeric'})}
            </div>
            <div style={{marginTop:8,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <span style={{fontWeight:700,fontSize:14,color:'#34d399'}}>
                {Number(tooltip.b.totalAmount).toLocaleString()}€
              </span>
              <span style={{
                fontSize:10,padding:'2px 7px',borderRadius:20,
                background:bookingColor(tooltip.b).bg,
                color:bookingColor(tooltip.b).text,
                fontWeight:600, textTransform:'capitalize',
              }}>
                {tooltip.b.source!=='direct' ? tooltip.b.source : tooltip.b.status}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
