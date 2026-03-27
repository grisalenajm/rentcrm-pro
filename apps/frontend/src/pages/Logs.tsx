import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { badgeCls } from '../lib/ui';

interface AppLogEntry {
  id: string;
  level: 'info' | 'warn' | 'error';
  context: string;
  message: string;
  details?: any;
  createdAt: string;
}

const LEVEL_STYLE: Record<string, string> = {
  info:  'bg-blue-500/10 text-blue-300',
  warn:  'bg-amber-500/10 text-amber-300',
  error: 'bg-red-500/10 text-red-400',
};

const CONTEXT_STYLE: Record<string, string> = {
  iCal:      'bg-violet-500/10 text-violet-300',
  SES:       'bg-emerald-500/10 text-emerald-300',
  Paperless: 'bg-indigo-500/10 text-indigo-300',
};

const contextStyle = (ctx: string) =>
  CONTEXT_STYLE[ctx] ?? 'bg-slate-700/50 text-slate-300';

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function Logs() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [filterLevel, setFilterLevel] = useState('');
  const [filterContext, setFilterContext] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const { data: logs = [], isFetching, refetch } = useQuery<AppLogEntry[]>({
    queryKey: ['app-logs', filterLevel, filterContext],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '200' });
      if (filterLevel) params.set('level', filterLevel);
      if (filterContext) params.set('context', filterContext);
      return api.get(`/logs?${params}`).then(r => r.data);
    },
    refetchInterval: autoRefresh ? 15000 : false,
    staleTime: 5000,
  });

  const clearMutation = useMutation({
    mutationFn: () => api.delete('/logs'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['app-logs'] }),
  });

  const toggleExpand = useCallback((id: string) => {
    setExpanded(prev => prev === id ? null : id);
  }, []);

  const contexts = Array.from(new Set(logs.map(l => l.context))).sort();

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Logs del sistema</h1>
          <p className="text-sm text-white/40 mt-0.5">{logs.length} entradas · iCal, SES, Paperless</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setAutoRefresh(a => !a)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${autoRefresh ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-white/50 hover:text-white border border-white/10'}`}
          >
            {autoRefresh ? '⏱ Auto (15s)' : '⏱ Auto-refresh'}
          </button>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="px-3 py-1.5 bg-slate-800 border border-white/10 rounded-lg text-sm text-white/70 hover:text-white transition-colors disabled:opacity-40"
          >
            {isFetching ? 'Actualizando…' : '↻ Actualizar'}
          </button>
          {user?.role === 'admin' && (
            <button
              onClick={() => { if (confirm('¿Borrar todos los logs?')) clearMutation.mutate(); }}
              className="px-3 py-1.5 bg-red-900/30 border border-red-500/20 rounded-lg text-sm text-red-400 hover:bg-red-900/50 transition-colors"
            >
              Limpiar logs
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={filterLevel}
          onChange={e => setFilterLevel(e.target.value)}
          className="bg-[#0f0f1a] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        >
          <option value="">— Nivel —</option>
          <option value="info">Info</option>
          <option value="warn">Warn</option>
          <option value="error">Error</option>
        </select>
        <select
          value={filterContext}
          onChange={e => setFilterContext(e.target.value)}
          className="bg-[#0f0f1a] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        >
          <option value="">— Contexto —</option>
          {contexts.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {(filterLevel || filterContext) && (
          <button
            onClick={() => { setFilterLevel(''); setFilterContext(''); }}
            className="px-3 py-2 text-sm text-white/50 hover:text-white transition-colors"
          >
            Limpiar filtros ×
          </button>
        )}
      </div>

      {/* Log list */}
      {logs.length === 0 ? (
        <div className="text-center py-20 text-white/30">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-lg">Sin entradas de log</p>
          <p className="text-sm mt-1">Los eventos de iCal, SES y Paperless aparecerán aquí</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {logs.map(entry => (
            <div
              key={entry.id}
              className="bg-[#1a1a2e] border border-white/5 rounded-xl overflow-hidden"
            >
              <div
                className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
                onClick={() => entry.details && toggleExpand(entry.id)}
              >
                {/* Level badge */}
                <span className={`${badgeCls} ${LEVEL_STYLE[entry.level] ?? ''} mt-0.5 shrink-0 uppercase text-[10px]`}>
                  {entry.level}
                </span>

                {/* Context badge */}
                <span className={`${badgeCls} ${contextStyle(entry.context)} mt-0.5 shrink-0`}>
                  {entry.context}
                </span>

                {/* Message */}
                <span className="flex-1 text-sm text-white/80 leading-snug">{entry.message}</span>

                {/* Timestamp */}
                <span className="text-xs text-white/30 shrink-0 mt-0.5 font-mono">{formatDate(entry.createdAt)}</span>

                {/* Expand indicator */}
                {entry.details && (
                  <span className="text-white/20 text-xs shrink-0 mt-0.5">
                    {expanded === entry.id ? '▲' : '▼'}
                  </span>
                )}
              </div>

              {/* Expanded details */}
              {expanded === entry.id && entry.details && (
                <div className="border-t border-white/5 px-4 py-3 bg-black/20">
                  <pre className="text-xs text-white/50 font-mono overflow-x-auto whitespace-pre-wrap break-all">
                    {JSON.stringify(entry.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
