import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';

interface Props {
  propertyId?: string;
  globalContent?: { houseRules?: string | null; arrivalGuide?: string | null; localInfo?: string | null };
}

export default function ContentEditor({ propertyId, globalContent }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({ houseRules: '', arrivalGuide: '', localInfo: '' });
  const [initialized, setInitialized] = useState(false);

  const queryKey = propertyId
    ? ['property-content', propertyId]
    : ['property-content', 'global'];

  const docsQueryKey = propertyId
    ? ['property-docs', propertyId]
    : ['property-docs', 'global'];

  const { data: content } = useQuery({
    queryKey,
    queryFn: () => api.get('/property-content', {
      params: propertyId ? { propertyId } : {},
    }).then(r => r.data),
  });

  const { data: documents = [], refetch: refetchDocs } = useQuery({
    queryKey: docsQueryKey,
    queryFn: () => api.get('/property-content/documents', {
      params: propertyId ? { propertyId } : {},
    }).then(r => r.data),
  });

  useEffect(() => {
    if (content && !initialized) {
      setForm({
        houseRules:   (propertyId ? content._specific?.houseRules   : content.houseRules)   ?? '',
        arrivalGuide: (propertyId ? content._specific?.arrivalGuide : content.arrivalGuide) ?? '',
        localInfo:    (propertyId ? content._specific?.localInfo    : content.localInfo)    ?? '',
      });
      setInitialized(true);
    }
  }, [content, initialized, propertyId]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => api.put('/property-content', data, {
      params: propertyId ? { propertyId } : {},
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      setInitialized(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (docId: string) => api.delete(`/property-content/documents/${docId}`),
    onSuccess: () => refetchDocs(),
  });

  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.includes('pdf')) { alert('Solo se permiten archivos PDF'); return; }
    if (file.size > 10 * 1024 * 1024) { alert('El PDF no puede superar 10MB'); return; }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = (ev.target?.result as string).split(',')[1];
      await api.post('/property-content/documents', {
        name: file.name.replace(/\.pdf$/i, ''),
        fileData: base64,
        fileSize: file.size,
      }, { params: propertyId ? { propertyId } : {} });
      refetchDocs();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const getPlaceholder = (field: string, globalVal?: string | null) => {
    if (!propertyId) return (t as any)(`content.${field}Placeholder`) || '';
    return globalVal
      ? `${t('content.inheritedFromGlobal')}: ${globalVal.slice(0, 80)}${globalVal.length > 80 ? '...' : ''}`
      : ((t as any)(`content.${field}Placeholder`) || '');
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-5">
      {propertyId && globalContent && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-xs text-slate-400">
          ℹ️ {t('content.inheritedFromGlobal')} — los campos vacíos heredan el contenido global.
        </div>
      )}

      {/* Reglas de la casa */}
      <div>
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
          {t('content.houseRules')}
          {propertyId && form.houseRules && (
            <span className="ml-2 text-emerald-400 normal-case font-normal">· sobreescrito</span>
          )}
        </label>
        <textarea
          value={form.houseRules}
          onChange={e => setForm({ ...form, houseRules: e.target.value })}
          rows={5}
          placeholder={getPlaceholder('houseRules', globalContent?.houseRules)}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 resize-none placeholder:text-slate-600"
        />
      </div>

      {/* Guía de llegada */}
      <div>
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
          {t('content.arrivalGuide')}
          {propertyId && form.arrivalGuide && (
            <span className="ml-2 text-emerald-400 normal-case font-normal">· sobreescrito</span>
          )}
        </label>
        <textarea
          value={form.arrivalGuide}
          onChange={e => setForm({ ...form, arrivalGuide: e.target.value })}
          rows={5}
          placeholder={getPlaceholder('arrivalGuide', globalContent?.arrivalGuide)}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 resize-none placeholder:text-slate-600"
        />
      </div>

      {/* Info local */}
      <div>
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
          {t('content.localInfo')}
          {propertyId && form.localInfo && (
            <span className="ml-2 text-emerald-400 normal-case font-normal">· sobreescrito</span>
          )}
        </label>
        <textarea
          value={form.localInfo}
          onChange={e => setForm({ ...form, localInfo: e.target.value })}
          rows={4}
          placeholder={getPlaceholder('localInfo', globalContent?.localInfo)}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 resize-none placeholder:text-slate-600"
        />
      </div>

      <button
        onClick={() => saveMutation.mutate(form)}
        disabled={saveMutation.isPending}
        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 rounded-lg text-sm font-semibold transition-colors">
        {saved ? t('content.saved') : saveMutation.isPending ? t('content.saving') : t('content.save')}
      </button>

      {/* Documentos PDF */}
      <div className="border-t border-slate-700 pt-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
            📎 {t('content.documents')}
          </h4>
          <button
            onClick={() => pdfInputRef.current?.click()}
            className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">
            + {t('content.uploadPdf')}
          </button>
          <input ref={pdfInputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={handlePdfUpload} />
        </div>

        {(documents as any[]).length === 0 ? (
          <p className="text-slate-500 text-sm">{t('content.noDocuments')}</p>
        ) : (
          <div className="space-y-2">
            {(documents as any[]).map((doc: any) => (
              <div key={doc.id} className="flex items-center justify-between bg-slate-800 rounded-lg px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-red-400 shrink-0">📄</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{doc.name}</p>
                    <p className="text-xs text-slate-500">{formatSize(doc.fileSize)}{doc.propertyId === null ? ' · global' : ''}</p>
                  </div>
                </div>
                {(doc.propertyId === null ? !propertyId : true) && (
                  <button
                    onClick={() => { if (confirm(t('common.confirm_delete'))) deleteMutation.mutate(doc.id); }}
                    className="shrink-0 text-xs text-red-400 hover:text-red-300 px-2 py-1 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors">
                    {t('content.deleteDoc')}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
