import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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

const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-ES');
const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function Police() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { t } = useTranslation();

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

  // Filter bookings with SES activity (sent or error)
  const sesBookings = allBookings.filter(
    b => b.sesSentAt != null || b.sesStatus === 'error'
  );

  const properties = Array.from(
    new Map(sesBookings.map(b => [b.property?.id, b.property]).filter(([id]) => id)).values()
  );

  // Current month stats
  const now = new Date();
  const thisMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const thisMonthBookings = sesBookings.filter(b => b.sesSentAt?.startsWith(thisMonthStr));
  const thisMonthEnviados = thisMonthBookings.filter(b => b.sesStatus === 'enviado').length;
  const thisMonthErrores  = thisMonthBookings.filter(b => b.sesStatus === 'error').length;

  // Apply filters
  const filtered = sesBookings.filter(b => {
    if (filterStatus === 'enviado'   && b.sesStatus !== 'enviado') return false;
    if (filterStatus === 'error'     && b.sesStatus !== 'error')   return false;
    if (filterStatus === 'pendiente' && b.sesStatus != null && b.sesStatus !== 'error') return false;
    if (filterProperty && b.property?.id !== filterProperty)       return false;
    if (filterMonth && b.sesSentAt && !b.sesSentAt.startsWith(filterMonth)) return false;
    return true;
  });

  const sendMutation = useMutation({
    mutationFn: (id: string) => api.post(`/bookings/${id}/ses/send`),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
      setSendResult({ id, ok: true, message: `✅ ${t('police.resendSuccess')}` });
      setConfirmBooking(null);
    },
    onError: (err: any, id) => {
      const msg = err?.response?.data?.message || t('police.resendError');
      setSendResult({ id, ok: false, message: `❌ ${msg}` });
      setConfirmBooking(null);
    },
  });

  const downloadUrl = (id: string, type: 'xml' | 'pdf') =>
    `http://${window.location.hostname}:3001/api/bookings/${id}/ses/${type}`;

  const canResend = (b: Booking) => b.sesStatus === 'error' || b.sesStatus == null;

  const sesLabel = (status: SesStatus) => {
    if (status === 'enviado') return `✅ ${t('police.statusSent')}`;
    if (status === 'error')   return `❌ ${t('police.statusError')}`;
    return `⏳ ${t('police.statusPending')}`;
  };

  // Month/year options for filter
  const monthOptions: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthOptions.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const fmtMonthLabel = (m: string) => {
    const [y, mo] = m.split('-');
    return new Date(Number(y), Number(mo) - 1, 1).toLocaleString('es-ES', { month: 'long', year: 'numeric' });
  };

  const guestCount = (b: Booking) => 1 + (b.guestsSes?.length ?? 0);

  return (
    <div className="p-4 md:p-6">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('police.title')}</h1>
          <p className="text-slate-400 text-sm mt-1">
            {t('police.subtitle')}: <span className="text-emerald-400 font-semibold">{thisMonthEnviados} {t('police.sent')}</span>
            {thisMonthErrores > 0 && (
              <> · <span className="text-red-400 font-semibold">{thisMonthErrores} {t('police.errors')}</span></>
            )}
          </p>
        </div>
      </div>

      {/* ── Filters ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 mb-5">
        {/* Status */}
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
              {s === 'all'       ? t('police.filterAll')
               : s === 'enviado' ? `✅ ${t('police.filterSent')}`
               : s === 'error'   ? `❌ ${t('police.filterError')}`
               : `⏳ ${t('police.filterPending')}`}
            </button>
          ))}
        </div>

        {/* Property */}
        <select
          value={filterProperty}
          onChange={e => setFilterProperty(e.target.value)}
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
        >
          <option value="">{t('police.allProperties')}</option>
          {properties.map((p: any) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        {/* Month/year */}
        <select
          value={filterMonth}
          onChange={e => setFilterMonth(e.target.value)}
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
        >
          <option value="">{t('police.allMonths')}</option>
          {monthOptions.map(m => (
            <option key={m} value={m}>{fmtMonthLabel(m)}</option>
          ))}
        </select>
      </div>

      {/* ── Send result banner ──────────────────────────────────────── */}
      {sendResult && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm flex justify-between items-center ${
          sendResult.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
        }`}>
          <span>{sendResult.message}</span>
          <button onClick={() => setSendResult(null)} className="ml-4 text-current opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* ── Content ─────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="text-slate-400 text-center py-20">{t('common.loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="text-slate-400 text-center py-20">
          {sesBookings.length === 0 ? t('police.noRecords') : t('police.noResults')}
        </div>
      ) : (
        <>
          {/* Desktop: table */}
          <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-4 py-3 text-slate-400 font-semibold">{t('police.colProperty')}</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-semibold">{t('police.colClient')}</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-semibold">{t('police.colCheckIn')}</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-semibold">{t('police.colCheckOut')}</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-semibold">{t('police.colGuests')}</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-semibold">{t('police.colLote')}</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-semibold">{t('police.colStatus')}</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-semibold">{t('police.colSentAt')}</th>
                  <th className="text-right px-4 py-3 text-slate-400 font-semibold">{t('police.colActions')}</th>
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
                    <td className="px-4 py-3 text-slate-400">{fmtDate(b.checkOutDate)}</td>
                    <td className="px-4 py-3 text-slate-400 text-center">{guestCount(b)}</td>
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
                          title="XML"
                        >
                          XML
                        </a>
                        <a
                          href={downloadUrl(b.id, 'pdf')}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-xs font-semibold text-slate-300 transition-colors"
                          title="PDF"
                        >
                          PDF
                        </a>
                        {canResend(b) && (
                          <button
                            onClick={() => setConfirmBooking(b)}
                            className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 rounded text-xs font-semibold text-amber-400 transition-colors"
                          >
                            {t('police.actionResend')}
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/bookings/${b.id}`)}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-xs font-semibold text-slate-400 transition-colors"
                        >
                          {t('police.actionBooking')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: cards */}
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

                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>{t('police.colCheckIn')}: {fmtDate(b.checkInDate)}</span>
                  <span>{t('police.colCheckOut')}: {fmtDate(b.checkOutDate)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-500 mb-3">
                  <span>{t('police.colGuests')}: {guestCount(b)}</span>
                  {b.sesLote && <span className="font-mono">{t('police.colLote')}: {b.sesLote}</span>}
                </div>

                {b.sesSentAt && (
                  <p className="text-xs text-slate-500 mb-3">{t('police.colSentAt')}: {fmtDateTime(b.sesSentAt)}</p>
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
                      🔄 {t('police.actionResend')}
                    </button>
                  )}
                  <button
                    onClick={() => navigate(`/bookings/${b.id}`)}
                    className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold text-slate-400 transition-colors"
                  >
                    {t('police.actionBooking')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Resend confirmation modal ───────────────────────────────── */}
      {confirmBooking && (
        <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center p-0 md:p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-t-2xl md:rounded-2xl w-full md:max-w-md p-6">
            <h2 className="text-lg font-bold mb-3">{t('police.confirmTitle')}</h2>
            <p className="text-slate-300 text-sm mb-1">
              {t('police.confirmFor')}{' '}
              <span className="font-semibold text-white">
                {confirmBooking.client
                  ? `${confirmBooking.client.firstName} ${confirmBooking.client.lastName}`
                  : t('police.unknown')}
              </span>{' '}
              {t('police.confirmIn')}{' '}
              <span className="font-semibold text-white">
                {confirmBooking.property?.name ?? t('police.unknown')}
              </span>?
            </p>
            <p className="text-slate-400 text-sm mb-4">
              {t('police.confirmCheckIn')}: {fmtDate(confirmBooking.checkInDate)}.
              {' '}{t('police.confirmOverwrite')}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmBooking(null)}
                disabled={sendMutation.isPending}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => sendMutation.mutate(confirmBooking.id)}
                disabled={sendMutation.isPending}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 rounded-lg text-sm font-semibold text-white transition-colors"
              >
                {sendMutation.isPending ? '...' : t('police.actionResend')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
