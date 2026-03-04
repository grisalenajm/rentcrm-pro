import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';

export default function SignContract() {
  const { token } = useParams<{ token: string }>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [signed, setSigned] = useState(false);

  const { data: contract, isLoading, isError, error } = useQuery({
    queryKey: ['contract-sign', token],
    queryFn: () => api.get(`/contracts/sign/${token}`).then(r => r.data),
    retry: false,
  });

  const signMutation = useMutation({
    mutationFn: (data: any) => api.post(`/contracts/sign/${token}`, data),
    onSuccess: () => setSigned(true),
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [contract]);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
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

  const stopDraw = () => setIsDrawing(false);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleSign = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const signatureImage = canvas.toDataURL('image/png');
    signMutation.mutate({ signatureImage, signerName });
  };

  const renderContent = (content: string) => {
    if (!contract) return content;
    const b = contract.booking;
    const t = contract.template;
    return content
      .replace(/\{\{clienteNombre\}\}/g, `${b.client.firstName} ${b.client.lastName}`)
      .replace(/\{\{clienteDni\}\}/g, b.client.dniPassport || '—')
      .replace(/\{\{propietarioNombre\}\}/g, t.ownerName)
      .replace(/\{\{propietarioNif\}\}/g, t.ownerNif)
      .replace(/\{\{propietarioDireccion\}\}/g, t.ownerAddress || '—')
      .replace(/\{\{propiedadDireccion\}\}/g, b.property.address || '—')
      .replace(/\{\{propiedadCiudad\}\}/g, b.property.city || '—')
      .replace(/\{\{fechaEntrada\}\}/g, new Date(b.checkInDate).toLocaleDateString('es-ES'))
      .replace(/\{\{fechaSalida\}\}/g, new Date(b.checkOutDate).toLocaleDateString('es-ES'))
      .replace(/\{\{precioTotal\}\}/g, b.totalAmount)
      .replace(/\{\{fianza\}\}/g, String(contract.depositAmount || t.depositAmount || '—'))
      .replace(/\{\{clausulas\}\}/g, t.clauses || '')
      .replace(/\{\{ciudad\}\}/g, b.property.city || '—')
      .replace(/\{\{fecha\}\}/g, new Date().toLocaleDateString('es-ES'))
      .replace(/\{\{fechaFirma\}\}/g, new Date().toLocaleDateString('es-ES'));
  };

  if (isLoading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-slate-500">Cargando contrato...</div>
    </div>
  );

  if (isError) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h1 className="text-xl font-bold text-slate-800 mb-2">Contrato no disponible</h1>
        <p className="text-slate-500">{(error as any)?.response?.data?.message || 'Este enlace no es válido o el contrato ya ha sido procesado.'}</p>
      </div>
    </div>
  );

  if (signed) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Contrato firmado</h1>
        <p className="text-slate-500">Tu firma ha sido registrada correctamente. Gracias.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white text-sm">🏘️</div>
          <div>
            <h1 className="font-bold text-slate-800">RentCRM Pro</h1>
            <p className="text-xs text-slate-500">Contrato de alquiler</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Info reserva */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6">
          <h2 className="font-semibold text-emerald-800 mb-2">{contract.booking.property.name}</h2>
          <div className="grid grid-cols-2 gap-2 text-sm text-emerald-700">
            <div>Check-in: <strong>{new Date(contract.booking.checkInDate).toLocaleDateString('es-ES')}</strong></div>
            <div>Check-out: <strong>{new Date(contract.booking.checkOutDate).toLocaleDateString('es-ES')}</strong></div>
            <div>Total: <strong>€{contract.booking.totalAmount}</strong></div>
            <div>Fianza: <strong>€{contract.depositAmount || contract.template.depositAmount || '—'}</strong></div>
          </div>
        </div>

        {/* Contenido del contrato */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
          <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700 leading-relaxed">
            {renderContent(contract.template.content)}
          </pre>
        </div>

        {/* Firma */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h3 className="font-bold text-slate-800 mb-4">Firma el contrato</h3>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">Tu nombre completo *</label>
            <input
              value={signerName}
              onChange={e => setSignerName(e.target.value)}
              placeholder="Escribe tu nombre y apellidos"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="mb-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Firma aquí *</label>
            <div className="border-2 border-slate-300 rounded-xl overflow-hidden bg-white touch-none">
              <canvas
                ref={canvasRef}
                width={600}
                height={180}
                className="w-full cursor-crosshair"
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={stopDraw}
                onMouseLeave={stopDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={stopDraw}
              />
            </div>
            <p className="text-xs text-slate-400 mt-1">Usa el ratón o el dedo para firmar</p>
          </div>

          <div className="flex gap-3 mt-4">
            <button onClick={clearSignature}
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
              Borrar firma
            </button>
            <button
              onClick={handleSign}
              disabled={!hasSignature || !signerName || signMutation.isPending}
              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-lg text-sm font-semibold transition-colors">
              {signMutation.isPending ? 'Firmando...' : '✍️ Firmar y confirmar contrato'}
            </button>
          </div>

          {signMutation.isError && (
            <p className="text-red-500 text-sm mt-3">Error al firmar. Inténtalo de nuevo.</p>
          )}
        </div>
      </div>
    </div>
  );
}
