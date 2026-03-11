import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

type SesStatus = 'enviado' | 'error' | null;

interface Booking {
  id: string;
  sesStatus: SesStatus;
  sesLote: string | null;
  sesSentAt: string | null;
  checkInDate: string;
  checkOutDate: string;
  client?: { firstName: string; lastName: string };
  property?: { id: string; name: string };
  guestsSes?: any[];
}

const sesBadge = (status: SesStatus) => {
  if (status === 'enviado') return 'bg-emerald-500/10 text-emerald-400';
  if (status === 'error')   return 'bg-red-500/10 text-red-400';
  return 'bg-amber-500/10 text-amber-400';
};

const sesLabel = (status: SesStatus) => {
  if (status === 'enviado') return '✅ Enviado';
  if (status === 'error')   return '❌ Error';
  return '⏳ Pendiente';
};

const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-ES');
const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function Police() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [filterStatus, setFilterStatus] = useState<'all' | 'enviado' | 'error' | 'pendiente'>('all');
  const [filterProperty, setFilterProperty] = useState('');
  const [filterMonth, setFilterMonth] = useState('');

  const [confirmBooking, setConfirmBooking] = useState<Booking | null>(null);
  const [sendResult, setSendResult] = useState<{ id: string; ok: boolean; message: string } | null>(null);

  const { data: bookingsRaw, isLoading } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => api.get('/bookings').then(r => r.data),
  });
  const allBookings: Booking[] = bookingsRaw?.data || bookingsRaw || [];

  // Filtrar reservas con actividad SES (enviadas o con error)
  const sesBookings = allBookings.filter(
    b => b.sesSentAt != null || b.sesStatus === 'error'
  );

  const properties = Array.from(
    new Map(sesBookings.map(b => [b.property?.id, b.property]).filter(([id]) => id)).values()
  );

  // Estadísticas del mes actual
  const now = new Date();
  const thisMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const thisMonthBookings = sesBookings.filter(b => b.sesSentAt?.startsWith(thisMonthStr));
  const thisMonthEnviados = thisMonthBookings.filter(b => b.sesStatus === 'enviado').length;
  const thisMonthErrores  = thisMonthBookings.filter(b => b.sesStatus === 'error').length;

  // Aplicar filtros
  const filtered = sesBookings.filter(b => {
    if (filterStatus === 'enviado'  && b.sesStatus !== 'enviado') return false;
    if (filterStatus === 'error'    && b.sesStatus !== 'error')   return false;
    if (filterStatus === 'pendiente' && b.sesStatus != null && b.sesStatus !== 'error') return false;
    if (filterProperty && b.property?.id !== filterProperty)      return false;
    if (filterMonth && b.sesSentAt && !b.sesSentAt.startsWith(filterMonth)) return false;
    return true;
  });

  const sendMutation = useMutation({
    mutationFn: (id: string) => api.post(`/bookings/${id}/ses/send`),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
      setSendResult({ id, ok: true, message: '✅ Parte SES enviado correctamente.' });
      setConfirmBooking(null);
    },
    onError: (err: any, id) => {
      const msg = err?.response?.data?.message || 'Error al enviar el parte SES.';
      setSendResult({ id, ok: false, message: `❌ ${msg}` });
      setConfirmBooking(null);
    },
  });

  const downloadUrl = (id: string, type: 'xml' | 'pdf') =>
    `http://${window.location.hostname}:3001/api/bookings/${id}/ses/${type}`;

  const canResend = (b: Booking) => b.sesStatus === 'error' || b.sesStatus == null;

  // Generar opciones de mes/año para el filtro
  const monthOptions: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthOptions.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const fmtMonthLabel = (m: string) => {
    const [y, mo] = m.split('-');
    return new Date(Number(y), Number(mo) - 1, 1).toLocaleString('es-ES', { month: 'long', year: 'numeric' });
  };

  return (
    <div className="p-4 md:p-6">
      {/* ── Cabecera ────────────────────────────────────────────────── */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">Partes SES</h1>
          <p className="text-slate-400 text-sm mt-1">
            Mes actual: <span className="text-emerald-400 font-semibold">{thisMonthEnviados} enviados</span>
            {thisMonthErrores > 0 && (
              <> · <span className="text-red-400 font-semibold">{thisMonthErrores} errores</span></>
            )}
          </p>
        </div>
      </div>

      {/* ── Filtros ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 mb-5">
        {/* Estado */}
        <div className="flex rounded-lg overflow-hidden border border-slate-700 text-xs font-semibold">
          {(['all', 'enviado', 'error', 'pendiente'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-2 transition-colors ${
                filterStatus === s
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {s === 'all'      ? 'Todos'
               : s === 'enviado' ? '✅ Enviado'
               : s === 'error'   ? '❌ Error'
               : '⏳ Pendiente'}
            </button>
          ))}
        </div>

        {/* Propiedad */}
        <select
          value={filterProperty}
          onChange={e => setFilterProperty(e.target.value)}
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
        >
          <option value="">Todas las propiedades</option>
          {properties.map((p: any) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        {/* Mes/año */}
        <select
          value={filterMonth}
          onChange={e => setFilterMonth(e.target.value)}
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
        >
          <option value="">Todos los meses</option>
          {monthOptions.map(m => (
            <option key={m} value={m}>{fmtMonthLabel(m)}</option>
          ))}
        </select>
      </div>

      {/* ── Mensaje de resultado de envío ───────────────────────────── */}
      {sendResult && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm flex justify-between items-center ${
          sendResult.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
        }`}>
          <span>{sendResult.message}</span>
          <button onClick={() => setSendResult(null)} className="ml-4 text-current opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* ── Contenido ───────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="text-slate-400 text-center py-20">Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-slate-400 text-center py-20">
          {sesBookings.length === 0
            ? 'No hay partes SES enviados todavía.'
            : 'No hay resultados para los filtros seleccionados.'}
        </div>
      ) : (
        <>
          {/* Desktop: tabla */}
          <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-4 py-3 text-slate-400 font-semibold">Propiedad</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-semibold">Cliente</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-semibold">Check-in</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-semibold">Nº Lote</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-semibold">Estado</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-semibold">Fecha envío</th>
                  <th className="text-right px-4 py-3 text-slate-400 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(b => (
                  <tr key={b.id} className="border-b border-slate-800 last:border-0 hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-medium">{b.property?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-300">
                      {b.client ? `${b.client.firstName} ${b.client.lastName}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{fmtDate(b.checkInDate)}</td>
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                      {b.sesLote ?? <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${sesBadge(b.sesStatus)}`}>
                        {sesLabel(b.sesStatus)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {b.sesSentAt ? fmtDateTime(b.sesSentAt) : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <a
                          href={downloadUrl(b.id, 'xml')}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-xs font-semibold text-slate-300 transition-colors"
                          title="Descargar XML"
                        >
                          XML
                        </a>
                        <a
                          href={downloadUrl(b.id, 'pdf')}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-xs font-semibold text-slate-300 transition-colors"
                          title="Descargar PDF"
                        >
                          PDF
                        </a>
                        {canResend(b) && (
                          <button
                            onClick={() => setConfirmBooking(b)}
                            className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 rounded text-xs font-semibold text-amber-400 transition-colors"
                          >
                            Reenviar
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/bookings/${b.id}`)}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-xs font-semibold text-slate-400 transition-colors"
                          title="Ver reserva"
                        >
                          Reserva
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Móvil: tarjetas */}
          <div className="md:hidden space-y-3">
            {filtered.map(b => (
              <div key={b.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-medium text-white">{b.property?.name ?? '—'}</p>
                    <p className="text-slate-400 text-sm">
                      {b.client ? `${b.client.firstName} ${b.client.lastName}` : '—'}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${sesBadge(b.sesStatus)}`}>
                    {sesLabel(b.sesStatus)}
                  </span>
                </div>

                <div className="flex justify-between text-xs text-slate-500 mb-3">
                  <span>Check-in: {fmtDate(b.checkInDate)}</span>
                  {b.sesLote && <span className="font-mono">Lote: {b.sesLote}</span>}
                </div>

                {b.sesSentAt && (
                  <p className="text-xs text-slate-500 mb-3">Enviado: {fmtDateTime(b.sesSentAt)}</p>
                )}

                <div className="flex flex-wrap gap-2">
                  <a
                    href={downloadUrl(b.id, 'xml')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-center py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold text-slate-300 transition-colors"
                  >
                    📋 XML
                  </a>
                  <a
                    href={downloadUrl(b.id, 'pdf')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-center py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold text-slate-300 transition-colors"
                  >
                    📄 PDF
                  </a>
                  {canResend(b) && (
                    <button
                      onClick={() => setConfirmBooking(b)}
                      className="flex-1 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg text-xs font-semibold text-amber-400 transition-colors"
                    >
                      🔄 Reenviar
                    </button>
                  )}
                  <button
                    onClick={() => navigate(`/bookings/${b.id}`)}
                    className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold text-slate-400 transition-colors"
                  >
                    Ver reserva
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Modal confirmación reenvío ──────────────────────────────── */}
      {confirmBooking && (
        <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center p-0 md:p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-t-2xl md:rounded-2xl w-full md:max-w-md p-6">
            <h2 className="text-lg font-bold mb-3">Reenviar parte SES</h2>
            <p className="text-slate-300 text-sm mb-1">
              ¿Reenviar parte SES para{' '}
              <span className="font-semibold text-white">
                {confirmBooking.client
                  ? `${confirmBooking.client.firstName} ${confirmBooking.client.lastName}`
                  : 'cliente desconocido'}
              </span>{' '}
              en{' '}
              <span className="font-semibold text-white">
                {confirmBooking.property?.name ?? 'propiedad desconocida'}
              </span>?
            </p>
            <p className="text-slate-400 text-sm mb-4">
              Check-in: {fmtDate(confirmBooking.checkInDate)}.
              {' '}Esto sobreescribirá el envío anterior.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmBooking(null)}
                disabled={sendMutation.isPending}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => sendMutation.mutate(confirmBooking.id)}
                disabled={sendMutation.isPending}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 rounded-lg text-sm font-semibold text-white transition-colors"
              >
                {sendMutation.isPending ? 'Enviando...' : 'Reenviar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
