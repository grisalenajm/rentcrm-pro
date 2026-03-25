import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  bookingStatusConfig as STATUS_CONFIG,
  bookingStatusTransitions as TRANSITIONS,
  bookingStatusBtn as STATUS_BTN,
  contractStatusColor,
  LANGUAGES,
  inputCls,
  selCls,
  labelCls,
  CARD,
  MODAL_OVERLAY,
  MODAL_PANEL,
  BTN_PRIMARY,
  BTN_SECONDARY,
  BTN_DANGER,
} from '../lib/ui';


function Stars({ score, onChange }: { score: number; onChange?: (s: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(s => (
        <button key={s} type="button" onClick={() => onChange?.(s)}
          className={`text-xl transition-transform ${onChange ? 'cursor-pointer hover:scale-125' : 'cursor-default'} ${s <= score ? 'text-amber-400' : 'text-slate-600'}`}>
          ★
        </button>
      ))}
    </div>
  );
}

export default function BookingDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const navState = (location.state as { ids: string[]; index: number } | null);
  const qc = useQueryClient();
  const { user } = useAuth();
  const canChangeStatus = user?.role === 'admin' || user?.role === 'gestor';
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [showRating, setShowRating] = useState(false);
  const [sendingCheckin, setSendingCheckin] = useState(false);
  const [sendingWelcome, setSendingWelcome] = useState(false);
  const [sesSending, setSesSending] = useState(false);
  const [sesResult, setSesResult] = useState<{ok: boolean; message: string} | null>(null);
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingNotes, setRatingNotes] = useState('');
  const [checkinLang, setCheckinLang] = useState('es');
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    startDate: '',
    endDate: '',
    totalPrice: '',
    source: '',
    notes: '',
  });
  const [dateError, setDateError] = useState('');
  const [overlapError, setOverlapError] = useState('');

  // Pagos
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ concept: 'fianza', amount: '', date: new Date().toISOString().slice(0, 10), notes: '' });

  // Notas inline
  const [notesEditing, setNotesEditing] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);
  const [manualEmail, setManualEmail] = useState('');
  const [copied, setCopied] = useState(false);


  const { data: booking, isLoading } = useQuery({
    queryKey: ['booking', id],
    queryFn: () => api.get(`/bookings/${id}`).then(r => r.data),
    enabled: !!id,
  });

  const { data: org } = useQuery({
    queryKey: ['organization'],
    queryFn: () => api.get('/organization').then(r => r.data),
  });

  useEffect(() => {
    if (booking?.client?.language) setCheckinLang(booking.client.language);
  }, [booking?.client?.language]);

  const { data: evaluation } = useQuery({
    queryKey: ['evaluation-booking', id],
    queryFn: () => api.get(`/evaluations/booking/${id}`).then(r => r.data).catch(() => null),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.put(`/bookings/${id}`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['booking', id] });
      setShowEdit(false);
    },
    onError: (e: any) => alert(e.response?.data?.message || 'Error al guardar')
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['booking-payments', id],
    queryFn: () => api.get(`/bookings/${id}/payments`).then(r => r.data),
    enabled: !!id,
  });

  const createPaymentMutation = useMutation({
    mutationFn: (data: any) => api.post(`/bookings/${id}/payments`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['booking-payments', id] });
      setShowPaymentForm(false);
      setPaymentForm({ concept: 'fianza', amount: '', date: new Date().toISOString().slice(0, 10), notes: '' });
    },
    onError: (e: any) => alert(e.response?.data?.message || 'Error al guardar pago'),
  });

  const deletePaymentMutation = useMutation({
    mutationFn: (paymentId: string) => api.delete(`/bookings/${id}/payments/${paymentId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['booking-payments', id] }),
  });

  // Validación local inmediata de fechas
  useEffect(() => {
    if (editForm.startDate && editForm.endDate) {
      setDateError(
        new Date(editForm.endDate) <= new Date(editForm.startDate)
          ? 'La fecha de salida debe ser posterior a la de entrada'
          : ''
      );
    } else {
      setDateError('');
    }
  }, [editForm.startDate, editForm.endDate]);

  // Limpiar error de solapamiento al cambiar fechas
  useEffect(() => {
    setOverlapError('');
  }, [editForm.startDate, editForm.endDate]);

  const openEdit = () => {
    if (!booking) return;
    setDateError('');
    setOverlapError('');
    console.log('BOOKING DATA:', JSON.stringify({checkInDate: booking.checkInDate, checkOutDate: booking.checkOutDate, totalAmount: booking.totalAmount}));
    setEditForm({
      startDate:  booking.checkInDate  ? String(booking.checkInDate).slice(0, 10)  : '',
      endDate:    booking.checkOutDate ? String(booking.checkOutDate).slice(0, 10) : '',
      totalPrice: booking.totalAmount != null ? String(booking.totalAmount) : '',
      source:     booking.source || '',
      notes:      booking.notes  || '',
    });
    setShowEdit(true);
  };

  const handleEditSubmit = async () => {
    if (!editForm.startDate || !editForm.endDate) return;
    if (dateError) return;

    // Verificar solapamiento contra la API (excluir esta misma reserva)
    if (booking?.propertyId) {
      try {
        const res = await api.get('/bookings', { params: { propertyId: booking.propertyId } });
        const existing: any[] = res.data?.data || res.data || [];
        const newIn  = new Date(editForm.startDate).getTime();
        const newOut = new Date(editForm.endDate).getTime();
        const fmt = (d: string) => new Date(d).toLocaleDateString('es-ES');
        for (const b of existing) {
          if (b.status === 'cancelled') continue;
          if (b.id === id) continue;
          const bIn  = new Date(b.checkInDate).getTime();
          const bOut = new Date(b.checkOutDate).getTime();
          if (newIn < bOut && newOut > bIn) {
            setOverlapError(`La propiedad ya tiene una reserva del ${fmt(b.checkInDate)} al ${fmt(b.checkOutDate)}`);
            return;
          }
        }
        setOverlapError('');
      } catch { /* si falla, no bloquear */ }
    }

    updateMutation.mutate({
      startDate: editForm.startDate,
      endDate: editForm.endDate,
      totalAmount: parseFloat(editForm.totalPrice),
      source: editForm.source,
      notes: editForm.notes,
    });
  };

  const createEvalMutation = useMutation({
    mutationFn: (data: any) => api.post('/evaluations', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['evaluation-booking', id] });
      setShowRating(false);
      setRatingScore(5);
      setRatingNotes('');
    },
  });

  const updateEvalMutation = useMutation({
    mutationFn: ({ evalId, data }: any) => api.put(`/evaluations/${evalId}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['evaluation-booking', id] }),
  });

  const statusMutation = useMutation({
    mutationFn: (newStatus: string) => api.patch(`/bookings/${id}/status`, { status: newStatus }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['booking', id] });
      setShowStatusModal(false);
      setStatusError('');
    },
    onError: (e: any) => {
      console.error('Status change error:', e.response?.data);
      const msg = e.response?.data?.message || e.message || 'Transición de estado no válida';
      setStatusError(`Error al cambiar estado: ${msg}`);
    },
  });

  const handleSendWelcome = async () => {
    setSendingWelcome(true);
    try {
      await api.post(`/bookings/${booking.id}/welcome/send`);
      qc.invalidateQueries({ queryKey: ['booking', id] });
    } catch (e: any) {
      alert(e.response?.data?.message || 'Error al enviar el welcome package');
    } finally {
      setSendingWelcome(false);
    }
  };

  const copyCheckinLink = async () => {
    const base = (org?.publicBaseUrl || window.location.origin).replace(/\/$/, '');
    const url = `${base}/checkin/${booking.checkinToken}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSendCheckin = async () => {
    setSendingCheckin(true);
    try {
      const body: any = { language: checkinLang };
      if (!booking.clientId && manualEmail) body.email = manualEmail;
      await api.post(`/bookings/${booking.id}/checkin/send`, body);
      qc.invalidateQueries({ queryKey: ['booking', id] });
    } catch (e: any) {
      alert(e.response?.data?.message || 'Error al enviar el checkin');
    } finally {
      setSendingCheckin(false);
    }
  };

  const sendSes = async () => {
    setSesSending(true);
    setSesResult(null);
    try {
      const res = await api.post(`/bookings/${id}/ses/send`);
      setSesResult({ ok: res.data.ok, message: res.data.ok
        ? `✅ Parte enviado correctamente. Lote: ${res.data.lote}`
        : `⚠️ Enviado con advertencias. Código: ${res.data.codigo}` });
    } catch (err: any) {
      setSesResult({ ok: false, message: `❌ ${err?.response?.data?.message || 'Error al enviar'}` });
    } finally {
      setSesSending(false);
    }
  };

  const viewContract = async (contractId: string) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`http://${window.location.hostname}:3001/api/contracts/view/${contractId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const html = await res.text();
    const blob = new Blob([html], { type: 'text/html' });
    window.open(URL.createObjectURL(blob), '_blank');
  };

  if (isLoading) return <div className="p-6 text-slate-400">{t('common.loading')}</div>;
  if (!booking) return <div className="p-6 text-slate-400">{t('common.noData')}</div>;

  const nights = Math.round((new Date(booking.checkOutDate).getTime() - new Date(booking.checkInDate).getTime()) / 86400000);

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/bookings')} className="text-slate-400 hover:text-white text-sm transition-colors">
            {t('common.back')}
          </button>
          {navState && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => navigate(`/bookings/${navState.ids[navState.index - 1]}`, { state: { ids: navState.ids, index: navState.index - 1 } })}
                disabled={navState.index === 0}
                className="p-1.5 bg-slate-800 hover:bg-emerald-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-sm transition-colors">
                ←
              </button>
              <span className="text-xs text-slate-500 px-2">{navState.index + 1} / {navState.ids.length}</span>
              <button
                onClick={() => navigate(`/bookings/${navState.ids[navState.index + 1]}`, { state: { ids: navState.ids, index: navState.index + 1 } })}
                disabled={navState.index === navState.ids.length - 1}
                className="p-1.5 bg-slate-800 hover:bg-emerald-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-sm transition-colors">
                →
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button onClick={openEdit}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold rounded-xl transition-colors">
            ✏️ Editar reserva
          </button>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_CONFIG[booking.status]?.color ?? 'bg-slate-500/10 text-slate-400'}`}>
            {STATUS_CONFIG[booking.status]?.label ?? booking.status}
          </span>
          {canChangeStatus && (TRANSITIONS[booking.status]?.length ?? 0) > 0 && (
            <button onClick={() => { setShowStatusModal(true); setStatusError(''); }}
              className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg transition-colors font-semibold">
              Cambiar estado
            </button>
          )}
        </div>
      </div>

      {/* Layout dos columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Columna izquierda: datos principales ───────────────────── */}
        <div className="space-y-6">

          {/* Info principal */}
          <div className={CARD}>
            <h2 className="font-bold text-lg mb-4">{booking.property?.name}</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">{t('bookings.checkIn')}</div>
                <div className="font-semibold">{new Date(booking.checkInDate).toLocaleDateString('es-ES')}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">{t('bookings.checkOut')}</div>
                <div className="font-semibold">{new Date(booking.checkOutDate).toLocaleDateString('es-ES')}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">{t('bookings.nights')}</div>
                <div className="font-semibold">{nights}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">{t('bookings.source')}</div>
                <div className="font-semibold">{t(`bookings.sources.${booking.source}`)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">{t('common.total')}</div>
                <div className="font-bold text-emerald-400 text-lg">€{booking.totalAmount}</div>
              </div>
              {booking.depositAmount && (
                <div>
                  <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">{t('bookings.deposit')}</div>
                  <div className="font-semibold">€{booking.depositAmount}</div>
                </div>
              )}
            </div>
          </div>

          {/* Cliente */}
          <div className={CARD}>
            <h3 className="font-semibold text-sm text-slate-400 uppercase tracking-wider mb-3">{t('bookings.client')}</h3>
            {!booking.clientId ? (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-4 py-3">
                <p className="text-amber-400 text-sm font-medium">
                  Reserva sin cliente — envía el enlace de check-in al huésped para recoger sus datos
                </p>
              </div>
            ) : (
              <>
                <button onClick={() => navigate(`/clients/${booking.client?.id}`)}
                  className="text-lg font-bold hover:text-emerald-400 transition-colors text-left">
                  {booking.client?.firstName} {booking.client?.lastName}
                </button>
                <div className="mt-3 space-y-1 text-sm text-slate-400">
                  {booking.client?.dniPassport && <div>{t('clients.dni')}: <span className="font-mono text-white">{booking.client.dniPassport}</span></div>}
                  {booking.client?.email && <div>{t('common.email')}: <span className="text-white">{booking.client.email}</span></div>}
                  {booking.client?.phone && <div>{t('common.phone')}: <span className="text-white">{booking.client.phone}</span></div>}
                  {booking.client?.nationality && <div>{t('clients.nationality')}: <span className="text-white">{booking.client.nationality}</span></div>}
                </div>
              </>
            )}
          </div>

          {/* Pagos de reserva */}
          {(() => {
            const CONCEPT_LABELS: Record<string, string> = {
              fianza: 'Fianza',
              pago_reserva: 'Pago reserva',
              pago_final: 'Pago final',
              devolucion_fianza: 'Devolución fianza',
            };
            const totalPaid = (payments as any[]).reduce((s: number, p: any) => s + p.amount, 0);
            const fianzaPayment = (payments as any[]).find((p: any) => p.concept === 'fianza');

            const handleConceptChange = (concept: string) => {
              if (concept === 'devolucion_fianza') {
                const fianzaAmt = fianzaPayment ? String(-Math.abs(fianzaPayment.amount)) : '';
                setPaymentForm(f => ({ ...f, concept, amount: fianzaAmt }));
              } else {
                setPaymentForm(f => ({ ...f, concept }));
              }
            };

            return (
              <div className={CARD}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm text-slate-400 uppercase tracking-wider">Pagos</h3>
                  <button
                    onClick={() => setShowPaymentForm(v => !v)}
                    className="px-3 py-1.5 text-xs bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg transition-colors font-semibold">
                    {showPaymentForm ? '✕ Cancelar' : '+ Añadir pago'}
                  </button>
                </div>

                {showPaymentForm && (
                  <div className="mb-4 p-3 bg-slate-800 rounded-xl space-y-3">
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Concepto</label>
                      <select
                        value={paymentForm.concept}
                        onChange={e => handleConceptChange(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500">
                        <option value="fianza">Fianza</option>
                        <option value="pago_reserva">Pago reserva</option>
                        <option value="pago_final">Pago final</option>
                        <option value="devolucion_fianza">Devolución fianza</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">
                          Importe €{paymentForm.concept === 'devolucion_fianza' ? ' (negativo)' : ''}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={paymentForm.amount}
                          readOnly={paymentForm.concept === 'devolucion_fianza' && !!fianzaPayment}
                          onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
                          className={`w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500 ${paymentForm.concept === 'devolucion_fianza' && fianzaPayment ? 'opacity-60 cursor-not-allowed' : ''}`}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Fecha</label>
                        <input
                          type="date"
                          value={paymentForm.date}
                          onChange={e => setPaymentForm(f => ({ ...f, date: e.target.value }))}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Notas (opcional)</label>
                      <input
                        type="text"
                        value={paymentForm.notes}
                        onChange={e => setPaymentForm(f => ({ ...f, notes: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <button
                      disabled={!paymentForm.amount || !paymentForm.date || createPaymentMutation.isPending}
                      onClick={() => createPaymentMutation.mutate({
                        concept: paymentForm.concept,
                        amount: parseFloat(paymentForm.amount),
                        date: paymentForm.date,
                        notes: paymentForm.notes || undefined,
                      })}
                      className={`w-full ${BTN_PRIMARY}`}>
                      {createPaymentMutation.isPending ? 'Guardando...' : 'Guardar pago'}
                    </button>
                  </div>
                )}

                {(payments as any[]).length === 0 ? (
                  <p className="text-slate-500 text-sm">Sin pagos registrados</p>
                ) : (
                  <div className="space-y-2">
                    {(payments as any[]).map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between bg-slate-800 rounded-lg px-4 py-3 text-sm gap-2">
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                          <span className="shrink-0 text-xs font-semibold px-2 py-1 rounded-full bg-slate-700 text-slate-300">
                            {CONCEPT_LABELS[p.concept] ?? p.concept}
                          </span>
                          <span className="text-slate-400 text-xs">{new Date(p.date).toLocaleDateString('es-ES')}</span>
                          {p.notes && <span className="text-slate-500 text-xs truncate">{p.notes}</span>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`font-semibold ${p.amount < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                            {p.amount < 0 ? '' : '+'}€{Number(p.amount).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                          </span>
                          <button
                            onClick={() => deletePaymentMutation.mutate(p.id)}
                            disabled={deletePaymentMutation.isPending}
                            className="text-slate-600 hover:text-red-400 transition-colors text-xs">
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3 pt-3 border-t border-slate-700 flex items-center justify-between text-sm">
                  <span className="text-slate-400">Total pagado</span>
                  <div className="flex items-center gap-3">
                    <span className={`font-bold ${totalPaid < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      €{totalPaid.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                    </span>
                    {booking.totalAmount && (
                      <span className="text-slate-500 text-xs">/ €{Number(booking.totalAmount).toLocaleString('es-ES', { minimumFractionDigits: 2 })} reserva</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Valoración */}
          <div className={CARD}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm text-slate-400 uppercase tracking-wider">{t('bookings.rating')}</h3>
              <button onClick={() => setShowRating(true)}
                className="px-3 py-1.5 text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg transition-colors">
                {evaluation ? t('common.edit') : t('evaluations.rate')}
              </button>
            </div>
            {evaluation ? (
              <div className="flex items-center gap-3">
                <Stars score={evaluation.score} />
                <span className="text-slate-400 text-sm">{(t('evaluations.scores') as any)[evaluation.score]}</span>
                {evaluation.notes && <span className="text-slate-400 text-sm">· {evaluation.notes}</span>}
              </div>
            ) : (
              <p className="text-slate-500 text-sm">{t('bookings.noRating')}</p>
            )}
          </div>

          {/* Contratos */}
          <div className={CARD}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm text-slate-400 uppercase tracking-wider">{t('bookings.contract')}</h3>
              <button onClick={() => navigate('/contracts')} className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
                {t('common.view')} →
              </button>
            </div>
            {booking.contracts?.length === 0 ? (
              <p className="text-slate-500 text-sm">{t('bookings.noContract')}</p>
            ) : (
              <div className="space-y-2">
                {booking.contracts?.map((c: any) => (
                  <div key={c.id} className="flex flex-col md:flex-row md:items-center md:justify-between bg-slate-800 rounded-lg px-4 py-3 gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${contractStatusColor[c.status]}`}>
                        {t(`contracts.statuses.${c.status}`)}
                      </span>
                      <span className="text-sm text-slate-400">{c.template?.name}</span>
                      {c.signedAt && <span className="text-xs text-slate-500">· {t('contracts.signed')}: {new Date(c.signedAt).toLocaleDateString('es-ES')}</span>}
                    </div>
                    <button onClick={() => viewContract(c.id)}
                      className="self-start md:self-auto px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors">
                      {t('contracts.viewContract')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Financiero */}
          <div className={CARD}>
            <h3 className="font-semibold text-sm text-slate-400 uppercase tracking-wider mb-3">{t('bookings.financials')}</h3>
            {booking.financials?.length === 0 ? (
              <p className="text-slate-500 text-sm">{t('bookings.noFinancials')}</p>
            ) : (
              <div className="space-y-2">
                {booking.financials?.map((f: any) => (
                  <div key={f.id} className="flex items-center justify-between bg-slate-800 rounded-lg px-4 py-3 text-sm gap-2">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <span className={`shrink-0 text-xs font-semibold px-2 py-1 rounded-full ${f.type === 'income' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                        {f.type === 'income' ? t('financials.income') : t('financials.expense')}
                      </span>
                      <span className="text-slate-400 truncate">{f.description || f.category?.name || '—'}</span>
                    </div>
                    <span className={`shrink-0 font-semibold ${f.type === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {f.type === 'income' ? '+' : '-'}€{Number(f.amount).toLocaleString('es-ES')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Columna derecha: huéspedes, SES, checkin ───────────────── */}
        <div className="space-y-6">

          {/* Huéspedes adicionales */}
          {booking.guests?.length > 0 && (
            <div className={CARD}>
              <h3 className="font-semibold text-sm text-slate-400 uppercase tracking-wider mb-3">{t('bookings.additionalGuests')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {booking.guests.map((g: any) => (
                  <div key={g.id} className="bg-slate-800 rounded-lg p-3 text-sm">
                    <div className="font-medium">{g.firstName} {g.lastName}</div>
                    {g.dniPassport && <div className="text-slate-400 font-mono text-xs mt-0.5">{g.dniPassport}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SES Hospedajes */}
          <div className={CARD}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-3 gap-2">
              <h3 className="font-semibold text-sm text-slate-400 uppercase tracking-wider">🚔 SES Hospedajes</h3>
              <div className="flex flex-wrap items-center gap-2">
                {booking.sesStatus && (
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    booking.sesStatus === 'enviado' ? 'bg-emerald-500/10 text-emerald-400' :
                    booking.sesStatus === 'error'   ? 'bg-red-500/10 text-red-400' :
                    'bg-amber-500/10 text-amber-400'
                  }`}>
                    {booking.sesStatus === 'enviado' ? '✅ Enviado' :
                     booking.sesStatus === 'error'   ? '❌ Error' : '⏳ Pendiente'}
                  </span>
                )}
                <a href={`http://${window.location.hostname}:3001/api/bookings/${id}/ses/pdf`}
                  target="_blank" rel="noopener noreferrer"
                  className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors">
                  📄 PDF
                </a>
                <a href={`http://${window.location.hostname}:3001/api/bookings/${id}/ses/xml`}
                  target="_blank" rel="noopener noreferrer"
                  className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors">
                  📋 XML
                </a>
                <button onClick={sendSes} disabled={sesSending}
                  className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 rounded-lg transition-colors font-semibold">
                  {sesSending ? '⏳ Enviando...' : '📤 Enviar al SES'}
                </button>
              </div>
            </div>

            {booking.sesSentAt && (
              <p className="text-xs text-slate-500 mb-2">
                Último envío: {new Date(booking.sesSentAt).toLocaleString('es-ES')}
                {booking.sesLote && ` · Lote: ${booking.sesLote}`}
              </p>
            )}

            {sesResult && (
              <div className={`mt-2 p-3 rounded-lg text-sm ${sesResult.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                {sesResult.message}
              </div>
            )}

            {/* Huéspedes SES */}
            <div className="mt-3">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Viajeros del parte</p>
              <div className="space-y-2">
                {/* Titular */}
                <div className="flex items-center gap-3 bg-slate-800 rounded-lg px-3 py-2 text-sm">
                  <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full">Titular</span>
                  <span className="font-medium">{booking.client?.firstName} {booking.client?.lastName}</span>
                  {booking.client?.dniPassport && <span className="text-slate-400 font-mono text-xs">{booking.client.dniPassport}</span>}
                </div>
                {/* Huéspedes adicionales */}
                {(booking.guestsSes || []).map((g: any) => (
                  <div key={g.id} className="flex items-center gap-3 bg-slate-800 rounded-lg px-3 py-2 text-sm">
                    <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">Viajero</span>
                    <span className="font-medium">{g.firstName} {g.lastName}</span>
                    <span className="text-slate-400 font-mono text-xs">{g.docType?.toUpperCase()} {g.docNumber}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Checkin online */}
          <div className={CARD}>
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <span>✅</span> Checkin online
            </h3>
            <div className="mb-4">
              {!booking.checkinStatus && (
                <span className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded-full">No enviado</span>
              )}
              {booking.checkinStatus === 'pending' && (
                <div>
                  <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full">Pendiente</span>
                  {booking.checkinSentAt && (
                    <p className="text-xs text-slate-400 mt-1">
                      Enviado el {new Date(booking.checkinSentAt).toLocaleDateString('es-ES')}
                    </p>
                  )}
                </div>
              )}
              {booking.checkinStatus === 'completed' && (
                <div>
                  <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full">✓ Completado</span>
                  {booking.checkinDoneAt && (
                    <p className="text-xs text-slate-400 mt-1">
                      Completado el {new Date(booking.checkinDoneAt).toLocaleDateString('es-ES')} a las {new Date(booking.checkinDoneAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              )}
            </div>

            {booking.checkinStatus !== 'completed' && (
              <div>
                <div className="mb-3">
                  <label className="text-xs text-slate-400 mb-1 block">Idioma del email</label>
                  <select value={checkinLang} onChange={e => setCheckinLang(e.target.value)}
                    className={selCls}>
                    {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                  </select>
                </div>
                {!booking.clientId && (
                  <div className="mb-3">
                    <label className="text-xs text-slate-400 mb-1 block">Email del huésped (opcional)</label>
                    <input
                      type="email"
                      value={manualEmail}
                      onChange={e => setManualEmail(e.target.value)}
                      placeholder="correo@ejemplo.com"
                      className={inputCls}
                    />
                  </div>
                )}
                <button onClick={handleSendCheckin} disabled={sendingCheckin || (!booking.clientId && !manualEmail)}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
                  {sendingCheckin ? 'Enviando...' : booking.checkinStatus === 'pending' ? '🔄 Reenviar enlace' : '📧 Enviar checkin al cliente'}
                </button>
                {booking.checkinToken && (
                  <button onClick={copyCheckinLink}
                    className="w-full mt-2 px-3 py-2 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors font-semibold">
                    {copied ? '✓ Enlace copiado' : '📋 Copiar enlace de check-in'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Welcome Package */}
          <div className={CARD}>
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <span>📨</span> {t('bookings.welcomePackage')}
            </h3>
            <div className="mb-4">
              {booking.welcomeSentAt ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full">✓ {t('bookings.welcomeSentAt')} {new Date(booking.welcomeSentAt).toLocaleDateString('es-ES')}</span>
                </div>
              ) : (
                <span className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded-full">{t('bookings.welcomeNotSent')}</span>
              )}
            </div>
            <button onClick={handleSendWelcome} disabled={sendingWelcome}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
              {sendingWelcome ? t('bookings.welcomeSending') : booking.welcomeSentAt ? `🔄 ${t('bookings.sendWelcome')}` : t('bookings.sendWelcome')}
            </button>
          </div>
        </div>
      </div>

      {/* Notas */}
      <div className={`mt-6 ${CARD}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm text-slate-400 uppercase tracking-wider">Notas</h3>
          {!notesEditing && (
            <button
              onClick={() => { setNotesDraft(booking.notes || ''); setNotesEditing(true); }}
              className="text-xs text-slate-400 hover:text-emerald-400 transition-colors">
              {booking.notes ? 'Editar' : 'Añadir'}
            </button>
          )}
        </div>
        {notesEditing ? (
          <div className="space-y-3">
            <textarea
              value={notesDraft}
              onChange={e => setNotesDraft(e.target.value)}
              rows={4}
              autoFocus
              className={`${inputCls} resize-none`}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setNotesEditing(false)}
                className={`flex-1 ${BTN_SECONDARY}`}>
                Cancelar
              </button>
              <button
                disabled={notesSaving}
                onClick={async () => {
                  setNotesSaving(true);
                  try {
                    await api.put(`/bookings/${id}`, { notes: notesDraft });
                    await qc.invalidateQueries({ queryKey: ['booking', id] });
                    setNotesEditing(false);
                  } finally {
                    setNotesSaving(false);
                  }
                }}
                className={`flex-1 ${BTN_PRIMARY}`}>
                {notesSaving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        ) : booking.notes ? (
          <p
            onClick={() => { setNotesDraft(booking.notes || ''); setNotesEditing(true); }}
            className="text-sm text-slate-300 whitespace-pre-wrap cursor-pointer hover:text-white transition-colors">
            {booking.notes}
          </p>
        ) : (
          <p
            onClick={() => { setNotesDraft(''); setNotesEditing(true); }}
            className="text-sm text-slate-500 cursor-pointer hover:text-slate-400 transition-colors">
            Sin notas
          </p>
        )}
      </div>

      {/* Modal edición */}
      {showEdit && (
        <div className={MODAL_OVERLAY}>
          <div className={`${MODAL_PANEL} max-h-[95vh] overflow-y-auto`}>
            <h2 className="text-lg font-bold mb-5">Editar reserva</h2>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Entrada *</label>
                  <input type="date" value={editForm.startDate}
                    onChange={e => setEditForm({...editForm, startDate: e.target.value})}
                    className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 ${dateError ? 'border-red-500' : 'border-slate-700'}`} />
                </div>
                <div>
                  <label className={labelCls}>Salida *</label>
                  <input type="date" value={editForm.endDate}
                    onChange={e => setEditForm({...editForm, endDate: e.target.value})}
                    className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 ${dateError ? 'border-red-500' : 'border-slate-700'}`} />
                </div>
              </div>
              {dateError && (
                <p className="text-red-400 text-xs -mt-2">⚠ {dateError}</p>
              )}
              {overlapError && (
                <p className="text-red-400 text-xs -mt-2">⚠ {overlapError}</p>
              )}

              <div>
                <label className={labelCls}>Total €</label>
                <input type="number" step="0.01" value={editForm.totalPrice}
                  onChange={e => setEditForm({...editForm, totalPrice: e.target.value})}
                  className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>Origen</label>
                <select value={editForm.source} onChange={e => setEditForm({...editForm, source: e.target.value})}
                  className={selCls}>
                  <option value="direct">Directo</option>
                  <option value="airbnb">Airbnb</option>
                  <option value="booking">Booking.com</option>
                  <option value="vrbo">VRBO</option>
                  <option value="manual_block">Bloqueo manual</option>
                </select>
              </div>

              <div>
                <label className={labelCls}>Notas</label>
                <textarea value={editForm.notes} onChange={e => setEditForm({...editForm, notes: e.target.value})}
                  rows={3} className={`${inputCls} resize-none`} />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowEdit(false)}
                className={`flex-1 ${BTN_SECONDARY}`}>
                Cancelar
              </button>
              <button onClick={handleEditSubmit} disabled={updateMutation.isPending || !!dateError || !!overlapError}
                className={`flex-1 ${BTN_PRIMARY}`}>
                {updateMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status change modal */}
      {showStatusModal && (
        <div className={MODAL_OVERLAY}>
          <div className={`${MODAL_PANEL} md:max-w-sm`}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-white">Cambiar estado</h3>
              <button onClick={() => { setShowStatusModal(false); setStatusError(''); }}
                className="text-slate-400 hover:text-white text-xl leading-none">✕</button>
            </div>
            <div className="mb-4">
              <p className="text-xs text-slate-400 mb-2">Estado actual</p>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_CONFIG[booking.status]?.color}`}>
                {STATUS_CONFIG[booking.status]?.label ?? booking.status}
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-3">Selecciona el nuevo estado:</p>
            <div className="space-y-2">
              {TRANSITIONS[booking.status]?.map(newStatus => (
                <button key={newStatus}
                  onClick={() => statusMutation.mutate(newStatus)}
                  disabled={statusMutation.isPending}
                  className={`w-full px-4 py-2.5 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 text-left ${STATUS_BTN[newStatus]}`}>
                  {STATUS_CONFIG[newStatus]?.label}
                </button>
              ))}
            </div>
            {statusError && (
              <p className="mt-4 text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{statusError}</p>
            )}
          </div>
        </div>
      )}

      {/* Modal valoración */}
      {showRating && (
        <div className={MODAL_OVERLAY}>
          <div className={`${MODAL_PANEL} md:max-w-sm max-h-[95vh] md:max-h-[90vh] overflow-y-auto`}>
            <h2 className="text-lg font-bold mb-4">{evaluation ? t('evaluations.editTitle') : t('evaluations.title')}</h2>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{t('evaluations.score')}</label>
              <Stars score={ratingScore} onChange={setRatingScore} />
              <p className="text-xs text-slate-400 mt-1">{(t('evaluations.scores') as any)[ratingScore]}</p>
            </div>
            <div className="mb-4">
              <label className={labelCls}>{t('evaluations.comment')}</label>
              <textarea value={ratingNotes} onChange={e => setRatingNotes(e.target.value)} rows={3}
                placeholder={t('evaluations.commentPlaceholder')}
                className={`${inputCls} resize-none`} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowRating(false)}
                className={`flex-1 ${BTN_SECONDARY}`}>
                {t('common.cancel')}
              </button>
              <button
                onClick={() => {
                  if (evaluation) {
                    updateEvalMutation.mutate({ evalId: evaluation.id, data: { score: ratingScore, notes: ratingNotes } });
                    setShowRating(false);
                  } else {
                    createEvalMutation.mutate({ bookingId: id, clientId: booking.client?.id, score: ratingScore, notes: ratingNotes });
                  }
                }}
                disabled={createEvalMutation.isPending || updateEvalMutation.isPending}
                className={`flex-1 ${BTN_PRIMARY}`}>
                {(createEvalMutation.isPending || updateEvalMutation.isPending) ? t('common.saving') : t('evaluations.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
