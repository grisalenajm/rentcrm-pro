import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

const sourceLabel: Record<string, string> = {
  direct: 'Directo', airbnb: 'Airbnb',
  booking: 'Booking', vrbo: 'Vrbo', manual_block: 'Bloqueo',
};

const statusColor: Record<string, string> = {
  confirmed: 'bg-emerald-500/10 text-emerald-400',
  cancelled:  'bg-red-500/10 text-red-400',
  completed:  'bg-slate-500/10 text-slate-400',
};

const contractStatusColor: Record<string, string> = {
  draft:     'bg-slate-500/10 text-slate-400',
  sent:      'bg-amber-500/10 text-amber-400',
  signed:    'bg-emerald-500/10 text-emerald-400',
  cancelled: 'bg-red-500/10 text-red-400',
};

const contractStatusLabel: Record<string, string> = {
  draft: t('contracts.statuses.draft'), sent: t('contracts.statuses.sent'), signed: t('contracts.statuses.signed'), cancelled: t('contracts.statuses.cancelled'),
};

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
  const qc = useQueryClient();
  const [linkModal, setLinkModal] = useState<string | null>(null);
  const [showRating, setShowRating] = useState(false);
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingNotes, setRatingNotes] = useState('');

  const { data: booking, isLoading } = useQuery({
    queryKey: ['booking', id],
    queryFn: () => api.get(`/bookings/${id}`).then(r => r.data),
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts-booking', id],
    queryFn: () => api.get(`/contracts?bookingId=${id}`).then(r => r.data),
    enabled: !!id,
  });

  const { data: financials = [] } = useQuery({
    queryKey: ['financials-booking', id],
    queryFn: () => api.get(`/financials?bookingId=${id}`).then(r => r.data),
    enabled: !!id,
  });

  const { data: evaluation } = useQuery({
    queryKey: ['evaluation-booking', id],
    queryFn: () => api.get(`/evaluations/booking/${id}`).then(r => r.data).catch(() => null),
    enabled: !!id,
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.delete(`/bookings/${id}`),
    onSuccess: () => navigate('/bookings'),
  });

  const createEvalMutation = useMutation({
    mutationFn: (data: any) => api.post('/evaluations', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['evaluation-booking', id] });
      setShowRating(false);
    },
  });

  const updateEvalMutation = useMutation({
    mutationFn: ({ evalId, data }: any) => api.put(`/evaluations/${evalId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['evaluation-booking', id] });
      setShowRating(false);
    },
  });

  const openRating = () => {
    if (evaluation) {
      setRatingScore(evaluation.score);
      setRatingNotes(evaluation.notes || '');
    } else {
      setRatingScore(5);
      setRatingNotes('');
    }
    setShowRating(true);
  };

  const handleRating = () => {
    if (evaluation) {
      updateEvalMutation.mutate({ evalId: evaluation.id, data: { score: ratingScore, notes: ratingNotes || undefined } });
    } else {
      createEvalMutation.mutate({ bookingId: id, clientId: booking.clientId, score: ratingScore, notes: ratingNotes || undefined });
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

  const getSignUrl = (token: string) =>
    `${window.location.protocol}//${window.location.hostname}:3000/sign/${token}`;

  if (isLoading) return <div className="p-6 text-slate-400">Cargando...</div>;
  if (!booking) return <div className="p-6 text-slate-400">Reserva no encontrada</div>;

  const nights = Math.round(
    (new Date(booking.checkOutDate).getTime() - new Date(booking.checkInDate).getTime()) / 86400000
  );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/bookings')} className="text-slate-400 hover:text-white transition-colors">{t('common.back')}</button>
        <span className="text-slate-600">/</span>
        <h1 className="text-xl font-bold">{t('bookings.title')}</h1>
        <span className={`ml-auto text-xs font-semibold px-2 py-1 rounded-full ${statusColor[booking.status] || 'bg-slate-500/10 text-slate-400'}`}>
          {booking.status}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Fechas y precio */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="font-semibold mb-4 text-slate-300 text-sm uppercase tracking-wider">{t('bookings.title')}</h2>
          <div className="space-y-3">
            <div className="flex justify-between"><span className="text-slate-400 text-sm">Check-in</span><span className="font-medium">{new Date(booking.checkInDate).toLocaleDateString('es-ES')}</span></div>
            <div className="flex justify-between"><span className="text-slate-400 text-sm">Check-out</span><span className="font-medium">{new Date(booking.checkOutDate).toLocaleDateString('es-ES')}</span></div>
            <div className="flex justify-between"><span className="text-slate-400 text-sm">{t('bookings.nights')}</span><span className="font-medium">{nights}</span></div>
            <div className="flex justify-between border-t border-slate-800 pt-3">
              <span className="text-slate-400 text-sm">Total</span>
              <span className="font-bold text-emerald-400 text-lg">€{booking.totalAmount}</span>
            </div>
            <div className="flex justify-between"><span className="text-slate-400 text-sm">{t('bookings.source')}</span><span className="font-medium">{sourceLabel[booking.source] || booking.source}</span></div>
          </div>
          {booking.status !== 'cancelled' && (
            <button onClick={() => { if(confirm(t('bookings.cancel'))) cancelMutation.mutate(); }}
              className="mt-4 w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-semibold transition-colors">
              {t('bookings.cancel')}
            </button>
          )}
        </div>

        {/* Propiedad */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="font-semibold mb-4 text-slate-300 text-sm uppercase tracking-wider">Propiedad</h2>
          {booking.property && (
            <div className="space-y-3">
              <div className="flex justify-between"><span className="text-slate-400 text-sm">Nombre</span><Link to="/properties" className="font-medium text-emerald-400 hover:underline">{booking.property.name}</Link></div>
              <div className="flex justify-between"><span className="text-slate-400 text-sm">Dirección</span><span className="font-medium text-right text-sm">{booking.property.address}</span></div>
              <div className="flex justify-between"><span className="text-slate-400 text-sm">Ciudad</span><span className="font-medium">{booking.property.city}, {booking.property.province}</span></div>
              <div className="flex justify-between"><span className="text-slate-400 text-sm">Habitaciones</span><span className="font-medium">{booking.property.rooms}</span></div>
            </div>
          )}
        </div>

        {/* Cliente */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="font-semibold mb-4 text-slate-300 text-sm uppercase tracking-wider">Cliente titular</h2>
          {booking.client && (
            <div className="space-y-3">
              <div className="flex justify-between"><span className="text-slate-400 text-sm">Nombre</span>
                <Link to={`/clients/${booking.clientId}`} className="font-medium text-emerald-400 hover:underline">
                  {booking.client.firstName} {booking.client.lastName}
                </Link>
              </div>
              {booking.client.dniPassport && <div className="flex justify-between"><span className="text-slate-400 text-sm">DNI/Pasaporte</span><span className="font-mono text-sm">{booking.client.dniPassport}</span></div>}
              {booking.client.nationality && <div className="flex justify-between"><span className="text-slate-400 text-sm">Nacionalidad</span><span className="font-medium">{booking.client.nationality}</span></div>}
              {booking.client.birthDate && <div className="flex justify-between"><span className="text-slate-400 text-sm">Nacimiento</span><span className="font-medium">{new Date(booking.client.birthDate).toLocaleDateString('es-ES')}</span></div>}
              {booking.client.email && <div className="flex justify-between"><span className="text-slate-400 text-sm">Email</span><a href={`mailto:${booking.client.email}`} className="text-emerald-400 hover:underline text-sm">{booking.client.email}</a></div>}
              {booking.client.phone && <div className="flex justify-between"><span className="text-slate-400 text-sm">Teléfono</span><a href={`tel:${booking.client.phone}`} className="text-emerald-400 hover:underline">{booking.client.phone}</a></div>}
            </div>
          )}
        </div>

        {/* Valoración */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-300 text-sm uppercase tracking-wider">Valoración de la estancia</h2>
            <button onClick={openRating}
              className="px-3 py-1 text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg transition-colors">
              {evaluation ? t('common.edit') : t('evaluations.rate')}
            </button>
          </div>
          {evaluation ? (
            <div className="space-y-3">
              <Stars score={evaluation.score} />
              <div className="text-xs text-slate-400">{['','Muy malo','Malo','Normal','Bueno','Excelente'][evaluation.score]}</div>
              {evaluation.notes && <p className="text-sm text-slate-300 italic">"{evaluation.notes}"</p>}
            </div>
          ) : (
            <p className="text-slate-500 text-sm">{t('bookings.noRating')}</p>
          )}
        </div>
      </div>

      {/* Huéspedes */}
      {booking.guests && booking.guests.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-4">
          <h2 className="font-semibold mb-4 text-slate-300 text-sm uppercase tracking-wider">Huéspedes adicionales</h2>
          <div className="space-y-2">
            {booking.guests.map((g: any) => (
              <div key={g.id} className="flex justify-between items-center py-2 border-b border-slate-800 last:border-0">
                <span className="font-medium text-sm">{g.client.firstName} {g.client.lastName}</span>
                <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">{g.role}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contrato */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-300 text-sm uppercase tracking-wider">Contrato</h2>
          <Link to="/contracts" className="text-xs text-emerald-400 hover:underline">{t('common.view')} →</Link>
        </div>
        {contracts.length === 0 ? (
          <div className="flex items-center justify-between">
            <p className="text-slate-500 text-sm">No hay contrato asociado</p>
            <Link to="/contracts" className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-xs font-semibold transition-colors">+ Crear contrato</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {contracts.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between p-3 bg-slate-800 rounded-lg flex-wrap gap-2">
                <div>
                  <div className="font-medium text-sm">{c.template.name}</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Creado: {new Date(c.createdAt).toLocaleDateString('es-ES')}
                    {c.signedAt && ` · {t('contracts.signed')}: ${new Date(c.signedAt).toLocaleDateString('es-ES')}`}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${contractStatusColor[c.status]}`}>
                    {contractStatusLabel[c.status]}
                  </span>
                  <button onClick={() => viewContract(c.id)}
                    className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors">
                    {t('contracts.viewContract')}
                  </button>
                  {(c.status === 'draft' || c.status === 'sent') && (
                    <button onClick={() => setLinkModal(getSignUrl(c.token))}
                      className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors">
                      🔗 Link firma
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Registros financieros */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-300 text-sm uppercase tracking-wider">Registros financieros</h2>
          <Link to="/financials" className="text-xs text-emerald-400 hover:underline">Ver todos →</Link>
        </div>
        {financials.length === 0 ? (
          <p className="text-slate-500 text-sm">No hay registros financieros para esta reserva</p>
        ) : (
          <div className="space-y-2">
            {financials.map((f: any) => (
              <div key={f.id} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                <div>
                  <div className="text-sm font-medium">{f.category?.name}</div>
                  <div className="text-xs text-slate-400">{new Date(f.date).toLocaleDateString('es-ES')} · {f.description || '—'}</div>
                </div>
                <span className={`font-semibold ${f.type === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {f.type === 'income' ? '+' : '-'}€{Number(f.amount).toLocaleString('es-ES', {minimumFractionDigits:2})}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal link firma */}
      {linkModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-lg">
            <h2 className="text-lg font-bold mb-2">Link de firma</h2>
            <p className="text-slate-400 text-sm mb-4">Envía este link al cliente para que firme el contrato.</p>
            <div className="bg-slate-800 rounded-lg p-3 mb-4 break-all text-sm text-emerald-400 font-mono select-all">{linkModal}</div>
            <div className="flex gap-3">
              <a href={linkModal} target="_blank" rel="noopener noreferrer"
                className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-semibold text-center transition-colors">
                🔗 Abrir en nueva pestaña
              </a>
              <button onClick={() => setLinkModal(null)}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-semibold transition-colors">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal valoración */}
      {showRating && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-2">{evaluation ? 'Editar valoración' : 'Valorar estancia'}</h2>
            <p className="text-slate-400 text-sm mb-5">
              {booking.client.firstName} {booking.client.lastName} · {booking.property.name}
            </p>
            <div className="mb-5">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Puntuación *</label>
              <Stars score={ratingScore} onChange={setRatingScore} />
              <div className="text-xs text-slate-500 mt-2">{['','Muy malo','Malo','Normal','Bueno','Excelente'][ratingScore]}</div>
            </div>
            <div className="mb-5">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Comentario</label>
              <input value={ratingNotes} onChange={e => setRatingNotes(e.target.value)}
                placeholder="Ej: Cliente muy cuidadoso, dejó la casa perfecta"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowRating(false)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-semibold transition-colors">
                Cancelar
              </button>
              <button onClick={handleRating} disabled={createEvalMutation.isPending || updateEvalMutation.isPending}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 rounded-lg text-sm font-semibold transition-colors">
                {createEvalMutation.isPending || updateEvalMutation.isPending ? t('common.saving') : t('evaluations.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
