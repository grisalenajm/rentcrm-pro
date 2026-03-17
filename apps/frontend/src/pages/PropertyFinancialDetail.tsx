import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { api } from '../lib/api';

const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const fmtEur = (n: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

interface ReportData {
  property: { id: string; name: string };
  year: number;
  months: { month: number; income: number; expenses: number; profit: number }[];
  totals: { income: number; expenses: number; profit: number; occupancyDays: number };
  byType: Record<string, number>;
  deductibleTotal: number;
  byChannel: Record<string, number>;
}

export default function PropertyFinancialDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    console.log('[PropertyFinancialDetail] propertyId from params:', id);
  }, [id]);

  const { data, isPending, isFetching, isError, error } = useQuery<ReportData>({
    queryKey: ['property-financial-report', id, year],
    queryFn: async () => {
      console.log('[PropertyFinancialDetail] fetching report for propertyId:', id, 'year:', year);
      const res = await api.get(`/financials/property/${id}/report?year=${year}`);
      console.log('[PropertyFinancialDetail] response:', res.data);
      return res.data;
    },
    enabled: !!id,
  });

  const isLoading = isPending && isFetching;

  useEffect(() => {
    if (isError) console.error('[PropertyFinancialDetail] error:', error);
  }, [isError, error]);

  const chartData = (data?.months ?? []).map(m => ({
    name: MONTH_NAMES[m.month - 1],
    Ingresos: +m.income.toFixed(2),
    Gastos: +m.expenses.toFixed(2),
  }));

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => navigate(`/properties/${id}`)}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sm rounded-lg transition-colors text-slate-300">
          ← Volver
        </button>
        <h1 className="text-xl font-bold flex-1">
          {data ? `Finanzas · ${data.property.name}` : 'Finanzas'}
        </h1>
        <select
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500">
          {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {!id && <p className="text-red-400 text-sm">Error: ID de propiedad no encontrado en la URL.</p>}
      {isLoading && <p className="text-slate-400 text-sm">Cargando informe…</p>}
      {!isLoading && isPending && !isError && <p className="text-slate-400 text-sm">Cargando informe…</p>}
      {isError  && <p className="text-red-400 text-sm bg-red-500/10 px-4 py-3 rounded-lg">Error al cargar el informe. Verifica que la propiedad existe y tienes permisos.</p>}

      {data && <>
        {/* Sección 1 — KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Ingresos totales"   value={fmtEur(data.totals.income)}    color="emerald" />
          <KpiCard label="Gastos totales"     value={fmtEur(data.totals.expenses)}  color="red"     />
          <KpiCard label="Beneficio neto"     value={fmtEur(data.totals.profit)}    color={data.totals.profit >= 0 ? 'emerald' : 'red'} />
          <KpiCard label="Gastos deducibles"  value={fmtEur(data.deductibleTotal)}  color="amber"   />
        </div>

        {/* Sección 2 — Gráfico mensual */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
            Ingresos vs Gastos mensuales — {year}
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={v => `${v}€`} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                labelStyle={{ color: '#f8fafc' }}
                formatter={(v: number) => fmtEur(v)}
              />
              <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 13 }} />
              <Bar dataKey="Ingresos" fill="#10b981" radius={[4,4,0,0]} />
              <Bar dataKey="Gastos"   fill="#ef4444" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Secciones 3 y 4 */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Sección 3 — Gastos por tipo */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Desglose gastos por categoría
            </h2>
            {Object.keys(data.byType).length === 0
              ? <p className="text-slate-500 text-sm">Sin gastos registrados</p>
              : <table className="w-full text-sm">
                  <tbody>
                    {Object.entries(data.byType)
                      .sort((a, b) => b[1] - a[1])
                      .map(([type, amount]) => (
                        <tr key={type} className="border-b border-slate-800 last:border-0">
                          <td className="py-2 text-slate-300 capitalize">{type}</td>
                          <td className="py-2 text-right font-semibold text-red-400">{fmtEur(amount)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
            }
          </div>

          {/* Sección 4 — Ingresos por canal */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Ingresos por canal
            </h2>
            {Object.keys(data.byChannel).length === 0
              ? <p className="text-slate-500 text-sm">Sin ingresos registrados</p>
              : <table className="w-full text-sm">
                  <tbody>
                    {Object.entries(data.byChannel)
                      .sort((a, b) => b[1] - a[1])
                      .map(([source, amount]) => (
                        <tr key={source} className="border-b border-slate-800 last:border-0">
                          <td className="py-2 text-slate-300 capitalize">{source}</td>
                          <td className="py-2 text-right font-semibold text-emerald-400">{fmtEur(amount)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
            }
          </div>
        </div>

        {/* Días de ocupación */}
        <p className="text-slate-500 text-xs">
          Días de ocupación {year}: <span className="text-slate-300 font-semibold">{data.totals.occupancyDays}</span>
        </p>
      </>}
    </div>
  );
}

function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: 'text-emerald-400',
    red:     'text-red-400',
    amber:   'text-amber-400',
  };
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
      <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-xl font-bold ${colorMap[color] ?? 'text-white'}`}>{value}</p>
    </div>
  );
}
