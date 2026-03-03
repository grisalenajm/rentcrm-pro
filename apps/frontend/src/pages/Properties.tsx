import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

interface Property {
  id: string;
  name: string;
  city: string;
  province: string;
  rooms: number;
  bathrooms: number;
  maxGuests: number;
  pricePerNight: string;
  status: string;
  address: string;
  postalCode: string;
}

const statusLabel: Record<string, { label: string; color: string }> = {
  active:      { label: 'Activa',       color: 'bg-emerald-500/10 text-emerald-400' },
  maintenance: { label: 'Mantenimiento',color: 'bg-amber-500/10 text-amber-400'    },
  inactive:    { label: 'Inactiva',     color: 'bg-slate-500/10 text-slate-400'    },
};

const emptyForm = { name:'', address:'', city:'', province:'', postalCode:'', rooms:'', bathrooms:'', maxGuests:'', pricePerNight:'', status:'active' };

export default function Properties() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Property | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: properties = [], isLoading } = useQuery({
    queryKey: ['properties'],
    queryFn: () => api.get('/properties').then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/properties', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['properties'] }); setShowForm(false); setForm(emptyForm); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => api.put(`/properties/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['properties'] }); setEditing(null); setShowForm(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/properties/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties'] }),
  });

  const openCreate = () => { setEditing(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (p: Property) => {
    setEditing(p);
    setForm({ name:p.name, address:p.address, city:p.city, province:p.province,
      postalCode:p.postalCode||'', rooms:String(p.rooms), bathrooms:String(p.bathrooms||''),
      maxGuests:String(p.maxGuests||''), pricePerNight:String(p.pricePerNight||''), status:p.status });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { ...form, rooms: Number(form.rooms), bathrooms: Number(form.bathrooms),
      maxGuests: Number(form.maxGuests), pricePerNight: Number(form.pricePerNight) };
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate(data);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Propiedades</h1>
          <p className="text-slate-400 text-sm mt-1">{properties.length} propiedades registradas</p>
        </div>
        <button onClick={openCreate}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-semibold transition-colors">
          + Nueva propiedad
        </button>
      </div>

      {isLoading ? (
        <div className="text-slate-400 text-center py-20">Cargando...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {properties.map((p: Property) => (
            <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-white">{p.name}</h3>
                  <p className="text-slate-400 text-sm">{p.city}, {p.province}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusLabel[p.status]?.color}`}>
                  {statusLabel[p.status]?.label}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4 p-3 bg-slate-800 rounded-lg">
                <div className="text-center">
                  <div className="text-xs text-slate-500">Hab.</div>
                  <div className="font-semibold text-sm">{p.rooms}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-slate-500">Huésp.</div>
                  <div className="font-semibold text-sm">{p.maxGuests || '—'}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-slate-500">€/noche</div>
                  <div className="font-semibold text-sm text-emerald-400">€{p.pricePerNight}</div>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => openEdit(p)}
                  className="flex-1 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">
                  Editar
                </button>
                <button onClick={() => { if(confirm('¿Eliminar?')) deleteMutation.mutate(p.id); }}
                  className="flex-1 py-1.5 text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors">
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-lg">
            <h2 className="text-lg font-bold mb-5">{editing ? 'Editar propiedad' : 'Nueva propiedad'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Nombre</label>
                  <input value={form.name} onChange={e => setForm({...form, name:e.target.value})}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" required />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Dirección</label>
                  <input value={form.address} onChange={e => setForm({...form, address:e.target.value})}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Ciudad</label>
                  <input value={form.city} onChange={e => setForm({...form, city:e.target.value})}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Provincia</label>
                  <input value={form.province} onChange={e => setForm({...form, province:e.target.value})}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Habitaciones</label>
                  <input type="number" min="1" value={form.rooms} onChange={e => setForm({...form, rooms:e.target.value})}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Baños</label>
                  <input type="number" min="0" value={form.bathrooms} onChange={e => setForm({...form, bathrooms:e.target.value})}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Máx. huéspedes</label>
                  <input type="number" min="1" value={form.maxGuests} onChange={e => setForm({...form, maxGuests:e.target.value})}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">€/noche</label>
                  <input type="number" min="0" value={form.pricePerNight} onChange={e => setForm({...form, pricePerNight:e.target.value})}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Estado</label>
                  <select value={form.status} onChange={e => setForm({...form, status:e.target.value})}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500">
                    <option value="active">Activa</option>
                    <option value="maintenance">Mantenimiento</option>
                    <option value="inactive">Inactiva</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-semibold transition-colors">
                  Cancelar
                </button>
                <button type="submit"
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-semibold transition-colors">
                  {editing ? 'Guardar cambios' : 'Crear propiedad'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
