import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

interface Property {
  id: string;
  name: string;
  nrua?: string;
}

export default function NruaExport() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [selected, setSelected] = useState<string[]>([]);
  const [downloading, setDownloading] = useState(false);

  const { data: allProperties = [] } = useQuery<Property[]>({
    queryKey: ['properties'],
    queryFn: () => api.get('/properties').then(r => r.data),
  });

  const properties = allProperties.filter((p: Property) => p.nrua);

  const toggle = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleDownload = async () => {
    if (selected.length === 0) return;
    setDownloading(true);
    try {
      for (const propertyId of selected) {
        const response = await api.get('/excel/export/nrua', {
          params: { propertyId, year },
          responseType: 'blob',
        });
        const prop = properties.find(p => p.id === propertyId);
        const safeName = (prop?.name || 'propiedad').replace(/[^a-zA-Z0-9_-]/g, '_');
        const filename = `N2_${safeName}_${year}.csv`;
        const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Error al generar el fichero N2');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mt-6">
      <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4">Fichero N2 (NRUA) — Comunidad Valenciana</h3>

      {properties.length === 0 ? (
        <p className="text-sm text-slate-500">Define el NRUA en las propiedades para poder generar el fichero N2.</p>
      ) : (
        <div className="space-y-4">
          {/* Selector de año */}
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Año</label>
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500">
              {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Lista de propiedades con NRUA */}
          <div className="space-y-2">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Propiedades</p>
            {properties.map(p => (
              <label key={p.id} className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={selected.includes(p.id)}
                  onChange={() => toggle(p.id)}
                  className="w-4 h-4 rounded accent-emerald-500"
                />
                <span className="text-sm text-slate-300 group-hover:text-white transition-colors">{p.name}</span>
                <span className="text-xs text-slate-500 font-mono">{p.nrua}</span>
              </label>
            ))}
          </div>

          {/* Botón descargar */}
          <button
            onClick={handleDownload}
            disabled={selected.length === 0 || downloading}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors">
            {downloading ? 'Generando…' : `⬇ Descargar N2${selected.length > 0 ? ` (${selected.length})` : ''}`}
          </button>
        </div>
      )}
    </div>
  );
}
