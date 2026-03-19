import { useState } from 'react';
import Police from './Police';
import NruaExport from '../components/NruaExport';

export default function TransmisionDatos() {
  const [tab, setTab] = useState<'ses' | 'nrua'>('ses');

  return (
    <div>
      {/* Cabecera + tabs */}
      <div className="p-4 md:p-6 pb-0">
        <h1 className="text-2xl font-bold mb-1">Transmisión de datos</h1>
        <p className="text-slate-400 text-sm mb-4">Partes SES y exportación N2 (NRUA)</p>
        <div className="flex border-b border-slate-800">
          <button
            onClick={() => setTab('ses')}
            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              tab === 'ses'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            📡 Partes SES
          </button>
          <button
            onClick={() => setTab('nrua')}
            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              tab === 'nrua'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            📋 N2 (NRUA)
          </button>
        </div>
      </div>

      {/* Contenido */}
      {tab === 'ses' && <Police />}
      {tab === 'nrua' && (
        <div className="p-4 md:p-6">
          <NruaExport />
        </div>
      )}
    </div>
  );
}
