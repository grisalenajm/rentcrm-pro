import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import RichTextEditor from './RichTextEditor';

interface Props {
  propertyId?: string;
}

export default function ContentEditor({ propertyId }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState(false);
  const [template, setTemplate] = useState('');
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

  const { data: globalContent } = useQuery({
    queryKey: ['property-content', 'global'],
    queryFn: () => api.get('/property-content').then(r => r.data),
    enabled: !!propertyId,
  });

  const { data: documents = [], refetch: refetchDocs } = useQuery({
    queryKey: docsQueryKey,
    queryFn: () => api.get('/property-content/documents', {
      params: propertyId ? { propertyId } : {},
    }).then(r => r.data),
  });

  useEffect(() => {
    if (content && !initialized) {
      // For property-specific editor: show only the property override, not merged
      const raw = propertyId ? (content._specific?.template ?? '') : (content.template ?? '');
      setTemplate(raw);
      setInitialized(true);
    }
  }, [content, initialized, propertyId]);

  // Reset when switching properties
  useEffect(() => {
    setInitialized(false);
    setTemplate('');
  }, [propertyId]);

  const saveMutation = useMutation({
    mutationFn: () => api.put('/property-content', { template }, {
      params: propertyId ? { propertyId } : {},
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ['property-content', 'global'] });
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

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const hasGlobal = !!globalContent?.template;
  const hasSpecific = !!content?._specific?.template;

  return (
    <div className="space-y-5">
      {/* Banner de herencia global (solo en editor de propiedad) */}
      {propertyId && !hasSpecific && hasGlobal && (
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
          <span className="text-amber-400 text-lg shrink-0">🌐</span>
          <div>
            <p className="text-sm font-semibold text-amber-400">{t('content.usingGlobalTemplate')}</p>
            <p className="text-xs text-slate-400 mt-0.5">Edita aquí para crear una versión personalizada para esta propiedad.</p>
          </div>
        </div>
      )}

      {/* Preview del template global cuando no hay override */}
      {propertyId && !hasSpecific && hasGlobal && (
        <div className="border border-slate-700 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-700">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Vista previa — plantilla global</span>
          </div>
          <div
            className="px-4 py-3 text-sm text-slate-300 leading-relaxed max-h-48 overflow-y-auto bg-slate-800/30"
            dangerouslySetInnerHTML={{ __html: globalContent.template }}
          />
        </div>
      )}

      {/* Editor */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {t('content.template')}
            {propertyId && hasSpecific && (
              <span className="ml-2 text-emerald-400 normal-case font-normal">· personalizado</span>
            )}
          </label>
          {propertyId && hasSpecific && (
            <button
              onClick={() => { setTemplate(''); saveMutation.mutate(); }}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
              ↩ Usar plantilla global
            </button>
          )}
        </div>
        <RichTextEditor
          value={template}
          onChange={setTemplate}
          placeholder={
            propertyId && hasGlobal
              ? 'Escribe aquí para personalizar esta propiedad (deja vacío para usar la plantilla global)...'
              : 'Escribe la plantilla del welcome package. Usa los botones para insertar variables como {{guest_name}} o {{property_name}}...'
          }
          minHeight="320px"
        />
      </div>

      <button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 rounded-lg text-sm font-semibold transition-colors">
        {saved ? t('content.saved') : saveMutation.isPending ? t('content.saving') : t('content.save')}
      </button>

      {/* Documentos PDF adjuntos */}
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
                    <p className="text-xs text-slate-500">
                      {formatSize(doc.fileSize)}
                      {doc.propertyId === null && propertyId && ' · global'}
                    </p>
                  </div>
                </div>
                {/* Solo permite borrar documentos propios del contexto actual */}
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
