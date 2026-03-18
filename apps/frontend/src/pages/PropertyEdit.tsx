import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { WORLD_COUNTRIES } from '../data/countries';

const inputCls = 'w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500';
const labelCls = 'block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1';

export default function PropertyEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: property, isLoading } = useQuery({
    queryKey: ['property', id],
    queryFn: () => api.get(`/properties/${id}`).then(r => r.data),
    enabled: !!id,
  });

  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (property) setForm({ ...property });
  }, [property]);

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev: any) => ({ ...prev, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    setError('');
    try {
      await api.put(`/properties/${id}`, {
        name: form.name,
        address: form.address || undefined,
        city: form.city || undefined,
        province: form.province || undefined,
        postalCode: form.postalCode || undefined,
        country: form.country || undefined,
        rooms: form.rooms ? Number(form.rooms) : undefined,
        bathrooms: form.bathrooms ? Number(form.bathrooms) : undefined,
        maxGuests: form.maxGuests ? Number(form.maxGuests) : undefined,
        pricePerNight: form.pricePerNight ? Number(form.pricePerNight) : undefined,
        purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : undefined,
        status: form.status,
        sesCodigoEstablecimiento: form.sesCodigoEstablecimiento || undefined,
      });
      await qc.invalidateQueries({ queryKey: ['property', id] });
      await qc.invalidateQueries({ queryKey: ['properties'] });
      navigate(`/properties/${id}`);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <div className="p-6 text-slate-400">Cargando…</div>;
  if (!property || !form) return (
    <div className="p-6">
      <button onClick={() => navigate('/properties')}
        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sm rounded-lg transition-colors text-slate-300 mb-4">
        ← Volver
      </button>
      <p className="text-red-400">Propiedad no encontrada.</p>
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => navigate(`/properties/${id}`)}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sm rounded-lg transition-colors text-slate-300">
          ← Cancelar
        </button>
        <h1 className="text-xl font-bold flex-1">Editar: {property.name}</h1>
        <button onClick={handleSave} disabled={saving}
          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-sm rounded-lg font-semibold transition-colors">
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 text-red-400 text-sm px-4 py-3 rounded-xl">{error}</div>
      )}

      {/* Formulario */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className={labelCls}>Nombre *</label>
            <input value={form.name || ''} onChange={f('name')} className={inputCls} />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>Dirección</label>
            <input value={form.address || ''} onChange={f('address')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Ciudad</label>
            <input value={form.city || ''} onChange={f('city')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Provincia</label>
            <input value={form.province || ''} onChange={f('province')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Código Postal</label>
            <input value={form.postalCode || ''} onChange={f('postalCode')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>País</label>
            <select value={form.country || ''} onChange={f('country')}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500">
              <option value="">— Sin especificar —</option>
              {WORLD_COUNTRIES.map(c => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Habitaciones</label>
            <input type="number" min="0" value={form.rooms ?? ''} onChange={f('rooms')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Baños</label>
            <input type="number" min="0" value={form.bathrooms ?? ''} onChange={f('bathrooms')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Máx. huéspedes</label>
            <input type="number" min="0" value={form.maxGuests ?? ''} onChange={f('maxGuests')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Precio/noche (€)</label>
            <input type="number" min="0" step="0.01" value={form.pricePerNight ?? ''} onChange={f('pricePerNight')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Precio de compra (€)</label>
            <input type="number" min="0" step="0.01" value={form.purchasePrice ?? ''} onChange={f('purchasePrice')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Estado</label>
            <select value={form.status || 'active'} onChange={f('status')}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500">
              <option value="active">Activa</option>
              <option value="maintenance">Mantenimiento</option>
              <option value="inactive">Inactiva</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Código SES establecimiento</label>
            <input value={form.sesCodigoEstablecimiento || ''} onChange={f('sesCodigoEstablecimiento')} className={inputCls} />
          </div>
        </div>
      </div>

      {/* Botones pie */}
      <div className="flex gap-3">
        <button onClick={() => navigate(`/properties/${id}`)}
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
