import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

interface Template {
  id: string;
  name: string;
  type: string;
  content: string;
  ownerName: string;
  ownerNif: string;
  ownerAddress?: string;
  ownerSignature?: string;
  depositAmount?: string;
  clauses?: string;
  isActive: boolean;
}

const TYPES = ['vacacional', 'larga_estancia', 'temporada', 'otro'];

const VARIABLES = [
  { key: '{{clienteNombre}}',        desc: 'Nombre completo del cliente' },
  { key: '{{clienteDni}}',           desc: 'DNI/Pasaporte del cliente' },
  { key: '{{propietarioNombre}}',    desc: 'Nombre del propietario' },
  { key: '{{propietarioNif}}',       desc: 'NIF del propietario' },
  { key: '{{propietarioDireccion}}', desc: 'Dirección del propietario' },
  { key: '{{propiedadDireccion}}',   desc: 'Dirección de la propiedad' },
  { key: '{{propiedadCiudad}}',      desc: 'Ciudad de la propiedad' },
  { key: '{{fechaEntrada}}',         desc: 'Fecha de check-in' },
  { key: '{{fechaSalida}}',          desc: 'Fecha de check-out' },
  { key: '{{precioTotal}}',          desc: 'Precio total de la reserva' },
  { key: '{{fianza}}',               desc: 'Importe de la fianza' },
  { key: '{{clausulas}}',            desc: 'Cláusulas adicionales' },
  { key: '{{ciudad}}',               desc: 'Ciudad del contrato' },
  { key: '{{fecha}}',                desc: 'Fecha de creación' },
  { key: '{{fechaFirma}}',           desc: 'Fecha de firma' },
];

const emptyForm = {
  name: '', type: 'vacacional', content: '', ownerName: '',
  ownerNif: '', ownerAddress: '', ownerSignature: '', depositAmount: '', clauses: '', isActive: true,
};

function SignaturePad({ value, onChange }: { value?: string; onChange: (sig: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = value;
      setHasSignature(true);
    }
  }, [value]);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setIsDrawing(true);
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDraw = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas && hasSignature) onChange(canvas.toDataURL('image/png'));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onChange('');
  };

  return (
    <div>
      <div className="border-2 border-slate-600 rounded-lg overflow-hidden bg-white touch-none">
        <canvas
          ref={canvasRef}
          width={400} height={100}
          className="w-full cursor-crosshair"
          onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
          onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
        />
      </div>
      <div className="flex items-center justify-between mt-1">
        <p className="text-xs text-slate-500">Dibuja la firma aquí</p>
        {hasSignature && (
          <button type="button" onClick={clear} className="text-xs text-red-400 hover:text-red-300">Borrar</button>
        )}
      </div>
    </div>
  );
}

export default function ContractTemplates() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Template | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showNew, setShowNew] = useState(false);
  const [preview, setPreview] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['contract-templates'],
    queryFn: () => api.get('/contracts/templates').then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/contracts/templates', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contract-templates'] });
      setShowNew(false);
      setForm(emptyForm);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => api.put(`/contracts/templates/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contract-templates'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/contracts/templates/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contract-templates'] }); setSelected(null); },
  });

  const insertVariable = (variable: string) => {
    if (!selected) return;
    const textarea = document.getElementById('content-editor') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = selected.content.substring(0, start) + variable + selected.content.substring(end);
      setSelected({ ...selected, content: newContent });
    } else {
      setSelected({ ...selected, content: selected.content + variable });
    }
  };

  const renderPreview = (content: string) => {
    if (!selected) return content;
    return content
      .replace(/\{\{clienteNombre\}\}/g, 'Juan García López')
      .replace(/\{\{clienteDni\}\}/g, '12345678A')
      .replace(/\{\{propietarioNombre\}\}/g, selected.ownerName || 'Propietario')
      .replace(/\{\{propietarioNif\}\}/g, selected.ownerNif || 'B12345678')
      .replace(/\{\{propietarioDireccion\}\}/g, selected.ownerAddress || 'Calle Mayor 1, Madrid')
      .replace(/\{\{propiedadDireccion\}\}/g, 'Calle del Mar 12')
      .replace(/\{\{propiedadCiudad\}\}/g, 'Marbella')
      .replace(/\{\{fechaEntrada\}\}/g, '01/04/2026')
      .replace(/\{\{fechaSalida\}\}/g, '07/04/2026')
      .replace(/\{\{precioTotal\}\}/g, '1.320')
      .replace(/\{\{fianza\}\}/g, selected.depositAmount || '500')
      .replace(/\{\{clausulas\}\}/g, selected.clauses || '')
      .replace(/\{\{ciudad\}\}/g, 'Madrid')
      .replace(/\{\{fecha\}\}/g, new Date().toLocaleDateString('es-ES'))
      .replace(/\{\{fechaFirma\}\}/g, new Date().toLocaleDateString('es-ES'));
  };

  return (
    <div className="flex h-full">
      {/* Lista */}
      <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="p-4 border-b border-slate-800">
          <h2 className="font-bold text-sm mb-3">Templates de contrato</h2>
          <button onClick={() => { setShowNew(true); setSelected(null); setForm(emptyForm); }}
            className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-xs font-semibold transition-colors">
            + Nuevo template
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {isLoading ? <div className="text-slate-400 text-xs text-center py-8">Cargando...</div> :
            templates.map((t: Template) => (
              <button key={t.id} onClick={() => { setSelected(t); setShowNew(false); setPreview(false); }}
                className={`w-full text-left px-3 py-3 rounded-lg mb-1 transition-colors ${selected?.id === t.id ? 'bg-slate-700' : 'hover:bg-slate-800'}`}>
                <div className="text-sm font-medium text-white truncate">{t.name}</div>
                <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                  {t.type}
                  {t.ownerSignature && <span className="text-emerald-400">✓ Firmado</span>}
                </div>
              </button>
            ))
          }
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {showNew ? (
          <div className="flex-1 overflow-y-auto p-6">
            <h2 className="text-xl font-bold mb-6">Nuevo template</h2>
            <div className="max-w-2xl space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Nombre *</label>
                  <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Tipo *</label>
                  <select value={form.type} onChange={e => setForm({...form, type: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500">
                    {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Nombre propietario *</label>
                  <input value={form.ownerName} onChange={e => setForm({...form, ownerName: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">NIF propietario *</label>
                  <input value={form.ownerNif} onChange={e => setForm({...form, ownerNif: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Dirección propietario</label>
                  <input value={form.ownerAddress} onChange={e => setForm({...form, ownerAddress: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Fianza (€)</label>
                  <input type="number" value={form.depositAmount} onChange={e => setForm({...form, depositAmount: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Cláusulas adicionales</label>
                <textarea value={form.clauses} onChange={e => setForm({...form, clauses: e.target.value})} rows={3}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 resize-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Firma del arrendador</label>
                <SignaturePad value={form.ownerSignature} onChange={sig => setForm({...form, ownerSignature: sig})} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Contenido del contrato *</label>
                <textarea value={form.content} onChange={e => setForm({...form, content: e.target.value})} rows={15}
                  placeholder="Escribe el contenido del contrato usando {{variables}}..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 resize-none font-mono" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowNew(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-semibold transition-colors">Cancelar</button>
                <button onClick={() => createMutation.mutate({ ...form, depositAmount: form.depositAmount ? Number(form.depositAmount) : undefined })}
                  disabled={!form.name || !form.ownerName || !form.ownerNif || !form.content}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 rounded-lg text-sm font-semibold transition-colors">
                  Crear template
                </button>
              </div>
            </div>
          </div>
        ) : selected ? (
          <>
            <div className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="font-bold">{selected.name}</h2>
                <p className="text-xs text-slate-400">
                  {selected.type} · {selected.ownerSignature ? '✓ Firma guardada' : '⚠️ Sin firma del arrendador'}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setPreview(!preview)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${preview ? 'bg-emerald-600 text-white' : 'bg-slate-800 hover:bg-slate-700'}`}>
                  {preview ? '✏️ Editar' : '👁 Vista previa'}
                </button>
                <button onClick={() => updateMutation.mutate({ id: selected.id, data: selected })} disabled={updateMutation.isPending}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-xs font-semibold transition-colors">
                  {saved ? '✅ Guardado' : updateMutation.isPending ? 'Guardando...' : '💾 Guardar'}
                </button>
                <button onClick={() => { if(confirm('¿Eliminar template?')) deleteMutation.mutate(selected.id); }}
                  className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-semibold transition-colors">
                  Eliminar
                </button>
              </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {!preview && (
                <div className="w-72 border-r border-slate-800 overflow-y-auto p-4 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Nombre</label>
                    <input value={selected.name} onChange={e => setSelected({...selected, name: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Tipo</label>
                    <select value={selected.type} onChange={e => setSelected({...selected, type: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500">
                      {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Propietario</label>
                    <input value={selected.ownerName} onChange={e => setSelected({...selected, ownerName: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">NIF</label>
                    <input value={selected.ownerNif} onChange={e => setSelected({...selected, ownerNif: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Dirección</label>
                    <input value={selected.ownerAddress || ''} onChange={e => setSelected({...selected, ownerAddress: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Fianza (€)</label>
                    <input type="number" value={selected.depositAmount || ''} onChange={e => setSelected({...selected, depositAmount: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Cláusulas</label>
                    <textarea value={selected.clauses || ''} onChange={e => setSelected({...selected, clauses: e.target.value})} rows={3}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500 resize-none" />
                  </div>

                  <div className="border-t border-slate-700 pt-4">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Firma del arrendador
                    </label>
                    <SignaturePad
                      key={selected.id}
                      value={selected.ownerSignature}
                      onChange={sig => setSelected({...selected, ownerSignature: sig})}
                    />
                  </div>

                  <div className="border-t border-slate-700 pt-4">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Variables disponibles</label>
                    <div className="space-y-1">
                      {VARIABLES.map(v => (
                        <button key={v.key} onClick={() => insertVariable(v.key)}
                          className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-800 transition-colors group">
                          <div className="text-xs font-mono text-emerald-400">{v.key}</div>
                          <div className="text-xs text-slate-500 group-hover:text-slate-400">{v.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-4">
                {preview ? (
                  <div className="bg-white text-slate-900 rounded-xl p-8 max-w-2xl mx-auto">
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                      {renderPreview(selected.content)}
                    </pre>
                    {selected.ownerSignature && (
                      <div className="mt-8 pt-4 border-t border-slate-200">
                        <p className="text-xs text-slate-500 mb-2">Firma del arrendador:</p>
                        <img src={selected.ownerSignature} className="max-w-xs border border-slate-200 rounded" alt="Firma" />
                      </div>
                    )}
                  </div>
                ) : (
                  <textarea id="content-editor" value={selected.content}
                    onChange={e => setSelected({...selected, content: e.target.value})}
                    className="w-full h-full min-h-96 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500 resize-none font-mono leading-relaxed"
                    placeholder="Contenido del contrato..." />
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <div className="text-4xl mb-3">📄</div>
              <p>Selecciona un template para editar</p>
              <p className="text-sm mt-1">o crea uno nuevo</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
