import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';

interface Contract {
  id: string;
  status: string;
  token: string;
  depositAmount?: string;
  sentAt?: string;
  signedAt?: string;
  signerName?: string;
  signatureImage?: string;
  createdAt: string;
  template: { name: string; type: string };
  booking: {
    checkInDate: string;
    checkOutDate: string;
    client: { firstName: string; lastName: string; email?: string };
    property: { name: string };
  };
}

const statusColor: Record<string, string> = {
  draft:     'bg-slate-500/10 text-slate-400',
  sent:      'bg-amber-500/10 text-amber-400',
  signed:    'bg-emerald-500/10 text-emerald-400',
  cancelled: 'bg-red-500/10 text-red-400',
};

export default function Contracts() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ bookingId: '', templateId: '', depositAmount: '' });
  const [signatureView, setSignatureView] = useState<Contract | null>(null);
  const [linkModal, setLinkModal] = useState<string | null>(null);

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => api.get('/contracts').then(r => r.data),
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => api.get('/bookings').then(r => r.data),
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['contract-templates'],
    queryFn: () => api.get('/contracts/templates').then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/contracts', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] });
      setShowCreate(false);
      setForm({ bookingId:'', templateId:'', depositAmount:'' });
    },
  });

  const sendMutation = useMutation({
    mutationFn: (id: string) => api.post(`/contracts/${id}/send`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contracts'] }),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/contracts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contracts'] }),
  });

  const getSignUrl = (token: string) =>
    `${window.location.protocol}//${window.location.hostname}:3000/sign/${token}`;

  const viewContract = async (id: string) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`http://${window.location.hostname}:3001/api/contracts/view/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const html = await res.text();
    const blob = new Blob([html], { type: 'text/html' });
    window.open(URL.createObjectURL(blob), '_blank');
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('contracts.title')}</h1>
          <p className="text-slate-400 text-sm mt-1">{contracts.length} {t('contracts.registered')}</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-semibold transition-colors">
          + {t('contracts.new')}
        </button>
      </div>

      {isLoading ? (
        <div className="text-slate-400 text-center py-20">{t('common.loading')}</div>
      ) : contracts.length === 0 ? (
        <div className="text-slate-400 text-center py-20">{t('common.noData')}</div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-3 text-slate-400 font-semibold">{t('bookings.client')}</th>
                <th className="text-left px-4 py-3 text-slate-400 font-semibold">{t('bookings.property')}</th>
                <th className="text-left px-4 py-3 text-slate-400 font-semibold">{t('contracts.template')}</th>
                <th className="text-left px-4 py-3 text-slate-400 font-semibold">{t('bookings.checkIn')}</th>
                <th className="text-left px-4 py-3 text-slate-400 font-semibold">{t('bookings.deposit')}</th>
                <th className="text-left px-4 py-3 text-slate-400 font-semibold">{t('common.status')}</th>
                <th className="text-left px-4 py-3 text-slate-400 font-semibold">{t('contracts.signed')}</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c: Contract) => (
                <tr key={c.id} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3 font-medium">{c.booking.client.firstName} {c.booking.client.lastName}</td>
                  <td className="px-4 py-3 text-slate-400">{c.booking.property.name}</td>
                  <td className="px-4 py-3 text-slate-400">{c.template.name}</td>
                  <td className="px-4 py-3 text-slate-400">{new Date(c.booking.checkInDate).toLocaleDateString('es-ES')}</td>
                  <td className="px-4 py-3 text-slate-400">{c.depositAmount ? `€${c.depositAmount}` : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusColor[c.status]}`}>
                      {t(`contracts.statuses.${c.status}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {c.signedAt ? new Date(c.signedAt).toLocaleDateString('es-ES') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end flex-wrap">
                      <button onClick={() => viewContract(c.id)}
                        className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors">
                        {t('contracts.viewContract')}
                      </button>
                      {c.status === 'draft' && (
                        <button onClick={() => sendMutation.mutate(c.id)}
                          className="px-3 py-1 text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg transition-colors">
                          {t('common.send')}
                        </button>
                      )}
                      {(c.status === 'draft' || c.status === 'sent') && (
                        <button onClick={() => setLinkModal(getSignUrl(c.token))}
                          className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors">
                          🔗 {t('contracts.signLink')}
                        </button>
                      )}
                      {c.status === 'signed' && (
                        <button onClick={() => setSignatureView(c)}
                          className="px-3 py-1 text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-colors">
                          {t('contracts.signed')}
                        </button>
                      )}
                      {c.status !== 'signed' && c.status !== 'cancelled' && (
                        <button onClick={() => { if(confirm(t('common.confirm_delete'))) cancelMutation.mutate(c.id); }}
                          className="px-3 py-1 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors">
                          {t('common.cancel')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal link firma */}
      {linkModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-lg">
            <h2 className="text-lg font-bold mb-2">🔗 {t('contracts.signLink')}</h2>
            <div className="bg-slate-800 rounded-lg p-3 mb-4 break-all text-sm text-emerald-400 font-mono select-all">{linkModal}</div>
            <div className="flex gap-3">
              <a href={linkModal} target="_blank" rel="noopener noreferrer"
                className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-semibold text-center transition-colors">
                🔗 {t('common.view')}
              </a>
              <button onClick={() => setLinkModal(null)}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-semibold transition-colors">
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal crear */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-5">{t('contracts.new')}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t('bookings.title')} *</label>
                <select value={form.bookingId} onChange={e => setForm({...form, bookingId: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500">
                  <option value="">—</option>
                  {bookings.map((b: any) => (
                    <option key={b.id} value={b.id}>
                      {b.client.firstName} {b.client.lastName} — {b.property.name} ({new Date(b.checkInDate).toLocaleDateString('es-ES')})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t('contracts.template')} *</label>
                <select value={form.templateId} onChange={e => setForm({...form, templateId: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500">
                  <option value="">—</option>
                  {templates.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t('bookings.deposit')} (€)</label>
                <input type="number" value={form.depositAmount} onChange={e => setForm({...form, depositAmount: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowCreate(false)}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-semibold transition-colors">{t('common.cancel')}</button>
                <button onClick={() => createMutation.mutate({ ...form, depositAmount: form.depositAmount ? Number(form.depositAmount) : undefined })}
                  disabled={!form.bookingId || !form.templateId || createMutation.isPending}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 rounded-lg text-sm font-semibold transition-colors">
                  {createMutation.isPending ? t('common.saving') : t('contracts.new')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal firma */}
      {signatureView && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold mb-4">{t('contracts.signed')}</h2>
            <div className="bg-white rounded-xl p-4 mb-4">
              <img src={signatureView.signatureImage} alt="Firma" className="w-full" />
            </div>
            <p className="text-sm text-slate-400 mb-4">
              {signatureView.signerName} · {new Date(signatureView.signedAt!).toLocaleString('es-ES')}
            </p>
            <button onClick={() => setSignatureView(null)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-semibold transition-colors">
              {t('common.close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
