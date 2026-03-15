import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell,
} from 'recharts';

const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const PIE_COLORS = ['#10b981','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16','#a855f7','#ec4899'];
const TABS = ['Resumen','Negocio','Clientes','Cumplimiento'];
const NOW = new Date();
const CURRENT_YEAR = NOW.getFullYear();
const YEARS = [CURRENT_YEAR - 4, CURRENT_YEAR - 3, CURRENT_YEAR - 2, CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1];
const FIVE_YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 4 + i);

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function nightsBetween(checkIn: string, checkOut: string) {
  return Math.max(0, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000));
}

function kpiCard(label: string, value: string | number, sub?: string) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="text-2xl font-bold text-emerald-400">{value}</div>
      <div className="text-sm font-medium text-white mt-1">{label}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function toTop10WithOthers(counts: Record<string, number>) {
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const top10 = sorted.slice(0, 10).map(([name, value]) => ({ name, value }));
  const others = sorted.slice(10).reduce((s, [, v]) => s + v, 0);
  if (others > 0) top10.push({ name: 'Otros', value: others });
  return top10;
}

const tooltipStyle = { backgroundColor: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', borderRadius: 8 };

type ViewMode = 'monthly' | 'annual' | 'compare';

export default function Dashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [compareYearB, setCompareYearB] = useState(CURRENT_YEAR - 1);
  const [viewMode, setViewMode] = useState<ViewMode>('monthly');
  const [occupancyPropId, setOccupancyPropId] = useState('');
  const [heatMapPropId, setHeatMapPropId] = useState('');
  const [bizPeriod, setBizPeriod] = useState<'month'|'quarter'|'year'>('year');

  const { data: bookings = [] }   = useQuery({ queryKey: ['bookings'],    queryFn: () => api.get('/bookings').then(r => r.data) });
  const { data: properties = [] } = useQuery({ queryKey: ['properties'],  queryFn: () => api.get('/properties').then(r => r.data) });
  const { data: clients = [] }    = useQuery({ queryKey: ['clients'],     queryFn: () => api.get('/clients').then(r => r.data) });
  const { data: financials = [] } = useQuery({ queryKey: ['financials-dashboard'], queryFn: () => api.get('/financials').then(r => r.data) });
  const { data: expenses = [] }   = useQuery({ queryKey: ['expenses-dashboard'],   queryFn: () => api.get('/expenses').then(r => r.data) });
  const { data: contracts = [] }  = useQuery({ queryKey: ['contracts'],   queryFn: () => api.get('/contracts').then(r => r.data) });

  // ── TAB 1: RESUMEN ────────────────────────────────────────────────────────

  const todayStr = NOW.toISOString().slice(0, 10);

  const occupancyToday = useMemo(() => {
    const occupied = new Set(
      bookings.filter((b: any) =>
        b.status !== 'cancelled' &&
        b.checkInDate.slice(0, 10) <= todayStr &&
        b.checkOutDate.slice(0, 10) > todayStr
      ).map((b: any) => b.propertyId)
    );
    return properties.length > 0 ? Math.round(occupied.size / properties.length * 100) : 0;
  }, [bookings, properties, todayStr]);

  const monthIncome = useMemo(() =>
    financials.filter((f: any) => {
      const d = new Date(f.date);
      return f.type === 'income' && d.getFullYear() === CURRENT_YEAR && d.getMonth() === NOW.getMonth();
    }).reduce((s: number, f: any) => s + Number(f.amount), 0),
    [financials]);

  const activeBookings = useMemo(() =>
    bookings.filter((b: any) =>
      b.status !== 'cancelled' && b.checkOutDate.slice(0, 10) >= todayStr
    ).length,
    [bookings, todayStr]);

  const checkinsPendingToday = useMemo(() =>
    bookings.filter((b: any) =>
      b.checkInDate.slice(0, 10) === todayStr && b.checkinStatus !== 'completed'
    ).length,
    [bookings, todayStr]);

  // Helpers para extraer ingresos/gastos por año+mes
  const getIncome = (yr: number, mo?: number) =>
    financials.filter((f: any) => {
      const d = new Date(f.date);
      return f.type === 'income' && d.getFullYear() === yr && (mo === undefined || d.getMonth() === mo);
    }).reduce((s: number, f: any) => s + Number(f.amount), 0);

  const getExpense = (yr: number, mo?: number) =>
    expenses.filter((e: any) => {
      const d = new Date(e.date);
      return d.getFullYear() === yr && (mo === undefined || d.getMonth() === mo);
    }).reduce((s: number, e: any) => s + Number(e.amount), 0);

  // Bar chart: viewMode-aware
  const chartBarData = useMemo(() => {
    if (viewMode === 'annual') {
      return FIVE_YEARS.map(yr => ({
        name: String(yr),
        ingresos: Math.round(getIncome(yr)),
        gastos:   Math.round(getExpense(yr)),
      }));
    }
    if (viewMode === 'compare') {
      const yA = selectedYear, yB = compareYearB;
      return MONTHS.map((name, mo) => ({
        name,
        [`ing.${yA}`]: Math.round(getIncome(yA, mo)),
        [`gas.${yA}`]: Math.round(getExpense(yA, mo)),
        [`ing.${yB}`]: Math.round(getIncome(yB, mo)),
        [`gas.${yB}`]: Math.round(getExpense(yB, mo)),
      }));
    }
    // monthly
    return MONTHS.map((name, mo) => ({
      name,
      ingresos: Math.round(getIncome(selectedYear, mo)),
      gastos:   Math.round(getExpense(selectedYear, mo)),
    }));
  }, [financials, expenses, viewMode, selectedYear, compareYearB]);

  // Line chart: viewMode-aware
  const propId = occupancyPropId || (properties[0]?.id ?? '');

  const getMonthOccupancy = (yr: number, mo: number, pid: string) => {
    const days = daysInMonth(yr, mo);
    const occupied = new Set<number>();
    bookings.filter((b: any) => b.propertyId === pid && b.status !== 'cancelled').forEach((b: any) => {
      const start = new Date(b.checkInDate), end = new Date(b.checkOutDate);
      for (const d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
        if (d.getFullYear() === yr && d.getMonth() === mo) occupied.add(d.getDate());
      }
    });
    return days > 0 ? Math.round(occupied.size / days * 100) : 0;
  };

  const getYearOccupancy = (yr: number, pid: string) => {
    const totalDays = MONTHS.reduce((s, _, mo) => s + daysInMonth(yr, mo), 0);
    const occupied = new Set<string>();
    bookings.filter((b: any) => b.propertyId === pid && b.status !== 'cancelled').forEach((b: any) => {
      const start = new Date(b.checkInDate), end = new Date(b.checkOutDate);
      for (const d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
        if (d.getFullYear() === yr) occupied.add(`${d.getMonth()}-${d.getDate()}`);
      }
    });
    return totalDays > 0 ? Math.round(occupied.size / totalDays * 100) : 0;
  };

  const chartLineData = useMemo(() => {
    if (viewMode === 'annual') {
      return FIVE_YEARS.map(yr => ({
        name: String(yr),
        'Ocupación %': getYearOccupancy(yr, propId),
      }));
    }
    if (viewMode === 'compare') {
      const yA = selectedYear, yB = compareYearB;
      return MONTHS.map((name, mo) => ({
        name,
        [`Ocup.${yA}`]: getMonthOccupancy(yA, mo, propId),
        [`Ocup.${yB}`]: getMonthOccupancy(yB, mo, propId),
      }));
    }
    return MONTHS.map((name, mo) => ({
      name,
      'Ocupación %': getMonthOccupancy(selectedYear, mo, propId),
    }));
  }, [bookings, propId, viewMode, selectedYear, compareYearB]);

  // Heat map: filtrable por propiedad
  const heatMap = useMemo(() => {
    const grid: boolean[][] = Array.from({ length: 12 }, () => Array(31).fill(false));
    bookings.filter((b: any) =>
      b.status !== 'cancelled' && (!heatMapPropId || b.propertyId === heatMapPropId)
    ).forEach((b: any) => {
      const start = new Date(b.checkInDate);
      const end   = new Date(b.checkOutDate);
      for (const d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
        if (d.getFullYear() === selectedYear) {
          grid[d.getMonth()][d.getDate() - 1] = true;
        }
      }
    });
    return grid;
  }, [bookings, selectedYear, heatMapPropId]);

  // ── TAB 2: NEGOCIO ────────────────────────────────────────────────────────

  const getBizRange = (period: 'month'|'quarter'|'year') => {
    if (period === 'month') {
      return { from: new Date(selectedYear, NOW.getMonth(), 1), to: new Date(selectedYear, NOW.getMonth() + 1, 0, 23, 59, 59) };
    } else if (period === 'quarter') {
      const q = Math.floor(NOW.getMonth() / 3);
      return { from: new Date(selectedYear, q * 3, 1), to: new Date(selectedYear, q * 3 + 3, 0, 23, 59, 59) };
    }
    return { from: new Date(selectedYear, 0, 1), to: new Date(selectedYear, 11, 31, 23, 59, 59) };
  };

  const propertyProfitability = useMemo(() => {
    return properties.map((p: any) => {
      const income = financials.filter((f: any) => {
        const d = new Date(f.date);
        return f.propertyId === p.id && f.type === 'income' && d.getFullYear() === selectedYear;
      }).reduce((s: number, f: any) => s + Number(f.amount), 0);
      const expense = expenses.filter((e: any) => {
        const d = new Date(e.date);
        return e.propertyId === p.id && d.getFullYear() === selectedYear;
      }).reduce((s: number, e: any) => s + Number(e.amount), 0);
      const net = income - expense;
      const roi = expense > 0 ? Math.round(net / expense * 100) : 0;
      return { id: p.id, name: p.name, income: Math.round(income), expense: Math.round(expense), net: Math.round(net), roi };
    }).sort((a: any, b: any) => b.income - a.income);
  }, [properties, financials, expenses, selectedYear]);

  const sourcePieData = useMemo(() => {
    const { from, to } = getBizRange(bizPeriod);
    const counts: Record<string, number> = {};
    bookings.filter((b: any) => {
      const d = new Date(b.checkInDate);
      return b.status !== 'cancelled' && d >= from && d <= to;
    }).forEach((b: any) => {
      const src = b.source || 'direct';
      counts[src] = (counts[src] || 0) + 1;
    });
    return toTop10WithOthers(counts);
  }, [bookings, bizPeriod, selectedYear]);

  const bizMetrics = useMemo(() => {
    const { from, to } = getBizRange(bizPeriod);
    const periodBkgs = bookings.filter((b: any) => {
      const d = new Date(b.checkInDate);
      return b.status !== 'cancelled' && d >= from && d <= to;
    });
    const prevFrom = new Date(from); prevFrom.setFullYear(prevFrom.getFullYear() - 1);
    const prevTo   = new Date(to);   prevTo.setFullYear(prevTo.getFullYear() - 1);
    const prevBkgs = bookings.filter((b: any) => {
      const d = new Date(b.checkInDate);
      return b.status !== 'cancelled' && d >= prevFrom && d <= prevTo;
    });
    const avgPrice = (bkgs: any[]) => bkgs.length > 0
      ? Math.round(bkgs.reduce((s: number, b: any) => s + Number(b.totalAmount || 0), 0) / bkgs.length)
      : 0;
    const avgNights = (bkgs: any[]) => bkgs.length > 0
      ? Math.round(bkgs.reduce((s: number, b: any) => s + nightsBetween(b.checkInDate, b.checkOutDate), 0) / bkgs.length * 10) / 10
      : 0;
    return {
      count: periodBkgs.length,
      avgPrice: avgPrice(periodBkgs),
      avgNights: avgNights(periodBkgs),
      prevCount: prevBkgs.length,
      prevAvgPrice: avgPrice(prevBkgs),
      prevAvgNights: avgNights(prevBkgs),
    };
  }, [bookings, bizPeriod, selectedYear]);

  // ── TAB 3: CLIENTES ───────────────────────────────────────────────────────

  const clientData = useMemo(() => {
    const spending: Record<string, { client: any; total: number; count: number; lastVisit: string }> = {};
    bookings.filter((b: any) => b.clientId && b.status !== 'cancelled').forEach((b: any) => {
      const id = b.clientId;
      if (!spending[id]) spending[id] = { client: b.client, total: 0, count: 0, lastVisit: b.checkInDate };
      spending[id].total += Number(b.totalAmount || 0);
      spending[id].count++;
      if (b.checkInDate > spending[id].lastVisit) spending[id].lastVisit = b.checkInDate;
    });
    const sorted = Object.values(spending).sort((a, b) => b.total - a.total);
    const top10 = sorted.slice(0, 10);
    const newC = sorted.filter(c => c.count === 1).length;
    const retC = sorted.filter(c => c.count > 1).length;
    return { top10, newClients: newC, returningClients: retC };
  }, [bookings]);

  const nationalityPie = useMemo(() => {
    const counts: Record<string, number> = {};
    clients.forEach((c: any) => {
      const nat = c.nationality || c.country || 'Desconocida';
      counts[nat] = (counts[nat] || 0) + 1;
    });
    return toTop10WithOthers(counts);
  }, [clients]);

  // ── TAB 4: CUMPLIMIENTO ───────────────────────────────────────────────────

  const sesData = useMemo(() => {
    const monthBkgs = bookings.filter((b: any) => {
      const d = new Date(b.checkInDate);
      return d.getFullYear() === NOW.getFullYear() && d.getMonth() === NOW.getMonth();
    });
    const sent    = monthBkgs.filter((b: any) => b.sesStatus === 'enviado').length;
    const error   = monthBkgs.filter((b: any) => b.sesStatus === 'error').length;
    const pending = monthBkgs.filter((b: any) => !b.sesStatus).length;
    const pendingList = bookings.filter((b: any) =>
      b.status !== 'cancelled' && b.sesStatus !== 'enviado'
    ).slice(0, 20);
    return { sent, error, pending, pendingList };
  }, [bookings]);

  const checkinData = useMemo(() => {
    const monthBkgs = bookings.filter((b: any) => {
      const d = new Date(b.checkInDate);
      return d.getFullYear() === NOW.getFullYear() && d.getMonth() === NOW.getMonth();
    });
    const done    = monthBkgs.filter((b: any) => b.checkinStatus === 'completed').length;
    const pending = monthBkgs.filter((b: any) => b.checkinStatus !== 'completed').length;
    return { done, pending };
  }, [bookings]);

  const contractData = useMemo(() => {
    const monthContracts = contracts.filter((c: any) => {
      const d = new Date(c.createdAt);
      return d.getFullYear() === NOW.getFullYear() && d.getMonth() === NOW.getMonth();
    });
    const signed   = monthContracts.filter((c: any) => c.signedAt).length;
    const unsigned = monthContracts.filter((c: any) => !c.signedAt).length;
    return { signed, unsigned };
  }, [contracts]);

  const periodLabel = bizPeriod === 'month' ? MONTHS[NOW.getMonth()] : bizPeriod === 'quarter' ? `Q${Math.floor(NOW.getMonth() / 3) + 1}` : 'Año completo';
  const delta = (curr: number, prev: number) => {
    if (prev === 0) return null;
    const pct = Math.round((curr - prev) / prev * 100);
    return <span className={`text-xs ml-1 ${pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{pct >= 0 ? '▲' : '▼'}{Math.abs(pct)}% vs año ant.</span>;
  };

  const viewModeLabel = viewMode === 'monthly' ? 'Mensual' : viewMode === 'annual' ? 'Anual' : 'Comparativa';
  const barChartTitle = viewMode === 'annual'
    ? `Ingresos vs Gastos — ${FIVE_YEARS[0]}–${FIVE_YEARS[4]}`
    : viewMode === 'compare'
    ? `Ingresos vs Gastos — ${selectedYear} vs ${compareYearB}`
    : `Ingresos vs Gastos — ${selectedYear}`;

  const lineChartTitle = viewMode === 'annual'
    ? `Ocupación anual`
    : viewMode === 'compare'
    ? `Ocupación — ${selectedYear} vs ${compareYearB}`
    : `Ocupación mensual — ${selectedYear}`;

  // ── RENDER ────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex flex-wrap items-center gap-3">
          {/* Año selector */}
          {viewMode !== 'annual' && (
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-sm">{viewMode === 'compare' ? 'Año A:' : 'Año:'}</span>
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}

          {/* Año B — solo en comparativa */}
          {viewMode === 'compare' && (
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-sm">Año B:</span>
              <select
                value={compareYearB}
                onChange={e => setCompareYearB(Number(e.target.value))}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}

          {/* Vista selector */}
          <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
            {(['monthly', 'annual', 'compare'] as ViewMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  viewMode === mode ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {mode === 'monthly' ? 'Mensual' : mode === 'annual' ? 'Anual' : 'Comparativa'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-800 mb-6 overflow-x-auto">
        {TABS.map((tab, i) => (
          <button
            key={i}
            onClick={() => setActiveTab(i)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px
              ${activeTab === i
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── TAB 1: RESUMEN ── */}
      {activeTab === 0 && (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {kpiCard('Ocupación actual', `${occupancyToday}%`, `${properties.length} propiedades`)}
            {kpiCard('Ingresos del mes', `€${monthIncome.toLocaleString('es-ES', { maximumFractionDigits: 0 })}`, MONTHS[NOW.getMonth()])}
            {kpiCard('Reservas activas', activeBookings, 'en curso o próximas')}
            {kpiCard('Checkins hoy', checkinsPendingToday, 'pendientes de completar')}
          </div>

          {/* Bar: ingresos vs gastos */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h2 className="font-semibold mb-4">{barChartTitle}</h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartBarData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={v => `€${v}`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`€${Number(v).toLocaleString('es-ES')}`, '']} />
                <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 13 }} />
                {viewMode === 'compare' ? (
                  <>
                    <Bar dataKey={`ing.${selectedYear}`}  fill="#10b981" name={`Ingresos ${selectedYear}`}  radius={[3,3,0,0]} />
                    <Bar dataKey={`gas.${selectedYear}`}  fill="#ef4444" name={`Gastos ${selectedYear}`}    radius={[3,3,0,0]} />
                    <Bar dataKey={`ing.${compareYearB}`} fill="#06b6d4" name={`Ingresos ${compareYearB}`}  radius={[3,3,0,0]} />
                    <Bar dataKey={`gas.${compareYearB}`} fill="#f97316" name={`Gastos ${compareYearB}`}    radius={[3,3,0,0]} />
                  </>
                ) : (
                  <>
                    <Bar dataKey="ingresos" fill="#10b981" radius={[3,3,0,0]} />
                    <Bar dataKey="gastos"   fill="#ef4444" radius={[3,3,0,0]} />
                  </>
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Line: ocupación */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h2 className="font-semibold">{lineChartTitle}</h2>
              {viewMode !== 'annual' && (
                <select
                  value={occupancyPropId}
                  onChange={e => setOccupancyPropId(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  {properties.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartLineData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`${v}%`, '']} />
                <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 13 }} />
                {viewMode === 'compare' ? (
                  <>
                    <Line type="monotone" dataKey={`Ocup.${selectedYear}`}  stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 3 }} name={`Ocup. ${selectedYear}`} />
                    <Line type="monotone" dataKey={`Ocup.${compareYearB}`} stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 3 }} name={`Ocup. ${compareYearB}`} />
                  </>
                ) : (
                  <Line type="monotone" dataKey="Ocupación %" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 3 }} />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Heat map: días ocupados */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h2 className="font-semibold">Días ocupados — {selectedYear}</h2>
              <select
                value={heatMapPropId}
                onChange={e => setHeatMapPropId(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">Todas las propiedades</option>
                {properties.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[560px]">
                {/* Day headers */}
                <div className="flex gap-0.5 mb-1 ml-8">
                  {Array.from({ length: 31 }, (_, d) => (
                    <div key={d} className="w-4 text-center text-slate-600 text-[9px] shrink-0">{d + 1}</div>
                  ))}
                </div>
                {heatMap.map((days, mo) => (
                  <div key={mo} className="flex items-center gap-0.5 mb-0.5">
                    <div className="w-7 text-slate-400 text-[11px] text-right mr-1 shrink-0">{MONTHS[mo]}</div>
                    {days.map((occupied, d) => {
                      const maxDay = daysInMonth(selectedYear, mo);
                      return (
                        <div
                          key={d}
                          className={`w-4 h-4 rounded-sm shrink-0 ${
                            d >= maxDay ? 'opacity-0' : occupied ? 'bg-emerald-500' : 'bg-slate-800'
                          }`}
                        />
                      );
                    })}
                  </div>
                ))}
                <div className="flex items-center gap-3 mt-3">
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-emerald-500" /><span className="text-xs text-slate-400">Ocupado</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-slate-800" /><span className="text-xs text-slate-400">Libre</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: NEGOCIO ── */}
      {activeTab === 1 && (
        <div className="space-y-6">
          {/* Period selector */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm">Periodo:</span>
            {(['month','quarter','year'] as const).map(p => (
              <button
                key={p}
                onClick={() => setBizPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  bizPeriod === p ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {p === 'month' ? 'Mes' : p === 'quarter' ? 'Trimestre' : 'Año'}
              </button>
            ))}
            <span className="text-slate-500 text-sm">· {periodLabel}</span>
          </div>

          {/* Metrics row */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="text-2xl font-bold text-emerald-400">
                €{bizMetrics.avgPrice.toLocaleString('es-ES')}
                {delta(bizMetrics.avgPrice, bizMetrics.prevAvgPrice)}
              </div>
              <div className="text-sm text-white mt-1">Precio medio reserva</div>
              <div className="text-xs text-slate-400">{bizMetrics.count} reservas · {bizMetrics.prevCount} año ant.</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="text-2xl font-bold text-emerald-400">
                {bizMetrics.avgNights} noches
                {delta(bizMetrics.avgNights, bizMetrics.prevAvgNights)}
              </div>
              <div className="text-sm text-white mt-1">Estancia media</div>
              <div className="text-xs text-slate-400">{bizMetrics.prevAvgNights} noches año anterior</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 col-span-2 md:col-span-1">
              <div className="text-2xl font-bold text-blue-400">{bizMetrics.count}</div>
              <div className="text-sm text-white mt-1">Reservas en el periodo</div>
              <div className="text-xs text-slate-400">{bizMetrics.prevCount} mismo periodo año anterior</div>
            </div>
          </div>

          {/* Property profitability table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800">
              <h2 className="font-semibold">Rentabilidad por propiedad — {viewModeLabel} {viewMode !== 'annual' ? selectedYear : ''}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    {['Propiedad','Ingresos','Gastos','Beneficio neto','ROI %'].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-slate-400 font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {propertyProfitability.map((p: any) => (
                    <tr key={p.id} className="border-b border-slate-800 last:border-0 hover:bg-slate-800/50">
                      <td className="px-5 py-3 font-medium">{p.name}</td>
                      <td className="px-5 py-3 text-emerald-400">€{p.income.toLocaleString('es-ES')}</td>
                      <td className="px-5 py-3 text-red-400">€{p.expense.toLocaleString('es-ES')}</td>
                      <td className={`px-5 py-3 font-semibold ${p.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>€{p.net.toLocaleString('es-ES')}</td>
                      <td className={`px-5 py-3 font-semibold ${p.roi >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{p.roi}%</td>
                    </tr>
                  ))}
                  {propertyProfitability.length === 0 && (
                    <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400 text-sm">Sin datos para {selectedYear}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Ranking horizontal bars */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h2 className="font-semibold mb-4">Ranking por ingresos — {viewMode !== 'annual' ? selectedYear : `${FIVE_YEARS[0]}–${FIVE_YEARS[4]}`}</h2>
              {propertyProfitability.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(200, propertyProfitability.length * 44)}>
                  <BarChart
                    data={propertyProfitability}
                    layout="vertical"
                    margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                    <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => `€${v}`} />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#e2e8f0', fontSize: 12 }} width={100} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`€${Number(v).toLocaleString('es-ES')}`, 'Ingresos']} />
                    <Bar dataKey="income" fill="#10b981" radius={[0,3,3,0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-slate-400 text-sm text-center py-10">Sin datos</div>
              )}
            </div>

            {/* Pie: origen reservas — top 10 + otros */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h2 className="font-semibold mb-4">Origen de reservas — {periodLabel}</h2>
              {sourcePieData.length > 0 ? (
                <div className="flex flex-col items-center">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={sourcePieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`} labelLine={false}>
                        {sourcePieData.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-2 justify-center mt-2">
                    {sourcePieData.map((s: any, i: number) => (
                      <div key={s.name} className="flex items-center gap-1.5 text-xs text-slate-300">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        {s.name} ({s.value})
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-slate-400 text-sm text-center py-10">Sin datos</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: CLIENTES ── */}
      {activeTab === 2 && (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {kpiCard('Clientes únicos', clientData.top10.length + (Object.keys(clientData).length > 3 ? '...' : ''), 'con reservas')}
            {kpiCard('Clientes nuevos', clientData.newClients, '1 sola estancia')}
            {kpiCard('Clientes repetidores', clientData.returningClients,
              clientData.newClients + clientData.returningClients > 0
                ? `${Math.round(clientData.returningClients / (clientData.newClients + clientData.returningClients) * 100)}% del total`
                : '—'
            )}
          </div>

          {/* Top 10 clients table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800">
              <h2 className="font-semibold">Top 10 clientes por gasto</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    {['#','Cliente','Estancias','Gasto total','Última visita'].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-slate-400 font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {clientData.top10.map((c, i) => (
                    <tr
                      key={c.client?.id ?? i}
                      className="border-b border-slate-800 last:border-0 hover:bg-slate-800/50 cursor-pointer"
                      onClick={() => c.client?.id && navigate(`/clients/${c.client.id}`)}
                    >
                      <td className="px-5 py-3 text-slate-400">{i + 1}</td>
                      <td className="px-5 py-3 font-medium">{c.client?.firstName} {c.client?.lastName}</td>
                      <td className="px-5 py-3 text-slate-300">{c.count}</td>
                      <td className="px-5 py-3 font-semibold text-emerald-400">€{Math.round(c.total).toLocaleString('es-ES')}</td>
                      <td className="px-5 py-3 text-slate-400">{new Date(c.lastVisit).toLocaleDateString('es-ES')}</td>
                    </tr>
                  ))}
                  {clientData.top10.length === 0 && (
                    <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400 text-sm">Sin datos</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Nationality pie — top 10 + otros */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h2 className="font-semibold mb-4">Nacionalidades de huéspedes</h2>
            {nationalityPie.length > 0 ? (
              <div className="flex flex-col md:flex-row items-center gap-6">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={nationalityPie} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => percent > 0.04 ? `${name} ${Math.round(percent * 100)}%` : ''} labelLine={false}>
                      {nationalityPie.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                  {nationalityPie.map((n: any, i: number) => (
                    <div key={n.name} className="flex items-center gap-1.5 text-xs text-slate-300">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      {n.name} ({n.value})
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-slate-400 text-sm text-center py-10">Sin datos de clientes</div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 4: CUMPLIMIENTO ── */}
      {activeTab === 3 && (
        <div className="space-y-6">
          {/* SES KPIs */}
          <div>
            <h2 className="font-semibold mb-3 text-slate-300">Partes SES — {MONTHS[NOW.getMonth()]} {NOW.getFullYear()}</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <div className="text-2xl font-bold text-emerald-400">✅ {sesData.sent}</div>
                <div className="text-sm text-white mt-1">Enviados</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <div className="text-2xl font-bold text-red-400">❌ {sesData.error}</div>
                <div className="text-sm text-white mt-1">Con error</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 col-span-2 md:col-span-1">
                <div className="text-2xl font-bold text-amber-400">⏳ {sesData.pending}</div>
                <div className="text-sm text-white mt-1">Pendientes</div>
              </div>
            </div>
          </div>

          {/* Pending SES list */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="font-semibold">Reservas con SES pendiente</h2>
              <button onClick={() => navigate('/police')} className="text-xs text-emerald-400 hover:text-emerald-300">Ir a Partes SES →</button>
            </div>
            {sesData.pendingList.length === 0 ? (
              <div className="text-slate-400 text-sm text-center py-8">✅ Todo al día</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800">
                      {['Check-in','Propiedad','Cliente','Estado SES'].map(h => (
                        <th key={h} className="text-left px-5 py-3 text-slate-400 font-semibold whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sesData.pendingList.map((b: any) => (
                      <tr key={b.id} className="border-b border-slate-800 last:border-0 hover:bg-slate-800/50 cursor-pointer" onClick={() => navigate('/police')}>
                        <td className="px-5 py-3 text-slate-300">{new Date(b.checkInDate).toLocaleDateString('es-ES')}</td>
                        <td className="px-5 py-3 text-slate-300">{b.property?.name}</td>
                        <td className="px-5 py-3 font-medium">{b.client?.firstName} {b.client?.lastName}</td>
                        <td className="px-5 py-3">
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                            b.sesStatus === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'
                          }`}>
                            {b.sesStatus === 'error' ? '❌ Error' : '⏳ Pendiente'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Checkin KPIs */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h2 className="font-semibold mb-4">Check-in online — {MONTHS[NOW.getMonth()]}</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">✅ Completados</span>
                  <span className="font-bold text-emerald-400">{checkinData.done}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">⏳ Pendientes</span>
                  <span className="font-bold text-amber-400">{checkinData.pending}</span>
                </div>
                {checkinData.done + checkinData.pending > 0 && (
                  <div>
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>Progreso</span>
                      <span>{Math.round(checkinData.done / (checkinData.done + checkinData.pending) * 100)}%</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full">
                      <div
                        className="h-2 bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${Math.round(checkinData.done / (checkinData.done + checkinData.pending) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Contracts KPIs */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h2 className="font-semibold mb-4">Contratos — {MONTHS[NOW.getMonth()]}</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">✅ Firmados</span>
                  <span className="font-bold text-emerald-400">{contractData.signed}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">⏳ Sin firmar</span>
                  <span className="font-bold text-amber-400">{contractData.unsigned}</span>
                </div>
                {contractData.signed + contractData.unsigned > 0 && (
                  <div>
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>Firmados</span>
                      <span>{Math.round(contractData.signed / (contractData.signed + contractData.unsigned) * 100)}%</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full">
                      <div
                        className="h-2 bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${Math.round(contractData.signed / (contractData.signed + contractData.unsigned) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
                {contractData.signed + contractData.unsigned === 0 && (
                  <div className="text-slate-400 text-sm text-center py-2">Sin contratos este mes</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
