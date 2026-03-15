import { useRef, useState } from 'react';
import { api } from '../lib/api';

interface ExcelButtonsProps {
  entity: 'clients' | 'bookings' | 'expenses' | 'properties';
  onImportSuccess?: (result: { imported: number; errors: string[] }) => void;
  showImport?: boolean;
}

export default function ExcelButtons({ entity, onImportSuccess, showImport = true }: ExcelButtonsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null);

  const canImport = entity === 'clients' || entity === 'expenses' || entity === 'bookings';

  const handleExport = async () => {
    try {
      const response = await api.get(`/excel/export/${entity}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${entity}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert('Error al exportar');
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await api.get(`/excel/template/${entity}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `plantilla_${entity}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert('Error al descargar plantilla');
    }
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await api.post(`/excel/import/${entity}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setResult(response.data);
      setShowResult(true);
      onImportSuccess?.(response.data);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Error al importar');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Exportar */}
        <button onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium rounded-lg transition-colors">
          <span>⬇️</span> Exportar Excel
        </button>

        {/* Importar — solo clients y expenses */}
        {canImport && showImport && (
          <>
            <button onClick={handleDownloadTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium rounded-lg transition-colors">
              <span>📋</span> Plantilla
            </button>
            <button onClick={() => fileInputRef.current?.click()} disabled={importing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-xs font-medium rounded-lg transition-colors disabled:opacity-50">
              <span>⬆️</span> {importing ? 'Importando...' : 'Importar Excel'}
            </button>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={e => e.target.files?.[0] && handleImport(e.target.files[0])} />
          </>
        )}
      </div>

      {/* Modal resultado importación */}
      {showResult && result && (
        <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center p-0 md:p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-t-2xl md:rounded-2xl w-full md:max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <h3 className="font-bold text-lg mb-4">Resultado de la importación</h3>
            <div className="mb-4 p-3 bg-emerald-600/10 border border-emerald-600/20 rounded-lg">
              <p className="text-emerald-400 font-medium">✅ {result.imported} registros importados correctamente</p>
            </div>
            {result.errors.length > 0 && (
              <div className="mb-4">
                <p className="text-red-400 font-medium mb-2">⚠️ {result.errors.length} errores:</p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {result.errors.map((err, i) => (
                    <p key={i} className="text-xs text-slate-400 bg-slate-800 px-3 py-1.5 rounded">{err}</p>
                  ))}
                </div>
              </div>
            )}
            <button onClick={() => setShowResult(false)}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2.5 rounded-xl transition-colors">
              Cerrar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
