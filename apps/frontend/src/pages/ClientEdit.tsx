import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { inputCls, LANGUAGES } from '../lib/ui';
import { WORLD_COUNTRIES } from '../data/countries';
import FormField from '../components/FormField';

export default function ClientEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: client, isLoading } = useQuery({
    queryKey: ['client', id],
    queryFn: () => api.get(`/clients/${id}`).then(r => r.data),
    enabled: !!id,
  });

  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (client) setForm({ ...client });
  }, [client]);

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((prev: any) => ({ ...prev, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    setError('');
    try {
      await api.put(`/clients/${id}`, {
        firstName: form.firstName,
        lastName: form.lastName,
        dniPassport: form.dniPassport || undefined,
        nationality: form.nationality || undefined,
        birthDate: form.birthDate || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        street: form.street || undefined,
        city: form.city || undefined,
        postalCode: form.postalCode || undefined,
        province: form.province || undefined,
        country: form.country || undefined,
        language: form.language || 'es',
        notes: form.notes || undefined,
      });
      await qc.invalidateQueries({ queryKey: ['client', id] });
      await qc.invalidateQueries({ queryKey: ['clients'] });
      navigate(`/clients/${id}`);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <div className="p-6 text-slate-400">Cargando…</div>;
  if (!client || !form) return (
    <div className="p-6">
      <button onClick={() => navigate('/clients')}
        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sm rounded-lg transition-colors text-slate-300 mb-4">
        ← Volver
      </button>
      <p className="text-red-400">Cliente no encontrado.</p>
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => navigate(`/clients/${id}`)}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sm rounded-lg transition-colors text-slate-300">
          ← Cancelar
        </button>
        <h1 className="text-xl font-bold flex-1">
          Editar: {client.firstName} {client.lastName}
        </h1>
        <button onClick={handleSave} disabled={saving}
          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-sm rounded-lg font-semibold transition-colors">
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 text-red-400 text-sm px-4 py-3 rounded-xl">{error}</div>
      )}

      {/* Datos personales */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4">Datos personales</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Nombre" required>
            <input value={form.firstName || ''} onChange={f('firstName')} className={inputCls} />
          </FormField>
          <FormField label="Apellidos" required>
            <input value={form.lastName || ''} onChange={f('lastName')} className={inputCls} />
          </FormField>
          <FormField label="DNI / Pasaporte">
            <input value={form.dniPassport || ''} onChange={f('dniPassport')} className={inputCls} />
          </FormField>
          <FormField label="Nacionalidad">
            <input value={form.nationality || ''} onChange={f('nationality')} className={inputCls} />
          </FormField>
          <FormField label="Fecha de nacimiento">
            <input type="date" value={form.birthDate ? form.birthDate.slice(0, 10) : ''} onChange={f('birthDate')} className={inputCls} />
          </FormField>
          <FormField label="Idioma de contacto">
            <select value={form.language || 'es'} onChange={f('language')} className={inputCls}>
              {LANGUAGES.map(l => (
                <option key={l.code} value={l.code}>{l.name}</option>
              ))}
            </select>
          </FormField>
        </div>
      </div>

      {/* Contacto */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4">Contacto</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Email">
            <input type="email" value={form.email || ''} onChange={f('email')} className={inputCls} />
          </FormField>
          <FormField label="Teléfono">
            <input type="tel" value={form.phone || ''} onChange={f('phone')} className={inputCls} />
          </FormField>
        </div>
      </div>

      {/* Dirección */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4">Dirección</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <FormField label="Calle">
              <input value={form.street || ''} onChange={f('street')} className={inputCls} />
            </FormField>
          </div>
          <FormField label="Código Postal">
            <input value={form.postalCode || ''} onChange={f('postalCode')} className={inputCls} />
          </FormField>
          <FormField label="Ciudad">
            <input value={form.city || ''} onChange={f('city')} className={inputCls} />
          </FormField>
          <FormField label="Provincia">
            <input value={form.province || ''} onChange={f('province')} className={inputCls} />
          </FormField>
          <FormField label="País">
            <select value={form.country || ''} onChange={f('country')} className={inputCls}>
              <option value="">— Sin especificar —</option>
              {WORLD_COUNTRIES.map(c => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </FormField>
        </div>
      </div>

      {/* Notas */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4">Notas</p>
        <textarea value={form.notes || ''} onChange={f('notes')} rows={3}
          className={`${inputCls} resize-none`} />
      </div>

      {/* Botones pie */}
      <div className="flex gap-3">
        <button onClick={() => navigate(`/clients/${id}`)}
          className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-semibold transition-colors">
          Cancelar
        </button>
        <button onClick={handleSave} disabled={saving}
          className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl text-sm font-semibold transition-colors">
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}
