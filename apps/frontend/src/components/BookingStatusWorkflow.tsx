import { useState } from 'react';
import { api } from '../lib/api';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  created:    { label: 'Creada',      color: 'bg-amber-500/10 text-amber-400' },
  registered: { label: 'Registrada',  color: 'bg-blue-500/10 text-blue-400' },
  processed:  { label: 'Procesada',   color: 'bg-emerald-500/10 text-emerald-400' },
  error:      { label: 'Error',       color: 'bg-red-500/10 text-red-400' },
  cancelled:  { label: 'Cancelada',   color: 'bg-slate-500/10 text-slate-400' },
};

export default function BookingStatusWorkflow({ booking, onUpdate }: { booking: any; onUpdate: () => void }) {
  const status: string = booking.status;
  const config = STATUS_CONFIG[status] ?? { label: status, color: 'bg-slate-500/10 text-slate-400' };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleTransition = async (newStatus: string) => {
    if (newStatus === 'cancelled' && !confirm('¿Cancelar esta reserva?')) return;
    setLoading(true);
    setError('');
    try {
      await api.patch(`/bookings/${booking.id}/status`, { status: newStatus });
      onUpdate();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Error al cambiar estado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${config.color}`}>
          {config.label}
        </span>
        {status === 'created' && (
          <>
            <button onClick={() => handleTransition('registered')} disabled={loading}
              className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? '…' : 'Confirmar registro'}
            </button>
            <button onClick={() => handleTransition('cancelled')} disabled={loading}
              className="px-3 py-1.5 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? '…' : 'Cancelar'}
            </button>
          </>
        )}
        {status === 'registered' && (
          <>
            <button onClick={() => handleTransition('processed')} disabled={loading}
              className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? '…' : 'Marcar procesada'}
            </button>
            <button onClick={() => handleTransition('error')} disabled={loading}
              className="px-3 py-1.5 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? '…' : 'Marcar error'}
            </button>
            <button onClick={() => handleTransition('cancelled')} disabled={loading}
              className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? '…' : 'Cancelar'}
            </button>
          </>
        )}
        {status === 'error' && (
          <>
            <button onClick={() => handleTransition('registered')} disabled={loading}
              className="px-3 py-1.5 text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? '…' : 'Reintentar'}
            </button>
            <button onClick={() => handleTransition('cancelled')} disabled={loading}
              className="px-3 py-1.5 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? '…' : 'Cancelar'}
            </button>
          </>
        )}
      </div>
      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>
      )}
    </div>
  );
}
