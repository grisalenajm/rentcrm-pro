import React from 'react';
import { KPI_CARD, SKELETON } from '../lib/ui';

interface Props {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ReactNode;
  /** Porcentaje de variación vs periodo anterior. Positivo = verde, negativo = rojo. */
  trend?: number;
  loading?: boolean;
  className?: string;
}

export default function KpiCard({ label, value, sub, icon, trend, loading = false, className = '' }: Props) {
  if (loading) {
    return (
      <div className={`${KPI_CARD} ${className}`}>
        <div className={`${SKELETON} h-8 w-24 mb-2`} />
        <div className={`${SKELETON} h-4 w-32`} />
      </div>
    );
  }

  return (
    <div className={`${KPI_CARD} ${className}`}>
      {icon && <div className="mb-2 text-slate-400">{icon}</div>}
      <div className="flex items-baseline gap-2 flex-wrap">
        <div className="text-2xl font-bold text-emerald-400">{value}</div>
        {trend !== undefined && (
          <span className={`text-xs font-semibold ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {trend >= 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      <div className="text-sm font-medium text-white mt-1">{label}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}
