import { useState } from 'react';
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
  draft: 'Borrador', sent: 'Enviado', signed: 'Firmado', cancelled: 'Cancelado',
};

export default function BookingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);

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

  const cancelMutation = useMutation({
    mutationFn: () => api.delete(`/bookings/${id}`),
    onSuccess: () => navigate('/bookings'),
  });

  const copyLink = (token: string) => {
    const link = `${window.location.protocol}//${window.location.hostname}:3000/sign/${token}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) return <div className="p-6 text-slate-400">Cargando...</div>;
  if (!booking) return <div className="p-6 text-slate-400">Reserva no encontrada</div>;

  const nights = Math.round(
    (new Date(booking.checkOutDate).getTime() - new Date(booking.checkInDate).getTime()) / 86400000
  );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/bookings')}
          className="text-slate-400 hover:text-white transition-colors">← Volver</button>
        <span className="text-slate-600">/</span>
        <h1 className="text-xl font-bold">Detalle de reserva</h1>
        <span className={`ml-auto text-xs font-semibold px-2 py-1 rounded-full ${statusColor[booking.status] || 'bg-slate-500/10 text-slate-400'}`}>
          {booking.status}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

        {/* Fechas y precio */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="font-semibold mb-4 text-slate-300 text-sm uppercase tracking-wider">Reserva</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-slate-400 text-sm">Check-in</span>
              <span className="font-medium">{new Date(booking.checkInDate).toLocaleDateString('es-ES')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 text-sm">Check-out</span>
              <span className="font-medium">{new Date(booking.checkOutDate).toLocaleDateString('es-ES')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 text-sm">Noches</span>
              <span className="font-medium">{nights}</span>
            </div>
            <div className="flex justify-between border-t border-slate-800 pt-3">
              <span className="text-slate-400 text-sm">Total</span>
              <span className="font-bold text-emerald-400 text-lg">€{booking.totalAmount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 text-sm">Origen</span>
              <span className="font-medium">{sourceLabel[booking.source] || booking.source}</span>
            </div>
          </div>
          {booking.status !== 'cancelled' && (
            <button onClick={() => { if(confirm('¿Cancelar esta reserva?')) cancelMutation.mutate(); }}
              className="mt-4 w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-semibold transition-colors">
              Cancelar reserva
            </button>
          )}
        </div>

        {/* Propiedad */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="font-semibold mb-4 text-slate-300 text-sm uppercase tracking-wider">Propiedad</h2>
          {booking.property && (
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-400 text-sm">Nombre</span>
                <Link to="/properties" className="font-medium text-emerald-400 hover:underline">
                  {booking.property.name}
                </Link>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 text-sm">Dirección</span>
                <span className="font-medium text-right text-sm">{booking.property.address}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 text-sm">Ciudad</span>
                <span className="font-medium">{booking.property.city}, {booking.property.province}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 text-sm">Habitaciones</span>
                <span className="font-medium">{booking.property.rooms}</span>
              </div>
            </div>
          )}
        </div>

        {/* Cliente */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="font-semibold mb-4 text-slate-300 text-sm uppercase tracking-wider">Cliente titular</h2>
          {booking.client && (
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-400 text-sm">Nombre</span>
                <Link to="/clients" className="font-medium text-emerald-400 hover:underline">
                  {booking.client.firstName} {booking.client.lastName}
                </Link>
              </div>
              {booking.client.dniPassport && (
                <div className="flex justify-between">
                  <span className="text-slate-400 text-sm">DNI/Pasaporte</span>
                  <span className="font-mono text-sm">{booking.client.dniPassport}</span>
                </div>
              )}
              {booking.client.nationality && (
                <div className="flex justify-between">
                  <span className="text-slate-400 text-sm">Nacionalidad</span>
                  <span className="font-medium">{booking.client.nationality}</span>
                </div>
              )}
              {booking.client.birthDate && (
                <div className="flex justify-between">
                  <span className="text-slate-400 text-sm">Nacimiento</span>
                  <span className="font-medium">{new Date(booking.client.birthDate).toLocaleDateString('es-ES')}</span>
                </div>
              )}
              {booking.client.email && (
                <div className="flex justify-between">
                  <span className="text-slate-400 text-sm">Email</span>
                  <a href={`mailto:${booking.client.email}`} className="text-emerald-400 hover:underline text-sm">{booking.client.email}</a>
                </div>
              )}
              {booking.client.phone && (
                <div className="flex justify-between">
                  <span className="text-slate-400 text-sm">Teléfono</span>
                  <a href={`tel:${booking.client.phone}`} className="text-emerald-400 hover:underline">{booking.client.phone}</a>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Huéspedes adicionales */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="font-semibold mb-4 text-slate-300 text-sm uppercase tracking-wider">Huéspedes adicionales</h2>
          {booking.guests && booking.guests.length > 0 ? (
            <div className="space-y-2">
              {booking.guests.map((g: any) => (
                <div key={g.id} className="flex justify-between items-center py-2 border-b border-slate-800 last:border-0">
                  <span className="font-medium text-sm">{g.client.firstName} {g.client.lastName}</span>
                  <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">{g.role}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-sm">Sin huéspedes adicionales registrados</p>
          )}
        </div>
      </div>

      {/* Contrato */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-300 text-sm uppercase tracking-wider">Contrato</h2>
          <Link to="/contracts" className="text-xs text-emerald-400 hover:underline">Gestionar contratos →</Link>
        </div>
        {contracts.length === 0 ? (
          <div className="flex items-center justify-between">
            <p className="text-slate-500 text-sm">No hay contrato asociado a esta reserva</p>
            <Link to="/contracts"
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-xs font-semibold transition-colors">
              + Crear contrato
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {contracts.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                <div>
                  <div className="font-medium text-sm">{c.template.name}</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Creado: {new Date(c.createdAt).toLocaleDateString('es-ES')}
                    {c.signedAt && ` · Firmado: ${new Date(c.signedAt).toLocaleDateString('es-ES')}`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${contractStatusColor[c.status]}`}>
                    {contractStatusLabel[c.status]}
                  </span>
                  {(c.status === 'draft' || c.status === 'sent') && (
                    <button onClick={() => copyLink(c.token)}
                      className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors">
                      {copied ? '✅ Copiado' : '📋 Copiar link'}
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
    </div>
  );
}
